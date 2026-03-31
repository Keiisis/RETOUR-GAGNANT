'use client'

import { useState, useCallback, useMemo } from "react"
import { useTranslation, T } from "@/lib/translation"
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Mail, ArrowRight, Loader2, Shield, Sparkles, FileText,
    MessageSquare, CalendarCheck, CheckCircle2, Receipt, HeadphonesIcon, LogOut
} from 'lucide-react'
import LiveSupportChat from '@/components/chat/LiveSupportChat'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any

export default function MonComptePage() {
    const { t, lang } = useTranslation();
    const [email, setEmail] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('rg_client_email') || ''
        }
        return ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [dossiers, setDossiers] = useState<AnyRecord[]>([])
    const [oracleResults, setOracleResults] = useState<AnyRecord[]>([])
    const [documents, setDocuments] = useState<AnyRecord[]>([])
    const [contracts, setContracts] = useState<AnyRecord[]>([])
    const [orders, setOrders] = useState<AnyRecord[]>([])
    const [authenticated, setAuthenticated] = useState(false)
    const [clientName, setClientName] = useState('')
    const [activeTab, setActiveTab] = useState<'dossiers' | 'oracle' | 'documents' | 'contrats' | 'factures' | 'support'>('dossiers')



    const handleLogin = async () => {
        if (!email.trim()) return
        setLoading(true)
        setError('')

        try {
            // Fetch client data directly by email (no auth needed — read access)
            const [dossierRes, oracleRes, docRes, contractRes, orderRes] = await Promise.all([
                supabase.from('dossier_tracking').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('eligibility_results').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('client_documents').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('contracts').select('*').eq('client_email', email).order('created_at', { ascending: false }),
                supabase.from('orders').select('*').eq('customer_email', email).order('created_at', { ascending: false }),
            ])

            const allDossiers = (dossierRes.data || [])
            const allOracle = (oracleRes.data || [])

            if (allDossiers.length === 0 && allOracle.length === 0) {
                setError(t('Aucun dossier trouvé pour cet email. Contactez-nous si vous pensez que c\'est une erreur.'))
                setLoading(false)
                return
            }

            setDossiers(allDossiers)
            setOracleResults(allOracle)
            setDocuments(docRes.data || [])
            setContracts(contractRes.data || [])
            setOrders(orderRes.data || [])
            setClientName(allDossiers[0]?.client_prenom || allOracle[0]?.client_prenom || orderRes.data?.[0]?.customer_name || '')
            localStorage.setItem('rg_client_email', email) // 🔐 Sauvegarde l'identité pour la Cloche
            setAuthenticated(true)
        } catch {
            setError(t('Erreur de connexion. Réessayez.'))
        }
        setLoading(false)
    }

    // Upload document
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // const fileName = `${Date.now()}_${file.name}`
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
            alert(t('Erreur lors de l\'upload.'))
        }
    }

    // Sign contract
    const handleSign = async (contractId: string) => {
        const confirm = window.confirm(t('En cliquant "OK", vous acceptez les termes de ce contrat et y apposez votre signature électronique.'))
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
                        <h1 className="text-3xl font-black text-white mb-2"><T>Mon Espace</T></h1>
                        <p className="text-sm text-gray-500"><T>Accédez à vos dossiers, documents et contrats</T></p>
                    </div>

                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block"><T>Votre adresse email</T></label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                    placeholder={t("votre@email.com")}
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
                        <p className="text-[10px] text-gray-600 mt-4"><T>Utilisez l&apos;email que vous avez fourni lors de votre demande ou du test Oracle.</T></p>
                    </div>

                    {/* Features preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                        {[
                            { icon: FileText, label: t('Suivi de dossier') },
                            { icon: Sparkles, label: t('Résultats Oracle') },
                            { icon: MessageSquare, label: t('Documents') },
                            { icon: CalendarCheck, label: t('Contrats') },
                            { icon: Receipt, label: t('Factures') },
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
        { key: 'dossiers', label: t('Mes Dossiers'), icon: FileText, count: dossiers.length },
        { key: 'oracle', label: t('Résultats Oracle'), icon: Sparkles, count: oracleResults.length },
        { key: 'documents', label: t('Documents'), icon: MessageSquare, count: documents.length },
        { key: 'contrats', label: t('Contrats'), icon: CalendarCheck, count: contracts.length },
        { key: 'factures', label: t('Factures'), icon: Receipt, count: orders.length },
        { key: 'support', label: t('Support Direct'), icon: HeadphonesIcon, count: 0 },
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex justify-between items-start">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Bienvenue</T></span>
                        <h1 className="text-2xl font-black text-white">
                            {clientName ? `${t('Bonjour')} ${clientName}` : t('Mon Espace Client')}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">{email}</p>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem('rg_client_email')
                            setAuthenticated(false)
                            setDossiers([])
                            setEmail('')
                        }}
                        className="text-xs text-gray-400 hover:text-white flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                    >
                        <LogOut size={14} /> <T>Déconnexion</T>
                    </button>
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
                            <tab.icon size={14} /> {t(tab.label)}
                            {tab.count > 0 && <span className="bg-white/10 px-1.5 py-0.5 rounded-full text-[10px]">{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'dossiers' && (
                        <motion.div key="dossiers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {dossiers.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm"><T>Aucun dossier en cours</T></div>
                            ) : dossiers.map(d => (
                                <div key={d.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-xs text-gray-500 font-mono">#{d.num_dossier}</p>
                                            <p className="text-base font-bold text-white">{d.service_type}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${statusColors[d.statut] || 'text-gray-400 bg-white/10'}`}>
                                            {t(d.statut)}
                                        </span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full bg-white/5 rounded-full h-2 mb-2">
                                        <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${d.progression}%` }} />
                                    </div>
                                    <p className="text-[10px] text-gray-500">{d.progression}% {t('complété')}</p>
                                    {/* Steps */}
                                    <div className="mt-4 space-y-2">
                                        {(d.etapes || []).map((etape: AnyRecord) => (
                                            <div key={etape.id} className="flex items-center gap-2 text-xs">
                                                {etape.status === 'completed' ? (
                                                    <CheckCircle2 size={14} className="text-emerald-400" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
                                                )}
                                                <span className={etape.status === 'completed' ? 'text-gray-300' : 'text-gray-600'}>{t(etape.label)}</span>
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
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm"><T>Aucun résultat Oracle</T></div>
                            ) : oracleResults.map(r => (
                                <div key={r.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-lg ${r.eligibility_score >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {r.eligibility_score}%
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{t(r.recommended_service)}</p>
                                            <p className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
                                <p className="text-sm text-gray-400 mb-2"><T>Glissez vos documents ici ou cliquez pour sélectionner</T></p>
                                <label className="cursor-pointer bg-emerald-500/20 text-emerald-400 font-bold text-xs px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition-all">
                                    <T>Choisir un fichier</T>
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
                                                <p className="text-sm text-white font-medium">{t(doc.file_name)}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(doc.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${doc.status === 'valide' ? 'bg-emerald-500/20 text-emerald-400' : doc.status === 'rejete' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {doc.status === 'valide' ? t('Validé') : doc.status === 'rejete' ? t('Rejeté') : t('En attente')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'contrats' && (
                        <motion.div key="contrats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {contracts.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm"><T>Aucun contrat</T></div>
                            ) : contracts.map(c => (
                                <div key={c.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-base font-bold text-white">{t(c.title)}</p>
                                            <p className="text-xs text-gray-500">{c.amount?.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} {c.currency}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${c.status === 'signe' ? 'bg-emerald-500/20 text-emerald-400' : c.status === 'envoye' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                            {c.status === 'signe' ? t('✓ Signé') : c.status === 'envoye' ? t('À signer') : t(c.status)}
                                        </span>
                                    </div>
                                    {c.status === 'envoye' && (
                                        <button
                                            onClick={() => handleSign(c.id)}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all w-full mt-2"
                                        >
                                            <T>Signer électroniquement ce contrat</T>
                                        </button>
                                    )}
                                    {c.status === 'signe' && c.signed_at && (
                                        <p className="text-[10px] text-emerald-400 mt-2"><T>Signé le</T> {new Date(c.signed_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    )}
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'factures' && (
                        <motion.div key="factures" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                            {orders.length === 0 ? (
                                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm"><T>Aucune commande ni facture</T></div>
                            ) : orders.map(o => (
                                <div key={o.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-base font-bold text-white">{o.product_title || t('Commande')}</p>
                                            <p className="text-[10px] text-gray-500">{new Date(o.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} • {o.amount?.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR')} {o.currency}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${o.payment_status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : o.payment_status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                            {o.payment_status === 'completed' ? t('Payé') : o.payment_status === 'pending' ? t('En attente') : t('Échoué')}
                                        </span>
                                    </div>
                                    <div className="mt-4 border-t border-white/5 pt-4">
                                        <a href={`/api/invoices/${o.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg transition-colors w-full">
                                            <Receipt size={14} /> <T>Télécharger la facture PDF (HTML)</T>
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {activeTab === 'support' && (
                        <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full min-h-[500px]">
                            <LiveSupportChat
                                email={email}
                                clientName={clientName || t('Client')}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
