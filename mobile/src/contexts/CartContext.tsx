import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { BoutiqueProduct, CartItemNav } from '../navigation/AppNavigator'

/* ══════════════════════════════════════════════════════════════════════════
   CartContext : global shopping cart state.
   Lives at the App level so it survives navigation between Boutique,
   ProductDetail, Checkout and back. Cleared after successful order.
   ══════════════════════════════════════════════════════════════════════════ */

interface CartContextType {
    cart: CartItemNav[]
    addToCart: (product: BoutiqueProduct, qty?: number) => void
    removeFromCart: (productId: string) => void
    clearItem: (productId: string) => void
    clearCart: () => void
    cartCount: number
    cartTotal: number
}

const CartContext = createContext<CartContextType>({
    cart: [],
    addToCart: () => {},
    removeFromCart: () => {},
    clearItem: () => {},
    clearCart: () => {},
    cartCount: 0,
    cartTotal: 0,
})

export const useCart = () => useContext(CartContext)

const unitPrice = (p: BoutiqueProduct) =>
    (p.sale_price && p.sale_price < p.price) ? p.sale_price : p.price

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<CartItemNav[]>([])

    const addToCart = useCallback((product: BoutiqueProduct, qty: number = 1) => {
        setCart(prev => {
            const existing = prev.find(c => c.product.id === product.id)
            if (existing) {
                const newQty = existing.quantity + qty
                if (newQty > product.stock) return prev // safety guard
                return prev.map(c => c.product.id === product.id ? { ...c, quantity: newQty } : c)
            }
            return [...prev, { product, quantity: Math.min(qty, product.stock) }]
        })
    }, [])

    const removeFromCart = useCallback((productId: string) => {
        setCart(prev => {
            const existing = prev.find(c => c.product.id === productId)
            if (existing && existing.quantity > 1) {
                return prev.map(c => c.product.id === productId ? { ...c, quantity: c.quantity - 1 } : c)
            }
            return prev.filter(c => c.product.id !== productId)
        })
    }, [])

    const clearItem = useCallback((productId: string) => {
        setCart(prev => prev.filter(c => c.product.id !== productId))
    }, [])

    const clearCart = useCallback(() => setCart([]), [])

    const cartCount = useMemo(
        () => cart.reduce((sum, item) => sum + item.quantity, 0),
        [cart]
    )

    const cartTotal = useMemo(
        () => cart.reduce((sum, item) => sum + unitPrice(item.product) * item.quantity, 0),
        [cart]
    )

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearItem, clearCart, cartCount, cartTotal }}>
            {children}
        </CartContext.Provider>
    )
}
