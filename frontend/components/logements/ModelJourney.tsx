"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import BuildingModel3D from "./BuildingModel3D";

const W = 460, H = 500; // conteneur fixe (px)

/**
 * Fait « voyager » le modèle 3D du bâtiment sur toute la page : il part de
 * l'ancre `#model-hero-slot` (héros) et se dépose dans `#model-cta-slot`
 * (bande verte du CTA final), au rythme du défilement.
 *
 * Position en `fixed`, interpolée en coordonnées document (scroll-safe,
 * responsive : ancres mesurées en direct), puis LISSÉE par un lerp continu
 * (rAF) → mouvement ultra fluide. Dip de taille + fondu en milieu de course.
 * Desktop large uniquement (≥ 1280px) + respect de reduced-motion.
 * `pointer-events: none` : n'intercepte jamais les clics.
 */
export default function ModelJourney() {
    const [enabled, setEnabled] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const cur = useRef({ x: 0, y: 0, s: 1, o: 1 });
    const started = useRef(false);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1280px)");
        const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setEnabled(mq.matches && !rm.matches);
        update();
        mq.addEventListener("change", update);
        rm.addEventListener("change", update);
        return () => { mq.removeEventListener("change", update); rm.removeEventListener("change", update); };
    }, []);

    const target = () => {
        const hero = document.getElementById("model-hero-slot");
        const cta = document.getElementById("model-cta-slot");
        if (!hero || !cta) return null;
        const sY = window.scrollY;
        const vh = window.innerHeight;
        const h = hero.getBoundingClientRect();
        const c = cta.getBoundingClientRect();
        const hCX = h.left + h.width / 2;
        const cCX = c.left + c.width / 2;
        const hCYdoc = h.top + sY + h.height / 2;
        const cCYdoc = c.top + sY + c.height / 2;
        const sStart = hCYdoc - vh / 2;
        const sEnd = cCYdoc - vh / 2;
        let p = sEnd > sStart ? (sY - sStart) / (sEnd - sStart) : 0;
        p = Math.max(0, Math.min(1, p));
        const e = p * p * (3 - 2 * p); // smoothstep
        const ends = Math.abs(2 * e - 1);
        return {
            x: hCX + (cCX - hCX) * e,
            y: (hCYdoc + (cCYdoc - hCYdoc) * e) - sY,
            s: 0.66 + 0.34 * ends,
            o: 0.55 + 0.45 * ends,
        };
    };

    const apply = () => {
        const box = boxRef.current;
        if (!box) return;
        const t = target();
        if (!t) return;
        const c = cur.current;
        if (!started.current) { c.x = t.x; c.y = t.y; c.s = t.s; c.o = t.o; started.current = true; }
        else {
            const k = 0.14; // lissage (plus petit = plus doux)
            c.x += (t.x - c.x) * k;
            c.y += (t.y - c.y) * k;
            c.s += (t.s - c.s) * k;
            c.o += (t.o - c.o) * k;
        }
        box.style.transform = `translate(${c.x - W / 2}px, ${c.y - H / 2}px) scale(${c.s})`;
        box.style.opacity = String(c.o);
    };

    useLayoutEffect(() => { if (enabled) { started.current = false; apply(); } });

    useEffect(() => {
        if (!enabled) return;
        let raf = 0;
        const loop = () => { apply(); raf = requestAnimationFrame(loop); };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [enabled]);

    if (!enabled) return null;

    return (
        <div
            ref={boxRef}
            aria-hidden="true"
            style={{ position: "fixed", top: 0, left: 0, width: W, height: H, transformOrigin: "center center", pointerEvents: "none", zIndex: 20, willChange: "transform, opacity" }}
        >
            <BuildingModel3D className="h-full w-full" />
        </div>
    );
}
