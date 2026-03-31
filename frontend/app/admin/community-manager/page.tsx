'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Megaphone, Eye, Palette, Zap, Star, StarOff, Copy, Check,
    Plus, Trash2, Search, ExternalLink, Save,
    Globe, Loader2, ChevronRight,
    TrendingUp, MessageCircle, ThumbsUp, Share2, BookOpen,
    AlertTriangle, Sparkles, Target, ArrowRight,
    Brain, Download, Calendar, FileJson, BarChart2,
    Trophy, Lightbulb, Swords, Clock, Hash, Film,
    Shield, Users, Flame, Gauge
} from 'lucide-react'
// Toutes les opérations DB passent par les API routes (service role, bypass RLS)

// ── Types ────────────────────────────────────────────────
interface SocialProfile {
    id: string
    platform: string
    username: string
    display_name?: string
    profile_url: string
    notes?: string
    last_analyzed_at?: string
    created_at: string
}

interface ScrapedPost {
    text: string
    likes: number
    comments: number
    shares: number
    date: string
    url: string
}

interface SearchPost {
    title: string
    url: string
    snippet: string
    date: string
    platform: string
    engagement_estimate: string
}

interface ContentItem {
    id: string
    platform: string
    text: string
    hashtags: string[]
    style_inspiration?: string
    viral_score: number
    is_favorite: boolean
    created_at: string
}

interface StyleAnalysis {
    // Legacy flat fields (backward compat)
    tone: string
    vocabulary_level: string
    typical_structure: string
    hooks: string[]
    hashtag_strategy: string
    emoji_usage: string
    avg_post_length: string
    engagement_triggers: string[]
    writing_patterns: string[]
    improvement_tips: string[]
    viral_formula: string
    best_content_types: string[]
    call_to_action_style: string
    // Deep Style DNA v3
    voice_fingerprint?: {
        signature_phrases: string[]
        transition_words: string[]
        rhythm: string
        sentence_avg_words: number
        punctuation_style: string
        opening_patterns: string[]
        closing_patterns: string[]
    }
    hooks_masterclass?: Array<{
        hook: string
        technique: string
        power_score: number
        why_it_works: string
    }>
    content_blueprint?: {
        structure_template: string
        ideal_length_words: number
        hashtag_count: number
        hashtag_placement: string
        emoji_density: string
        emoji_favorites: string[]
        visual_pairing: string
        cta_formulas: string[]
        posting_frequency: string
        best_days: string[]
    }
    scores?: {
        hook_power: number
        emotional_depth: number
        storytelling: number
        authority: number
        humor: number
        urgency: number
        community_building: number
        viral_potential: number
        overall: number
    }
    emotional_map?: {
        dominant_emotions: Array<{ emotion: string; frequency: number; example: string }>
        emotional_arc: string
        pain_points_addressed: string[]
        desires_activated: string[]
        emotional_density_score: number
    }
    audience_persona?: {
        age_range: string
        gender_lean: string
        socio_economic: string
        pain_points: string[]
        language_register: string
        platform_behavior: string
    }
    competitive_edge?: {
        unique_differentiator: string
        content_gaps: string[]
        vulnerability: string
        copy_this: string[]
        avoid_this: string[]
    }
    claude_instructions?: {
        system_prompt: string
        do_list: string[]
        dont_list: string[]
        example_rewrites: Array<{ before: string; after: string }>
    }
}

interface IntelligenceDossier {
    meta: { version: string; generated_at: string; tool: string; posts_analyzed: number; scrape_method: string; platform: string; profile_url: string; username: string }
    profile: { platform: string; username: string; profile_url: string; notes: string }
    style: { tone: string; vocabulary_level: string; structure: string; hooks: string[]; hashtag_strategy: string; emoji_usage: string; avg_post_length: string; engagement_triggers: string[]; writing_patterns: string[]; improvement_tips: string[]; viral_formula: string; best_content_types: string[]; cta_style: string; top_topics: string[]; content_mix: string }
    style_dna?: StyleAnalysis
    top_posts: Array<{ rank: number; text: string; likes: number; comments: number; shares: number; stars?: number; views?: number; viral_score: number; date: string; url: string }>
    stats: { avg_likes: number; avg_comments: number; avg_shares: number; best_viral_score: number; engagement_level: string; total_posts_scraped: number; posts_with_engagement: number }
    patterns: { best_times: string[]; top_hooks: string[]; top_topics: string[]; content_mix: string }
    competitive: { strengths: string[]; weaknesses: string[]; opportunities: string[] }
    claude_prompt: string
}

interface CalendarDay {
    day: number
    date: string
    weekday: string
    topic: string
    content_type: string
    posting_time: string
    hook: string
    hashtags: string[]
    brief: string
    tone: string
    visual_idea: string
}

interface GeneratedVariant {
    id: number
    text: string
    hashtags: string[]
    best_time: string
    viral_tips: string[]
    emoji_suggestions: string[]
    style_label: string
    estimated_engagement: string
}

