import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Linkedin, Twitter, Mail, Phone, MapPin } from "lucide-react";
import { COMPANY_INFO } from "@/lib/constants/company-info";

export default function Footer() {
    return (
        <footer className="bg-[#0f141e] text-white pt-20 pb-10 relative overflow-hidden">
            {/* Cultural Pattern Overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            {/* Flag Accent Top Border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]"></div>

            <div className="container mx-auto px-6 md:px-4 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="relative w-16 h-16 overflow-hidden rounded-full border-2 border-[#FCD116] shadow-[0_0_20px_rgba(252,209,22,0.2)] bg-white">
                                <Image
                                    src="/images/logo.jpg"
                                    alt="Retour Gagnant Logo"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-heading font-bold text-2xl text-[#008751]">
                                    RETOUR <span className="text-[#E8112D]">GAGNANT</span>
                                </span>
                                <span className="text-xs font-light tracking-[0.3em] text-gray-400 uppercase">
                                    BENIN
                                </span>
                            </div>
                        </Link>
                        <p className="text-gray-400 leading-relaxed text-sm">
                            Votre partenaire de confiance pour un retour réussi et des investissements sécurisés au Bénin. Tradition, Modernité, Et Excellence.
                        </p>
                        <div className="flex gap-4">
                            {[Facebook, Instagram, Linkedin, Twitter].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-full bg-[#1a2332] flex items-center justify-center hover:bg-[#FCD116] hover:text-[#1a2332] transition-all duration-300 border border-white/5 group">
                                    <Icon size={18} className="group-hover:scale-110 transition-transform" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-lg font-bold font-heading mb-6 text-[#FCD116]">Navigation</h4>
                        <ul className="space-y-4 text-gray-300">
                            {[
                                { name: 'Accueil', href: '/' },
                                { name: 'Nos Services', href: '/services' },
                                { name: 'A Propos', href: '/a-propos' },
                                { name: 'Contact', href: '/contact' },
                                { name: 'Rendez-vous', href: '/rendez-vous' }
                            ].map((item) => (
                                <li key={item.name}>
                                    <Link href={item.href} className="hover:text-[#FCD116] transition-colors flex items-center gap-2 group">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FCD116] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Services */}
                    <div>
                        <h4 className="text-lg font-bold font-heading mb-6 text-[#FCD116]">Services Clés</h4>
                        <ul className="space-y-4 text-gray-300">
                            {[
                                { name: 'Obtention Passeport', href: '/services/passeport-administratif' },
                                { name: 'Achat Immobilier', href: '/services/immobilier' },
                                { name: 'Création Entreprise', href: '/services/creation-entreprise' },
                                { name: 'Tourisme Mémoriel', href: '/services/tourisme' },
                                { name: 'Suivi Chantier', href: '/services/suivi-chantier' }
                            ].map((item) => (
                                <li key={item.name}>
                                    <Link href={item.href} className="hover:text-[#FCD116] transition-colors flex items-center gap-2 group">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#008751] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {item.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-lg font-bold font-heading mb-6 text-[#FCD116]">Contact</h4>

                        <ul className="space-y-6 text-gray-300">
                            <li className="flex gap-4 items-start">
                                <MapPin className="text-[#008751] mt-1 shrink-0" size={20} />
                                <span>{COMPANY_INFO.address.split(',').map((line, i) => <span key={i}>{line}<br /></span>)} République du Bénin</span>
                            </li>
                            <li className="flex gap-4 items-center">
                                <Phone className="text-[#008751] shrink-0" size={20} />
                                <a href={COMPANY_INFO.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                    {COMPANY_INFO.phoneDisplay}
                                </a>
                            </li>
                            <li className="flex gap-4 items-center">
                                <Mail className="text-[#008751] shrink-0" size={20} />
                                <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-white transition-colors">
                                    {COMPANY_INFO.email}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
                    <p>© 2025 Retour Gagnant Bénin. Tous droits réservés.</p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <Link href="/mentions-legales" className="hover:text-white transition-colors">Mentions Légales</Link>
                        <Link href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
