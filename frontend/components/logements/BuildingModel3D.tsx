"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Center, ContactShadows, Bounds } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL = "/models/logement-batiment.glb";

/**
 * Environnement studio NEUTRE procédural (RoomEnvironment de three.js) → PMREM.
 * Aucun fetch externe (CSP-safe) et reproduit fidèlement le rendu Meshy :
 * le bâtiment est un PBR MÉTALLIQUE, sa couleur (murs blancs, panneaux
 * terracotta, vitres vertes) vient du reflet de cet environnement, pas de
 * l'albédo. Vérifié par rendu headless (Chrome) avant intégration.
 */
function StudioEnv() {
    const { scene, gl } = useThree();
    useEffect(() => {
        const pmrem = new THREE.PMREMGenerator(gl);
        const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
        scene.environment = envRT.texture;
        return () => {
            scene.environment = null;
            envRT.texture.dispose();
            pmrem.dispose();
        };
    }, [scene, gl]);
    return null;
}

function Model() {
    const { scene } = useGLTF(MODEL, false);
    // PBR métallique d'origine PRÉSERVÉ (metalness=1 piloté par metallicRoughness).
    // On corrige juste le colorSpace de la texture et l'intensité d'env.
    useMemo(() => {
        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mm of mats) {
                const m = mm as THREE.MeshStandardMaterial;
                if ("metalness" in m) {
                    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                    m.envMapIntensity = 1.0;
                    m.needsUpdate = true;
                }
            }
        });
    }, [scene]);
    return (
        <Center>
            <primitive object={scene} />
        </Center>
    );
}

function Spin({ reduce, children }: { reduce: boolean; children: React.ReactNode }) {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        const g = ref.current;
        if (!g) return;
        if (reduce) {
            g.rotation.y = 0.4;
            g.rotation.x = 0;
            return;
        }
        const t = state.clock.elapsedTime;
        const baseY = Math.sin(t * 0.32) * 0.55;
        // parallaxe douce vers la souris
        const targetY = baseY + state.pointer.x * 0.4;
        const targetX = -state.pointer.y * 0.12;
        g.rotation.y += (targetY - g.rotation.y) * 0.06;
        g.rotation.x += (targetX - g.rotation.x) * 0.06;
    });
    return <group ref={ref}>{children}</group>;
}

export default function BuildingModel3D({ className = "" }: { className?: string }) {
    const reduce = useReducedMotion() ?? false;
    return (
        <div className={`relative ${className}`} aria-hidden="true">
            <Canvas
                dpr={[1, 1.75]}
                camera={{ position: [0, 0.4, 7], fov: 40 }}
                gl={{ antialias: true, alpha: true, toneMappingExposure: 1.0 }}
                style={{ background: "transparent" }}
            >
                {/* Fill léger ; la couleur vient de l'environnement studio (métal). */}
                <ambientLight intensity={0.15} />
                <directionalLight position={[5, 8, 5]} intensity={0.6} />
                <Suspense fallback={null}>
                    <StudioEnv />
                    <Bounds fit clip margin={1.15}>
                        <Spin reduce={reduce}>
                            <Model />
                        </Spin>
                    </Bounds>
                    <ContactShadows position={[0, -1.35, 0]} opacity={0.4} scale={14} blur={2.6} far={5} resolution={512} color="#0d1a12" />
                </Suspense>
            </Canvas>
        </div>
    );
}

useGLTF.preload(MODEL, false);
