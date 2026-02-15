'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const isHomePage = pathname === '/';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Accueil', href: '/' },
        { name: 'Services', href: '/services' },
        { name: 'A Propos', href: '/a-propos' },
        { name: 'Contact', href: '/contact' },
    ];

    return (
        <>
            {/* Header - NEVER white. Always dark transparent or dark solid */}
            <header
                className={cn(
                    "fixed top-0 left-0 w-full z-50 transition-all duration-300",
                    isScrolled
                        ? "bg-[#0f141e]/95 backdrop-blur-md shadow-lg py-2 border-b border-[#FCD116]/20"
                        : "bg-transparent py-4"
                )}
            >
                <div className="container mx-auto px-4 flex justify-between items-center max-w-7xl">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative w-12 h-12 overflow-hidden rounded-full border-2 border-[#FCD116] shadow-[0_0_15px_rgba(252,209,22,0.3)] bg-white">
                            <Image
                                src="/images/logo.jpg"
                                alt="Retour Gagnant Logo"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-heading font-bold text-xl tracking-tight text-[#008751]">
                                RETOUR <span className="text-[#E8112D]">GAGNANT</span>
                            </span>
                            <span className="text-[10px] font-light tracking-[0.2em] uppercase font-sans text-white/70">
                                BENIN
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-sm font-medium text-white/90 hover:text-[#FCD116] transition-colors relative group font-sans tracking-wide"
                            >
                                {link.name}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#FCD116] transition-all group-hover:w-full" />
                            </Link>
                        ))}
                        <Link href="/rendez-vous">
                            <Button className="font-semibold rounded-full px-6 shadow-lg transition-all transform hover:-translate-y-0.5 bg-[#FCD116] text-[#0f141e] hover:bg-[#008751] hover:text-white">
                                Rendez-vous
                            </Button>
                        </Link>
                    </nav>

                    {/* Mobile Toggle */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ?
                            <X size={28} className="text-white" /> :
                            <Menu size={28} className="text-white" />
                        }
                    </button>
                </div>
            </header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="fixed top-[72px] left-0 w-full h-[calc(100vh-72px)] bg-[#0f141e]/95 backdrop-blur-xl z-40 border-t border-[#FCD116]/20 shadow-xl md:hidden overflow-y-auto"
                    >
                        <nav className="flex flex-col p-6 gap-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}

                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-xl font-bold text-white/90 py-4 border-b border-white/5 hover:text-[#FCD116] hover:pl-4 transition-all"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <Link href="/rendez-vous" onClick={() => setIsMobileMenuOpen(false)} className="mt-6">
                                <Button className="w-full py-6 text-lg font-bold bg-[#008751] text-white hover:bg-[#E8112D] rounded-xl shadow-lg transform transition-transform active:scale-95">Prendre Rendez-vous</Button>
                            </Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
