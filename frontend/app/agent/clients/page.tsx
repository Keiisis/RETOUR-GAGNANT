'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Users, Search, Mail, Phone, Edit3, Trash2, X,
    Save, Loader2, Calendar, FileText, ChevronRight,
    Star, Globe, MessageSquare, FolderOpen, Wand2, Languages, Send
} from 'lucide-react'

type ClientSource = 'dossier' | 'message' | 'eligibilite' | 'nationalite'

interface Client {
    id: string
    nom: string
    prenom: string
    email: string
    telephone: string
    notes: string
    status: string
    service: string
    created_at: string
    source: ClientSource
    score?: number
}

const sourceConfig: Record<ClientSource, { color: string; label: string; icon: typeof FolderOpen }> = {
    dossier: { color: 'bg-sky-500/20 text-sky-400 border-sky-500/30', label: 'Dossier', icon: FolderOpen },
    message: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Contact', icon: MessageSquare },
    eligibilite: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Oracle', icon: Star },
    nationalite: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Nationalité', icon: Globe },
}

const statusConfig: Record<string, { color: string; label: string }> = {
    reception: { color: 'bg-sky-500/20 text-sky-400', label: 'Réception' },
    verification: { color: 'bg-cyan-500/20 text-cyan-400', label: 'Vérification' },
    traitement: { color: 'bg-blue-500/20 text-blue-400', label: 'Traitement' },
    validation: { color: 'bg-amber-500/20 text-amber-400', label: 'Validation' },
    finalisation: { color: 'bg-purple-500/20 text-purple-400', label: 'Finalisation' },
    termine: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Terminé' },
    annule: { color: 'bg-red-500/20 text-red-400', label: 'Annulé' },
    prospect: { color: 'bg-purple-500/20 text-purple-400', label: 'Prospect' },
    soumis: { color: 'bg-blue-500/20 text-blue-400', label: 'Soumis' },
    en_examen: { color: 'bg-amber-500/20 text-amber-400', label: 'En examen' },
    'approuvé': { color: 'bg-emerald-500/20 text-emerald-400', label: 'Approuvé' },
    'rejeté': { color: 'bg-red-500/20 text-red-400', label: 'Rejeté' },
    eligible: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Éligible' },
    non_eligible: { color: 'bg-red-500/20 text-red-400', label: 'Non éligible' },
}

