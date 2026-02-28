'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ClientBell from './ClientBell';
import { useCart } from '@/lib/store/cartStore';

export default function Header() {
    const { itemCount, openCart } = useCart();
    const navLinks = [
        { label: "Accueil", href: "/" },
        { label: "Blog", href: "/blog" },
        { label: "Contact", href: "/contact" },
        { label: "Notre Histoire", href: "/notre-histoire" },
        { label: "Boutique", href: "/boutique" },
    ];
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);


    return (
        <>
            {/* Header - Premium Ultra Max UI */}
            <header
                id="main-header"
                className={cn(
                    "fixed top-0 left-0 w-full z-50 transition-all duration-500",
                    isScrolled
                        ? "bg-[#05080a]/80 backdrop-blur-xl shadow-2xl py-3 border-b border-white/5"
                        : "bg-transparent py-6 lg:py-8"
                )}
            >
                <div className="container mx-auto px-4 sm:px-6 lg:px-12 flex justify-between items-center max-w-[1600px]">
                    {/* Logo Section */}
                    <Link href="/" className="flex items-center gap-4 group shrink-0">
                        <div className="relative w-14 h-14 xl:w-20 xl:h-20 overflow-hidden rounded-full border border-white/10 group-hover:border-[#FCD116]/50 transition-colors bg-white shadow-lg">
                            <Image
                                src="/images/logo.jpg"
                                alt="Retour Gagnant Logo"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="font-heading font-black text-2xl xl:text-3xl tracking-tighter text-[#008751] group-hover:text-white transition-colors duration-500">
                                RETOUR <span className="text-[#E8112D]">GAGNANT</span>
                            </span>
                            <span className="text-[10px] xl:text-[12px] font-bold tracking-[0.4em] uppercase font-sans text-white/50 group-hover:text-[#FCD116] transition-colors duration-500">
                                BENIN
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Nav - Centered Menu Pill */}
                    <nav className="hidden lg:flex flex-1 items-center justify-center px-4 xl:px-8">
                        <div className="flex items-center gap-6 xl:gap-8 bg-white/[0.02] border border-white/5 px-6 xl:px-8 py-3 rounded-full backdrop-blur-2xl shadow-2xl relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

                            {navLinks.map((link) => {
                                const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
                                return (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        className={cn(
                                            "text-[11px] xl:text-[13px] font-bold uppercase tracking-widest transition-colors duration-300 relative group font-sans whitespace-nowrap z-10",
                                            isActive ? "text-[#FCD116]" : "text-gray-400 hover:text-white"
                                        )}
                                    >
                                        {link.label}
                                        <motion.span
                                            className={cn(
                                                "absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#FCD116] shadow-[0_0_10px_rgba(252,209,22,0.8)]",
                                            )}
                                            initial={false}
                                            animate={{
                                                opacity: isActive ? 1 : 0,
                                                scale: isActive ? 1 : 0
                                            }}
                                        />
                                    </Link>
                                )
                            })}
                        </div>
                    </nav>

                    {/* User Area & Rendez-vous Button */}
                    <div className="hidden lg:flex items-center gap-6 shrink-0">
                        {/* Cart Button */}
                        <button
                            onClick={openCart}
                            className="relative p-2 text-white/70 hover:text-[#FCD116] transition-colors"
                        >
                            <ShoppingBag size={24} />
                            {itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-[#E8112D] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#05080a]">
                                    {itemCount}
                                </span>
                            )}
                        </button>

                        <ClientBell />

                        <Link href="/rendez-vous">
                            <Button className="font-black rounded-full px-6 xl:px-8 h-12 xl:h-14 text-[11px] xl:text-[13px] uppercase tracking-widest shadow-[0_0_20px_rgba(252,209,22,0.15)] transition-all duration-500 transform hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(252,209,22,0.4)] bg-[#FCD116] text-[#0f141e] border-none relative overflow-hidden group">
                                <span className="relative z-10">Rendez-vous</span>
                                <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out z-0" />
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Toggle and Cart */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button
                            onClick={openCart}
                            className="relative p-2 text-white/70 hover:text-[#FCD116] transition-colors shrink-0"
                            aria-label="Ouvrir le panier"
                        >
                            <ShoppingBag size={24} />
                            {itemCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-[#E8112D] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#05080a]">
                                    {itemCount}
                                </span>
                            )}
                        </button>

                        <button
                            className="p-2 sm:p-3 shrink-0 rounded-xl hover:bg-white/5 transition-colors"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Toggle Menu"
                        >
                            {isMobileMenuOpen ?
                                <X size={26} className="text-white" /> :
                                <Menu size={26} className="text-white" />
                            }
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="fixed inset-0 bg-[#05080a]/98 backdrop-blur-2xl z-[45] lg:hidden flex flex-col pt-24"
                    >
                        <nav className="flex-1 flex flex-col items-center justify-center gap-6 w-full px-8 pb-12 overflow-y-auto nexus-scrollbar">
                            {navLinks.map((link, idx) => (
                                <motion.div
                                    key={link.label}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 + 0.1 }}
                                    className="w-full"
                                >
                                    <Link
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={cn(
                                            "text-2xl font-bold transition-all w-full text-center block py-3 border-b border-white/5",
                                            pathname === link.href ? "text-[#FCD116]" : "text-white/70 hover:text-white"
                                        )}
                                    >
                                        {link.label}
                                    </Link>
                                </motion.div>
                            ))}
                            <motion.div
                                className="pt-6 w-full max-w-sm"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <Link href="/rendez-vous" onClick={() => setIsMobileMenuOpen(false)}>
                                    <Button className="w-full py-7 text-xl font-black bg-[#008751] text-white hover:bg-[#E8112D] rounded-2xl shadow-[0_0_20px_rgba(0,135,81,0.3)] border-none transform transition-all active:scale-95">
                                        RÉSERVER MON RETOUR
                                    </Button>
                                </Link>
                            </motion.div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
