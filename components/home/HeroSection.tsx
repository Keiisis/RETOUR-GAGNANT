"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function HeroSection() {
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Multiple ways to detect that the video is ready/playing
        const handleReady = () => setIsVideoLoaded(true);

        video.addEventListener('loadeddata', handleReady);
        video.addEventListener('canplay', handleReady);
        video.addEventListener('playing', handleReady);

        // If already loaded (cached), trigger immediately
        if (video.readyState >= 2) {
            handleReady();
        }

        // Fallback: after 2 seconds, show video area regardless
        const timeout = setTimeout(() => setIsVideoLoaded(true), 2000);

        return () => {
            video.removeEventListener('loadeddata', handleReady);
            video.removeEventListener('canplay', handleReady);
            video.removeEventListener('playing', handleReady);
            clearTimeout(timeout);
        };
    }, []);

    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a1628] -mt-20">
            {/* === LAYER 1: Video Background (Full Screen) === */}
            <div className={`absolute inset-0 z-[1] transition-all duration-[2000ms] ease-out will-change-opacity ${isVideoLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}>
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster="/images/hero-bg.jpg"
                    className="w-full h-full object-cover"
                >
                    <source src="/videos/hero.mp4" type="video/mp4" />
                </video>
            </div>

            {/* === LAYER 0: Static Fallback (BELOW video) === */}
            <div
                className={`absolute inset-0 z-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center transition-opacity duration-1000 ${isVideoLoaded ? 'opacity-0' : 'opacity-100'}`}
            />

            {/* === LAYER 3: Cinematic Gradient Overlays === */}
            <div className="absolute inset-0 z-[2] pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-[#008751]/80 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.5)_100%)]" />
            </div>

            {/* === LAYER 4: Animated Light Effects === */}
            <div className="absolute inset-0 z-[3] overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-[#FCD116]/5 rounded-full blur-[120px] animate-spin-slow" />
                <div className="absolute w-2 h-2 bg-[#FCD116] rounded-full top-[20%] left-[15%] animate-float opacity-40" />
                <div className="absolute w-3 h-3 bg-[#E8112D] rounded-full top-[70%] right-[20%] animate-float-delayed opacity-30" />
                <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[40%] left-[70%] animate-float opacity-50" />
                <div className="absolute w-2 h-2 bg-[#008751] rounded-full top-[60%] left-[30%] animate-float-delayed opacity-35" />
            </div>

            {/* === LAYER 5: Content === */}
            <div className="container relative z-10 px-4 text-center">
                <div className="inline-block mb-6 px-5 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-lg animate-in fade-in slide-in-from-top-10 duration-1000">
                    <span className="text-sm font-semibold text-[#FCD116] tracking-[0.25em] uppercase">
                        Excellence & Tradition
                    </span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold font-heading leading-[1.1] mb-6 md:mb-8 text-white drop-shadow-2xl animate-in zoom-in-95 duration-1000 delay-200">
                    Votre Retour <br />
                    <span className="text-[#FCD116] drop-shadow-[0_4px_30px_rgba(252,209,22,0.4)]">Gagnant</span>
                </h1>

                <p className="text-xl md:text-2xl text-white/85 font-medium max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-500">
                    L'alliance parfaite entre modernisation et héritage culturel pour votre installation au Bénin.
                </p>

                <div className="flex flex-col md:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-700 w-full max-w-4xl mx-auto flex-wrap">
                    <Link href="/services/passeport">
                        <Button size="lg" className="bg-[#008751] text-white hover:bg-[#006e42] text-base md:text-lg px-8 h-14 md:h-16 rounded-full shadow-[0_8px_32px_rgba(0,135,81,0.4)] hover:shadow-lg hover:scale-105 transition-all duration-300 w-full md:w-auto">
                            Obtenir la Nationalité
                        </Button>
                    </Link>
                    <Link href="/services/investissement">
                        <Button size="lg" className="bg-[#FCD116] text-[#1a2332] hover:bg-[#e5bc14] text-base md:text-lg px-8 h-14 md:h-16 rounded-full shadow-[0_8px_32px_rgba(252,209,22,0.4)] hover:shadow-lg hover:scale-105 transition-all duration-300 font-bold w-full md:w-auto border border-yellow-400/50">
                            Investir au Bénin
                        </Button>
                    </Link>
                    <Link href="/services/logement">
                        <Button size="lg" className="bg-[#E8112D] text-white hover:bg-[#c40e25] text-base md:text-lg px-8 h-14 md:h-16 rounded-full shadow-[0_8px_32px_rgba(232,17,45,0.4)] hover:shadow-lg hover:scale-105 transition-all duration-300 w-full md:w-auto">
                            Visiter & S'installer
                        </Button>
                    </Link>
                </div>
            </div>

            {/* === Scroll Indicator === */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 animate-bounce">
                <span className="text-white/50 text-xs uppercase tracking-widest">Défiler</span>
                <div className="w-[1px] h-10 bg-gradient-to-b from-white/60 to-transparent" />
            </div>

            {/* === Custom Animations === */}
            <style jsx>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
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
