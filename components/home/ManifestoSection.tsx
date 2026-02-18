"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function ManifestoSection() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // Parallax & Opacity transforms for each line
    const opacity1 = useTransform(scrollYProgress, [0.1, 0.3], [0, 1]);
    const x1 = useTransform(scrollYProgress, [0.1, 0.4], [-100, 0]);

    const opacity2 = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
    const x2 = useTransform(scrollYProgress, [0.3, 0.6], [100, 0]);

    const opacity3 = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
    const scale3 = useTransform(scrollYProgress, [0.5, 0.8], [0.8, 1]);

    const opacity4 = useTransform(scrollYProgress, [0.7, 0.9], [0, 1]);
    const y4 = useTransform(scrollYProgress, [0.7, 0.9], [50, 0]);

    return (
        <section ref={containerRef} className="relative bg-black py-40 overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#0a1628] to-black opacity-50" />
            <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

            <div className="container mx-auto px-4 relative z-10 flex flex-col items-center justify-center min-h-[80vh] text-center">

                {/* LINE 1 */}
                <motion.div
                    style={{ opacity: opacity1, x: x1 }}
                    className="mb-8 md:mb-12"
                >
                    <h2 className="text-4xl md:text-7xl font-bold font-heading text-white/40 uppercase tracking-tighter">
                        L'Afrique n'est pas <span className="text-white line-through decoration-[#E8112D] decoration-4">le passé</span>.
                    </h2>
                </motion.div>

                {/* LINE 2 */}
                <motion.div
                    style={{ opacity: opacity2, x: x2 }}
                    className="mb-8 md:mb-12"
                >
                    <h2 className="text-4xl md:text-7xl font-bold font-heading text-white uppercase tracking-tighter">
                        C'est le <span className="text-[#FCD116]">Nouveau Monde</span>.
                    </h2>
                </motion.div>

                {/* LINE 3 */}
                <motion.div
                    style={{ opacity: opacity3, scale: scale3 }}
                    className="mb-16 md:mb-24"
                >
                    <h2 className="text-5xl md:text-9xl font-extrabold font-heading text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] uppercase tracking-tighter drop-shadow-2xl">
                        VOTRE FUTUR.
                    </h2>
                </motion.div>

                {/* CALL TO ACTION */}
                <motion.div
                    style={{ opacity: opacity4, y: y4 }}
                    className="relative group cursor-pointer"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#008751] to-[#E8112D] rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />
                    <button className="relative px-12 py-6 bg-black rounded-full leading-none flex items-center divide-x divide-gray-600">
                        <span className="flex items-center space-x-5">
                            <span className="pr-6 text-gray-100 font-bold text-xl tracking-widest uppercase">Écrire l'Histoire</span>
                        </span>
                        <span className="pl-6 text-[#FCD116] group-hover:text-white transition duration-200 font-mono text-xl">
                            &rarr;
                        </span>
                    </button>
                </motion.div>

            </div>
        </section>
    );
}
