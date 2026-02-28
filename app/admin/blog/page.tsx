'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    BookOpen, Plus, Edit3, Trash2, Eye, EyeOff,
    Save, X, Globe2, Calendar, Search
} from 'lucide-react'

interface BlogPost {
    id: string
    title: string
    slug: string
    excerpt: string
    content: string
    cover_image: string
    category: string
    is_published: boolean
    views: number
    created_at: string
}

const CATEGORIES = ['general', 'citoyennete', 'investissement', 'immobilier', 'culture', 'business']

export default function AdminBlogPage() {
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<BlogPost | null>(null)
    const [creating, setCreating] = useState(false)
    const [search, setSearch] = useState('')
    const [form, setForm] = useState({
        title: '', slug: '', excerpt: '', content: '',
        cover_image: '', category: 'general', is_published: false
    })

    const fetchPosts = async () => {
        const { data } = await supabase
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false })
        setPosts((data || []) as BlogPost[])
        setLoading(false)
    }

    useEffect(() => { fetchPosts() }, [])

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
    }

    const handleCreate = async () => {
        if (!form.title) return
        const slug = form.slug || generateSlug(form.title)
        await supabase.from('blog_posts').insert({ ...form, slug, author: 'Retour Gagnant' })
        setCreating(false)
        setForm({ title: '', slug: '', excerpt: '', content: '', cover_image: '', category: 'general', is_published: false })
        fetchPosts()
    }

    const handleUpdate = async () => {
        if (!editing) return
        await supabase.from('blog_posts').update({
            title: form.title,
            slug: form.slug,
            excerpt: form.excerpt,
            content: form.content,
            cover_image: form.cover_image,
            category: form.category,
            is_published: form.is_published,
            updated_at: new Date().toISOString(),
        }).eq('id', editing.id)
        setEditing(null)
        fetchPosts()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cet article ?')) return
        await supabase.from('blog_posts').delete().eq('id', id)
        fetchPosts()
    }

    const togglePublish = async (post: BlogPost) => {
        await supabase.from('blog_posts').update({ is_published: !post.is_published }).eq('id', post.id)
        fetchPosts()
    }

    const startEdit = (post: BlogPost) => {
        setEditing(post)
        setForm({
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt,
            content: post.content,
            cover_image: post.cover_image,
            category: post.category,
            is_published: post.is_published,
        })
    }

    const filtered = posts.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
    )

    // Editor view
    if (editing || creating) {
        return (
            <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-xl font-black text-white">{editing ? 'Modifier l\'article' : 'Nouvel Article'}</h1>
                        <button onClick={() => { setEditing(null); setCreating(false) }} className="text-gray-400 hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Titre *</label>
                            <input
                                type="text" value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value, slug: generating ? generateSlug(e.target.value) : form.slug })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                placeholder="Titre de l'article"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Slug URL</label>
                                <input
                                    type="text" value={form.slug}
                                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                    placeholder="url-de-l-article"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 mb-1 block">Catégorie</label>
                                <select
                                    value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Image de couverture (URL)</label>
                            <input
                                type="text" value={form.cover_image}
                                onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Résumé / Extrait</label>
                            <textarea
                                rows={2} value={form.excerpt}
                                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none resize-none"
                                placeholder="Court résumé..."
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">Contenu (Markdown)</label>
                            <textarea
                                rows={15} value={form.content}
                                onChange={(e) => setForm({ ...form, content: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none resize-none font-mono"
                                placeholder="## Titre&#10;&#10;Votre contenu ici..."
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox" checked={form.is_published}
                                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                                    className="rounded"
                                />
                                Publier immédiatement
                            </label>
                        </div>
                        <button
                            onClick={editing ? handleUpdate : handleCreate}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm"
                        >
                            <Save size={16} /> {editing ? 'Mettre à jour' : 'Créer l\'article'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const generating = !editing

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Gestion</span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <BookOpen size={22} className="text-emerald-400" /> Blog
                        </h1>
                    </div>
                    <button
                        onClick={() => { setCreating(true); setForm({ title: '', slug: '', excerpt: '', content: '', cover_image: '', category: 'general', is_published: false }) }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> Nouvel Article
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none"
                    />
                </div>

                {/* Posts List */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((post, i) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-all"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${post.is_published ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-white truncate">{post.title}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                                            <span className="flex items-center gap-1"><Globe2 size={10} /> {post.category}</span>
                                            <span className="flex items-center gap-1"><Eye size={10} /> {post.views}</span>
                                            <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(post.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button onClick={() => togglePublish(post)} className={`p-2 rounded-lg transition-all ${post.is_published ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`} title={post.is_published ? 'Dépublier' : 'Publier'}>
                                        {post.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                    <button onClick={() => startEdit(post)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(post.id)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
