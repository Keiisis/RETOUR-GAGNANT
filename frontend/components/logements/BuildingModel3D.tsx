"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Center, ContactShadows, Bounds, Environment, Lightformer } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import type * as THREE from "three";

const MODEL = "/models/logement-batiment.glb";

function Model() {
    // GLB optimisé (meshopt + textures 1024 JPEG). useDraco=false, meshopt auto.
    const { scene } = useGLTF(MODEL, false);
    // Le matériau exporté est 100% métallique (metalness=1) → il reflète
    // l'environnement (blanc) au lieu d'afficher sa texture. On le passe en
    // diélectrique mat pour révéler les couleurs (brique / fenêtres / murs).
    useMemo(() => {
        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mm of mats) {
                const m = mm as THREE.MeshStandardMaterial;
                if ("metalness" in m) {
                    m.metalness = 0.05;
                    m.roughness = Math.max(m.roughness ?? 1, 0.65);
                    m.envMapIntensity = 0.55;
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
                gl={{ antialias: true, alpha: true }}
                style={{ background: "transparent" }}
            >
                <ambientLight intensity={0.55} />
                <hemisphereLight args={["#ffffff", "#c2cdc6", 0.45]} />
                <directionalLight position={[5, 8, 5]} intensity={1.4} />
                <directionalLight position={[-6, 3, -4]} intensity={0.4} />
                <Suspense fallback={null}>
                    {/* Environnement LOCAL (aucun fetch externe → CSP-safe) : révèle les
                        couleurs/reflets des matériaux PBR. */}
                    <Environment resolution={256}>
                        <Lightformer intensity={2.2} position={[0, 4, 5]} scale={[12, 12, 1]} color="#ffffff" />
                        <Lightformer intensity={1.1} position={[-5, 2, -3]} scale={[8, 8, 1]} color="#e6efe9" />
                        <Lightformer intensity={1.3} position={[5, 2, -2]} scale={[8, 8, 1]} color="#fff4d6" />
                        <Lightformer intensity={0.6} position={[0, -3, 2]} scale={[10, 6, 1]} color="#dfe6e2" />
                    </Environment>
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
