'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Élément décoratif 3D — tour de logements isométrique en CSS 3D (aucun WebGL,
 * donc léger et mobile-first). Pivote au scroll via GSAP ScrollTrigger (scrub)
 * et flotte doucement en boucle. Chargement de GSAP en import dynamique +
 * `gsap.context` pour un montage/démontage propre (SSR-safe, pas de fuite).
 * Respecte `prefers-reduced-motion` (rendu statique, aucune animation).
 *
 * Charte Bénin uniquement : verre vert (#008751), hall jaune (#FCD116),
 * porte + clé accent rouge/or.
 */
export default function Building3D({ className = '' }: { className?: string }) {
    const ref = useRef<HTMLDivElement>(null)
    const reduce = useReducedMotion()

    useEffect(() => {
        if (reduce || !ref.current) return
        let cleanup = () => { }
        let cancelled = false

        ;(async () => {
            const gsapMod = await import('gsap')
            const stMod = await import('gsap/ScrollTrigger')
            if (cancelled || !ref.current) return
            const gsap = gsapMod.default
            const ScrollTrigger = stMod.ScrollTrigger
            gsap.registerPlugin(ScrollTrigger)

            const ctx = gsap.context((self) => {
                const q = self.selector!
                // Rotation pilotée par le défilement (scrub lié au scroll).
                gsap.fromTo(q('.b3d-spin'),
                    { rotateY: -34 },
                    {
                        rotateY: 26, ease: 'none',
                        scrollTrigger: { trigger: ref.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
                    },
                )
                // Flottement d'inactivité (indépendant du scroll).
                gsap.to(q('.b3d-tilt'), { y: -14, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
                // Clé dorée en orbite lente.
                gsap.to(q('.b3d-key'), { y: 12, rotateZ: 8, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
                // Ombre au sol qui respire avec la tour.
                gsap.to(q('.b3d-shadow'), { scaleX: 0.82, opacity: 0.35, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
            }, ref)

            cleanup = () => ctx.revert()
        })()

        return () => { cancelled = true; cleanup() }
    }, [reduce])

    return (
        <div ref={ref} className={`b3d-stage ${className}`} aria-hidden="true">
            <div className="b3d-scale">
                <div className="b3d-tilt">
                    <div className="b3d-spin">
                        <div className="b3d-cube">
                            {/* Façade principale */}
                            <div className="b3d-face b3d-front">
                                <div className="b3d-win" />
                                <div className="b3d-lobby"><div className="b3d-door" /></div>
                            </div>
                            {/* Façade arrière */}
                            <div className="b3d-face b3d-back"><div className="b3d-win" /></div>
                            {/* Flancs */}
                            <div className="b3d-face b3d-right"><div className="b3d-win b3d-win--side" /></div>
                            <div className="b3d-face b3d-left"><div className="b3d-win b3d-win--side" /></div>
                            {/* Toit-terrasse */}
                            <div className="b3d-face b3d-top">
                                <div className="b3d-roofband" />
                            </div>
                        </div>
                        {/* Clé dorée flottante (symbole de propriété) */}
                        <div className="b3d-key">
                            <span className="b3d-key-ring" />
                            <span className="b3d-key-shaft" />
                            <span className="b3d-key-tooth b3d-key-tooth--1" />
                            <span className="b3d-key-tooth b3d-key-tooth--2" />
                        </div>
                    </div>
                </div>
                <div className="b3d-shadow" />
            </div>

            <style jsx>{`
                .b3d-stage {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    min-height: 300px;
                    perspective: 1100px;
                }
                .b3d-scale { transform: scale(0.82); }
                @media (min-width: 640px) { .b3d-scale { transform: scale(1); } }
                @media (min-width: 1024px) { .b3d-scale { transform: scale(1.08); } }

                .b3d-tilt { transform: rotateX(14deg); transform-style: preserve-3d; }
                .b3d-spin { transform: rotateY(-30deg); transform-style: preserve-3d; }

                .b3d-cube {
                    position: relative;
                    width: 168px;
                    height: 236px;
                    transform-style: preserve-3d;
                    margin: 0 auto;
                }
                .b3d-face {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    backface-visibility: hidden;
                    border-radius: 6px;
                    box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.25);
                }
                /* Fenêtres : grille de vitrages sur verre vert */
                .b3d-win {
                    position: absolute; inset: 0;
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 42%),
                        linear-gradient(90deg, rgba(255,255,255,0.22) 1.5px, transparent 1.5px),
                        linear-gradient(180deg, rgba(255,255,255,0.22) 1.5px, transparent 1.5px),
                        linear-gradient(135deg, #0a8d58, #007a49);
                    background-size: 100% 100%, 30px 30px, 30px 30px, 100% 100%;
                }
                .b3d-win--side { filter: brightness(0.86); }

                .b3d-front { transform: translateZ(84px); }
                .b3d-back { transform: rotateY(180deg) translateZ(84px); }
                .b3d-right { transform: rotateY(90deg) translateZ(84px); }
                .b3d-left { transform: rotateY(-90deg) translateZ(84px); }
                .b3d-right, .b3d-left { width: 168px; }
                .b3d-top {
                    height: 168px;
                    transform: rotateX(90deg) translateZ(84px);
                    background: linear-gradient(135deg, #0a8d58, #006b40);
                }
                .b3d-roofband {
                    position: absolute; left: 14px; right: 14px; top: 18px; height: 10px;
                    border-radius: 4px;
                    background: linear-gradient(90deg, #008751 46%, #FCD116 46% 73%, #E8112D 73%);
                    opacity: 0.9;
                }

                /* Hall d'entrée jaune + porte */
                .b3d-lobby {
                    position: absolute; left: 0; right: 0; bottom: 0; height: 46px;
                    background: linear-gradient(180deg, #FCD116, #e8be07);
                    display: flex; align-items: flex-end; justify-content: center;
                    box-shadow: inset 0 2px 0 rgba(255,255,255,0.4);
                }
                .b3d-door {
                    width: 30px; height: 34px;
                    background: linear-gradient(180deg, #E8112D, #b60d20);
                    border-radius: 4px 4px 0 0;
                    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35);
                }

                /* Ombre projetée */
                .b3d-shadow {
                    position: absolute;
                    bottom: 6px; left: 50%;
                    width: 190px; height: 34px;
                    transform: translateX(-50%);
                    background: radial-gradient(ellipse at center, rgba(2,26,16,0.42), transparent 70%);
                    filter: blur(3px);
                    opacity: 0.5;
                }

                /* Clé dorée flottante */
                .b3d-key {
                    position: absolute; top: -34px; right: -30px;
                    width: 66px; height: 66px;
                    transform: translateZ(120px) rotateZ(-18deg);
                    filter: drop-shadow(0 10px 14px rgba(180,120,0,0.35));
                }
                .b3d-key-ring {
                    position: absolute; top: 0; left: 0;
                    width: 30px; height: 30px; border-radius: 50%;
                    border: 7px solid #FCD116;
                    background: transparent;
                }
                .b3d-key-shaft {
                    position: absolute; top: 24px; left: 24px;
                    width: 34px; height: 8px; border-radius: 4px;
                    background: linear-gradient(90deg, #FCD116, #e0a800);
                    transform: rotate(38deg); transform-origin: left center;
                }
                .b3d-key-tooth {
                    position: absolute;
                    width: 8px; background: #FCD116; border-radius: 2px;
                }
                .b3d-key-tooth--1 { height: 12px; top: 40px; left: 44px; transform: rotate(38deg); }
                .b3d-key-tooth--2 { height: 9px; top: 46px; left: 50px; transform: rotate(38deg); }
            `}</style>
        </div>
    )
}
