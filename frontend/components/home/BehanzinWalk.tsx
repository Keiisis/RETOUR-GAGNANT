"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_KING = "/models/behanzin-walk.glb";
const MODEL_AMAZONE = "/models/amazone-dance.glb";

// Progression (scrollYProgress de la section) à laquelle les Amazones apparaissent :
// exactement au beat « les Amazones du Dahomey » (2e paragraphe).
const AMAZONE_IN = 0.17;
const AMAZONE_FULL = 0.25;

/** Environnement studio NEUTRE procédural (RoomEnvironment three.js) → PMREM (CSP-safe). */
function StudioEnv() {
    const { scene, gl } = useThree();
    useEffect(() => {
        const pmrem = new THREE.PMREMGenerator(gl);
        const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
        scene.environment = rt.texture;
        return () => {
            scene.environment = null;
            rt.texture.dispose();
            pmrem.dispose();
        };
    }, [scene, gl]);
    return null;
}

/** Normalise un modèle → hauteur cible, pieds au sol (y=0), centré en X/Z. */
function normalize(scene: THREE.Object3D, targetHeight: number) {
    scene.updateWorldMatrix(true, true);
    let box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = size.y > 0 ? targetHeight / size.y : 1;
    scene.scale.setScalar(s);
    scene.updateWorldMatrix(true, true);
    box = new THREE.Box3().setFromObject(scene);
    scene.position.x -= (box.min.x + box.max.x) / 2;
    scene.position.z -= (box.min.z + box.max.z) / 2;
    scene.position.y -= box.min.y;
}

/**
 * Prépare les matériaux PBR. CLONE chaque matériau pour que chaque instance
 * possède les siens (opacité de fondu indépendante, side propre au miroir).
 */
function prepMaterials(scene: THREE.Object3D, transparent: boolean, out: THREE.MeshStandardMaterial[], doubleSide = false) {
    scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = list.map((mm) => {
            const m = (mm as THREE.MeshStandardMaterial).clone();
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            if ("envMapIntensity" in m) m.envMapIntensity = 0.9;
            // Miroir (scale.x=-1) : les triangles s'inversent → DoubleSide pour rester visible.
            if (doubleSide) m.side = THREE.DoubleSide;
            if (transparent) { m.transparent = true; m.opacity = 0; }
            m.needsUpdate = true;
            out.push(m);
            return m;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    });
}

// Temporaires réutilisés (pas d'alloc par frame).
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
/** Ajoute une petite rotation locale à un os, PAR-DESSUS sa pose animée. */
function addRot(bone: THREE.Object3D | undefined, rx: number, ry = 0, rz = 0) {
    if (!bone) return;
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    bone.quaternion.multiply(_q);
}

/**
 * Le Roi Béhanzin : au centre, majestueux ; clip « Casual_Walk » en boucle.
 *
 * Les bras du clip sont raides. On ajoute un MOUVEMENT SECONDAIRE PROCÉDURAL,
 * additif et appliqué APRÈS la mise à jour du mixer (d'où un mixer dédié, pour
 * garantir l'ordre) : un balancement pendulaire des bras (épaules → coudes en
 * léger retard = « follow-through »), une respiration d'épaules et un report de
 * poids du buste. Fonctions sinusoïdales (2 harmoniques) → ultra fluide ; petites
 * amplitudes → réaliste. La pose animée est réécrite à chaque frame par le mixer,
 * donc AUCUNE dérive (pas d'accumulation).
 */
