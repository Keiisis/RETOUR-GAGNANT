'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Headphones, Search, Clock, CheckCircle2, Volume2,
    User, Calendar, Mail
} from 'lucide-react'

interface VoiceMessage {
    id: string
    client_nom: string
    client_prenom: string
    client_email: string
    transcript: string
    duration_seconds: number
    source: string
    is_read: boolean
    created_at: string
}

export default function AgentVocauxPage() {
    const [vocaux, setVocaux] = useState<VoiceMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    useEffect(() => {
        fetchVocaux()
    }, [])

    const fetchVocaux = async () => {
        const { data } = await supabase
            .from('voice_messages')
            .select('*')
            .order('created_at', { ascending: false })

        setVocaux((data || []) as VoiceMessage[])
        setLoading(false)
    }

    const markAsRead = async (id: string) => {
        await supabase.from('voice_messages').update({ is_read: true }).eq('id', id)
        setVocaux(prev => prev.map(v => v.id === id ? { ...v, is_read: true } : v))
    }

    const filtered = vocaux.filter(v => {
        const matchSearch = v.client_nom?.toLowerCase().includes(search.toLowerCase()) ||
            v.transcript?.toLowerCase().includes(search.toLowerCase())

        if (filter === 'unread') return matchSearch && !v.is_read
        return matchSearch
    })

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
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
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Headphones size={16} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.3em]">Voice-to-Support</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Messages Vocaux</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {vocaux.length} message(s) vocal(aux) • {vocaux.filter(v => !v.is_read).length} non lu(s)
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher..."
                            title="Rechercher un message vocal"
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm w-56"
                        />
                    </div>

                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {[
                            { key: 'all', label: 'Tous' },
                            { key: 'unread', label: 'Non Lus' },
                        ].map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key as typeof filter)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === f.key ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vocal Cards */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">
                        Aucun message vocal
                    </div>
                ) : (
                    filtered.map((v, i) => (
                        <motion.div
                            key={v.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={`bg-white/[0.03] border rounded-xl p-5 transition-all ${!v.is_read ? 'border-purple-500/30 bg-purple-500/[0.03]' : 'border-white/5'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${!v.is_read ? 'bg-purple-500/20' : 'bg-white/5'
                                        }`}>
                                        <Volume2 size={20} className={!v.is_read ? 'text-purple-400' : 'text-gray-500'} />
                                    </div>

                                    <div>
                                        {/* Sender */}
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-bold text-white">
                                                {v.client_nom || 'Client Anonyme'} {v.client_prenom}
                                            </p>
                                            {!v.is_read && (
                                                <span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-bold">
                                                    Nouveau
                                                </span>
                                            )}
                                        </div>

                                        {/* Transcript */}
                                        <p className="text-sm text-gray-300 leading-relaxed max-w-xl">
                                            &quot;{v.transcript}&quot;
                                        </p>

                                        {/* Meta */}
                                        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} /> {formatDuration(v.duration_seconds)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} /> {new Date(v.created_at).toLocaleString('fr-FR')}
                                            </span>
                                            {v.client_email && (
                                                <span className="flex items-center gap-1">
                                                    <Mail size={11} /> {v.client_email}
                                                </span>
                                            )}
                                            <span className="bg-white/5 px-2 py-0.5 rounded text-[9px] uppercase">
                                                {v.source === 'support_form' ? 'Formulaire' : 'Chat IA'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {!v.is_read && (
                                        <button
                                            onClick={() => markAsRead(v.id)}
                                            className="text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 rounded-lg transition-all flex items-center gap-1"
                                        >
                                            <CheckCircle2 size={12} /> Marquer lu
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    )
}
