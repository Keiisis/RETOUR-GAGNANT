'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Globe, Search, Filter, Download, Clock, X, Eye, Loader2, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NationalityApplication {
    id: string
    application_ref: string
    nom: string
    prenom: string
    email: string
    telephone?: string
    genre?: string
    date_naissance?: string
    pays_naissance?: string
    ville_naissance?: string
    nationalite?: string
    pays_residence?: string
    adresse_residence?: string
    profession?: string
    demande_depuis_benin?: boolean
    // Document
    type_document_identite?: string
    numero_document?: string
    date_expiration_document?: string
    pays_delivrance?: string
    lieu_delivrance?: string
    autorite_delivrance?: string
    // Parents
    pere_nom?: string
    pere_prenom?: string
    pere_date_naissance?: string
    mere_nom?: string
    mere_prenom?: string
    mere_date_naissance?: string
    // Afro-descendance
    afro_descendant_description?: string
    knows_about_law?: boolean
    is_afro_descendant?: boolean
    // Ancestors
    ancestor1_nom?: string
    ancestor1_prenom?: string
    ancestor1_lien_parente?: string
    ancestor1_nationalite?: string
    ancestor1_pays_residence?: string
    ancestor1_vivant?: boolean
    ancestor2_nom?: string
    ancestor2_prenom?: string
    ancestor2_lien_parente?: string
    ancestor2_nationalite?: string
    // Status & Payment
    status: string
    payment_status: string
    payment_method?: string
    payment_ref?: string
    amount: number
    currency: string
    documents_uploaded: string[]
    submitted_at: string
    agent_notes?: string
}