// ── Helpers ───────────────────────────────────────────────
const PLATFORM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; placeholder?: string }> = {
    facebook:    { label: 'Facebook',     color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',   icon: '📘', placeholder: 'https://www.facebook.com/nomDeLaPage' },
    instagram:   { label: 'Instagram',    color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/20',   icon: '📸', placeholder: 'https://www.instagram.com/username' },
    tiktok:      { label: 'TikTok',       color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',   icon: '🎵', placeholder: 'https://www.tiktok.com/@username' },
    twitter:     { label: 'X / Twitter',  color: 'text-gray-300',   bg: 'bg-gray-500/10 border-gray-500/20',   icon: '🐦', placeholder: 'https://twitter.com/username' },
    google_maps: { label: 'Google Maps',  color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', icon: '📍', placeholder: 'https://maps.google.com/?cid=... ou nom du lieu' },
    linkedin:    { label: 'LinkedIn',     color: 'text-blue-300',   bg: 'bg-blue-400/10 border-blue-400/20',   icon: '💼', placeholder: 'https://www.linkedin.com/company/nom' },
}

const ENGAGEMENT_COLOR: Record<string, string> = {
    viral: 'text-yellow-400 bg-yellow-500/10',
    élevé: 'text-emerald-400 bg-emerald-500/10',
    moyen: 'text-orange-400 bg-orange-500/10',
    faible: 'text-gray-400 bg-gray-500/10',
    inconnu: 'text-gray-500 bg-gray-500/5',
}

function PlatformBadge({ platform }: { platform: string }) {
    const cfg = PLATFORM_CONFIG[platform] || { label: platform, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', icon: '🌐' }
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
            {cfg.icon} {cfg.label}
        </span>
    )
}

// ── Tabs ─────────────────────────────────────────────────
const TABS = [
    { id: 'veille', label: 'Veille', icon: Eye },
    { id: 'style', label: 'Analyse Style', icon: Palette },
    { id: 'viral', label: 'Posts Viraux', icon: TrendingUp },
    { id: 'generation', label: 'Génération', icon: Zap },
    { id: 'calendrier', label: 'Calendrier', icon: Calendar },
]

// ═════════════════════════════════════════════════════════
export default function CommunityManagerPage() {
    const [activeTab, setActiveTab] = useState('veille')
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [activeDossier, setActiveDossier] = useState<IntelligenceDossier | null>(null)

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* ── Header ── */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
                    <Megaphone size={22} className="text-purple-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">Mon Community Manager Pro</h1>
                    <p className="text-purple-400 text-xs font-bold tracking-widest uppercase">Machine à Contenus Viraux • Intelligence Marketing IA</p>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-2xl p-1">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                isActive
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            <Icon size={14} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'veille' && <VeilleTab onDossierReady={setActiveDossier} activeDossier={activeDossier} copyToClipboard={copyToClipboard} copiedId={copiedId} />}
                    {activeTab === 'style' && <StyleTab copyToClipboard={copyToClipboard} copiedId={copiedId} />}
                    {activeTab === 'viral' && <ViralTab copyToClipboard={copyToClipboard} copiedId={copiedId} setActiveTab={setActiveTab} />}
                    {activeTab === 'generation' && <GenerationTab copyToClipboard={copyToClipboard} copiedId={copiedId} activeDossier={activeDossier} />}
                    {activeTab === 'calendrier' && <CalendarTab activeDossier={activeDossier} copyToClipboard={copyToClipboard} copiedId={copiedId} />}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// TAB 1 — VEILLE CONCURRENTIELLE
// ═════════════════════════════════════════════════════════
function VeilleTab({
    onDossierReady,
    activeDossier,
    copyToClipboard,
    copiedId,
}: {
    onDossierReady: (d: IntelligenceDossier) => void
    activeDossier: IntelligenceDossier | null
    copyToClipboard: (text: string, id: string) => void
    copiedId: string | null
}) {
    const [profiles, setProfiles] = useState<SocialProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [scraping, setScraping] = useState<string | null>(null)
    const [buildingDossier, setBuildingDossier] = useState<string | null>(null)
    const [dossierProfileId, setDossierProfileId] = useState<string | null>(null)
    const [scrapedData, setScrapedData] = useState<{ profileId: string; posts: ScrapedPost[]; method: string; apifyError?: string } | null>(null)

    const [form, setForm] = useState({ platform: 'facebook', profile_url: '', username: '', notes: '' })
    const [error, setError] = useState<string | null>(null)

    useEffect(() => { fetchProfiles() }, [])

    const fetchProfiles = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/community-manager/profiles')
            const data = await res.json()
            setProfiles(Array.isArray(data) ? data : [])
        } catch {
            setProfiles([])
        }
        setLoading(false)
    }

    const addProfile = async () => {
        if (!form.profile_url.trim() || !form.username.trim()) {
            setError('URL du profil et nom d\'utilisateur sont obligatoires.')
            return
        }
        // Validation URL (Google Maps accepte aussi un nom de lieu comme "Cosmetique Cotonou")
        const isGoogleMaps = form.platform === 'google_maps'
        if (!isGoogleMaps) {
            try {
                const parsed = new URL(form.profile_url.trim())
                if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Protocole invalide')
            } catch {
                setError(`URL invalide. Exemple : ${PLATFORM_CONFIG[form.platform]?.placeholder || 'https://...'}`)
                return
            }
        }
        setAdding(true)
        setError(null)
        try {
            const res = await fetch('/api/community-manager/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setForm({ platform: 'facebook', profile_url: '', username: '', notes: '' })
            await fetchProfiles()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'ajout')
        }
        setAdding(false)
    }

    const analyzeProfile = async (profile: SocialProfile) => {
        setScraping(profile.id)
        setScrapedData(null)
        try {
            const res = await fetch('/api/community-manager/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile_url: profile.profile_url, platform: profile.platform }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Mettre à jour last_analyzed_at via API route (service role)
            await fetch('/api/community-manager/profiles', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: profile.id, last_analyzed_at: new Date().toISOString() }),
            })

            setScrapedData({ profileId: profile.id, posts: data.posts, method: data.method, apifyError: data.apify_error })
            await fetchProfiles()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse')
        }
        setScraping(null)
    }

    const deleteProfile = async (id: string) => {
        try {
            const res = await fetch(`/api/community-manager/profiles?id=${id}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setError(data.error || 'Erreur lors de la suppression')
                return
            }
            await fetchProfiles()
            if (scrapedData?.profileId === id) setScrapedData(null)
            if (dossierProfileId === id) setDossierProfileId(null)
        } catch {
            setError('Impossible de supprimer le profil. Vérifiez votre connexion.')
        }
    }

    const buildFullDossier = async (profile: SocialProfile) => {
        setBuildingDossier(profile.id)
        setError(null)
        try {
            const res = await fetch('/api/community-manager/analyze-full', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile_id: profile.id,
                    profile_url: profile.profile_url,
                    platform: profile.platform,
                    username: profile.username,
                    notes: profile.notes,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            onDossierReady(data.dossier)
            setDossierProfileId(profile.id)
            await fetchProfiles()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la construction du dossier')
        }
        setBuildingDossier(null)
    }

    const downloadDossierJSON = () => {
        if (!activeDossier) return
        const blob = new Blob([JSON.stringify(activeDossier, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dossier_${activeDossier.profile.username}_${activeDossier.meta.platform}_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            {/* Formulaire ajout */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Plus size={16} className="text-purple-400" /> Ajouter un profil à surveiller</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Plateforme</label>
                        <select
                            value={form.platform}
                            onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                        >
                            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Nom d&apos;utilisateur</label>
                        <input
                            type="text"
                            placeholder="ex: retourgagnantbenin"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">URL du profil</label>
                        <input
                            type="url"
                            placeholder={PLATFORM_CONFIG[form.platform]?.placeholder || 'https://...'}
                            value={form.profile_url}
                            onChange={e => setForm(f => ({ ...f, profile_url: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Notes (optionnel)</label>
                        <input
                            type="text"
                            placeholder="Concurrent local en trading, Bénin"
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                    </div>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}
                <button
                    type="button"
                    onClick={addProfile}
                    disabled={adding}
                    className="mt-4 bg-purple-500 hover:bg-purple-400 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    Ajouter le profil
                </button>
            </div>

            {/* Liste des profils */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Eye size={16} className="text-purple-400" /> Profils surveillés ({profiles.length})</h2>
                {loading ? (
                    <div className="h-24 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-purple-400" /></div>
                ) : profiles.length === 0 ? (
                    <div className="h-24 flex flex-col items-center justify-center gap-2 text-gray-600">
                        <Globe size={24} />
                        <p className="text-sm">Aucun profil ajouté. Commencez par ajouter un concurrent.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {profiles.map(profile => (
                            <div key={profile.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <PlatformBadge platform={profile.platform} />
                                        <span className="text-white font-bold text-sm">@{profile.username}</span>
                                    </div>
                                    {profile.notes && <p className="text-gray-500 text-xs">{profile.notes}</p>}
                                    {profile.last_analyzed_at && (
                                        <p className="text-gray-600 text-[10px] mt-1">
                                            Dernière analyse : {new Date(profile.last_analyzed_at).toLocaleString('fr-FR')}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <a href={profile.profile_url} target="_blank" rel="noopener noreferrer" title="Voir le profil" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                        <ExternalLink size={14} />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => analyzeProfile(profile)}
                                        disabled={scraping === profile.id || buildingDossier === profile.id}
                                        title="Scraper les posts"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {scraping === profile.id ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                                        {scraping === profile.id ? 'Scraping...' : 'Posts'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => buildFullDossier(profile)}
                                        disabled={buildingDossier === profile.id || scraping === profile.id}
                                        title="Construire le Dossier Intelligence IA complet"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {buildingDossier === profile.id ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                                        {buildingDossier === profile.id ? 'Analyse IA...' : 'Dossier IA'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteProfile(profile.id)}
                                        title="Supprimer"
                                        className="p-2 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-red-500/50 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Résultats du scraping */}
            {scrapedData && scrapedData.posts.length > 0 && (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-400" />
                            Publications récupérées ({scrapedData.posts.length})
                        </h2>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                                via {scrapedData.method === 'apify' ? '🤖 Apify' : '🔍 Serper (fallback)'}
                            </span>
                            {scrapedData.apifyError && (
                                <span className="text-[10px] text-orange-400/60 max-w-xs text-right" title={scrapedData.apifyError}>
                                    ⚠ Apify: {scrapedData.apifyError.substring(0, 60)}...
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {scrapedData.posts.map((post, idx) => (
                            <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{post.text || post.url}</p>
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                                    {post.likes > 0 && <span className="flex items-center gap-1"><ThumbsUp size={10} /> {post.likes.toLocaleString()}</span>}
                                    {post.comments > 0 && <span className="flex items-center gap-1"><MessageCircle size={10} /> {post.comments.toLocaleString()}</span>}
                                    {post.shares > 0 && <span className="flex items-center gap-1"><Share2 size={10} /> {post.shares.toLocaleString()}</span>}
                                    {post.date && <span>{new Date(post.date).toLocaleDateString('fr-FR')}</span>}
                                    {post.url && (
                                        <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                                            <ExternalLink size={10} /> Voir
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Dossier Intelligence IA ─────────────────── */}
            {activeDossier && dossierProfileId && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Header dossier */}
                    <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Brain size={18} className="text-emerald-400" />
                                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Dossier Intelligence IA</span>
                                </div>
                                <h3 className="text-white font-black text-lg">@{activeDossier.profile.username}</h3>
                                <p className="text-gray-400 text-xs mt-0.5">
                                    {activeDossier.meta.posts_analyzed} posts analysés · {activeDossier.meta.scrape_method} · {new Date(activeDossier.meta.generated_at).toLocaleString('fr-FR')}
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button type="button" onClick={downloadDossierJSON}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all">
                                    <Download size={13} /> Télécharger JSON
                                </button>
                                <button type="button"
                                    onClick={() => copyToClipboard(activeDossier.claude_prompt, 'claude-prompt')}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all">
                                    {copiedId === 'claude-prompt' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                    {copiedId === 'claude-prompt' ? 'Copié !' : 'Copier prompt Claude.ai'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats engagement */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Moy. Likes', value: activeDossier.stats.avg_likes.toLocaleString(), color: 'text-blue-400', icon: '👍' },
                            { label: 'Moy. Commentaires', value: activeDossier.stats.avg_comments.toLocaleString(), color: 'text-yellow-400', icon: '💬' },
                            { label: 'Moy. Partages', value: activeDossier.stats.avg_shares.toLocaleString(), color: 'text-pink-400', icon: '🔁' },
                            { label: 'Engagement', value: activeDossier.stats.engagement_level, color: activeDossier.stats.engagement_level === 'viral' ? 'text-yellow-400' : activeDossier.stats.engagement_level === 'élevé' ? 'text-emerald-400' : 'text-orange-400', icon: '📊' },
                        ].map(s => (
                            <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1">{s.icon} {s.label}</p>
                                <p className={`font-black text-base ${s.color}`}>{s.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Formule virale + style */}
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
                        <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-2">✨ Formule Virale Détectée</p>
                        <p className="text-white font-bold text-base">{activeDossier.style.viral_formula || 'Non détectée'}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            {[
                                { label: 'Ton', value: activeDossier.style.tone },
                                { label: 'Structure', value: activeDossier.style.structure },
                                { label: 'Longueur', value: activeDossier.style.avg_post_length },
                                { label: 'CTA', value: activeDossier.style.cta_style },
                            ].map(m => (
                                <div key={m.label} className="bg-white/[0.03] rounded-lg p-3">
                                    <p className="text-gray-600 text-[10px] font-bold mb-1">{m.label}</p>
                                    <p className="text-gray-300 text-xs">{m.value || '—'}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top posts */}
                    {activeDossier.top_posts.length > 0 && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
                            <p className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Trophy size={14} className="text-yellow-400" /> Top Posts (classés par score viral)</p>
                            <div className="space-y-3">
                                {activeDossier.top_posts.slice(0, 5).map((post) => (
                                    <div key={post.rank} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${post.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' : post.rank === 2 ? 'bg-gray-400/20 text-gray-300' : 'bg-orange-500/20 text-orange-400'}`}>
                                            {post.rank}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-gray-300 text-xs line-clamp-2">{post.text || post.url}</p>
                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-600">
                                                {post.stars !== undefined && post.stars > 0 && <span className="text-yellow-400">{'⭐'.repeat(Math.round(post.stars))} {post.stars}/5</span>}
                                                {post.likes > 0 && <span>👍 {post.likes.toLocaleString()}</span>}
                                                {post.comments > 0 && <span>💬 {post.comments.toLocaleString()}</span>}
                                                {post.shares > 0 && <span>🔁 {post.shares.toLocaleString()}</span>}
                                                {(post.views ?? 0) > 0 && <span>👁 {(post.views ?? 0).toLocaleString()}</span>}
                                                <span className="text-emerald-400 font-bold">Score: {post.viral_score}/100</span>
                                                {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300"><ExternalLink size={10} /></a>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Deep Style DNA (v3) — Radar + Scores */}
                    {activeDossier.style_dna?.scores && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-purple-400 text-xs font-bold flex items-center gap-2"><BarChart2 size={12} /> Deep Style DNA</p>
                                {activeDossier.style_dna.scores && <ScoreBadge score={activeDossier.style_dna.scores.overall} />}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center justify-center">
                                    <RadarChart scores={activeDossier.style_dna.scores} />
                                </div>
                                <div className="flex flex-col justify-center gap-2">
                                    <ScoreBar label="Accroche" value={activeDossier.style_dna.scores.hook_power} color="bg-yellow-500" />
                                    <ScoreBar label="Émotion" value={activeDossier.style_dna.scores.emotional_depth} color="bg-red-500" />
                                    <ScoreBar label="Narration" value={activeDossier.style_dna.scores.storytelling} color="bg-pink-500" />
                                    <ScoreBar label="Autorité" value={activeDossier.style_dna.scores.authority} color="bg-blue-500" />
                                    <ScoreBar label="Viralité" value={activeDossier.style_dna.scores.viral_potential} color="bg-orange-500" />
                                    <ScoreBar label="Communauté" value={activeDossier.style_dna.scores.community_building} color="bg-emerald-500" />
                                    <ScoreBar label="Urgence" value={activeDossier.style_dna.scores.urgency} color="bg-cyan-500" />
                                    <ScoreBar label="Humour" value={activeDossier.style_dna.scores.humor} color="bg-violet-500" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hooks Masterclass (v3) */}
                    {activeDossier.style_dna?.hooks_masterclass && activeDossier.style_dna.hooks_masterclass.length > 0 && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <p className="text-yellow-400 text-xs font-bold mb-3 flex items-center gap-2">🎣 Hooks Masterclass</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activeDossier.style_dna.hooks_masterclass.map((h, i) => (
                                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-white font-bold text-xs flex-1">&ldquo;{h.hook}&rdquo;</p>
                                            <span className={`text-[10px] font-black flex-shrink-0 ${h.power_score >= 80 ? 'text-emerald-400' : h.power_score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>{h.power_score}</span>
                                        </div>
                                        <p className="text-gray-500 text-[10px] mt-1">{h.technique} — {h.why_it_works}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Audience Persona + Emotional Map (v3) */}
                    {(activeDossier.style_dna?.audience_persona || activeDossier.style_dna?.emotional_map) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeDossier.style_dna?.audience_persona && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                    <p className="text-pink-400 text-xs font-bold mb-3 flex items-center gap-2"><Users size={12} /> Persona Audience</p>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between"><span className="text-gray-500">Âge</span><span className="text-gray-300">{activeDossier.style_dna.audience_persona.age_range}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Socio-éco</span><span className="text-gray-300">{activeDossier.style_dna.audience_persona.socio_economic}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-500">Comportement</span><span className="text-gray-300">{activeDossier.style_dna.audience_persona.platform_behavior}</span></div>
                                        {activeDossier.style_dna.audience_persona.pain_points.length > 0 && (
                                            <div className="pt-2 border-t border-white/5">
                                                <p className="text-gray-600 text-[10px] font-bold mb-1">Pain points :</p>
                                                {activeDossier.style_dna.audience_persona.pain_points.map((p, i) => <p key={i} className="text-gray-400 text-[10px] ml-2">• {p}</p>)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {activeDossier.style_dna?.emotional_map && (
                                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                    <p className="text-red-400 text-xs font-bold mb-3 flex items-center gap-2"><Flame size={12} /> Carte Émotionnelle</p>
                                    <p className="text-gray-600 text-[10px] font-bold mb-2">Arc : <span className="text-red-300">{activeDossier.style_dna.emotional_map.emotional_arc}</span></p>
                                    {activeDossier.style_dna.emotional_map.dominant_emotions.map((e, i) => (
                                        <div key={i} className="flex items-center gap-2 mb-1.5">
                                            <span className="text-gray-300 text-[10px] w-20 text-right">{e.emotion}</span>
                                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.round(e.frequency * 100)}%` }} />
                                            </div>
                                            <span className="text-gray-500 text-[10px] w-8">{Math.round(e.frequency * 100)}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Analyse compétitive */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                            <p className="text-emerald-400 text-xs font-bold mb-3 flex items-center gap-1.5"><Trophy size={12} /> Forces</p>
                            <ul className="space-y-1.5">{activeDossier.competitive.strengths.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><ChevronRight size={10} className="text-emerald-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                            <p className="text-red-400 text-xs font-bold mb-3 flex items-center gap-1.5"><Swords size={12} /> Faiblesses à exploiter</p>
                            <ul className="space-y-1.5">{activeDossier.competitive.weaknesses.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><ChevronRight size={10} className="text-red-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                            <p className="text-blue-400 text-xs font-bold mb-3 flex items-center gap-1.5"><Lightbulb size={12} /> Opportunités</p>
                            <ul className="space-y-1.5">{activeDossier.competitive.opportunities.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><ChevronRight size={10} className="text-blue-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                        </div>
                    </div>

                    {/* Claude Instructions (v3) — Before/After */}
                    {activeDossier.style_dna?.claude_instructions && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <p className="text-purple-400 text-xs font-bold mb-4 flex items-center gap-2"><Brain size={12} /> Instructions Claude.ai — DO / DON&apos;T</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                <div className="bg-emerald-500/5 rounded-xl p-3">
                                    <p className="text-emerald-400 text-[10px] font-bold mb-2">DO</p>
                                    <ul className="space-y-1">{activeDossier.style_dna.claude_instructions.do_list.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><Check size={10} className="text-emerald-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                </div>
                                <div className="bg-red-500/5 rounded-xl p-3">
                                    <p className="text-red-400 text-[10px] font-bold mb-2">DON&apos;T</p>
                                    <ul className="space-y-1">{activeDossier.style_dna.claude_instructions.dont_list.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><AlertTriangle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                </div>
                            </div>
                            {activeDossier.style_dna.claude_instructions.example_rewrites.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Avant → Après</p>
                                    {activeDossier.style_dna.claude_instructions.example_rewrites.map((rw, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                                                <p className="text-red-400 text-[10px] font-bold mb-1">AVANT</p>
                                                <p className="text-gray-400 text-xs italic">{rw.before}</p>
                                            </div>
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
                                                <p className="text-emerald-400 text-[10px] font-bold mb-1">APRES</p>
                                                <p className="text-gray-200 text-xs font-medium">{rw.after}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Prompt Claude.ai préview */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-white font-bold text-sm flex items-center gap-2"><FileJson size={14} className="text-purple-400" /> Prompt prêt pour Claude.ai / ChatGPT</p>
                            <button type="button" onClick={() => copyToClipboard(activeDossier.claude_prompt, 'claude-prompt-2')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold transition-all">
                                {copiedId === 'claude-prompt-2' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                Copier
                            </button>
                        </div>
                        <pre className="text-gray-500 text-[11px] font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap bg-black/20 rounded-lg p-3 border border-white/5">
                            {activeDossier.claude_prompt.slice(0, 1000)}...
                        </pre>
                        <p className="text-gray-600 text-[10px] mt-2">💡 Copiez ce prompt dans Claude.ai, ChatGPT ou Gemini avec le JSON pour générer du contenu optimisé qui surpasse ce concurrent.</p>
                    </div>
                </motion.div>
            )}

            {/* Notice Apify */}
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-xs text-yellow-400/70 flex items-start gap-2">
                <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-bold text-yellow-400">Conseil :</span> Pour des données d&apos;engagement précises (likes, commentaires), configurez une clé Apify dans <code className="bg-white/5 px-1 rounded">Supabase → settings → apify_api_key</code>. Sans clé, le système utilise Google Search (données textuelles seulement).
                </div>
            </div>
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// TAB 2 — ANALYSE DE STYLE
// ═════════════════════════════════════════════════════════
function StyleTab({ copyToClipboard, copiedId }: { copyToClipboard: (t: string, id: string) => void; copiedId: string | null }) {
    const [samples, setSamples] = useState('')
    const [platform, setPlatform] = useState('facebook')
    const [profileUrl, setProfileUrl] = useState('')
    const [analyzing, setAnalyzing] = useState(false)
    const [analysis, setAnalysis] = useState<StyleAnalysis | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [styleInspiration, setStyleInspiration] = useState<string | null>(null)
    const [styleSaved, setStyleSaved] = useState(false)

    const analyze = async () => {
        if (samples.trim().length < 50) {
            setError('Veuillez coller au moins 50 caractères de publications à analyser.')
            return
        }
        setAnalyzing(true)
        setError(null)
        setAnalysis(null)
        try {
            const res = await fetch('/api/community-manager/analyze-style', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ samples, platform, profile_url: profileUrl }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setAnalysis(data.analysis)
            setStyleInspiration(data.analysis?.viral_formula || null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse')
        }
        setAnalyzing(false)
    }

    const saveStyleInspiration = () => {
        if (styleInspiration) {
            sessionStorage.setItem('cm_style_inspiration', styleInspiration)
            setStyleSaved(true)
            setTimeout(() => setStyleSaved(false), 2500)
        }
    }

    return (
        <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Palette size={16} className="text-purple-400" /> Analyser un style d&apos;écriture</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Plateforme</label>
                        <select
                            value={platform}
                            onChange={e => setPlatform(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                        >
                            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">URL du profil (optionnel)</label>
                        <input
                            type="url"
                            placeholder="https://www.facebook.com/..."
                            value={profileUrl}
                            onChange={e => setProfileUrl(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-500 font-bold mb-1.5 block">Publications à analyser (copiez-collez 5 à 10 posts)</label>
                    <textarea
                        value={samples}
                        onChange={e => setSamples(e.target.value)}
                        rows={8}
                        placeholder="Collez ici plusieurs publications du profil que vous souhaitez analyser...&#10;&#10;Exemple :&#10;---&#10;Publication 1&#10;---&#10;Publication 2&#10;---"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600 resize-none"
                    />
                    <p className="text-gray-600 text-xs mt-1">{samples.length} caractères — {samples.length < 50 ? `encore ${50 - samples.length} min` : '✓ prêt à analyser'}</p>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}
                <button
                    type="button"
                    onClick={analyze}
                    disabled={analyzing || samples.trim().length < 50}
                    className="mt-4 bg-purple-500 hover:bg-purple-400 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {analyzing ? 'Analyse IA en cours...' : 'Analyser le Style IA'}
                </button>
            </div>

            {/* Résultat analyse */}
            {analysis && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Score global + Formule virale */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1">
                                <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-3">Deep Style DNA</p>
                                {analysis.scores && <ScoreBadge score={analysis.scores.overall} />}
                                {analysis.viral_formula && (
                                    <p className="text-white font-bold text-base mt-3 leading-relaxed">{analysis.viral_formula}</p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button type="button"
                                    onClick={() => copyToClipboard(JSON.stringify(analysis, null, 2), 'style-json')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-all">
                                    {copiedId === 'style-json' ? <Check size={12} className="text-emerald-400" /> : <FileJson size={12} />}
                                    JSON
                                </button>
                                <button type="button" onClick={saveStyleInspiration}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all">
                                    {styleSaved ? <Check size={12} className="text-emerald-400" /> : <ArrowRight size={12} />}
                                    {styleSaved ? 'Sauvegardé !' : 'Utiliser pour générer'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Radar Chart + Scores */}
                    {analysis.scores && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex items-center justify-center">
                                <RadarChart scores={analysis.scores} />
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex flex-col justify-center gap-2">
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Scores par axe</p>
                                <ScoreBar label="Accroche" value={analysis.scores.hook_power} color="bg-yellow-500" />
                                <ScoreBar label="Émotion" value={analysis.scores.emotional_depth} color="bg-red-500" />
                                <ScoreBar label="Narration" value={analysis.scores.storytelling} color="bg-pink-500" />
                                <ScoreBar label="Autorité" value={analysis.scores.authority} color="bg-blue-500" />
                                <ScoreBar label="Viralité" value={analysis.scores.viral_potential} color="bg-orange-500" />
                                <ScoreBar label="Communauté" value={analysis.scores.community_building} color="bg-emerald-500" />
                                <ScoreBar label="Urgence" value={analysis.scores.urgency} color="bg-cyan-500" />
                                <ScoreBar label="Humour" value={analysis.scores.humor} color="bg-violet-500" />
                            </div>
                        </div>
                    )}

                    {/* Métriques rapides */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Ton', value: analysis.tone, color: 'text-pink-400' },
                            { label: 'Vocabulaire', value: analysis.vocabulary_level, color: 'text-blue-400' },
                            { label: 'Longueur', value: analysis.avg_post_length, color: 'text-yellow-400' },
                            { label: 'CTA Style', value: analysis.call_to_action_style, color: 'text-emerald-400' },
                        ].map(metric => (
                            <div key={metric.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1">{metric.label}</p>
                                <p className={`font-bold text-sm ${metric.color}`}>{metric.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Hooks Masterclass */}
                    {analysis.hooks_masterclass && analysis.hooks_masterclass.length > 0 && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <p className="text-yellow-400 text-xs font-bold mb-4 flex items-center gap-2">🎣 Hooks Masterclass — Accroches décortiquées</p>
                            <div className="space-y-3">
                                {analysis.hooks_masterclass.map((h, i) => (
                                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <p className="text-white font-bold text-sm">&ldquo;{h.hook}&rdquo;</p>
                                                <p className="text-gray-500 text-xs mt-1">{h.why_it_works}</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className={`text-xs font-black ${h.power_score >= 80 ? 'text-emerald-400' : h.power_score >= 60 ? 'text-yellow-400' : 'text-gray-400'}`}>
                                                    {h.power_score}/100
                                                </span>
                                                <span className="text-[10px] text-purple-400/70 bg-purple-500/10 px-2 py-0.5 rounded-full">{h.technique}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Voice Fingerprint */}
                    {analysis.voice_fingerprint && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <p className="text-cyan-400 text-xs font-bold mb-4 flex items-center gap-2"><Sparkles size={12} /> Empreinte Vocale</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-gray-600 text-[10px] font-bold mb-2">Rythme : <span className="text-cyan-300">{analysis.voice_fingerprint.rhythm}</span></p>
                                    <p className="text-gray-600 text-[10px] font-bold mb-2">Moy. mots/phrase : <span className="text-cyan-300">{analysis.voice_fingerprint.sentence_avg_words}</span></p>
                                    <p className="text-gray-600 text-[10px] font-bold mb-2">Ponctuation : <span className="text-cyan-300">{analysis.voice_fingerprint.punctuation_style}</span></p>
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[10px] font-bold mb-1.5">Phrases signatures :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {analysis.voice_fingerprint.signature_phrases.map((p, i) => (
                                            <span key={i} className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/10">&ldquo;{p}&rdquo;</span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[10px] font-bold mb-1.5">Patterns d&apos;ouverture :</p>
                                    <ul className="space-y-1">{analysis.voice_fingerprint.opening_patterns.map((p, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><ChevronRight size={10} className="text-cyan-400 flex-shrink-0 mt-0.5" />{p}</li>)}</ul>
                                </div>
                                <div>
                                    <p className="text-gray-600 text-[10px] font-bold mb-1.5">Patterns de clôture :</p>
                                    <ul className="space-y-1">{analysis.voice_fingerprint.closing_patterns.map((p, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><ChevronRight size={10} className="text-cyan-400 flex-shrink-0 mt-0.5" />{p}</li>)}</ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Audience Persona + Emotional Map */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysis.audience_persona && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                <p className="text-pink-400 text-xs font-bold mb-3 flex items-center gap-2"><Users size={12} /> Persona Audience</p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between"><span className="text-gray-500">Âge</span><span className="text-gray-300 font-bold">{analysis.audience_persona.age_range}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Genre</span><span className="text-gray-300 font-bold">{analysis.audience_persona.gender_lean}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Socio-éco</span><span className="text-gray-300 font-bold">{analysis.audience_persona.socio_economic}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Registre</span><span className="text-gray-300 font-bold">{analysis.audience_persona.language_register}</span></div>
                                    {analysis.audience_persona.pain_points.length > 0 && (
                                        <div className="pt-2 border-t border-white/5">
                                            <p className="text-gray-600 text-[10px] font-bold mb-1.5">Points de douleur :</p>
                                            <ul className="space-y-1">{analysis.audience_persona.pain_points.map((p, i) => <li key={i} className="text-gray-400 flex items-start gap-1.5"><ChevronRight size={10} className="text-pink-400 flex-shrink-0 mt-0.5" />{p}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {analysis.emotional_map && (
                            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                                <p className="text-red-400 text-xs font-bold mb-3 flex items-center gap-2"><Flame size={12} /> Carte Émotionnelle</p>
                                <p className="text-gray-600 text-[10px] font-bold mb-2">Arc émotionnel : <span className="text-red-300">{analysis.emotional_map.emotional_arc}</span></p>
                                {analysis.emotional_map.dominant_emotions.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {analysis.emotional_map.dominant_emotions.map((e, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full bg-red-500/60" style={{ width: `${Math.round(e.frequency * 100)}%` }} />
                                                </div>
                                                <span className="text-gray-300 text-[10px] font-bold w-24 text-right">{e.emotion}</span>
                                                <span className="text-gray-500 text-[10px] w-8">{Math.round(e.frequency * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {analysis.emotional_map.desires_activated.length > 0 && (
                                    <div className="pt-2 border-t border-white/5">
                                        <p className="text-gray-600 text-[10px] font-bold mb-1.5">Désirs activés :</p>
                                        <div className="flex flex-wrap gap-1">{analysis.emotional_map.desires_activated.map((d, i) => <span key={i} className="text-[10px] bg-red-500/10 text-red-300 px-2 py-0.5 rounded-full">{d}</span>)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Competitive Edge */}
                    {analysis.competitive_edge && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <p className="text-emerald-400 text-xs font-bold mb-4 flex items-center gap-2"><Shield size={12} /> Avantage Compétitif</p>
                            {analysis.competitive_edge.unique_differentiator && (
                                <p className="text-white font-bold text-sm mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">{analysis.competitive_edge.unique_differentiator}</p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {analysis.competitive_edge.copy_this.length > 0 && (
                                    <div className="bg-emerald-500/5 rounded-xl p-3">
                                        <p className="text-emerald-400 text-[10px] font-bold mb-2">A copier</p>
                                        <ul className="space-y-1">{analysis.competitive_edge.copy_this.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><Check size={10} className="text-emerald-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                    </div>
                                )}
                                {analysis.competitive_edge.avoid_this.length > 0 && (
                                    <div className="bg-red-500/5 rounded-xl p-3">
                                        <p className="text-red-400 text-[10px] font-bold mb-2">A éviter</p>
                                        <ul className="space-y-1">{analysis.competitive_edge.avoid_this.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><AlertTriangle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                    </div>
                                )}
                                {analysis.competitive_edge.content_gaps.length > 0 && (
                                    <div className="bg-blue-500/5 rounded-xl p-3">
                                        <p className="text-blue-400 text-[10px] font-bold mb-2">Opportunités</p>
                                        <ul className="space-y-1">{analysis.competitive_edge.content_gaps.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><Lightbulb size={10} className="text-blue-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Claude Instructions — Before/After */}
                    {analysis.claude_instructions && (
                        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-purple-400 text-xs font-bold flex items-center gap-2"><Brain size={12} /> Instructions Claude.ai</p>
                                <button type="button"
                                    onClick={() => copyToClipboard(analysis.claude_instructions?.system_prompt || '', 'claude-sys')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold transition-all">
                                    {copiedId === 'claude-sys' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                    Copier System Prompt
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                <div className="bg-emerald-500/5 rounded-xl p-3">
                                    <p className="text-emerald-400 text-[10px] font-bold mb-2">DO — A faire</p>
                                    <ul className="space-y-1">{analysis.claude_instructions.do_list.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><Check size={10} className="text-emerald-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                </div>
                                <div className="bg-red-500/5 rounded-xl p-3">
                                    <p className="text-red-400 text-[10px] font-bold mb-2">DON&apos;T — A éviter</p>
                                    <ul className="space-y-1">{analysis.claude_instructions.dont_list.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1.5"><AlertTriangle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />{s}</li>)}</ul>
                                </div>
                            </div>
                            {analysis.claude_instructions.example_rewrites.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Exemples Avant → Après</p>
                                    {analysis.claude_instructions.example_rewrites.map((rw, i) => (
                                        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                                                <p className="text-red-400 text-[10px] font-bold mb-1">AVANT</p>
                                                <p className="text-gray-400 text-xs italic">{rw.before}</p>
                                            </div>
                                            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                                                <p className="text-emerald-400 text-[10px] font-bold mb-1">APRES</p>
                                                <p className="text-gray-200 text-xs font-medium">{rw.after}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content Blueprint */}
                    {analysis.content_blueprint && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                <p className="text-gray-500 text-xs font-bold mb-2">📐 Structure type</p>
                                <p className="text-gray-300 text-sm">{analysis.content_blueprint.structure_template}</p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{analysis.content_blueprint.ideal_length_words} mots</span>
                                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">{analysis.content_blueprint.hashtag_count} hashtags ({analysis.content_blueprint.hashtag_placement})</span>
                                    <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-0.5 rounded-full">Emojis: {analysis.content_blueprint.emoji_density}</span>
                                </div>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                                <p className="text-gray-500 text-xs font-bold mb-2">📅 Planning</p>
                                {analysis.content_blueprint.posting_frequency && <p className="text-gray-300 text-xs mb-2">Fréquence : {analysis.content_blueprint.posting_frequency}</p>}
                                {analysis.content_blueprint.best_days.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-2">{analysis.content_blueprint.best_days.map((d, i) => <span key={i} className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full">{d}</span>)}</div>
                                )}
                                {analysis.content_blueprint.cta_formulas.length > 0 && (
                                    <>
                                        <p className="text-gray-600 text-[10px] font-bold mt-3 mb-1">Formules CTA :</p>
                                        <ul className="space-y-1">{analysis.content_blueprint.cta_formulas.map((c, i) => <li key={i} className="text-gray-300 text-xs">{c}</li>)}</ul>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// TAB 5 — CALENDRIER ÉDITORIAL IA
// ═════════════════════════════════════════════════════════
const CONTENT_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
    post: { icon: '📝', color: 'text-gray-300' },
    reel: { icon: '🎬', color: 'text-pink-400' },
    story: { icon: '⭕', color: 'text-orange-400' },
    carrousel: { icon: '🎠', color: 'text-blue-400' },
    live: { icon: '🔴', color: 'text-red-400' },
    sondage: { icon: '📊', color: 'text-cyan-400' },
}

function CalendarTab({
    activeDossier,
    copyToClipboard,
    copiedId,
}: {
    activeDossier: IntelligenceDossier | null
    copyToClipboard: (text: string, id: string) => void
    copiedId: string | null
}) {
    const [form, setForm] = useState({
        platform: 'facebook',
        topics: '',
        frequency: '3x_semaine',
        tone: 'varié',
        language: 'fr',
        start_date: new Date().toISOString().split('T')[0],
        use_dossier: !!activeDossier,
    })
    const [generating, setGenerating] = useState(false)
    const [calendar, setCalendar] = useState<CalendarDay[]>([])
    const [error, setError] = useState<string | null>(null)
    const [expandedDay, setExpandedDay] = useState<number | null>(null)

    const generate = async () => {
        setGenerating(true)
        setError(null)
        setCalendar([])
        try {
            const payload: Record<string, unknown> = {
                platform: form.platform,
                topics: form.topics.split(/[\n,]+/).map(t => t.trim()).filter(Boolean),
                frequency: form.frequency,
                tone: form.tone,
                language: form.language,
                start_date: form.start_date,
            }
            if (form.use_dossier && activeDossier) {
                payload.style_context = activeDossier
            }
            const res = await fetch('/api/community-manager/calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCalendar(data.calendar || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de génération')
        }
        setGenerating(false)
    }

    const exportCSV = () => {
        const esc = (s: unknown) => '"' + String(s ?? '').replace(/"/g, '""') + '"'
        const headers = ['Jour', 'Date', 'Jour de la semaine', 'Sujet', 'Format', 'Heure', 'Accroche', 'Brief', 'Hashtags', 'Idée visuelle']
        const rows = calendar.map(d => [
            d.day, d.date, d.weekday, esc(d.topic), d.content_type, d.posting_time,
            esc(d.hook), esc(d.brief), esc(d.hashtags.join(' ')), esc(d.visual_idea)
        ])
        const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `calendrier_editorial_${form.platform}_${form.start_date}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const exportText = () => {
        const text = calendar.map(d =>
            `=== Jour ${d.day} — ${d.date} (${d.weekday}) ===\n📌 ${d.topic}\n🎬 Format: ${d.content_type} | 🕐 ${d.posting_time}\n💬 Accroche: ${d.hook}\n📋 Brief: ${d.brief}\n🏷 Hashtags: ${d.hashtags.join(' ')}\n🖼 Visuel: ${d.visual_idea}\n`
        ).join('\n')
        copyToClipboard(text, 'calendar-text')
    }

    const toneColor: Record<string, string> = {
        inspirant: 'text-purple-400',
        informatif: 'text-blue-400',
        urgent: 'text-red-400',
        humoristique: 'text-yellow-400',
        storytelling: 'text-pink-400',
        autoritaire: 'text-emerald-400',
    }

    return (
        <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-cyan-400" /> Générer un Calendrier Éditorial 30 Jours IA
                </h2>

                {activeDossier && (
                    <div className="mb-4 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between">
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <Brain size={12} /> Dossier concurrent @{activeDossier.profile.username} disponible
                        </span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, use_dossier: !f.use_dossier }))}
                            className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${form.use_dossier ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                            {form.use_dossier ? '✓ Utilisé comme inspiration' : 'Activer'}
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Plateforme</label>
                        <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Fréquence</label>
                        <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                            <option value="daily">📅 Quotidien (30 posts)</option>
                            <option value="3x_semaine">📅 3x/semaine (~13 posts)</option>
                            <option value="hebdo">📅 Hebdomadaire (~5 posts)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Date de début</label>
                        <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Ton général</label>
                        <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                            <option value="varié">🎭 Varié (recommandé)</option>
                            <option value="inspirant">💫 Inspirant</option>
                            <option value="informatif">📚 Informatif</option>
                            <option value="urgent">⚡ Urgence</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Langue</label>
                        <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50">
                            <option value="fr">🇫🇷 Français</option>
                            <option value="fon">🇧🇯 Fon</option>
                            <option value="en">🇬🇧 Anglais</option>
                        </select>
                    </div>
                    <div className="md:col-span-1">
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Sujets prioritaires (optionnel, un par ligne)</label>
                        <textarea placeholder={'trading Bénin\nliberté financière\ntémoignages clients'}
                            value={form.topics} onChange={e => setForm(f => ({ ...f, topics: e.target.value }))}
                            rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500/50 placeholder:text-gray-600 resize-none"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}

                <button type="button" onClick={generate} disabled={generating}
                    className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all disabled:opacity-50">
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <Calendar size={15} />}
                    {generating ? 'Génération IA en cours...' : 'Générer le Calendrier 30 Jours'}
                </button>
            </div>

            {/* Résultat calendrier */}
            {calendar.length > 0 && (
                <div className="space-y-4">
                    {/* Header + exports */}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p className="text-white font-bold flex items-center gap-2">
                            <Calendar size={16} className="text-cyan-400" />
                            {calendar.length} publications planifiées
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={exportCSV}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all">
                                <Download size={13} /> Exporter CSV
                            </button>
                            <button type="button" onClick={exportText}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-bold transition-all">
                                {copiedId === 'calendar-text' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                Copier tout
                            </button>
                        </div>
                    </div>

                    {/* Grille calendrier */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {calendar.map(day => {
                            const typeCfg = CONTENT_TYPE_CONFIG[day.content_type] || { icon: '📝', color: 'text-gray-300' }
                            const isExpanded = expandedDay === day.day
                            return (
                                <motion.div key={day.day}
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: day.day * 0.02 }}
                                    className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all cursor-pointer"
                                    onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                                >
                                    {/* En-tête jour */}
                                    <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-white font-black text-sm">J{day.day}</span>
                                            <span className="text-gray-500 text-xs">{day.date}</span>
                                            <span className="text-gray-600 text-[10px]">{day.weekday}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs ${typeCfg.color}`}>{typeCfg.icon} {day.content_type}</span>
                                            <span className="text-gray-600 text-[10px] flex items-center gap-0.5"><Clock size={9} /> {day.posting_time}</span>
                                        </div>
                                    </div>

                                    {/* Contenu */}
                                    <div className="p-4">
                                        <p className="text-white font-bold text-xs mb-2 line-clamp-2">{day.topic}</p>
                                        <p className="text-yellow-300/80 text-[11px] italic mb-2 line-clamp-1">&ldquo;{day.hook}&rdquo;</p>

                                        {isExpanded && (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 mt-3 pt-3 border-t border-white/5">
                                                <p className="text-gray-400 text-xs leading-relaxed">{day.brief}</p>
                                                {day.visual_idea && (
                                                    <p className="text-gray-500 text-[11px] flex items-start gap-1.5">
                                                        <Film size={10} className="flex-shrink-0 mt-0.5 text-pink-400" /> {day.visual_idea}
                                                    </p>
                                                )}
                                                <div className="flex flex-wrap gap-1 pt-1">
                                                    {day.hashtags.slice(0, 5).map((tag, i) => (
                                                        <span key={i} className="text-[10px] bg-purple-500/10 text-purple-300 px-1.5 py-0.5 rounded-full">
                                                            {tag.startsWith('#') ? tag : `#${tag}`}
                                                        </span>
                                                    ))}
                                                </div>
                                                <button type="button"
                                                    onClick={e => { e.stopPropagation(); copyToClipboard(`${day.topic}\n\n${day.hook}\n\n${day.brief}\n\n${day.hashtags.join(' ')}`, `cal-${day.day}`) }}
                                                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition-all mt-1">
                                                    {copiedId === `cal-${day.day}` ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                                                    Copier ce jour
                                                </button>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Badge ton */}
                                    <div className="px-4 pb-3">
                                        <span className={`text-[10px] font-bold ${toneColor[day.tone] || 'text-gray-500'}`}>
                                            ● {day.tone}
                                        </span>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// COMPOSANTS DEEP STYLE DNA
// ═════════════════════════════════════════════════════════
const RADAR_AXES = [
    { key: 'hook_power', label: 'Accroche', icon: '🎣' },
    { key: 'emotional_depth', label: 'Émotion', icon: '❤️' },
    { key: 'storytelling', label: 'Narration', icon: '📖' },
    { key: 'authority', label: 'Autorité', icon: '👑' },
    { key: 'viral_potential', label: 'Viralité', icon: '🔥' },
    { key: 'community_building', label: 'Communauté', icon: '👥' },
    { key: 'urgency', label: 'Urgence', icon: '⚡' },
    { key: 'humor', label: 'Humour', icon: '😄' },
] as const

function RadarChart({ scores, size = 220 }: { scores: Record<string, number>; size?: number }) {
    const cx = size / 2
    const cy = size / 2
    const r = size * 0.38
    const n = RADAR_AXES.length

    const getPoint = (index: number, value: number) => {
        const angle = (Math.PI * 2 * index) / n - Math.PI / 2
        const dist = (value / 100) * r
        return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) }
    }

    const gridLevels = [25, 50, 75, 100]

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[240px] mx-auto">
            {/* Grille */}
            {gridLevels.map(level => {
                const points = Array.from({ length: n }, (_, i) => {
                    const p = getPoint(i, level)
                    return `${p.x},${p.y}`
                }).join(' ')
                return <polygon key={level} points={points} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            })}
            {/* Axes */}
            {RADAR_AXES.map((_, i) => {
                const p = getPoint(i, 100)
                return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            })}
            {/* Zone de données */}
            <polygon
                points={RADAR_AXES.map((axis, i) => {
                    const p = getPoint(i, scores[axis.key] || 0)
                    return `${p.x},${p.y}`
                }).join(' ')}
                fill="rgba(168,85,247,0.15)"
                stroke="rgba(168,85,247,0.6)"
                strokeWidth="1.5"
            />
            {/* Points */}
            {RADAR_AXES.map((axis, i) => {
                const p = getPoint(i, scores[axis.key] || 0)
                return <circle key={axis.key} cx={p.x} cy={p.y} r="3" fill="rgba(168,85,247,0.9)" stroke="rgba(168,85,247,0.4)" strokeWidth="1" />
            })}
            {/* Labels */}
            {RADAR_AXES.map((axis, i) => {
                const p = getPoint(i, 118)
                return (
                    <text key={axis.key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" className="fill-gray-500 text-[7px] font-bold">
                        {axis.icon} {axis.label}
                    </text>
                )
            })}
        </svg>
    )
}

function ScoreBar({ label, value, color = 'bg-purple-500' }: { label: string; value: number; color?: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-gray-500 text-[10px] font-bold w-20 text-right">{label}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
            <span className="text-gray-400 text-[10px] font-mono w-8">{value}</span>
        </div>
    )
}

function ScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? 'from-emerald-500 to-green-400 text-emerald-950' :
        score >= 60 ? 'from-purple-500 to-violet-400 text-purple-950' :
        score >= 40 ? 'from-yellow-500 to-orange-400 text-yellow-950' :
        'from-red-500 to-rose-400 text-red-950'
    const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : 'Faible'

    return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${color} font-black text-sm`}>
            <Gauge size={16} />
            <span>{score}/100</span>
            <span className="text-[10px] font-bold opacity-80">{label}</span>
        </div>
    )
}

function AnalysisCard({ title, items, color, icon }: { title: string; items: string[]; color: string; icon: string }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${color}`}>
                <span>{icon}</span> {title}
            </p>
            <ul className="space-y-1.5">
                {(items || []).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <ChevronRight size={12} className={`flex-shrink-0 mt-0.5 ${color}`} />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// TAB 3 — PUBLICATIONS VIRALES
// ═════════════════════════════════════════════════════════
function ViralTab({
    copyToClipboard, copiedId, setActiveTab
}: {
    copyToClipboard: (t: string, id: string) => void
    copiedId: string | null
    setActiveTab: (t: string) => void
}) {
    const [keywords, setKeywords] = useState('')
    const [platform, setPlatform] = useState('all')
    const [profileUrl, setProfileUrl] = useState('')
    const [searching, setSearching] = useState(false)
    const [posts, setPosts] = useState<SearchPost[]>([])
    const [error, setError] = useState<string | null>(null)
    const [profiles, setProfiles] = useState<SocialProfile[]>([])

    useEffect(() => {
        fetch('/api/community-manager/profiles').then(r => r.json()).then(data => setProfiles(Array.isArray(data) ? data : []))
    }, [])

    const searchPosts = async () => {
        if (!keywords.trim() && !profileUrl.trim()) {
            setError('Entrez des mots-clés ou sélectionnez un profil.')
            return
        }
        setSearching(true)
        setError(null)
        setPosts([])
        try {
            const res = await fetch('/api/community-manager/search-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, platform, profile_url: profileUrl, num: 15 }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPosts(data.posts || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de recherche')
        }
        setSearching(false)
    }

    const reproduceFormat = (post: SearchPost) => {
        sessionStorage.setItem('cm_reproduce_topic', post.title || post.snippet)
        sessionStorage.setItem('cm_reproduce_platform', post.platform)
        setActiveTab('generation')
    }

    return (
        <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-purple-400" /> Rechercher des publications virales</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Plateforme</label>
                        <select
                            value={platform}
                            onChange={e => setPlatform(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                        >
                            <option value="all">🌐 Toutes</option>
                            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Profil surveillé (optionnel)</label>
                        <select
                            value={profileUrl}
                            onChange={e => setProfileUrl(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                        >
                            <option value="">— Aucun profil —</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.profile_url}>@{p.username} ({p.platform})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Mots-clés</label>
                        <input
                            type="text"
                            placeholder="trading Bénin investissement..."
                            value={keywords}
                            onChange={e => setKeywords(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && searchPosts()}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
                        />
                    </div>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}
                <button
                    type="button"
                    onClick={searchPosts}
                    disabled={searching}
                    className="mt-4 bg-purple-500 hover:bg-purple-400 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                    {searching ? 'Recherche en cours...' : 'Rechercher les top posts'}
                </button>
            </div>

            {/* Résultats */}
            {posts.length > 0 && (
                <div className="space-y-3">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{posts.length} publications trouvées</p>
                    {posts.map((post, idx) => (
                        <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <PlatformBadge platform={post.platform} />
                                        {post.engagement_estimate !== 'inconnu' && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ENGAGEMENT_COLOR[post.engagement_estimate] || ''}`}>
                                                {post.engagement_estimate === 'viral' ? '🔥' : post.engagement_estimate === 'élevé' ? '📈' : '📊'} {post.engagement_estimate}
                                            </span>
                                        )}
                                        {post.date && <span className="text-[10px] text-gray-600">{post.date}</span>}
                                    </div>
                                    {post.title && <p className="text-white font-bold text-sm mb-1 line-clamp-1">{post.title}</p>}
                                    <p className="text-gray-400 text-sm line-clamp-2">{post.snippet}</p>
                                </div>
                                <div className="flex flex-col gap-2 flex-shrink-0">
                                    <a href={post.url} target="_blank" rel="noopener noreferrer" title="Voir la publication" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                        <ExternalLink size={14} />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(post.snippet, `post-${idx}`)}
                                        title="Copier"
                                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                    >
                                        {copiedId === `post-${idx}` ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => reproduceFormat(post)}
                                        title="Reproduire ce format"
                                        className="p-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all"
                                    >
                                        <Zap size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!searching && posts.length === 0 && keywords.trim().length > 0 && (
                <div className="h-24 flex flex-col items-center justify-center gap-2 text-gray-600">
                    <Search size={24} />
                    <p className="text-sm">Aucun résultat. Essayez d&apos;autres mots-clés.</p>
                </div>
            )}
        </div>
    )
}

// ═════════════════════════════════════════════════════════
// TAB 4 — GÉNÉRATION VIRALE
// ═════════════════════════════════════════════════════════
function GenerationTab({
    copyToClipboard, copiedId, activeDossier
}: {
    copyToClipboard: (t: string, id: string) => void
    copiedId: string | null
    activeDossier: IntelligenceDossier | null
}) {
    const [form, setForm] = useState({
        topic: '',
        platform: 'facebook',
        tone: 'inspirant',
        target_audience: 'investisseurs et entrepreneurs béninois',
        style_inspiration: '',
        language: 'fr',
    })
    const [generating, setGenerating] = useState(false)
    const [variants, setVariants] = useState<GeneratedVariant[]>([])
    const [error, setError] = useState<string | null>(null)
    const [library, setLibrary] = useState<ContentItem[]>([])
    const [savingId, setSavingId] = useState<number | null>(null)

    const [dossierContext, setDossierContext] = useState<string>('')
    const [useDossier, setUseDossier] = useState(false)

    // Charger style depuis session storage (si venu de l'onglet Style)
    useEffect(() => {
        const savedStyle = sessionStorage.getItem('cm_style_inspiration')
        const savedTopic = sessionStorage.getItem('cm_reproduce_topic')
        const savedPlatform = sessionStorage.getItem('cm_reproduce_platform')
        if (savedStyle) setForm(f => ({ ...f, style_inspiration: savedStyle }))
        if (savedTopic) setForm(f => ({ ...f, topic: savedTopic }))
        if (savedPlatform && PLATFORM_CONFIG[savedPlatform]) setForm(f => ({ ...f, platform: savedPlatform }))
        loadLibrary()
    }, [])

    // Quand le dossier actif change, le pré-charger
    useEffect(() => {
        if (activeDossier) {
            setDossierContext(JSON.stringify(activeDossier, null, 2))
            setUseDossier(true)
        }
    }, [activeDossier])

    const loadLibrary = async () => {
        try {
            const res = await fetch('/api/community-manager/library')
            if (!res.ok) { setLibrary([]); return }
            const data = await res.json()
            setLibrary(Array.isArray(data) ? data : [])
        } catch {
            setLibrary([])
        }
    }

    const generate = async () => {
        if (!form.topic.trim()) {
            setError('Le sujet est obligatoire.')
            return
        }
        setGenerating(true)
        setError(null)
        setVariants([])
        try {
            const payload = {
                ...form,
                ...(useDossier && dossierContext.trim() ? { dossier_context: dossierContext.trim() } : {}),
            }
            const res = await fetch('/api/community-manager/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setVariants(data.variants || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors de la génération')
        }
        setGenerating(false)
    }

    const saveToLibrary = async (variant: GeneratedVariant) => {
        setSavingId(variant.id)
        await fetch('/api/community-manager/library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: form.platform,
                content_type: 'post',
                text: variant.text,
                hashtags: variant.hashtags,
                style_inspiration: form.style_inspiration || null,
                viral_score: variant.estimated_engagement === 'viral' ? 5 : variant.estimated_engagement === 'élevé' ? 4 : 3,
            }),
        })
        await loadLibrary()
        setSavingId(null)
    }

    const toggleFavorite = async (item: ContentItem) => {
        await fetch('/api/community-manager/library', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, is_favorite: !item.is_favorite }),
        })
        await loadLibrary()
    }

    const deleteFromLibrary = async (id: string) => {
        await fetch(`/api/community-manager/library?id=${id}`, { method: 'DELETE' })
        await loadLibrary()
    }

    const ENGAGEMENT_ICON: Record<string, string> = {
        viral: '🔥 Viral',
        élevé: '📈 Élevé',
        moyen: '📊 Moyen',
        faible: '📉 Faible',
    }

    return (
        <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Zap size={16} className="text-yellow-400" /> Générer du contenu viral</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Sujet / Topic *</label>
                        <input
                            type="text"
                            placeholder="ex: Comment multiplier son capital en 6 mois avec le trading"
                            value={form.topic}
                            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 placeholder:text-gray-600"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Plateforme</label>
                        <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50">
                            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Ton</label>
                        <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50">
                            <option value="inspirant">💫 Inspirant</option>
                            <option value="informatif">📚 Informatif</option>
                            <option value="urgent">⚡ Urgent / Offre limitée</option>
                            <option value="humoristique">😄 Humoristique</option>
                            <option value="autoritaire">💎 Autoritaire / Expert</option>
                            <option value="storytelling">📖 Storytelling</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Langue</label>
                        <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50">
                            <option value="fr">🇫🇷 Français</option>
                            <option value="fon">🇧🇯 Fon (béninois)</option>
                            <option value="en">🇬🇧 Anglais</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Audience cible</label>
                        <input type="text" placeholder="ex: entrepreneurs béninois 25-40 ans"
                            value={form.target_audience}
                            onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 placeholder:text-gray-600"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-500 font-bold mb-1.5 block">Inspiration de style (optionnel — ou depuis l&apos;onglet Analyse)</label>
                        <textarea
                            placeholder="ex: Ton autoritaire avec des chiffres concrets, emojis rares, CTA fort en fin de post..."
                            value={form.style_inspiration}
                            onChange={e => setForm(f => ({ ...f, style_inspiration: e.target.value }))}
                            rows={2}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50 placeholder:text-gray-600 resize-none"
                        />
                    </div>

                    {/* Dossier Intelligence IA */}
                    <div className="md:col-span-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                                <Brain size={12} /> Dossier Intelligence Concurrent (optionnel — surpuissant)
                            </label>
                            <div className="flex items-center gap-2">
                                {activeDossier && (
                                    <span className="text-[10px] text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        ✓ Dossier @{activeDossier.profile.username} chargé
                                    </span>
                                )}
                                <button type="button" onClick={() => setUseDossier(u => !u)}
                                    className={`text-[10px] font-bold px-3 py-1 rounded-lg transition-all ${useDossier ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
                                    {useDossier ? '✓ Activé' : 'Activer'}
                                </button>
                            </div>
                        </div>
                        {useDossier && (
                            <textarea
                                placeholder={"Collez ici le JSON de votre dossier (téléchargé depuis l'onglet Veille)..."}
                                value={dossierContext}
                                onChange={e => setDossierContext(e.target.value)}
                                rows={4}
                                className="w-full bg-black/40 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-emerald-300/70 text-[11px] font-mono focus:outline-none focus:border-emerald-500/40 placeholder:text-gray-700 resize-none"
                            />
                        )}
                        {!useDossier && (
                            <p className="text-gray-600 text-[10px]">Activez pour utiliser le dossier d'un concurrent comme contexte — l'IA créera du contenu qui surpasse ce concurrent.</p>
                        )}
                    </div>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </div>
                )}
                <button
                    type="button"
                    onClick={generate}
                    disabled={generating || !form.topic.trim()}
                    className="mt-4 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all disabled:opacity-50"
                >
                    {generating ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    {generating ? 'Génération IA en cours...' : 'Générer 3 Variantes Virales'}
                </button>
            </div>

            {/* Variantes générées */}
            {variants.length > 0 && (
                <div className="space-y-4">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">3 variantes générées</p>
                    {variants.map((variant, idx) => (
                        <motion.div
                            key={variant.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all"
                        >
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold text-sm">Variante {variant.id}</span>
                                    <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">{variant.style_label}</span>
                                    {variant.estimated_engagement && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${ENGAGEMENT_COLOR[variant.estimated_engagement] || ''}`}>
                                            {ENGAGEMENT_ICON[variant.estimated_engagement] || variant.estimated_engagement}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(variant.text + '\n\n' + variant.hashtags.join(' '), `variant-${variant.id}`)}
                                        title="Copier le texte + hashtags"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-all"
                                    >
                                        {copiedId === `variant-${variant.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        Copier
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => saveToLibrary(variant)}
                                        disabled={savingId === variant.id}
                                        title="Sauvegarder en bibliothèque"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        {savingId === variant.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                        Sauvegarder
                                    </button>
                                </div>
                            </div>

                            {/* Texte du post */}
                            <div className="bg-black/30 rounded-xl p-4 mb-4 font-mono text-sm text-gray-200 whitespace-pre-wrap leading-relaxed border border-white/5">
                                {variant.text}
                            </div>

                            {/* Hashtags */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                                {variant.hashtags.map((tag, i) => (
                                    <span key={i} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/10">
                                        {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
                                ))}
                            </div>

                            {/* Tips et infos */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-white/[0.02] rounded-lg p-3">
                                    <p className="text-gray-600 text-[10px] font-bold mb-1.5">🕐 Meilleur moment de publication</p>
                                    <p className="text-gray-300 text-xs">{variant.best_time}</p>
                                </div>
                                <div className="bg-white/[0.02] rounded-lg p-3">
                                    <p className="text-gray-600 text-[10px] font-bold mb-1.5">😀 Emojis recommandés</p>
                                    <p className="text-2xl">{variant.emoji_suggestions?.join(' ')}</p>
                                </div>
                                {variant.viral_tips?.map((tip, i) => (
                                    <div key={i} className="bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3 flex items-start gap-2">
                                        <Target size={12} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-yellow-200/70 text-xs">{tip}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Bibliothèque de contenu */}
            {library.length > 0 && (
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                        <BookOpen size={16} className="text-purple-400" /> Bibliothèque ({library.length})
                    </h2>
                    <div className="space-y-3">
                        {library.map(item => (
                            <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <PlatformBadge platform={item.platform} />
                                        <span className="text-[10px] text-gray-600">{new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                                    </div>
                                    <p className="text-gray-300 text-sm line-clamp-2">{item.text}</p>
                                    {item.hashtags?.length > 0 && (
                                        <p className="text-purple-400/60 text-xs mt-1 truncate">{item.hashtags.slice(0, 5).join(' ')}</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => toggleFavorite(item)}
                                        title={item.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                        className={`p-1.5 rounded-lg transition-all ${item.is_favorite ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-600 hover:text-yellow-400'}`}
                                    >
                                        {item.is_favorite ? <Star size={13} /> : <StarOff size={13} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(item.text + '\n\n' + (item.hashtags || []).join(' '), `lib-${item.id}`)}
                                        title="Copier"
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-white transition-all"
                                    >
                                        {copiedId === `lib-${item.id}` ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteFromLibrary(item.id)}
                                        title="Supprimer"
                                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
