"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Globe, Heart, MapPin, Users, FileText, Shield,
    Sparkles, ChevronRight, ChevronLeft, Loader2, Star,
    ArrowRight, Phone, Mail, User, Flag, Book, Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/* ────────────────── TYPES ────────────────── */
interface StepConfig {
    id: string;
    title: string;
    subtitle: string;
    icon: any;
    type: 'choice' | 'input' | 'multi' | 'textarea';
    options?: { value: string; label: string; emoji: string; detail?: string }[];
    inputConfig?: { name: string; placeholder: string; type?: string; required?: boolean }[];
}

interface OracleResult {
    score: number;
    service: string;
    slug: string;
    hasOrigins: boolean;
    insights: string[];
    reference?: string;
}

/* ────────────────── STEPS ────────────────── */
const journeySteps: StepConfig[] = [
    {
        id: 'lien_benin',
        title: 'Votre Lien avec le Bénin',
        subtitle: 'Quelle est votre connexion avec la terre de vos ancêtres ?',
        icon: Globe,
        type: 'choice',
        options: [
            { value: 'descendant_direct', label: 'Descendant direct', emoji: '🇧🇯', detail: 'Parents ou grands-parents béninois' },
            { value: 'afrodescendant', label: 'Afrodescendant', emoji: '🌍', detail: 'Racines africaines confirmées' },
            { value: 'lien_familial', label: 'Liens familiaux', emoji: '💚', detail: 'Conjoint, famille élargie' },
            { value: 'lien_affectif', label: 'Lien affectif / Spirituel', emoji: '✨', detail: 'Connexion culturelle profonde' },
            { value: 'aucun_mais_interesse', label: 'Aucun lien, mais intéressé', emoji: '🧭', detail: 'Découverte et aventure' },
        ]
    },
    {
        id: 'preuve_origine',
        title: 'Preuves de vos Origines',
        subtitle: 'Disposez-vous de documents attestant de votre lien avec le Bénin ?',
        icon: FileText,
        type: 'multi',
        options: [
            { value: 'acte_naissance_parent', label: 'Acte de naissance d\'un parent béninois', emoji: '📜' },
            { value: 'certificat_origine', label: 'Certificat d\'origine', emoji: '📋' },
            { value: 'livret_famille', label: 'Livret de famille', emoji: '📖' },
            { value: 'temoignages', label: 'Témoignages de la communauté', emoji: '🗣️' },
            { value: 'test_adn', label: 'Test ADN d\'afrodescendance', emoji: '🧬' },
            { value: 'aucun', label: 'Aucun document pour l\'instant', emoji: '❓' },
        ]
    },
    {
        id: 'motivation',
        title: 'Ce qui vous Motive',
        subtitle: 'Qu\'est-ce qui vous pousse à retrouver vos racines ?',
        icon: Heart,
        type: 'choice',
        options: [
            { value: 'identite', label: 'Retrouver mon identité', emoji: '🪞', detail: 'Reconnecter avec qui je suis' },
            { value: 'famille', label: 'Rejoindre ma famille', emoji: '👨‍👩‍👧‍👦', detail: 'Être auprès des miens' },
            { value: 'investir', label: 'Investir et construire', emoji: '🏗️', detail: 'Bâtir un avenir au Bénin' },
            { value: 'heritage', label: 'Préserver un héritage', emoji: '🏛️', detail: 'Transmettre aux générations futures' },
            { value: 'liberte', label: 'Liberté de circuler', emoji: '✈️', detail: 'Double nationalité, double liberté' },
            { value: 'retraite', label: 'Préparer ma retraite', emoji: '🌴', detail: 'Vieillir au soleil de mes ancêtres' },
        ]
    },
    {
        id: 'pays_residence',
        title: 'Votre Situation Actuelle',
        subtitle: 'Depuis quel horizon préparez-vous votre retour ?',
        icon: MapPin,
        type: 'choice',
        options: [
            { value: 'france', label: 'France', emoji: '🇫🇷' },
            { value: 'usa_canada', label: 'USA / Canada', emoji: '🇺🇸' },
            { value: 'belgique', label: 'Belgique', emoji: '🇧🇪' },
            { value: 'uk', label: 'Royaume-Uni', emoji: '🇬🇧' },
            { value: 'afrique', label: 'Autre pays d\'Afrique', emoji: '🌍' },
            { value: 'autre', label: 'Autre pays', emoji: '🗺️' },
        ]
    },
    {
        id: 'connaissance_benin',
        title: 'Votre Connaissance du Bénin',
        subtitle: 'Êtes-vous déjà allé au Bénin ?',
        icon: Compass,
        type: 'choice',
        options: [
            { value: 'jamais', label: 'Jamais, c\'est un rêve', emoji: '💭', detail: 'Premier voyage à prévoir' },
            { value: 'enfant', label: 'Oui, étant enfant', emoji: '👶', detail: 'Des souvenirs lointains' },
            { value: 'visite', label: 'Oui, en visite', emoji: '🧳', detail: 'Quelques séjours' },
            { value: 'regulier', label: 'Régulièrement', emoji: '🔄', detail: 'J\'y vais souvent' },
            { value: 'resident', label: 'J\'y vis actuellement', emoji: '🏠', detail: 'Déjà sur place' },
        ]
    },
    {
        id: 'langue_fon',
        title: 'Langues & Culture',
        subtitle: 'Parlez-vous une langue locale du Bénin ?',
        icon: Book,
        type: 'choice',
        options: [
            { value: 'couramment', label: 'Oui, couramment', emoji: '🗣️', detail: 'Fon, Yoruba, Mina...' },
            { value: 'un_peu', label: 'Quelques mots', emoji: '📝', detail: 'Notions de base' },
            { value: 'apprendre', label: 'Non, mais je veux apprendre', emoji: '📚', detail: 'Motivation forte' },
            { value: 'non', label: 'Non, uniquement le français', emoji: '🇫🇷', detail: 'Ce n\'est pas un obstacle' },
        ]
    },
    {
        id: 'contact_info',
        title: 'Restons en Contact',
        subtitle: 'Pour vous transmettre votre analyse personnalisée',
        icon: Users,
        type: 'input',
        inputConfig: [
            { name: 'nom', placeholder: 'Votre nom de famille', type: 'text', required: true },
            { name: 'prenom', placeholder: 'Votre prénom', type: 'text', required: true },
            { name: 'email', placeholder: 'votre@email.com', type: 'email', required: true },
            { name: 'whatsapp', placeholder: '+229 XX XX XX XX (WhatsApp)', type: 'tel' },
        ]
    },
    {
        id: 'message_libre',
        title: 'Un Mot pour Nous',
        subtitle: 'Partagez ce qui vous tient à cœur — nous lisons chaque message.',
        icon: Heart,
        type: 'textarea',
    },
];

