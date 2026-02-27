'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Send, Plus, FileText, Trash2,
    CheckCircle2, Loader2, Clock, Mail,
    Eye, X
} from 'lucide-react'

interface DevisItem {
    service: string
    price: number
}

interface Devis {
    id: string
    client_nom: string
    client_email: string
    items: DevisItem[]
    total: number
    status: string
    notes: string
    created_at: string
}

export default function AgentDevisPage() {
    const [devisList, setDevisList] = useState<Devis[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [selectedDevis, setSelectedDevis] = useState<Devis | null>(null)

    // Form state
    const [clientNom, setClientNom] = useState('')
    const [clientEmail, setClientEmail] = useState('')
    const [items, setItems] = useState<DevisItem[]>([{ service: '', price: 0 }])
    const [notes, setNotes] = useState('')

    const fetchDevis = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('agent_devis')
            .select('*')
            .eq('agent_id', user.id)
            .order('created_at', { ascending: false })

        setDevisList((data || []) as Devis[])
        setLoading(false)
    }

    useEffect(() => {
        fetchDevis()
    }, [])

    const addItem = () => setItems([...items, { service: '', price: 0 }])
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))
    const updateItem = (i: number, field: keyof DevisItem, value: string | number) => {
        const updated = [...items]
        updated[i] = { ...updated[i], [field]: field === 'price' ? Number(value) : value }
        setItems(updated)
    }

    const total = items.reduce((sum, item) => sum + item.price, 0)

    const handleSaveDevis = async () => {
        if (!clientNom.trim() || items.some(i => !i.service.trim())) return
        setSaving(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('agent_devis').insert({
            agent_id: user.id,
            client_nom: clientNom,
            client_email: clientEmail,
            items: items,
            total: total,
            notes: notes,
            status: 'brouillon',
        })

        if (!error) {
            await fetchDevis()
            resetForm()
        }
        setSaving(false)
    }

    const handleSendDevis = async (devis: Devis) => {
        if (!devis.client_email) return

        await supabase.from('agent_devis').update({ status: 'envoye' }).eq('id', devis.id)

        const subject = encodeURIComponent(`Devis Retour Gagnant - ${devis.client_nom}`)
        const body = encodeURIComponent(
            `Bonjour ${devis.client_nom},\n\nVeuillez trouver ci-dessous votre devis :\n\n` +
            devis.items.map(i => `• ${i.service}: ${i.price.toLocaleString('fr-FR')} FCFA`).join('\n') +
            `\n\nTotal: ${devis.total.toLocaleString('fr-FR')} FCFA\n\n${devis.notes ? `Notes : ${devis.notes}\n\n` : ''}Cordialement,\nRetour Gagnant`
        )
        window.open(`mailto:${devis.client_email}?subject=${subject}&body=${body}`, '_blank')

        await fetchDevis()
    }

    const handleDeleteDevis = async (id: string) => {
        await supabase.from('agent_devis').delete().eq('id', id)
        setDevisList(prev => prev.filter(d => d.id !== id))
        setSelectedDevis(null)
    }

    const resetForm = () => {
        setShowForm(false)
        setClientNom('')
        setClientEmail('')
        setItems([{ service: '', price: 0 }])
        setNotes('')
    }

    const statusConfig: Record<string, { color: string; label: string }> = {
        brouillon: { color: 'bg-gray-500/20 text-gray-400', label: 'Brouillon' },
        envoye: { color: 'bg-blue-500/20 text-blue-400', label: 'Envoyé' },
        accepte: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Accepté' },
        refuse: { color: 'bg-red-500/20 text-red-400', label: 'Refusé' },
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Devis &amp; Facturation</h1>
                    <p className="text-gray-500 text-sm mt-1">{devisList.length} devis créé(s)</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                >
                    <Plus size={16} /> Nouveau Devis
                </button>
            </div>

            {/* Devis List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {devisList.length === 0 && !showForm ? (
                    <div className="col-span-full bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        <FileText size={40} className="mx-auto mb-3 text-gray-700" />
                        <p className="text-sm font-semibold">Aucun devis pour le moment</p>
                        <p className="text-xs mt-1">Créez votre premier devis en cliquant sur &quot;Nouveau Devis&quot;</p>
                    </div>
                ) : (
                    devisList.map((devis, i) => (
                        <motion.div
                            key={devis.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-sm font-bold text-white">{devis.client_nom}</p>
                                    <p className="text-[10px] text-gray-500">{new Date(devis.created_at).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[devis.status]?.color || ''}`}>
                                    {statusConfig[devis.status]?.label || devis.status}
                                </span>
                            </div>
                            <p className="text-2xl font-black text-white mb-3">{devis.total.toLocaleString('fr-FR')} <span className="text-xs text-gray-500">FCFA</span></p>
                            <p className="text-[10px] text-gray-500 mb-3">{devis.items.length} prestation(s)</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedDevis(devis)}
                                    className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"
                                    title="Voir détails"
                                >
                                    <Eye size={12} /> Détails
                                </button>
                                {devis.status === 'brouillon' && devis.client_email && (
                                    <button
                                        onClick={() => handleSendDevis(devis)}
                                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all"
                                        title="Envoyer"
                                    >
                                        <Send size={12} /> Envoyer
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* New Devis Form Modal */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={resetForm}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                            <h3 className="text-lg font-bold text-white mb-4">Nouveau Devis</h3>
                            <div className="space-y-3">
                                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="Nom du client" title="Nom client" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email du client" title="Email client" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-gray-400">Prestations</p>
                                    {items.map((item, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input type="text" value={item.service} onChange={e => updateItem(i, 'service', e.target.value)} placeholder="Service" title="Service" className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                            <input type="number" value={item.price || ''} onChange={e => updateItem(i, 'price', e.target.value)} placeholder="Prix" title="Prix" className="w-28 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                            {items.length > 1 && (
                                                <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300" title="Supprimer la ligne"><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addItem} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Plus size={12} /> Ajouter une ligne</button>
                                </div>

                                <div className="bg-white/5 rounded-xl p-3 text-right">
                                    <span className="text-sm text-gray-400">Total : </span>
                                    <span className="text-lg font-black text-white">{total.toLocaleString('fr-FR')} FCFA</span>
                                </div>

                                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optionnel)" title="Notes" rows={2} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />

                                <div className="flex gap-3 pt-2">
                                    <button onClick={resetForm} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">Annuler</button>
                                    <button onClick={handleSaveDevis} disabled={saving || !clientNom.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Sauvegarder
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Devis Detail Modal */}
            <AnimatePresence>
                {selectedDevis && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDevis(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">Devis — {selectedDevis.client_nom}</h3>
                                <button onClick={() => setSelectedDevis(null)} className="text-gray-500 hover:text-white" title="Fermer"><X size={18} /></button>
                            </div>
                            <div className="space-y-3">
                                {selectedDevis.client_email && (
                                    <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={12} className="text-emerald-400" /> {selectedDevis.client_email}</p>
                                )}
                                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {new Date(selectedDevis.created_at).toLocaleDateString('fr-FR')}</p>

                                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                                    {selectedDevis.items.map((item: DevisItem, i: number) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-300">{item.service}</span>
                                            <span className="text-white font-bold">{item.price.toLocaleString('fr-FR')} FCFA</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-white/10 pt-2 flex justify-between">
                                        <span className="text-sm font-bold text-emerald-400">Total</span>
                                        <span className="text-lg font-black text-white">{selectedDevis.total.toLocaleString('fr-FR')} FCFA</span>
                                    </div>
                                </div>

                                {selectedDevis.notes && <p className="text-xs text-gray-400 bg-white/5 rounded-xl p-3">{selectedDevis.notes}</p>}

                                <button onClick={() => handleDeleteDevis(selectedDevis.id)} className="w-full py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all flex items-center justify-center gap-1">
                                    <Trash2 size={12} /> Supprimer ce devis
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
