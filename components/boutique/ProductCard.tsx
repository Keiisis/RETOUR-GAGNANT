'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingBag, ArrowUpRight, ShoppingCart, Heart } from 'lucide-react'
import { useCart } from '@/lib/store/cartStore'
import { useWishlist } from '@/lib/store/wishlistStore'
import { Price } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'

export interface Product {
    id: string
    title: string
    description: string
    price: number
    sale_price?: number | null
    currency: string
    images: string[]
    category: string
    stock: number
    is_active: boolean
    is_featured: boolean
}

export function ProductCard({ product, index }: { product: Product, index: number }) {
    const { addItem } = useCart()
    const { toggleItem, isInWishlist } = useWishlist()
    const [heartBounce, setHeartBounce] = useState(false)
    const isFav = isInWishlist(product.id)

    const hasDiscount = product.sale_price && product.sale_price < product.price
    const displayPrice = hasDiscount ? product.sale_price : product.price
    const isOutOfStock = product.stock <= 0

    const handleToggleWishlist = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setHeartBounce(true)
        setTimeout(() => setHeartBounce(false), 400)
        toggleItem({
            id: product.id,
            title: product.title,
            price: product.price,
            sale_price: product.sale_price ?? undefined,
            currency: product.currency,
            image_url: product.images?.[0],
            category: product.category,
        })
    }

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('fr-FR').format(price)
    }

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault() // Protect from navigating to product detail
        if (isOutOfStock) return

        addItem({
            id: product.id,
            title: product.title,
            price: product.price,
            sale_price: product.sale_price || undefined,
            currency: product.currency,
            image_url: product.images?.[0],
            max_stock: product.stock
        })
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 30, filter: "blur(5px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, delay: (index % 12) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="group h-full"
        >
            <Link href={`/boutique/${product.id}`} className="block h-full relative outline-none focus-visible:ring-2 focus-visible:ring-[#FCD116] rounded-3xl">
                {/* Glow behind the card on hover */}
                <div className="absolute -inset-[2px] rounded-[2rem] bg-gradient-to-br from-[#FCD116]/0 via-[#FCD116]/0 to-[#FCD116]/0 group-hover:from-[#FCD116]/50 group-hover:via-[#E8112D]/30 group-hover:to-[#008751]/50 blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none" />

                <div className="relative h-full flex flex-col bg-[#080c13] border border-white/5 group-hover:border-white/20 rounded-3xl overflow-hidden transition-all duration-500 will-change-transform shadow-2xl z-10">

                    {/* Image area */}
                    <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-[#0a0f18] to-black w-full">
                        {product.images && product.images.length > 0 ? (
                            <>
                                <Image
                                    src={product.images[0]}
                                    alt={product.title}
                                    fill
                                    className="object-cover transform group-hover:scale-110 transition-transform duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                    rel="preload"
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-700" />
                            </>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center relative">
                                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
                                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center shadow-inner">
                                    <ShoppingBag size={32} className="text-white/20" />
                                </div>
                            </div>
                        )}

                        {/* Top badges */}
                        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                            <div className="flex flex-col gap-2">
                                {hasDiscount && (
                                    <span className="px-3 py-1 rounded-xl bg-[#E8112D]/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-lg border border-white/10">
                                        Promo
                                    </span>
                                )}
                                {product.is_featured && (
                                    <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-[#FCD116] to-[#E5BD14] text-black text-[9px] font-black uppercase tracking-[0.2em] shadow-lg border border-black/10">
                                        Vedette
                                    </span>
                                )}
                                {isOutOfStock && (
                                    <span className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-lg border border-white/10">
                                        Rupture
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <motion.button
                                    onClick={handleToggleWishlist}
                                    animate={heartBounce ? { scale: [1, 1.4, 1] } : {}}
                                    transition={{ duration: 0.4 }}
                                    className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all duration-300 pointer-events-auto ${isFav
                                            ? 'bg-[#E8112D]/80 border-[#E8112D]/50 text-white shadow-lg shadow-[#E8112D]/30'
                                            : 'bg-black/20 border-white/10 text-white opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0'
                                        } ${isFav ? 'opacity-100 translate-x-0' : ''}`}
                                    title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                >
                                    <Heart size={16} fill={isFav ? 'currentColor' : 'none'} />
                                </motion.button>
                                <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-500 ease-out">
                                    <ArrowUpRight size={18} />
                                </div>
                            </div>
                        </div>

                        {/* Add to Cart Overlay */}
                        {!isOutOfStock && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                <button
                                    onClick={handleAddToCart}
                                    className="flex items-center gap-2 bg-[#FCD116] text-black font-black uppercase tracking-widest text-[10px] sm:text-xs px-6 py-3 rounded-full hover:bg-white hover:scale-105 transition-all shadow-xl shadow-black/50"
                                >
                                    <ShoppingCart size={16} /> Ajouter
                                </button>
                            </div>
                        )}

                        {/* Image Gradient Mask */}
                        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#080c13] to-transparent pointer-events-none" />
                    </div>

                    {/* Info */}
                    <div className="p-6 sm:p-7 flex flex-col flex-1 relative z-20 -mt-6">
                        <div className="space-y-4 flex-1">
                            <div className="flex items-center gap-2">
                                <div className="h-[2px] w-4 bg-[#FCD116]" />
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-[#FCD116]">
                                    {product.category}
                                </span>
                            </div>

                            <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all line-clamp-2 font-heading tracking-tight leading-tight">
                                {product.title}
                            </h3>

                            <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 leading-relaxed font-light">
                                {product.description}
                            </p>
                        </div>

                        {/* Price Area */}
                        <div className="mt-6 pt-5 border-t border-white/5 flex items-end justify-between">
                            <div className="flex flex-col">
                                {hasDiscount && (
                                    <span className="text-xs sm:text-sm text-gray-500 line-through font-medium mb-1">
                                        <Price amount={product.price} currency={product.currency as CurrencyCode} />
                                    </span>
                                )}
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl sm:text-3xl font-black text-white font-heading tracking-tighter">
                                        <Price amount={displayPrice!} currency={product.currency as CurrencyCode} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </motion.div>
    )
}
