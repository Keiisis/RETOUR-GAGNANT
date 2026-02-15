'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function FloatingParticles({ count = 100 }) {
    const points = useRef<THREE.Points>(null!);

    // Generate random particles
    const particlesPosition = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 20;
        const y = (Math.random() - 0.5) * 20;
        const z = (Math.random() - 0.5) * 10;
        particlesPosition.set([x, y, z], i * 3);
    }

    useFrame((state) => {
        if (!points.current) return;
        const time = state.clock.getElapsedTime();
        // Gentle rotation
        points.current.rotation.y = time * 0.05;
        points.current.rotation.x = Math.sin(time * 0.1) * 0.05;
    });

    return (
        <points ref={points}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particlesPosition.length / 3}
                    array={particlesPosition}
                    itemSize={3}
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

function AmbientLight() {
    return (
        <>
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 10, 10]} intensity={0.5} color="#FCD116" />
            <pointLight position={[-10, -5, -10]} intensity={0.5} color="#008751" />
        </>
    )
}

export default function DashboardScene() {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none">
            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 8]} />
                <color attach="background" args={['#05080a']} />
                <fog attach="fog" args={['#05080a', 5, 20]} />

                <AmbientLight />
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                    <FloatingParticles count={150} />
                </Float>
            </Canvas>
        </div>
    );
}