function King({ reduce, x }: { reduce: boolean; x: number }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_KING);
    const bones = useRef<Record<string, THREE.Object3D>>({});
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const tRef = useRef(0);

    useMemo(() => {
        normalize(scene, 2.35);
        prepMaterials(scene, false, []);
        const b: Record<string, THREE.Object3D> = {};
        scene.traverse((o) => { if (o.name) b[o.name] = o; });
        bones.current = b;
    }, [scene]);

    useEffect(() => {
        if (!animations.length) return;
        const mixer = new THREE.AnimationMixer(scene);
        const action = mixer.clipAction(animations[0]);
        action.setLoop(THREE.LoopRepeat, Infinity).play();
        action.setEffectiveTimeScale(reduce ? 0 : 1);
        if (reduce) action.time = animations[0].duration * 0.4;
        mixer.update(0);
        mixerRef.current = mixer;
        return () => { mixer.stopAllAction(); mixerRef.current = null; };
    }, [scene, animations, reduce]);

    useFrame((_, delta) => {
        const mixer = mixerRef.current;
        if (!mixer) return;
        mixer.update(reduce ? 0 : delta); // pose du clip
        if (reduce) return;

        // ── Mouvement secondaire additif (bras plus vivants) ──────
        tRef.current += delta;
        const t = tRef.current;
        const w = 1.5;                          // pulsation du balancement (~4 s/cycle)
        const p = t * w;
        // 2 harmoniques = mouvement organique, jamais mécanique.
        const swL = Math.sin(p) + 0.22 * Math.sin(p * 2 + 0.6);
        const swR = Math.sin(p + Math.PI) + 0.22 * Math.sin(p * 2 + Math.PI + 0.6);
        const lagL = Math.sin(p - 0.55) + 0.18 * Math.sin(p * 2 - 0.2);
        const lagR = Math.sin(p + Math.PI - 0.55) + 0.18 * Math.sin(p * 2 + Math.PI - 0.2);
        const B = bones.current;

        // Épaules : léger roulis alterné (respiration).
        addRot(B.LeftShoulder, 0.05 * swL, 0, 0.035 * swL);
        addRot(B.RightShoulder, 0.05 * swR, 0, -0.035 * swR);
        // Bras (épaule) : balancement avant/arrière + très légère ouverture.
        addRot(B.LeftArm, 0.13 * swL, 0.03 * swL, 0.05);
        addRot(B.RightArm, 0.13 * swR, -0.03 * swR, -0.05);
        // Avant-bras : suit avec du retard (follow-through) → coude vivant.
        addRot(B.LeftForeArm, 0.10 * lagL, 0.04 * lagL, 0);
        addRot(B.RightForeArm, 0.10 * lagR, -0.04 * lagR, 0);
        // Buste : report de poids subtil (tout le corps respire).
        addRot(B.Spine, 0, 0.015 * Math.sin(p), 0.02 * Math.sin(p));
    });

    return (
        <group ref={group} position={[x, 0, 0]}>
            <primitive object={scene} />
        </group>
    );
}

/**
 * Une Amazone dansante (instance INDÉPENDANTE clonée du GLB partagé).
 * `mirror` la retourne en MIROIR (scale.x=-1) → reflet exact de l'autre.
 * Danse en BOUCLE SANS COUTURE : deux actions du même clip, poids explicites de
 * somme TOUJOURS = 1 (jamais de pose bind / T-pose ; jointure fin→début morphée).
 * Apparition au beat des Amazones (opacité + montée pilotées par progressRef).
 */
