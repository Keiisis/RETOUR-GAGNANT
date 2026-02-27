'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Sparkles, Globe, Target, Calendar, Wallet, Award, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface OracleResult {
    service: string
    slug: string
    score: number
    hasOrigins: boolean
}

const steps = [
    {
        id: 'origin',
        title: 'Vos Origines',
        subtitle: 'Avez-vous des origines ou des liens avec le Bénin ?',
        icon: Globe,
        options: [
            { value: 'oui', label: 'Oui, origines béninoises', emoji: '🇧🇯' },
            { value: 'partiel', label: 'Liens familiaux / affectifs', emoji: '💚' },
            { value: 'non', label: 'Non, mais intéressé(e)', emoji: '🌍' },
        ]
    },
    {
        id: 'objective',
        title: 'Votre Objectif',
        subtitle: 'Quel est votre objectif principal au Bénin ?',
        icon: Target,
        options: [
            { value: 'nationalite', label: 'Obtenir la nationalité', emoji: '🛂' },
            { value: 'investir', label: 'Investir au Bénin', emoji: '📈' },
            { value: 'construire', label: 'Construire une maison', emoji: '🏗️' },
            { value: 'business', label: 'Créer une entreprise', emoji: '💼' },
            { value: 'culture', label: 'Découvrir mes racines', emoji: '🌳' },
            { value: 'logement', label: 'Acheter / Louer un bien', emoji: '🏠' },
        ]
    },
    {
        id: 'timeline',
        title: 'Votre Horizon',
        subtitle: 'Dans quel délai souhaitez-vous avancer ?',
        icon: Calendar,
        options: [
            { value: 'urgent', label: 'Dès que possible', emoji: '⚡' },
            { value: '6mois', label: 'Dans les 6 prochains mois', emoji: '📅' },
            { value: '1an', label: "D'ici 1 an", emoji: '🗓️' },
            { value: 'exploration', label: 'Je suis en exploration', emoji: '🔍' },
        ]
    },
    {
        id: 'budget',
        title: 'Votre Budget',
        subtitle: 'Quelle enveloppe avez-vous en tête ?',
        icon: Wallet,
        options: [
            { value: 'petit', label: 'Moins de 5M XOF', emoji: '💰' },
            { value: 'moyen', label: '5M - 25M XOF', emoji: '💰💰' },
            { value: 'grand', label: '25M - 100M XOF', emoji: '💰💰💰' },
            { value: 'illimite', label: 'Plus de 100M XOF', emoji: '🏦' },
        ]
    },
    {
        id: 'experience',
        title: 'Votre Expérience',
        subtitle: 'Avez-vous déjà fait des démarches au Bénin ?',
        icon: Award,
        options: [
            { value: 'jamais', label: 'Jamais, c\'est ma première fois', emoji: '🆕' },
            { value: 'peu', label: 'Quelques tentatives', emoji: '📝' },
            { value: 'oui', label: 'Oui, j\'ai de l\'expérience', emoji: '✅' },
        ]
    },
]

const contactStep = {
    id: 'contact',
    title: 'Vos Coordonnées',
    subtitle: 'Pour recevoir votre recommandation personnalisée',
    icon: Sparkles,
}

