'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    BookOpen, Search, ChevronRight, FileText, Globe,
    Building2, Landmark, Users, Scale, Banknote,
    Plus, X, Trash2, Edit3, Save, Loader2, Sparkles, Send
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface WikiArticle {
    id: string
    category: string
    title: string
    content: string
    tags: string[]
}

const categoryIcons: Record<string, { icon: LucideIcon; color: string }> = {
    'Nationalité': { icon: Globe, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    'Immobilier': { icon: Building2, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    'Business': { icon: Scale, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    'Juridique': { icon: Landmark, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    'Démarches Admin': { icon: Landmark, color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
    'Contacts Utiles': { icon: Users, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
    'Finance': { icon: Banknote, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
}

const defaultCategoryConfig = { icon: FileText, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }

const availableCategories = ['Nationalité', 'Immobilier', 'Business', 'Juridique', 'Démarches Admin', 'Contacts Utiles', 'Finance']

export default function AgentWikiPage() {
    const [articles, setArticles] = useState<WikiArticle[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null)
    const [aiResponse, setAiResponse] = useState<string | null>(null)
    const [aiLoading, setAiLoading] = useState(false)

    // Form state
    const [showForm, setShowForm] = useState(false)
    const [editingArticle, setEditingArticle] = useState<WikiArticle | null>(null)
    const [formCategory, setFormCategory] = useState('Nationalité')
    const [formTitle, setFormTitle] = useState('')
    const [formContent, setFormContent] = useState('')
    const [formTags, setFormTags] = useState('')
    const [saving, setSaving] = useState(false)

    const fetchArticles = async () => {
        const { data } = await supabase
            .from('wiki_articles')
            .select('*')
            .order('category', { ascending: true })
        setArticles((data || []) as WikiArticle[])
        setLoading(false)
    }

    useEffect(() => { fetchArticles() }, [])

    const categories = [...new Set(articles.map(a => a.category))]

    const filtered = articles.filter(a => {
        const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
            a.content.toLowerCase().includes(search.toLowerCase()) ||
            a.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
        const matchCategory = !selectedCategory || a.category === selectedCategory
        return matchSearch && matchCategory
    })

    const openCreateForm = () => {
        setEditingArticle(null)
        setFormCategory('Nationalité')
        setFormTitle('')
        setFormContent('')
        setFormTags('')
        setShowForm(true)
    }

    const openEditForm = (article: WikiArticle) => {
        setEditingArticle(article)
        setFormCategory(article.category)
        setFormTitle(article.title)
        setFormContent(article.content)
        setFormTags(article.tags?.join(', ') || '')
        setSelectedArticle(null)
        setShowForm(true)
    }

    const handleSaveArticle = async () => {
        if (!formTitle.trim() || !formContent.trim()) return
        setSaving(true)

        const tagsArray = formTags.split(',').map(t => t.trim()).filter(Boolean)
        const articleData = {
            category: formCategory,
            title: formTitle,
            content: formContent,
            tags: tagsArray,
        }

        if (editingArticle) {
            await supabase.from('wiki_articles').update({ ...articleData, updated_at: new Date().toISOString() }).eq('id', editingArticle.id)
        } else {
            await supabase.from('wiki_articles').insert(articleData)
        }

        await fetchArticles()
        setShowForm(false)
        setSaving(false)
    }

    const handleDeleteArticle = async (id: string) => {
        await supabase.from('wiki_articles').delete().eq('id', id)
        setArticles(prev => prev.filter(a => a.id !== id))
        setSelectedArticle(null)
    }

    const askAI = async () => {
        if (!search.trim() || aiLoading) return
        setAiLoading(true)
        setAiResponse(null)
        try {
            const res = await fetch('/api/wiki/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: search,
                    context: articles.map(a => ({ title: a.title, content: a.content }))
                })
            })
            const data = await res.json()
            setAiResponse(data.answer)
        } catch (error) {
            console.error(error)
            setAiResponse("L'IA n'a pas pu répondre à cette requête.")
        } finally {
            setAiLoading(false)
        }
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
                        <BookOpen size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">Ressources</span>
                    </div>
                    <h1 className="text-2xl font-black text-white">Base de Connaissance</h1>
                    <p className="text-gray-500 text-sm mt-1">{articles.length} article(s)</p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-500/30 transition-all"
                >
                    <Plus size={16} /> Nouvel Article
                </button>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setAiResponse(null) }}
                        onKeyDown={e => e.key === 'Enter' && askAI()}
                        placeholder="Rechercher un article, un sujet..."
                        title="Rechercher"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                    />
                </div>
                <button
                    onClick={askAI}
                    disabled={!search.trim() || aiLoading}
                    className="flex shrink-0 items-center justify-center gap-2 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 px-6 py-3 rounded-xl text-sm font-bold hover:from-emerald-500/30 hover:to-teal-500/30 disabled:opacity-50 transition-all font-mono tracking-widest uppercase"
                >
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span className="hidden sm:inline">Demander à l'IA</span>
                </button>
            </div>

            {/* AI Response Block */}
            <AnimatePresence>
                {aiResponse && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-5 relative">
                            <button onClick={() => setAiResponse(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={14} /></button>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={16} className="text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Assistant IA Retour Gagnant</span>
                            </div>
                            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pr-6">
                                {aiResponse}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Category Tabs */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSelectedCategory(null)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!selectedCategory ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}>
                    Tout ({articles.length})
                </button>
                {categories.map(cat => {
                    const config = categoryIcons[cat] || defaultCategoryConfig
                    const Icon = config.icon
                    const count = articles.filter(a => a.category === cat).length
                    return (
                        <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${cat === selectedCategory ? `${config.color} border` : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}>
                            <Icon size={12} /> {cat} ({count})
                        </button>
                    )
                })}
            </div>

            {/* Articles */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                        <BookOpen size={40} className="mx-auto mb-3 text-gray-700" />
                        <p className="text-sm font-semibold">Aucun article trouvé</p>
                        <p className="text-xs mt-2">Créez votre premier article avec le bouton ci-dessus</p>
                    </div>
                ) : (
                    filtered.map((article, i) => {
                        const config = categoryIcons[article.category] || defaultCategoryConfig
                        const Icon = config.icon
                        return (
                            <motion.div key={article.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => setSelectedArticle(article)} className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-emerald-500/20 transition-all cursor-pointer group">
                                <div className="flex items-start gap-4">
                                    <div className={`p-2.5 rounded-xl border ${config.color} flex-shrink-0`}><Icon size={18} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{article.title}</p>
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.content.substring(0, 150)}...</p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {article.tags?.map(tag => (<span key={tag} className="text-[9px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400">{tag}</span>))}
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-1" />
                                </div>
                            </motion.div>
                        )
                    })
                )}
            </div>

            {/* Article Detail Modal */}
            <AnimatePresence>
                {selectedArticle && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedArticle(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {(() => { const config = categoryIcons[selectedArticle.category] || defaultCategoryConfig; const CatIcon = config.icon; return (<div className={`p-2 rounded-xl border ${config.color}`}><CatIcon size={16} /></div>) })()}
                                    <div>
                                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{selectedArticle.category}</p>
                                        <h3 className="text-lg font-bold text-white">{selectedArticle.title}</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openEditForm(selectedArticle)} className="text-gray-500 hover:text-blue-400 transition-colors" title="Modifier"><Edit3 size={16} /></button>
                                    <button onClick={() => handleDeleteArticle(selectedArticle.id)} className="text-gray-500 hover:text-red-400 transition-colors" title="Supprimer"><Trash2 size={16} /></button>
                                    <button onClick={() => setSelectedArticle(null)} className="text-gray-500 hover:text-white transition-colors" title="Fermer"><X size={16} /></button>
                                </div>
                            </div>
                            <div className="prose prose-invert prose-sm max-w-none">
                                {selectedArticle.content.split('\n').map((paragraph, i) => (
                                    <p key={i} className="text-sm text-gray-300 leading-relaxed mb-2">{paragraph}</p>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-4 pt-4 border-t border-white/5">
                                {selectedArticle.tags?.map(tag => (<span key={tag} className="text-[9px] bg-white/5 px-2 py-0.5 rounded-full text-gray-400">{tag}</span>))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create/Edit Article Modal */}
            <AnimatePresence>
                {showForm && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-[#0a0f14] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
                            <h3 className="text-lg font-bold text-white mb-4">{editingArticle ? 'Modifier l\'article' : 'Nouvel Article'}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Catégorie</label>
                                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)} title="Catégorie" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50">
                                        {availableCategories.map(c => (<option key={c} value={c}>{c}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Titre</label>
                                    <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Titre de l'article" title="Titre" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Contenu</label>
                                    <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="Contenu de l'article..." title="Contenu" rows={10} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5 block">Tags (séparés par des virgules)</label>
                                    <input type="text" value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="nationalité, documents, procédure" title="Tags" className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">Annuler</button>
                                    <button onClick={handleSaveArticle} disabled={saving || !formTitle.trim() || !formContent.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-bold hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {editingArticle ? 'Mettre à jour' : 'Publier'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
