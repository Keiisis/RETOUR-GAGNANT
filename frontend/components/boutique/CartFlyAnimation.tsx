'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'
import { useFlyCart } from '@/lib/store/flyStore'
import { useCart } from '@/lib/store/cartStore'

export function CartFlyAnimation() {
    const { flyId, startX, startY, active, clear } = useFlyCart()
    const { itemCount } = useCart()
    const [scope, animate] = useAnimate()
    const prevCount = useRef(itemCount)

    useEffect(() => {
        if (!active) return

        // Trouver la position du bouton panier
        const cartBtn = document.getElementById('cart-float-btn')
        if (!cartBtn) { clear(); return }

        const rect = cartBtn.getBoundingClientRect()
        const endX = rect.left + rect.width / 2
        const endY = rect.top + rect.height / 2

        // Animer le point volant
        const run = async () => {
            await animate(scope.current, {
                x: [startX, endX],
                y: [startY, endY],
                scale: [1, 0.3],
                opacity: [1, 0],
            }, {
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
            })
            clear()

            // Faire rebondir le bouton panier
            await animate('#cart-float-btn', { scale: [1, 1.25, 0.9, 1.1, 1] }, { duration: 0.5 })
        }
        run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flyId, active])

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    ref={scope}
                    key={flyId}
                    className="fixed z-[9999] pointer-events-none w-6 h-6 rounded-full bg-[#008751] shadow-lg"
                    style={{
                        left: startX - 12,
                        top: startY - 12,
                        x: 0,
                        y: 0,
                    }}
                />
            )}
        </AnimatePresence>
    )
}
