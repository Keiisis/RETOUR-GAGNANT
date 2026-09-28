'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Headphones, MagnifyingGlass as Search, Clock, CheckCircle as CheckCircle2, SpeakerHigh as Volume2, Calendar, Envelope as Mail, User, PhoneCall, WarningCircle as AlertCircle } from '@phosphor-icons/react';

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
    const [erreur, setErreur] = useState<string | null>(null)
    const [marquage, setMarquage] = useState<string | null>(null)

    const fetchVocaux = async () => {
        const { data, error } = await supabase
            .from('voice_messages')
            .select('*')
            .order('created_at', { ascending: false })

        setErreur(error ? `Chargement impossible : ${error.message}` : null)
        setVocaux((data || []) as VoiceMessage[])
        setLoading(false)
    }

    useEffect(() => {
        fetchVocaux()

        // Abonnement Supabase Realtime (WebSocket)
        const channel = supabase
            .channel('realtime_voice')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'voice_messages' },
                (payload) => {
                    const newAudio = payload.new as VoiceMessage
                    setVocaux(prev => [newAudio, ...prev])
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'voice_messages' },
                (payload) => {
                    const updatedAudio = payload.new as VoiceMessage
                    setVocaux(prev => prev.map(v => v.id === updatedAudio.id ? updatedAudio : v))
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // voice_messages ne stocke PAS l'audio (aucune colonne de fichier) : seule la
    // transcription existe. L'ancien bouton « lecture » simulait une écoute
    // (animation minutée sur la durée) sans rien jouer. Il est remplacé par une
    // action réelle : marquer la note comme traitée.
    const markAsRead = async (id: string) => {
        setMarquage(id)
        const { error } = await supabase.from('voice_messages').update({ is_read: true }).eq('id', id)
        setMarquage(null)
        if (error) { alert(`Mise à jour impossible : ${error.message}`); return }
        // Mise à jour locale : ne dépend plus uniquement du temps réel
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
        return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Headphones size={16} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.3em] flex items-center gap-2">
                            Voice-to-Support
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                        </span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Notes Vocales</h1>
                    <p className="text-gray-500 text-sm mt-1">{vocaux.length} note(s) reçue(s) • {vocaux.filter(v => !v.is_read).length} non traitée(s)</p>
                    {erreur && <p className="text-red-400 text-sm font-semibold mt-1">{erreur}</p>}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une transcription..." className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 text-sm w-56" />
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {[{ key: 'all', label: 'Toutes' }, { key: 'unread', label: 'Non traitées' }].map((f) => (
                            <button key={f.key} onClick={() => setFilter(f.key as typeof filter)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${filter === f.key ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-white'}`}>{f.label}</button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatePresence>
                    {filtered.length === 0 ? (
                        <div className="col-span-full bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500 text-sm">
                            <Headphones className="mx-auto mb-3 text-gray-700" size={40} />
                            Aucune note vocale dans cette catégorie
                        </div>
                    ) : (
                        filtered.map((v, i) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.04 }}
                                key={v.id}
                                className={`bg-[#0a0f14] border rounded-2xl p-5 relative overflow-hidden transition-all group hover:border-purple-500/30 shadow-lg ${!v.is_read ? 'border-purple-500/30' : 'border-white/5'}`}
                            >
                                {/* Indicateur nouveau */}
                                {!v.is_read && (
                                    <div className="absolute top-0 right-0">
                                        <div className="w-16 h-16 bg-purple-500/10 blur-xl absolute -top-8 -right-8 animate-pulse rounded-full" />
                                        <div className="bg-purple-500 text-white text-[8px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-lg relative">
                                            Nouveau
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-start gap-4">
                                    {/* Pastille : pas d'audio stocké, seulement la transcription */}
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${!v.is_read ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-400'}`}>
                                        <Volume2 size={22} className="ml-1" />
                                    </div>

                                    <div className="flex-1 mt-1">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            {v.client_nom || 'Client Anonyme'} {v.client_prenom}
                                            <span className="text-xs text-gray-600 font-normal">
                                                • {formatDuration(v.duration_seconds)}
                                            </span>
                                        </h3>

                                        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mt-2">
                                            <span className="flex items-center gap-1 font-medium bg-white/5 px-2 py-1 rounded-md">
                                                <Clock size={10} /> {v.created_at && !isNaN(new Date(v.created_at).getTime()) ? `${new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (${new Date(v.created_at).toLocaleDateString('fr-FR')})` : '-'}
                                            </span>
                                            {v.client_email && (
                                                <span className="flex items-center gap-1 font-medium bg-white/5 px-2 py-1 rounded-md">
                                                    <Mail size={10} /> {v.client_email}
                                                </span>
                                            )}
                                        </div>

                                        {/* Transcription Box */}
                                        <div className="mt-4 bg-white/5 border border-white/5 p-4 rounded-xl relative">
                                            <div className="absolute -top-2.5 left-4 bg-[#0a0f14] px-2 text-[9px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                                                <User size={10} /> Transcription IA
                                            </div>
                                            <p className="text-[13px] leading-relaxed text-gray-300">
                                                "{v.transcript}"
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600 uppercase">
                                        <AlertCircle size={12} /> Source : {v.source === 'support_form' ? 'Assistance Support' : 'Consultant IA'}
                                    </div>
                                    {v.is_read ? (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                            <CheckCircle2 size={12} /> Traité
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => markAsRead(v.id)}
                                            disabled={marquage === v.id}
                                            className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-lg hover:bg-purple-500/20 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={12} /> {marquage === v.id ? 'Enregistrement…' : 'Marquer comme traité'}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
