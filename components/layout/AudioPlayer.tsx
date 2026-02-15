'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AudioPlayer({
    src = '/audio/benin-ambiance.mp3',
}: {
    src?: string;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [hasAutoStarted, setHasAutoStarted] = useState(false);
    const autoTimerRef = useRef<NodeJS.Timeout | null>(null);

    const GENTLE_VOLUME = 0.12;

    // Smooth fade-in from 0 to target volume over ~2 seconds
    const fadeInVolume = useCallback((audio: HTMLAudioElement, target: number) => {
        audio.volume = 0;
        audio.muted = false;
        let current = 0;
        const step = target / 20; // 20 steps
        const interval = setInterval(() => {
            current += step;
            if (current >= target) {
                audio.volume = target;
                clearInterval(interval);
            } else {
                audio.volume = current;
            }
        }, 100); // 20 steps * 100ms = 2 seconds fade
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.volume = 0;
        audio.loop = true;

        // Auto-start after 10 seconds with gentle fade-in
        autoTimerRef.current = setTimeout(() => {
            if (!hasAutoStarted) {
                setHasAutoStarted(true);
                audio.play().then(() => {
                    fadeInVolume(audio, GENTLE_VOLUME);
                    setIsMuted(false);
                }).catch(() => {
                    // Browser blocked autoplay — wait for ANY user interaction to unlock audio context
                    const unlockAudio = () => {
                        audio.play().then(() => {
                            fadeInVolume(audio, GENTLE_VOLUME);
                            setIsMuted(false);
                            // Cleanup listeners once unlocked
                            cleanupListeners();
                        }).catch((e) => console.log("Audio autoplay restricted:", e));
                    };

                    const cleanupListeners = () => {
                        window.removeEventListener('click', unlockAudio);
                        window.removeEventListener('touchstart', unlockAudio);
                        window.removeEventListener('keydown', unlockAudio);
                        window.removeEventListener('scroll', unlockAudio);
                    };

                    window.addEventListener('click', unlockAudio, { once: true });
                    window.addEventListener('touchstart', unlockAudio, { once: true });
                    window.addEventListener('keydown', unlockAudio, { once: true });
                    window.addEventListener('scroll', unlockAudio, { once: true });
                });
            }
        }, 10000);

        return () => {
            if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
        };
    }, [hasAutoStarted, fadeInVolume]);

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;

        // Cancel auto-start timer if user interacts before 10s
        if (autoTimerRef.current) {
            clearTimeout(autoTimerRef.current);
            autoTimerRef.current = null;
        }

        if (isMuted) {
            audio.muted = false;
            audio.volume = GENTLE_VOLUME;
            if (audio.paused) {
                audio.play().catch(() => { });
            }
            setIsMuted(false);
            setHasAutoStarted(true);
        } else {
            audio.muted = true;
            setIsMuted(true);
        }
    };

    return (
        <>
            <audio ref={audioRef} src={src} loop preload="auto" />

            <motion.button
                onClick={toggleMute}
                className="fixed top-24 right-5 z-50 w-11 h-11 rounded-full bg-[#0f141e]/80 backdrop-blur-md text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border border-white/10"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
                aria-label={isMuted ? "Activer le son" : "Couper le son"}
                title={isMuted ? "🔊 Activer l'ambiance sonore" : "🔇 Couper le son"}
            >
                {isMuted ? (
                    <VolumeX size={18} className="text-white/70" />
                ) : (
                    <div className="flex gap-0.5 items-end h-4">
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                className="w-[3px] bg-[#FCD116] rounded-full"
                                animate={{ height: ['20%', '100%', '20%'] }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: i * 0.15,
                                    ease: "easeInOut"
                                }}
                            />
                        ))}
                    </div>
                )}
            </motion.button>
        </>
    );
}
