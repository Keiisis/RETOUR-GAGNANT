'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Minus, Plus, ShoppingBag, CaretLeft as ChevronLeft, CaretRight as ChevronRight, Shield, Truck, ArrowCounterClockwise as RefreshCcw, CircleNotch as Loader2, ShoppingCart } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import { Product, ProductCard } from '@/components/boutique/ProductCard'
import { PaymentModal } from '@/components/boutique/PaymentModal'
import { ProductReviews } from '@/components/boutique/ProductReviews'
import { useCart } from '@/lib/store/cartStore'
import { Price } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'
import { T, useTranslation } from '@/lib/translation'

export default function ProductDetailPage() {
    const params = useParams()
    const productId = params.id as string

    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentImage, setCurrentImage] = useState(0)
    const [quantity, setQuantitéy] = useState(1)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [addedFeedback, setAddedFeedback] = useState(false)
    const { addItem } = useCart()
    const { t } = useTranslation()

    const handleAddToCart = () => {
        if (!product || product.stock <= 0) return
        addItem({
            id: product.id,
            title: product.title,
            price: product.price,
            sale_price: product.sale_price || undefined,
            currency: product.currency,
            image_url: product.images?.[0],
            max_stock: product.stock
        }, quantity)
        setAddedFeedback(true)
        setTimeout(() => setAddedFeedback(false), 1800)
    }

    useEffect(() => {
        if (!productId) return
        fetch(`/api/products/${productId}`)
            .then(res => res.json())
            .then(data => {
                if (data.product) setProduct(data.product)
            })
            .catch(err => console.error('Failed to load product:', err))
            .finally(() => setLoading(false))
    }, [productId])

    if (loading) {
        return (
            <main className="bg-white min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#008751]" />
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest"><T>Chargement...</T></p>
                </div>
            </main>
        )
    }

    if (!product) {
        return (
            <main className="bg-white min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <ShoppingBag size={48} className="text-gray-300 mx-auto" />
                    <h2 className="text-2xl font-black font-display text-gray-900"><T>Produit introuvable</T></h2>
                    <Link href="/boutique" className="text-[#008751] text-sm font-bold underline">
                        <T>Retour à la boutique</T>
                    </Link>
                </div>
            </main>
        )
    }

    const hasDiscount = product.sale_price && product.sale_price < product.price
    const displayPrice = hasDiscount ? product.sale_price! : product.price
    const isOutOfStock = product.stock <= 0
    const images = product.images && product.images.length > 0 ? product.images : []

    return (
        <main className="bg-white text-gray-900 min-h-screen">

            {/* Back nav */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="container mx-auto px-6 pt-28 pb-4"
            >
                <Link href="/boutique" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#008751] transition-colors text-sm font-bold group">
                    <motion.span whileHover={{ x: -3 }} transition={{ type: 'spring', stiffness: 400 }}>
                        <ArrowLeft size={16} />
                    </motion.span>
                    <T>Retour à la boutique</T>
                </Link>
            </motion.div>

            {/* Product detail */}
            <section className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

                    {/* LEFT — Images */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-4"
                    >
                        {/* Main image */}
                        <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-gray-100 border border-gray-100 shadow-sm">
                            {images.length > 0 ? (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentImage}
                                        initial={{ opacity: 0, scale: 1.04 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.97 }}
                                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                        className="relative w-full h-full"
                                    >
                                        <Image
                                            src={images[currentImage]}
                                            alt={product.title}
                                            fill
                                            className="object-cover"
                                            priority
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag size={64} className="text-gray-200" />
                                </div>
                            )}

                            {/* Arrows */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImage(i => (i > 0 ? i - 1 : images.length - 1))}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-white hover:shadow-md transition-all"
                                        title={t("Image précédente")}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImage(i => (i < images.length - 1 ? i + 1 : 0))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-xl border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-white hover:shadow-md transition-all"
                                        title={t("Image suivante")}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </>
                            )}

                            {/* Badges */}
                            <div className="absolute top-6 left-6 flex flex-col gap-2">
                                {hasDiscount && (
                                    <span className="px-3 py-1 rounded-full bg-[#E8112D] text-white text-[9px] font-black uppercase tracking-widest shadow">
                                        <T>Promo</T>
                                    </span>
                                )}
                                {product.is_featured && (
                                    <span className="px-3 py-1 rounded-full bg-[#FCD116] text-gray-900 text-[9px] font-black uppercase tracking-widest shadow">
                                        <T>Vedette</T>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto scrollbar-none">
                                {images.map((img, i) => (
                                    <motion.button
                                        key={i}
                                        onClick={() => setCurrentImage(i)}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.97 }}
                                        className={`relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                                            currentImage === i
                                                ? 'border-[#008751] shadow-lg shadow-[#008751]/15'
                                                : 'border-gray-200 opacity-60 hover:opacity-100'
                                        }`}
                                        title={t(`Afficher image ${i + 1}`)}
                                    >
                                        <Image src={img} alt="" fill className="object-cover" />
                                    </motion.button>
                                ))}
                            </div>
                        )}
                    </motion.div>

                    {/* RIGHT — Info */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className="space-y-8"
                    >
                        {/* Category + Title */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-[2px] w-5 bg-[#008751]" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#008751]">
                                    {product.category}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black font-display tracking-tight text-gray-900 mb-4 leading-tight">
                                {product.title}
                            </h1>
                            <p className="text-gray-500 text-base leading-relaxed">
                                {product.description}
                            </p>
                        </motion.div>

                        {/* Price */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-baseline gap-4"
                        >
                            <span className="text-4xl font-black text-gray-900 font-display tracking-tighter">
                                <Price amount={displayPrice} currency={product.currency as CurrencyCode} showSelector />
                            </span>
                            {hasDiscount && (
                                <span className="text-xl text-gray-400 line-through">
                                    <Price amount={product.price} currency={product.currency as CurrencyCode} />
                                </span>
                            )}
                        </motion.div>

                        {/* Quantity + Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-4 pt-4 border-t border-gray-100"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest"><T>Quantité</T></span>
                                <div className="flex items-center gap-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                    <button
                                        onClick={() => setQuantitéy(q => Math.max(1, q - 1))}
                                        className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-[#008751] hover:bg-gray-100 transition-colors"
                                        title={t("Diminuer la quantité")}
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-14 h-12 flex items-center justify-center text-gray-900 font-bold border-x border-gray-200">
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={() => setQuantitéy(q => Math.min(product.stock, q + 1))}
                                        className="w-12 h-12 flex items-center justify-center text-gray-500 hover:text-[#008751] hover:bg-gray-100 transition-colors"
                                        title="Augmenter la quantité"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <span className="text-xs text-gray-400 font-medium">{product.stock} <T>en stock</T></span>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4 relative z-20">
                                <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
                                    <Button
                                        disabled={isOutOfStock}
                                        onClick={handleAddToCart}
                                        className="w-full h-14 rounded-2xl text-sm font-black border-2 border-gray-200 bg-white text-gray-900 hover:border-[#008751] hover:text-[#008751] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
                                    >
                                        <AnimatePresence mode="wait">
                                            {addedFeedback ? (
                                                <motion.span
                                                    key="added"
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: -20, opacity: 0 }}
                                                    className="flex items-center gap-2 text-[#008751]"
                                                >
                                                     <T>Ajouté !</T>
                                                </motion.span>
                                            ) : (
                                                <motion.span
                                                    key="add"
                                                    initial={{ y: 20, opacity: 0 }}
                                                    animate={{ y: 0, opacity: 1 }}
                                                    exit={{ y: -20, opacity: 0 }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <ShoppingCart size={18} /> <T>Ajouter au panier</T>
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </Button>
                                </motion.div>

                                <motion.div className="flex-1" whileTap={{ scale: 0.98 }}>
                                    <Button
                                        disabled={isOutOfStock}
                                        onClick={() => setIsPaymentOpen(true)}
                                        className="w-full h-14 rounded-2xl text-sm font-black bg-[#008751] text-white hover:bg-[#006a40] hover:shadow-lg hover:shadow-[#008751]/20 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed border-none"
                                    >
                                        {isOutOfStock ? t('Rupture de stock') : t('Acheter maintenant')}
                                    </Button>
                                </motion.div>
                            </div>

                            {/* Total */}
                            <AnimatePresence>
                                {!isOutOfStock && quantity > 1 && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="text-xs text-gray-500 text-center"
                                    >
                                        <T>Total :</T>{' '}
                                        <span className="text-gray-900 font-bold">
                                            <Price amount={displayPrice * quantity} currency={product.currency as CurrencyCode} />
                                        </span>
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </motion.div>

                        {/* Trust badges */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-100"
                        >
                            {[
                                { icon: Shield, label: 'Paiement Sécurisé' },
                                { icon: Truck, label: 'Livraison Rapide' },
                                { icon: RefreshCcw, label: 'Retour Facile' },
                            ].map((badge, i) => (
                                <motion.div
                                    key={badge.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 + i * 0.08 }}
                                    className="text-center space-y-2 p-3 rounded-2xl bg-gray-50 border border-gray-100"
                                >
                                    <badge.icon size={20} className="text-[#008751] mx-auto" />
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{t(badge.label)}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </section>

            {/* Customer Reviews */}
            <ProductReviews productId={productId} />

            {/* Related Products */}
            <RelatedProducts currentProduct={product} />

            {/* Payment Modal */}
            {product && (
                <PaymentModal
                    product={product}
                    quantity={quantity}
                    isOpen={isPaymentOpen}
                    onClose={() => setIsPaymentOpen(false)}
                />
            )}
        </main>
    )
}

/* ─── Related Products ─────────────────────────────────────────── */
function RelatedProducts({ currentProduct }: { currentProduct: Product }) {
    const [related, setRelated] = useState<Product[]>([])

    useEffect(() => {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                if (data.products) {
                    const filtered = (data.products as Product[])
                        .filter(p => p.id !== currentProduct.id && p.is_active)
                        .filter(p => p.category.toLowerCase() === currentProduct.category.toLowerCase())
                        .slice(0, 4)
                    if (filtered.length < 4) {
                        const others = (data.products as Product[])
                            .filter(p => p.id !== currentProduct.id && p.is_active && !filtered.some(f => f.id === p.id))
                            .slice(0, 4 - filtered.length)
                        filtered.push(...others)
                    }
                    setRelated(filtered)
                }
            })
            .catch(() => { })
    }, [currentProduct.id, currentProduct.category])

    if (related.length === 0) return null

    return (
        <section className="container mx-auto px-6 pb-20">
            <div className="border-t border-gray-100 pt-16">
                <div className="flex items-center gap-3 mb-10">
                    <div className="h-[2px] w-8 bg-[#008751]" />
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">
                        <T>Vous aimerez aussi</T>
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {related.map((p) => (
                        <ProductCard key={p.id} product={p} />
                    ))}
                </div>
            </div>
        </section>
    )
}
