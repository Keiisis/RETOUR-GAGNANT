'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Users, Search, Mail, Phone, Edit3, Trash2, X,
    Save, Loader2, Calendar, FileText, MapPin, ChevronRight
} from 'lucide-react'

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
    client_prenom?: string
    client_phone?: string
}

export default function AgentClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [saving, setSaving] = useState(false)

    // Edit form
    const [editNom, setEditNom] = useState('')
    const [editPrenom, setEditPrenom] = useState('')
    const [editEmail, setEditEmail] = useState('')
    const [editTelephone, setEditTelephone] = useState('')
    const [editNotes, setEditNotes] = useState('')
    const [editStatus, setEditStatus] = useState('')

    const fetchClients = async () => {
        // Fetch from dossier_tracking and messages (unique clients)
        const [dossierRes, messageRes] = await Promise.all([
            supabase.from('dossier_tracking').select('*').order('created_at', { ascending: false }),
            supabase.from('messages').select('*').order('created_at', { ascending: false }),
        ])

        const dossierClients = (dossierRes.data || []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            nom: (d.nom as string) || '',
            prenom: (d.prenom as string) || (d.client_prenom as string) || '',
            email: (d.email as string) || '',
            telephone: (d.telephone as string) || (d.client_phone as string) || '',
            notes: (d.notes as string) || '',
            status: (d.statut as string) || 'reception',
            service: (d.service as string) || 'Non spécifié',
            created_at: (d.created_at as string) || '',
        }))

        const messageClients = (messageRes.data || [])
            .filter((m: Record<string, unknown>) => m.email && !dossierClients.some((dc: Client) => dc.email === m.email))
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
            }))

        const allClients = [...dossierClients, ...messageClients]
        // Remove duplicates by email
        const unique = allClients.filter((c, i, self) => i === self.findIndex(t => t.email === c.email))
        setClients(unique)
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
            nom: editNom,
            prenom: editPrenom,
            email: editEmail,
            telephone: editTelephone,
            notes: editNotes,
            statut: editStatus,
        }

        await supabase.from('dossier_tracking').update(updateData).eq('id', selectedClient.id)

        setSelectedClient({ ...selectedClient, ...updateData })
        setClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, ...updateData } : c))
        setEditMode(false)
        setSaving(false)
    }

    const handleDeleteClient = async () => {
        if (!selectedClient) return
        await supabase.from('dossier_tracking').delete().eq('id', selectedClient.id)
        setClients(prev => prev.filter(c => c.id !== selectedClient.id))
        setSelectedClient(null)
    }

    const filtered = clients.filter(c =>
        c.nom.toLowerCase().includes(search.toLowerCase()) ||
        c.prenom?.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        c.service?.toLowerCase().includes(search.toLowerCase())
    )

    const statusConfig: Record<string, { color: string; label: string }> = {
        reception: { color: 'bg-sky-500/20 text-sky-400', label: 'Réception' },
        verification: { color: 'bg-cyan-500/20 text-cyan-400', label: 'Vérification' },
        traitement: { color: 'bg-blue-500/20 text-blue-400', label: 'Traitement' },
        validation: { color: 'bg-amber-500/20 text-amber-400', label: 'Validation' },
        finalisation: { color: 'bg-purple-500/20 text-purple-400', label: 'Finalisation' },
        termine: { color: 'bg-emerald-500/20 text-emerald-400', label: 'Terminé' },
        annule: { color: 'bg-red-500/20 text-red-400', label: 'Annulé' },
        prospect: { color: 'bg-purple-500/20 text-purple-400', label: 'Prospect' },
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
                    <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">CRM</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Clients</h1>
                    <p className="text-gray-500 text-sm mt-1">{clients.length} client(s) enregistré(s)</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total', value: clients.length, color: 'text-white' },
                    { label: 'En cours', value: clients.filter(c => ['traitement', 'validation', 'finalisation'].includes(c.status)).length, color: 'text-blue-400' },
                    { label: 'Terminés', value: clients.filter(c => c.status === 'termine').length, color: 'text-emerald-400' },
                    { label: 'Prospects', value: clients.filter(c => c.status === 'prospect').length, color: 'text-purple-400' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un client..." title="Rechercher" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm" />
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
                        filtered.map((client, i) => (
                            <motion.div
                                key={client.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => openClient(client)}
                                className="p-4 hover:bg-white/[0.02] transition-all cursor-pointer group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                                            {(client.nom?.[0] || '?').toUpperCase()}{(client.prenom?.[0] || '').toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{client.nom} {client.prenom}</p>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                                                <span className="flex items-center gap-1"><Mail size={11} /> {client.email}</span>
                                                {client.telephone && <span className="flex items-center gap-1"><Phone size={11} /> {client.telephone}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="hidden lg:block text-[10px] font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-full flex items-center gap-1">
                                            <FileText size={10} /> {client.service}
                                        </span>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[client.status]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                            {statusConfig[client.status]?.label || client.status}
                                        </span>
                                        <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* Client Detail / Edit Modal */}
            <AnimatePresence>
                {selectedClient && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedClient(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-white">{editMode ? 'Modifier le client' : `${selectedClient.nom} ${selectedClient.prenom}`}</h3>
                                <div className="flex items-center gap-2">
                                    {!editMode && <button onClick={startEditClient} className="text-gray-500 hover:text-blue-400" title="Modifier"><Edit3 size={16} /></button>}
                                    {!editMode && <button onClick={handleDeleteClient} className="text-gray-500 hover:text-red-400" title="Supprimer"><Trash2 size={16} /></button>}
                                    <button onClick={() => setSelectedClient(null)} className="text-gray-500 hover:text-white" title="Fermer"><X size={16} /></button>
                                </div>
                            </div>

                            {editMode ? (
                                <div className="space-y-3">
                                    <input type="text" value={editNom} onChange={e => setEditNom(e.target.value)} placeholder="Nom" title="Nom" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="text" value={editPrenom} onChange={e => setEditPrenom(e.target.value)} placeholder="Prénom" title="Prénom" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" title="Email" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <input type="text" value={editTelephone} onChange={e => setEditTelephone(e.target.value)} placeholder="Téléphone" title="Téléphone" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} title="Statut" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                                        <option value="reception">Réception</option>
                                        <option value="verification">Vérification</option>
                                        <option value="traitement">Traitement</option>
                                        <option value="validation">Validation</option>
                                        <option value="finalisation">Finalisation</option>
                                        <option value="termine">Terminé</option>
                                        <option value="annule">Annulé</option>
                                    </select>
                                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes" title="Notes" rows={4} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
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
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig[selectedClient.status]?.color || ''}`}>
                                                {statusConfig[selectedClient.status]?.label || selectedClient.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 bg-white/5 rounded-xl p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><Mail size={14} className="text-emerald-400" /> {selectedClient.email}</div>
                                        {selectedClient.telephone && <div className="flex items-center gap-2 text-sm text-gray-300"><Phone size={14} className="text-emerald-400" /> {selectedClient.telephone}</div>}
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><FileText size={14} className="text-emerald-400" /> {selectedClient.service}</div>
                                        <div className="flex items-center gap-2 text-sm text-gray-300"><Calendar size={14} className="text-emerald-400" /> Inscrit le {new Date(selectedClient.created_at).toLocaleDateString('fr-FR')}</div>
                                    </div>

                                    {selectedClient.notes && (
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                                            <p className="text-sm text-gray-300">{selectedClient.notes}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <a href={`mailto:${selectedClient.email}`} className="flex-1 flex items-center justify-center gap-1 text-xs py-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-500/30 transition-all" title="Envoyer un email"><Mail size={12} /> Email</a>
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
        </div>
    )
}
