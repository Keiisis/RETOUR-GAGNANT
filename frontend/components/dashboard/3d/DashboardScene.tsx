'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

function FloatingParticles({ count = 100 }) {
    const points = useRef<THREE.Points>(null!);
    const [particlesPosition] = useState(() => {
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 20;
            const y = (Math.random() - 0.5) * 20;
            const z = (Math.random() - 0.5) * 10;
            positions.set([x, y, z], i * 3);
        }
        return positions;
    });

    useFrame((state) => {
        if (!points.current) return;
        const time = state.clock.getElapsedTime();
        points.current.rotation.y = time * 0.05;
        points.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[particlesPosition, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.05}
                color="#FCD116"
                transparent
                opacity={0.6}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function Lights() {
    return (
        <group>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={0.8} color="#FCD116" />
            <pointLight position={[-10, -5, -10]} intensity={0.5} color="#008751" />
            <spotLight position={[0, 10, 0]} intensity={0.5} penumbra={1} castShadow />
        </group>
    )
}

function SceneContent() {
    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 8]} />
            <color attach="background" args={['#05080a']} />
            <fog attach="fog" args={['#05080a', 5, 20]} />

            <Lights />
            <Stars
                radius={100}
                depth={50}
                count={3000} // Reduced for performance on slow connections/devices
                factor={4}
                saturation={0}
                fade
                speed={1}
            />

            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <FloatingParticles count={120} />
            </Float>
        </>
    );
}

export default function DashboardScene() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <Canvas
                shadows
                dpr={[1, 2]} // Performance optimization: cap pixel ratio
                gl={{
                    antialias: true,
                    powerPreference: "high-performance",
                    alpha: false
                }}
            >
                <Suspense fallback={null}>
                    <SceneContent />
                </Suspense>
            </Canvas>
        </div>
    );
}
