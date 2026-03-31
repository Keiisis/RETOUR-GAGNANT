import { create } from 'zustand'

interface FlyState {
    flyId: number
    startX: number
    startY: number
    active: boolean
    trigger: (x: number, y: number) => void
    clear: () => void
}

export const useFlyCart = create<FlyState>((set) => ({
    flyId: 0,
    startX: 0,
    startY: 0,
    active: false,
    trigger: (x, y) => set(state => ({ startX: x, startY: y, active: true, flyId: state.flyId + 1 })),
    clear: () => set({ active: false }),
}))
