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
        // Le modèle est un PBR MÉTALLIQUE (metalness=1 piloté par la texture
        // metallicRoughness) : sa couleur (murs saumon, colonnes orange, comme
        // sur Meshy) vient du reflet de l'ENVIRONNEMENT sur une surface rugueuse,
        // pas de l'albédo (gris). On PRÉSERVE ce workflow et on laisse
        // l'environnement (chaud, plus bas) faire la couleur.
        scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mm of mats) {
                const m = mm as THREE.MeshStandardMaterial;
                if ("metalness" in m) {
                    if (m.map) m.map.colorSpace = "srgb" as THREE.ColorSpace;
                    m.envMapIntensity = 1.0; // reflets d'env. → la couleur du bâtiment
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
                gl={{ antialias: true, alpha: true, toneMappingExposure: 0.9 }}
                style={{ background: "transparent" }}
            >
                {/* Surface métallique : seule l'ENVIRONNEMENT la colore (les lumières
                    directes n'affectent quasi pas un métal). Fill ambiant minimal. */}
                <ambientLight intensity={0.15} />
                <Suspense fallback={null}>
                    {/* Environnement studio CHAUD (local → CSP-safe) : reproduit le
                        rendu Meshy (murs saumon, colonnes orange) via reflet sur métal
                        rugueux. Intensités modérées pour éviter la surexposition. */}
                    <Environment resolution={256}>
                        <Lightformer intensity={1.6} position={[0, 3, 6]} scale={[14, 10, 1]} color="#fff2e0" />
                        <Lightformer intensity={1.0} position={[-6, 1, -2]} scale={[9, 9, 1]} color="#ffe4c4" />
                        <Lightformer intensity={1.2} position={[6, 2, -1]} scale={[9, 9, 1]} color="#ffd9a8" />
                        <Lightformer intensity={0.7} position={[0, 5, -4]} scale={[12, 6, 1]} color="#f5f7ff" />
                        <Lightformer intensity={0.4} position={[0, -4, 3]} scale={[12, 6, 1]} color="#e8ded2" />
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