/* ────────────────── SCORING ────────────────── */
function calculateScore(answers: Record<string, any>): OracleResult {
    let score = 50;
    const insights: string[] = [];

    // Origin scoring
    if (answers.lien_benin === 'descendant_direct') { score += 25; insights.push("Vos origines directes sont un atout majeur pour votre dossier."); }
    else if (answers.lien_benin === 'afrodescendant') { score += 20; insights.push("Votre afrodescendance ouvre la voie à la nationalité via la loi de 2022."); }
    else if (answers.lien_benin === 'lien_familial') { score += 15; insights.push("Vos liens familiaux constituent une base solide."); }
    else if (answers.lien_benin === 'lien_affectif') { score += 10; insights.push("Votre connexion culturelle est valorisée dans le processus."); }
    else { score += 5; insights.push("Un accompagnement personnalisé sera nécessaire, mais tout est possible."); }

    // Document scoring
    const docs = answers.preuve_origine || [];
    if (docs.includes('acte_naissance_parent')) { score += 10; insights.push("L'acte de naissance parental accélère considérablement le processus."); }
    if (docs.includes('test_adn')) { score += 5; insights.push("Le test ADN est un complément reconnu par les autorités."); }
    if (docs.includes('certificat_origine') || docs.includes('livret_famille')) { score += 8; }
    if (docs.includes('aucun')) { insights.push("Ne vous inquiétez pas, nous vous aidons à rassembler les preuves nécessaires."); }

    // Knowledge bonus
    if (answers.connaissance_benin === 'regulier' || answers.connaissance_benin === 'resident') { score += 5; }
    if (answers.langue_fon === 'couramment') { score += 5; insights.push("Votre maîtrise d'une langue locale sera très appréciée."); }
    else if (answers.langue_fon === 'un_peu') { score += 2; }

    const hasOrigins = ['descendant_direct', 'afrodescendant', 'lien_familial'].includes(answers.lien_benin);
    const finalScore = Math.min(score, 98);

    return {
        score: finalScore,
        service: 'Passeport & Nationalité Béninoise',
        slug: 'passeport',
        hasOrigins,
        insights,
    };
}

