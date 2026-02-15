'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, MapPin, Phone, Send, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { COMPANY_INFO } from "@/lib/constants/company-info";

export default function ContactPage() {
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
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="py-12 md:py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white">
                <div className="container mx-auto px-4 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-[#FCD116] text-sm font-semibold tracking-widest uppercase mb-4 md:mb-6 border border-white/10">
                            Contact
                        </span>
                        <h1 className="text-3xl md:text-5xl font-bold font-heading mb-4">Contactez-nous</h1>
                        <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto">
                            Une question ? Un projet ? Notre équipe est à votre écoute.
                        </p>
                    </motion.div>
                </div>
            </section>

            <div className="container mx-auto px-4 py-8 md:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        {[
                            { icon: MapPin, title: "Nos Bureaux", content: `${COMPANY_INFO.address}\nRépublique du Bénin`, color: "#008751" },
                            { icon: Phone, title: "Téléphone / WhatsApp", content: `${COMPANY_INFO.phoneDisplay}\n${COMPANY_INFO.hours}`, color: "#FCD116", link: COMPANY_INFO.whatsappLink },
                            { icon: Mail, title: "Email", content: COMPANY_INFO.email, color: "#E8112D", link: `mailto:${COMPANY_INFO.email}` },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className={`border-0 shadow-md hover:shadow-lg transition-shadow ${item.link ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={() => item.link && window.open(item.link, '_blank')}>
                                    <CardContent className="p-6 flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${item.color}15` }}>
                                            <item.icon style={{ color: item.color }} size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-[#1a2332] mb-1">{item.title}</h3>
                                            {item.content.split('\n').map((line, j) => (
                                                <p key={j} className="text-gray-500 text-sm">{line}</p>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Card className="border-0 shadow-xl overflow-hidden">
                            <div className="h-1.5 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                            <CardHeader>
                                <CardTitle className="text-xl">Envoyez-nous un message</CardTitle>
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
                                            <h3 className="text-xl font-bold text-[#1a2332]">Message envoyé !</h3>
                                            <p className="text-gray-500">Nous vous répondrons sous 24h.</p>
                                            <Button onClick={() => setStatus('idle')} variant="outline" className="mt-4">
                                                Envoyer un autre message
                                            </Button>
                                        </motion.div>
                                    ) : (
                                        <motion.form key="form" onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700">Nom *</label>
                                                    <input
                                                        type="text" required
                                                        value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                        placeholder="Votre nom"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-gray-700">Prénom</label>
                                                    <input
                                                        type="text"
                                                        value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))}
                                                        className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                        placeholder="Votre prénom"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Email *</label>
                                                <input
                                                    type="email" required
                                                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                    placeholder="email@exemple.com"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Sujet</label>
                                                <input
                                                    type="text"
                                                    value={form.sujet} onChange={e => setForm(p => ({ ...p, sujet: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all"
                                                    placeholder="Sujet de votre message"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Message *</label>
                                                <textarea
                                                    required rows={5}
                                                    value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                                                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#008751] focus:border-transparent outline-none transition-all resize-none"
                                                    placeholder="Votre message..."
                                                />
                                            </div>

                                            {status === 'error' && (
                                                <p className="text-[#E8112D] text-sm">Une erreur est survenue. Réessayez.</p>
                                            )}

                                            <Button
                                                type="submit"
                                                disabled={status === 'loading'}
                                                className="w-full bg-[#008751] hover:bg-[#006B40] text-white font-bold h-12 rounded-xl"
                                            >
                                                {status === 'loading' ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Envoi en cours...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Send size={18} /> Envoyer
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
            </div>
        </div>
    );
}
