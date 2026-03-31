'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence, useMotionValue } from 'framer-motion';
import Image from 'next/image';
import { useTranslation, T } from '@/lib/translation';
import { Maximize2, X, ChevronLeft, ChevronRight, Sparkles, Map, Eye, EyeOff, LayoutPanelTop } from 'lucide-react';

interface GalleryImage {
    id: string | number;
    src: string;
    filename: string;
}

/**
 * INTERNAL COMPONENT to prevent Hydration Error with useScroll(ref)
 */
function ScrolledDiaporama({ images, containerRef }: { images: GalleryImage[], containerRef: React.RefObject<HTMLDivElement | null> }) {
    const { t } = useTranslation();
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [museumMode, setMuseumMode] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Mouse tracking for the "Gravity Tilt" effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        mouseX.set((clientX / innerWidth) - 0.5);
        mouseY.set((clientY / innerHeight) - 0.5);
    };

    // Audio Ambiance Logic
    useEffect(() => {
        if (!audioRef.current) return;

        if (museumMode) {
            audioRef.current.volume = 0;
            audioRef.current.play().catch(e => console.log("Audio play blocked:", e));
            // Fade in
            let vol = 0;
            const fadeIn = setInterval(() => {
                vol = Math.min(vol + 0.05, 0.4);
                if (audioRef.current) audioRef.current.volume = vol;
                if (vol >= 0.4) clearInterval(fadeIn);
            }, 100);
        } else {
            // Fade out
            let vol = 0.4;
            const fadeOut = setInterval(() => {
                vol = Math.max(vol - 0.05, 0);
                if (audioRef.current) audioRef.current.volume = vol;
                if (vol <= 0) {
                    audioRef.current?.pause();
                    clearInterval(fadeOut);
                }
            }, 100);
        }
    }, [museumMode]);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const springConfig = { stiffness: 45, damping: 20, restDelta: 0.001 };
    const smoothProgress = useSpring(scrollYProgress, springConfig);

    // Dynamic Museum Mode Auto-Scroll (Simulated by transform offset)
    const [autoTime, setAutoTime] = useState(0);
    useEffect(() => {
        if (!museumMode) return;
        const interval = setInterval(() => {
            setAutoTime(prev => prev + 0.0005);
        }, 16);
        return () => clearInterval(interval);
    }, [museumMode]);

    // Combine manual scroll and museum auto-flow
    const flowBase = useTransform(smoothProgress, [0, 1], [0, 1]);

    const x1 = useTransform(flowBase, (v) => `${(v + autoTime) * -40}%`);
    const x2 = useTransform(flowBase, (v) => `${((v + autoTime) * 40) - 40}%`);
    const yFloating = useTransform(smoothProgress, [0, 1], [0, -180]);
    const wallRotateZ = useTransform(smoothProgress, [0, 1], [4, -4]);

    const rowConfigs = useMemo(() => {
        const total = images.length;
        const q = Math.ceil(total / 4);
        return [
            { items: images.slice(0, q), x: x1 },
            { items: images.slice(q, q * 2), x: x2 },
            { items: images.slice(q * 2, q * 3), x: x1 },
            { items: images.slice(q * 3, total), x: x2 },
        ];
    }, [images, x1, x2]);

    return (
        <div onMouseMove={handleMouseMove} className={`relative w-full transition-all duration-1000 ${museumMode ? 'z-[500]' : ''}`}>
            {/* Hidden Audio for Museum Mode */}
            <audio ref={audioRef} src="/audio/benin-ambiance.mp3" loop preload="none" />

            {/* Museum Mode Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMuseumMode(!museumMode)}
                aria-label={museumMode ? t('Quitter le Mode Musée') : t('Activer le Mode Musée')}
                className="fixed bottom-10 right-10 z-[600] p-5 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 text-white shadow-2xl overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#008751] via-[#FCD116] to-[#E8112D] opacity-0 group-hover:opacity-20 transition-opacity" />
                {museumMode ? <EyeOff size={24} className="text-[#FCD116]" /> : <Eye size={24} />}
                <span className="absolute right-full mr-4 whitespace-nowrap bg-black/80 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {museumMode ? t('Quitter le Mode Musée') : t('Activer le Mode Musée')}
                </span>
            </motion.button>

            {/* Cinematic Background Atmosphere */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,135,81,0.1)_0%,transparent_70%)]" />
                <motion.div
                    style={{
                        x: useTransform(mouseX, [-0.5, 0.5], [150, -150]),
                        y: useTransform(mouseY, [-0.5, 0.5], [150, -150])
                    }}
                    className="absolute top-1/3 left-1/3 w-[1200px] h-[1200px] bg-[#FCD116]/5 rounded-full blur-[250px] pointer-events-none"
                />
            </div>

            {/* Floating Title & Narrative (Fades in museum mode) */}
            <AnimatePresence>
                {!museumMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="container mx-auto px-6 mb-32 relative z-20"
                    >
                        <div className="max-w-6xl">
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ duration: 1 }}
                                className="flex items-center gap-8 mb-12"
                            >
                                <LayoutPanelTop className="text-[#FCD116]" size={18} />
                                <span className="text-[#FCD116] font-black tracking-[1.2em] uppercase text-[12px] opacity-80"><T>Collection Impériale</T></span>
                            </motion.div>

                            <h2 className="text-4xl sm:text-6xl md:text-8xl lg:text-[12rem] font-bold font-heading text-white leading-[0.8] mb-8 sm:mb-12 tracking-tighter">
                                L&apos;ÂME <br />
                                <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] filter drop-shadow-[0_20px_60px_rgba(252,209,22,0.5)]">
                                    ÉTERNELLE
                                </span>
                            </h2>

                            <div className="flex flex-col md:flex-row gap-20 items-start md:items-center">
                                <motion.button
                                    whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(0, 135, 81, 0.4)" }}
                                    onClick={() => setMuseumMode(true)}
                                    className="px-6 py-4 sm:px-10 sm:py-5 md:px-14 md:py-7 bg-white text-black rounded-full text-sm font-black tracking-[0.3em] flex items-center gap-5 group transition-all"
                                >
                                    <Sparkles className="group-hover:rotate-180 transition-transform duration-1000" size={20} />
                                    IMMERSION TOTALE
                                </motion.button>
                                <p className="text-white/30 text-2xl font-extralight leading-relaxed max-w-xl border-l-[3px] border-[#E8112D] pl-12 font-serif italic">
                                    {t('Une traversée onirique à travers {{count}} fragments de notre patrie. Laissez-vous porter par le flux du temps.', { count: images.length || 238 })}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* THE "DREAM RIVER" PHOTO WALL */}
            <motion.div
                style={{
                    rotateX: useTransform(mouseY, [-0.5, 0.5], [12, -12]),
                    rotateY: useTransform(mouseX, [-0.5, 0.5], [-12, 12]),
                    rotateZ: wallRotateZ,
                    scale: museumMode ? 1.15 : 1
                }}
                className="relative z-10 flex flex-col gap-8 sm:gap-16 md:gap-32 perspective-[3000px] transition-transform duration-1000"
            >
                {rowConfigs.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex overflow-visible whitespace-nowrap">
                        <motion.div
                            style={{ x: row.x, y: yFloating }}
                            className="flex gap-6 sm:gap-12 md:gap-24 px-6 sm:px-12"
                        >
                            {row.items.map((img, i) => (
                                <DreamCard
                                    key={`${rowIndex}-${img.id}-${i}`}
                                    img={img}
                                    museumMode={museumMode}
                                    onClick={() => setLightboxIndex(images.findIndex(x => x.id === img.id))}
                                />
                            ))}
                        </motion.div>
                    </div>
                ))}
            </motion.div>

            {/* Museum Mode Vignette Overlay */}
            <motion.div
                animate={{ opacity: museumMode ? 1 : 0 }}
                className="fixed inset-0 pointer-events-none z-[550] bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.9)_100%)]"
            />

            {/* LIGHTBOX */}
            <AnimatePresence>
                {lightboxIndex !== null && (
                    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setLightboxIndex(null)}
                            className="absolute inset-0 bg-black/98 backdrop-blur-[100px]"
                        />

                        <div className="relative w-full h-full flex flex-col items-center justify-center p-4 md:p-12 z-10">
                            <motion.div
                                key={lightboxIndex}
                                initial={{ opacity: 0, scale: 0.7, rotateX: 20 }}
                                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                                exit={{ opacity: 0, scale: 1.3, rotateX: -20 }}
                                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                className="relative w-full h-full rounded-[4rem] overflow-hidden shadow-[0_0_150px_rgba(252,209,22,0.2)]"
                            >
                                <Image
                                    src={images[lightboxIndex].src}
                                    alt={images[lightboxIndex].filename}
                                    fill
                                    className="object-contain"
                                    priority
                                />
                            </motion.div>

                            {/* UI Controls */}
                            <button
                                onClick={() => setLightboxIndex(null)}
                                aria-label={t('Fermer la galerie')}
                                className="absolute top-12 right-12 text-white/20 hover:text-white bg-white/5 p-6 rounded-full transition-all"
                            >
                                <X size={28} />
                            </button>

                            <div className="absolute bottom-20 flex items-center gap-16 bg-white/5 backdrop-blur-3xl px-12 py-8 rounded-full border border-white/10">
                                <button aria-label={t('Photo précédente')} onClick={() => setLightboxIndex(prev => (prev! - 1 + images.length) % images.length)} className="text-white/30 hover:text-[#FCD116] transition-all"><ChevronLeft size={50} /></button>
                                <div className="text-center min-w-[200px]">
                                    <p className="text-[#FCD116] font-black tracking-[0.5em] text-[12px] mb-2 uppercase"><T>Relique du Bénin</T></p>
                                    <h3 className="text-white font-heading font-black text-3xl tracking-tighter uppercase">{images[lightboxIndex].filename.split('.')[0].slice(-8)}</h3>
                                </div>
                                <button aria-label={t('Photo suivante')} onClick={() => setLightboxIndex(next => (next! + 1) % images.length)} className="text-white/30 hover:text-[#008751] transition-all"><ChevronRight size={50} /></button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function DreamCard({ img, museumMode, onClick }: { img: GalleryImage, museumMode: boolean, onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <motion.div
            whileHover={{ scale: 1.2, zIndex: 100, rotate: -3 }}
            onClick={onClick}
            className={`
                relative rounded-[5rem] overflow-hidden cursor-none group/dream transition-all duration-1000
                ${museumMode ? 'w-[260px] h-[415px] sm:w-[500px] sm:h-[800px] md:w-[800px] md:h-[1100px] grayscale-0' : 'w-[240px] h-[360px] sm:w-[400px] sm:h-[600px] md:w-[700px] md:h-[950px] shadow-[0_80px_150px_rgba(0,0,0,1)]'}
            `}
        >
            <div className="relative w-full h-full">
                <Image
                    src={img.src}
                    alt={img.filename}
                    fill
                    className="object-cover transition-transform duration-[4000ms] group-hover/dream:scale-[1.7]"
                    sizes="1000px"
                />
                <div className={`absolute inset-0 bg-gradient-to-t from-[#05080a] via-transparent to-white/5 transition-opacity duration-1000 ${museumMode ? 'opacity-30' : 'opacity-80 group-hover/dream:opacity-20'}`} />

                <div className="absolute inset-x-16 bottom-20 flex justify-between items-end opacity-0 group-hover/dream:opacity-100 translate-y-16 group-hover/dream:translate-y-0 transition-all duration-1000">
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <Map className="text-[#FCD116]" size={24} />
                            <span className="text-white font-black text-[14px] tracking-[0.6em]"><T>PATRIMOINE ROYAL</T></span>
                        </div>
                        <h4 className="text-white font-heading font-black text-6xl tracking-tighter"><T>BÉNIN REVEAL</T></h4>
                    </div>
                    <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center text-black shadow-inner">
                        <Maximize2 size={36} />
                    </div>
                </div>

                {/* Light Leak Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover/dream:opacity-40 bg-[radial-gradient(circle_at_50%_0%,rgba(252,209,22,0.2),transparent_70%)] transition-opacity" />
            </div>
        </motion.div>
    );
}

export default function PhotoDiaporama() {
    const { t } = useTranslation();

    const [images, setImages] = useState<GalleryImage[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsMounted(true);
        fetch("/api/gallery")
            .then(res => res.json())
            .then(data => {
                if (data.images && data.images.length > 0) {
                    setImages([...data.images].sort(() => Math.random() - 0.5));
                }
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <section
            ref={containerRef}
            className="relative bg-[#05080a] min-h-screen overflow-hidden"
        >
            {isMounted && images.length > 0 ? (
                <ScrolledDiaporama images={images} containerRef={containerRef} />
            ) : (
                <div className="flex items-center justify-center h-screen bg-[#05080a]">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-24 h-24 border-t-2 border-[#FCD116] border-solid rounded-full animate-spin" />
                        <span className="text-[10px] text-white/20 uppercase tracking-[1em] font-black"><T>Initialisation du Rêve...</T></span>
                    </div>
                </div>
            )}
        </section>
    );
}