export default function SimulateurPage() {
    const [currentStep, setCurrentStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [nom, setNom] = useState('')
    const [prenom, setPrenom] = useState('')
    const [email, setEmail] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [result, setResult] = useState<OracleResult | null>(null)

    const totalSteps = steps.length + 1  // +1 for contact step
    const isQuizStep = currentStep < steps.length
    const isContactStep = currentStep === steps.length
    const isResultStep = result !== null

    const selectAnswer = (stepId: string, value: string) => {
        setAnswers(prev => ({ ...prev, [stepId]: value }))
        // Auto-advance
        setTimeout(() => {
            if (currentStep < totalSteps - 1) {
                setCurrentStep(prev => prev + 1)
            }
        }, 300)
    }

    const handleSubmit = async () => {
        if (!nom.trim() || !email.trim()) return
        setIsSubmitting(true)

        try {
            const res = await fetch('/api/oracle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom, prenom, email, whatsapp, answers })
            })
            const data = await res.json()
            if (data.success) {
                setResult(data.result)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const progressPercent = isResultStep ? 100 : Math.round((currentStep / totalSteps) * 100)

    return (
        <div className="min-h-screen bg-[#05080a] text-white relative overflow-hidden flex flex-col">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-[#008751]/8 rounded-full blur-[200px]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#FCD116]/5 rounded-full blur-[150px]" />
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#E8112D]/5 rounded-full blur-[130px]" />
            </div>

            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full bg-[#FCD116]/10 border border-[#FCD116]/20">
                        <Sparkles size={14} className="text-[#FCD116]" />
                        <span className="text-[11px] uppercase tracking-[4px] font-bold text-[#FCD116]">L&apos;Oracle</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black font-heading mb-4 tracking-tight">
                        Trouvez votre <span className="bg-gradient-to-r from-[#FCD116] to-[#E8112D] bg-clip-text text-transparent">voie</span>
                    </h1>
                    <p className="text-gray-400 max-w-xl mx-auto">
                        En 5 questions, découvrez le service Retour Gagnant fait pour vous.
                    </p>
                </motion.div>

                {/* Progress Bar */}
                {!isResultStep && (
                    <div className="w-full max-w-xl mb-10">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-[#008751] to-[#FCD116] rounded-full"
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <p className="text-gray-500 text-[11px] mt-2 text-center uppercase tracking-widest font-bold">
                            Étape {currentStep + 1} / {totalSteps}
                        </p>
                    </div>
                )}

                {/* Content */}
                <div className="w-full max-w-2xl">
                    <AnimatePresence mode="wait">
                        {/* Quiz Steps */}
                        {isQuizStep && !isResultStep && (
                            <motion.div
                                key={`step-${currentStep}`}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.3 }}
                            >
                                {(() => {
                                    const step = steps[currentStep]
                                    const StepIcon = step.icon
                                    return (
                                        <div className="text-center">
                                            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                                <StepIcon size={28} className="text-[#FCD116]" />
                                            </div>
                                            <h2 className="text-2xl font-black font-heading mb-2">{step.title}</h2>
                                            <p className="text-gray-400 mb-8">{step.subtitle}</p>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {step.options.map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => selectAnswer(step.id, opt.value)}
                                                        className={`p-5 rounded-2xl border text-left transition-all group hover:scale-[1.02] ${answers[step.id] === opt.value
                                                                ? 'bg-[#008751]/20 border-[#008751]/50 shadow-[0_0_30px_rgba(0,135,81,0.2)]'
                                                                : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                                                            }`}
                                                    >
                                                        <span className="text-2xl mb-2 block">{opt.emoji}</span>
                                                        <span className="text-sm font-bold">{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </motion.div>
                        )}

                        {/* Contact Step */}
                        {isContactStep && !isResultStep && (
                            <motion.div
                                key="contact"
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                            >
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                        <contactStep.icon size={28} className="text-[#FCD116]" />
                                    </div>
                                    <h2 className="text-2xl font-black font-heading mb-2">{contactStep.title}</h2>
                                    <p className="text-gray-400">{contactStep.subtitle}</p>
                                </div>

                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Nom</label>
                                            <input type="text" required value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom"
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Prénom</label>
                                            <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Votre prénom"
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Email</label>
                                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com"
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">WhatsApp (optionnel)</label>
                                        <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+229 XX XX XX XX"
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751]" />
                                    </div>

                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !nom.trim() || !email.trim()}
                                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FCD116] to-[#E5BD14] text-black font-black uppercase tracking-[3px] text-[13px] hover:shadow-[0_8px_30px_rgba(252,209,22,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-6"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                Analyse en cours...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} />
                                                Révéler ma recommandation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Result */}
                        {isResultStep && result && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="text-center"
                            >
                                {/* Score Ring */}
                                <div className="relative w-40 h-40 mx-auto mb-8">
                                    <svg className="w-40 h-40 -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                                        <motion.circle
                                            cx="50" cy="50" r="42" fill="none"
                                            stroke="#FCD116"
                                            strokeWidth="6"
                                            strokeLinecap="round"
                                            strokeDasharray={`${2 * Math.PI * 42}`}
                                            initial={{ strokeDashoffset: `${2 * Math.PI * 42}` }}
                                            animate={{ strokeDashoffset: `${2 * Math.PI * 42 * (1 - result.score / 100)}` }}
                                            transition={{ duration: 1.5, ease: 'easeOut' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-4xl font-black font-mono text-[#FCD116]">{result.score}</span>
                                        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">score</span>
                                    </div>
                                </div>

                                <h2 className="text-3xl font-black font-heading mb-4">
                                    Votre recommandation
                                </h2>

                                {/* Recommendation Card */}
                                <div className="bg-gradient-to-br from-[#008751]/20 to-[#008751]/5 border border-[#008751]/30 rounded-3xl p-8 mb-8 backdrop-blur-xl max-w-lg mx-auto">
                                    <Sparkles size={32} className="text-[#FCD116] mx-auto mb-4" />
                                    <h3 className="text-2xl font-black font-heading text-[#FCD116] mb-2">{result.service}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        {result.hasOrigins
                                            ? 'Vos origines béninoises renforcent votre éligibilité. Notre équipe est prête à vous accompagner dans cette démarche.'
                                            : 'Votre profil montre un fort intérêt pour le Bénin. Nous sommes prêts à vous accompagner.'}
                                    </p>
                                </div>

                                {/* CTA Buttons */}
                                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                                    <Link
                                        href={`/services/${result.slug}`}
                                        className="flex-1 py-4 px-6 rounded-2xl bg-[#008751] text-white font-black uppercase tracking-widest text-[12px] hover:bg-[#006a41] transition-all flex items-center justify-center gap-2"
                                    >
                                        Découvrir ce service
                                        <ArrowRight size={16} />
                                    </Link>
                                    <Link
                                        href="/rendez-vous"
                                        className="flex-1 py-4 px-6 rounded-2xl bg-[#FCD116] text-black font-black uppercase tracking-widest text-[12px] hover:bg-[#E5BD14] transition-all flex items-center justify-center gap-2"
                                    >
                                        Prendre rendez-vous
                                        <Sparkles size={16} />
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Navigation */}
                {!isResultStep && currentStep > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-8"
                    >
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                        >
                            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-sm font-bold uppercase tracking-widest">Précédent</span>
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
