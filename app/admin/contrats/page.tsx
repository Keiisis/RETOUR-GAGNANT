'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    FileSignature, Plus, Send, CheckCircle2, Clock,
    X, Save, User, Mail, DollarSign, FileText, Search,
    LucideIcon
} from 'lucide-react'

interface Contract {
    id: string
    client_nom: string
    client_email: string
    title: string
    content: string
    amount: number
    currency: string
    status: string
    signed_at: string | null
    signature_hash: string
    agent_name: string
    created_at: string
    expires_at: string
}

export default function AdminContractsPage() {
    const [contracts, setContracts] = useState<Contract[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [form, setForm] = useState({
        client_nom: '', client_email: '', title: '',
        content: '', amount: 0, currency: 'XOF'
    })

    const fetchContracts = async () => {
        const { data } = await supabase.from('contracts').select('*').order('created_at', { ascending: false })
        setContracts((data || []) as Contract[])
        setLoading(false)
    }

    useEffect(() => { fetchContracts() }, [])

    const handleCreate = async () => {
        if (!form.client_nom || !form.client_email || !form.title || !form.content) return
        await supabase.from('contracts').insert({
            ...form,
            status: 'brouillon',
            agent_name: 'Admin',
        })
        setCreating(false)
        setForm({ client_nom: '', client_email: '', title: '', content: '', amount: 0, currency: 'XOF' })
        fetchContracts()
    }

    const sendContract = async (contract: Contract) => {
        // Update status to 'envoye'
        await supabase.from('contracts').update({ status: 'envoye' }).eq('id', contract.id)

        // Send email notification
        try {
            await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: contract.client_email,
                    subject: `Retour Gagnant — Contrat à signer : ${contract.title}`,
                    message: `Bonjour ${contract.client_nom},\n\nUn contrat "${contract.title}" d'un montant de ${contract.amount?.toLocaleString()} ${contract.currency} est prêt pour votre signature.\n\nRendez-vous sur votre Espace Client (Mon Compte) pour le consulter et le signer électroniquement.\n\nL'équipe Retour Gagnant`,
                    clientName: contract.client_nom,
                    context: 'contract_notification',
                    relatedId: contract.id
                })
            })
        } catch { }

        fetchContracts()
    }

    const statusConfig: Record<string, { label: string, color: string, icon: LucideIcon }> = {
        brouillon: { label: 'Brouillon', color: 'bg-gray-500/20 text-gray-400', icon: FileText },
        envoye: { label: 'Envoyé', color: 'bg-blue-500/20 text-blue-400', icon: Send },
        signe: { label: 'Signé', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
        refuse: { label: 'Refusé', color: 'bg-red-500/20 text-red-400', icon: X },
        expire: { label: 'Expiré', color: 'bg-amber-500/20 text-amber-400', icon: Clock },
    }

    if (creating) {
        return (
            <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-xl font-black text-white">Nouveau Contrat / Devis</h1>
                        <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Nom du client *</label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="text" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} placeholder="Jean Dupont" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Email du client *</label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} placeholder="email@client.com" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Titre du contrat *</label>
                            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Contrat d'accompagnement — Nationalité" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Montant</label>
                                <div className="relative">
                                    <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Devise</label>
                                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none">
                                    <option value="XOF">XOF (FCFA)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="USD">USD ($)</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Contenu du contrat *</label>
                            <textarea rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Termes et conditions du contrat..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none resize-none font-mono" />
                        </div>
                        <button onClick={handleCreate} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm">
                            <Save size={16} /> Créer le contrat
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Gestion</span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <FileSignature size={22} className="text-emerald-400" /> Contrats & Devis
                        </h1>
                    </div>
                    <button onClick={() => setCreating(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
                        <Plus size={16} /> Nouveau Contrat
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : contracts.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <FileSignature className="mx-auto mb-3 text-gray-700" size={40} />
                        <p className="text-sm">Aucun contrat créé</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {contracts.map((c, i) => {
                            const cfg = statusConfig[c.status] || statusConfig.brouillon
                            return (
                                <motion.div
                                    key={c.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-white">{c.title}</p>
                                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                                                <span className="flex items-center gap-1"><User size={10} /> {c.client_nom}</span>
                                                <span className="flex items-center gap-1"><Mail size={10} /> {c.client_email}</span>
                                                <span>{c.amount?.toLocaleString()} {c.currency}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}>
                                                <cfg.icon size={10} /> {cfg.label}
                                            </span>
                                            {c.status === 'brouillon' && (
                                                <button
                                                    onClick={() => sendContract(c)}
                                                    className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                >
                                                    <Send size={12} /> Envoyer
                                                </button>
                                            )}
                                            {c.status === 'signe' && c.signature_hash && (
                                                <span className="text-[9px] text-gray-600 font-mono" title={c.signature_hash}>
                                                    Hash: {c.signature_hash.slice(0, 12)}...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