export default function AgentClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterSource, setFilterSource] = useState<ClientSource | 'all'>('all')
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [saving, setSaving] = useState(false)

    // Email Modal states
    const [emailModalOpen, setEmailModalOpen] = useState(false)
    const [emailSubject, setEmailSubject] = useState('')
    const [emailMessage, setEmailMessage] = useState('')
    const [emailSending, setEmailSending] = useState(false)
    const [emailEnhancing, setEmailEnhancing] = useState(false)
    const [emailTranslating, setEmailTranslating] = useState(false)

    const [editNom, setEditNom] = useState('')
    const [editPrenom, setEditPrenom] = useState('')
    const [editEmail, setEditEmail] = useState('')
    const [editTelephone, setEditTelephone] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [editStatus, setEditStatus] = useState('')

    const fetchClients = async () => {
        const [dossierRes, messageRes, eligRes, natRes] = await Promise.all([
            supabase.from('dossier_tracking').select('*').order('created_at', { ascending: false }),
            supabase.from('messages').select('*').order('created_at', { ascending: false }),
            supabase.from('eligibility_results').select('*').order('created_at', { ascending: false }),
            supabase.from('nationality_applications').select('*').order('submitted_at', { ascending: false }),
        ])

        const seenEmails = new Set<string>()

        // 1. Dossier tracking
        const dossierClients: Client[] = (dossierRes.data || [])
            .filter((d: Record<string, unknown>) => {
                const email = (d.email as string) || ''
                if (!email || seenEmails.has(email)) return false
                seenEmails.add(email)
                return true
            })
            .map((d: Record<string, unknown>) => ({
                id: d.id as string,
                nom: (d.nom as string) || '',
                prenom: (d.prenom as string) || (d.client_prenom as string) || '',
                email: (d.email as string) || '',
                telephone: (d.telephone as string) || (d.client_phone as string) || '',
                notes: (d.notes as string) || '',
                status: (d.statut as string) || 'reception',
                service: (d.service as string) || 'Non spécifié',
                created_at: (d.created_at as string) || '',
                source: 'dossier' as ClientSource,
            }))

        // 2. Messages / contacts
        const messageClients: Client[] = (messageRes.data || [])
            .filter((m: Record<string, unknown>) => {
                const email = (m.email as string) || ''
                if (!email || seenEmails.has(email)) return false
                seenEmails.add(email)
                return true
            })
            .map((m: Record<string, unknown>) => ({
                id: m.id as string,
                nom: (m.nom as string) || '',
                prenom: (m.prenom as string) || '',
                email: (m.email as string) || '',
                telephone: (m.telephone as string) || '',
                notes: (m.message as string) || '',
                status: 'prospect',
                service: (m.sujet as string) || 'Contact',
                created_at: (m.created_at as string) || '',
                source: 'message' as ClientSource,
            }))

        // 3. Eligibility results (Oracle / scoring)
        const eligClients: Client[] = (eligRes.data || [])
            .filter((e: Record<string, unknown>) => {
                const email = (e.email as string) || ''
                if (!email || seenEmails.has(email)) return false
                seenEmails.add(email)
                return true
            })
            .map((e: Record<string, unknown>) => {
                const fullName = (e.full_name as string) || ''
                const parts = fullName.split(' ')
                return {
                    id: e.id as string,
                    nom: (e.nom as string) || (parts.slice(1).join(' ')) || '',
                    prenom: (e.prenom as string) || parts[0] || '',
                    email: (e.email as string) || '',
                    telephone: (e.telephone as string) || (e.phone as string) || '',
                    notes: (e.recommended_service as string) || '',
                    status: (e.is_eligible as boolean) ? 'eligible' : 'non_eligible',
                    service: (e.recommended_service as string) || (e.service as string) || 'Éligibilité',
                    created_at: (e.created_at as string) || '',
                    source: 'eligibilite' as ClientSource,
                    score: (e.score as number) || 0,
                }
            })

        // 4. Nationality applications
        const natClients: Client[] = (natRes.data || [])
            .filter((n: Record<string, unknown>) => {
                const email = (n.email as string) || ''
                if (!email || seenEmails.has(email)) return false
                seenEmails.add(email)
                return true
            })
            .map((n: Record<string, unknown>) => ({
                id: n.id as string,
                nom: (n.nom as string) || '',
                prenom: (n.prenom as string) || '',
                email: (n.email as string) || '',
                telephone: (n.phone as string) || (n.telephone as string) || '',
                notes: `Réf: ${(n.application_ref as string) || ''}`,
                status: (n.status as string) || 'soumis',
                service: 'Nationalité Béninoise',
                created_at: (n.submitted_at as string) || (n.created_at as string) || '',
                source: 'nationalite' as ClientSource,
            }))

        setClients([...dossierClients, ...messageClients, ...eligClients, ...natClients])
        setLoading(false)
    }

    useEffect(() => { fetchClients() }, [])

    const openClient = (client: Client) => {
        setSelectedClient(client)
        setEditMode(false)
    }

    const startEditClient = () => {
        if (!selectedClient) return
        setEditNom(selectedClient.nom)
        setEditPrenom(selectedClient.prenom)
        setEditEmail(selectedClient.email)
        setEditTelephone(selectedClient.telephone)
        setEditNotes(selectedClient.notes)
        setEditStatus(selectedClient.status)
        setEditMode(true)
    }

    const handleSaveClient = async () => {
        if (!selectedClient) return
        setSaving(true)

        const updateData = {
            nom: editNom, prenom: editPrenom, email: editEmail,
            telephone: editTelephone, notes: editNotes,
        }

        // Route update to correct table
        if (selectedClient.source === 'dossier') {
            await supabase.from('dossier_tracking').update({ ...updateData, statut: editStatus }).eq('id', selectedClient.id)
        } else if (selectedClient.source === 'message') {
            await supabase.from('messages').update({ nom: editNom, prenom: editPrenom, email: editEmail, telephone: editTelephone }).eq('id', selectedClient.id)
        } else if (selectedClient.source === 'nationalite') {
            await supabase.from('nationality_applications').update({ nom: editNom, prenom: editPrenom, email: editEmail, phone: editTelephone, status: editStatus }).eq('id', selectedClient.id)
        }
        // eligibility_results is read-only (Oracle scoring)

        const updated = { ...selectedClient, ...updateData, status: editStatus }
        setSelectedClient(updated)
        setClients(prev => prev.map(c => c.id === selectedClient.id ? updated : c))
        setEditMode(false)
        setSaving(false)
    }

    const handleDeleteClient = async () => {
        if (!selectedClient) return
        const table = selectedClient.source === 'dossier' ? 'dossier_tracking'
            : selectedClient.source === 'message' ? 'messages'
            : selectedClient.source === 'nationalite' ? 'nationality_applications'
            : null
        if (table) {
            await supabase.from(table).delete().eq('id', selectedClient.id)
        }
        setClients(prev => prev.filter(c => c.id !== selectedClient.id))
        setSelectedClient(null)
    }

    const handleOpenEmail = () => {
        if (!selectedClient) return
        setEmailSubject(`Retour Gagnant - Suivi de votre demande`)
        setEmailMessage('')
        setEmailModalOpen(true)
    }

    const handleEnhanceEmail = async () => {
        if (!emailMessage) return
        setEmailEnhancing(true)
        try {
            const res = await fetch('/api/ai/enhance-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: emailMessage })
            })
            const data = await res.json()
            if (data.enhanced) setEmailMessage(data.enhanced)
        } catch (e) {
            console.error(e)
        }
        setEmailEnhancing(false)
    }

    const handleTranslateEmail = async () => {
        if (!emailMessage || !selectedClient) return
        setEmailTranslating(true)
        try {
            const res = await fetch('/api/ai/translate-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: emailMessage,
                    clientContext: {
                        nom: selectedClient.nom,
                        prenom: selectedClient.prenom,
                        telephone: selectedClient.telephone,
                        notes: selectedClient.notes,
                        service: selectedClient.service
                    }
                })
            })
            const data = await res.json()
            if (data.translated) setEmailMessage(data.translated)
        } catch (e) {
            console.error(e)
        }
        setEmailTranslating(false)
    }

    const handleSendEmail = async () => {
        if (!selectedClient || !emailMessage || !emailSubject) return
        setEmailSending(true)
        try {
            const res = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedClient.email,
                    subject: emailSubject,
                    message: emailMessage,
                    clientName: `${selectedClient.nom} ${selectedClient.prenom}`,
                    context: 'agent_reply',
                    relatedId: selectedClient.id
                })
            })
            if (res.ok) {
                setEmailModalOpen(false)
            }
        } catch (e) {
            console.error(e)
        }
        setEmailSending(false)
    }

    const filtered = clients.filter(c => {
        const matchSearch = c.nom.toLowerCase().includes(search.toLowerCase()) ||
            c.prenom?.toLowerCase().includes(search.toLowerCase()) ||
            c.email.toLowerCase().includes(search.toLowerCase()) ||
            c.service?.toLowerCase().includes(search.toLowerCase())
        const matchSource = filterSource === 'all' || c.source === filterSource
        return matchSearch && matchSource
    })

    const sourceKeys = Object.keys(sourceConfig) as ClientSource[]

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
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">CRM</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Clients</h1>
                    <p className="text-gray-500 text-sm mt-1">{clients.length} client(s) — 4 sources</p>
                </div>
            </div>

            {/* Source stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {sourceKeys.map(src => {
                    const cfg = sourceConfig[src]
                    const Icon = cfg.icon
                    const count = clients.filter(c => c.source === src).length
                    return (
                        <button
                            key={src}
                            onClick={() => setFilterSource(filterSource === src ? 'all' : src)}
                            className={`border rounded-xl p-4 text-left transition-all ${filterSource === src ? cfg.color : 'bg-white/[0.03] border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon size={12} />
                                <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{cfg.label}</p>
                            </div>
                            <p className="text-2xl font-black text-white">{count}</p>
                        </button>
                    )
                })}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher un client..."
                        title="Rechercher"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                    />
                </div>
                {filterSource !== 'all' && (
                    <button onClick={() => setFilterSource('all')} className={`flex items-center gap-1 text-xs px-3 py-2 rounded-xl font-bold border ${sourceConfig[filterSource].color}`}>
                        {sourceConfig[filterSource].label} <X size={10} />
                    </button>
                )}
            </div>

            {/* Client List */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                <div className="divide-y divide-white/5">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Users size={40} className="mx-auto mb-3 text-gray-700" />
                            <p className="text-sm font-semibold">Aucun client trouvé</p>
                        </div>
                    ) : (
                        filtered.map((client, i) => {
                            const src = sourceConfig[client.source]
                            const SrcIcon = src.icon
                            return (
                                <motion.div
                                    key={`${client.source}-${client.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.02 }}
                                    onClick={() => openClient(client)}
                                    className="p-4 hover:bg-white/[0.02] transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                                                {(client.nom?.[0] || '?').toUpperCase()}{(client.prenom?.[0] || '').toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-white">{client.nom} {client.prenom}</p>
                                                    {client.score !== undefined && client.score > 0 && (
                                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{client.score}%</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><Mail size={11} /> {client.email}</span>
                                                    {client.telephone && <span className="flex items-center gap-1"><Phone size={11} /> {client.telephone}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`hidden sm:flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${src.color}`}>
                                                <SrcIcon size={9} /> {src.label}
                                            </span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[client.status]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                                {statusConfig[client.status]?.label || client.status}
                                            </span>
                                            <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Client Detail / Edit Modal */}
            <AnimatePresence>
                {selectedClient && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedClient(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">{editMode ? 'Modifier' : `${selectedClient.nom} ${selectedClient.prenom}`}</h3>
                                    {!editMode && (
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sourceConfig[selectedClient.source].color}`}>
                                            {sourceConfig[selectedClient.source].label}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {!editMode && selectedClient.source !== 'eligibilite' && (
                                        <button onClick={startEditClient} className="text-gray-500 hover:text-blue-400" title="Modifier"><Edit3 size={16} /></button>
                                    )}
                                    {!editMode && selectedClient.source !== 'eligibilite' && (
                                        <button onClick={handleDeleteClient} className="text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={16} /></button>
                                    )}
                                    <button onClick={() => setSelectedClient(null)} className="text-gray-500 hover:text-white" title="Fermer"><X size={16} /></button>
                                </div>
                            </div>

                            {editMode ? (
                                <div className="space-y-3">
                                    <input type="text" value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Nom" title="Nom" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="text" value={editPrenom} onChange={e => setEditPrenom(e.target.value)} placeholder="Prénom" title="Prénom" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" title="Email" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="text" value={editTelephone} onChange={e => setEditTelephone(e.target.value)} placeholder="Téléphone" title="Téléphone" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    {(selectedClient.source === 'dossier' || selectedClient.source === 'nationalite') && (
                                        <select value={editStatus} onChange={e => setEditStatus(e.target.value)} title="Statut" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                                            {selectedClient.source === 'dossier' ? (
                                                <>
                                                    <option value="reception">Réception</option>
                                                    <option value="verification">Vérification</option>
                                                    <option value="traitement">Traitement</option>
                                                    <option value="validation">Validation</option>
                                                    <option value="finalisation">Finalisation</option>
                                                    <option value="termine">Terminé</option>
                                                    <option value="annule">Annulé</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="soumis">Soumis</option>
                                                    <option value="en_examen">En examen</option>
                                                    <option value="approuvé">Approuvé</option>
                                                    <option value="rejeté">Rejeté</option>
                                                </>
                                            )}
                                        </select>
                                    )}
                                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes" title="Notes" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold">Annuler</button>
                                        <button onClick={handleSaveClient} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold flex items-center justify-center gap-2">
                                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Sauvegarder
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-lg">
                                            {(selectedClient.nom?.[0] || '?').toUpperCase()}{(selectedClient.prenom?.[0] || '').toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{selectedClient.nom} {selectedClient.prenom}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[selectedClient.status]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                                    {statusConfig[selectedClient.status]?.label || selectedClient.status}
                                                </span>
                                                {selectedClient.score !== undefined && selectedClient.score > 0 && (
                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">Score {selectedClient.score}%</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 bg-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><Mail size={14} className="text-emerald-400" /> {selectedClient.email}</div>
                                        {selectedClient.telephone && <div className="flex items-center gap-2 text-sm text-gray-300"><Phone size={14} className="text-emerald-400" /> {selectedClient.telephone}</div>}
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><FileText size={14} className="text-emerald-400" /> {selectedClient.service}</div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><Calendar size={14} className="text-emerald-400" /> {new Date(selectedClient.created_at).toLocaleDateString('fr-FR')}</div>
                                    </div>

                                    {selectedClient.notes && (
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                                            <p className="text-sm text-gray-300">{selectedClient.notes}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <button onClick={handleOpenEmail} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/30 transition-all" title="Envoyer un email"><Mail size={12} /> Email</button>
                                        {selectedClient.telephone && (
                                            <a href={`https://wa.me/${selectedClient.telephone.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30 font-bold hover:bg-green-500/30 transition-all" title="WhatsApp"><Phone size={12} /> WhatsApp</a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal Email Smart Compose */}
            <AnimatePresence>
                {emailModalOpen && selectedClient && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => setEmailModalOpen(false)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-white flex items-center gap-2">
                                        <Mail size={20} className="text-blue-400" /> NOUVEAU MESSAGE
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1">À : <span className="font-bold text-white">{selectedClient.email}</span></p>
                                </div>
                                <button onClick={() => setEmailModalOpen(false)} className="text-gray-500 hover:text-white" title="Fermer"><X size={20} /></button>
                            </div>

                            <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-premium">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Sujet de l&apos;email</label>
                                    <input 
                                        type="text" 
                                        value={emailSubject} 
                                        onChange={e => setEmailSubject(e.target.value)} 
                                        title="Sujet de l'email"
                                        placeholder="Sujet"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50" 
                                    />
                                </div>
                                <div className="flex-1 flex flex-col">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Message (sera inséré dans le template KAGE)</label>
                                    <textarea 
                                        value={emailMessage} 
                                        onChange={e => setEmailMessage(e.target.value)} 
                                        title="Message de l'email"
                                        placeholder="Rédigez votre réponse ici..." 
                                        className="w-full flex-1 min-h-[250px] bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-y" 
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-4 border-t border-white/10">
                                <button 
                                    onClick={handleEnhanceEmail} 
                                    disabled={emailEnhancing || !emailMessage}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all font-bold text-xs disabled:opacity-50"
                                >
                                    {emailEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Améliorer le texte
                                </button>
                                <button 
                                    onClick={handleTranslateEmail} 
                                    disabled={emailTranslating || !emailMessage}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all font-bold text-xs disabled:opacity-50"
                                >
                                    {emailTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} Traduire (Auto)
                                </button>
                                <div className="flex-1" />
                                <button 
                                    onClick={handleSendEmail} 
                                    disabled={emailSending || !emailMessage || !emailSubject}
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-sm transition-all disabled:opacity-50"
                                >
                                    {emailSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    Envoyer
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
