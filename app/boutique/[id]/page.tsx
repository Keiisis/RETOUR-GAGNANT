'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeft, Minus, Plus, ShoppingBag,
    ChevronLeft, ChevronRight, Shield, Truck,
    RefreshCcw, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Product, ProductCard } from '@/components/boutique/ProductCard'
import { PaymentModal } from '@/components/boutique/PaymentModal'
import { ProductReviews } from '@/components/boutique/ProductReviews'
import { useCart } from '@/lib/store/cartStore'
import { Price } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'


export default function ProductDetailPage() {
    const params = useParams()
    const productId = params.id as string

    const [product, setProduct] = useState<Product | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentImage, setCurrentImage] = useState(0)
    const [quantity, setQuantitéy] = useState(1)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const { addItem } = useCart()

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
            <main className="bg-[#05080a] text-white min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-[#FCD116]" />
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Chargement...</p>
                </div>
            </main>
        )
    }

    if (!product) {
        return (
            <main className="bg-[#05080a] text-white min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <ShoppingBag size={48} className="text-gray-600 mx-auto" />
                    <h2 className="text-2xl font-black font-heading">Produit introuvable</h2>
                    <Link href="/boutique" className="text-[#FCD116] text-sm font-bold underline">
                        Retour  la boutique
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
        <main className="bg-[#05080a] text-white min-h-screen">
            {/* Back nav */}
            <div className="container mx-auto px-6 pt-28 pb-4">
                <Link href="/boutique" className="inline-flex items-center gap-2 text-gray-400 hover:text-[#FCD116] transition-colors text-sm font-bold">
                    <ArrowLeft size={16} />
                    Retour  la boutique
                </Link>
            </div>

            {/* Product detail */}
            <section className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* LEFT — Images */}
                    <div className="space-y-4">
                        {/* Main image */}
                        <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-[#0a0f18] border border-white/5">
                            {images.length > 0 ? (
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={currentImage}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="relative w-full h-full"
                                    >
                                        <Image
                                            src={images[currentImage]}
                                            alt={product.title}
                                            fill
                                            className="object-cover"
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <ShoppingBag size={64} className="text-white/10" />
                                </div>
                            )}

                            {/* Arrows */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImage(i => (i > 0 ? i - 1 : images.length - 1))}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-all"
                                        title="Image précédente"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImage(i => (i < images.length - 1 ? i + 1 : 0))}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-all"
                                        title="Image suivante"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </>
                            )}

                            {/* Badges */}
                            <div className="absolute top-6 left-6 flex flex-col gap-2">
                                {hasDiscount && (
                                    <span className="px-3 py-1 rounded-full bg-[#E8112D] text-white text-[9px] font-black uppercase tracking-widest">Promo</span>
                                )}
                                {product.is_featured && (
                                    <span className="px-3 py-1 rounded-full bg-[#FCD116] text-[#0f141e] text-[9px] font-black uppercase tracking-widest">Vedette</span>
                                )}
                            </div>
                        </div>

                        {/* Thumbnails */}
                        {images.length > 1 && (
                            <div className="flex gap-3 overflow-x-auto scrollbar-none">
                                {images.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentImage(i)}
                                        className={`relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${currentImage === i ? 'border-[#FCD116] shadow-lg shadow-[#FCD116]/20' : 'border-white/5 opacity-60 hover:opacity-100'
                                            }`}
                                        title={`Afficher image ${i + 1}`}
                                    >
                                        <Image src={img} alt="" fill className="object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT — Info */}
                    <div className="space-y-8">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FCD116]/60 mb-2 block">
                                {product.category}
                            </span>
                            <h1 className="text-3xl md:text-4xl font-black font-heading tracking-tight text-white mb-4">
                                {product.title}
                            </h1>
                            <p className="text-gray-400 text-base leading-relaxed">
                                {product.description}
                            </p>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-4">
                            <span className="text-4xl font-black text-white font-heading tracking-tighter">
                                <Price amount={displayPrice} currency={product.currency as CurrencyCode} showSelector />
                            </span>
                            {hasDiscount && (
                                <span className="text-xl text-gray-600 line-through">
                                    <Price amount={product.price} currency={product.currency as CurrencyCode} />
                                </span>
                            )}
                        </div>

                        {/* Quantitéy + Add to cart */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Quantité</span>
                                <div className="flex items-center gap-0 border border-white/10 rounded-xl overflow-hidden bg-black/50">
                                    <button
                                        onClick={() => setQuantitéy(q => Math.max(1, q - 1))}
                                        className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#FCD116] hover:bg-white/5 transition-colors"
                                        title="Diminuer la quantité"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <span className="w-14 h-12 flex items-center justify-center text-white font-bold border-x border-white/10">
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={() => setQuantitéy(q => Math.min(product.stock, q + 1))}
                                        className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-[#FCD116] hover:bg-white/5 transition-colors"
                                        title="Augmenter la quantité"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <span className="text-xs text-gray-500 font-medium">{product.stock} en stock</span>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-4 relative z-20">
                                <Button
                                    disabled={isOutOfStock}
                                    onClick={handleAddToCart}
                                    className="flex-1 h-14 rounded-2xl text-sm font-black bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ShoppingBag size={18} className="mr-2" />
                                    Ajouter au panier
                                </Button>

                                <Button
                                    disabled={isOutOfStock}
                                    onClick={() => setIsPaymentOpen(true)}
                                    className="flex-1 h-14 rounded-2xl text-sm font-black bg-gradient-to-r from-[#FCD116] to-[#E5BD14] text-[#0f141e] hover:shadow-[0_0_30px_rgba(252,209,22,0.3)] transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed border-none"
                                >
                                    {isOutOfStock ? 'Rupture de stock' : 'Acheter maintenant'}
                                </Button>
                            </div>

                            {/* Total */}
                            {!isOutOfStock && quantity > 1 && (
                                <p className="text-xs text-gray-500 text-center">
                                    Total: <span className="text-white font-bold"><Price amount={displayPrice * quantity} currency={product.currency as CurrencyCode} /></span>
                                </p>
                            )}
                        </div>

                        {/* Trust badges */}
                        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5">
                            {[
                                { icon: Shield, label: 'Paiement Sécurisé' },
                                { icon: Truck, label: 'Livraison Rapide' },
                                { icon: RefreshCcw, label: 'Retour Facile' },
                            ].map(badge => (
                                <div key={badge.label} className="text-center space-y-2">
                                    <badge.icon size={20} className="text-[#008751] mx-auto" />
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{badge.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
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

/* ─── Related Products Section ─────────────────────────────────── */
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

                    // If not enough from same category, fill with other products
                    if (filtered.length < 4) {
                        const others = (data.products as Product[])
                            .filter(p => p.id !== currentProduct.id && p.is_active && !filtered.some(f => f.id === p.id))
                            .slice(0, 4 - filtered.length)
                        filtered.push(...others)
                    }

                    setRelated(filtered)
                }
            })
            .catch(() => { /* ignore */ })
    }, [currentProduct.id, currentProduct.category])

    if (related.length === 0) return null

    return (
        <section className="container mx-auto px-6 pb-20">
            <div className="border-t border-white/5 pt-16">
                <div className="flex items-center gap-3 mb-10">
                    <div className="h-[2px] w-8 bg-[#FCD116]" />
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
                        Vous aimerez aussi
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {related.map((p, i) => (
                        <ProductCard key={p.id} product={p} index={i} />
                    ))}
                </div>
            </div>
        </section>
    )
}
