'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass as Search, Tag, ArrowRight as MoveRight } from '@phosphor-icons/react';
import { ProductCard, type Product } from '@/components/boutique/ProductCard'
import { useTranslation } from '@/lib/translation'
import { useIsMobile } from '@/lib/hooks/useMediaQuery'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ─── Split Text Helper ──────────────────────────────────────────────
function SplitText({ text, charClassName, delay = 0 }: { text: string; charClassName?: string; delay?: number }) {
    return (
        <motion.span
            initial="hidden"
            animate="visible"
            variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04, delayChildren: delay } },
            }}
            aria-label={text}
        >
            {text.split('').map((char, i) => (
                <motion.span
                    key={i}
                    className={`inline-block ${charClassName || ''}`}
                    style={{ willChange: 'transform, opacity' }}
                    variants={{
                        hidden: { opacity: 0, y: 60, rotateX: -80, filter: 'blur(8px)' },
                        visible: {
                            opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)',
                            transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                        },
                    }}
                >
                    {char === ' ' ? '\u00A0' : char}
                </motion.span>
            ))}
        </motion.span>
    )
}

// ─── Floating Particles ─────────────────────────────────────────────
function FloatingParticles({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        left: `${12 + i * 14}%`,
                        top: `${15 + (i * 19) % 65}%`,
                        width: i % 2 === 0 ? 4 : 3,
                        height: i % 2 === 0 ? 4 : 3,
                        background: i % 3 === 0 ? '#008751' : i % 3 === 1 ? '#FCD116' : '#E8112D',
                        opacity: 0.15,
                    }}
                    animate={{
                        y: [0, -25 - i * 5, 0],
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.3, 1],
                    }}
                    transition={{
                        duration: 5 + i * 0.8,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.6,
                    }}
                />
            ))}
        </>
    )
}

// ─── Skeleton Card ──────────────────────────────────────────────────
function SkeletonCard({ index }: { index: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.5 }}
            className="rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm"
        >
            <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer" />
            </div>
            <div className="p-6 space-y-4">
                <div className="h-2.5 w-14 bg-gray-100 rounded-full" />
                <div className="h-5 w-3/4 bg-gray-100 rounded-full" />
                <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-50 rounded-full" />
                    <div className="h-3 w-2/3 bg-gray-50 rounded-full" />
                </div>
                <div className="pt-4 border-t border-gray-50">
                    <div className="h-7 w-28 bg-gray-100 rounded-full" />
                </div>
            </div>
        </motion.div>
    )
}

// ═════════════════════════════════════════════════════════════════════
// PAGE BOUTIQUE — Ultra Immersive
// ═════════════════════════════════════════════════════════════════════

