'use client'

import { useTranslation, T } from '@/lib/translation';
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, ShoppingCart, Trash, Plus, Minus, ShoppingBag, ArrowRight
} from '@phosphor-icons/react'
import { useCart } from '@/lib/store/cartStore'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useState } from 'react'
import { CartCheckoutModal } from './CartCheckoutModal'
import { Price } from '@/components/ui/Price'
import { CurrencyCode } from '@/lib/currency'

export function CartDrawer() {
    const { t } = useTranslation();
    const { items, removeItem, updateQuantity, clearCart, itemCount, totalAmount, isOpen, closeCart } = useCart()
    const [showCheckout, setShowCheckout] = useState(false)

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[900]"
                            onClick={closeCart}
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0a0f18] border-l border-white/10 z-[901] flex flex-col shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                        <ShoppingCart size={20} className="text-[#FCD116]" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-white font-heading"><T>Panier</T></h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                            {itemCount} article{itemCount > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeCart}
                                    className="p-2 rounded-xl hover:bg-white/5 text-gray-400 transition-colors"
                                    title={t("Fermer le panier")}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Items */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {items.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                        <ShoppingBag size={48} className="text-gray-700" />
                                        <p className="text-gray-500 font-bold"><T>Votre panier est vide</T></p>
                                        <p className="text-xs text-gray-600"><T>Ajoutez des produits depuis la boutique</T></p>
                                    </div>
                                ) : (
                                    items.map(item => {
                                        const unitPrice = (item.sale_price && item.sale_price < item.price) ? item.sale_price : item.price
                                        return (
                                            <motion.div
                                                key={item.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: 100 }}
                                                className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group"
                                            >
                                                {/* Image */}
                                                {item.image_url && (
                                                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
                                                        <Image src={item.image_url} alt={item.title} fill className="object-cover" />
                                                    </div>
                                                )}

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                                                    <p className="text-xs text-[#FCD116] font-black mt-1">
                                                        <Price amount={unitPrice} currency={item.currency as CurrencyCode} />
                                                    </p>

                                                    {/* Quantitéy controls */}
                                                    <div className="flex items-center gap-2 mt-3">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                            title={t("Diminuer la quantité")}
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="text-sm font-black text-white w-8 text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                                            title={t("Augmenter la quantité")}
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Subtotal + Remove */}
                                                <div className="flex flex-col items-end justify-between">
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="p-1.5 rounded-lg text-gray-600 hover:text-[#E8112D] hover:bg-[#E8112D]/10 transition-colors"
                                                        title={t("Supprimer du panier")}
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                    <p className="text-xs font-bold text-gray-400">
                                                        <Price amount={unitPrice * item.quantity} currency={item.currency as CurrencyCode} />
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                            </div>

                            {/* Footer */}
                            {items.length > 0 && (
                                <div className="p-6 border-t border-white/5 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest"><T>Total</T></span>
                                        <span className="text-2xl font-black text-[#FCD116] font-heading">
                                            <Price amount={totalAmount} currency={items[0]?.currency as CurrencyCode} showSelector />
                                        </span>
                                    </div>

                                    <Button
                                        onClick={() => { closeCart(); setShowCheckout(true) }}
                                        className="w-full h-14 rounded-xl bg-[#FCD116] text-[#0f141e] font-black text-sm hover:bg-[#008751] hover:text-white transition-all gap-2"
                                    >
                                        Commander <ArrowRight size={18} />
                                    </Button>

                                    <button
                                        onClick={clearCart}
                                        className="text-xs text-gray-600 hover:text-[#E8112D] transition-colors block mx-auto underline"
                                    >
                                        Vider le panier
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Checkout Modal */}
            {showCheckout && (
                <CartCheckoutModal
                    isOpen={showCheckout}
                    onClose={() => setShowCheckout(false)}
                />
            )}
        </>
    )
}
