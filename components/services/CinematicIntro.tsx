"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Plane, Compass, MapPin } from "lucide-react";

// --- SVG PATHS (High Fidelity) ---

// Act 1: The Organic Roots (Growing Upwards)
// Main taproot and branching side roots
const ROOT_MAIN = "M50,150 Q50,100 50,50";
const ROOT_LEFT_1 = "M50,120 Q20,130 10,100";
const ROOT_RIGHT_1 = "M50,110 Q80,120 90,90";
const ROOT_LEFT_2 = "M50,80 Q30,70 20,40";
const ROOT_RIGHT_2 = "M50,60 Q70,50 80,20";

// Act 2: The Horizon/Journey
// A sine-wave like path traversing a globe curvature
const JOURNEY_PATH = "M-10,50 C20,80 50,20 80,50 S140,20 170,50 S230,20 260,50";

// Act 4: The Door of No Return (Ouidah)
// Main Arch structure
const ARCH_OUTER = "M10,140 L10,40 Q10,0 75,0 Q140,0 140,40 L140,140";
const ARCH_INNER = "M30,140 L30,50 Q30,20 75,20 Q120,20 120,50 L120,140";
// The frieze/top decorations (abstracted)
const FRIEZE_1 = "M10,40 H140";
const FRIEZE_2 = "M15,30 H135";

// --- AUDIO CONFIG ---
// Using a placeholder; in a real app, this should be a local file or reliable CDN
// We'll try to use a dramatic free sound if available, otherwise silence/placeholder.
const AUDIO_SRC = "/assets/audio/cinematic_return.mp3";