/* ────────────────── PARTICLES COMPONENT ────────────────── */
function FloatingParticles() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: 3 + Math.random() * 4,
                        height: 3 + Math.random() * 4,
                        background: ['#008751', '#FCD116', '#E8112D', '#ffffff'][i % 4],
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        opacity: 0.15 + Math.random() * 0.25,
                    }}
                    animate={{
                        y: [0, -30 - Math.random() * 40, 0],
                        x: [0, 15 - Math.random() * 30, 0],
                        opacity: [0.15, 0.4, 0.15],
                    }}
                    transition={{
                        duration: 6 + Math.random() * 6,
                        repeat: Infinity,
                        delay: Math.random() * 4,
                    }}
                />
            ))}
        </div>
    );
}

/* ────────────────── PROGRESS RING ────────────────── */
function ScoreRing({ score, size = 180 }: { score: number; size?: number }) {
    const r = (size / 2) - 12;
    const circ = 2 * Math.PI * r;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,135,81,0.1)" strokeWidth="8" />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ * (1 - score / 100) }}
                    transition={{ duration: 2, ease: 'easeOut', delay: 0.3 }}
                />
                <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#008751" />
                        <stop offset="50%" stopColor="#FCD116" />
                        <stop offset="100%" stopColor="#E8112D" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    className="text-5xl font-black font-heading text-[#008751]"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.6, type: 'spring' }}
                >
                    {score}
                </motion.span>
                <span className="text-[10px] uppercase tracking-[4px] text-gray-400 font-bold mt-1">/ 100</span>
            </div>
        </div>
    );
}

