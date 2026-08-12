"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { X, CaretLeft, CaretRight, Pause, Play } from "@phosphor-icons/react";
import { useTranslation, T } from "@/lib/translation";

interface GalleryImage {
    id: number;
    src: string;
    filename: string;
}

// Ken Burns directions for cinematic effect
const kenBurnsVariants = [
    "scale-105 translate-x-1 -translate-y-1",
    "scale-110 -translate-x-2 translate-y-1",
    "scale-107 translate-x-2 translate-y-2",
    "scale-108 -translate-x-1 -translate-y-2",
];

export default function ImmersiveGallery() {
    const { t } = useTranslation();
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [heroIndex, setHeroIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    const { scrollYProgress } = useScroll();

    const headerY = useTransform(scrollYProgress, [0, 0.15], [60, 0]);
    const headerOpacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

    useEffect(() => { setIsMounted(true); }, []);

    const fallbackImages: GalleryImage[] = [
        { id: 1, src: "https://images.unsplash.com/photo-1590059110034-436f901c0c29?q=80&w=1200", filename: "benin-culture-1" },
        { id: 2, src: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=1200", filename: "africa-heritage" },
        { id: 3, src: "https://images.unsplash.com/photo-1523805081326-78667e783548?q=80&w=1200", filename: "ouidah-spirit" },
        { id: 4, src: "https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=1200", filename: "cotonou-life" },
    ];

    // Auto-scan gallery folder
    useEffect(() => {
        fetch("/api/gallery")
            .then((r) => r.json())
            .then((data) => {
                if (data.images && data.images.length > 0) {
                    // Filter out any images that might have an empty src to prevent Next.js Image errors
                    const validImages = data.images.filter((img: any) => img.src && img.src.trim() !== "");
                    if (validImages.length > 0) {
                        setImages(validImages);
                    } else {
                        setImages(fallbackImages);
                    }
                } else {
                    setImages(fallbackImages);
                }
            })
            .catch(() => {
                setImages(fallbackImages);
            });
    }, []);

    // Hero slideshow timer : changes main image every 4 seconds
    useEffect(() => {
        if (isPaused || images.length === 0) return;
        intervalRef.current = setInterval(() => {
            setHeroIndex((prev) => (prev + 1) % images.length);
        }, 4000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPaused, images.length]);

    const goTo = useCallback(
        (dir: number) => {
            setHeroIndex((prev) => (prev + dir + images.length) % images.length);
        },
        [images.length]
    );

    // Pick 8 photos for mosaic grid (spread across the collection)
    const mosaicImages =
        images.length >= 8
            ? Array.from({ length: 8 }, (_, i) =>
                images[Math.floor((i * images.length) / 8)]
            )
            : images.slice(0, 8);

    // Pick 20 for the marquee row
    const marqueeImages =
        images.length >= 20
            ? Array.from({ length: 20 }, (_, i) =>
                images[Math.floor((i * images.length) / 20)]
            )
            : images;

    if (images.length === 0) return null;

    return (
        <section
            className="relative bg-[#FBFAF7] overflow-hidden"
        >
            {/* ═══════════════════════════════════════════ */}
            {/* PART 1: Cinematic Hero Slideshow */}
            {/* ═══════════════════════════════════════════ */}
            <div className="relative h-[85vh] overflow-hidden">
                {/* Background image with Ken Burns */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={heroIndex}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 1.2, ease: "easeInOut" }}
                        className="absolute inset-0"
                    >
                        <Image
                            src={images[heroIndex]?.src}
                            alt={`Bénin ${heroIndex + 1}`}
                            fill
                            className={`object-cover transition-transform duration-[8000ms] ease-out ${kenBurnsVariants[heroIndex % kenBurnsVariants.length]
                                }`}
                            priority={heroIndex < 3}
                            sizes="100vw"
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Cinematic overlays */}
                <div className="absolute inset-0 z-[1] pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#FBFAF7] via-transparent to-[#FBFAF7]/40" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(15,20,30,0.6)_100%)]" />
                </div>

                {/* Header text */}
                <motion.div
                    style={{ y: headerY, opacity: headerOpacity }}
                    className="absolute top-16 left-0 right-0 z-10 text-center px-4"
                >
                    <span className="mb-4 inline-block font-geistmono text-[11px] font-medium uppercase tracking-[0.28em] text-[#FCD116]">
                        <T>Immersion visuelle</T>
                    </span>
                    <h2 className="font-fraunces text-5xl font-semibold text-white drop-shadow-2xl md:text-7xl">
                        <T>Vision du</T> <span className="italic text-[#FCD116]"><T>Bénin</T></span>
                    </h2>
                </motion.div>

                {/* Counter & Controls */}
                <div className="absolute bottom-10 left-0 right-0 z-10 flex items-center justify-center gap-6 px-4">
                    <button
                        onClick={() => goTo(-1)}
                        aria-label={t('Image précédente')}
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
                    >
                        <CaretLeft size={22} />
                    </button>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                        <span className="text-white/50 text-sm font-mono">
                            {String(heroIndex + 1).padStart(2, "0")}
                        </span>
                        <div className="w-32 h-[2px] bg-white/20 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-[#FCD116]"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 4, ease: "linear" }}
                                key={heroIndex}
                            />
                        </div>
                        <span className="text-white/30 text-sm font-mono">
                            {String(images.length).padStart(2, "0")}
                        </span>
                    </div>

                    <button
                        onClick={() => setIsPaused((p) => !p)}
                        aria-label={isPaused ? t('Reprendre le diaporama') : t('Mettre en pause le diaporama')}
                        className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
                    >
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    </button>

                    <button
                        onClick={() => goTo(1)}
                        aria-label={t('Image suivante')}
                        className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
                    >
                        <CaretRight size={22} />
                    </button>
                </div>

                {/* Thumbnail preview strip */}
                <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                    {images.slice(0, Math.min(12, images.length)).map((img, i) => (
                        <button
                            key={img.id}
                            onClick={() => setHeroIndex(i)}
                            aria-label={t('Voir image') + ' ' + (i + 1)}
                            aria-current={heroIndex === i ? 'true' : undefined}
                            className={`w-12 h-8 rounded overflow-hidden border-2 transition-all ${heroIndex === i
                                ? "border-[#FCD116] scale-110 shadow-lg"
                                : "border-white/20 opacity-50 hover:opacity-80"
                                }`}
                        >
                            <Image
                                src={img.src}
                                alt=""
                                width={48}
                                height={32}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* PART 2: Infinite Scroll Marquee */}
            {/* ═══════════════════════════════════════════ */}
            <div className="py-12 relative">
                <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#FBFAF7] to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#FBFAF7] to-transparent z-10" />

                <motion.div
                    className="flex gap-4"
                    animate={{ x: [0, -(200 * marqueeImages.length)] }}
                    transition={{
                        x: { repeat: Infinity, repeatType: "loop", duration: 60, ease: "linear" },
                    }}
                >
                    {[...marqueeImages, ...marqueeImages].map((img, i) => (
                        <div
                            key={`marquee-${i}`}
                            className="flex-shrink-0 w-[180px] h-[120px] rounded-lg overflow-hidden cursor-pointer group"
                            onClick={() =>
                                setLightboxIndex(images.findIndex((x) => x.id === img.id))
                            }
                        >
                            <Image
                                src={img.src}
                                alt=""
                                width={180}
                                height={120}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* PART 3: Mosaic Grid */}
            {/* ═══════════════════════════════════════════ */}
            <div className="container mx-auto px-4 pb-24">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[180px] md:auto-rows-[220px]">
                    {mosaicImages.map((img, i) => {
                        // Varied spans for visual rhythm
                        const spans = [
                            "col-span-2 row-span-2",
                            "col-span-1 row-span-1",
                            "col-span-1 row-span-2",
                            "col-span-1 row-span-1",
                            "col-span-2 row-span-1",
                            "col-span-1 row-span-1",
                            "col-span-1 row-span-2",
                            "col-span-1 row-span-1",
                        ];
                        return (
                            <motion.div
                                key={img.id}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.6, delay: i * 0.08 }}
                                className={`${spans[i % 8]} relative overflow-hidden rounded-xl cursor-pointer group`}
                                onClick={() =>
                                    setLightboxIndex(images.findIndex((x) => x.id === img.id))
                                }
                            >
                                <Image
                                    src={img.src}
                                    alt={`Bénin ${img.id}`}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />
                                {/* Hover overlay */}
                                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <span className="font-geist text-sm font-semibold text-white drop-shadow-lg">
                                        <T>Découvrir</T>
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* LIGHTBOX */}
            {/* ═══════════════════════════════════════════ */}
            <AnimatePresence>
                {lightboxIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
                        onClick={() => setLightboxIndex(null)}
                    >
                        {/* Close */}
                        <button
                            onClick={() => setLightboxIndex(null)}
                            aria-label={t('Fermer la galerie')}
                            className="absolute top-6 right-6 z-50 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                            <X size={22} />
                        </button>

                        {/* Prev */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(
                                    (prev) =>
                                        ((prev ?? 0) - 1 + images.length) % images.length
                                );
                            }}
                            aria-label={t('Photo précédente')}
                            className="absolute left-4 md:left-8 z-50 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                            <CaretLeft size={28} />
                        </button>

                        {/* Image */}
                        <motion.div
                            key={lightboxIndex}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className="relative max-w-[90vw] max-h-[85vh] aspect-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={images[lightboxIndex]?.src}
                                alt={`Photo ${lightboxIndex + 1}`}
                                width={1200}
                                height={800}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                                priority
                            />
                        </motion.div>

                        {/* Next */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(
                                    (prev) => ((prev ?? 0) + 1) % images.length
                                );
                            }}
                            aria-label={t('Photo suivante')}
                            className="absolute right-4 md:right-8 z-50 w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                            <CaretRight size={28} />
                        </button>

                        {/* Counter */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono">
                            {(lightboxIndex ?? 0) + 1} / {images.length}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