export default function AgentNationalitePage() {
    const [apps, setApps] = useState<NationalityApplication[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('all')
    const [isUpdating, setIsUpdating] = useState(false)
    const [showDetail, setShowDetail] = useState<NationalityApplication | null>(null)

    const fetchApps = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('nationality_applications')
            .select('*')
            .order('submitted_at', { ascending: false })

        if (!error && data) {
            setApps(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        const init = async () => {
            await fetchApps()
        }
        init()
    }, [])

    const updateStatus = async (id: string, newStatus: string) => {
        setIsUpdating(true)
        const { error } = await supabase
            .from('nationality_applications')
            .update({ status: newStatus })
            .eq('id', id)

        if (!error) {
            setApps(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
            if (showDetail?.id === id) setShowDetail(prev => ({ ...prev!, status: newStatus }))
        }
        setIsUpdating(false)
    }

    const downloadZip = async (id: string) => {
        try {
            window.open(`/api/nationality/download?id=${id}`, '_blank')
        } catch (err) {
            console.error('Download error:', err)
        }
    }

    const filtered = apps.filter(a => {
        const matchSearch = ((a.nom || '') + ' ' + (a.prenom || '') + ' ' + (a.application_ref || '')).toLowerCase().includes(search.toLowerCase())
        const matchStatus = filterStatus === 'all' || a.status === filterStatus
        return matchSearch && matchStatus
    })

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'soumis': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            case 'en_examen': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            case 'approuvé': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            case 'rejeté': return 'bg-red-500/10 text-red-400 border-red-500/20'
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Globe className="text-emerald-400" />
                        Demandes de Nationalité
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">Gérez et examinez les demandes de reconnaissance de nationalité.</p>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, réf..."
                        title="Rechercher"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500" />
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        title="Filtrer par statut"
                        className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    >
                        <option value="all">Tous les statuts</option>
                        <option value="soumis">Soumis</option>
                        <option value="en_examen">En examen</option>
                        <option value="approuvé">Approuvé</option>
                        <option value="rejeté">Rejeté</option>
                    </select>
                </div>
                <Button onClick={fetchApps} variant="outline" className="border-white/10 text-gray-500">
                    <Clock size={16} className="mr-2" /> Actualiser
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Réf / Date</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Demandeur</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Paiement</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Statut</th>
                                <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={5} className="p-4"><div className="h-12 bg-white/5 rounded-lg" /></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500 italic">Aucune demande trouvée</td>
                                </tr>
                            ) : filtered.map(app => (
                                <tr key={app.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-4">
                                        <p className="font-mono text-emerald-400 font-bold">{app.application_ref}</p>
                                        <p className="text-[10px] text-gray-500">
                                            {app.submitted_at && !isNaN(new Date(app.submitted_at).getTime())
                                                ? new Date(app.submitted_at).toLocaleDateString('fr-FR')
                                                : '—'}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-black text-xs">
                                                {app.nom[0]}{app.prenom[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{app.prenom} {app.nom}</p>
                                                <p className="text-[10px] text-gray-500">{app.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-2 h-2 rounded-full ${app.payment_status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 opacity-50'}`} />
                                            <span className="text-xs font-bold uppercase tracking-widest text-white/80">{app.amount} {app.currency}</span>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getStatusStyle(app.status)}`}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setShowDetail(app)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all"
                                                title="Voir Détails"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => downloadZip(app.id)}
                                                className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                                title="Télécharger ZIP"
                                            >
                                                <Download size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DETAIL MODAL */}
            <AnimatePresence>
                {showDetail && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetail(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-5xl bg-[#0d151c] border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[95vh]"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-emerald-500/5 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                        <Globe className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-xl font-black text-white">{showDetail.application_ref || 'Demande sans référence'}</h2>
                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${getStatusStyle(showDetail.status)}`}>
                                                {showDetail.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Soumis le {showDetail.submitted_at && !isNaN(new Date(showDetail.submitted_at).getTime())
                                                ? new Date(showDetail.submitted_at).toLocaleString('fr-FR')
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button onClick={() => downloadZip(showDetail.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-widest px-4 rounded-xl h-9">
                                        <Download size={14} className="mr-2" /> ZIP
                                    </Button>
                                    <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors" title="Fermer">
                                        <X size={20} className="text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {/* Identité */}
                                <div>
                                    <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-3">Identité du demandeur</h3>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[['Nom complet', `${showDetail.prenom} ${showDetail.nom}`], ['Genre', showDetail.genre], ['Email', showDetail.email], ['Téléphone', showDetail.telephone], ['Date de naissance', showDetail.date_naissance], ['Pays de naissance', showDetail.pays_naissance], ['Ville de naissance', showDetail.ville_naissance], ['Nationalité', showDetail.nationalite], ['Pays de résidence', showDetail.pays_residence], ['Adresse', showDetail.adresse_residence], ['Profession', showDetail.profession], ['Depuis le Bénin', showDetail.demande_depuis_benin ? 'Oui' : 'Non']].map(([k, v], i) => v && (
                                                <div key={i}><p className="text-[9px] text-gray-500 uppercase font-black mb-1">{k}</p><p className="text-xs text-white font-bold">{v}</p></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Document d'identité */}
                                <div>
                                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-3">Document d&apos;identité</h3>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {[['Type', showDetail.type_document_identite], ['Numéro', showDetail.numero_document], ['Expiration', showDetail.date_expiration_document], ['Pays délivrance', showDetail.pays_delivrance], ['Lieu délivrance', showDetail.lieu_delivrance], ['Autorité', showDetail.autorite_delivrance]].map(([k, v], i) => v && (
                                                <div key={i}><p className="text-[9px] text-gray-500 uppercase font-black mb-1">{k}</p><p className="text-xs text-white font-bold font-mono">{v}</p></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Parents */}
                                <div>
                                    <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] mb-3">Parents</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[9px] text-purple-400 uppercase font-black mb-2">Père</p>
                                            <div className="space-y-1 text-xs">
                                                <p className="text-white font-bold">{showDetail.pere_prenom} {showDetail.pere_nom}</p>
                                                {showDetail.pere_date_naissance && <p className="text-gray-500">Né le {showDetail.pere_date_naissance}</p>}
                                            </div>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                            <p className="text-[9px] text-purple-400 uppercase font-black mb-2">Mère</p>
                                            <div className="space-y-1 text-xs">
                                                <p className="text-white font-bold">{showDetail.mere_prenom} {showDetail.mere_nom}</p>
                                                {showDetail.mere_date_naissance && <p className="text-gray-500">Née le {showDetail.mere_date_naissance}</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Afro-descendance & Ancêtres */}
                                <div>
                                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] mb-3">Afro-descendance & Ancêtres</h3>
                                    {showDetail.afro_descendant_description && (
                                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 mb-4">
                                            <p className="text-[9px] text-emerald-500/70 uppercase font-black mb-2">Histoire familiale</p>
                                            <p className="text-xs text-gray-400 leading-relaxed italic">{showDetail.afro_descendant_description}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {showDetail.ancestor1_nom && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                                <p className="text-[9px] text-amber-400 uppercase font-black mb-2">Ancêtre 1</p>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {[['Nom', `${showDetail.ancestor1_prenom} ${showDetail.ancestor1_nom}`], ['Lien', showDetail.ancestor1_lien_parente], ['Nationalité', showDetail.ancestor1_nationalite], ['Résidence', showDetail.ancestor1_pays_residence], ['Vivant', showDetail.ancestor1_vivant === true ? 'Oui' : showDetail.ancestor1_vivant === false ? 'Non' : null]].map(([k, v], i) => v && (
                                                        <div key={i}><span className="text-gray-600 text-[10px]">{k}</span><p className="text-white font-bold">{v}</p></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {showDetail.ancestor2_nom && (
                                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                                <p className="text-[9px] text-amber-400 uppercase font-black mb-2">Ancêtre 2</p>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {[['Nom', `${showDetail.ancestor2_prenom} ${showDetail.ancestor2_nom}`], ['Lien', showDetail.ancestor2_lien_parente], ['Nationalité', showDetail.ancestor2_nationalite]].map(([k, v], i) => v && (
                                                        <div key={i}><span className="text-gray-600 text-[10px]">{k}</span><p className="text-white font-bold">{v}</p></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Paiement */}
                                <div>
                                    <h3 className="text-[10px] font-black text-[#FCD116] uppercase tracking-[0.3em] mb-3">Paiement</h3>
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[['Montant', `${showDetail.amount || 0} ${showDetail.currency || 'USD'}`], ['Statut', showDetail.payment_status], ['Passerelle', showDetail.payment_method], ['Réf. TX', showDetail.payment_ref]].map(([k, v], i) => v && (
                                                <div key={i}><p className="text-[9px] text-gray-500 uppercase font-black mb-1">{k}</p><p className="text-xs text-white font-bold">{v}</p></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Documents */}
                                {showDetail.documents_uploaded && showDetail.documents_uploaded.length > 0 && (
                                    <div>
                                        <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-3">Pièces jointes ({showDetail.documents_uploaded.length})</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {showDetail.documents_uploaded.map((doc, idx) => {
                                                const label = typeof doc === 'string' ? doc.split(': ')[0] : `Doc #${idx + 1}`
                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">{label}</span>
                                                            <span className="text-[8px] text-gray-600 font-mono mt-0.5">{typeof doc === 'string' ? doc : JSON.stringify(doc)}</span>
                                                        </div>
                                                        <FileDown size={14} className="text-gray-500" />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Bottom Management Bar */}
                                <div className="p-6 bg-black/20 border border-white/5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="space-y-1 text-center sm:text-left">
                                        <p className="text-[10px] font-black text-gray-500 uppercase">Gestionnaire de Workflow</p>
                                        <p className="text-xs text-gray-400 italic">Mettez à jour le statut pour notifier le client</p>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                                        {['soumis', 'en_examen', 'approuvé', 'rejeté'].map(s => (
                                            <button
                                                key={s}
                                                disabled={isUpdating}
                                                onClick={() => updateStatus(showDetail.id, s)}
                                                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${showDetail.status === s ? getStatusStyle(s) + ' shadow-[0_0_15px_rgba(255,255,255,0.05)]' : 'bg-transparent border-white/5 text-gray-500 hover:border-white/20'}`}
                                            >
                                                {isUpdating && showDetail.status === s ? <Loader2 size={12} className="animate-spin mx-auto" /> : s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
            `}</style>
        </div>
    )
}
