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
    const [playingId, setPlayingId] = useState<string | null>(null)

    const fetchVocaux = async () => {
        const { data } = await supabase
            .from('voice_messages')
            .select('*')
            .order('created_at', { ascending: false })

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

    // Simule la lecture audio visuellement (Puisque l'audio n'est pas encore stocké réellement via Blob, 
    // l'interface permet d'utiliser la transcription fournie par l'IA)
    const togglePlay = (id: string, is_read: boolean) => {
        if (!is_read) markAsRead(id)
        if (playingId === id) setPlayingId(null)
        else setPlayingId(id)

        // Stop auto après "durée"
        if (playingId !== id) {
            const vocal = vocaux.find(v => v.id === id)
            if (vocal) {
                setTimeout(() => {
                    setPlayingId(current => current === id ? null : current)
                }, vocal.duration_seconds * 1000)
            }
        }
    }

    const markAsRead = async (id: string) => {
        await supabase.from('voice_messages').update({ is_read: true }).eq('id', id)
        // La maj locale est gérée par le Realtime UPDATE
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
                    <p className="text-gray-500 text-sm mt-1">{vocaux.length} audios reçus • {vocaux.filter(v => !v.is_read).length} non écoutés</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une transcription..." className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 text-sm w-56" />
                    </div>
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                        {[{ key: 'all', label: 'Toutes' }, { key: 'unread', label: 'Non Écoutées' }].map((f) => (
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
                                    {/* Play Button Avatar */}
                                    <button
                                        onClick={() => togglePlay(v.id, v.is_read)}
                                        className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-all z-10 ${playingId === v.id ? 'bg-purple-500 text-white scale-110 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : !v.is_read ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        {playingId === v.id ? (
                                            <div className="flex gap-1 items-center">
                                                <span className="w-1 h-3 bg-white rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1 h-5 bg-white rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '200ms' }} />
                                                <span className="w-1 h-3 bg-white rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: '400ms' }} />
                                            </div>
                                        ) : (
                                            <Volume2 size={22} className="ml-1" />
                                        )}
                                    </button>

                                    <div className="flex-1 mt-1">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            {v.client_nom || 'Client Anonyme'} {v.client_prenom}
                                            <span className="text-xs text-gray-600 font-normal">
                                                • {formatDuration(v.duration_seconds)}
                                            </span>
                                        </h3>

                                        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mt-2">
                                            <span className="flex items-center gap-1 font-medium bg-white/5 px-2 py-1 rounded-md">
                                                <Clock size={10} /> {v.created_at && !isNaN(new Date(v.created_at).getTime()) ? `${new Date(v.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (${new Date(v.created_at).toLocaleDateString('fr-FR')})` : '—'}
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
                                    {v.is_read && (
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                            <CheckCircle2 size={12} /> Traité
                                        </div>
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
