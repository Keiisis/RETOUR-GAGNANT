'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Envelope as Mail, MapPin, Phone, PaperPlaneTilt as Send, CheckCircle, CaretRight as ChevronRight, Clock } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { COMPANY_INFO } from "@/lib/constants/company-info";
import { useTranslation, T } from '@/lib/translation';
import ConsentCheckbox from '@/components/shared/ConsentCheckbox';

export default function ContactPage() {
    const { t } = useTranslation();
    const [form, setForm] = useState({ nom: '', prenom: '', email: '', sujet: '', message: '' });
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');

        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                setStatus('success');
                setForm({ nom: '', prenom: '', email: '', sujet: '', message: '' });
            } else {
                setStatus('error');
            }
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-white text-slate-900">
            {/* Hero — clair, charte Bénin, Playfair */}
            <section className="relative overflow-hidden">
                <div className="absolute -inset-x-8 -top-24 h-[130%] bg-[radial-gradient(55%_55%_at_12%_0%,rgba(0,135,81,0.16),transparent),radial-gradient(42%_45%_at_92%_2%,rgba(252,209,22,0.16),transparent),linear-gradient(180deg,#FBFDFC,#FFFFFF)]" />
                <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-24 md:pt-28 pb-10 text-center">
                    <nav className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400 mb-6">
                        <Link href="/" className="hover:text-[#008751]"><T>Accueil</T></Link><ChevronRight size={13} />
                        <span className="text-slate-600 font-medium"><T>Contact</T></span>
                    </nav>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E6F3ED] text-[#00643C] text-[11px] font-black uppercase tracking-[0.15em] mb-5"><Mail size={13} weight="fill" /> <T>Contact</T></span>
                        <h1 className="font-display text-4xl md:text-[3.4rem] font-bold leading-[1.05] tracking-[-0.02em]">
                            <span className="bg-gradient-to-br from-[#008751] via-[#0a7d52] to-[#00643C] bg-clip-text text-transparent"><T>Contactez-nous</T></span>
                        </h1>
                        <p className="mt-4 text-[17px] text-slate-600 max-w-xl mx-auto"><T>Une question ? Un projet ? Notre équipe est à votre écoute — réponse sous 24 h.</T></p>
                        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-[#008751]" /> <T>Réponse sous 24 h</T></span>
                            <span className="inline-flex items-center gap-1.5"><Phone size={15} className="text-[#008751]" /> <T>WhatsApp disponible</T></span>
                        </div>
                    </motion.div>
                </div>
            </section>

            <div className="container mx-auto px-4 py-8 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
                    {/* Contact Info */}
                    <div className="flex flex-col gap-5">
                        {/* Adresse */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}>
                            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                                <CardContent className="p-5 flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#00875115]">
                                        <MapPin className="text-[#008751]" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[#1a2332] mb-1.5 text-sm"><T>Nos Bureaux</T></h3>
                                        <p className="text-gray-500 text-sm leading-relaxed">{COMPANY_INFO.address}</p>
                                        <p className="text-gray-500 text-sm"><T>République du Bénin</T></p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Téléphones */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                                <CardContent className="p-5 flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#FCD11615]">
                                        <Phone className="text-[#c9a800]" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-[#1a2332] mb-2 text-sm"><T>Téléphone / WhatsApp</T></h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <a
                                                href={COMPANY_INFO.whatsappLink}
                                                target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#008751]/8 hover:bg-[#008751]/15 transition-colors group"
                                            >
                                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#008751] transition-colors">{COMPANY_INFO.phoneDisplay}</span>
                                            </a>
                                            <a
                                                href={COMPANY_INFO.whatsapp2Link}
                                                target="_blank" rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#008751]/8 hover:bg-[#008751]/15 transition-colors group"
                                            >
                                                <span className="text-sm font-medium text-gray-700 group-hover:text-[#008751] transition-colors">{COMPANY_INFO.phone2Display}</span>
                                            </a>
                                        </div>
                                        <p className="text-gray-400 text-xs mt-2 leading-snug">{COMPANY_INFO.hours.split('\n').map((line, i) => <span key={i} className="block">{line}</span>)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Email */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.open(`mailto:${COMPANY_INFO.email}`, '_blank')}>
                                <CardContent className="p-5 flex items-start gap-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#E8112D15]">
                                        <Mail className="text-[#E8112D]" size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[#1a2332] mb-1.5 text-sm"><T>Email</T></h3>
                                        <p className="text-gray-500 text-sm break-all">{COMPANY_INFO.email}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="border border-slate-200 shadow-[0_28px_64px_-28px_rgba(15,23,42,0.35)] rounded-3xl overflow-hidden">
                            <div className="h-1.5 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                            <CardHeader>
                                <CardTitle className="font-display text-2xl"><T>Envoyez-nous un message</T></CardTitle>
                            </CardHeader>
                            <CardContent>
                                <AnimatePresence mode="wait">
                                    {status === 'success' ? (
                                        <motion.div
                                            key="success"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center py-12 space-y-4"
                                        >
                                            <CheckCircle className="mx-auto text-[#008751]" size={48} />
                                            <h3 className="text-xl font-bold text-[#1a2332]"><T>Message envoyé !</T></h3>
                                            <p className="text-gray-500"><T>Nous vous répondrons sous 24h.</T></p>
                                            <Button onClick={() => setStatus('idle')} variant="outline" className="mt-4">
                                                <T>Envoyer un autre message</T>
                                            </Button>
                                        </motion.div>
                                    ) : (
                                        <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700"><T>Nom</T> *</label>
                                                    <input
                                                        type="text" required
                                                        value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                        placeholder={t("Votre nom")}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700"><T>Prénom</T></label>
                                                    <input
                                                        type="text"
                                                        value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))}
                                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                        placeholder={t("Votre prénom")}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700"><T>Email</T> *</label>
                                                <input
                                                    type="email" required
                                                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                    placeholder={t("email@exemple.com")}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700"><T>Sujet</T></label>
                                                <input
                                                    type="text"
                                                    value={form.sujet} onChange={e => setForm(p => ({ ...p, sujet: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                    placeholder={t("Sujet de votre message")}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700"><T>Message</T> *</label>
                                                <textarea
                                                    required rows={5}
                                                    value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all resize-none"
                                                    placeholder={t("Votre message...")}
                                                />
                                            </div>

                                            {status === 'error' && (
                                                <p className="text-[#E8112D] text-sm"><T>Une erreur est survenue. Réessayez.</T></p>
                                            )}

                                            <ConsentCheckbox id="contact-consent" purpose="afin de répondre à votre demande de contact" />

                                            <Button
                                                type="submit"
                                                disabled={status === 'loading'}
                                                className="w-full bg-[#008751] hover:bg-[#006B40] text-white font-bold h-12 rounded-xl"
                                            >
                                                {status === 'loading' ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        <T>Envoi en cours...</T>
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Send size={18} /> <T>Envoyer</T>
                                                    </span>
                                                )}
                                            </Button>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Google Maps */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 max-w-5xl mx-auto"
                >
                    <Card className="border-0 shadow-lg overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                        <CardContent className="p-0">
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.0!2d2.4183!3d6.3703!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sCotonou%2C+B%C3%A9nin!5e0!3m2!1sfr!2sbj!4v1"
                                width="100%"
                                height="350"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title={t("Localisation Retour Gagnant Bénin")}
                                className="w-full"
                            />
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
