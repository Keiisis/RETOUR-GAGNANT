'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle as CheckCircle2, CircleNotch as Loader2, Buildings as Building2, MapPin, Envelope as Mail, Phone, Globe, InstagramLogo as Instagram, FacebookLogo as Facebook, LinkedinLogo as Linkedin, Handshake, House as Home, Leaf, Palette, Cpu, Diamond as Gem, Airplane as Plane, Heartbeat as HeartPulse, TrendUp as TrendingUp, GraduationCap, ShoppingBag, GridFour as LayoutGrid, Package, Wrench, Megaphone, PiggyBank, Users, ChartBar as BarChart3, Camera, PaperPlaneTilt as Send, Star, Shield, Lightning as Zap, TreeStructure as Network, CaretRight as ChevronRight } from '@phosphor-icons/react';
import { cn } from '@/lib/utils'
import FileUpload from '@/components/ui/FileUpload'
import { useTranslation, T } from '@/lib/translation'
import ConsentCheckbox from '@/components/shared/ConsentCheckbox'

// ─── Category definitions with real icons ────────────────────────────────────

const CATEGORIES = [
    { value: 'Immobilier', label: 'Immobilier', icon: Home, from: '#059669', to: '#0d9488' },
    { value: 'Agro-Business', label: 'Agro-Business', icon: Leaf, from: '#65a30d', to: '#16a34a' },
    { value: 'Art & Culture', label: 'Art & Culture', icon: Palette, from: '#7c3aed', to: '#9333ea' },
    { value: 'Services & Tech', label: 'Services & Tech', icon: Cpu, from: '#2563eb', to: '#4f46e5' },
    { value: 'Mode & Beauté', label: 'Mode & Beauté', icon: Gem, from: '#db2777', to: '#e11d48' },
    { value: 'Tourisme & Hôtellerie', label: 'Tourisme & Hôtellerie', icon: Plane, from: '#ea580c', to: '#d97706' },
    { value: 'Santé & Bien-être', label: 'Santé & Bien-être', icon: HeartPulse, from: '#0d9488', to: '#0891b2' },
    { value: 'Finance & Investissement', label: 'Finance & Investissement', icon: BarChart3, from: '#d97706', to: '#ca8a04' },
    { value: 'Éducation & Formation', label: 'Éducation & Formation', icon: GraduationCap, from: '#4f46e5', to: '#2563eb' },
    { value: 'Commerce & Distribution', label: 'Commerce & Distribution', icon: ShoppingBag, from: '#0891b2', to: '#0284c7' },
    { value: 'Autre', label: 'Autre', icon: LayoutGrid, from: '#6b7280', to: '#4b5563' },
]

const PARTNERSHIP_TYPES = [
    { value: 'produits', label: 'Vente de produits', sub: 'Proposez vos produits à la diaspora', icon: Package, from: '#ea580c', to: '#d97706' },
    { value: 'services', label: 'Offre de services', sub: 'Services spécialisés pour nos membres', icon: Wrench, from: '#2563eb', to: '#4f46e5' },
    { value: 'visibilite', label: 'Visibilité & marketing', sub: 'Boostez votre présence internationale', icon: Megaphone, from: '#FCD116', to: '#f59e0b' },
    { value: 'distribution', label: 'Distribution diaspora', sub: 'Canal de distribution vers l\'étranger', icon: Globe, from: '#059669', to: '#0d9488' },
    { value: 'investissement', label: 'Investissement conjoint', sub: 'Co-investissement et croissance partagée', icon: PiggyBank, from: '#d97706', to: '#ca8a04' },
    { value: 'formation', label: 'Formation & expertise', sub: 'Transmettez votre savoir au réseau', icon: GraduationCap, from: '#7c3aed', to: '#9333ea' },
]

const YEARS_OPTIONS = ["Moins d'1 an", '1–3 ans', '3–5 ans', '5–10 ans', 'Plus de 10 ans']
const TEAM_OPTIONS = ['Seul(e)', '2–5 personnes', '6–20 personnes', '21–50 personnes', '+50 personnes']
const REVENUE_OPTIONS = ['Démarrage', 'Moins de 5M FCFA/an', '5–20M FCFA/an', '20–100M FCFA/an', 'Plus de 100M FCFA/an']

