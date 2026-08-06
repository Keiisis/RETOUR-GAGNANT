'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Globe as Globe2, FileText as FileCheck, Shield, Clock, CaretDown as ChevronDown, CaretUp as ChevronUp, ArrowRight, CheckCircle as CheckCircle2, Users, Scales as Scale, Fingerprint, MapPin } from '@phosphor-icons/react';
import { useTranslation } from '@/lib/translation'
import { CurrencyCode } from '@/lib/currency'
import { Price } from '@/components/ui/Price'

interface PageContent { section_key: string; content_fr: string }
interface FAQ { id: string; question_fr: string; answer_fr: string; sort_order: number }
interface RequiredDoc { id: string; label_fr: string; description_fr: string; doc_type: string }

export default function NationalitePage() {
    const [content, setContent] = useState<Record<string, string>>({})
    const [faqs, setFaqs] = useState<FAQ[]>([])
    const [docs, setDocs] = useState<RequiredDoc[]>([])
    const [openFaq, setOpenFaq] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [formAmount, setFormAmount] = useState(250)
    const [formCurrency, setFormCurrency] = useState<CurrencyCode>('XOF')
    const { t } = useTranslation()

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
            if (!map.processing_time) map.processing_time = '3 mois'
            setContent(map)
            setFaqs((fRes.data || []) as FAQ[])
            setDocs((dRes.data || []) as RequiredDoc[])

            // Fetch prix et devise depuis page_sections (admin settings)
            supabase.from('page_sections').select('content')
                .eq('page', 'nationalite').eq('section_key', 'form_settings').single()
                .then(({ data }) => {
                    if (data?.content) {
                        const c = data.content as Record<string, unknown>
                        if (c.amount) setFormAmount(Number(c.amount))
                        if (c.currency) setFormCurrency(c.currency as CurrencyCode)
                    }
                })

            setLoading(false)
        }
        load()
    }, [])

    const steps = [
        { icon: FileCheck, title: t(content.step_1_title || 'Inscription et dépôt'), desc: t(content.step_1_desc || 'Remplissez le formulaire et soumettez vos documents.') },
        { icon: Shield, title: t(content.step_2_title || 'Examen du dossier'), desc: t(content.step_2_desc || 'Vérification de l\'authenticité de vos documents.') },
        { icon: CheckCircle2, title: t(content.step_3_title || 'Décision'), desc: t(content.step_3_desc || 'Réception de votre attestation d\'éligibilité.') },
    ]

    const docIcons: Record<string, typeof FileCheck> = { identite: Fingerprint, domicile: MapPin, profession: Users, afro_descendance: Globe2, casier: Scale }

    if (loading) return <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#008751]/25 border-t-[#008751] rounded-full animate-spin" /></div>

    return (
        <div className="min-h-screen bg-[#fdfbf7]">
            {/* ═══ HERO — clair, éditorial, chaud (aucun fond noir) ═══ */}
            <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
                {/* Photo patrimoine + voile IVOIRE (pas de noir) : image en haut, fond crème */}
                <div className="absolute inset-0 bg-cover bg-[center_top_15%]" style={{ backgroundImage: `url('${content.form_bg_image || '/images/bg-nationalite-afro.jpg'}')` }} />
                <div className="absolute inset-0 bg-gradient-to-b from-[#fdfbf7]/30 via-[#fdfbf7]/88 to-[#fdfbf7]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,135,81,0.10),transparent_65%)]" />

                {/* Filets décoratifs tricolores, discrets */}
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#008751]/12 to-transparent" />
                <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-[#FCD116]/20 to-transparent" />

                <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 text-center px-4 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-[#008751]/15 shadow-[0_2px_16px_rgba(0,135,81,0.08)] rounded-full px-5 py-2 mb-8">
                        <Globe2 size={14} className="text-[#008751]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#008751]">{t('Loi N° 2024-31')}</span>
                    </div>

                    <h1 className="font-display text-4xl sm:text-5xl md:text-[5.25rem] font-bold text-[#1c1917] leading-[1.02] tracking-tight mb-5 text-balance">
                        {t(content.hero_title || 'Reconnaissance de Nationalité Béninoise')}
                        <br />
                        <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#C79A0A] to-[#E8112D]">
                            {t(content.hero_subtitle || 'Pour les Afro-Descendants')}
                        </span>
                    </h1>

                    <p className="text-base md:text-lg text-[#57534e] max-w-2xl mx-auto mb-10 leading-relaxed text-pretty">
                        {t(content.hero_description || 'Reconnectez-vous à vos racines. Acquérez la nationalité béninoise grâce à un processus officiel, encadré et sécurisé.')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                        <Link href="/nationalite/formulaire" className="group bg-[#008751] hover:bg-[#007445] text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all duration-300 shadow-[0_8px_28px_rgba(0,135,81,0.28)] hover:shadow-[0_12px_36px_rgba(0,135,81,0.36)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3">
                            {t("Soumettre ma demande")} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-[#e7e1d8] shadow-[0_4px_20px_rgba(28,25,23,0.06)] rounded-2xl px-6 py-4">
                            <span className="font-display text-3xl font-bold text-[#008751] tabular-nums"><Price amount={formAmount} currency={formCurrency} /></span>
                            <div className="text-left">
                                <p className="text-[10px] text-[#78716c] font-bold uppercase tracking-wider">{t("Frais de traitement")}</p>
                                <p className="text-[10px] text-[#a8a29e] flex items-center gap-1"><Clock size={10} /> {t(content.processing_time || '3 mois')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Gages de confiance */}
                    <div className="flex items-center justify-center gap-6 flex-wrap">
                        {['Processus officiel', 'Données sécurisées', 'Accompagnement expert'].map((txt, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-[#57534e] font-bold uppercase tracking-wider">
                                <CheckCircle2 size={12} className="text-[#008751]" /> {t(txt)}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </section>

            {/* ═══ PROCESS STEPS ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-[#008751] uppercase tracking-[0.4em]">{t("Comment ça marche")}</span>
                        <h2 className="font-display text-3xl md:text-[2.75rem] font-bold text-[#1c1917] tracking-tight mt-3">{t("Le Processus en 3 Étapes")}</h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 24, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
                                className="relative group">
                                <div className="bg-white border border-[#e7e1d8] rounded-3xl p-8 shadow-[0_2px_20px_rgba(28,25,23,0.04)] hover:shadow-[0_10px_36px_rgba(0,135,81,0.10)] hover:border-[#008751]/25 hover:-translate-y-1 transition-all duration-300 h-full">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#008751]/14 to-[#008751]/4 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                        <s.icon size={24} className="text-[#008751]" />
                                    </div>
                                    <div className="absolute top-5 right-7 font-display text-7xl font-bold text-[#008751]/[0.06] leading-none tabular-nums">{i + 1}</div>
                                    <h3 className="text-lg font-bold text-[#1c1917] mb-3">{s.title}</h3>
                                    <p className="text-sm text-[#78716c] leading-relaxed">{s.desc}</p>
                                </div>
                                {i < 2 && <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-[#008751]/35 to-transparent" />}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ REQUIRED DOCUMENTS ═══ */}
            <section className="py-24 px-4 bg-gradient-to-b from-transparent to-[#008751]/[0.04]">
                <div className="max-w-5xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-[#008751] uppercase tracking-[0.4em]">{t("Préparation")}</span>
                        <h2 className="font-display text-3xl md:text-[2.75rem] font-bold text-[#1c1917] tracking-tight mt-3">{t("Documents Requis")}</h2>
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
                                <motion.div key={d.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }}
                                    className="bg-white border border-[#e7e1d8] rounded-2xl p-6 shadow-[0_2px_16px_rgba(28,25,23,0.03)] hover:shadow-[0_8px_28px_rgba(0,135,81,0.09)] hover:border-[#008751]/25 hover:-translate-y-0.5 transition-all duration-300 group">
                                    <div className="w-10 h-10 rounded-xl bg-[#008751]/10 flex items-center justify-center mb-4 group-hover:bg-[#008751]/18 transition-colors">
                                        <Icon size={18} className="text-[#008751]" />
                                    </div>
                                    <h4 className="text-sm font-bold text-[#1c1917] mb-2">{t(d.label_fr)}</h4>
                                    <p className="text-xs text-[#78716c] leading-relaxed">{t(d.description_fr)}</p>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ ELIGIBILITY ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="relative bg-gradient-to-br from-[#008751]/[0.06] via-white to-[#FCD116]/[0.06] border border-[#e7e1d8] shadow-[0_6px_30px_rgba(0,135,81,0.07)] rounded-3xl p-8 md:p-12 overflow-hidden">
                        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                        <div className="flex items-start gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-[#008751]/10 flex items-center justify-center shrink-0">
                                <Scale size={28} className="text-[#008751]" />
                            </div>
                            <div>
                                <h3 className="font-display text-2xl md:text-[2rem] font-bold text-[#1c1917] tracking-tight mb-4">{t(content.eligibility_title || 'Critères d\'Éligibilité')}</h3>
                                <p className="text-sm text-[#57534e] leading-relaxed mb-6">{t(content.eligibility_desc || 'Toute personne âgée de 18 ans révolus ayant un ascendant d\'Afrique subsaharienne déporté dans le cadre de la traite négrière.')}</p>
                                <div className="space-y-3">
                                    {['Personne âgée de 18 ans ou plus', 'Ascendant d\'Afrique subsaharienne déporté (traite négrière)', 'Filiation directe établie avec un Afro-descendant reconnu'].map((c, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm text-[#44403c]">
                                            <CheckCircle2 size={16} className="text-[#008751] shrink-0" /> {t(c)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ═══ FAQ ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-3xl mx-auto">
                    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
                        <span className="text-[10px] font-bold text-[#008751] uppercase tracking-[0.4em]">{t("Questions")}</span>
                        <h2 className="font-display text-3xl md:text-[2.75rem] font-bold text-[#1c1917] tracking-tight mt-3">{t("Foire aux Questions")}</h2>
                        <p className="text-xs text-[#78716c] mt-2">{faqs.length} {t("questions pour tout comprendre")}</p>
                    </motion.div>

                    <div className="space-y-2">
                        {faqs.map((faq, idx) => {
                            const isOpen = openFaq === faq.id
                            return (
                                <motion.div key={faq.id} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.04 }}
                                    className={`rounded-2xl overflow-hidden transition-all duration-500 ${isOpen ? 'bg-gradient-to-br from-[#008751]/[0.06] to-transparent border border-[#008751]/25 shadow-[0_6px_28px_rgba(0,135,81,0.07)]' : 'bg-white border border-[#e7e1d8] hover:border-[#008751]/20'}`}>
                                    <button onClick={() => setOpenFaq(isOpen ? null : faq.id)} className="w-full p-5 md:p-6 flex items-start gap-4 text-left group">
                                        <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 mt-0.5 tabular-nums ${isOpen ? 'bg-[#008751] text-white' : 'bg-[#f5f1ea] text-[#a8a29e] group-hover:text-[#1c1917] group-hover:bg-[#ebe5db]'}`}>{idx + 1}</span>
                                        <span className={`text-sm font-bold flex-1 pr-4 transition-colors duration-300 ${isOpen ? 'text-[#008751]' : 'text-[#1c1917]'}`}>{t(faq.question_fr)}</span>
                                        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="shrink-0 mt-0.5">
                                            <ChevronDown size={18} className={`transition-colors duration-300 ${isOpen ? 'text-[#008751]' : 'text-[#a8a29e]'}`} />
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
                                                    <div className="w-8 h-px bg-gradient-to-r from-[#008751]/50 to-transparent mb-4" />
                                                    <div className="text-sm text-[#57534e] leading-[1.8] whitespace-pre-line">{t(faq.answer_fr)}</div>
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
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    className="relative bg-gradient-to-br from-[#008751]/[0.06] via-white to-[#FCD116]/[0.06] border border-[#e7e1d8] shadow-[0_10px_40px_rgba(0,135,81,0.08)] rounded-3xl p-10 md:p-16 overflow-hidden">
                        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                        <Globe2 size={40} className="text-[#008751] mx-auto mb-6" />
                        <h2 className="font-display text-3xl md:text-[2.75rem] font-bold text-[#1c1917] tracking-tight mb-4 text-balance">{t(content.cta_title || 'Prêt à retrouver vos racines ?')}</h2>
                        <p className="text-sm text-[#57534e] max-w-xl mx-auto mb-8">{t(content.cta_desc || 'Notre équipe vous accompagne à chaque étape.')}</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/nationalite/formulaire" className="group bg-[#008751] hover:bg-[#007445] text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all duration-300 shadow-[0_8px_28px_rgba(0,135,81,0.28)] hover:shadow-[0_12px_36px_rgba(0,135,81,0.36)] hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-3">
                                {t("Commencer ma demande")} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link href="/contact" className="bg-[#f5f1ea] hover:bg-[#ebe5db] text-[#44403c] font-bold text-sm px-8 py-4 rounded-2xl border border-[#e7e1d8] transition-all duration-300">
                                {t("Nous contacter")}
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    )
}
