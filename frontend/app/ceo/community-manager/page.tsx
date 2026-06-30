'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Share2, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye,
    Instagram, Facebook, Linkedin, Globe, Send, Clock, CheckCircle2, Edit3,
    type LucideIcon,
} from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

type Platform = 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'whatsapp' | 'all'
type PostStatus = 'draft' | 'scheduled' | 'published'

interface SocialPost {
    id: string; title?: string; content: string; platform: Platform
    status: PostStatus; scheduled_at?: string; image_url?: string
    hashtags?: string; created_at: string
}

const PLATFORM_META: Record<string, { label: string; color: string; bg: string; icon: LucideIcon }> = {
    facebook:  { label: 'Facebook',  color: '#1877f2', bg: '#1877f215', icon: Facebook },
    instagram: { label: 'Instagram', color: '#e1306c', bg: '#e1306c15', icon: Instagram },
    linkedin:  { label: 'LinkedIn',  color: '#0077b5', bg: '#0077b515', icon: Linkedin },
    twitter:   { label: 'X/Twitter', color: '#1da1f2', bg: '#1da1f215', icon: Globe },
    whatsapp:  { label: 'WhatsApp',  color: GREEN_L,   bg: `${GREEN_L}15`, icon: Send },
    all:       { label: 'Tous canaux', color: GOLD,    bg: `${GOLD}15`,   icon: Share2 },
}

const STATUS_META: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    draft:     { label: 'Brouillon',  color: '#94a3b8', icon: Edit3 },
    scheduled: { label: 'Planifié',   color: GOLD,      icon: Clock },
    published: { label: 'Publié',     color: GREEN_L,   icon: CheckCircle2 },
}

const EMPTY = { title: '', content: '', platform: 'facebook' as Platform, status: 'draft' as PostStatus, scheduled_at: '', image_url: '', hashtags: '' }