const STEPS = [
    { title: 'Votre Structure', subtitle: 'Identité & localisation', icon: Building2 },
    { title: 'Votre Activité', subtitle: 'Ce que vous proposez', icon: TrendingUp },
    { title: 'Coordonnées', subtitle: 'Comment vous joindre', icon: Mail },
    { title: 'Votre Candidature', subtitle: 'Pourquoi nous rejoindre', icon: Send },
]

// ─── Form interface ───────────────────────────────────────────────────────────

interface FormData {
    company_name: string; contact_name: string; category: string; location: string
    years_in_business: string; team_size: string
    activity_description: string; target_audience: string; what_offer: string
    revenue_range: string; partnership_types: string[]
    email: string; phone: string; whatsapp: string; website: string
    facebook_url: string; instagram_url: string; linkedin_url: string
    why_partner: string; logo_url: string; cover_image_url: string
}

const EMPTY_FORM: FormData = {
    company_name: '', contact_name: '', category: '', location: '',
    years_in_business: '', team_size: '',
    activity_description: '', target_audience: '', what_offer: '',
    revenue_range: '', partnership_types: [],
    email: '', phone: '', whatsapp: '', website: '',
    facebook_url: '', instagram_url: '', linkedin_url: '',
    why_partner: '', logo_url: '', cover_image_url: '',
}

// ─── Ultra-Realistic 3D Icon ──────────────────────────────────────────────────

const SIZES: Record<number, string> = {
    28: 'w-7 h-7',
    32: 'w-8 h-8',
    44: 'w-11 h-11',
    48: 'w-12 h-12',
}

const RADIUS: Record<number, string> = {
    28: 'rounded-[8px]',
    32: 'rounded-[9px]',
    44: 'rounded-[13px]',
    48: 'rounded-[14px]',
}

const INNER_RADIUS: Record<number, string> = {
    28: 'rounded-[6px]',
    32: 'rounded-[7px]',
    44: 'rounded-[11px]',
    48: 'rounded-[12px]',
}

function Icon3D({ icon: Icon, from, to, size = 20, containerSize = 48 }: { icon: React.ComponentType<{ size?: number; className?: string }>; from: string; to: string; size?: number; containerSize?: number }) {
    const sizeClass = SIZES[containerSize] || 'w-12 h-12'
    const radiusClass = RADIUS[containerSize] || 'rounded-[14px]'
    const innerRadiusClass = INNER_RADIUS[containerSize] || 'rounded-[12px]'

    return (
        <div
            className={cn("relative flex-shrink-0 [perspective:200px]", sizeClass)}
            style={{ '--from': from, '--to': to } as React.CSSProperties}
        >
            {/* Volumetric glow underneath */}
            <div
                className="absolute inset-x-[15%] bottom-[-20%] h-[40%] rounded-full blur-lg opacity-70"
                style={{ background: `radial-gradient(ellipse, ${from}, transparent 70%)` }}
            />
            {/* Main 3D body */}
            <div
                className={cn(
                    "relative w-full h-full flex items-center justify-center overflow-hidden [transform:rotateX(4deg)_rotateY(-3deg)]",
                    radiusClass,
                )}
                style={{
                    background: `linear-gradient(160deg, ${from}, ${to} 60%, ${from}cc 100%)`,
                    boxShadow: [
                        `0 1px 0 rgba(255,255,255,0.4) inset`,
                        `0 -1px 0 rgba(0,0,0,0.25) inset`,
                        `1px 0 0 rgba(255,255,255,0.1) inset`,
                        `-1px 0 0 rgba(0,0,0,0.1) inset`,
                        `0 ${containerSize * 0.2}px ${containerSize * 0.4}px ${from}40`,
                        `0 ${containerSize * 0.06}px ${containerSize * 0.1}px rgba(0,0,0,0.08)`,
                    ].join(', '),
                }}
            >
                {/* Glass shine reflection */}
                <div
                    className={cn("absolute inset-0 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.08)_40%,transparent_60%)]", radiusClass)}
                />
                {/* Inner depth ring */}
                <div
                    className={cn("absolute inset-[2px] pointer-events-none shadow-[0_1px_3px_rgba(255,255,255,0.12)_inset,0_-1px_2px_rgba(0,0,0,0.25)_inset]", innerRadiusClass)}
                />
                {/* Icon */}
                <Icon size={size} className="relative z-10 text-white drop-shadow-lg" />
            </div>
        </div>
    )
}

