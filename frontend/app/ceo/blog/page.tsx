'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, RefreshCw, Loader2, Plus, X, Save, Trash2, Eye, ToggleLeft, ToggleRight, Tag } from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Post {
    id: string; title: string; slug?: string; excerpt?: string; content?: string
    cover_image?: string; category?: string; tags?: string[]; is_published?: boolean
    author?: string; created_at: string
}

function fmt(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

const EMPTY = { title: '', slug: '', excerpt: '', content: '', cover_image: '', category: '', tags: '', is_published: false, author: '' }

export default function CeoBlog() {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<Post | null>(null)
    const [editData, setEditData] = useState<Omit<Partial<Post>, 'tags'> & { tags?: string }>({})
    const [showCreate, setShowCreate] = useState(false)
    const [newPost, setNewPost] = useState(EMPTY)
    const [saving, setSaving] = useState(false)
    const [creating, setCreating] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/blog', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        setPosts(data.posts || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const open = (p: Post) => {
        const { tags: _t, ...rest } = p
        setSelected(p)
        setEditData({ ...rest, tags: Array.isArray(_t) ? _t.join(', ') : '' })
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        const payload = { ...editData, tags: typeof editData.tags === 'string' ? editData.tags.split(',').map(t => t.trim()).filter(Boolean) : editData.tags }
        await fetch('/api/ceo/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, ...payload }) })
        setSaving(false)
        setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, ...payload } as Post : p))
        setSelected(null)
    }

    const del = async (id: string) => {
        if (!confirm('Supprimer cet article ?')) return
        await fetch(`/api/ceo/blog?id=${id}`, { method: 'DELETE' })
        setPosts(prev => prev.filter(p => p.id !== id)); setSelected(null)
    }

    const toggle = async (p: Post) => {
        const val = !p.is_published
        await fetch('/api/ceo/blog', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, is_published: val }) })
        setPosts(prev => prev.map(x => x.id === p.id ? { ...x, is_published: val } : x))
    }

    const create = async () => {
        if (!newPost.title.trim()) return
        setCreating(true)
        const payload = { ...newPost, slug: newPost.slug || slug(newPost.title), tags: newPost.tags.split(',').map(t => t.trim()).filter(Boolean) }
        const res = await fetch('/api/ceo/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) { setShowCreate(false); setNewPost(EMPTY); setRefresh(r => r + 1) }
        setCreating(false)
    }

    const filtered = posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    const published = posts.filter(p => p.is_published).length

    const inp = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none'
    const inpStyle = { background: BG, border: `1px solid ${GOLD}25`, color: TEXT }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <BookOpen size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Blog</h1>
                    </div>
                    <p className="text-sm opacity-50">Articles & publications</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="px-4 py-2 rounded-xl text-sm outline-none w-48" style={inpStyle} />
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90" style={{ background: GOLD, color: BG }}>
                        <Plus size={14} /> Nouveau
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)} className="px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total', value: posts.length, color: GOLD },
                    { label: 'Publiés', value: published, color: GREEN_L },
                    { label: 'Brouillons', value: posts.length - published, color: '#94a3b8' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
                            className="rounded-2xl p-5 flex items-center gap-4" style={{ background: PANEL, border: `1px solid ${p.is_published ? `${GREEN}30` : `${GOLD}12`}` }}>
                            {p.cover_image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.cover_image} alt="" className="w-16 h-12 rounded-xl object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-sm truncate">{p.title}</h3>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                                        style={{ background: p.is_published ? `${GREEN_L}20` : `${GOLD}12`, color: p.is_published ? GREEN_L : GOLD }}>
                                        {p.is_published ? 'Publié' : 'Brouillon'}
                                    </span>
                                </div>
                                {p.excerpt && <p className="text-xs opacity-40 truncate">{p.excerpt}</p>}
                                <div className="flex items-center gap-3 mt-1">
                                    {p.category && <span className="flex items-center gap-1 text-[10px] opacity-40"><Tag size={9}/>{p.category}</span>}
                                    <span className="text-[10px] opacity-30">{fmt(p.created_at)}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={() => open(p)} className="p-2 rounded-xl hover:opacity-80" style={{ background: `${GOLD}15`, color: GOLD }}>
                                    <Eye size={14} />
                                </button>
                                <button onClick={() => toggle(p)} className="p-2 rounded-xl hover:opacity-80"
                                    style={{ background: p.is_published ? `${RED}15` : `${GREEN}20`, color: p.is_published ? RED : GREEN_L }}>
                                    {p.is_published ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                    {filtered.length === 0 && <p className="text-center opacity-30 py-12">Aucun article</p>}
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
                                <h3 className="font-black" style={{ color: GOLD }}>Modifier l&apos;article</h3>
                                <button type="button" onClick={() => setSelected(null)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'title', label: 'Titre *' }, { key: 'slug', label: 'Slug URL' },
                                    { key: 'category', label: 'Catégorie' }, { key: 'author', label: 'Auteur' },
                                    { key: 'cover_image', label: 'Image de couverture (URL)' }, { key: 'tags', label: 'Tags (séparés par virgule)' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={String((editData as Record<string, unknown>)[f.key] || '')}
                                            onChange={e => setEditData(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Extrait</label>
                                    <textarea value={editData.excerpt || ''} onChange={e => setEditData(p => ({ ...p, excerpt: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle} />
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Contenu</label>
                                    <textarea value={editData.content || ''} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                                        rows={5} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle} />
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: BG, border: `1px solid ${GOLD}20` }}>
                                    <span className="text-sm font-semibold">Publié</span>
                                    <button type="button" onClick={() => setEditData(p => ({ ...p, is_published: !p.is_published }))}
                                        className="w-12 h-6 rounded-full transition-all relative" style={{ background: editData.is_published ? GREEN : '#374151' }}>
                                        <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all" style={{ left: editData.is_published ? '26px' : '4px' }}/>
                                    </button>
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
                            className="w-full max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouvel article</h3>
                                <button type="button" onClick={() => setShowCreate(false)} className="opacity-40 hover:opacity-70 p-1"><X size={18}/></button>
                            </div>
                            <div className="space-y-3 mb-5">
                                {[
                                    { key: 'title', label: 'Titre *' }, { key: 'category', label: 'Catégorie' },
                                    { key: 'author', label: 'Auteur' }, { key: 'cover_image', label: 'Image de couverture (URL)' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">{f.label}</label>
                                        <input type="text" value={newPost[f.key as keyof typeof newPost] as string}
                                            onChange={e => setNewPost(p => ({ ...p, [f.key]: e.target.value }))}
                                            className={inp} style={inpStyle} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Extrait</label>
                                    <textarea value={newPost.excerpt} onChange={e => setNewPost(p => ({ ...p, excerpt: e.target.value }))}
                                        rows={2} className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none" style={inpStyle}/>
                                </div>
                            </div>
                            <button type="button" onClick={create} disabled={creating || !newPost.title.trim()}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>} Créer l&apos;article
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
