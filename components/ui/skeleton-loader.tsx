'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    variant?: '3d' | 'card' | 'text' | 'rect';
}

export function SkeletonLoader({ className, variant = 'rect' }: SkeletonProps) {
    if (variant === '3d') {
        return (
            <div className={cn("absolute inset-0 bg-[#05080a] overflow-hidden", className)}>
                {/* Simulated Star Field with Skeletons */}
                <div className="absolute inset-0 opacity-20">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute bg-white rounded-full"
                            style={{
                                width: Math.random() * 3 + 1,
                                height: Math.random() * 3 + 1,
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                            }}
                            animate={{
                                opacity: [0.2, 0.5, 0.2],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                duration: Math.random() * 3 + 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    ))}
                </div>

                {/* Pulsing Gradient Orbs */}
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#FCD116]/5 rounded-full blur-[120px]"
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Bottom Center Skeleton Glow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-t from-[#008751]/10 to-transparent blur-3xl" />

                {/* Loading Text */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-t-2 border-[#FCD116] border-solid rounded-full animate-spin" />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.5em] animate-pulse">
                            Initialisation du Cosmos...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("animate-pulse bg-white/5 rounded-xl", className)}>
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            <style jsx>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
