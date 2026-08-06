"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarBlank, ArrowRight, EnvelopeSimple, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { T } from "@/lib/translation";

/**
 * Section finale — fusion RDV (intention primaire, même libellé que le hero) +
 * inscription newsletter (intention distincte). Bloc vert (accent autorisé une
 * fois sur la page). Palette claire autour, jamais de fond noir.
 */
export default function FinalCta() {
    const reduce = useReducedMotion();
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

    const subscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setStatus("loading");
        try {
            const res = await fetch("/api/newsletter", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (res.ok) { setStatus("success"); setEmail(""); } else setStatus("error");
        } catch {
            setStatus("error");
        }
    };

    return (
        <section className="bg-[#FBFAF7] px-5 py-20 md:px-8 md:py-28">
            <motion.div
                initial={reduce ? false : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative mx-auto grid max-w-[1400px] grid-cols-1 gap-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#00532f] via-[#008751] to-[#0a7d52] p-8 md:p-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16"
            >
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#FCD116]/15 blur-3xl" />

                {/* RDV */}
                <div className="relative">
                    <h2 className="max-w-md font-fraunces text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white md:text-5xl">
                        <T>Prêt à écrire votre retour ?</T>
                    </h2>
                    <p className="mt-4 max-w-md font-geist text-lg leading-relaxed text-white/80">
                        <T>Quinze minutes suffisent pour transformer une idée en plan concret. Le premier échange est gratuit.</T>
                    </p>
                    <Link
                        href="/rendez-vous"
                        className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-4 font-geist text-[15px] font-semibold text-[#00532f] shadow-[0_16px_40px_-14px_rgba(0,0,0,0.4)] transition-all hover:bg-[#FCD116] hover:text-[#0d1a12] active:scale-[0.98]"
                    >
                        <CalendarBlank size={18} weight="bold" />
                        <T>Prendre rendez-vous</T>
                        <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>

                {/* Newsletter */}
                <div className="relative rounded-[1.4rem] border border-white/15 bg-white/10 p-7 backdrop-blur-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                        <EnvelopeSimple size={22} weight="bold" className="text-[#FCD116]" />
                    </div>
                    <h3 className="mt-4 font-fraunces text-xl font-semibold text-white">
                        <T>Restez informé</T>
                    </h3>
                    <p className="mt-1.5 font-geist text-sm leading-relaxed text-white/70">
                        <T>Guides, conseils et opportunités. Pas de spam, uniquement de l&apos;utile.</T>
                    </p>
                    {status === "success" ? (
                        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-white">
                            <CheckCircle size={20} weight="fill" className="text-[#FCD116]" />
                            <span className="font-geist text-sm font-medium"><T>Merci, vous êtes inscrit.</T></span>
                        </div>
                    ) : (
                        <form onSubmit={subscribe} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Votre adresse email"
                                className="w-full rounded-xl bg-white px-4 py-3 font-geist text-sm text-[#0d1a12] placeholder:text-[#9aa39c] focus:outline-none focus:ring-2 focus:ring-[#FCD116]"
                            />
                            <button
                                type="submit"
                                disabled={status === "loading"}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#FCD116] px-5 py-3 font-geist text-sm font-bold text-[#0d1a12] transition-colors hover:bg-[#e5bc00] disabled:opacity-70"
                            >
                                {status === "loading" ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <T>S&apos;inscrire</T>}
                            </button>
                        </form>
                    )}
                    {status === "error" && <p className="mt-2 font-geist text-xs text-[#FCD116]"><T>Une erreur est survenue. Réessayez.</T></p>}
                </div>
            </motion.div>
        </section>
    );
}
