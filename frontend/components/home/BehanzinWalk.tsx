"use client";

import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL = "/models/behanzin-walk.glb";

/**
 * Environnement studio NEUTRE procédural (RoomEnvironment three.js) → PMREM.
 * Aucun fetch externe (CSP-safe). Éclaire le PBR texturé du personnage sans
 * écraser sa couleur d'origine (Meshy : baseColor + emissive).
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

/**
 * Le Roi Béhanzin — mesh skinné + clip « Casual_Walk » (marche en place).
 * Le modèle est authoré à ~0,017 unité de haut : on le normalise à ~2,3 u,
 * pieds au sol (y=0), centré en X/Z. La marche boucle en continu ; le scroll
 * ne pilote QUE la caméra (cf. Rig) — jamais le clip, pour éviter le moonwalk
 * au scroll inversé.
 */
function King({ reduce }: { reduce: boolean }) {
    const group = useRef<THREE.Group>(null);
    const { scene, animations } = useGLTF(MODEL);
    const { actions, names } = useAnimations(animations, group);

    useMemo(() => {
        scene.updateWorldMatrix(true, true);
        let box = new THREE.Box3().setFromObject(scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const s = size.y > 0 ? 2.3 / size.y : 1;
        scene.scale.setScalar(s);
        scene.updateWorldMatrix(true, true);
        box = new THREE.Box3().setFromObject(scene);
        scene.position.x -= (box.min.x + box.max.x) / 2;
        scene.position.z -= (box.min.z + box.max.z) / 2;
        scene.position.y -= box.min.y;

        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            // Le mesh skinné se déforme hors de sa bbox de repos → pas de cull.
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
        if (reduce) action.time = action.getClip().duration * 0.4; // pose figée, en plein pas
        return () => {
            action.stop();
        };
    }, [actions, names, reduce]);

    return (
        <group ref={group}>
            <primitive object={scene} />
        </group>
    );
}

/** Léger travelling avant piloté par le scroll (0 → 1). */
function Rig({ progressRef, reduce }: { progressRef: MutableRefObject<number>; reduce: boolean }) {
    const { camera } = useThree();
    useFrame(() => {
        const p = reduce ? 0.4 : progressRef.current;
        const z = THREE.MathUtils.lerp(6.4, 4.7, p);
        const y = THREE.MathUtils.lerp(0.95, 1.3, p);
        camera.position.z += (z - camera.position.z) * 0.07;
        camera.position.y += (y - camera.position.y) * 0.07;
        camera.lookAt(0, 1.15, 0);
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
            camera={{ position: [0.5, 1.0, 6.4], fov: 38 }}
            gl={{ antialias: true, alpha: true, toneMappingExposure: 1.05 }}
            style={{ background: "transparent" }}
            aria-hidden="true"
        >
            {/* Éclairage galerie sur fond BLANC : lumière douce et neutre,
                pas de rim coloré (slop). La couleur vient du PBR + env studio. */}
            <ambientLight intensity={0.65} />
            {/* Key chaud discret (modelé du visage / du pagne) */}
            <directionalLight position={[4, 9, 6]} intensity={1.05} color="#fff4e2" />
            {/* Fill froid léger à gauche, pour sculpter sans colorer */}
            <directionalLight position={[-7, 5, 2]} intensity={0.45} color="#eef2f6" />
            <Suspense fallback={null}>
                <StudioEnv />
                <King reduce={reduce} />
                {/* Ombre portée RÉELLE, visible sur blanc → ancre les pieds au sol. */}
                <ContactShadows
                    position={[0, 0, 0]}
                    opacity={0.32}
                    scale={7.5}
                    blur={2.4}
                    far={3.5}
                    resolution={1024}
                    color="#2a2018"
                />
                <Rig progressRef={progressRef} reduce={reduce} />
            </Suspense>
        </Canvas>
    );
}

useGLTF.preload(MODEL);