// ─── Shared field wrapper ─────────────────────────────────────────────────────

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <label className="flex items-baseline gap-1.5 text-[11px] font-black text-gray-500 uppercase tracking-[0.18em]">
                {label}
                {required && <span className="text-[#E8112D] font-black">*</span>}
            </label>
            {children}
            {hint && <p className="text-[10px] text-gray-400 leading-relaxed">{hint}</p>}
        </div>
    )
}

// ─── Input ────────────────────────────────────────────────────────────────────

function TextInput({ value, onChange, placeholder, type = 'text', icon: InputIcon }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string
    icon?: React.ComponentType<{ size?: number; className?: string }>
}) {
    return (
        <div className="relative">
            {InputIcon && (
                <InputIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            )}
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)}
                placeholder={placeholder} title={placeholder}
                className={cn(
                    'w-full rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-sm',
                    'focus:outline-none focus:border-[#008751] focus:bg-white focus:ring-2 focus:ring-[#008751]/20 transition-all',
                    'placeholder-gray-400 py-3',
                    InputIcon ? 'pl-10 pr-4' : 'px-4'
                )}
            />
        </div>
    )
}

function TextArea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
    return (
        <textarea
            value={value} onChange={e => onChange(e.target.value)}
            placeholder={placeholder} title={placeholder} rows={rows}
            className="w-full rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-sm px-4 py-3 focus:outline-none focus:border-[#008751] focus:bg-white focus:ring-2 focus:ring-[#008751]/20 transition-all placeholder-gray-400 resize-none leading-relaxed"
        />
    )
}

