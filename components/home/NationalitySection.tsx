"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Globe, Heart, MapPin, Users, FileText, Shield,
    Sparkles, ChevronRight, ChevronLeft, Loader2, Star,
    ArrowRight, Phone, Mail, User, Compass, Fingerprint,
    Landmark, ScrollText, Dna, BookOpen, Scaling, CheckSquare,
    MessageSquare, Home, FileCheck2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";

/* ────────────────── IMMERSIVE COMPONENTS ────────────────── */
const FloatingParticles = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={`particle-${i}`}
                    className="absolute bg-white rounded-full opacity-20"
                    style={{
                        width: Math.random() * 6 + 2 + 'px',
                        height: Math.random() * 6 + 2 + 'px',
                        left: Math.random() * 100 + '%',
                        top: Math.random() * 100 + '%',
                    }}
                    animate={{
                        y: [0, Math.random() * -100 - 50],
                        x: [0, Math.random() * 50 - 25],
                        opacity: [0, 0.4, 0],
                        scale: [0, 1, 0.5],
                    }}
                    transition={{
                        duration: Math.random() * 5 + 5,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 5,
                    }}
                />
            ))}
        </div>
    );
};

const ScoreRing = ({ score }: { score: number }) => {
    return (
        <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center">
            {/* Glowing background */}
            <motion.div
                className="absolute inset-0 bg-[#008751]/20 rounded-full blur-2xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
            />
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90 filter drop-shadow-xl" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                <motion.circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="url(#gradient)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="283"
                    initial={{ strokeDashoffset: 283 }}
                    animate={{ strokeDashoffset: 283 - (283 * score) / 100 }}
                    transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#008751" />
                        <stop offset="50%" stopColor="#FCD116" />
                        <stop offset="100%" stopColor="#E8112D" />
                    </linearGradient>
                </defs>
            </svg>
            {/* Inner Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-full m-2 shadow-inner border border-gray-100/50">
                <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.5, type: "spring" }}
                    className="text-5xl font-black font-heading text-transparent bg-clip-text bg-gradient-to-br from-[#1a2332] to-[#008751]"
                >
                    {score}%
                </motion.span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Potentiel</span>
            </div>
        </div>
    );
};


/* ────────────────── TYPES ────────────────── */
interface OptionData {
    value: string;
    label: string;
    icon: any;
    detail?: string;
}

interface StepConfig {
    id: string;
    title: string;
    subtitle: string;
    icon: any;
    type: 'choice' | 'input' | 'multi' | 'textarea';
    options?: OptionData[];
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
            { value: 'descendant_direct', label: 'Descendant direct', icon: Users, detail: 'Parents ou grands-parents béninois' },
            { value: 'afrodescendant', label: 'Afrodescendant', icon: Fingerprint, detail: 'Racines africaines confirmées' },
            { value: 'lien_familial', label: 'Liens familiaux', icon: Heart, detail: 'Conjoint, famille élargie' },
            { value: 'lien_affectif', label: 'Lien affectif / Spirituel', icon: Sparkles, detail: 'Connexion culturelle profonde' },
            { value: 'aucun_mais_interesse', label: 'Aucun lien, mais intéressé', icon: Compass, detail: 'Découverte et aventure' },
        ]
    },
    {
        id: 'preuve_origine',
        title: 'Preuves de vos Origines',
        subtitle: 'Disposez-vous de documents attestant de votre lien avec le Bénin ?',
        icon: FileText,
        type: 'multi',
        options: [
            { value: 'acte_naissance_parent', label: 'Acte de naissance parental', icon: ScrollText },
            { value: 'certificat_origine', label: 'Certificat d\'origine', icon: FileCheck2 },
            { value: 'livret_famille', label: 'Livret de famille', icon: BookOpen },
            { value: 'temoignages', label: 'Témoignages communautaires', icon: MessageSquare },
            { value: 'test_adn', label: 'Test ADN d\'afrodescendance', icon: Dna },
            { value: 'aucun', label: 'Aucun document', icon: Scaling },
        ]
    },
    {
        id: 'motivation',
        title: 'Ce qui vous Motive',
        subtitle: 'Qu\'est-ce qui vous pousse à retrouver vos racines ?',
        icon: Landmark,
        type: 'choice',
        options: [
            { value: 'identite', label: 'Retrouver mon identité', icon: Fingerprint, detail: 'Reconnecter avec qui je suis' },
            { value: 'famille', label: 'Rejoindre ma famille', icon: Users, detail: 'Être auprès des miens' },
            { value: 'investir', label: 'Investir et construire', icon: Landmark, detail: 'Bâtir un avenir au Bénin' },
            { value: 'heritage', label: 'Préserver un héritage', icon: ScrollText, detail: 'Transmettre aux générations' },
            { value: 'liberte', label: 'Liberté de circuler', icon: Compass, detail: 'Double nationalité' },
            { value: 'retraite', label: 'Préparer ma retraite', icon: Home, detail: 'Vieillir au soleil' },
        ]
    },
    {
        id: 'pays_residence',
        title: 'Votre Situation Actuelle',
        subtitle: 'Depuis quel horizon préparez-vous votre retour ?',
        icon: MapPin,
        type: 'choice',
        options: [
            { value: 'europe', label: 'Europe (France, Belgique...)', icon: Globe },
            { value: 'amerique', label: 'Amériques (USA, Canada...)', icon: Globe },
            { value: 'afrique', label: 'Autre pays d\'Afrique', icon: Globe },
            { value: 'autre', label: 'Autre région du monde', icon: Globe },
        ]
    },
    {
        id: 'contact_info',
        title: 'Restons en Contact',
        subtitle: 'Pour vous transmettre votre analyse personnalisée',
        icon: Shield,
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
        title: 'Exprimez-vous',
        subtitle: 'Partagez votre histoire ou vos questions. Nous lisons chaque message avec attention.',
        icon: MessageSquare,
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
    if (docs.includes('acte_naissance_parent')) { score += 10; insights.push("L'acte de naissance parentale accélère considérablement le processus."); }
    if (docs.includes('test_adn')) { score += 5; insights.push("Le test ADN est un excellent complément reconnu par les autorités."); }
    if (docs.includes('certificat_origine') || docs.includes('livret_famille')) { score += 8; }
    if (docs.includes('aucun')) { insights.push("Ne vous inquiétez pas, nous vous aidons à rassembler ou reconstituer les preuves nécessaires."); }

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
        if (step.type === 'input') return contactInfo.nom.trim() !== '' && contactInfo.email.trim() !== '';
        if (step.type === 'textarea') return true;
        return true;
    }, [step, answers, contactInfo]);

    const selectChoice = (value: string) => {
        setAnswers(prev => ({ ...prev, [step.id]: value }));
        setTimeout(() => goNext(), 300); // Rapide transition
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

        // Map context for motivation
        const labels: Record<string, string> = {
            'identite': 'Retrouver son identité',
            'famille': 'Rejoindre la famille',
            'investir': 'Investir/Construire',
            'heritage': 'Préserver l\'héritage',
            'liberte': 'Liberté de circuler',
            'retraite': 'Retraite'
        };
        const motivationLabel = labels[answers.motivation] || 'Non spécifié';
        const combinedMotivation = `Motivation: ${motivationLabel}\n\nMessage du client:\n${freeMessage || 'Aucun message supplémentaire.'}`;

        // 1. Submit to Oracle (for Admin Dashboard)
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
                        experience: 'jamais',
                    },
                }),
            });

            const data = await res.json();
            if (data.success) {
                calculatedResult.reference = `#RG-${String(Date.now()).slice(-6)}`;
            }
        } catch (err) {
            console.error('Oracle error:', err);
        }

        // 2. Submit to Nationality (for Agent Dashboard et Notification Client)
        try {
            await fetch('/api/nationality', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nom: contactInfo.nom,
                    prenom: contactInfo.prenom,
                    email: contactInfo.email,
                    nationalite_actuelle: answers.pays_residence || 'Non spécifiée',
                    motivation: combinedMotivation,
                }),
            });
        } catch (err) {
            console.error('Nationality error:', err);
        }

        setResult(calculatedResult);
        setMode('result');
        setIsSubmitting(false);
    };

    /* ───────── ANIMATION VARIANTS ───────── */
    const slideVariants = {
        enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -50 : 50, opacity: 0 }),
    };

    return (
        <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafafa] relative overflow-hidden" id="nationalite">
            {/* Minimalist Background Decor respecting original colors */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[#008751]/5 -skew-x-12 transform origin-top-right z-0 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#FCD116]/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 relative z-10">

                {/* ═══════════ INTRO MODE ═══════════ */}
                <AnimatePresence mode="wait">
                    {mode === 'intro' && (
                        <motion.div
                            key="intro"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -20, filter: 'blur(5px)' }}
                            transition={{ duration: 0.4 }}
                            className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
                        >
                            {/* Left: Content */}
                            <div className="space-y-8">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#E8112D]/10 text-[#E8112D] text-sm font-bold tracking-widest uppercase"
                                >
                                    Identité & Citoyenneté
                                </motion.div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-4xl md:text-6xl font-bold font-heading text-[#1a2332] leading-[1.1]"
                                >
                                    Obtenir la <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]">Nationalité Béninoise</span>
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-xl text-gray-600 leading-relaxed max-w-lg"
                                >
                                    Retrouvez votre fierté et vos droits. Que vous soyez descendant d'afro-descendants ou ayant des liens familiaux, nous vous accompagnons dans toutes les démarches administratives.
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="space-y-5"
                                >
                                    {[
                                        "Analyse approfondie de votre dossier",
                                        "Recherche ou reconstitution de preuves",
                                        "Dépôt et suivi VIP auprès des autorités",
                                        "Accompagnement jusqu'au passeport"
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-6 h-6 rounded-full bg-[#008751]/10 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-[#008751]" />
                                            </div>
                                            <span className="text-gray-700 font-medium text-lg">{item}</span>
                                        </div>
                                    ))}
                                </motion.div>
                            </div>

                            {/* Right: Immersive Starter Card */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
                                className="relative"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-[2.5rem] blur opacity-20" />
                                <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 md:p-14 relative overflow-hidden border border-gray-100 flex flex-col items-center text-center">

                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[100px] -z-10" />

                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                        className="w-24 h-24 mb-8 rounded-3xl bg-gradient-to-br from-[#1a2332] to-[#2a364a] shadow-2xl shadow-[#1a2332]/20 flex items-center justify-center relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 border-[3px] border-white/10 rounded-3xl" />
                                        <Shield size={40} className="text-[#FCD116]" strokeWidth={1.5} />
                                    </motion.div>

                                    <h3 className="text-3xl font-bold text-gray-900 font-heading mb-4">
                                        Test d'Éligibilité
                                    </h3>
                                    <p className="text-gray-500 mb-10 text-lg">
                                        Découvrez vos chances d'obtenir la nationalité béninoise et recevez un plan d'action concret en 6 étapes interactives.
                                    </p>

                                    <Button
                                        onClick={() => setMode('journey')}
                                        className="w-full h-16 bg-[#1a2332] hover:bg-[#2a364a] text-white font-bold rounded-2xl text-lg shadow-[0_10px_40px_-10px_rgba(26,35,50,0.5)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-10px_rgba(26,35,50,0.6)] group"
                                    >
                                        <span className="flex items-center gap-3">
                                            Démarrer l'Analyse
                                            <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                        </span>
                                    </Button>

                                    <div className="flex items-center gap-6 mt-8 text-sm font-medium text-gray-400">
                                        <span className="flex items-center gap-2"><Sparkles size={16} className="text-[#FCD116]" /> Rapide</span>
                                        <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#008751]" /> Confidentiel</span>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}

                    {/* ═══════════ INTERACTIVE JOURNEY MODE ═══════════ */}
                    {mode === 'journey' && step && (
                        <motion.div
                            key="journey"
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                            className="max-w-3xl mx-auto"
                        >
                            {/* Header Progress */}
                            <div className="mb-10 lg:mb-12">
                                <div className="flex justify-between items-end mb-4">
                                    <div>
                                        <h3 className="text-[#008751] font-bold tracking-widest text-xs uppercase mb-1">
                                            Étape {currentStep + 1} de {totalSteps}
                                        </h3>
                                        <p className="text-gray-400 text-sm font-medium">Analyse en cours...</p>
                                    </div>
                                    <div className="text-2xl font-black text-gray-300 font-heading">
                                        {progress}%
                                    </div>
                                </div>
                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] rounded-full relative"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                    >
                                        <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
                                    </motion.div>
                                </div>
                            </div>

                            {/* Dynamic Card */}
                            <AnimatePresence mode="popLayout" custom={direction}>
                                <motion.div
                                    key={step.id}
                                    custom={direction}
                                    variants={slideVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ duration: 0.4, type: "spring", stiffness: 300, damping: 30 }}
                                    className="bg-white rounded-[2rem] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] p-8 md:p-12 border border-gray-100 relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100" />
                                    <motion.div
                                        className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-[#008751] to-[#FCD116]"
                                        initial={{ width: '0%' }}
                                        animate={{ width: '100%' }}
                                        transition={{ duration: 0.8, delay: 0.2 }}
                                    />

                                    {/* Question Header */}
                                    <div className="flex flex-col items-center text-center mb-10">
                                        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 shadow-inner relative">
                                            {(() => {
                                                const Icon = step.icon;
                                                return <Icon size={28} className="text-[#1a2332]" strokeWidth={1.5} />;
                                            })()}
                                            {step.id === 'contact_info' && <motion.div className="absolute -top-1 -right-1 w-3 h-3 bg-[#008751] rounded-full border-2 border-white" animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} />}
                                        </div>
                                        <h2 className="text-3xl font-black text-gray-900 font-heading mb-3">{step.title}</h2>
                                        <p className="text-gray-500 text-lg max-w-md">{step.subtitle}</p>
                                    </div>

                                    {/* Form Elements Based on Type */}
                                    <div className="relative z-10 w-full max-w-2xl mx-auto">

                                        {/* CHOICE TYPE */}
                                        {step.type === 'choice' && step.options && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {step.options.map((opt, i) => {
                                                    const isSelected = answers[step.id] === opt.value;
                                                    return (
                                                        <motion.button
                                                            key={opt.value}
                                                            whileHover={{ scale: 1.02, y: -2 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            initial={{ opacity: 0, y: 15 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            onClick={() => selectChoice(opt.value)}
                                                            className={`relative p-5 rounded-2xl border-2 text-left transition-all overflow-hidden ${isSelected
                                                                ? 'bg-[#008751]/5 border-[#008751] shadow-[0_8px_20px_rgba(0,135,81,0.15)] ring-1 ring-[#008751]/20'
                                                                : 'bg-white border-gray-100 shadow-sm hover:border-[#008751]/40 hover:shadow-md'
                                                                }`}
                                                        >
                                                            {isSelected && (
                                                                <motion.div layoutId="choice-bg" className="absolute inset-0 bg-gradient-to-br from-[#008751]/5 to-transparent z-0" />
                                                            )}
                                                            <div className="relative z-10 flex items-start gap-4">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-[#008751] text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                                    {(() => {
                                                                        const Icon = opt.icon;
                                                                        return <Icon size={20} strokeWidth={isSelected ? 2 : 1.5} />;
                                                                    })()}
                                                                </div>
                                                                <div>
                                                                    <span className={`text-base font-bold block ${isSelected ? 'text-[#008751]' : 'text-gray-800'}`}>{opt.label}</span>
                                                                    {opt.detail && <span className="text-sm text-gray-500 block mt-1">{opt.detail}</span>}
                                                                </div>
                                                            </div>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* MULTI TYPE */}
                                        {step.type === 'multi' && step.options && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {step.options.map((opt, i) => {
                                                        const selected = (answers[step.id] || []).includes(opt.value);
                                                        return (
                                                            <motion.button
                                                                key={opt.value}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                initial={{ opacity: 0, y: 15 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: i * 0.05 }}
                                                                onClick={() => toggleMulti(opt.value)}
                                                                className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${selected
                                                                    ? 'bg-[#008751]/5 border-[#008751]'
                                                                    : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    {(() => {
                                                                        const Icon = opt.icon;
                                                                        return <Icon size={22} className={selected ? 'text-[#008751]' : 'text-gray-400'} strokeWidth={1.5} />;
                                                                    })()}
                                                                    <span className={`text-sm font-bold ${selected ? 'text-[#008751]' : 'text-gray-700'}`}>{opt.label}</span>
                                                                </div>
                                                                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'bg-[#008751] border-[#008751]' : 'border-gray-200'}`}>
                                                                    {selected && <CheckCircle2 size={14} className="text-white" strokeWidth={3} />}
                                                                </div>
                                                            </motion.button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* INPUT TYPE */}
                                        {step.type === 'input' && step.inputConfig && (
                                            <div className="space-y-5">
                                                {step.inputConfig.map((field, i) => (
                                                    <motion.div
                                                        key={field.name}
                                                        initial={{ opacity: 0, y: 15 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.1 }}
                                                        className="relative group"
                                                    >
                                                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#008751] transition-colors">
                                                            {field.name === 'nom' && <User size={20} strokeWidth={1.5} />}
                                                            {field.name === 'prenom' && <User size={20} strokeWidth={1.5} />}
                                                            {field.name === 'email' && <Mail size={20} strokeWidth={1.5} />}
                                                            {field.name === 'whatsapp' && <Phone size={20} strokeWidth={1.5} />}
                                                        </div>
                                                        <input
                                                            type={field.type || 'text'}
                                                            value={(contactInfo as any)[field.name] || ''}
                                                            onChange={(e) => setContactInfo(prev => ({ ...prev, [field.name]: e.target.value }))}
                                                            placeholder={field.placeholder}
                                                            required={field.required}
                                                            className="w-full pl-14 pr-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#008751] focus:bg-white focus:ring-4 focus:ring-[#008751]/10 transition-all text-base font-medium"
                                                        />
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}

                                        {/* TEXTAREA TYPE */}
                                        {step.type === 'textarea' && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                <textarea
                                                    value={freeMessage}
                                                    onChange={(e) => setFreeMessage(e.target.value)}
                                                    rows={6}
                                                    placeholder="Racontez-nous votre histoire, posez vos questions, parlez-nous de votre projet..."
                                                    className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#008751] focus:bg-white focus:ring-4 focus:ring-[#008751]/10 transition-all text-base font-medium resize-none shadow-sm"
                                                />
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Footer Navigation */}
                            <div className="flex items-center justify-between mt-8 md:mt-12 px-2">
                                <button
                                    onClick={currentStep === 0 ? () => setMode('intro') : goBack}
                                    className="flex items-center gap-2 text-gray-400 hover:text-gray-800 transition-colors group text-sm font-bold tracking-wide uppercase py-2"
                                >
                                    <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                    Retour
                                </button>

                                {currentStep < totalSteps - 1 ? (
                                    <Button
                                        onClick={goNext}
                                        disabled={!canProceed()}
                                        className="h-14 bg-[#1a2332] hover:bg-[#2a364a] text-white font-bold px-10 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_8px_20px_-8px_rgba(26,35,50,0.5)] hover:shadow-[0_15px_25px_-8px_rgba(26,35,50,0.6)] group"
                                    >
                                        Étape Suivante
                                        <ArrowRight size={18} className="ml-3 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !canProceed()}
                                        className="h-14 bg-gradient-to-r from-[#008751] to-[#006a41] hover:from-[#006a41] hover:to-[#004d30] text-white font-bold px-10 rounded-2xl disabled:opacity-50 transition-all shadow-[0_8px_25px_rgba(0,135,81,0.3)] hover:shadow-[0_15px_30px_rgba(0,135,81,0.4)] group overflow-hidden relative"
                                    >
                                        {isSubmitting && (
                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center backdrop-blur-sm z-10">
                                                <Loader2 size={24} className="animate-spin text-white" />
                                            </div>
                                        )}
                                        <span className="flex items-center">
                                            Lancer l'Analyse <Sparkles size={18} className="ml-3 text-[#FCD116]" />
                                        </span>
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ═══════════ RESULT MODE ═══════════ */}
                    {mode === 'result' && result && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.7, type: "spring", bounce: 0.3 }}
                            className="max-w-2xl mx-auto text-center"
                        >
                            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-14 border border-gray-100 relative overflow-hidden">
                                <FloatingParticles />

                                {/* Background Accent */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#008751] rounded-full filter blur-[150px] opacity-10 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FCD116] rounded-full filter blur-[150px] opacity-10 pointer-events-none" />

                                <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D]" />

                                <div className="relative z-10">
                                    <ScoreRing score={result.score} />

                                    <h2 className="text-3xl md:text-5xl font-black font-heading text-[#1a2332] mb-4">
                                        Félicitations <span className="text-[#008751]">{contactInfo.prenom}</span> !
                                    </h2>

                                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-8 mt-8">
                                        <p className="text-gray-600 text-lg leading-relaxed">
                                            L'Oracle de Retour Gagnant a analysé vos réponses avec succès. Votre profil offre d'excellentes perspectives pour l'obtention de la nationalité béninoise.
                                        </p>
                                    </div>

                                    {/* Insights AI Stylisés */}
                                    <div className="space-y-4 mb-10 text-left">
                                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">Analyse de votre profil :</h4>
                                        {result.insights.map((insight, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.5 + i * 0.15 }}
                                                className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-[#FCD116]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <Star size={14} className="text-[#FCD116]" />
                                                </div>
                                                <span className="text-[15px] font-medium text-gray-700 leading-snug">{insight}</span>
                                            </motion.div>
                                        ))}
                                    </div>

                                    {/* Reference */}
                                    {result.reference && (
                                        <div className="mb-10">
                                            <span className="text-xs text-gray-400 uppercase tracking-widest block mb-2 font-bold">Votre code d'analyse (N.A.G)</span>
                                            <div className="inline-block bg-[#1a2332] text-white px-6 py-3 rounded-xl font-mono text-lg font-bold tracking-wider shadow-lg">
                                                {result.reference}
                                            </div>
                                        </div>
                                    )}

                                    {/* CTA */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 1 }}
                                        className="flex flex-col sm:flex-row gap-4"
                                    >
                                        <Link href="/rendez-vous" className="flex-1">
                                            <Button className="w-full h-16 bg-[#008751] hover:bg-[#006a41] text-white font-bold rounded-2xl text-base shadow-[0_10px_30px_rgba(0,135,81,0.3)] hover:shadow-[0_15px_35px_rgba(0,135,81,0.4)] transition-all group overflow-hidden relative">
                                                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                                                <span className="relative z-10 flex items-center justify-center gap-2">
                                                    Consulter un Expert Privé
                                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </span>
                                            </Button>
                                        </Link>
                                    </motion.div>

                                    <p className="text-sm font-medium text-gray-400 mt-6 flex items-center justify-center gap-2">
                                        <Shield size={16} /> Ces données ont été bien transmises sécuritairement à nos agents.
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}
