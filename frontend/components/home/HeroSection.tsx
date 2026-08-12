"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useTranslation, T } from "@/lib/translation";
import { supabase } from "@/lib/supabase";

/**
 * Hero : vidéo plein écran (direction d'origine conservée). Seule la
 * typographie évolue : titre en Fraunces, corps en Geist. Titre/sous-titre/
 * vidéo restent éditables via `settings` (Supabase).
 */
export default function HeroSection() {
    const { t, lang } = useTranslation();
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [content, setContent] = useState({
        title: "VOTRE RETOUR GAGNANT",
        subtitle: "Réalisez vos ambitions au cœur du Bénin : là où vos racines deviennent des héritages d'exception.",
        video: "/videos/hero.mp4",
    });
    const videoRef = useRef<HTMLVideoElement>(null);

    const SLOGAN_VALS: Record<string, string> = {
        en: "YOUR WINNING RETURN",
        es: "SU REGRESO GANADOR",
        pt: "SEU RETORNO VENCEDOR",
        cr: "RETOU GAYAN ZÒT",
        ht: "RETOU GAYAN OU",
        fr: "VOTRE RETOUR GAGNANT",
    };

    useEffect(() => {
        const fetchHeroContent = async () => {
            try {
                const { data, error } = await supabase
                    .from("settings")
                    .select("key, value")
                    .or("key.eq.frontend_hero_title,key.eq.frontend_hero_subtitle,key.eq.frontend_hero_video");
                if (data && !error) {
                    setContent((prev) => {
                        const next = { ...prev };
                        data.forEach((item) => {
                            if (item.key === "frontend_hero_title") next.title = item.value;
                            if (item.key === "frontend_hero_subtitle") next.subtitle = item.value;
                            if (item.key === "frontend_hero_video") next.video = item.value;
                        });
                        return next;
                    });
                }
            } catch (err) {
                console.error("Error fetching hero content:", err);
            }
        };
        fetchHeroContent();
        const channel = supabase
            .channel("hero_settings_changes")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, fetchHeroContent)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const handleReady = () => setIsVideoLoaded(true);
        video.addEventListener("loadeddata", handleReady);
        video.addEventListener("canplay", handleReady);
        video.addEventListener("playing", handleReady);
        if (video.readyState >= 2) handleReady();
        const timeout = setTimeout(() => setIsVideoLoaded(true), 2000);
        return () => {
            video.removeEventListener("loadeddata", handleReady);
            video.removeEventListener("canplay", handleReady);
            video.removeEventListener("playing", handleReady);
            clearTimeout(timeout);
        };
    }, [content.video]);

    const renderTitle = (title: string) => {
        let translated = t(title);
        const isMainSlogan =
            title.toUpperCase().includes("VOTRE RETOUR GAGNANT") ||
            translated.toUpperCase() === "VOTRE RETOUR GAGNANT";
        if (isMainSlogan) {
            translated = SLOGAN_VALS[lang] || translated;
            const words = translated.split(" ");
            return (
                <>
                    {words.map((word, i) => {
                        let className = "text-white/90";
                        if (i === 0) className = "text-[#008751]";
                        else if (i === 1) className = "text-[#FCD116] drop-shadow-[0_0_30px_rgba(252,209,22,0.4)] italic";
                        else if (i === 2) className = "text-[#E8112D]";
                        return (
                            <span key={i} className={className}>
                                {word}
                                {i < words.length - 1 ? " " : ""}
                            </span>
                        );
                    })}
                </>
            );
        }
        return <>{translated}</>;
    };

    return (
        <section className="relative -mt-20 flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0a1628]">
            {/* Vidéo plein écran */}
            <div key={content.video} className={`absolute inset-0 z-[1] transition-all duration-[2000ms] ease-out will-change-[opacity] ${isVideoLoaded ? "scale-100 opacity-100" : "scale-105 opacity-0"}`}>
                <video ref={videoRef} autoPlay loop muted playsInline preload="none" poster="/images/hero-bg.jpg" className="h-full w-full object-cover">
                    <source src={content.video} type="video/mp4" />
                </video>
            </div>

            {/* Repli statique */}
            <div className={`absolute inset-0 z-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center transition-opacity duration-1000 ${isVideoLoaded ? "opacity-0" : "opacity-100"}`} />

            {/* Voiles cinématiques */}
            <div className="pointer-events-none absolute inset-0 z-[2]">
                <div className="absolute inset-0 bg-gradient-to-t from-[#008751]/80 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.5)_100%)]" />
            </div>

            {/* Particules */}
            <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
                <div className="animate-spin-slow absolute -top-1/2 -right-1/2 h-full w-full rounded-full bg-[#FCD116]/5 blur-[120px]" />
                <div className="animate-float absolute left-[15%] top-[20%] h-2 w-2 rounded-full bg-[#FCD116] opacity-40" />
                <div className="animate-float-delayed absolute right-[20%] top-[70%] h-3 w-3 rounded-full bg-[#E8112D] opacity-30" />
                <div className="animate-float absolute left-[70%] top-[40%] h-1.5 w-1.5 rounded-full bg-white opacity-50" />
                <div className="animate-float-delayed absolute left-[30%] top-[60%] h-2 w-2 rounded-full bg-[#008751] opacity-35" />
            </div>

            {/* Contenu */}
            <div className="container relative z-10 px-4 text-center">
                <h1 className="animate-in zoom-in-95 mb-6 font-fraunces text-5xl font-semibold leading-[1.02] tracking-[-0.02em] drop-shadow-2xl duration-1000 sm:text-6xl md:mb-8 md:text-7xl lg:text-8xl">
                    {renderTitle(content.title)}
                </h1>

                <p className="animate-in fade-in mx-auto mb-8 max-w-2xl font-geist text-base leading-relaxed text-white/85 duration-1000 md:text-lg">
                    {t(content.subtitle)}
                </p>

                <div className="animate-in fade-in slide-in-from-bottom-10 mx-auto flex w-full max-w-4xl flex-col flex-wrap items-center justify-center gap-4 delay-700 duration-1000 md:flex-row">
                    <Link href="/nationalite">
                        <Button size="lg" className="h-14 w-full rounded-full bg-[#008751] px-8 font-geist text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,135,81,0.4)] transition-all duration-300 hover:scale-105 hover:bg-[#006e42] md:h-16 md:w-auto md:text-lg">
                            <T>Obtenez la nationalité Béninoise</T>
                        </Button>
                    </Link>
                    <Link href="/services/culture">
                        <Button size="lg" className="h-14 w-full rounded-full border border-yellow-400/50 bg-[#FCD116] px-8 font-geist text-base font-bold text-[#0d1a12] shadow-[0_8px_32px_rgba(252,209,22,0.4)] transition-all duration-300 hover:scale-105 hover:bg-[#e5bc14] md:h-16 md:w-auto md:text-lg">
                            <T>Visitez le Bénin</T>
                        </Button>
                    </Link>
                    <Link href="/services/investissement">
                        <Button size="lg" className="h-14 w-full rounded-full bg-[#E8112D] px-8 font-geist text-base font-semibold text-white shadow-[0_8px_32px_rgba(232,17,45,0.4)] transition-all duration-300 hover:scale-105 hover:bg-[#c40e25] md:h-16 md:w-auto md:text-lg">
                            <T>Investir &amp; S&apos;installer au Bénin</T>
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Indicateur de défilement */}
            <div className="animate-bounce absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
                <span className="font-geistmono text-xs uppercase tracking-widest text-white/50"><T>Défiler</T></span>
                <div className="h-10 w-px bg-gradient-to-b from-white/60 to-transparent" />
            </div>

            <style jsx>{`
                @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    25% { transform: translateY(-20px) translateX(10px); }
                    50% { transform: translateY(-10px) translateX(-5px); }
                    75% { transform: translateY(-25px) translateX(15px); }
                }
                @keyframes float-delayed {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    25% { transform: translateY(15px) translateX(-10px); }
                    50% { transform: translateY(-15px) translateX(8px); }
                    75% { transform: translateY(10px) translateX(-12px); }
                }
                .animate-spin-slow { animation: spin-slow 60s linear infinite; }
                .animate-float { animation: float 8s ease-in-out infinite; }
                .animate-float-delayed { animation: float-delayed 10s ease-in-out infinite; }
            `}</style>
        </section>
    );
}
