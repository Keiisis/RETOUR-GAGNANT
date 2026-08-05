'use client'

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Compteur animé, déclenché à l'entrée dans le viewport (IntersectionObserver +
 * requestAnimationFrame). Aucune dépendance lourde, SSR-safe, respecte
 * `prefers-reduced-motion` (affiche directement la valeur finale).
 */
export default function CountUp({
    to, duration = 1400, decimals = 0, prefix = '', suffix = '', className = '',
}: { to: number; duration?: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
    const ref = useRef<HTMLSpanElement>(null)
    const [val, setVal] = useState(0)
    const started = useRef(false)
    const reduce = useReducedMotion()

    useEffect(() => {
        if (reduce) { setVal(to); return }
        const el = ref.current
        if (!el) return
        const io = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && !started.current) {
                started.current = true
                const t0 = performance.now()
                const tick = (now: number) => {
                    const p = Math.min(1, (now - t0) / duration)
                    const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
                    setVal(to * eased)
                    if (p < 1) requestAnimationFrame(tick)
                    else setVal(to)
                }
                requestAnimationFrame(tick)
            }
        }, { threshold: 0.4 })
        io.observe(el)
        return () => io.disconnect()
    }, [to, duration, reduce])

    const display = decimals > 0
        ? val.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : Math.round(val).toLocaleString('fr-FR')

    return <span ref={ref} className={className}>{prefix}{display}{suffix}</span>
}
