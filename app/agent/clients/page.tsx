'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Users, Search, Tag, Phone, Mail, Calendar,
    ChevronRight, Star, Globe, Briefcase, MessageSquare
} from 'lucide-react'

interface Client {
    id: string
    num_dossier: string
    client_nom: string
    client_prenom: string
    client_email: string
    client_phone: string
    service_type: string
    status: string
    created_at: string
}

export default function AgentClientsPage() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedTag, setSelectedTag] = useState<string>('all')

    useEffect(() => {
        const fetchClients = async () => {
            const { data } = await supabase
                .from('dossier_tracking')
                .select('*')
                .order('created_at', { ascending: false })

            setClients((data || []) as Client[])
            setLoading(false)
        }
        fetchClients()
    }, [])

    const filtered = clients.filter(c => {
        const match = c.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            c.client_email?.toLowerCase().includes(search.toLowerCase()) ||
            c.num_dossier?.toLowerCase().includes(search.toLowerCase())

        if (selectedTag === 'all') return match
        return match && c.status === selectedTag
    })

    // Déduplique par email pour une vue "client unique"
    const uniqueClients = filtered.reduce<Client[]>((acc, c) => {
        if (!acc.find(existing => existing.client_email === c.client_email)) {
            acc.push(c)
        }
        return acc
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white">Fiches Clients</h1>
                    <p className="text-gray-500 text-sm mt-1">{uniqueClients.length} client(s) unique(s)</p>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un client..."
                        title="Rechercher"
                        className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-64"
                    />
                </div>
            </div>

            {/* Client Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {uniqueClients.length === 0 ? (
                    <div className="col-span-full bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        Aucun client trouvé
                    </div>
                ) : (
                    uniqueClients.map((c, i) => {
                        const clientDossiers = clients.filter(d => d.client_email === c.client_email)
                        return (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all group"
                            >
                                {/* Client Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 flex items-center justify-center text-white font-bold text-lg">
                                        {c.client_nom?.charAt(0).toUpperCase()}{c.client_prenom?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">{c.client_nom} {c.client_prenom}</p>
                                        <p className="text-[10px] text-gray-500">{clientDossiers.length} dossier(s)</p>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Mail size={12} className="text-emerald-400 flex-shrink-0" />
                                        <span className="truncate">{c.client_email || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Phone size={12} className="text-emerald-400 flex-shrink-0" />
                                        <span>{c.client_phone || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Briefcase size={12} className="text-emerald-400 flex-shrink-0" />
                                        <span>{c.service_type || 'Non défini'}</span>
                                    </div>
                                </div>

                                {/* Tags / Dossiers */}
                                <div className="flex flex-wrap gap-1.5">
                                    {clientDossiers.map(d => (
                                        <span
                                            key={d.id}
                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.status === 'termine' ? 'bg-green-500/20 text-green-400' :
                                                    d.status === 'en_cours' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                }`}
                                        >
                                            {d.num_dossier}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
