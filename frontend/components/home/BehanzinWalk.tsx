"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_KING = "/models/behanzin-walk.glb";
const MODEL_AMAZONE = "/models/amazone-dance.glb";

// Progression (scrollYProgress de la section) à laquelle l'Amazone apparaît :
// exactement au beat « les Amazones du Dahomey » (2e paragraphe, fenêtre ~0,19).
const AMAZONE_IN = 0.17;
const AMAZONE_FULL = 0.25;

/**
 * Environnement studio NEUTRE procédural (RoomEnvironment three.js) → PMREM.
 * Aucun fetch externe (CSP-safe). Éclaire les PBR texturés sans écraser leur
 * couleur d'origine.
 */
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

/** Normalise un modèle authoré à une échelle arbitraire → hauteur cible, pieds au sol. */
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

function prepMaterials(scene: THREE.Object3D, transparent: boolean, out?: THREE.MeshStandardMaterial[]) {
    scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mm of list) {
            const m = mm as THREE.MeshStandardMaterial;
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            if ("envMapIntensity" in m) m.envMapIntensity = 0.9;
            if (transparent) {
                m.transparent = true;
                m.opacity = 0;
            }
            m.needsUpdate = true;
            out?.push(m);
        }
    });
}

/** Le Roi Béhanzin — mesh skinné + clip « Casual_Walk » (marche en place). */
function King({ reduce, x }: { reduce: boolean; x: number }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_KING);
    const { actions, names } = useAnimations(animations, group);

    useMemo(() => {
        normalize(scene, 2.15);
        prepMaterials(scene, false);
    }, [scene]);

    useEffect(() => {
        const key = names[0];
        if (!key) return;
        const action = actions[key];
        if (!action) return;
        action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        action.setEffectiveTimeScale(reduce ? 0 : 1);
        if (reduce) action.time = action.getClip().duration * 0.4;
        return () => { action.stop(); };
    }, [actions, names, reduce]);

    return (
        <group ref={group} position={[x, 0, 0]}>
            <primitive object={scene} />
        </group>
    );
}

/**
 * L'Amazone du Dahomey — clip de danse en BOUCLE VRAIMENT SANS COUTURE.
 *
 * Deux actions du MÊME clip (l'un cloné) sur un mixer dédié. À l'approche de la
 * fin (fenêtre F), on relance l'AUTRE à t=0 et on fond l'une dans l'autre avec des
 * poids EXPLICITES dont la somme vaut TOUJOURS 1 : `sortante = 1-blend`,
 * `entrante = blend`, où `blend = tempsEntrante / F` (0→1, sans wrap). La pose
 * affichée est donc en permanence une pose valide de la danse → JAMAIS de retour
 * à la pose bind (les bras en T), et la jointure fin→début est morphée en douceur :
 * on ne « sent » plus l'action recommencer. Filet de sécurité : si les deux poids
 * tombaient sous 0,4 (désync improbable), on force la meneuse à 1.
 *
 * Elle APPARAÎT au beat des Amazones (opacité + montée pilotées par progressRef)
 * puis reste dansante aux côtés du Roi. Danse ralentie à 0,85× pour la fluidité.
 */
function Amazone({ reduce, x, progressRef }: { reduce: boolean; x: number; progressRef: MutableRefObject<number> }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_AMAZONE);
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
        normalize(scene, 2.0);
        mats.current = [];
        prepMaterials(scene, true, mats.current);
    }, [scene]);

    useEffect(() => {
        const root = group.current;
        if (!root || !animations.length) return;
        const mixer = new THREE.AnimationMixer(root);
        const clip = animations[0];
        const a = mixer.clipAction(clip);
        const b = mixer.clipAction(clip.clone());
        const ts = reduce ? 0 : 0.85;
        for (const x2 of [a, b]) {
            x2.setLoop(THREE.LoopRepeat, Infinity);
            x2.enabled = true;
            x2.clampWhenFinished = false;
            x2.setEffectiveTimeScale(ts);
            x2.play();
        }
        a.setEffectiveWeight(1);
        b.setEffectiveWeight(0);
        if (reduce) { a.time = clip.duration * 0.35; }
        mixer.update(0);
        st.current = { mixer, a, b, lead: "a", dur: clip.duration, F: 0.9, trans: false };
        return () => { mixer.stopAllAction(); st.current = null; };
    }, [animations, reduce]);

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
            // Filet de sécurité : jamais deux poids nuls → jamais de pose bind.
            if (s.a.getEffectiveWeight() + s.b.getEffectiveWeight() < 0.4) {
                (s.lead === "a" ? s.a : s.b).setEffectiveWeight(1);
            }
        }

        const g = group.current;
        if (!g) return;
        const p = reduce ? 1 : progressRef.current;
        const t = THREE.MathUtils.clamp((p - AMAZONE_IN) / (AMAZONE_FULL - AMAZONE_IN), 0, 1);
        const eased = t * t * (3 - 2 * t); // smoothstep
        g.visible = reduce || eased > 0.002;
        g.position.y = (1 - eased) * -0.28;
        for (const m of mats.current) m.opacity = eased;
    });

    return (
        <group ref={group} position={[x, 0, 0]}>
            <primitive object={scene} />
        </group>
    );
}

/**
 * Travelling AVANT piloté par le scroll (0 → 1) : plus on descend, plus la caméra
 * se rapproche → les DEUX figures grandissent (« zoom »). Distance ADAPTÉE au
 * ratio du canvas (recul sur cadre étroit/mobile) pour ne jamais couper.
 */
function Rig({ progressRef, reduce }: { progressRef: MutableRefObject<number>; reduce: boolean }) {
    const { camera, size } = useThree();
    useFrame(() => {
        const p = reduce ? 0.35 : progressRef.current;
        const aspect = size.width / Math.max(1, size.height);
        const narrow = aspect < 0.95;
        const zStart = narrow ? 10.8 : 8.6; // départ : les deux figures cadrées
        const zEnd = narrow ? 7.6 : 5.7;    // fin : zoom marqué, elles grandissent
        const z = THREE.MathUtils.lerp(zStart, zEnd, p);
        const y = THREE.MathUtils.lerp(1.0, 1.3, p);
        // lissage fort = mouvement de caméra très fluide
        camera.position.z += (z - camera.position.z) * 0.06;
        camera.position.y += (y - camera.position.y) * 0.06;
        camera.lookAt(-0.05, 1.05, 0);
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
            camera={{ position: [0, 1.0, 8.6], fov: 40 }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
            style={{ background: "transparent" }}
            aria-hidden="true"
        >
            {/* Éclairage galerie sur fond BLANC : doux et neutre, pas de rim coloré. */}
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 9, 6]} intensity={1.05} color="#fff4e2" />
            <directionalLight position={[-7, 5, 2]} intensity={0.45} color="#eef2f6" />
            <Suspense fallback={null}>
                <StudioEnv />
                {/* Le Roi à GAUCHE, l'Amazone dansante à DROITE. */}
                <King reduce={reduce} x={-1.1} />
                <Amazone reduce={reduce} x={0.95} progressRef={progressRef} />
                <ContactShadows
                    position={[0, 0, 0]}
                    opacity={0.3}
                    scale={12}
                    blur={2.6}
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