export default function CinematicIntro({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [canSkip, setCanSkip] = useState(false);

    useEffect(() => {
        // Try to play audio on mount (might be blocked by browser without interaction)
        if (audioRef.current) {
            audioRef.current.volume = 0.6;
            audioRef.current.play().catch(e => console.log("Audio autoplay blocked:", e));
        }

        const sequence = [
            { time: 500, step: 1 },   // ACT 1: ROOTS (0-5s)
            { time: 5500, step: 2 },  // ACT 2: EXPANSION (5-10s)
            { time: 10500, step: 3 }, // ACT 3: COMPASS (10-15s)
            { time: 15500, step: 4 }, // ACT 4: THE DOOR (15-23s)
            { time: 23000, step: 5 }, // FINALE & EXIT
        ];

        const timeouts = sequence.map(({ time, step }) =>
            setTimeout(() => setStep(step), time)
        );

        // Allow skip after 3s
        setTimeout(() => setCanSkip(true), 3000);

        const exitTimeout = setTimeout(onComplete, 24000);

        return () => {
            timeouts.forEach(clearTimeout);
            clearTimeout(exitTimeout);
        };
    }, [onComplete]);

    // Fade out audio on exit
    useEffect(() => {
        if (step === 5 && audioRef.current) {
            const fadeVideo = setInterval(() => {
                if (audioRef.current && audioRef.current.volume > 0.05) {
                    audioRef.current.volume -= 0.05;
                } else {
                    clearInterval(fadeVideo);
                }
            }, 100);
            return () => clearInterval(fadeVideo);
        }
    }, [step]);

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden font-sans"
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
            >
                <audio ref={audioRef} src={AUDIO_SRC} preload="auto" />

                {/* SKIP BUTTON */}
                <AnimatePresence>
                    {canSkip && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onComplete}
                            className="absolute top-8 right-8 z-[60] text-white/20 hover:text-white/80 text-[10px] tracking-[0.2em] uppercase transition-colors"
                        >
                            Passer l'introduction
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* ATMOSPHERE BACKGROUND */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black" />
                    {/* Subtle Dust/Stars */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                </div>

                {/* MAIN STAGE */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">

                        {/* --- ACT 1: LES RACINES (0s - 5.5s) --- */}
                        {step === 1 && (
                            <motion.div
                                key="act1"
                                exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                                transition={{ duration: 1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="relative w-64 h-64 mb-8">
                                    <svg viewBox="0 0 100 150" className="w-full h-full overflow-visible">
                                        <motion.path d={ROOT_MAIN} fill="none" stroke="#8B4513" strokeWidth="3" strokeLinecap="round"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3, ease: "easeInOut" }} />
                                        <motion.path d={ROOT_LEFT_1} fill="none" stroke="#A0522D" strokeWidth="2" strokeLinecap="round"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1, duration: 2 }} />
                                        <motion.path d={ROOT_RIGHT_1} fill="none" stroke="#CD853F" strokeWidth="2" strokeLinecap="round"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.2, duration: 2 }} />
                                        <motion.path d={ROOT_LEFT_2} fill="none" stroke="#DEB887" strokeWidth="1" strokeLinecap="round"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2, duration: 1.5 }} />
                                        <motion.path d={ROOT_RIGHT_2} fill="none" stroke="#DEB887" strokeWidth="1" strokeLinecap="round"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2.2, duration: 1.5 }} />
                                    </svg>
                                    {/* Pulse at the base */}
                                    <motion.div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-32 h-1 bg-[#008751] blur-2xl"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 0.6, 0] }}
                                        transition={{ duration: 4, repeat: Infinity }}
                                    />
                                </div>
                                <motion.div className="text-center space-y-4">
                                    <motion.h2
                                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }}
                                        className="text-3xl md:text-4xl font-heading font-light text-[#008751] tracking-wide"
                                    >
                                        L'Histoire commence par une racine.
                                    </motion.h2>
                                    <motion.p
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.5 }}
                                        className="text-white/60 text-sm uppercase tracking-[0.4em]"
                                    >
                                        Votre ancrage.
                                    </motion.p>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* --- ACT 2: L'EXPANSION (5.5s - 10.5s) --- */}
                        {step === 2 && (
                            <motion.div
                                key="act2"
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 1 }}
                                className="w-full max-w-4xl px-4"
                            >
                                <div className="relative w-full h-40 flex items-center justify-center">
                                    {/* The Horizon Line */}
                                    <svg viewBox="0 0 250 100" className="w-full h-full stroke-white/20 fill-none stroke-[1] overflow-visible">
                                        <motion.path
                                            d={JOURNEY_PATH}
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 4, ease: "linear" }}
                                        />
                                    </svg>

                                    {/* Moving Plane/Success Icon */}
                                    <motion.div
                                        className="absolute top-0 left-0"
                                        animate={{ offsetDistance: "100%" }}
                                        style={{ offsetPath: `path('${JOURNEY_PATH}')`, offsetRotate: "auto" }}
                                        transition={{ duration: 4, ease: "linear" }}
                                    >
                                        <Plane className="text-[#FCD116] drop-shadow-[0_0_10px_#FCD116]" size={24} />
                                    </motion.div>

                                    {/* Success Markers calling out */}
                                    {[0.3, 0.6, 0.9].map((pos, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute w-2 h-2 bg-white rounded-full"
                                            style={{ left: `${pos * 90}%`, top: '50%' }} // Approx positioning
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: [0, 1.5, 1], opacity: 1 }}
                                            transition={{ delay: 1 + i, duration: 0.5 }}
                                        />
                                    ))}
                                </div>

                                <div className="text-center mt-10">
                                    <motion.h2
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                                        className="text-3xl md:text-5xl font-heading text-white font-bold"
                                    >
                                        Vous avez conquis le monde.
                                    </motion.h2>
                                    <motion.p
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
                                        className="text-[#FCD116] text-xl mt-4 italic font-light"
                                    >
                                        "Mais le succès a un goût d'inachevé..."
                                    </motion.p>
                                </div>
                            </motion.div>
                        )}

                        {/* --- ACT 3: L'APPEL (10.5s - 15.5s) --- */}
                        {step === 3 && (
                            <motion.div
                                key="act3"
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="relative mb-12">
                                    <motion.div
                                        animate={{ rotate: [0, 10, -10, 5, -5, 0] }} // Compass seeking
                                        transition={{ duration: 4, ease: "easeInOut" }}
                                        className="relative z-10"
                                    >
                                        <Compass size={120} strokeWidth={1} className="text-white/80" />
                                    </motion.div>
                                    {/* Pulse Ring */}
                                    <motion.div
                                        className="absolute inset-0 rounded-full border border-[#E8112D]/50"
                                        animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                    <motion.div
                                        className="absolute inset-0 rounded-full bg-[#E8112D]/10 blur-xl"
                                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                </div>

                                <motion.h2
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 1 }}
                                    className="text-4xl md:text-6xl font-heading text-[#E8112D] font-bold tracking-tight"
                                >
                                    Le sang appelle le sang.
                                </motion.h2>
                                <motion.p
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: "100%", opacity: 1 }}
                                    transition={{ delay: 1.5, duration: 1 }}
                                    className="max-w-md h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent mt-8"
                                />
                            </motion.div>
                        )}

                        {/* --- ACT 4: LA PORTE & LE RETOUR (15.5s - 23s) --- */}
                        {step === 4 && (
                            <motion.div
                                key="act4"
                                className="flex flex-col items-center justify-center w-full h-full pb-10"
                            >
                                {/* THE DOOR DRAWING */}
                                <div className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px]">
                                    <svg viewBox="0 0 150 160" className="w-full h-full overflow-visible">
                                        <defs>
                                            <linearGradient id="doorGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#008751" />
                                                <stop offset="50%" stopColor="#FCD116" />
                                                <stop offset="100%" stopColor="#E8112D" />
                                            </linearGradient>
                                            <filter id="glow">
                                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur" />
                                                    <feMergeNode in="SourceGraphic" />
                                                </feMerge>
                                            </filter>
                                        </defs>

                                        {/* Animation: Drawing the Arch */}
                                        <motion.path d={ARCH_OUTER} fill="none" stroke="url(#doorGradient)" strokeWidth="4"
                                            filter="url(#glow)"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 3, ease: "easeInOut" }} />

                                        <motion.path d={ARCH_INNER} fill="none" stroke="url(#doorGradient)" strokeWidth="2"
                                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1, duration: 2 }} />

                                        {/* Friezes */}
                                        <motion.path d={FRIEZE_1} stroke="white" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2.5 }} />
                                        <motion.path d={FRIEZE_2} stroke="white" strokeWidth="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2.8 }} />

                                        {/* The Divine Light */}
                                        <motion.path
                                            d="M30,140 L30,50 Q30,20 75,20 Q120,20 120,50 L120,140 Z"
                                            fill="url(#doorGradient)"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: [0, 0.15, 0.1] }}
                                            transition={{ delay: 3.5, duration: 2, ease: "easeInOut" }}
                                        />
                                    </svg>
                                </div>

                                {/* FINAL REVEAL TEXT */}
                                <div className="absolute bottom-10 md:bottom-20 z-20 text-center">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 4, duration: 0.8, type: "spring" }}
                                    >
                                        <h1 className="text-5xl md:text-8xl lg:text-9xl font-bold font-heading text-white tracking-tighter drop-shadow-2xl">
                                            RETOUR <span className="text-[#FCD116]">GAGNANT</span>
                                        </h1>
                                    </motion.div>

                                    <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 5, duration: 1 }}
                                        className="text-white/80 text-xl md:text-3xl mt-6 font-light tracking-[0.2em] uppercase"
                                    >
                                        Votre place est ici.
                                    </motion.p>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

                {/* CINEMATIC BARS PROGRESSION */}
                <motion.div
                    className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] z-50"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 23, ease: "linear" }}
                />

                {/* Letterbox Effect (Always On until exit) */}
                <div className="absolute top-0 w-full h-[10vh] bg-black z-40 transition-transform duration-[2000ms]"
                    style={{ transform: step === 5 ? 'translateY(-100%)' : 'none' }} />
                <div className="absolute bottom-0 w-full h-[10vh] bg-black z-40 transition-transform duration-[2000ms]"
                    style={{ transform: step === 5 ? 'translateY(100%)' : 'none' }} />

            </motion.div>
        </AnimatePresence>
    );
}
