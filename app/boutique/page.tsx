'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Search, Tag, Loader2, Sparkles, MoveRight } from 'lucide-react'
import { ProductCard, type Product } from '@/components/boutique/ProductCard'

const categories = ['Tous', 'Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre']

export default function BoutiquePage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeCategory, setActiveCategory] = useState('Tous')
    const containerRef = useRef<HTMLDivElement>(null)

    const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] })
    const yHero = useTransform(scrollYProgress, [0, 1], [0, 300])
    const opacityHero = useTransform(scrollYProgress, [0, 0.5], [1, 0])

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

    const filtered = products.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase())
        const matchCategory = activeCategory === 'Tous' || p.category.toLowerCase() === activeCategory.toLowerCase()
        return matchSearch && matchCategory && p.is_active
    })

    return (
        <main ref={containerRef} className="bg-[#05080a] text-white min-h-screen relative overflow-hidden selection:bg-[#FCD116]/30">
            {/* Global Animated Background Orbs */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <motion.div
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] bg-[#FCD116]/5 rounded-full blur-[150px]"
                />
                <motion.div
                    animate={{ rotate: -360, scale: [1, 1.2, 1] }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[40%] -left-[20%] w-[600px] h-[600px] bg-[#008751]/5 rounded-full blur-[150px]"
                />
            </div>

            {/* HERO BOUTIQUE */}
            <motion.section style={{ y: yHero, opacity: opacityHero }} className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6 z-10 w-full flex flex-col items-center justify-center min-h-[50vh]">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

                <motion.div
                    initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center space-y-8 relative z-10 w-full max-w-4xl mx-auto"
                >
                    <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl shadow-[#FCD116]/5">
                        <Sparkles size={14} className="text-[#FCD116]" />
                        <span className="text-white text-[10px] sm:text-xs font-black tracking-[0.3em] uppercase">E-Commerce Exclusif</span>
                    </div>

                    <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black font-heading tracking-tighter leading-none">
                        Notre{' '}
                        <span className="relative inline-block text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">
                            Boutique
                            <motion.div
                                className="absolute -bottom-4 sm:-bottom-6 left-0 right-0 h-1 sm:h-2 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full"
                                initial={{ scaleX: 0, opacity: 0 }}
                                animate={{ scaleX: 1, opacity: 1 }}
                                transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                            />
                        </span>
                    </h1>

                    <p className="text-gray-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed font-light mt-8">
                        L'héritage, le savoir-faire et l'élégance du Bénin réunis dans une collection soigneusement sélectionnée. Laissez-vous inspirer.
                    </p>
                </motion.div>
            </motion.section>

            {/* STICKY FILTER & SEARCH BAR */}
            <div className="sticky top-[80px] z-50 w-full px-4 sm:px-6 mb-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="container mx-auto max-w-6xl"
                >
                    <div className="bg-[#0f1520]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-3 shadow-2xl shadow-black/50 flex flex-col md:flex-row items-center gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1 w-full group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-500 group-focus-within:text-[#FCD116] transition-colors" />
                            </div>
                            <input
                                type="text"
                                placeholder="Que recherchez-vous aujourd'hui ?"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 hover:bg-white/10 border border-transparent focus:border-[#FCD116]/50 rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none transition-all placeholder:text-gray-600"
                            />
                        </div>

                        {/* Category Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full md:w-auto pb-2 md:pb-0 px-1">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`relative px-5 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 overflow-hidden ${activeCategory === cat
                                            ? 'text-black'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {activeCategory === cat && (
                                        <motion.div
                                            layoutId="activeCategoryBg"
                                            className="absolute inset-0 bg-gradient-to-r from-[#FCD116] to-[#E5BD14] rounded-2xl shadow-lg"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}
                                    <span className="relative z-10">{cat}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* PRODUCT GRID */}
            <section className="py-10 pb-32 relative z-10 min-h-[50vh]">
                <div className="container mx-auto px-6 max-w-7xl">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-40 space-y-8">
                            <div className="relative">
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                    <Loader2 size={64} className="text-[#FCD116]" />
                                </motion.div>
                                <div className="absolute inset-0 blur-2xl bg-[#FCD116]/30 animate-pulse" />
                            </div>
                            <p className="text-gray-400 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] animate-pulse">
                                Préparation de l'expérience...
                            </p>
                        </div>
                    ) : filtered.length > 0 ? (
                        <motion.div
                            layout
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 lg:gap-10"
                        >
                            <AnimatePresence mode="popLayout">
                                {filtered.map((product, i) => (
                                    <ProductCard key={product.id} product={product} index={i} />
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-40 space-y-8"
                        >
                            <div className="relative w-32 h-32 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#FCD116]/5 to-transparent rounded-3xl" />
                                <Tag size={48} className="text-gray-600 drop-shadow-lg" />
                            </div>
                            <div className="text-center max-w-md mx-auto space-y-3">
                                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Rien par ici</h3>
                                <p className="text-sm font-light text-gray-400 leading-relaxed">
                                    {products.length === 0
                                        ? "Notre collection est en cours de préparation. L'attente en vaut la peine."
                                        : "Aucun trésor ne correspond à vos critères actuels. Explorez nos autres catégories."}
                                </p>
                                {products.length > 0 && (
                                    <button
                                        onClick={() => { setSearchTerm(''); setActiveCategory('Tous'); }}
                                        className="mt-6 inline-flex items-center gap-2 text-[#FCD116] text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                                    >
                                        Réinitialiser les filtres <MoveRight size={14} />
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