// ─── Pill selector ────────────────────────────────────────────────────────────

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button" onClick={onClick}
            className={cn(
                'text-xs font-bold px-4 py-2 rounded-xl border transition-all',
                selected
                    ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/40 shadow-[0_0_12px_rgba(0,135,81,0.1)]'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-800'
            )}
        >
            {label}
        </button>
    )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function DevenirPartenairePage() {
    const { t } = useTranslation()
    const [step, setStep] = useState(0)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [consent, setConsent] = useState(false)

    const set = (key: keyof FormData, value: string | string[]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const togglePType = (val: string) =>
        set('partnership_types', form.partnership_types.includes(val)
            ? form.partnership_types.filter(v => v !== val)
            : [...form.partnership_types, val]
        )

    const validateStep = () => {
        if (step === 0) return !!(form.company_name && form.contact_name && form.category && form.location)
        if (step === 1) return !!(form.activity_description && form.partnership_types.length > 0)
        if (step === 2) return !!form.email
        if (step === 3) return !!form.why_partner && consent
        return true
    }

    const handleSubmit = async () => {
        setSubmitting(true); setError('')
        try {
            const res = await fetch('/api/admin/partner-applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la soumission')
            setSubmitted(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setSubmitting(false)
        }
    }

    // ── SUCCESS STATE ────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
                {/* Background blobs */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.06] bg-[radial-gradient(circle,#008751,transparent_70%)]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.05] bg-[radial-gradient(circle,#FCD116,transparent_70%)]" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.88, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    className="relative max-w-lg w-full"
                >
                    <div className="rounded-[32px] border border-gray-200 overflow-hidden bg-white shadow-xl">

                        {/* Top gradient bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#008751]" />

                        <div className="p-8 space-y-7 text-center">
                            {/* Sceau tricolore (sobre, sans gimmick) */}
                            <motion.div
                                initial={{ scale: 0.82, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.7, ease: [0.34, 1.4, 0.64, 1], delay: 0.15 }}
                                className="flex justify-center"
                            >
                                <div className="w-24 h-24 rounded-full p-[2.5px] bg-gradient-to-br from-[#008751] via-[#FCD116] to-[#E8112D]">
                                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center shadow-[0_12px_40px_-14px_rgba(0,135,81,0.45)]">
                                        <CheckCircle2 size={42} strokeWidth={1.75} className="text-[#008751]" />
                                    </div>
                                </div>
                            </motion.div>

                            <div className="space-y-3">
                                <h1 className="text-3xl font-black text-gray-900 font-display tracking-tighter">
                                    <T>Candidature envoyée !</T>
                                </h1>
                                <p className="text-gray-600 leading-relaxed text-[15px]">
                                    {t("Merci")} <strong className="text-gray-900">{form.contact_name}</strong> ! {t("Notre équipe examine votre dossier sous 48–72h. Vous recevrez une réponse à")} <strong className="text-[#008751]">{form.email}</strong>.
                                </p>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-left space-y-3">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]"><T>Récapitulatif</T></p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        ['Structure', form.company_name],
                                        ['Catégorie', form.category],
                                        ['Localisation', form.location],
                                        ['Statut', 'En examen'],
                                    ].map(([label, val]) => (
                                        <div key={label}>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t(label)}</p>
                                            <p className={cn('text-sm font-bold mt-0.5', label === 'Statut' ? 'text-[#008751]' : 'text-gray-900')}>{['Statut', 'Catégorie'].includes(label) ? t(val) : val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Link href="/partenaires"
                                    className="flex items-center justify-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-6 py-3 rounded-2xl transition-all">
                                    <ArrowLeft size={14} /> <T>Voir nos partenaires</T>
                                </Link>
                                <Link href="/"
                                    className="flex items-center justify-center gap-2 text-sm font-black text-[#030a15] px-6 py-3 rounded-2xl transition-all bg-gradient-to-br from-[#FCD116] to-amber-500">
                                    <T>Retour à l&apos;accueil</T> <ChevronRight size={14} />
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        )
    }

    // ── MAIN FORM ────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-white text-gray-900">

            {/* ── Ambient background ── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full opacity-[0.08] bg-[radial-gradient(circle_at_70%_20%,#008751,transparent_60%)]" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-[0.06] bg-[radial-gradient(circle_at_30%_80%,#FCD116,transparent_60%)]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-[0.04] bg-[radial-gradient(circle,#4f46e5,transparent_60%)]" />
                {/* Grid overlay */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.025]">
                    <defs>
                        <pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse">
                            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#g)" />
                </svg>
            </div>

            {/* ── HERO HEADER ── */}
            <div className="relative z-10 pt-10 pb-14 px-4">
                <div className="max-w-3xl mx-auto text-center space-y-6">
                    <Link href="/partenaires"
                        className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors mb-2">
                        <ArrowLeft size={13} /> <T>Retour aux partenaires</T>
                    </Link>

                    {/* Badge */}
                    <div className="flex justify-center">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#FCD116]/20 bg-[#FCD116]/5 text-[#FCD116] text-[11px] font-black uppercase tracking-[0.3em]">
                            <Handshake size={13} />
                            <T>Réseau Retour Gagnant</T>
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black font-display tracking-tighter leading-none">
                        <T>Devenir</T>{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#FCD116] to-[#008751]">
                            <T>Partenaire</T>
                        </span>
                    </h1>

                    <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
                        <T>Rejoignez notre réseau d&apos;élite et touchez la diaspora béninoise du monde entier. Ensemble, construisons des ponts entre l&apos;Afrique et la diaspora.</T>
                    </p>

                    {/* Benefits — real 3D icons */}
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                        {[
                            { icon: Network, label: 'Visibilité diaspora', from: '#2563eb', to: '#4f46e5' },
                            { icon: Star, label: 'Statut Premium', from: '#d97706', to: '#ca8a04' },
                            { icon: Shield, label: 'Réseau de confiance', from: '#059669', to: '#0d9488' },
                            { icon: Zap, label: 'Croissance partagée', from: '#7c3aed', to: '#9333ea' },
                        ].map(b => (
                            <div key={b.label}
                                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-gray-200 bg-gray-50">
                                <Icon3D icon={b.icon} from={b.from} to={b.to} size={14} containerSize={28} />
                                <span className="text-xs font-bold text-gray-600">{t(b.label)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── FORM CONTAINER ── */}
            <div className="relative z-10 max-w-2xl mx-auto px-4 pb-20">

                {/* ── STEPPER ── */}
                <div className="flex items-center mb-10">
                    {STEPS.map((s, i) => {
                        const StepIcon = s.icon
                        const isActive = i === step
                        const isDone = i < step
                        return (
                            <div key={i} className="flex items-center flex-1 min-w-0">
                                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <motion.div
                                        animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                                        transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
                                    >
                                        <div
                                            className={cn(
                                                'w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300',
                                                isDone
                                                    ? 'bg-gradient-to-br from-[#008751] to-emerald-600 shadow-[inset_0_2px_0_rgba(255,255,255,0.18),0_6px_20px_rgba(0,135,81,0.45)]'
                                                    : isActive
                                                        ? 'bg-gradient-to-br from-[#FCD116] to-amber-500 shadow-[inset_0_2px_0_rgba(255,255,255,0.25),0_6px_24px_rgba(252,209,22,0.5)]'
                                                        : 'bg-gray-200 border border-gray-300'
                                            )}
                                        >
                                            {isDone
                                                ? <CheckCircle2 size={20} className="text-white drop-shadow-sm" />
                                                : <StepIcon size={18} className={isActive ? 'text-[#030a15] drop-shadow-sm' : 'text-gray-500'} />
                                            }
                                        </div>
                                    </motion.div>
                                    <p className={cn(
                                        'text-[9px] font-black uppercase tracking-widest hidden sm:block text-center whitespace-nowrap',
                                        isDone ? 'text-emerald-600' : isActive ? 'text-amber-600' : 'text-gray-400'
                                    )}>{t(s.title)}</p>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className="relative flex-1 mx-2.5 h-px">
                                        <div className="absolute inset-0 bg-gray-200 rounded-full" />
                                        <motion.div
                                            className="absolute inset-0 rounded-full bg-gradient-to-r from-[#008751] to-emerald-600"
                                            initial={{ scaleX: 0, originX: 0 }}
                                            animate={{ scaleX: isDone ? 1 : 0 }}
                                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                        />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* ── STEP CARD ── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 32 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -32 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="rounded-[28px] border border-gray-200 overflow-hidden bg-white shadow-lg">

                            {/* Step header */}
                            <div className="px-8 pt-7 pb-5 border-b border-gray-100 flex items-center gap-4">
                                {(() => {
                                    const S = STEPS[step]
                                    return (
                                        <Icon3D
                                            icon={S.icon}
                                            from={step === 0 ? '#059669' : step === 1 ? '#2563eb' : step === 2 ? '#db2777' : '#7c3aed'}
                                            to={step === 0 ? '#0d9488' : step === 1 ? '#4f46e5' : step === 2 ? '#e11d48' : '#9333ea'}
                                            size={20} containerSize={44}
                                        />
                                    )
                                })()}
                                <div className="flex-1">
                                    <h2 className="text-lg font-black text-gray-900">{t(STEPS[step].title)}</h2>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{t(STEPS[step].subtitle)}</p>
                                </div>
                                <span className="text-[11px] font-mono text-gray-400 font-bold">{step + 1}/{STEPS.length}</span>
                            </div>

                            <div className="px-8 py-7 space-y-6">

                                {/* ════ STEP 1 — STRUCTURE ════ */}
                                {step === 0 && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Field label={t("Nom de la structure")} required>
                                                <TextInput icon={Building2} value={form.company_name} onChange={v => set('company_name', v)} placeholder={t("Ex : Immo Bénin Prestige")} />
                                            </Field>
                                            <Field label={t("Votre nom complet")} required>
                                                <TextInput icon={Users} value={form.contact_name} onChange={v => set('contact_name', v)} placeholder={t("Prénom et nom")} />
                                            </Field>
                                        </div>

                                        {/* Category grid — 3D icon cards */}
                                        <Field label={t("Secteur d'activité")} required hint={t("Sélectionnez la catégorie qui correspond le mieux à votre activité")}>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                                                {CATEGORIES.map(cat => {
                                                    const CatIcon = cat.icon
                                                    const isSelected = form.category === cat.value
                                                    return (
                                                        <motion.button
                                                            key={cat.value}
                                                            type="button"
                                                            onClick={() => set('category', cat.value)}
                                                            whileHover={{ y: -2 }}
                                                            whileTap={{ scale: 0.97 }}
                                                            className={cn(
                                                                'flex items-center gap-2.5 px-3 py-3 rounded-2xl border text-left transition-all duration-200',
                                                                isSelected
                                                                    ? 'border-[#008751]/30 bg-[#008751]/5'
                                                                    : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                                                            )}
                                                            style={{
                                                                boxShadow: isSelected ? `0 0 0 1px ${cat.from}60, 0 4px 20px ${cat.from}30` : undefined
                                                            }}
                                                        >
                                                            <Icon3D icon={CatIcon} from={cat.from} to={cat.to} size={14} containerSize={32} />
                                                            <span className={cn(
                                                                'text-[11px] font-bold leading-tight truncate',
                                                                isSelected ? 'text-gray-900' : 'text-gray-500'
                                                            )}>
                                                                {t(cat.label)}
                                                            </span>
                                                            {isSelected && (
                                                                <motion.div
                                                                    initial={{ scale: 0 }}
                                                                    animate={{ scale: 1 }}
                                                                    className="ml-auto flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                                                                    style={{ background: `linear-gradient(135deg, ${cat.from}, ${cat.to})` }}>
                                                                    <CheckCircle2 size={10} className="text-white" />
                                                                </motion.div>
                                                            )}
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </Field>

                                        <Field label={t("Localisation")} required hint={t("Ville et pays où vous exercez votre activité")}>
                                            <TextInput icon={MapPin} value={form.location} onChange={v => set('location', v)} placeholder={t("Ex : Cotonou, Bénin")} />
                                        </Field>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Field label={t("Années d'existence")}>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {YEARS_OPTIONS.map(y => <Pill key={y} label={t(y)} selected={form.years_in_business === y} onClick={() => set('years_in_business', y)} />)}
                                                </div>
                                            </Field>
                                            <Field label={t("Taille de l'équipe")}>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {TEAM_OPTIONS.map(tOption => <Pill key={tOption} label={t(tOption)} selected={form.team_size === tOption} onClick={() => set('team_size', tOption)} />)}
                                                </div>
                                            </Field>
                                        </div>
                                    </div>
                                )}

                                {/* ════ STEP 2 — ACTIVITÉ ════ */}
                                {step === 1 && (
                                    <div className="space-y-6">
                                        <Field label={t("Décrivez votre activité principale")} required hint={t("Soyez précis : produits, services, zone géographique couverte")}>
                                            <TextArea value={form.activity_description} onChange={v => set('activity_description', v)} rows={5}
                                                placeholder={t("Notre entreprise est spécialisée dans... Nous proposons... Notre zone d'intervention est...")} />
                                        </Field>

                                        <Field label={t("Votre public cible")} hint={t("Qui sont vos clients, bénéficiaires ou partenaires ?")}>
                                            <TextInput icon={Users} value={form.target_audience} onChange={v => set('target_audience', v)} placeholder={t("Ex : Diaspora béninoise, entrepreneurs locaux, familles...")} />
                                        </Field>

                                        <Field label={t("Ce que vous apportez au réseau")} hint={t("Produits, services ou ressources que vous pouvez partager avec la communauté")}>
                                            <TextArea value={form.what_offer} onChange={v => set('what_offer', v)} rows={3} placeholder={t("Je peux apporter à la communauté...")} />
                                        </Field>

                                        <Field label={t("Chiffre d'affaires annuel estimé")}>
                                            <div className="flex flex-wrap gap-1.5">
                                                {REVENUE_OPTIONS.map(r => <Pill key={r} label={t(r)} selected={form.revenue_range === r} onClick={() => set('revenue_range', r)} />)}
                                            </div>
                                        </Field>

                                        {/* Partnership types — 3D icon cards */}
                                        <Field label={t("Types de partenariat souhaités")} required hint={t("Sélectionnez un ou plusieurs types de collaboration")}>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
                                                {PARTNERSHIP_TYPES.map(pt => {
                                                    const PtIcon = pt.icon
                                                    const isSelected = form.partnership_types.includes(pt.value)
                                                    return (
                                                        <motion.button
                                                            key={pt.value}
                                                            type="button"
                                                            onClick={() => togglePType(pt.value)}
                                                            whileHover={{ y: -1 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            className={cn(
                                                                'flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all duration-200',
                                                                isSelected
                                                                    ? 'border-gray-300 bg-gray-50 shadow-[0_0_0_1px_var(--pt-from-50),_0_4px_20px_var(--pt-from-25)]'
                                                                    : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                                                            )}
                                                            style={isSelected ? { '--pt-from-50': `${pt.from}50`, '--pt-from-25': `${pt.from}25` } as React.CSSProperties : undefined}
                                                        >
                                                            <Icon3D icon={PtIcon} from={pt.from} to={pt.to} size={16} containerSize={36} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className={cn('text-[12px] font-bold leading-tight', isSelected ? 'text-gray-900' : 'text-gray-700')}>{t(pt.label)}</p>
                                                                <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{t(pt.sub)}</p>
                                                            </div>
                                                            <div className={cn(
                                                                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                                                isSelected ? 'border-transparent' : 'border-gray-300'
                                                            )} style={isSelected ? { background: `linear-gradient(135deg, ${pt.from}, ${pt.to})` } : {}}>
                                                                {isSelected && <CheckCircle2 size={11} className="text-white" />}
                                                            </div>
                                                        </motion.button>
                                                    )
                                                })}
                                            </div>
                                        </Field>
                                    </div>
                                )}

                                {/* ════ STEP 3 — COORDONNÉES ════ */}
                                {step === 2 && (
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Field label={t("Email professionnel")} required>
                                                <TextInput icon={Mail} type="email" value={form.email} onChange={v => set('email', v)} placeholder={t("contact@votre-entreprise.com")} />
                                            </Field>
                                            <Field label={t("Téléphone")}>
                                                <TextInput icon={Phone} type="tel" value={form.phone} onChange={v => set('phone', v)} placeholder="+229 01 60 32 21 21" />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Field label="WhatsApp" hint={t("Numéro avec indicatif pays")}>
                                                <TextInput icon={Phone} type="tel" value={form.whatsapp} onChange={v => set('whatsapp', v)} placeholder="+229 01 60 32 21 21" />
                                            </Field>
                                            <Field label={t("Site web")}>
                                                <TextInput icon={Globe} type="url" value={form.website} onChange={v => set('website', v)} placeholder="https://votre-site.com" />
                                            </Field>
                                        </div>

                                        {/* Social links */}
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-3 mb-4">
                                                <Icon3D icon={Network} from="#2563eb" to="#4f46e5" size={13} containerSize={28} />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]"><T>Réseaux sociaux (optionnel)</T></span>
                                            </div>
                                            <div className="space-y-3">
                                                {[
                                                    { key: 'facebook_url' as const, icon: Facebook, placeholder: 'https://facebook.com/votre-page', label: 'Facebook', from: '#2563eb', to: '#1d4ed8' },
                                                    { key: 'instagram_url' as const, icon: Instagram, placeholder: 'https://instagram.com/votre-compte', label: 'Instagram', from: '#db2777', to: '#e11d48' },
                                                    { key: 'linkedin_url' as const, icon: Linkedin, placeholder: 'https://linkedin.com/company/...', label: 'LinkedIn', from: '#0891b2', to: '#0284c7' },
                                                ].map(({ key, icon: SocIcon, placeholder, label, from, to }) => (
                                                    <div key={key} className="flex items-center gap-3">
                                                        <Icon3D icon={SocIcon} from={from} to={to} size={14} containerSize={36} />
                                                        <div className="flex-1">
                                                            <input
                                                                type="url" value={form[key]} onChange={e => set(key, e.target.value)}
                                                                placeholder={placeholder} title={t(label)}
                                                                className="w-full rounded-2xl bg-gray-50 border border-gray-200 text-gray-900 text-sm px-4 py-3 focus:outline-none focus:border-[#008751] transition-all placeholder-gray-400"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ════ STEP 4 — CANDIDATURE ════ */}
                                {step === 3 && (
                                    <div className="space-y-6">
                                        <Field label={t("Pourquoi souhaitez-vous rejoindre notre réseau ?")} required hint={t("Exprimez votre motivation, vos valeurs communes avec Retour Gagnant Bénin")}>
                                            <TextArea value={form.why_partner} onChange={v => set('why_partner', v)} rows={6}
                                                placeholder={t("Je souhaite rejoindre Retour Gagnant car notre vision est alignée... Je peux contribuer à la diaspora en... Ensemble, nous pouvons...")} />
                                        </Field>

                                        {/* Visuals upload */}
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="flex items-center gap-3 mb-5">
                                                <Icon3D icon={Camera} from="#7c3aed" to="#9333ea" size={13} containerSize={28} />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]"><T>Visuels de votre marque (optionnel)</T></span>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex gap-5 items-start">
                                                    <FileUpload
                                                        type="logo" label={t("Logo")}
                                                        value={form.logo_url} onChange={v => set('logo_url', v)}
                                                        hint={t("PNG, JPG — max 5MB")} className="w-[120px] flex-shrink-0"
                                                    />
                                                    <div className="flex-1 pt-8 text-[12px] text-gray-500 leading-relaxed">
                                                        <T>Votre logo apparaîtra sur votre profil visible par toute la diaspora. Format carré recommandé (500×500px minimum).</T>
                                                    </div>
                                                </div>
                                                <FileUpload
                                                    type="cover" label={t("Photo de couverture")}
                                                    value={form.cover_image_url} onChange={v => set('cover_image_url', v)}
                                                    hint={t("Image panoramique de votre établissement, produits ou services — 1200×400px recommandé")}
                                                />
                                            </div>
                                        </div>

                                        {/* Recap */}
                                        <div className="rounded-2xl border border-[#008751]/20 bg-[#008751]/[0.06] p-5 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Icon3D icon={CheckCircle2} from="#008751" to="#0d9488" size={12} containerSize={24} />
                                                <span className="text-[10px] font-black text-[#008751] uppercase tracking-[0.2em]"><T>Récapitulatif de votre candidature</T></span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                                                {[
                                                    ['Structure', form.company_name],
                                                    ['Contact', form.contact_name],
                                                    ['Catégorie', form.category],
                                                    ['Localisation', form.location],
                                                    ['Email', form.email],
                                                    ['Partenariats', form.partnership_types.map(pt => t(PARTNERSHIP_TYPES.find(p => p.value === pt)?.label || pt)).join(', ')],
                                                ].filter(([, v]) => v).map(([label, val]) => (
                                                    <div key={label}>
                                                        <span className="text-gray-500">{t(label)} : </span>
                                                        <span className="text-gray-900 font-bold">{label === 'Catégorie' ? t(val) : val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <ConsentCheckbox id="partner-consent" checked={consent} onChange={setConsent}
                                            purpose="afin d'étudier ma candidature de partenariat et de me recontacter" />
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                                        <Shield size={14} /> {error}
                                    </motion.div>
                                )}

                                {/* Navigation */}
                                <div className="flex items-center justify-between pt-5 border-t border-gray-100">
                                    <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 0}
                                        className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
                                        <ArrowLeft size={15} /> <T>Précédent</T>
                                    </button>

                                    {step < STEPS.length - 1 ? (
                                        <motion.button
                                            type="button"
                                            onClick={() => { if (validateStep()) setStep(s => s + 1) }}
                                            disabled={!validateStep()}
                                            whileHover={validateStep() ? { scale: 1.02 } : {}}
                                            whileTap={validateStep() ? { scale: 0.98 } : {}}
                                            className="flex items-center gap-2.5 font-black text-sm px-7 py-3.5 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                            style={{
                                                background: validateStep()
                                                    ? 'linear-gradient(135deg, #008751, #0d9488)'
                                                    : 'rgba(0,0,0,0.08)',
                                                color: 'white',
                                                boxShadow: validateStep() ? '0 2px 0 rgba(255,255,255,0.15) inset, 0 8px 24px rgba(0,135,81,0.4)' : 'none',
                                            }}
                                        >
                                            <T>Continuer</T> <ArrowRight size={15} />
                                        </motion.button>
                                    ) : (
                                        <motion.button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={submitting || !validateStep()}
                                            whileHover={!submitting && validateStep() ? { scale: 1.02 } : {}}
                                            whileTap={!submitting && validateStep() ? { scale: 0.98 } : {}}
                                            className="flex items-center gap-2.5 font-black text-sm px-8 py-3.5 rounded-2xl text-[#030a15] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                            style={{
                                                background: 'linear-gradient(135deg, #FCD116, #f59e0b)',
                                                boxShadow: '0 2px 0 rgba(255,255,255,0.3) inset, 0 8px 30px rgba(252,209,22,0.4)',
                                            }}
                                        >
                                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} />}
                                            {submitting ? t('Envoi en cours...') : t('Soumettre ma candidature')}
                                            {!submitting && <ChevronRight size={14} />}
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {STEPS.map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{ width: i === step ? 28 : 8 }}
                            className={cn('h-2 rounded-full transition-colors', i < step ? 'bg-[#008751]' : i === step ? 'bg-[#FCD116]' : 'bg-gray-200')}
                        />
                    ))}
                </div>
            </div>

            {/* ── BOTTOM STATS ── */}
            <div className="relative z-10 border-t border-gray-100 bg-gray-50/50 py-12">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="grid grid-cols-3 gap-6 text-center">
                        {[
                            { icon: Users, value: '200+', label: 'Membres diaspora', from: '#2563eb', to: '#4f46e5' },
                            { icon: Globe, value: '4', label: 'Pays couverts', from: '#059669', to: '#0d9488' },
                            { icon: Shield, value: '100%', label: 'Réseau certifié', from: '#d97706', to: '#ca8a04' },
                        ].map(s => (
                            <div key={s.label} className="flex flex-col items-center gap-3">
                                <Icon3D icon={s.icon} from={s.from} to={s.to} size={18} containerSize={44} />
                                <div>
                                    <p className="text-2xl font-black text-[#008751]">{s.value}</p>
                                    <p className="text-[11px] text-gray-600 mt-0.5 font-bold"><T>{s.label}</T></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