function DancingAmazone({
    x, mirror, reduce, progressRef,
}: {
    x: number; mirror: boolean; reduce: boolean; progressRef: MutableRefObject<number>;
}) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_AMAZONE);
    const inst = useMemo(() => cloneSkinned(scene), [scene]);
    const mats = useRef<THREE.MeshStandardMaterial[]>([]);
    const st = useRef<{
        mixer: THREE.AnimationMixer;
        a: THREE.AnimationAction;
        b: THREE.AnimationAction;
        lead: "a" | "b";
        dur: number;
        F: number;
        trans: boolean;
    } | null>(null);

    useMemo(() => {
        normalize(inst, 2.0);
        mats.current = [];
        prepMaterials(inst, true, mats.current, mirror);
    }, [inst, mirror]);

    useEffect(() => {
        if (!animations.length) return;
        const mixer = new THREE.AnimationMixer(inst);
        const clip = animations[0];
        const a = mixer.clipAction(clip.clone());
        const b = mixer.clipAction(clip.clone());
        const ts = reduce ? 0 : 0.85;
        for (const act of [a, b]) {
            act.setLoop(THREE.LoopRepeat, Infinity);
            act.enabled = true;
            act.clampWhenFinished = false;
            act.setEffectiveTimeScale(ts);
            act.play();
        }
        a.setEffectiveWeight(1);
        b.setEffectiveWeight(0);
        if (reduce) a.time = clip.duration * 0.35;
        mixer.update(0);
        st.current = { mixer, a, b, lead: "a", dur: clip.duration, F: 0.9, trans: false };
        return () => { mixer.stopAllAction(); st.current = null; };
    }, [inst, animations, reduce]);

    useFrame((_, delta) => {
        const s = st.current;
        if (s && !reduce) {
            s.mixer.update(delta);
            const lead = s.lead === "a" ? s.a : s.b;
            const follow = s.lead === "a" ? s.b : s.a;
            if (!s.trans && lead.time > s.dur - s.F) {
                s.trans = true;
                follow.reset();
                follow.time = 0;
                follow.setEffectiveWeight(0);
                follow.play();
            }
            if (s.trans) {
                const blend = THREE.MathUtils.clamp(follow.time / s.F, 0, 1);
                lead.setEffectiveWeight(1 - blend);
                follow.setEffectiveWeight(blend);
                if (blend >= 1) {
                    s.trans = false;
                    lead.setEffectiveWeight(0);
                    s.lead = s.lead === "a" ? "b" : "a";
                }
            } else {
                lead.setEffectiveWeight(1);
                follow.setEffectiveWeight(0);
            }
            if (s.a.getEffectiveWeight() + s.b.getEffectiveWeight() < 0.4) {
                (s.lead === "a" ? s.a : s.b).setEffectiveWeight(1);
            }
        }

        const g = group.current;
        if (!g) return;
        const p = reduce ? 1 : progressRef.current;
        const t = THREE.MathUtils.clamp((p - AMAZONE_IN) / (AMAZONE_FULL - AMAZONE_IN), 0, 1);
        const eased = t * t * (3 - 2 * t);
        g.visible = reduce || eased > 0.002;
        g.position.y = (1 - eased) * -0.28;
        for (const m of mats.current) m.opacity = eased;
    });

    return (
        <group ref={group} position={[x, 0, 0]} scale={mirror ? [-1, 1, 1] : [1, 1, 1]}>
            <primitive object={inst} />
        </group>
    );
}

/**
 * Travelling AVANT piloté par le scroll (0 → 1) : plus on descend, plus la caméra
 * se rapproche → les figures grandissent. Distance ADAPTÉE au ratio (recul sur
 * cadre étroit) pour garder les TROIS figures dans le champ.
 */
function Rig({ progressRef, reduce }: { progressRef: MutableRefObject<number>; reduce: boolean }) {
    const { camera, size } = useThree();
    useFrame(() => {
        const p = reduce ? 0.35 : progressRef.current;
        const aspect = size.width / Math.max(1, size.height);
        const narrow = aspect < 0.95;
        const zStart = narrow ? 14.5 : 11.4;
        const zEnd = narrow ? 11.2 : 8.4;
        const z = THREE.MathUtils.lerp(zStart, zEnd, p);
        const y = THREE.MathUtils.lerp(1.0, 1.28, p);
        camera.position.z += (z - camera.position.z) * 0.06;
        camera.position.y += (y - camera.position.y) * 0.06;
        camera.lookAt(0, 1.08, 0);
    });
    return null;
}

export default function BehanzinWalk({
    progressRef,
    className = "",
}: {
    progressRef: MutableRefObject<number>;
    className?: string;
}) {
    const reduce = useReducedMotion() ?? false;
    return (
        <Canvas
            className={className}
            dpr={[1, 2]}
            camera={{ position: [0, 1.0, 11.4], fov: 40 }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
            style={{ background: "transparent" }}
            aria-hidden="true"
        >
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 9, 6]} intensity={1.05} color="#fff4e2" />
            <directionalLight position={[-7, 5, 2]} intensity={0.45} color="#eef2f6" />
            <Suspense fallback={null}>
                <StudioEnv />
                {/* Le Roi au CENTRE ; une Amazone à gauche, une à droite EN MIROIR. */}
                <DancingAmazone x={-2.0} mirror={false} reduce={reduce} progressRef={progressRef} />
                <King reduce={reduce} x={0} />
                <DancingAmazone x={2.0} mirror={true} reduce={reduce} progressRef={progressRef} />
                <ContactShadows
                    position={[0, 0, 0]}
                    opacity={0.3}
                    scale={16}
                    blur={2.8}
                    far={4}
                    resolution={1024}
                    color="#2a2018"
                />
                <Rig progressRef={progressRef} reduce={reduce} />
            </Suspense>
        </Canvas>
    );
}

useGLTF.preload(MODEL_KING);
useGLTF.preload(MODEL_AMAZONE);
