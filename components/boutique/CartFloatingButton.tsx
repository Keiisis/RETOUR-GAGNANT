'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/lib/store/cartStore'

export function CartFloatingButton() {
    const { itemCount, toggleCart } = useCart()

    return (
        <AnimatePresence>
            {itemCount > 0 && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={toggleCart}
                    className="fixed bottom-8 right-8 z-[800] w-16 h-16 rounded-full bg-[#FCD116] text-[#0f141e] shadow-2xl shadow-[#FCD116]/30 flex items-center justify-center hover:bg-[#008751] hover:text-white transition-all group"
                    title="Voir le panier"
                >
                    <ShoppingCart size={24} />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#E8112D] text-white text-[10px] font-black flex items-center justify-center border-2 border-[#0a0f18]">
                        {itemCount}
                    </span>
                </motion.button>
            )}
        </AnimatePresence>
    )
}
