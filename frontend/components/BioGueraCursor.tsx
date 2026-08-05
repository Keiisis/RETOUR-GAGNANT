'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// Panels internes / pro où le curseur ludique est désactivé.
const EXCLUDED = ['/admin', '/agent', '/dashboard']

/**
 * Curseur animé « Bio Guéra » — un cavalier au galop (silhouette SVG stylisée,
 * charte Bénin) qui suit la souris. Au clic, le cavalier lance sa lance vers le
 * point cliqué (le bouton) où un assaillant est touché puis tombe.
 *
 * Desktop-only strict : activé uniquement si (hover: hover) et (pointer: fine),
 * jamais sur tactile/mobile. Respecte prefers-reduced-motion. N'intercepte
 * jamais les clics (pointer-events: none partout). Léger : rAF + Web Animations
 * API natives, aucune dépendance.
 */
export default function BioGueraCursor() {
    const [enabled, setEnabled] = useState(false)
    const pathname = usePathname()
    const excluded = EXCLUDED.some(p => pathname?.startsWith(p))
    const layerRef = useRef<HTMLDivElement>(null)
    const riderRef = useRef<HTMLDivElement>(null)
    const pos = useRef({ x: -200, y: -200 })
    const target = useRef({ x: -200, y: -200 })
    const facing = useRef(1)

    // Détection desktop + reduced-motion (réactive).
    useEffect(() => {
        const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
        const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
        const update = () => setEnabled(mq.matches && !rm.matches)
        update()
        mq.addEventListener('change', update)
        rm.addEventListener('change', update)
        return () => { mq.removeEventListener('change', update); rm.removeEventListener('change', update) }
    }, [])

    useEffect(() => {
        if (!enabled || excluded) return
        const root = document.documentElement
        root.classList.add('bg-cursor-active')

        const onMove = (e: PointerEvent) => { target.current = { x: e.clientX, y: e.clientY } }
        let throwTO = 0
        const onDown = (e: PointerEvent) => {
            if (e.button !== 0) return
            throwSpear(e.clientX, e.clientY)
            // Geste de lancer : le bras se détend vers l'avant brièvement.
            const rider = riderRef.current
            if (rider) {
                rider.classList.add('bg-throw')
                clearTimeout(throwTO)
                throwTO = window.setTimeout(() => rider.classList.remove('bg-throw'), 300)
            }
        }
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('pointerdown', onDown, { passive: true })

        let raf = 0
        const tick = () => {
            const p = pos.current, t = target.current
            const dx = t.x - p.x
            p.x += dx * 0.16
            p.y += (t.y - p.y) * 0.16
            if (Math.abs(dx) > 0.6) facing.current = dx > 0 ? 1 : -1
            if (riderRef.current) {
                riderRef.current.style.transform =
                    `translate3d(${p.x - 34}px, ${p.y - 30}px, 0) scaleX(${facing.current})`
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)

        // Lance projetée du cavalier vers (tx, ty), puis impact.
        const throwSpear = (tx: number, ty: number) => {
            const layer = layerRef.current
            if (!layer) return
            const sx = pos.current.x + facing.current * 18
            const sy = pos.current.y - 6
            const angle = Math.atan2(ty - sy, tx - sx) * (180 / Math.PI)
            const dist = Math.hypot(tx - sx, ty - sy)

            const spear = document.createElement('div')
            spear.className = 'bg-spear'
            spear.style.left = `${sx}px`
            spear.style.top = `${sy}px`
            spear.style.transform = `rotate(${angle}deg) translateX(0)`
            layer.appendChild(spear)

            const anim = spear.animate(
                [
                    { transform: `rotate(${angle}deg) translateX(0)`, opacity: 1 },
                    { transform: `rotate(${angle}deg) translateX(${dist}px)`, opacity: 1 },
                ],
                { duration: Math.min(520, 140 + dist * 0.7), easing: 'cubic-bezier(0.3,0,0.2,1)' },
            )
            anim.onfinish = () => { spear.remove(); impact(tx, ty) }
        }

        // Impact : gerbe d'étincelles tricolores + assaillant qui tombe.
        const impact = (x: number, y: number) => {
            const layer = layerRef.current
            if (!layer) return
            const burst = document.createElement('div')
            burst.className = 'bg-impact'
            burst.style.left = `${x}px`
            burst.style.top = `${y}px`
            burst.innerHTML =
                '<span class="bg-foe"></span>' +
                Array.from({ length: 7 }).map((_, i) => `<i style="--a:${(i / 7) * 360}deg"></i>`).join('')
            layer.appendChild(burst)
            burst.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 720, easing: 'ease-out' }).onfinish = () => burst.remove()
        }

        return () => {
            cancelAnimationFrame(raf)
            clearTimeout(throwTO)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerdown', onDown)
            root.classList.remove('bg-cursor-active')
        }
    }, [enabled, excluded])

    if (!enabled || excluded) return null

    return (
        <div ref={layerRef} className="bg-cursor-layer" aria-hidden="true">
            <div ref={riderRef} className="bg-rider">
                {/* Cavalier au galop — silhouette stylisée, accents tricolores */}
                <svg width="68" height="60" viewBox="0 0 68 60" fill="none">
                    {/* poussière */}
                    <ellipse cx="16" cy="52" rx="14" ry="3" fill="#0b2a1c" opacity="0.18" />
                    {/* jambes (galop) */}
                    <g className="bg-legs" stroke="#0b2a1c" strokeWidth="3.4" strokeLinecap="round">
                        <line className="bg-leg bg-leg--1" x1="24" y1="38" x2="18" y2="50" />
                        <line className="bg-leg bg-leg--2" x1="30" y1="39" x2="36" y2="51" />
                        <line className="bg-leg bg-leg--3" x1="44" y1="38" x2="50" y2="50" />
                        <line className="bg-leg bg-leg--4" x1="48" y1="39" x2="42" y2="51" />
                    </g>
                    {/* corps + encolure + tête + queue */}
                    <path d="M20 38 Q22 28 34 29 L50 30 Q57 30 58 24 L60 26 Q60 34 52 37 L50 39 Q40 42 30 40 Z" fill="#12352339" />
                    <path d="M20 38 Q22 28 34 29 L50 30 Q57 30 58 24 L60 26 Q60 34 52 37 L50 39 Q40 42 30 40 Z" fill="#0b2a1c" />
                    <path d="M18 39 Q10 40 8 34 Q13 37 19 35 Z" fill="#0b2a1c" />
                    {/* selle tricolore */}
                    <rect x="30" y="30" width="12" height="4" rx="1.5" fill="#008751" />
                    <rect x="34" y="30" width="4" height="4" fill="#FCD116" />
                    <rect x="38" y="30" width="4" height="4" fill="#E8112D" />
                    {/* cavalier */}
                    <circle cx="36" cy="15" r="5" fill="#0b2a1c" />
                    <path d="M34 20 Q36 30 40 31 L34 31 Q30 26 31 20 Z" fill="#0b2a1c" />
                    {/* cape tricolore */}
                    <path d="M31 21 Q24 24 26 32 L31 28 Z" fill="#008751" />
                    {/* bras + lance levée — groupe animé (pivot à l'épaule) */}
                    <g className="bg-arm">
                        <line x1="37" y1="21" x2="52" y2="10" stroke="#0b2a1c" strokeWidth="2.6" strokeLinecap="round" />
                        <line x1="46" y1="16" x2="64" y2="8" stroke="#b9922f" strokeWidth="2.2" strokeLinecap="round" />
                        <path d="M64 8 l5 -2 -3 4 Z" fill="#FCD116" />
                    </g>
                </svg>
            </div>

            <style jsx global>{`
                html.bg-cursor-active,
                html.bg-cursor-active * { cursor: none !important; }
                /* On rend le curseur natif aux champs de saisie (ergonomie). */
                html.bg-cursor-active input,
                html.bg-cursor-active textarea,
                html.bg-cursor-active select,
                html.bg-cursor-active [contenteditable="true"] { cursor: auto !important; }

                .bg-cursor-layer {
                    position: fixed; inset: 0; z-index: 9998;
                    pointer-events: none; overflow: hidden;
                }
                .bg-rider {
                    position: fixed; top: 0; left: 0;
                    width: 68px; height: 60px;
                    will-change: transform;
                    filter: drop-shadow(0 6px 8px rgba(2,26,16,0.25));
                }
                .bg-legs .bg-leg { transform-origin: top center; animation: bg-gallop 0.32s linear infinite; }
                .bg-leg--2, .bg-leg--3 { animation-delay: 0.16s; }
                @keyframes bg-gallop {
                    0%, 100% { transform: rotate(-16deg); }
                    50% { transform: rotate(18deg); }
                }
                /* Bras + lance qui pompent au rythme du galop (pivot à l'épaule) */
                .bg-arm {
                    transform-box: fill-box;
                    transform-origin: 0% 65%;
                    animation: bg-arm 0.34s ease-in-out infinite;
                }
                @keyframes bg-arm {
                    0%, 100% { transform: rotate(-9deg); }
                    50% { transform: rotate(11deg); }
                }
                /* Geste de lancer (au clic) : détente franche vers l'avant */
                .bg-rider.bg-throw .bg-arm {
                    animation: bg-throw 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                @keyframes bg-throw {
                    0% { transform: rotate(-24deg); }
                    45% { transform: rotate(-24deg); }
                    100% { transform: rotate(34deg); }
                }

                .bg-spear {
                    position: fixed; width: 26px; height: 3px; border-radius: 2px;
                    background: linear-gradient(90deg, #b9922f, #FCD116);
                    transform-origin: left center;
                    box-shadow: 0 0 6px rgba(252,209,22,0.6);
                    pointer-events: none; z-index: 9999;
                }
                .bg-spear::after {
                    content: ''; position: absolute; right: -6px; top: -2.5px;
                    border-left: 8px solid #FCD116;
                    border-top: 4px solid transparent; border-bottom: 4px solid transparent;
                }
                .bg-impact { position: fixed; width: 0; height: 0; z-index: 9999; pointer-events: none; }
                .bg-impact i {
                    position: absolute; left: 0; top: 0;
                    width: 12px; height: 2.5px; border-radius: 2px;
                    background: #FCD116;
                    transform: rotate(var(--a)) translateX(4px);
                    animation: bg-spark 0.5s ease-out forwards;
                }
                .bg-impact i:nth-child(3n) { background: #E8112D; }
                .bg-impact i:nth-child(3n+1) { background: #008751; }
                @keyframes bg-spark {
                    to { transform: rotate(var(--a)) translateX(22px); opacity: 0; }
                }
                .bg-foe {
                    position: absolute; left: -7px; top: -18px;
                    width: 14px; height: 18px; border-radius: 5px 5px 3px 3px;
                    background: #0b2a1c;
                    transform-origin: bottom center;
                    animation: bg-fall 0.7s cubic-bezier(0.5,0,0.75,0) forwards;
                }
                @keyframes bg-fall {
                    0% { transform: rotate(0) translateY(0); opacity: 0.9; }
                    100% { transform: rotate(78deg) translateY(10px); opacity: 0; }
                }
            `}</style>
        </div>
    )
}
