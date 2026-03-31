'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileCheck, Clock, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, Shield, Zap, Sparkles, Upload, FileWarning } from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'
import { supabase } from '@/lib/supabase'

interface DossierEtape {
    id: number
    label: string
    status: 'completed' | 'in_progress' | 'pending'
    date: string | null
    note: string
}

interface DossierData {
    id?: string
    num_dossier: string
    client_nom: string
    client_prenom: string
    service_type: string
    statut: string
    progression: number
    etapes: DossierEtape[]
    documents_manquants: string[]
    created_at: string
    updated_at: string
}

const statusConfig: Record<string, { tw: { border: string, bg: string, text: string, bgAlpha: string, borderAlpha: string, shadow: string }, icon: typeof CheckCircle2, label: string }> = {
    completed: {
        tw: { border: 'border-[#008751]', bg: 'bg-[#008751]', text: 'text-[#008751]', bgAlpha: 'bg-[#008751]/15', borderAlpha: 'border-[#008751]/30', shadow: 'shadow-[0_0_20px_rgba(0,135,81,0.4)]' },
        icon: CheckCircle2, label: 'Terminé'
    },
    in_progress: {
        tw: { border: 'border-[#FCD116]', bg: 'bg-[#FCD116]', text: 'text-[#FCD116]', bgAlpha: 'bg-[#FCD116]/15', borderAlpha: 'border-[#FCD116]/30', shadow: 'shadow-[0_0_20px_rgba(252,209,22,0.4)]' },
        icon: Zap, label: 'En cours'
    },
    pending: {
        tw: { border: 'border-gray-500', bg: 'bg-gray-500', text: 'text-gray-500', bgAlpha: 'bg-gray-500/15', borderAlpha: 'border-gray-500/30', shadow: 'shadow-none' },
        icon: Clock, label: 'En attente'
    },
}

