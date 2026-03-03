import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface WishlistItem {
    id: string
    title: string
    price: number
    sale_price?: number
    currency: string
    image_url?: string
    category: string
    addedAt: number
}

interface WishlistState {
    items: WishlistItem[]
    addItem: (item: Omit<WishlistItem, 'addedAt'>) => void
    removeItem: (id: string) => void
    toggleItem: (item: Omit<WishlistItem, 'addedAt'>) => void
    isInWishlist: (id: string) => boolean
    clearWishlist: () => void
    itemCount: number
}

export const useWishlist = create<WishlistState>()(
    persist(
        (set, get) => ({
            items: [],
            itemCount: 0,

            addItem: (item) => {
                set((state) => {
                    if (state.items.some((i) => i.id === item.id)) return state
                    const newItems = [...state.items, { ...item, addedAt: Date.now() }]
                    return { items: newItems, itemCount: newItems.length }
                })
            },

            removeItem: (id) => {
                set((state) => {
                    const newItems = state.items.filter((i) => i.id !== id)
                    return { items: newItems, itemCount: newItems.length }
                })
            },

            toggleItem: (item) => {
                const exists = get().items.some((i) => i.id === item.id)
                if (exists) {
                    get().removeItem(item.id)
                } else {
                    get().addItem(item)
                }
            },

            isInWishlist: (id) => {
                return get().items.some((i) => i.id === id)
            },

            clearWishlist: () => {
                set({ items: [], itemCount: 0 })
            },
        }),
        {
            name: 'retour-gagnant-wishlist',
            storage: createJSONStorage(() => localStorage),
        }
    )
)
