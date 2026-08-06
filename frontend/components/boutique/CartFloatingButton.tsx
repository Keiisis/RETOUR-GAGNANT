'use client'

import { useTranslation, T } from '@/lib/translation';
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart } from '@phosphor-icons/react'
import { useCart } from '@/lib/store/cartStore'

export function CartFloatingButton() {
    const { t } = useTranslation();
    const { itemCount, toggleCart } = useCart()

    return (
        <AnimatePresence>
            {itemCount > 0 && (
                <motion.button
                    id="cart-float-btn"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={toggleCart}
                    className="fixed bottom-8 right-8 z-[800] w-16 h-16 rounded-full bg-[#008751] text-white shadow-2xl shadow-[#008751]/30 flex items-center justify-center hover:bg-[#006a40] transition-all group"
                    title={t("Voir le panier")}
                >
                    <ShoppingCart size={24} />
                    <motion.span
                        key={itemCount}
                        initial={{ scale: 1.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#E8112D] text-white text-[10px] font-black flex items-center justify-center border-2 border-white"
                    >
                        {itemCount}
                    </motion.span>
                </motion.button>
            )}
        </AnimatePresence>
    )
}
