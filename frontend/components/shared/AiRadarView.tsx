'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, MapPin, Radar, Building2, Phone, Star, ArrowRight,
    ExternalLink, Heart, Download, History, BarChart3, Filter,
    ArrowUpDown, MessageSquare, UserPlus, ChevronDown, X, Check,
    Clock, Sparkles, TrendingUp, Zap, RefreshCw, Copy, Send
} from 'lucide-react'
import Image from 'next/image'

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
interface Lead {
    id?: string
    title: string
    address: string
    phone: string | null
    rating: string | null
    reviews_count: number | null
    description: string
    photo_url: string | null
    relevance_score?: number
    is_favorite?: boolean
    status?: string
    notes?: string
    whatsapp_template?: string
    assigned_agent_id?: string | null
    keyword?: string
    city?: string
    created_at?: string
}

interface SearchRecord {
    id: string
    keyword: string
    city: string
    results_count: number
    created_at: string
}

interface Stats {
    totalLeads: number
    totalFavorites: number
    totalWithPhone: number
    topKeywords: [string, number][]
    topCities: [string, number][]
}

type TabType = 'search' | 'results' | 'history' | 'stats'
type StatusType = 'new' | 'contacted' | 'interested' | 'converted' | 'rejected'

const STATUS_CONFIG: Record<StatusType, { label: string; color: string; bg: string }> = {
    new: { label: 'Nouveau', color: '#3b82f6', bg: 'bg-blue-500/10' },
    contacted: { label: 'Contacté', color: '#f59e0b', bg: 'bg-amber-500/10' },
    interested: { label: 'Intéressé', color: '#8b5cf6', bg: 'bg-purple-500/10' },
    converted: { label: 'Converti', color: '#008751', bg: 'bg-green-600/10' },
    rejected: { label: 'Rejeté', color: '#ef4444', bg: 'bg-red-500/10' },
}