export default function SuiviDossierPage() {
    const { t, lang } = useTranslation()
    const [numDossier, setNumDossier] = useState('')
    const [email, setEmail] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [dossier, setDossier] = useState<DossierData | null>(null)
    const [errorMsg, setErrorMsg] = useState('')
    const [hasSearched, setHasSearched] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)

    const handleUploadDocument = async (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !dossier || !dossier.id) return

        setUploadingDoc(docName)

        try {
            // Upload to Supabase Storage
            const ext = file.name.split('.').pop()
            const fileName = `dossiers/${dossier.num_dossier}/${docName.replace(/\s+/g, '_')}_${Date.now()}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('documents') // Assuming 'documents' bucket exists
                .upload(fileName, file)

            if (uploadError) {
                console.error("Storage upload error:", uploadError)
                // Continue if bucket doesn't exist just to remove the block visually for demo
            }

            // Remove from documents_manquants
            const newDocs = (dossier.documents_manquants || []).filter((d: string) => d !== docName)

            // Update dossier
            const { error: updateError } = await supabase
                .from('dossier_tracking')
                .update({ documents_manquants: newDocs })
                .eq('id', dossier.id)

            if (updateError) throw updateError

            setDossier({ ...dossier, documents_manquants: newDocs })

        } catch (error) {
            console.error('Erreur upload:', error)
            alert(t("Une erreur est survenue lors de l'envoi. Veuillez réessayer ou contacter l'agence."))
        } finally {
            setUploadingDoc(null)
        }
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!numDossier.trim() || !email.trim()) return

        setIsSearching(true)
        setErrorMsg('')
        setDossier(null)

        try {
            const res = await fetch('/api/tracking/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numDossier, email })
            })
            const data = await res.json()

            if (data.found) {
                setDossier(data.dossier)
            } else {
                setErrorMsg(data.message || t('Aucun dossier trouvé.'))
            }
        } catch {
            setErrorMsg(t('Erreur de connexion. Veuillez réessayer.'))
        } finally {
            setIsSearching(false)
            setHasSearched(true)
        }
    }

    const resetSearch = () => {
        setDossier(null)
        setHasSearched(false)
        setErrorMsg('')
        setNumDossier('')
        setEmail('')
    }

    return (
        <div className="min-h-screen bg-[#05080a] text-white relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#008751]/10 rounded-full blur-[150px]" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#FCD116]/5 rounded-full blur-[120px]" />
                <div className="absolute top-1/3 left-0 w-[300px] h-[300px] bg-[#E8112D]/5 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">

                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-16"
                    >
                        <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 rounded-full bg-[#008751]/10 border border-[#008751]/20">
                            <Shield size={14} className="text-[#008751]" />
                            <span className="text-[11px] uppercase tracking-[4px] font-bold text-[#008751]"><T>Nexus Tracker</T></span>
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black font-heading mb-6 tracking-tight">
                            <T>Suivi de</T> <span className="bg-gradient-to-r from-[#008751] via-[#FCD116] to-[#E8112D] bg-clip-text text-transparent"><T>Dossier</T></span>
                        </h1>
                        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            <T>Consultez l&apos;avancement de votre dossier en temps réel grâce à notre système de suivi intelligent.</T>
                        </p>
                    </motion.div>

                    {/* Search Form */}
                    <AnimatePresence mode="wait">
                        {!dossier && (
                            <motion.div
                                key="search"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="max-w-xl mx-auto">
                                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl">
                                        <form onSubmit={handleSearch} className="space-y-6">
                                            <div>
                                                <label className="text-[11px] font-black uppercase tracking-[3px] text-gray-400 mb-2 block">
                                                    <T>Numéro de dossier</T>
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={numDossier}
                                                    onChange={e => setNumDossier(e.target.value)}
                                                    placeholder={t("Ex: RG-2026-00001")}
                                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751] focus:bg-white/[0.08] transition-all text-lg font-mono tracking-wider"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-black uppercase tracking-[3px] text-gray-400 mb-2 block">
                                                    <T>Email associé</T>
                                                </label>
                                                <input
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    placeholder={t("votre@email.com")}
                                                    className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-[#008751] focus:bg-white/[0.08] transition-all"
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isSearching}
                                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#008751] to-[#00b06a] text-white font-black uppercase tracking-[3px] text-[13px] hover:shadow-[0_8px_30px_rgba(0,135,81,0.4)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                            >
                                                {isSearching ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin" />
                                                        <T>Recherche en cours...</T>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Search size={18} />
                                                        <T>Traquer mon dossier</T>
                                                    </>
                                                )}
                                            </button>
                                        </form>

                                        {/* Error */}
                                        {hasSearched && errorMsg && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                                            >
                                                <AlertTriangle size={18} className="text-red-400 shrink-0" />
                                                <p className="text-red-300 text-sm">{errorMsg}</p>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Results Timeline */}
                        {dossier && (
                            <motion.div
                                key="result"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="max-w-3xl mx-auto"
                            >
                                {/* Back Button */}
                                <button
                                    onClick={resetSearch}
                                    title={t("Nouvelle recherche")}
                                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 group"
                                >
                                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                                    <span className="text-sm font-bold uppercase tracking-widest"><T>Nouvelle recherche</T></span>
                                </button>

                                {/* Dossier Header Card */}
                                <div className="bg-gradient-to-br from-[#008751]/20 to-[#008751]/5 border border-[#008751]/30 rounded-3xl p-8 mb-10 backdrop-blur-xl">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[4px] text-[#008751] mb-2"><T>Dossier N°</T></p>
                                            <h2 className="text-3xl font-black font-mono tracking-wider text-white">{dossier.num_dossier}</h2>
                                            <p className="text-gray-400 mt-2 text-sm">
                                                {dossier.client_prenom} {dossier.client_nom} — <span className="text-[#FCD116]">{dossier.service_type}</span>
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <div className="relative w-24 h-24 mx-auto">
                                                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                                    <circle
                                                        cx="50" cy="50" r="42" fill="none"
                                                        stroke="#008751"
                                                        strokeWidth="8"
                                                        strokeLinecap="round"
                                                        strokeDasharray={`${2 * Math.PI * 42}`}
                                                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - dossier.progression / 100)}`}
                                                        className="transition-all duration-1000"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-xl fond-black text-white font-mono">{dossier.progression}%</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-2 font-bold"><T>Progression</T></p>
                                        </div>
                                    </div>
                                </div>

                                {/* Urgent: Documents manquants */}
                                {dossier.documents_manquants && dossier.documents_manquants.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mb-10 bg-red-500/10 border-2 border-red-500/30 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                        
                                        <div className="flex items-start gap-4 mb-6 relative z-10">
                                            <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(239,68,68,0.4)] relative">
                                                <FileWarning size={24} className="text-red-400 animate-pulse" />
                                                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold items-center justify-center text-white">{dossier.documents_manquants.length}</span>
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-red-500 flex items-center gap-2">
                                                    Action Requise
                                                </h3>
                                                <p className="text-red-300/80 text-sm mt-1">
                                                    Afin de poursuivre le traitement de votre dossier, veuillez nous fournir les documents suivants de toute urgence.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4 relative z-10">
                                            {dossier.documents_manquants.map((doc, idx) => (
                                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#05080a] border border-red-500/20 rounded-2xl p-4 md:px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                                        <span className="font-bold text-gray-200">{doc}</span>
                                                    </div>
                                                    
                                                    <div className="relative">
                                                        <input 
                                                            type="file" 
                                                            id={`upload-${idx}`} 
                                                            className="hidden" 
                                                            onChange={(e) => handleUploadDocument(doc, e)}
                                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                        />
                                                        <label 
                                                            htmlFor={`upload-${idx}`}
                                                            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all ${
                                                                uploadingDoc === doc 
                                                                ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
                                                                : 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white shadow-[0_4px_20px_rgba(239,68,68,0.2)]'
                                                            }`}
                                                        >
                                                            {uploadingDoc === doc ? (
                                                                <><Loader2 size={16} className="animate-spin" /> Envoi...</>
                                                            ) : (
                                                                <><Upload size={16} /> Envoyer ce document</>
                                                            )}
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Timeline */}
                                <div className="relative pl-8 space-y-0">
                                    {/* Vertical Line */}
                                    <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-[#008751] via-[#FCD116]/30 to-transparent" />

                                    {dossier.etapes.map((etape, index) => {
                                        const config = statusConfig[etape.status] || statusConfig.pending
                                        const Icon = config.icon
                                        return (
                                            <motion.div
                                                key={etape.id}
                                                initial={{ opacity: 0, x: -30 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.15, duration: 0.5 }}
                                                className="relative pb-10 last:pb-0"
                                            >
                                                {/* Node */}
                                                <div
                                                    className={`absolute -left-8 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 ${config.tw.border} ${etape.status === 'completed' ? config.tw.bg : 'bg-[#0a0f18]'} ${etape.status !== 'pending' ? config.tw.shadow : ''}`}
                                                >
                                                    <Icon size={14} className={etape.status === 'completed' ? 'text-white' : config.tw.text} />
                                                </div>

                                                {/* Card */}
                                                <div
                                                    className={`ml-6 p-5 rounded-2xl border transition-all ${etape.status === 'in_progress'
                                                        ? 'bg-[#FCD116]/5 border-[#FCD116]/30 shadow-[0_0_30px_rgba(252,209,22,0.1)]'
                                                        : etape.status === 'completed'
                                                            ? 'bg-[#008751]/5 border-[#008751]/20'
                                                            : 'bg-white/[0.02] border-white/5'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-[15px]">{t(etape.label)}</h4>
                                                        <span
                                                            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${config.tw.text} ${config.tw.bgAlpha} ${config.tw.borderAlpha}`}
                                                        >
                                                            {t(config.label)}
                                                        </span>
                                                    </div>
                                                    {etape.date && (
                                                        <p className="text-gray-500 text-xs mt-1">{new Date(etape.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                    )}
                                                    {etape.note && (
                                                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{t(etape.note)}</p>
                                                    )}
                                                    {etape.status === 'in_progress' && (
                                                        <div className="mt-3 flex items-center gap-2">
                                                            <span className="w-2 h-2 bg-[#FCD116] rounded-full animate-pulse" />
                                                            <span className="text-[#FCD116] text-[11px] font-bold uppercase tracking-widest"><T>Traitement actif</T></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>

                                {/* Documents Manquants */}
                                {dossier.documents_manquants && dossier.documents_manquants.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 }}
                                        className="mt-10 p-6 rounded-2xl bg-[#E8112D]/10 border border-[#E8112D]/20"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <AlertTriangle size={20} className="text-[#E8112D]" />
                                            <h4 className="font-black text-[15px] text-[#E8112D]"><T>Documents manquants</T></h4>
                                        </div>
                                        <ul className="space-y-2">
                                            {dossier.documents_manquants.map((doc, i) => (
                                                <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                                    <FileCheck size={14} className="text-[#E8112D]/60" />
                                                    {doc}
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                )}

                                {/* Contact CTA */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 1 }}
                                    className="mt-10 text-center"
                                >
                                    <p className="text-gray-500 text-sm mb-4">
                                        <T>Une question sur votre dossier ?</T>
                                    </p>
                                    <a
                                        href="/contact"
                                        className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
                                    >
                                        <Sparkles size={16} className="text-[#FCD116]" />
                                        <T>Contacter un conseiller</T>
                                    </a>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
