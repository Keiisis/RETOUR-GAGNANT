import Link from "next/link";
import Image from "next/image";
import { FacebookLogo, InstagramLogo, LinkedinLogo, XLogo, Envelope, Phone, MapPin } from "@phosphor-icons/react";
import { COMPANY_INFO } from "@/lib/constants/company-info";
import { useTranslation, T } from "@/lib/translation";
import NewsletterCapture from "@/components/shared/NewsletterCapture";

// Motif traditionnel bespoke (losanges kente/bogolan) : data URI.
const MOTIF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='none' stroke='%23FCD116' stroke-width='1.2' opacity='0.7'%3E%3Cpath d='M28 3 L53 28 L28 53 L3 28 Z'/%3E%3Cpath d='M28 17 L39 28 L28 39 L17 28 Z' fill='%23FCD116' stroke='none' opacity='0.5'/%3E%3C/g%3E%3C/svg%3E";

export default function Footer() {
    const { t } = useTranslation();
    return (
        <footer className="bg-[#0f141e] text-white pt-20 pb-10 relative overflow-hidden">
            {/* Décor : motif traditionnel + halo + filigrane */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.045]" style={{ backgroundImage: `url("${MOTIF}")`, backgroundSize: "52px 52px" }} />
            <div aria-hidden className="pointer-events-none absolute -left-24 top-6 h-80 w-80 rounded-full bg-[#008751]/15 blur-[130px]" />
            <div aria-hidden className="pointer-events-none absolute right-4 -bottom-8 select-none font-fraunces text-[20vw] font-semibold leading-none text-white/[0.02] md:text-[15vw]">Bénin</div>
            {/* Filet tricolore (segmenté, pas de dégradé) */}
            <div className="absolute top-0 left-0 flex h-1 w-full">
                <span className="flex-[46] bg-[#008751]" />
                <span className="flex-[27] bg-[#FCD116]" />
                <span className="flex-[27] bg-[#E8112D]" />
            </div>

            <div className="container mx-auto px-6 md:px-4 relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <Link prefetch={false} href="/" className="flex items-center gap-3">
                            <div className="relative w-16 h-16 overflow-hidden rounded-full border-2 border-[#FCD116] shadow-[0_0_20px_rgba(252,209,22,0.2)] bg-white">
                                <Image
                                    src="/images/logo.jpg"
                                    alt={t("Retour Gagnant Logo")}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-heading font-bold text-2xl group-hover:text-white transition-colors duration-500">
                                    <span className="text-[#008751]">RETOUR</span> <span className="text-[#E8112D]">GAGNANT</span>
                                </span>
                                <span className="text-base font-extrabold tracking-[0.5em] text-white/70 uppercase">
                                    <T>BÉNIN</T>
                                </span>
                            </div>
                        </Link>
                        <p className="text-gray-400 leading-relaxed text-sm">
                            <T>Votre partenaire de confiance pour un retour réussi et des investissements sécurisés au Bénin. Tradition, Modernité, Et Excellence.</T>
                        </p>
                        <div className="pt-1"><NewsletterCapture /></div>
                        <div className="flex gap-4">
                            {[
                                { Icon: FacebookLogo, label: 'Facebook', href: COMPANY_INFO.socials.facebook },
                                { Icon: InstagramLogo, label: 'Instagram', href: COMPANY_INFO.socials.instagram },
                                { Icon: LinkedinLogo, label: 'LinkedIn', href: COMPANY_INFO.socials.linkedin },
                                { Icon: XLogo, label: 'X (Twitter)', href: COMPANY_INFO.socials.twitter },
                            ].map(({ Icon, label, href }) => (
                                <a key={label} href={href} aria-label={label} className="w-10 h-10 rounded-full bg-[#1a2332] flex items-center justify-center hover:bg-[#FCD116] hover:text-[#1a2332] hover:-translate-y-1 hover:shadow-[0_12px_26px_-8px_rgba(252,209,22,0.55)] transition-all duration-300 border border-white/5 group">
                                    <Icon size={18} className="group-hover:scale-110 transition-transform" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-xl font-semibold font-fraunces mb-6 text-[#FCD116]"><T>Navigation</T></h4>
                        <ul className="space-y-4 text-gray-300">
                            {[
                                { name: 'Accueil', href: '/' },
                                { name: 'Notre Histoire', href: '/notre-histoire' },
                                { name: 'Nos Services', href: '/services' },
                                { name: 'A Propos', href: '/a-propos' },
                                { name: 'Contact', href: '/contact' },
                                { name: 'Rendez-vous', href: '/rendez-vous' }
                            ].map((item) => (
                                <li key={t(item.name)}>
                                    <Link prefetch={false} href={item.href} className="hover:text-[#FCD116] transition-all duration-300 hover:translate-x-1 flex items-center gap-2 group">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FCD116] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {t(item.name)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Services */}
                    <div>
                        <h4 className="text-xl font-semibold font-fraunces mb-6 text-[#FCD116]"><T>Services Clés</T></h4>
                        <ul className="space-y-4 text-gray-300">
                            {[
                                { name: 'Obtention Passeport', href: '/services/passeport' },
                                { name: 'Achat Immobilier', href: '/services/logement' },
                                { name: 'Création Entreprise', href: '/services/business' },
                                { name: 'Tourisme & Culture', href: '/services/culture' },
                                { name: 'Suivi de Chantier', href: '/services/construction' }
                            ].map((item) => (
                                <li key={t(item.name)}>
                                    <Link prefetch={false} href={item.href} className="hover:text-[#FCD116] transition-all duration-300 hover:translate-x-1 flex items-center gap-2 group">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#008751] opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {t(item.name)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="text-xl font-semibold font-fraunces mb-6 text-[#FCD116]"><T>Contact</T></h4>

                        <ul className="space-y-6 text-gray-300">
                            <li className="flex gap-4 items-start">
                                <MapPin className="text-[#008751] mt-1 shrink-0" size={20} />
                                <span>{COMPANY_INFO.address.split(',').map((line, i) => <span key={i}>{line}<br /></span>)} <T>République du Bénin</T></span>
                            </li>
                            <li className="flex gap-4 items-start">
                                <Phone className="text-[#008751] shrink-0 mt-0.5" size={20} />
                                <div className="flex flex-col gap-1">
                                    <a href={COMPANY_INFO.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                        {COMPANY_INFO.phoneDisplay}
                                    </a>
                                    <a href={COMPANY_INFO.whatsapp2Link} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                                        {COMPANY_INFO.phone2Display}
                                    </a>
                                </div>
                            </li>
                            <li className="flex gap-4 items-center">
                                <Envelope className="text-[#008751] shrink-0" size={20} />
                                <a href={`mailto:${COMPANY_INFO.email}`} className="hover:text-white transition-colors">
                                    {COMPANY_INFO.email}
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
                    <p>© {new Date().getFullYear()} Retour Gagnant Bénin. <T>Tous droits réservés.</T></p>
                    <div className="flex gap-6 mt-4 md:mt-0">
                        <Link prefetch={false} href="/mentions-legales" className="hover:text-white transition-colors"><T>Mentions Légales</T></Link>
                        <Link prefetch={false} href="/confidentialite" className="hover:text-white transition-colors"><T>Confidentialité</T></Link>
                        <Link prefetch={false} href="/conditions-generales" className="hover:text-white transition-colors"><T>CGV</T></Link>
                        <Link prefetch={false} href="/faq" className="hover:text-white transition-colors"><T>FAQ</T></Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
