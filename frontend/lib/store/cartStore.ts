import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
    id: string
    title: string
    price: number
    sale_price?: number
    currency: string
    quantity: number
    image_url?: string
    max_stock?: number
}

interface CartState {
    items: CartItem[]
    isOpen: boolean
    addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
    removeItem: (id: string) => void
    updateQuantity: (id: string, quantity: number) => void
    clearCart: () => void
    toggleCart: () => void
    closeCart: () => void
    openCart: () => void
    itemCount: number
    totalAmount: number
}

// Helper to compute derived state
const computeDerivedState = (items: CartItem[]) => {
    return {
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        totalAmount: items.reduce((sum, i) => {
            const price = (i.sale_price && i.sale_price < i.price) ? i.sale_price : i.price
            return sum + price * i.quantity
        }, 0)
    }
}

export const useCart = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            itemCount: 0,
            totalAmount: 0,

            addItem: (item, quantity = 1) => {
                set((state) => {
                    const existing = state.items.find((i) => i.id === item.id)
                    let newItems: CartItem[];

                    if (existing) {
                        newItems = state.items.map((i) =>
                            i.id === item.id
                                ? { ...i, quantity: Math.min(i.quantity + quantity, i.max_stock || 99) }
                                : i
                        )
                    } else {
                        newItems = [...state.items, { ...item, quantity }]
                    }

                    return {
                        items: newItems,
                        isOpen: true,
                        ...computeDerivedState(newItems)
                    }
                })
            },

            removeItem: (id) => {
                set((state) => {
                    const newItems = state.items.filter((i) => i.id !== id)
                    return {
                        items: newItems,
                        ...computeDerivedState(newItems)
                    }
                })
            },

            updateQuantity: (id, quantity) => {
                set((state) => {
                    if (quantity <= 0) {
                        const newItems = state.items.filter((i) => i.id !== id)
                        return { items: newItems, ...computeDerivedState(newItems) }
                    }

                    const newItems = state.items.map((i) =>
                        i.id === id ? { ...i, quantity } : i
                    )
                    return {
                        items: newItems,
                        ...computeDerivedState(newItems)
                    }
                })
            },

            clearCart: () => {
                set({ items: [], isOpen: false, itemCount: 0, totalAmount: 0 })
            },

            toggleCart: () => {
                set((state) => ({ isOpen: !state.isOpen }))
            },

            closeCart: () => {
                set({ isOpen: false })
            },

            openCart: () => {
                set({ isOpen: true })
            }
        }),
        {
            name: 'retour-gagnant-cart',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
