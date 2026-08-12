'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * Élément décoratif 3D : tour de logements isométrique en CSS 3D (aucun WebGL,
 * donc léger et mobile-first). Pivote ET descend au scroll via GSAP ScrollTrigger
 * (scrub), flotte doucement en boucle. Chargement de GSAP en import dynamique +
 * `gsap.context` pour un montage/démontage propre (SSR-safe, pas de fuite).
 * Respecte `prefers-reduced-motion` (rendu statique, aucune animation).
 *
 * `transitionName` pose un `view-transition-name` : la même valeur sur les deux
 * pages permet au navigateur de « transporter » (morph) la tour d'une page à
 * l'autre lors d'une navigation via <TransitionLink>.
 *
 * Charte Bénin uniquement : verre vert (#008751), hall jaune (#FCD116),
 * accents rouge (#E8112D) + clé/drapeau dorés.
 */
export default function Building3D({ className = '', transitionName, animateOnScroll = true }: { className?: string; transitionName?: string; animateOnScroll?: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const reduce = useReducedMotion()

    useEffect(() => {
        if (reduce || !ref.current) return
        let cleanup = () => { }
        let cancelled = false

        ;(async () => {
            const gsapMod = await import('gsap')
            const gsap = gsapMod.default
            if (animateOnScroll) {
                const stMod = await import('gsap/ScrollTrigger')
                gsap.registerPlugin(stMod.ScrollTrigger)
            }
            if (cancelled || !ref.current) return

            const ctx = gsap.context((self) => {
                const q = self.selector!
                // Descente au scroll (seulement hors mode « journey », où le
                // parent TowerJourney pilote lui-même la position sur toute la page).
                if (animateOnScroll) {
                    const st = { trigger: ref.current, start: 'top 78%', end: '+=680', scrub: 1 }
                    gsap.fromTo(q('.b3d-move'), { y: -18 }, { y: 128, ease: 'none', scrollTrigger: st })
                    gsap.fromTo(q('.b3d-spin'), { rotateY: -32 }, { rotateY: 34, ease: 'none', scrollTrigger: { ...st } })
                }
                // Flottement d'inactivité (indépendant du scroll).
                gsap.to(q('.b3d-tilt'), { y: -12, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
                // Clé dorée qui respire.
                gsap.to(q('.b3d-key'), { y: 12, rotateZ: 8, duration: 2.2, ease: 'sine.inOut', yoyo: true, repeat: -1 })
                // Drapeau qui ondule légèrement.
                gsap.to(q('.b3d-flag'), { skewY: 6, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
                // Ombre au sol qui respire.
                gsap.to(q('.b3d-shadow'), { scaleX: 0.82, opacity: 0.34, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
            }, ref)

            cleanup = () => ctx.revert()
        })()

        return () => { cancelled = true; cleanup() }
    }, [reduce, animateOnScroll])

    return (
        <div ref={ref} className={`b3d-stage ${className}`} aria-hidden="true" style={transitionName ? { viewTransitionName: transitionName } : undefined}>
          <div className="b3d-move">
            <div className="b3d-scale">
                <div className="b3d-tilt">
                    <div className="b3d-spin">
                        <div className="b3d-cube">
                            {/* Façade principale */}
                            <div className="b3d-face b3d-front">
                                <div className="b3d-win" />
                                <div className="b3d-sheen" />
                                <div className="b3d-lobby"><div className="b3d-door" /></div>
                            </div>
                            {/* Façade arrière */}
                            <div className="b3d-face b3d-back"><div className="b3d-win" /><div className="b3d-sheen" /></div>
                            {/* Flancs */}
                            <div className="b3d-face b3d-right"><div className="b3d-win b3d-win--side" /></div>
                            <div className="b3d-face b3d-left"><div className="b3d-win b3d-win--side" /></div>
                            {/* Toit-terrasse */}
                            <div className="b3d-face b3d-top">
                                <div className="b3d-roofband" />
                                <div className="b3d-antenna" />
                                {/* Mât + drapeau tricolore */}
                                <div className="b3d-pole">
                                    <div className="b3d-flag" />
                                </div>
                            </div>
                            {/* Socle / parvis */}
                            <div className="b3d-face b3d-base" />
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
          </div>

            <style jsx>{`
                .b3d-stage {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    min-height: 320px;
                    perspective: 1100px;
                    pointer-events: none;
                }
                .b3d-move { will-change: transform; }
                .b3d-scale { transform: scale(0.82); }
                @media (min-width: 640px) { .b3d-scale { transform: scale(1); } }
                @media (min-width: 1024px) { .b3d-scale { transform: scale(1.1); } }

                .b3d-tilt { transform: rotateX(14deg); transform-style: preserve-3d; }
                .b3d-spin { transform: rotateY(-30deg); transform-style: preserve-3d; }

                .b3d-cube {
                    position: relative;
                    width: 168px;
                    height: 244px;
                    transform-style: preserve-3d;
                    margin: 0 auto;
                }
                .b3d-face {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    backface-visibility: hidden;
                    border-radius: 7px;
                    box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.28);
                }
                /* Fenêtres : grille de vitrages sur verre vert */
                .b3d-win {
                    position: absolute; inset: 0;
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0) 40%),
                        linear-gradient(90deg, rgba(255,255,255,0.24) 1.5px, transparent 1.5px),
                        linear-gradient(180deg, rgba(255,255,255,0.20) 1.5px, transparent 1.5px),
                        linear-gradient(135deg, #0b915b, #037a48);
                    background-size: 100% 100%, 30px 30px, 30px 30px, 100% 100%;
                }
                .b3d-win--side { filter: brightness(0.85); }
                /* Reflet diagonal qui glisse sur le verre */
                .b3d-sheen {
                    position: absolute; top: -20%; left: -30%;
                    width: 55%; height: 150%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
                    transform: rotate(18deg);
                    pointer-events: none;
                }

                .b3d-front { transform: translateZ(84px); }
                .b3d-back { transform: rotateY(180deg) translateZ(84px); }
                .b3d-right { transform: rotateY(90deg) translateZ(84px); }
                .b3d-left { transform: rotateY(-90deg) translateZ(84px); }
                .b3d-right, .b3d-left { width: 168px; }
                .b3d-top {
                    height: 168px;
                    transform: rotateX(90deg) translateZ(160px);
                    background: linear-gradient(135deg, #0b925c, #06663d);
                    overflow: visible;
                }
                .b3d-base {
                    height: 168px;
                    transform: rotateX(90deg) translateZ(-84px);
                    background: radial-gradient(circle at 50% 50%, #14c07a55, transparent 68%), linear-gradient(135deg, #0e5c3a, #073d26);
                }
                .b3d-roofband {
                    position: absolute; left: 14px; right: 14px; top: 20px; height: 10px;
                    border-radius: 4px;
                    background: linear-gradient(90deg, #008751 46%, #FCD116 46% 73%, #E8112D 73%);
                    opacity: 0.92;
                }
                .b3d-antenna {
                    position: absolute; top: 46px; left: 40px;
                    width: 4px; height: 34px; border-radius: 2px;
                    background: linear-gradient(180deg, #cfd8d3, #8a978f);
                }
                /* Mât + drapeau qui sortent du toit (vers le haut en 3D) */
                .b3d-pole {
                    position: absolute; top: 64px; right: 44px;
                    width: 4px; height: 60px; border-radius: 2px;
                    background: linear-gradient(180deg, #e9d27a, #b9922f);
                    transform: rotateX(-90deg);
                    transform-origin: bottom center;
                }
                .b3d-flag {
                    position: absolute; top: 2px; left: 4px;
                    width: 34px; height: 20px;
                    background: linear-gradient(90deg, #008751 40%, #FCD116 40% 70%, #E8112D 70%);
                    border-radius: 2px;
                    transform-origin: left center;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.18);
                }

                /* Hall d'entrée jaune + porte */
                .b3d-lobby {
                    position: absolute; left: 0; right: 0; bottom: 0; height: 48px;
                    background: linear-gradient(180deg, #FCD116, #e8be07);
                    display: flex; align-items: flex-end; justify-content: center;
                    box-shadow: inset 0 2px 0 rgba(255,255,255,0.4);
                }
                .b3d-door {
                    width: 32px; height: 36px;
                    background: linear-gradient(180deg, #E8112D, #b60d20);
                    border-radius: 5px 5px 0 0;
                    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.35);
                }

                /* Ombre projetée */
                .b3d-shadow {
                    position: absolute;
                    bottom: 4px; left: 50%;
                    width: 196px; height: 34px;
                    transform: translateX(-50%);
                    background: radial-gradient(ellipse at center, rgba(2,26,16,0.42), transparent 70%);
                    filter: blur(3px);
                    opacity: 0.5;
                }

                /* Clé dorée flottante */
                .b3d-key {
                    position: absolute; top: -36px; right: -30px;
                    width: 66px; height: 66px;
                    transform: translateZ(130px) rotateZ(-18deg);
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
