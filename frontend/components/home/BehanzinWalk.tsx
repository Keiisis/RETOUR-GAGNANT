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

/** Le Roi Béhanzin — mesh skinné + clip « Casual_Walk » (marche en place). */
function King({ reduce, x }: { reduce: boolean; x: number }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_KING);
    const { actions, names } = useAnimations(animations, group);

    useMemo(() => {
        normalize(scene, 2.15);
        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.frustumCulled = false;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mm of mats) {
                const m = mm as THREE.MeshStandardMaterial;
                if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                if ("envMapIntensity" in m) m.envMapIntensity = 0.9;
                m.needsUpdate = true;
            }
        });
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
 * L'Amazone du Dahomey — mesh skinné + clip de danse. Elle APPARAÎT au beat des
 * Amazones : opacité + montée pilotées par la progression du scroll (progressRef),
 * puis reste dansante aux côtés du Roi jusqu'à la fin.
 */
function Amazone({ reduce, x, progressRef }: { reduce: boolean; x: number; progressRef: MutableRefObject<number> }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL_AMAZONE);
    const { actions, names } = useAnimations(animations, group);
    const mats = useRef<THREE.MeshStandardMaterial[]>([]);

    useMemo(() => {
        normalize(scene, 1.98);
        mats.current = [];
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
                // Transparence pour le fondu d'apparition.
                m.transparent = true;
                m.opacity = reduce ? 1 : 0;
                m.depthWrite = true;
                m.needsUpdate = true;
                mats.current.push(m);
            }
        });
    }, [scene, reduce]);

    useEffect(() => {
        const key = names[0];
        if (!key) return;
        const action = actions[key];
        if (!action) return;
        action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
        action.setEffectiveTimeScale(reduce ? 0 : 1);
        if (reduce) action.time = action.getClip().duration * 0.35;
        return () => { action.stop(); };
    }, [actions, names, reduce]);

    useFrame(() => {
        const g = group.current;
        if (!g) return;
        const p = reduce ? 1 : progressRef.current;
        const t = THREE.MathUtils.clamp((p - AMAZONE_IN) / (AMAZONE_FULL - AMAZONE_IN), 0, 1);
        const eased = t * t * (3 - 2 * t); // smoothstep
        g.visible = eased > 0.002 || reduce;
        g.position.y = (1 - eased) * -0.28; // légère montée à l'apparition
        for (const m of mats.current) m.opacity = eased;
    });

    return (
        <group ref={group} position={[x, 0, 0]}>
            <primitive object={scene} />
        </group>
    );
}

/**
 * Travelling avant piloté par le scroll (0 → 1). Distance ADAPTÉE au ratio du
 * canvas : sur un cadre étroit/portrait (mobile), on recule pour garder les DEUX
 * figures (Roi + Amazone) entièrement dans le champ.
 */
function Rig({ progressRef, reduce }: { progressRef: MutableRefObject<number>; reduce: boolean }) {
    const { camera, size } = useThree();
    useFrame(() => {
        const p = reduce ? 0.4 : progressRef.current;
        const aspect = size.width / Math.max(1, size.height);
        const narrow = aspect < 0.95;
        const zNear = narrow ? 9.8 : 7.8;
        const zFar = narrow ? 8.6 : 6.5;
        const z = THREE.MathUtils.lerp(zNear, zFar, p);
        const y = THREE.MathUtils.lerp(1.0, 1.26, p);
        camera.position.z += (z - camera.position.z) * 0.07;
        camera.position.y += (y - camera.position.y) * 0.07;
        camera.lookAt(-0.1, 1.05, 0);
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
            dpr={[1, 1.75]}
            camera={{ position: [0, 1.0, 8.1], fov: 40 }}
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
                {/* Le Roi à droite, l'Amazone dansante à sa gauche. */}
                <King reduce={reduce} x={0.85} />
                <Amazone reduce={reduce} x={-1.15} progressRef={progressRef} />
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