/* ────────────────── MAIN COMPONENT ────────────────── */
export default function NationalitySection() {
    const [mode, setMode] = useState<'intro' | 'journey' | 'result'>('intro');
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [contactInfo, setContactInfo] = useState({ nom: '', prenom: '', email: '', whatsapp: '' });
    const [freeMessage, setFreeMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<OracleResult | null>(null);
    const [direction, setDirection] = useState(1);

    const step = journeySteps[currentStep];
    const totalSteps = journeySteps.length;
    const progress = Math.round(((currentStep + 1) / totalSteps) * 100);

    const canProceed = useCallback(() => {
        if (!step) return false;
        if (step.type === 'choice') return !!answers[step.id];
        if (step.type === 'multi') return (answers[step.id] || []).length > 0;
        if (step.type === 'input') return contactInfo.nom.trim() && contactInfo.email.trim();
        if (step.type === 'textarea') return true;
        return true;
    }, [step, answers, contactInfo]);

    const selectChoice = (value: string) => {
        setAnswers(prev => ({ ...prev, [step.id]: value }));
        setTimeout(() => goNext(), 400);
    };

    const toggleMulti = (value: string) => {
        setAnswers(prev => {
            const current = prev[step.id] || [];
            if (value === 'aucun') return { ...prev, [step.id]: ['aucun'] };
            const filtered = current.filter((v: string) => v !== 'aucun');
            return {
                ...prev,
                [step.id]: filtered.includes(value) ? filtered.filter((v: string) => v !== value) : [...filtered, value]
            };
        });
    };

    const goNext = () => {
        if (currentStep < totalSteps - 1) {
            setDirection(1);
            setCurrentStep(prev => prev + 1);
        }
    };

    const goBack = () => {
        if (currentStep > 0) {
            setDirection(-1);
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        const calculatedResult = calculateScore(answers);

        try {
            const res = await fetch('/api/oracle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: contactInfo.nom,
                    prenom: contactInfo.prenom,
                    email: contactInfo.email,
                    whatsapp: contactInfo.whatsapp,
                    answers: {
                        ...answers,
                        message_libre: freeMessage,
                        origin: answers.lien_benin === 'descendant_direct' || answers.lien_benin === 'afrodescendant' ? 'oui' : answers.lien_benin === 'lien_familial' ? 'partiel' : 'non',
                        objective: 'nationalite',
                        timeline: 'urgent',
                        budget: 'moyen',
                        experience: answers.connaissance_benin === 'jamais' ? 'jamais' : 'oui',
                    },
                }),
            });

            const data = await res.json();
            if (data.success) {
                calculatedResult.reference = `#RG-${String(Date.now()).slice(-6)}`;
            }
        } catch (err) {
            console.error('Oracle submission error:', err);
        }

        // Also submit to nationality API for agent notification
        try {
            await fetch('/api/nationality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: contactInfo.nom,
                    prenom: contactInfo.prenom,
                    email: contactInfo.email,
                    nationalite_actuelle: answers.pays_residence || '',
                    motivation: `${answers.motivation || ''} | ${freeMessage}`,
                }),
            });
        } catch { }

        setResult(calculatedResult);
        setMode('result');
        setIsSubmitting(false);
    };

    /* ───────── SLIDE VARIANTS ───────── */
    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
    };

    return (
        <section className="py-16 md:py-24 bg-gradient-to-b from-white to-[#fafafa] relative overflow-hidden" id="nationalite">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[#008751]/5 -skew-x-12 transform origin-top-right z-0" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FCD116]/5 rounded-full blur-[100px]" />
            <div className="absolute top-20 right-20 w-40 h-40 bg-[#E8112D]/5 rounded-full blur-[80px]" />

            <div className="container mx-auto px-4 relative z-10">

                {/* ═══════════ INTRO MODE ═══════════ */}
                <AnimatePresence mode="wait">
                    {mode === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -30 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                        >
                            {/* Left: Content */}
                            <div className="space-y-6">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-block px-4 py-1.5 rounded-full bg-[#E8112D]/10 text-[#E8112D] text-sm font-semibold tracking-widest uppercase mb-2"
                                >
                                    Identité & Citoyenneté
                                </motion.div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-4xl md:text-5xl font-bold font-heading text-[#1a2332] leading-tight"
                                >
                                    Obtenir la <span className="text-benin-gradient">Nationalité Béninoise</span>
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-lg text-gray-600 leading-relaxed"
                                >
                                    Retrouvez votre fierté et vos droits. Que vous soyez descendant d'afro-descendants ou ayant des liens familiaux, nous vous accompagnons dans toutes les démarches administratives pour officialiser votre appartenance au Bénin.
                                </motion.p>

                                <motion.ul
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="space-y-4 pt-4"
                                >
                                    {[
                                        "Analyse de votre éligibilité",
                                        "Constitution du dossier complet",
                                        "Dépôt et suivi auprès des autorités",
                                        "Accompagnement jusqu'à l'obtention du passeport"
                                    ].map((item, i) => (
                                        <motion.li
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + i * 0.1 }}
                                            className="flex items-center gap-3"
                                        >
                                            <CheckCircle2 className="text-[#008751] w-5 h-5 flex-shrink-0" />
                                            <span className="text-gray-700 font-medium">{item}</span>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                            </div>

                            {/* Right: Interactive CTA Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 }}
                                className="relative"
                            >
                                <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 border border-gray-100 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-t-3xl" />
                                    <FloatingParticles />

                                    <div className="relative z-10 text-center space-y-6">
                                        <motion.div
                                            animate={{ rotate: [0, 5, -5, 0] }}
                                            transition={{ duration: 4, repeat: Infinity }}
                                            className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#008751] to-[#006a41] flex items-center justify-center shadow-lg"
                                        >
                                            <Shield size={36} className="text-white" />
                                        </motion.div>

                                        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 font-heading">
                                            Testez votre Éligibilité
                                        </h3>
                                        <p className="text-gray-500 leading-relaxed max-w-sm mx-auto">
                                            Répondez à quelques questions pour découvrir votre profil et recevoir une analyse personnalisée de notre équipe.
                                        </p>

                                        <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                                            <span className="flex items-center gap-1.5"><Sparkles size={14} className="text-[#FCD116]" /> 2 min</span>
                                            <span className="flex items-center gap-1.5"><Shield size={14} className="text-[#008751]" /> Confidentiel</span>
                                            <span className="flex items-center gap-1.5"><Star size={14} className="text-[#E8112D]" /> Gratuit</span>
                                        </div>

                                        <Button
                                            onClick={() => setMode('journey')}
                                            className="w-full bg-[#1a2332] hover:bg-[#0f1520] text-white font-bold py-7 rounded-2xl text-base transition-all shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] group"
                                        >
                                            <span>Commencer l'Analyse</span>
                                            <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* ═══════════ JOURNEY MODE ═══════════ */}
                    {mode === 'journey' && step && (
                        <motion.div
                            key="journey"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="max-w-2xl mx-auto"
                        >
                            {/* Progress */}
                            <div className="mb-10">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[11px] uppercase tracking-[3px] font-bold text-[#008751]">
                                        Étape {currentStep + 1} / {totalSteps}
                                    </span>
                                    <span className="text-[11px] uppercase tracking-[3px] font-bold text-gray-400">
                                        {progress}%
                                    </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full"
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>

                            {/* Step Content */}
                            <AnimatePresence mode="wait" custom={direction}>
                                <motion.div
                                    key={step.id}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                                >
                                    <div className="bg-white rounded-3xl shadow-xl p-8 md:p-10 border border-gray-100 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                                        <FloatingParticles />

                                        <div className="relative z-10">
                                            {/* Step Header */}
                                            <div className="text-center mb-8">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                                                    className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#008751]/10 to-[#008751]/5 border border-[#008751]/20 flex items-center justify-center"
                                                >
                                                    <step.icon size={28} className="text-[#008751]" />
                                                </motion.div>
                                                <h3 className="text-2xl font-bold text-gray-800 font-heading mb-2">{step.title}</h3>
                                                <p className="text-gray-500 text-sm">{step.subtitle}</p>
                                            </div>

                                            {/* Choice Type */}
                                            {step.type === 'choice' && step.options && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {step.options.map((opt, i) => {
                                                        const isSelected = answers[step.id] === opt.value;
                                                        return (
                                                            <motion.button
                                                                key={opt.value}
                                                                initial={{ opacity: 0, y: 15 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.05 }}
                                                                onClick={() => selectChoice(opt.value)}
                                                                className={`p-4 rounded-2xl border-2 text-left transition-all group hover:scale-[1.02] active:scale-[0.98] ${isSelected
                                                                    ? 'bg-[#008751]/5 border-[#008751] shadow-[0_0_20px_rgba(0,135,81,0.15)]'
                                                                    : 'bg-gray-50/50 border-gray-100 hover:border-[#008751]/30 hover:bg-[#008751]/[0.02]'
                                                                    }`}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <span className="text-2xl">{opt.emoji}</span>
                                                                    <div>
                                                                        <span className="text-sm font-bold text-gray-800 block">{opt.label}</span>
                                                                        {opt.detail && <span className="text-xs text-gray-400 mt-0.5 block">{opt.detail}</span>}
                                                                    </div>
                                                                    {isSelected && (
                                                                        <CheckCircle2 size={18} className="text-[#008751] ml-auto flex-shrink-0 mt-0.5" />
                                                                    )}
                                                                </div>
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Multi-select Type */}
                                            {step.type === 'multi' && step.options && (
                                                <div className="space-y-3">
                                                    <p className="text-xs text-gray-400 text-center mb-4">Sélectionnez tous les éléments qui s'appliquent</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {step.options.map((opt, i) => {
                                                            const selected = (answers[step.id] || []).includes(opt.value);
                                                            return (
                                                                <motion.button
                                                                    key={opt.value}
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: i * 0.04 }}
                                                                    onClick={() => toggleMulti(opt.value)}
                                                                    className={`p-4 rounded-2xl border-2 text-left transition-all hover:scale-[1.01] ${selected ? 'bg-[#008751]/5 border-[#008751]' : 'bg-gray-50/50 border-gray-100 hover:border-gray-200'}`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-xl">{opt.emoji}</span>
                                                                        <span className="text-sm font-medium text-gray-700 flex-1">{opt.label}</span>
                                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-[#008751] border-[#008751]' : 'border-gray-300'}`}>
                                                                            {selected && <CheckCircle2 size={12} className="text-white" />}
                                                                        </div>
                                                                    </div>
                                                                </motion.button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Input Type */}
                                            {step.type === 'input' && step.inputConfig && (
                                                <div className="space-y-4">
                                                    {step.inputConfig.map((field, i) => (
                                                        <motion.div
                                                            key={field.name}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.08 }}
                                                        >
                                                            <div className="relative">
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                                                    {field.name === 'nom' && <User size={16} />}
                                                                    {field.name === 'prenom' && <User size={16} />}
                                                                    {field.name === 'email' && <Mail size={16} />}
                                                                    {field.name === 'whatsapp' && <Phone size={16} />}
                                                                </div>
                                                                <input
                                                                    type={field.type || 'text'}
                                                                    value={(contactInfo as any)[field.name] || ''}
                                                                    onChange={(e) => setContactInfo(prev => ({ ...prev, [field.name]: e.target.value }))}
                                                                    placeholder={field.placeholder}
                                                                    required={field.required}
                                                                    className="w-full pl-11 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#008751] focus:bg-white transition-all text-sm font-medium"
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Textarea Type */}
                                            {step.type === 'textarea' && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                    <textarea
                                                        value={freeMessage}
                                                        onChange={(e) => setFreeMessage(e.target.value)}
                                                        rows={5}
                                                        placeholder="Partagez votre histoire, vos questions, ou ce que vous attendez de nous... (facultatif)"
                                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#008751] focus:bg-white transition-all text-sm font-medium resize-none"
                                                    />
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Navigation */}
                            <div className="flex items-center justify-between mt-8">
                                <button
                                    onClick={currentStep === 0 ? () => setMode('intro') : goBack}
                                    className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors group text-sm font-bold"
                                >
                                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                                    Retour
                                </button>

                                {currentStep < totalSteps - 1 ? (
                                    <Button
                                        onClick={goNext}
                                        disabled={!canProceed()}
                                        className="bg-[#008751] hover:bg-[#006a41] text-white font-bold py-3 px-8 rounded-2xl disabled:opacity-30 group transition-all"
                                    >
                                        Continuer
                                        <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !canProceed()}
                                        className="bg-gradient-to-r from-[#008751] to-[#006a41] hover:from-[#006a41] hover:to-[#004d30] text-white font-bold py-3 px-8 rounded-2xl disabled:opacity-30 group transition-all shadow-lg"
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 size={16} className="animate-spin mr-2" /> Analyse en cours...</>
                                        ) : (
                                            <><Sparkles size={16} className="mr-2" /> Obtenir mon Analyse</>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ═══════════ RESULT MODE ═══════════ */}
                    {mode === 'result' && result && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="max-w-2xl mx-auto text-center"
                        >
                            <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />
                                <FloatingParticles />

                                <div className="relative z-10">
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-[#008751]/10 text-[#008751] text-xs font-bold uppercase tracking-[3px]"
                                    >
                                        <Sparkles size={14} /> Analyse Terminée
                                    </motion.div>

                                    {/* Score */}
                                    <div className="flex justify-center mb-8">
                                        <ScoreRing score={result.score} />
                                    </div>

                                    <h2 className="text-2xl md:text-3xl font-black font-heading text-gray-800 mb-2">
                                        {contactInfo.prenom ? `Bravo ${contactInfo.prenom} !` : 'Résultat de votre Analyse'}
                                    </h2>
                                    <p className="text-gray-500 mb-8 text-sm">
                                        {result.score >= 80
                                            ? 'Votre profil est très prometteur pour l\'obtention de la nationalité béninoise.'
                                            : result.score >= 60
                                                ? 'Votre dossier nécessite un accompagnement spécialisé. Nous sommes là pour vous.'
                                                : 'Chaque parcours est unique. Nos experts peuvent vous orienter vers la meilleure option.'
                                        }
                                    </p>

                                    {/* Insights */}
                                    <div className="space-y-3 mb-8 text-left">
                                        {result.insights.map((insight, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 1 + i * 0.15 }}
                                                className="flex items-start gap-3 p-3 rounded-xl bg-gray-50"
                                            >
                                                <CheckCircle2 size={16} className="text-[#008751] flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-gray-600">{insight}</span>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Reference */}
                                    {result.reference && (
                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 1.5 }}
                                            className="text-xs font-mono text-gray-400 bg-gray-50 py-2 px-4 rounded-lg inline-block mb-6"
                                        >
                                            Référence : <span className="font-bold text-[#008751]">{result.reference}</span>
                                        </motion.p>
                                    )}

                                    {/* CTA */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1.8 }}
                                        className="flex flex-col sm:flex-row gap-4"
                                    >
                                        <Link href="/rendez-vous" className="flex-1">
                                            <Button className="w-full bg-[#008751] hover:bg-[#006a41] text-white font-bold py-6 rounded-2xl text-sm shadow-lg group">
                                                Prendre Rendez-vous
                                                <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </Link>
                                        <Link href={`/services/${result.slug}`} className="flex-1">
                                            <Button variant="outline" className="w-full border-2 border-gray-200 hover:border-[#008751] text-gray-700 hover:text-[#008751] font-bold py-6 rounded-2xl text-sm group">
                                                Découvrir nos Services
                                                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </Link>
                                    </motion.div>

                                    <p className="text-xs text-gray-400 mt-6">
                                        Un expert vous contactera sous 24h pour discuter de votre dossier.
                                    </p>
                                </div>
                            </div>

                            {/* Restart */}
                            <button
                                onClick={() => { setMode('intro'); setCurrentStep(0); setAnswers({}); setContactInfo({ nom: '', prenom: '', email: '', whatsapp: '' }); setFreeMessage(''); setResult(null); }}
                                className="mt-6 text-sm text-gray-400 hover:text-[#008751] font-medium transition-colors"
                            >
                                Recommencer l'analyse
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
