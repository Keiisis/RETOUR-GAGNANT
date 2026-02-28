'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
    Globe2, FileCheck, Shield, Clock, ChevronDown, ChevronUp,
    ArrowRight, CheckCircle2, Users, Scale, Fingerprint, MapPin
} from 'lucide-react'

interface PageContent { section_key: string; content_fr: string }
interface FAQ { id: string; question_fr: string; answer_fr: string; sort_order: number }
interface RequiredDoc { id: string; label_fr: string; description_fr: string; doc_type: string }

export default function NationalitePage() {
    const [content, setContent] = useState<Record<string, string>>({})
    const [faqs, setFaqs] = useState<FAQ[]>([])
    const [docs, setDocs] = useState<RequiredDoc[]>([])
    const [openFaq, setOpenFaq] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            const [cRes, fRes, dRes] = await Promise.all([
                supabase.from('nationality_page_content').select('section_key, content_fr').eq('is_active', true),
                supabase.from('nationality_faq').select('*').eq('is_active', true).order('sort_order'),
                supabase.from('nationality_required_docs').select('*').eq('is_active', true).order('sort_order'),
            ])
            const map: Record<string, string> = {}
                ; (cRes.data || []).forEach((c: PageContent) => { map[c.section_key] = c.content_fr })
            // Fallbacks
            if (!map.hero_title) map.hero_title = 'Reconnaissance de Nationalité Béninoise'
            if (!map.hero_subtitle) map.hero_subtitle = 'Pour les Afro-Descendants'
            if (!map.price) map.price = '250'
            if (!map.processing_time) map.processing_time = '3 mois'
            setContent(map)
            setFaqs((fRes.data || []) as FAQ[])
            setDocs((dRes.data || []) as RequiredDoc[])
            setLoading(false)
        }
        load()
    }, [])

    const steps = [
        { icon: FileCheck, title: content.step_1_title || 'Inscription et dépôt', desc: content.step_1_desc || 'Remplissez le formulaire et soumettez vos documents.' },
        { icon: Shield, title: content.step_2_title || 'Examen du dossier', desc: content.step_2_desc || 'Vérification de l\'authenticité de vos documents.' },
        { icon: CheckCircle2, title: content.step_3_title || 'Décision', desc: content.step_3_desc || 'Réception de votre attestation d\'éligibilité.' },
    ]

    const docIcons: Record<string, any> = { identite: Fingerprint, domicile: MapPin, profession: Users, afro_descendance: Globe2, casier: Scale }

    if (loading) return <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>

    return (
        <div className="min-h-screen bg-[#0a0f14]">
            {/* ═══ HERO ═══ */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-[center_top_10%]" style={{ backgroundImage: `url('${content.form_bg_image || '/images/bg-nationalite-afro.jpg'}')` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/50 via-[#0a0f14]/30 to-[#0a0f14]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,135,81,0.15),transparent_70%)]" />

                {/* Decorative lines */}
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent" />
                <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-yellow-500/5 to-transparent" />

                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2 mb-8">
                        <Globe2 size={14} className="text-emerald-400" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/60">Loi N° 2024-31</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white leading-[0.95] mb-4">
                        {content.hero_title}
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">
                            {content.hero_subtitle}
                        </span>
                    </h1>

                    <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        {content.hero_description || 'Reconnectez-vous à vos racines. Acquérez la nationalité béninoise grâce à un processus officiel, encadré et sécurisé.'}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <Link href="/nationalite/formulaire" className="group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-4 rounded-2xl transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center gap-3">
                            Soumettre ma demande <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
                            <span className="text-3xl font-black text-[#FCD116]">{content.price} $</span>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Frais de traitement</p>
                                <p className="text-[10px] text-gray-600 flex items-center gap-1"><Clock size={10} /> {content.processing_time}</p>
                            </div>
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        {['Processus officiel', 'Données sécurisées', 'Accompagnement expert'].map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                <CheckCircle2 size={12} className="text-emerald-500/60" /> {t}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ═══ PROCESS STEPS ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.4em]">Comment ça marche</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mt-3">Le Processus en 3 Étapes</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                                className="relative group">
                                <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 hover:border-emerald-500/20 transition-all h-full">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <s.icon size={24} className="text-emerald-400" />
                                    </div>
                                    <div className="absolute top-6 right-6 text-6xl font-black text-white/[0.03]">{i + 1}</div>
                                    <h3 className="text-lg font-black text-white mb-3">{s.title}</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                                </div>
                                {i < 2 && <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ REQUIRED DOCUMENTS ═══ */}
            <section className="py-24 px-4 bg-gradient-to-b from-transparent to-emerald-900/5">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.4em]">Préparation</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mt-3">Documents Requis</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(docs.length > 0 ? docs : [
                            { id: '1', label_fr: 'Pièce d\'identité', description_fr: 'Passeport ou CNI en cours de validité', doc_type: 'identite' },
                            { id: '2', label_fr: 'Justificatif de domicile', description_fr: 'Certificat de résidence ou facture', doc_type: 'domicile' },
                            { id: '3', label_fr: 'Preuve de profession', description_fr: 'Certificat de travail ou bulletins', doc_type: 'profession' },
                            { id: '4', label_fr: 'Preuve d\'afro-descendance', description_fr: 'Actes, tests génétiques, archives', doc_type: 'afro_descendance' },
                            { id: '5', label_fr: 'Casier judiciaire', description_fr: 'Moins de 3 mois', doc_type: 'casier' },
                        ]).map((d, i) => {
                            const Icon = docIcons[d.doc_type] || FileCheck
                            return (
                                <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-emerald-500/20 transition-all group">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                                        <Icon size={18} className="text-emerald-400" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-2">{d.label_fr}</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">{d.description_fr}</p>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ ELIGIBILITY ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-gradient-to-br from-emerald-900/20 via-[#0a0f14] to-yellow-900/10 border border-emerald-500/10 rounded-3xl p-8 md:p-12">
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                <Scale size={28} className="text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white mb-4">{content.eligibility_title || 'Critères d\'Éligibilité'}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed mb-6">{content.eligibility_desc || 'Toute personne âgée de 18 ans révolus ayant un ascendant d\'Afrique subsaharienne déporté dans le cadre de la traite négrière.'}</p>
                                <div className="space-y-3">
                                    {['Personne âgée de 18 ans ou plus', 'Ascendant d\'Afrique subsaharienne déporté (traite négrière)', 'Filiation directe établie avec un Afro-descendant reconnu'].map((c, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" /> {c}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-3xl mx-auto">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.4em]">Questions</span>
                        <h2 className="text-3xl md:text-4xl font-black text-white mt-3">Foire aux Questions</h2>
                        <p className="text-xs text-gray-500 mt-2">{faqs.length} questions pour tout comprendre</p>
                    </motion.div>

                    <div className="space-y-2">
                        {faqs.map((faq, idx) => {
                            const isOpen = openFaq === faq.id
                            return (
                                <motion.div key={faq.id} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.04 }}
                                    className={`rounded-2xl overflow-hidden transition-all duration-500 ${isOpen ? 'bg-gradient-to-br from-emerald-500/[0.06] to-white/[0.02] border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-white/[0.02] border border-white/[0.04] hover:border-white/10'}`}>
                                    <button onClick={() => setOpenFaq(isOpen ? null : faq.id)} className="w-full p-5 md:p-6 flex items-start gap-4 text-left group">
                                        <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 mt-0.5 ${isOpen ? 'bg-emerald-500 text-white' : 'bg-white/5 text-gray-600 group-hover:text-white group-hover:bg-white/10'}`}>{idx + 1}</span>
                                        <span className={`text-sm font-bold flex-1 pr-4 transition-colors duration-300 ${isOpen ? 'text-emerald-400' : 'text-white'}`}>{faq.question_fr}</span>
                                        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="shrink-0 mt-0.5">
                                            <ChevronDown size={18} className={`transition-colors duration-300 ${isOpen ? 'text-emerald-400' : 'text-gray-600'}`} />
                                        </motion.div>
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ height: { duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }, opacity: { duration: 0.25, delay: 0.1 } }}>
                                                <div className="px-5 md:px-6 pb-6 pl-[3.5rem] md:pl-16">
                                                    <div className="w-8 h-px bg-gradient-to-r from-emerald-500/50 to-transparent mb-4" />
                                                    <div className="text-sm text-gray-400 leading-[1.8] whitespace-pre-line">{faq.answer_fr}</div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                        className="bg-gradient-to-br from-emerald-900/30 via-[#0a0f14] to-yellow-900/20 border border-emerald-500/10 rounded-3xl p-10 md:p-16">
                        <Globe2 size={40} className="text-emerald-400 mx-auto mb-6" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">{content.cta_title || 'Prêt à retrouver vos racines ?'}</h2>
                        <p className="text-sm text-gray-400 max-w-xl mx-auto mb-8">{content.cta_desc || 'Notre équipe vous accompagne à chaque étape.'}</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/nationalite/formulaire" className="group bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm px-8 py-4 rounded-2xl transition-all shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center gap-3">
                                Commencer ma demande <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link href="/contact" className="bg-white/5 hover:bg-white/10 text-white font-bold text-sm px-8 py-4 rounded-2xl border border-white/10 transition-all">
                                Nous contacter
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}