export default function BoutiquePage() {
    const { t } = useTranslation()
    const isMobile = useIsMobile()

    const categories = ['Tous', 'Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre']
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('Tous')
    const [searchFocused, setSearchFocused] = useState(false)
    const [pageReady, setPageReady] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)

    const { scrollY } = useScroll()
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] })
    const yHero = useTransform(scrollYProgress, [0, 1], [0, 300])
    const opacityHero = useTransform(scrollYProgress, [0, 0.5], [1, 0])

    // Parallax layers
    const bgY1 = useTransform(scrollY, [0, 3000], [0, -300])
    const bgY2 = useTransform(scrollY, [0, 3000], [0, -550])

    // Page entrance orchestration
    useEffect(() => {
        const t = setTimeout(() => setPageReady(true), 100)
        return () => clearTimeout(t)
    }, [])

    // Fetch products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch('/api/products')
                const data = await res.json()
                if (data.products) setProducts(data.products)
            } catch (err) {
                console.error('Failed to load products:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [])

    // GSAP ScrollTrigger batch for product grid
    const initScrollTrigger = useCallback(() => {
        // Kill existing triggers
        ScrollTrigger.getAll().forEach(t => t.kill())

        // Wait for DOM to settle
        requestAnimationFrame(() => {
            const cards = gridRef.current?.querySelectorAll('.product-card-item')
            if (!cards || cards.length === 0) return

            // Reset cards to hidden state
            gsap.set(cards, { opacity: 0, y: 50, scale: 0.94, filter: 'blur(5px)' })

            ScrollTrigger.batch(cards, {
                onEnter: (elements) => {
                    gsap.to(elements, {
                        opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
                        duration: 0.85,
                        stagger: 0.07,
                        ease: 'power3.out',
                        overwrite: true,
                    })
                },
                start: 'top 88%',
                once: true,
            })
        })
    }, [])

    useEffect(() => {
        if (!loading && products.length > 0) {
            // Small delay to let filtered grid render
            const t = setTimeout(initScrollTrigger, 150)
            return () => clearTimeout(t)
        }
    }, [loading, activeCategory, searchTerm, initScrollTrigger])

    // Cleanup
    useEffect(() => {
        return () => ScrollTrigger.getAll().forEach(t => t.kill())
    }, [])

    const filtered = products.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchCategory = activeCategory === 'Tous' || p.category.toLowerCase() === activeCategory.toLowerCase()
        return matchSearch && matchCategory && p.is_active
    })

    // Count products per category
    const getCategoryCount = (cat: string) => {
        if (cat === 'Tous') return products.filter(p => p.is_active).length
        return products.filter(p => p.is_active && p.category.toLowerCase() === cat.toLowerCase()).length
    }

    return (
        <main ref={containerRef} className="bg-white text-gray-900 min-h-screen relative overflow-hidden selection:bg-[#008751]/20">

            {/* ══════ PARALLAX BACKGROUND LAYERS ══════ */}

            {/* Layer 1 — Deep gradient orbs */}
            <motion.div style={{ y: bgY1 }} className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.15, 1] }}
                    transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-[#FCD116]/[0.05] rounded-full blur-[180px]"
                />
                <motion.div
                    animate={{ rotate: -360, scale: [1, 1.2, 1] }}
                    transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[50%] -left-[20%] w-[700px] h-[700px] bg-[#008751]/[0.04] rounded-full blur-[180px]"
                />
                <motion.div
                    animate={{ rotate: 180, scale: [1, 1.1, 1] }}
                    transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-[20%] right-[30%] w-[400px] h-[400px] bg-[#E8112D]/[0.02] rounded-full blur-[150px]"
                />
            </motion.div>

            {/* Layer 2 — Decorative lines (desktop only) */}
            {!isMobile && (
                <motion.div style={{ y: bgY2 }} className="fixed inset-0 pointer-events-none z-[1]">
                    <div className="absolute top-[15%] left-[8%] w-px h-48 bg-gradient-to-b from-transparent via-[#008751]/[0.08] to-transparent" />
                    <div className="absolute top-[55%] right-[12%] w-px h-64 bg-gradient-to-b from-transparent via-[#FCD116]/[0.1] to-transparent" />
                    <div className="absolute top-[35%] left-[85%] w-px h-36 bg-gradient-to-b from-transparent via-[#E8112D]/[0.06] to-transparent" />
                    <div className="absolute top-[75%] left-[25%] w-px h-40 bg-gradient-to-b from-transparent via-[#008751]/[0.06] to-transparent" />
                </motion.div>
            )}

            {/* Layer 3 — Floating particles */}
            <div className="fixed inset-0 pointer-events-none z-[2]">
                <FloatingParticles count={isMobile ? 3 : 6} />
            </div>

            {/* ══════ HERO SECTION — Split Text Reveal ══════ */}
            <motion.section
                style={{ y: yHero, opacity: opacityHero }}
                className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6 z-10 w-full flex flex-col items-center justify-center min-h-[50vh]"
            >
                <div className="text-center space-y-8 relative z-10 w-full max-w-4xl mx-auto" style={{ perspective: 1000 }}>
                    {pageReady && (
                        <>
                            <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black font-heading tracking-tighter leading-none text-gray-900">
                                <SplitText text={t("Notre")} delay={0.2} />{' '}
                                <span className="relative inline-block">
                                    <SplitText
                                        text={t("Boutique")}
                                        charClassName="text-[#008751]"
                                        delay={0.5}
                                    />
                                    <motion.div
                                        className="absolute -bottom-4 sm:-bottom-6 left-0 right-0 h-1 sm:h-2 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full origin-left"
                                        initial={{ scaleX: 0, opacity: 0 }}
                                        animate={{ scaleX: 1, opacity: 1 }}
                                        transition={{ delay: 1.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                </span>
                            </h1>

                            <motion.p
                                className="text-gray-500 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed font-light mt-8"
                                initial={{ opacity: 0, y: 25, filter: 'blur(6px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                transition={{ delay: 1.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {t("L'héritage, l'art, le savoir-faire, l'élégance — Bénin est un tableau unique réuni dans une collection soigneusement sélectionnée. Laissez-vous inspirer.")}
                            </motion.p>
                        </>
                    )}
                </div>
            </motion.section>

            {/* ══════ STICKY FILTER & SEARCH BAR ══════ */}
            <motion.div
                className="sticky top-[80px] z-50 w-full px-4 sm:px-6 mb-12"
                initial={{ opacity: 0, y: -30, filter: 'blur(8px)' }}
                animate={pageReady ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
                transition={{ delay: 1.8, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="container mx-auto max-w-6xl">
                    <motion.div
                        animate={{
                            boxShadow: searchFocused
                                ? '0 8px 40px rgba(0, 135, 81, 0.12), 0 0 0 2px rgba(0, 135, 81, 0.15)'
                                : '0 4px 24px rgba(0,0,0,0.06)',
                        }}
                        transition={{ duration: 0.3 }}
                        className="bg-white/85 backdrop-blur-2xl border border-gray-200 rounded-3xl p-3 flex flex-col md:flex-row items-center gap-4"
                    >
                        {/* Search Input */}
                        <div className="relative flex-1 w-full group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <motion.div animate={{ rotate: searchFocused ? 90 : 0 }} transition={{ duration: 0.3 }}>
                                    <Search size={18} className={`transition-colors duration-300 ${searchFocused ? 'text-[#008751]' : 'text-gray-400'}`} />
                                </motion.div>
                            </div>
                            <input
                                type="text"
                                placeholder={t("Que recherchez-vous aujourd'hui ?")}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                                className="w-full bg-gray-50 hover:bg-gray-100/80 border border-transparent focus:border-[#008751]/30 rounded-2xl py-3.5 pl-12 pr-4 text-gray-900 text-sm focus:outline-none transition-all placeholder:text-gray-400"
                            />
                        </div>

                        {/* Category Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full md:w-auto pb-2 md:pb-0 px-1">
                            {categories.map(cat => {
                                const count = getCategoryCount(cat)
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={`relative px-4 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center gap-1.5 ${activeCategory === cat
                                            ? 'text-black'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        {activeCategory === cat && (
                                            <motion.div
                                                layoutId="activeCategoryBg"
                                                className="absolute inset-0 bg-gradient-to-r from-[#FCD116] to-[#E5BD14] rounded-2xl shadow-lg"
                                                transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }}
                                            />
                                        )}
                                        <span className="relative z-10">{t(cat)}</span>
                                        <AnimatePresence mode="wait">
                                            <motion.span
                                                key={count}
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 0.6, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                className={`relative z-10 text-[8px] font-bold ${activeCategory === cat ? 'opacity-60' : ''}`}
                                            >
                                                {count}
                                            </motion.span>
                                        </AnimatePresence>
                                    </button>
                                )
                            })}
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* ══════ PRODUCT GRID ══════ */}
            <section className="py-10 pb-32 relative z-10 min-h-[50vh]">
                <div className="container mx-auto px-6 max-w-7xl">
                    {loading ? (
                        /* Skeleton Loading */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonCard key={i} index={i} />
                            ))}
                        </div>
                    ) : filtered.length > 0 ? (
                        <div
                            ref={gridRef}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-10"
                        >
                            {filtered.map((product, i) => (
                                <div key={product.id} className="product-card-item" style={{ opacity: 0 }}>
                                    <ProductCard product={product} index={i} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-40 space-y-8"
                        >
                            <div className="relative w-32 h-32 rounded-3xl bg-gray-50 border border-gray-200 flex items-center justify-center shadow-lg">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#FCD116]/10 to-transparent rounded-3xl" />
                                <Tag size={48} className="text-gray-300 drop-shadow-lg" />
                            </div>
                            <div className="text-center max-w-md mx-auto space-y-3">
                                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{t("Rien par ici")}</h3>
                                <p className="text-sm font-light text-gray-500 leading-relaxed">
                                    {products.length === 0
                                        ? t("Notre collection est en cours de préparation. L'attente en vaut la peine.")
                                        : t("Aucun trésor ne correspond à vos critères actuels. Explorez nos autres catégories.")}
                                </p>
                                {products.length > 0 && (
                                    <button
                                        onClick={() => { setSearchTerm(''); setActiveCategory('Tous'); }}
                                        className="mt-6 inline-flex items-center gap-2 text-[#008751] text-xs font-bold uppercase tracking-widest hover:text-gray-900 transition-colors"
                                    >
                                        {t("Réinitialiser les filtres")} <MoveRight size={14} />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>
            </section>
        </main>
    )
}
