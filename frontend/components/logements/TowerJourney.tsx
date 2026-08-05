'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Building3D from './Building3D'

const W = 360, H = 420 // dimensions du conteneur fixe (px)

/**
 * Fait « voyager » la tour 3D sur toute la page : elle part de l'ancre
 * `#tower-hero-slot` (héros) et se dépose exactement dans `#tower-cta-slot`
 * (carte verte du CTA final), au rythme du défilement.
 *
 * Position en `fixed`, interpolée en coordonnées document (donc scroll-safe et
 * responsive : les ancres sont mesurées en direct à chaque frame). Léger dip de
 * taille en milieu de course pour ne pas gêner le contenu. Desktop large
 * uniquement (≥ 1280px, marges suffisantes) + respect de reduced-motion. Le
 * conteneur est `pointer-events: none` : il n'intercepte jamais les clics.
 */
export default function TowerJourney() {
    const [enabled, setEnabled] = useState(false)
    const boxRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1280px)')
        const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
        const update = () => setEnabled(mq.matches && !rm.matches)
        update()
        mq.addEventListener('change', update)
        rm.addEventListener('change', update)
        return () => { mq.removeEventListener('change', update); rm.removeEventListener('change', update) }
    }, [])

    const place = () => {
        const box = boxRef.current
        const hero = document.getElementById('tower-hero-slot')
        const cta = document.getElementById('tower-cta-slot')
        if (!box || !hero || !cta) return
        const sY = window.scrollY
        const vh = window.innerHeight
        const h = hero.getBoundingClientRect()
        const c = cta.getBoundingClientRect()
        const hCX = h.left + h.width / 2
        const cCX = c.left + c.width / 2
        const hCYdoc = h.top + sY + h.height / 2
        const cCYdoc = c.top + sY + c.height / 2
        const sStart = hCYdoc - vh / 2
        const sEnd = cCYdoc - vh / 2
        let p = sEnd > sStart ? (sY - sStart) / (sEnd - sStart) : 0
        p = Math.max(0, Math.min(1, p))
        const e = p * p * (3 - 2 * p) // smoothstep
        const cx = hCX + (cCX - hCX) * e
        const cyView = (hCYdoc + (cCYdoc - hCYdoc) * e) - sY
        const ends = Math.abs(2 * e - 1) // 1 aux extrémités, 0 au milieu
        const scale = 0.62 + 0.38 * ends
        box.style.opacity = String(0.5 + 0.5 * ends) // fantomatique en voyage, plein posé
        box.style.transform = `translate(${cx - W / 2}px, ${cyView - H / 2}px) scale(${scale})`
        const spin = box.querySelector<HTMLDivElement>('.b3d-spin')
        if (spin) spin.style.transform = `rotateY(${-30 + 70 * e}deg)`
    }

    // Position initiale synchrone (avant peinture) pour un morph inter-pages net.
    useLayoutEffect(() => { if (enabled) place() })

    useEffect(() => {
        if (!enabled) return
        let raf = 0
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; place() }) }
        place()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [enabled])

    if (!enabled) return null

    return (
        <div
            ref={boxRef}
            aria-hidden="true"
            style={{ position: 'fixed', top: 0, left: 0, width: W, height: H, transformOrigin: 'center center', pointerEvents: 'none', zIndex: 20, willChange: 'transform' }}
        >
            <Building3D animateOnScroll={false} transitionName="logement-tower" />
        </div>
    )
}
