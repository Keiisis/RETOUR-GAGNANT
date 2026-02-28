'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Globe2, CheckCircle2, Clock, Download,
    Mail, Search, ChevronDown, ChevronUp, MapPin,
    CreditCard, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

interface Application {
    id: string; application_ref: string; status: string
    nom: string; prenom: string; email: string; telephone: string
    pays_residence: string; nationalite: string; profession: string
    afro_descendant_description: string; ancestor1_nom: string; ancestor1_lien_parente: string
    created_at: string; submitted_at: string; assigned_agent: string; agent_notes: string
    amount: number; currency: string; payment_status: string; payment_method: string; payment_ref: string
}

const statusMap: Record<string, { label: string; color: string }> = {
    brouillon: { label: 'Brouillon', color: 'bg-gray-500/20 text-gray-400' },
    soumis: { label: 'Soumis', color: 'bg-blue-500/20 text-blue-400' },
    en_traitement: { label: 'En traitement', color: 'bg-amber-500/20 text-amber-400' },
    verification: { label: 'Vérification', color: 'bg-purple-500/20 text-purple-400' },
    approuve: { label: 'Approuvé', color: 'bg-emerald-500/20 text-emerald-400' },
    rejete: { label: 'Rejeté', color: 'bg-red-500/20 text-red-400' },
}

export default function AdminNationalitePage() {
    const [apps, setApps] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [expanded, setExpanded] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const fetchApps = async () => {
        let q = supabase.from('nationality_applications').select('*').order('created_at', { ascending: false })
        if (filter !== 'all') q = q.eq('status', filter)
        if (search) q = q.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%,application_ref.ilike.%${search}%`)
        const { data } = await q
        setApps((data || []) as Application[])
        setLoading(false)
    }

    useEffect(() => { fetchApps() }, [filter, search])

    const updateStatus = async (id: string, status: string) => {
        await supabase.from('nationality_applications').update({ status, decision_date: status === 'approuve' || status === 'rejete' ? new Date().toISOString() : null }).eq('id', id)
        fetchApps()
    }

    const updateNotes = async (id: string, notes: string) => {
        await supabase.from('nationality_applications').update({ agent_notes: notes }).eq('id', id)
    }

    const downloadZip = async (id: string, ref: string) => {
        const res = await fetch(`/api/nationality/download?id=${id}`)
        if (res.ok) {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `Dossier_${ref}.zip`; a.click()
            URL.revokeObjectURL(url)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Gestion</span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Globe2 size={22} className="text-emerald-400" /> Demandes de Nationalité</h1>
                    </div>
                    <Link href="/admin/settings/payment" className="text-xs font-bold text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20 flex items-center gap-2 hover:bg-amber-500/20 transition-all">
                        <CreditCard size={14} /> Configurer Kkiapay / FedaPay / Zeyow <ExternalLink size={12} />
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {['all', 'soumis', 'en_traitement', 'verification', 'approuve', 'rejete'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${filter === f ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}>
                            {f === 'all' ? 'Toutes' : statusMap[f]?.label}
                        </button>
                    ))}
                    <div className="relative ml-auto"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-white text-xs focus:outline-none w-48" /></div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[{ l: 'Total', v: apps.length, c: 'text-white' }, { l: 'Soumises', v: apps.filter(a => a.status === 'soumis').length, c: 'text-blue-400' }, { l: 'Approuvées', v: apps.filter(a => a.status === 'approuve').length, c: 'text-emerald-400' }, { l: 'Rejetées', v: apps.filter(a => a.status === 'rejete').length, c: 'text-red-400' }].map((s, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center"><p className={`text-2xl font-black ${s.c}`}>{s.v}</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{s.l}</p></div>
                    ))}
                </div>

                {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div> : apps.length === 0 ? <div className="text-center py-20 text-gray-500"><Globe2 className="mx-auto mb-3 text-gray-700" size={40} /><p className="text-sm">Aucune demande</p></div> : (
                    <div className="space-y-3">{apps.map((a, i) => {
                        const st = statusMap[a.status] || statusMap.soumis
                        const isOpen = expanded === a.id
                        return (
                            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all">
                                <div className="p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : a.id)}>
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <div className="flex items-center gap-3 mb-1"><span className="text-xs font-mono font-bold text-[#FCD116]">{a.application_ref}</span><span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${st.color}`}>{st.label}</span></div>
                                            <p className="text-sm font-bold text-white">{a.prenom} {a.nom}</p>
                                            <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-500 flex-wrap">
                                                <span className="flex items-center gap-1"><Mail size={10} /> {a.email}</span>
                                                <span className="flex items-center gap-1"><MapPin size={10} /> {a.pays_residence}</span>
                                                <span>{new Date(a.created_at).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                                    </div>
                                </div>
                                {isOpen && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="border-t border-white/5 p-5 space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                            {[['Nationalité', a.nationalite], ['Profession', a.profession], ['Téléphone', a.telephone], ['Ancêtre', `${a.ancestor1_nom} (${a.ancestor1_lien_parente})`], ['Paiement', `${a.amount} ${a.currency} — ${a.payment_status}`], ['Passerelle', a.payment_method], ['TX Ref', a.payment_ref]].map(([k, v], j) => v && (
                                                <div key={j}><span className="text-gray-600 block">{k}</span><span className="text-white font-bold">{v}</span></div>
                                            ))}
                                        </div>
                                        {a.afro_descendant_description && <div><span className="text-[10px] text-gray-600 block mb-1">Description afro-descendance</span><p className="text-xs text-gray-400 bg-white/[0.02] rounded-lg p-3">{a.afro_descendant_description}</p></div>}
                                        <div><span className="text-[10px] text-gray-600 block mb-1">Notes agent</span><textarea defaultValue={a.agent_notes || ''} onBlur={e => updateNotes(a.id, e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-lg p-3 text-xs text-white focus:outline-none resize-none" rows={2} placeholder="Notes..." /></div>
                                        <div className="flex gap-2 flex-wrap">
                                            <button onClick={() => downloadZip(a.id, a.application_ref)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1"><Download size={12} /> Télécharger ZIP</button>
                                            {['soumis', 'en_traitement', 'verification', 'approuve', 'rejete'].filter(s => s !== a.status).map(s => (
                                                <button key={s} onClick={() => updateStatus(a.id, s)} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${statusMap[s]?.color}`}>{statusMap[s]?.label}</button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        )
                    })}</div>
                )}
            </div>
        </div>
    )
}