// ═══════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════
export default function AiRadarView() {
    // State principal
    const [activeTab, setActiveTab] = useState<TabType>('search')
    const [keyword, setKeyword] = useState('')
    const [city, setCity] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [leads, setLeads] = useState<Lead[]>([])
    const [error, setError] = useState<string | null>(null)
    const [cachedMsg, setCachedMsg] = useState<string | null>(null)

    // Filtres
    const [showFilters, setShowFilters] = useState(false)
    const [minRating, setMinRating] = useState(0)
    const [requirePhone, setRequirePhone] = useState(false)
    const [onlyFavorites, setOnlyFavorites] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [sortBy, setSortBy] = useState('relevance_score')

    // History & Stats
    const [searchHistory, setSearchHistory] = useState<SearchRecord[]>([])
    const [stats, setStats] = useState<Stats | null>(null)

    // Détails lead
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [noteText, setNoteText] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    // ── Charger historique et stats ──
    const loadHistory = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/radar?action=history')
            const data = await res.json()
            setSearchHistory(data.searches || [])
        } catch { /* silently fail */ }
    }, [])

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch('/api/ai/radar?action=stats')
            const data = await res.json()
            setStats(data)
        } catch { /* silently fail */ }
    }, [])

    useEffect(() => {
        loadHistory()
        loadStats()
    }, [loadHistory, loadStats])

    // ── Lancer le scan ──
    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!keyword || !city) return

        setIsScanning(true)
        setError(null)
        setCachedMsg(null)
        setLeads([])
        setActiveTab('results')

        try {
            const response = await fetch('/api/ai/radar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword, city,
                    filters: { minRating, requirePhone }
                })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Erreur lors du scan')

            setLeads(data.data || [])
            if (data.cached) setCachedMsg(data.message)
            loadHistory()
            loadStats()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        } finally {
            setIsScanning(false)
        }
    }

    // ── Toggle favori ──
    const toggleFavorite = async (lead: Lead) => {
        if (!lead.id) return
        const newVal = !lead.is_favorite
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, is_favorite: newVal } : l))
        await fetch('/api/ai/radar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lead.id, is_favorite: newVal })
        })
    }

    // ── Changer le statut ──
    const changeStatus = async (lead: Lead, status: StatusType) => {
        if (!lead.id) return
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l))
        if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, status })
        await fetch('/api/ai/radar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lead.id, status })
        })
    }

    // ── Sauvegarder une note ──
    const saveNote = async (lead: Lead) => {
        if (!lead.id) return
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notes: noteText } : l))
        if (selectedLead?.id === lead.id) setSelectedLead({ ...selectedLead, notes: noteText })
        await fetch('/api/ai/radar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lead.id, notes: noteText })
        })
    }

    // ── Copier le template WhatsApp ──
    const copyWhatsApp = (lead: Lead) => {
        if (lead.whatsapp_template) {
            navigator.clipboard.writeText(lead.whatsapp_template)
            setCopiedId(lead.id || null)
            setTimeout(() => setCopiedId(null), 2000)
        }
    }

    // ── Export CSV ──
    const handleExport = () => {
        const params = new URLSearchParams({ action: 'export' })
        if (keyword) params.set('keyword', keyword)
        if (city) params.set('city', city)
        window.open(`/api/ai/radar?${params.toString()}`, '_blank')
    }

    // ── Relancer une recherche depuis l'historique ──
    const relaunchSearch = (search: SearchRecord) => {
        setKeyword(search.keyword)
        setCity(search.city)
        setActiveTab('search')
    }

    // ── Filtrage local des résultats ──
    const filteredLeads = leads
        .filter(l => !onlyFavorites || l.is_favorite)
        .filter(l => statusFilter === 'all' || l.status === statusFilter)
        .sort((a, b) => {
            if (sortBy === 'relevance_score') return (b.relevance_score || 0) - (a.relevance_score || 0)
            if (sortBy === 'rating') return parseFloat(b.rating || '0') - parseFloat(a.rating || '0')
            if (sortBy === 'reviews') return (b.reviews_count || 0) - (a.reviews_count || 0)
            if (sortBy === 'name') return (a.title || '').localeCompare(b.title || '')
            return 0
        })

    // ═══════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-6">

            {/* ── HEADER ── */}
            <div className="mb-8 text-center">
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-16 h-16 bg-gradient-to-br from-[#008751]/20 to-[#FCD116]/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[#008751]/20 relative"
                >
                    <Radar className="w-8 h-8 text-[#008751]" />
                </motion.div>
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1">
                    Radar <span className="text-[#008751]">IA</span> Prospect
                </h1>
                <p className="text-gray-500 text-sm max-w-lg mx-auto">
                    Moteur de prospection intelligent avec IA, scoring automatique et gestion CRM intégrée.
                </p>
            </div>

            {/* ── TABS ── */}
            <div className="flex items-center justify-center gap-1 mb-8 bg-gray-100 p-1 rounded-2xl max-w-lg mx-auto">
                {([
                    { id: 'search', icon: Search, label: 'Recherche' },
                    { id: 'results', icon: Radar, label: `Résultats (${leads.length})` },
                    { id: 'history', icon: History, label: 'Historique' },
                    { id: 'stats', icon: BarChart3, label: 'Stats' },
                ] as { id: TabType; icon: typeof Search; label: string }[]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 justify-center ${
                            activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ═══════════════════ TAB: SEARCH ═══════════════════ */}
            {activeTab === 'search' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <form onSubmit={handleScan} className="mb-8">
                        <div className="flex flex-col gap-4 bg-white p-5 rounded-3xl shadow-lg border border-gray-100 max-w-2xl mx-auto">
                            <div className="flex items-center gap-3 px-2">
                                <Search className="w-5 h-5 text-gray-400 shrink-0" />
                                <input
                                    type="text" placeholder="Ex: Hôtel, Coiffeur, Restaurant..."
                                    value={keyword} onChange={e => setKeyword(e.target.value)}
                                    disabled={isScanning}
                                    className="w-full bg-transparent outline-none text-gray-800 font-medium placeholder-gray-400"
                                />
                            </div>
                            <div className="h-px bg-gray-100" />
                            <div className="flex items-center gap-3 px-2">
                                <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
                                <input
                                    type="text" placeholder="Ex: Cotonou, Natitingou..."
                                    value={city} onChange={e => setCity(e.target.value)}
                                    disabled={isScanning}
                                    className="w-full bg-transparent outline-none text-gray-800 font-medium placeholder-gray-400"
                                />
                            </div>

                            {/* Filtres avancés */}
                            <div className="h-px bg-gray-100" />
                            <button type="button" onClick={() => setShowFilters(!showFilters)}
                                className="flex items-center justify-between text-xs font-bold text-gray-500 px-2 hover:text-gray-700 transition-colors">
                                <span className="flex items-center gap-2"><Filter className="w-3.5 h-3.5" /> Filtres avancés</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showFilters && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2 pb-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Note minimum</label>
                                                <select title="Note minimum" value={minRating} onChange={e => setMinRating(Number(e.target.value))}
                                                    className="w-full bg-gray-50 rounded-xl px-3 py-2 text-sm border border-gray-200">
                                                    <option value={0}>Toutes les notes</option>
                                                    <option value={3}>≥ 3 étoiles</option>
                                                    <option value={3.5}>≥ 3.5 étoiles</option>
                                                    <option value={4}>≥ 4 étoiles</option>
                                                    <option value={4.5}>≥ 4.5 étoiles</option>
                                                </select>
                                            </div>
                                            <div className="flex items-end">
                                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 w-full">
                                                    <input type="checkbox" checked={requirePhone} onChange={e => setRequirePhone(e.target.checked)}
                                                        className="w-4 h-4 accent-[#008751]" />
                                                    <span className="text-xs font-medium text-gray-700">Avec tél. uniquement</span>
                                                </label>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button type="submit" disabled={isScanning || !keyword || !city}
                                className="h-12 rounded-2xl bg-[#008751] hover:bg-[#00a664] text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#008751]/20">
                                {isScanning ? (
                                    <span className="flex items-center gap-2">
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                            <Radar className="w-5 h-5" />
                                        </motion.div>
                                        Scan IA en cours...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Zap className="w-4 h-4" /> Lancer le Radar <ArrowRight className="w-4 h-4" />
                                    </span>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Animation de scan */}
                    {isScanning && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="relative w-28 h-28 flex items-center justify-center mb-4">
                                <div className="absolute inset-0 bg-[#008751]/10 rounded-full animate-ping" />
                                <div className="absolute inset-4 bg-[#FCD116]/10 rounded-full animate-ping" />
                                <Image src="/logo.jpg" alt="RGB" width={50} height={50} className="rounded-full shadow-lg relative z-10 animate-pulse" />
                            </div>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">
                                Extraction & Scoring par Llama-3...
                            </p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* ═══════════════════ TAB: RESULTS ═══════════════════ */}
            {activeTab === 'results' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    {/* Barre de contrôle */}
                    {leads.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                            {/* Tri */}
                            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 px-2 py-1.5">
                                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                                <select title="Trier par" value={sortBy} onChange={e => setSortBy(e.target.value)}
                                    className="text-xs font-medium bg-transparent outline-none text-gray-700">
                                    <option value="relevance_score">Score IA</option>
                                    <option value="rating">Note Google</option>
                                    <option value="reviews">Nb. avis</option>
                                    <option value="name">Nom A-Z</option>
                                </select>
                            </div>

                            {/* Statut */}
                            <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 px-2 py-1.5">
                                <select title="Filtrer par statut" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                    className="text-xs font-medium bg-transparent outline-none text-gray-700">
                                    <option value="all">Tous statuts</option>
                                    {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                        <option key={key} value={key}>{val.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Favoris */}
                            <button onClick={() => setOnlyFavorites(!onlyFavorites)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                    onlyFavorites ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-500'
                                }`}>
                                <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} /> Favoris
                            </button>

                            {/* Export */}
                            <button onClick={handleExport}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#008751]/10 border border-[#008751]/20 text-[#008751] text-xs font-bold ml-auto">
                                <Download className="w-3.5 h-3.5" /> Export CSV
                            </button>
                        </div>
                    )}

                    {/* Message cache */}
                    {cachedMsg && (
                        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 p-3 rounded-xl text-xs font-medium mb-4 border border-blue-100">
                            <Clock className="w-4 h-4 shrink-0" /> {cachedMsg}
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center text-sm font-medium mb-6">
                            {error}
                        </div>
                    )}

                    {/* Grille de résultats */}
                    {filteredLeads.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {filteredLeads.map((lead, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={lead.id || idx}
                                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all group flex flex-col relative"
                                >
                                    {/* Score badge */}
                                    {lead.relevance_score !== undefined && lead.relevance_score > 0 && (
                                        <div className={`absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg text-[10px] font-black text-white shadow-lg ${
                                            lead.relevance_score >= 80 ? 'bg-[#008751]' :
                                            lead.relevance_score >= 60 ? 'bg-[#FCD116] text-gray-900' :
                                            lead.relevance_score >= 40 ? 'bg-orange-500' : 'bg-gray-500'
                                        }`}>
                                            <Sparkles className="w-3 h-3 inline mr-1" />{lead.relevance_score}/100
                                        </div>
                                    )}

                                    {/* Favori */}
                                    <button onClick={() => toggleFavorite(lead)}
                                        className="absolute top-3 left-3 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                                        <Heart className={`w-4 h-4 ${lead.is_favorite ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
                                    </button>

                                    {/* Image */}
                                    <div className="relative h-40 bg-gray-100 overflow-hidden">
                                        {lead.photo_url ? (
                                            <Image src={lead.photo_url} alt={lead.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
                                                <Building2 className="w-10 h-10 text-gray-300" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3">
                                            <h3 className="text-white font-extrabold text-sm leading-tight truncate">{lead.title}</h3>
                                            {lead.rating && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Star className="w-3 h-3 text-[#FCD116] fill-current" />
                                                    <span className="text-white font-bold text-xs">{lead.rating}</span>
                                                    <span className="text-white/60 text-[10px]">({lead.reviews_count} avis)</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4 flex-1 flex flex-col gap-3">
                                        {/* Status selector */}
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                                <button key={key} onClick={() => changeStatus(lead, key as StatusType)}
                                                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all border ${
                                                        lead.status === key
                                                            ? `${val.bg} border-current`
                                                            : 'bg-gray-50 border-gray-100 text-gray-400 hover:text-gray-600'
                                                    }`}
                                                    style={lead.status === key ? { color: val.color, borderColor: val.color + '40' } : {}}
                                                >
                                                    {val.label}
                                                </button>
                                            ))}
                                        </div>

                                        <p className="text-gray-600 text-xs italic line-clamp-2 flex-1">&ldquo;{lead.description}&rdquo;</p>

                                        <div className="flex items-start gap-2 bg-gray-50 p-2.5 rounded-xl">
                                            <MapPin className="w-3.5 h-3.5 text-[#E8112D] shrink-0 mt-0.5" />
                                            <p className="text-[10px] font-semibold text-gray-700 leading-snug">{lead.address}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            {lead.phone ? (
                                                <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}${lead.whatsapp_template ? `?text=${encodeURIComponent(lead.whatsapp_template)}` : ''}`} target="_blank" rel="noopener noreferrer"
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-[#008751]/10 hover:bg-[#008751]/20 p-2.5 rounded-xl transition-colors">
                                                    <Phone className="w-3.5 h-3.5 text-[#008751]" />
                                                    <span className="text-[10px] font-bold text-[#008751]">{lead.phone}</span>
                                                    <ExternalLink className="w-3 h-3 text-[#008751] opacity-60" />
                                                </a>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 p-2.5 rounded-xl opacity-50">
                                                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-[10px] text-gray-500">Aucun tél.</span>
                                                </div>
                                            )}

                                            {/* WhatsApp template copy */}
                                            {lead.whatsapp_template && (
                                                <button onClick={() => copyWhatsApp(lead)}
                                                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#FCD116]/10 hover:bg-[#FCD116]/20 transition-colors border border-[#FCD116]/20">
                                                    {copiedId === lead.id ? <Check className="w-3.5 h-3.5 text-[#008751]" /> : <Copy className="w-3.5 h-3.5 text-[#FCD116]" />}
                                                </button>
                                            )}

                                            {/* Détails */}
                                            <button onClick={() => { setSelectedLead(lead); setNoteText(lead.notes || '') }}
                                                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                                                <MessageSquare className="w-3.5 h-3.5 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        !isScanning && !error && (
                            <div className="text-center text-gray-400 py-16">
                                <Radar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Lancez une recherche pour voir les résultats ici.</p>
                            </div>
                        )
                    )}
                </motion.div>
            )}

            {/* ═══════════════════ TAB: HISTORY ═══════════════════ */}
            {activeTab === 'history' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-gray-900">Historique des recherches</h2>
                        <button onClick={loadHistory} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                    {searchHistory.length > 0 ? (
                        <div className="space-y-2">
                            {searchHistory.map(search => (
                                <div key={search.id}
                                    className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#008751]/10 flex items-center justify-center">
                                            <Search className="w-5 h-5 text-[#008751]" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">
                                                {search.keyword} <span className="text-gray-400">à</span> {search.city}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                                {new Date(search.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                {' · '}{search.results_count} résultats
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => relaunchSearch(search)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-[#008751]/10 text-gray-600 hover:text-[#008751] text-xs font-bold transition-all">
                                        <RefreshCw className="w-3.5 h-3.5" /> Relancer
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-16">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucune recherche enregistrée.</p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* ═══════════════════ TAB: STATS ═══════════════════ */}
            {activeTab === 'stats' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-gray-900">Tableau de bord</h2>
                        <button onClick={loadStats} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                            <RefreshCw className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    {stats ? (
                        <div className="space-y-6">
                            {/* KPIs */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Total Leads', value: stats.totalLeads, icon: Building2, color: '#008751' },
                                    { label: 'Favoris', value: stats.totalFavorites, icon: Heart, color: '#ef4444' },
                                    { label: 'Avec Téléphone', value: stats.totalWithPhone, icon: Phone, color: '#3b82f6' },
                                ].map(kpi => (
                                    <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
                                        <kpi.icon className="w-6 h-6 mx-auto mb-2 opacity-60" style={{ color: kpi.color }} />
                                        <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">{kpi.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Top Keywords & Cities */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <TrendingUp className="w-4 h-4 text-[#008751]" />
                                        <p className="text-xs font-black text-gray-900 uppercase tracking-wider">Top Mots-clés</p>
                                    </div>
                                    {stats.topKeywords.length > 0 ? stats.topKeywords.map(([kw, count], i) => (
                                        <div key={kw} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400 w-5">{i + 1}.</span>
                                                <span className="text-sm font-bold text-gray-800 capitalize">{kw}</span>
                                            </div>
                                            <span className="text-xs font-black text-[#008751] bg-[#008751]/10 px-2 py-0.5 rounded-md">{count}</span>
                                        </div>
                                    )) : <p className="text-xs text-gray-400">Aucune donnée</p>}
                                </div>

                                <div className="bg-white rounded-2xl p-5 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <MapPin className="w-4 h-4 text-[#E8112D]" />
                                        <p className="text-xs font-black text-gray-900 uppercase tracking-wider">Top Villes</p>
                                    </div>
                                    {stats.topCities.length > 0 ? stats.topCities.map(([ct, count], i) => (
                                        <div key={ct} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-gray-400 w-5">{i + 1}.</span>
                                                <span className="text-sm font-bold text-gray-800 capitalize">{ct}</span>
                                            </div>
                                            <span className="text-xs font-black text-[#E8112D] bg-[#E8112D]/10 px-2 py-0.5 rounded-md">{count}</span>
                                        </div>
                                    )) : <p className="text-xs text-gray-400">Aucune donnée</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-16">
                            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Chargement des statistiques...</p>
                        </div>
                    )}
                </motion.div>
            )}

            {/* ═══════════════════ MODAL: DÉTAILS LEAD ═══════════════════ */}
            <AnimatePresence>
                {selectedLead && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setSelectedLead(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-gray-900">{selectedLead.title}</h3>
                                    <button onClick={() => setSelectedLead(null)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Details extra grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mot clé / Secteur</p>
                                        <p className="text-sm font-semibold text-gray-900 capitalize w-full truncate">{selectedLead.keyword || 'Inconnu'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Localité</p>
                                        <p className="text-sm font-semibold text-gray-900 capitalize w-full truncate">{selectedLead.city || 'Inconnu'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Avis Google</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Star className="w-4 h-4 text-[#FCD116] fill-current" />
                                            <span className="text-sm font-bold text-gray-900">{selectedLead.rating || 'N/A'}</span>
                                            <span className="text-[10px] text-gray-500">({selectedLead.reviews_count || 0} avis)</span>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-xl">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Statut CRM</p>
                                        {selectedLead.status && STATUS_CONFIG[selectedLead.status as StatusType] && (
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold inline-block"
                                                style={{
                                                    color: STATUS_CONFIG[selectedLead.status as StatusType].color,
                                                    backgroundColor: STATUS_CONFIG[selectedLead.status as StatusType].color + '20'
                                                }}>
                                                {STATUS_CONFIG[selectedLead.status as StatusType].label}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Score */}
                                {selectedLead.relevance_score !== undefined && (
                                    <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="w-5 h-5 text-[#008751]" />
                                            <div>
                                                <p className="text-xs font-bold text-gray-500">Score de pertinence IA</p>
                                                <p className="text-xl font-black text-gray-900">{selectedLead.relevance_score}/100</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-[10px] text-gray-400 font-medium">Création</p>
                                            <p className="text-xs text-gray-600 font-semibold">
                                                {selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleDateString('fr-FR') : 'Date inconnue'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-3 mb-4">
                                    <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-xl">
                                        <MapPin className="w-4 h-4 text-[#E8112D] shrink-0 mt-0.5" />
                                        <div className="flex flex-col">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Adresse</p>
                                            <p className="text-sm font-medium text-gray-800 leading-snug">{selectedLead.address}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 bg-gray-50 p-3 rounded-xl">
                                        <Building2 className="w-4 h-4 text-[#008751] shrink-0 mt-0.5" />
                                        <div className="flex flex-col">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Description Marketing</p>
                                            <p className="text-sm font-medium text-gray-800 leading-snug">{selectedLead.description}</p>
                                        </div>
                                    </div>
                                    {selectedLead.phone && (
                                        <a href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}${selectedLead.whatsapp_template ? `?text=${encodeURIComponent(selectedLead.whatsapp_template)}` : ''}`} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-2 bg-[#008751]/10 p-3 rounded-xl hover:bg-[#008751]/20 transition-colors">
                                            <Phone className="w-4 h-4 text-[#008751]" />
                                            <span className="text-sm font-bold text-[#008751]">{selectedLead.phone}</span>
                                            <ExternalLink className="w-3 h-3 text-[#008751] ml-auto" />
                                        </a>
                                    )}
                                </div>

                                {/* Template WhatsApp */}
                                {selectedLead.whatsapp_template && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Send className="w-3 h-3" /> Message WhatsApp pré-rédigé
                                        </p>
                                        <div className="bg-[#dcf8c6] border border-[#bce5a1] rounded-xl p-3 text-xs text-gray-800 leading-relaxed whitespace-pre-line">
                                            {selectedLead.whatsapp_template}
                                        </div>
                                        <button onClick={() => copyWhatsApp(selectedLead)}
                                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#008751]/10 text-[#008751] text-xs font-bold hover:bg-[#008751]/20 transition-colors">
                                            {copiedId === selectedLead.id ? <><Check className="w-3.5 h-3.5" /> Copié !</> : <><Copy className="w-3.5 h-3.5" /> Copier le message</>}
                                        </button>
                                    </div>
                                )}

                                {/* Notes */}
                                <div className="mb-4">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" /> Notes personnelles
                                    </p>
                                    <textarea
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        placeholder="Ajouter des notes sur ce prospect..."
                                        rows={3}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#008751]/40 transition-colors resize-none"
                                    />
                                    <button onClick={() => saveNote(selectedLead)}
                                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#008751] text-white text-xs font-bold hover:bg-[#00a664] transition-colors">
                                        <Check className="w-3.5 h-3.5" /> Sauvegarder
                                    </button>
                                </div>

                                {/* Attribution agent */}
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                        <UserPlus className="w-3 h-3" /> Attribution
                                    </p>
                                    <p className="text-xs text-gray-400 italic">
                                        {selectedLead.assigned_agent_id ? `Assigné à l'agent ${selectedLead.assigned_agent_id}` : 'Non assigné — fonctionnalité CRM avancée'}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