export default function CeoCommunityManager() {
    const [posts, setPosts] = useState<SocialPost[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<SocialPost | null>(null)
    const [editData, setEditData] = useState<Partial<SocialPost>>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newPost, setNewPost] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [filterPlatform, setFilterPlatform] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/community-manager', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setPosts(data.posts || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (p: SocialPost) => {
        setSelected(p)
        setEditData({ ...p, scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : '' })
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch('/api/ceo/community-manager', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...editData }) })
        setSaving(false)
        setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, ...editData } as SocialPost : p))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer ce post ?')) return
        await fetch(`/api/ceo/community-manager?id=${id}`, { method: 'DELETE' })
        setPosts(prev => prev.filter(p => p.id !== id)); setSelected(null)
    }

    const publish = async (p: SocialPost) => {
        const newStatus = p.status === 'published' ? 'draft' : 'published'
        await fetch('/api/ceo/community-manager', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status: newStatus }) })
        setPosts(prev => prev.map(x => x.id === p.id ? { ...x, status: newStatus } : x))
    }

    const create = async () => {
        if (!newPost.content.trim()) return
        setCreating(true)
        const res = await fetch('/api/ceo/community-manager', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPost) })
        if (res.ok) { setShowCreate(false); setNewPost(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const filtered = posts
        .filter(p => filterPlatform === 'all' || p.platform === filterPlatform)
        .filter(p => filterStatus === 'all' || p.status === filterStatus)

    const scheduled = posts.filter(p => p.status === 'scheduled').length
    const published = posts.filter(p => p.status === 'published').length

    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Share2 size={18} style={{ color: GOLD }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Community Manager</h1>
                    </div>
                    <p className="text-sm opacity-50">Calendrier éditorial & publications sociales</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Plus size={14}/> Nouveau post
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', value: posts.length, color: GOLD },
                    { label: 'Publiés', value: published, color: GREEN_L },
                    { label: 'Planifiés', value: scheduled, color: GOLD },
                    { label: 'Brouillons', value: posts.filter(p => p.status === 'draft').length, color: '#94a3b8' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-5">
                <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(PLATFORM_META).map(([k, v]) => {
                        const Icon = v.icon
                        return (
                            <button key={k} type="button" onClick={() => setFilterPlatform(k)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                style={{ background: filterPlatform === k ? v.color : `${v.color}18`, color: filterPlatform === k ? '#fff' : v.color }}>
                                <Icon size={11}/> {v.label}
                            </button>
                        )
                    })}
                </div>
                <div className="flex gap-1.5 ml-auto">
                    {['all', 'draft', 'scheduled', 'published'].map(s => (
                        <button key={s} type="button" onClick={() => setFilterStatus(s)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                            style={{ background: filterStatus === s ? GOLD : `${GOLD}12`, color: filterStatus === s ? BG : GOLD }}>
                            {s === 'all' ? 'Tous' : STATUS_META[s]?.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((post, i) => {
                        const platform = PLATFORM_META[post.platform] || PLATFORM_META.all
                        const status = STATUS_META[post.status]
                        const PIcon = platform.icon
                        const SIcon = status.icon
                        return (
                            <motion.div key={post.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.05 }}
                                className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: PANEL, border: `1px solid ${platform.color}25` }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: platform.bg }}>
                                            <PIcon size={15} style={{ color: platform.color }}/>
                                        </div>
                                        <span className="text-[11px] font-bold" style={{ color: platform.color }}>{platform.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: `${status.color}15`, color: status.color }}>
                                        <SIcon size={9}/>{status.label}
                                    </div>
                                </div>
                                {post.title && <p className="font-bold text-sm">{post.title}</p>}
                                <p className="text-[12px] opacity-60 flex-1 line-clamp-3">{post.content}</p>
                                {post.hashtags && <p className="text-[11px] opacity-40 truncate" style={{ color: platform.color }}>{post.hashtags}</p>}
                                {post.scheduled_at && (
                                    <div className="flex items-center gap-1.5 text-[10px] opacity-40">
                                        <Clock size={9}/> {new Date(post.scheduled_at).toLocaleString('fr-FR')}
                                    </div>
                                )}
                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    <button type="button" onClick={() => open(post)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                        <Eye size={12}/> Modifier
                                    </button>
                                    <button type="button" onClick={() => publish(post)} className="p-2 rounded-xl hover:opacity-80"
                                        style={{ background: post.status === 'published' ? `${RED}15` : `${GREEN}20`, color: post.status === 'published' ? RED : GREEN_L }}>
                                        {post.status === 'published' ? <X size={16}/> : <CheckCircle2 size={16}/>}
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                    {filtered.length === 0 && <p className="col-span-3 text-center opacity-30 py-12">Aucun post</p>}
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier le post</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Titre (optionnel)</label>
                                    <input type="text" value={editData.title || ''} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} className={inp} style={inpStyle}/>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Plateforme</label>
                                        <select value={editData.platform || 'facebook'} onChange={e => setEditData(p => ({ ...p, platform: e.target.value as Platform }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                            {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Statut</label>
                                        <select value={editData.status || 'draft'} onChange={e => setEditData(p => ({ ...p, status: e.target.value as PostStatus }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                            <option value="draft">Brouillon</option>
                                            <option value="scheduled">Planifié</option>
                                            <option value="published">Publié</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Contenu *</label>
                                    <textarea value={editData.content || ''} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                                        rows={5} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                                {[{ key: 'hashtags', label: 'Hashtags' }, { key: 'image_url', label: 'Image (URL)' }].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))} className={inp} style={inpStyle}/>
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Date de publication planifiée</label>
                                    <input type="datetime-local" value={editData.scheduled_at || ''} onChange={e => setEditData(p => ({ ...p, scheduled_at: e.target.value }))} className={inp} style={inpStyle}/>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="button" onClick={() => del(selected.id)} className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}><Trash2 size={16}/></button>
                                <button type="button" onClick={save} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouveau post</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Titre</label>
                                    <input type="text" value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} className={inp} style={inpStyle}/>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Plateforme</label>
                                        <select value={newPost.platform} onChange={e => setNewPost(p => ({ ...p, platform: e.target.value as Platform }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                            {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Statut</label>
                                        <select value={newPost.status} onChange={e => setNewPost(p => ({ ...p, status: e.target.value as PostStatus }))}
                                            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inpStyle}>
                                            <option value="draft">Brouillon</option>
                                            <option value="scheduled">Planifié</option>
                                            <option value="published">Publié maintenant</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Contenu *</label>
                                    <textarea value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))}
                                        rows={4} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Hashtags</label>
                                    <input type="text" placeholder="#benin #diaspora #retour" value={newPost.hashtags} onChange={e => setNewPost(p => ({ ...p, hashtags: e.target.value }))} className={inp} style={inpStyle}/>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Date planifiée</label>
                                    <input type="datetime-local" value={newPost.scheduled_at} onChange={e => setNewPost(p => ({ ...p, scheduled_at: e.target.value }))} className={inp} style={inpStyle}/>
                                </div>
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newPost.content.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer le post
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
