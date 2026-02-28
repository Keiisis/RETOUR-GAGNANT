'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Mail, ArrowRight, Loader2, Shield, Sparkles, FileText,
    MessageSquare, CalendarCheck, CheckCircle2
} from 'lucide-react'

export default function MonComptePage() {
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [dossiers, setDossiers] = useState<any[]>([])
    const [oracleResults, setOracleResults] = useState<any[]>([])
    const [documents, setDocuments] = useState<any[]>([])
    const [contracts, setContracts] = useState<any[]>([])
    const [authenticated, setAuthenticated] = useState(false)
    const [clientName, setClientName] = useState('')
    const [activeTab, setActiveTab] = useState<'dossiers' | 'oracle' | 'documents' | 'contrats'>('dossiers')

    const handleLogin = async () => {
        if (!email.trim()) return
        setLoading(true)
        setError('')

        try {
            // Fetch client data directly by email (no auth needed — read access)
            const [dossierRes, oracleRes, docRes, contractRes] = await Promise.all([
                supabase.from('dossier_tracking').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('eligibility_results').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('client_documents').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('contracts').select('*').eq('client_email', email).order('created_at', { ascending: false }),
            ])

            const allDossiers = (dossierRes.data || [])
            const allOracle = (oracleRes.data || [])

            if (allDossiers.length === 0 && allOracle.length === 0) {
                setError('Aucun dossier trouvé pour cet email. Contactez-nous si vous pensez que c\'est une erreur.')
                setLoading(false)
                return
            }

            setDossiers(allDossiers)
            setOracleResults(allOracle)
            setDocuments(docRes.data || [])
            setContracts(contractRes.data || [])
            setClientName(allDossiers[0]?.client_prenom || allOracle[0]?.client_prenom || '')
            setAuthenticated(true)
        } catch {
            setError('Erreur de connexion. Réessayez.')
        }
        setLoading(false)
    }

    // Upload document
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const fileName = `${Date.now()}_${file.name}`
        // For now, we store metadata only (file URL would need Supabase Storage bucket)
        try {
            await fetch('/api/documents/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_email: email,
                    client_nom: clientName,
                    file_name: file.name,
                    file_type: 'autre',
                    file_size: file.size,
                })
            })

            // Refresh documents
            const { data } = await supabase.from('client_documents').select('*').eq('client_email', email).order('created_at', { ascending: false })
            setDocuments(data || [])
        } catch {
            alert('Erreur lors de l\'upload.')
        }
    }

    // Sign contract
    const handleSign = async (contractId: string) => {
        const confirm = window.confirm('En cliquant "OK", vous acceptez les termes de ce contrat et y apposez votre signature électronique.')
        if (!confirm) return

        await fetch('/api/contracts/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractId, clientEmail: email })
        })

        const { data } = await supabase.from('contracts').select('*').eq('client_email', email).order('created_at', { ascending: false })
        setContracts(data || [])
    }

    if (!authenticated) {
        return (
            <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center px-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full"
                >
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                            <Shield size={28} className="text-emerald-400" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2">Mon Espace</h1>
                        <p className="text-sm text-gray-500">Accédez à vos dossiers, documents et contrats</p>
                    </div>

                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Votre adresse email</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                    placeholder="votre@email.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                                />
                            </div>
                            <button
                                onClick={handleLogin}
                                disabled={loading || !email.trim()}
                                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold px-5 rounded-xl transition-all flex items-center gap-2 text-sm"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                            </button>
                        </div>
                        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
                        <p className="text-[10px] text-gray-600 mt-4">Utilisez l&apos;email que vous avez fourni lors de votre demande ou du test Oracle.</p>
                    </div>

                    {/* Features preview */}
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        {[
                            { icon: FileText, label: 'Suivi de dossier' },
                            { icon: Sparkles, label: 'Résultats Oracle' },
                            { icon: MessageSquare, label: 'Documents' },
                            { icon: CalendarCheck, label: 'Contrats' },
                        ].map((f, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center gap-2 text-xs text-gray-500">
                                <f.icon size={14} className="text-emerald-500/50" /> {f.label}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        )
    }

    // Authenticated view
    const TABS = [
        { key: 'dossiers', label: 'Mes Dossiers', icon: FileText, count: dossiers.length },
        { key: 'oracle', label: 'Résultats Oracle', icon: Sparkles, count: oracleResults.length },
        { key: 'documents', label: 'Documents', icon: MessageSquare, count: documents.length },
        { key: 'contrats', label: 'Contrats', icon: CalendarCheck, count: contracts.length },
    ]

    const statusColors: Record<string, string> = {
        reception: 'text-blue-400 bg-blue-500/20',
        verification: 'text-amber-400 bg-amber-500/20',
        traitement: 'text-purple-400 bg-purple-500/20',
        validation: 'text-emerald-400 bg-emerald-500/20',
        finalisation: 'text-yellow-400 bg-yellow-500/20',
        termine: 'text-green-400 bg-green-500/20',
        annule: 'text-red-400 bg-red-500/20',
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Bienvenue</span>
                    <h1 className="text-2xl font-black text-white">
                        {clientName ? `Bonjour ${clientName}` : 'Mon Espace Client'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">{email}</p>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${activeTab === tab.key
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'
                                }`}
                        >
                            <tab.icon size={14} /> {tab.label}
                            {tab.count > 0 && <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'dossiers' && (
                        <motion.div key="dossiers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {dossiers.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">Aucun dossier en cours</div>
                            ) : dossiers.map(d => (
                                <div key={d.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-mono">#{d.num_dossier}</p>
                                            <p className="text-base font-bold text-white">{d.service_type}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${statusColors[d.statut] || 'text-gray-400 bg-white/10'}`}>
                                            {d.statut}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full bg-white/5 rounded-full h-2 mb-3">
                                        <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-yellow-400 transition-all" style={{ width: `${d.progression}%` }} />
                                    </div>
                                    <p className="text-[10px] text-gray-500">{d.progression}% complété</p>
                                    {/* Steps */}
                                    <div className="mt-4 space-y-2">
                                        {(d.etapes || []).map((etape: any) => (
                                            <div key={etape.id} className="flex items-center gap-2 text-xs">
                                                {etape.status === 'completed' ? (
                                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
                                                )}
                                                <span className={etape.status === 'completed' ? 'text-gray-300' : 'text-gray-600'}>{etape.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'oracle' && (
                        <motion.div key="oracle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {oracleResults.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">Aucun résultat Oracle</div>
                            ) : oracleResults.map(r => (
                                <div key={r.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg ${r.eligibility_score >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {r.eligibility_score}%
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{r.recommended_service}</p>
                                            <p className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString('fr-FR')}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'documents' && (
                        <motion.div key="documents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* Upload */}
                            <div className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-2xl p-8 text-center mb-4 hover:border-emerald-500/30 transition-all">
                                <FileText className="mx-auto mb-3 text-gray-600" size={32} />
                                <p className="text-sm text-gray-400 mb-2">Glissez vos documents ici ou cliquez pour sélectionner</p>
                                <label className="cursor-pointer bg-emerald-500/20 text-emerald-400 font-bold text-xs px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition-all">
                                    Choisir un fichier
                                    <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                                </label>
                            </div>
                            {/* List */}
                            <div className="space-y-2">
                                {documents.map(doc => (
                                    <div key={doc.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <FileText size={16} className="text-blue-400" />
                                            <div>
                                                <p className="text-sm text-white font-medium">{doc.file_name}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(doc.created_at).toLocaleDateString('fr-FR')}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${doc.status === 'valide' ? 'bg-emerald-500/20 text-emerald-400' : doc.status === 'rejete' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {doc.status === 'valide' ? 'Validé' : doc.status === 'rejete' ? 'Rejeté' : 'En attente'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'contrats' && (
                        <motion.div key="contrats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {contracts.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">Aucun contrat</div>
                            ) : contracts.map(c => (
                                <div key={c.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-base font-bold text-white">{c.title}</p>
                                            <p className="text-xs text-gray-500">{c.amount?.toLocaleString()} {c.currency}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${c.status === 'signe' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'envoye' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {c.status === 'signe' ? '✓ Signé' : c.status === 'envoye' ? 'À signer' : c.status}
                                        </span>
                                    </div>
                                    {c.status === 'envoye' && (
                                        <button
                                            onClick={() => handleSign(c.id)}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all w-full mt-2"
                                        >
                                            Signer électroniquement ce contrat
                                        </button>
                                    )}
                                    {c.status === 'signe' && c.signed_at && (
                                        <p className="text-[10px] text-emerald-400 mt-2">Signé le {new Date(c.signed_at).toLocaleDateString('fr-FR')}</p>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
