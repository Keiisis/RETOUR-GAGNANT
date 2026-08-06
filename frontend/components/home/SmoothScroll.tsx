"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Smooth-scroll velours (Lenis) — monté uniquement sur l'accueil. Respecte
 * prefers-reduced-motion (désactivé). Nettoyage complet au démontage (aucune
 * fuite, pas de conflit avec les panels internes).
 */
export default function SmoothScroll() {
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
        let raf = 0;
        const frame = (time: number) => {
            lenis.raf(time);
            raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(raf);
            lenis.destroy();
        };
    }, []);

    return null;
}
