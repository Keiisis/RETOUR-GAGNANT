'use client'

import { useTranslation, T } from '@/lib/translation'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { MediaUpload } from '@/components/admin/MediaUpload'
import {
    BookOpen, Plus, Edit3, Trash2, Eye, EyeOff,
    Save, X, Globe2, Calendar, Search, ArrowLeft,
    Bold, Italic, Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Code, Link2, Minus,
    ImageIcon, Film, AlignLeft, Sparkles, Clock,
    Tag, FileText, ChevronDown, CheckCircle2, Type,
    LayoutGrid, LayoutList, Maximize2, Minimize2,
    Undo2, Redo2, Copy, Loader2
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
    meta_title?: string
    meta_description?: string
    tags?: string
}

const CATEGORIES = [
    { value: 'general', label: 'Général', icon: '📰' },
    { value: 'citoyennete', label: 'Citoyenneté', icon: '🏛️' },
    { value: 'investissement', label: 'Investissement', icon: '💰' },
    { value: 'immobilier', label: 'Immobilier', icon: '🏠' },
    { value: 'culture', label: 'Culture', icon: '🎭' },
    { value: 'business', label: 'Business', icon: '💼' },
]

// Markdown toolbar actions
interface ToolbarAction {
    icon: React.ReactNode
    label: string
    prefix: string
    suffix: string
    block?: boolean
}

export default function AdminBlogPage() {
    const { t } = useTranslation()
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState<BlogPost | null>(null)
    const [creating, setCreating] = useState(false)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
    const [showSEO, setShowSEO] = useState(false)
    const [showMediaPanel, setShowMediaPanel] = useState(false)
    const [fullscreen, setFullscreen] = useState(false)
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
    const [tagInput, setTagInput] = useState('')
    const [undoStack, setUndoStack] = useState<string[]>([])
    const [redoStack, setRedoStack] = useState<string[]>([])
    const [autoSlug, setAutoSlug] = useState(true)
    const contentRef = useRef<HTMLTextAreaElement>(null)

    const [form, setForm] = useState({
        title: '', slug: '', excerpt: '', content: '',
        cover_image: '', category: 'general', is_published: false,
        meta_title: '', meta_description: '', tags: '',
    })

    const fetchPosts = async () => {
        const { data } = await supabase
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false })
        setPosts((data || []) as BlogPost[])
        setLoading(false)
    }

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
        fetchPosts()
    }, [])

    const formatDateSafe = (val: string) => {
        if (!mounted || !val) return '—'
        const d = new Date(val)
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
    }

    // Reading time estimate
    const readingTime = useMemo(() => {
        const text = form.content || ''
        const words = text.split(/\s+/).filter(w => w.length > 0).length
        const minutes = Math.max(1, Math.ceil(words / 200))
        return { words, minutes }
    }, [form.content])

    // Tags management
    const tags = useMemo(() => {
        const raw = form.tags
        if (!raw) return []
        if (Array.isArray(raw)) return (raw as unknown as string[]).filter(Boolean)
        if (typeof raw === 'string') return raw.split(',').map(t => t.trim()).filter(Boolean)
        return []
    }, [form.tags])

    const addTag = () => {
        if (!tagInput.trim()) return
        const newTags = [...tags, tagInput.trim()].join(', ')
        setForm({ ...form, tags: newTags })
        setTagInput('')
    }

    const removeTag = (index: number) => {
        const newTags = tags.filter((_, i) => i !== index).join(', ')
        setForm({ ...form, tags: newTags })
    }

    // Undo/Redo
    const pushUndo = useCallback(() => {
        setUndoStack(prev => [...prev.slice(-30), form.content || ''])
        setRedoStack([])
    }, [form.content])

    const undo = () => {
        if (undoStack.length === 0) return
        const prev = undoStack[undoStack.length - 1]
        setRedoStack(r => [...r, form.content || ''])
        setUndoStack(u => u.slice(0, -1))
        setForm(f => ({ ...f, content: prev }))
    }

    const redo = () => {
        if (redoStack.length === 0) return
        const next = redoStack[redoStack.length - 1]
        setUndoStack(u => [...u, form.content || ''])
        setRedoStack(r => r.slice(0, -1))
        setForm(f => ({ ...f, content: next }))
    }

    // Markdown toolbar insertion
    const insertMarkdown = useCallback((prefix: string, suffix: string, block = false) => {
        const textarea = contentRef.current
        if (!textarea) return

        pushUndo()

        const currentContent = form.content || ''
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = currentContent.substring(start, end)
        const before = currentContent.substring(0, start)
        const after = currentContent.substring(end)

        let newContent: string
        let cursorPos: number

        if (block) {
            const lineStart = before.lastIndexOf('\n') + 1
            const linePrefix = before.substring(lineStart)
            newContent = before.substring(0, lineStart) + prefix + linePrefix + selected + suffix + after
            cursorPos = lineStart + prefix.length + linePrefix.length + selected.length
        } else if (selected) {
            newContent = before + prefix + selected + suffix + after
            cursorPos = start + prefix.length + selected.length + suffix.length
        } else {
            newContent = before + prefix + suffix + after
            cursorPos = start + prefix.length
        }

        setForm(f => ({ ...f, content: newContent }))

        requestAnimationFrame(() => {
            textarea.focus()
            textarea.setSelectionRange(cursorPos, cursorPos)
        })
    }, [form.content, pushUndo])

    // Insert media URL into content
    const insertMediaInContent = useCallback((url: string) => {
        const isVideo = /\.(mp4|webm|mov)$/i.test(url)
        const markdown = isVideo
            ? `\n<video src="${url}" controls width="100%"></video>\n`
            : `\n![Image](${url})\n`

        pushUndo()

        const textarea = contentRef.current
        const currentContent = form.content || ''
        if (textarea) {
            const pos = textarea.selectionStart
            const before = currentContent.substring(0, pos)
            const after = currentContent.substring(pos)
            setForm(f => ({ ...f, content: before + markdown + after }))
        } else {
            setForm(f => ({ ...f, content: currentContent + markdown }))
        }

        setShowMediaPanel(false)
    }, [form.content, pushUndo])

    // Toolbar buttons
    const toolbarActions: (ToolbarAction | 'separator')[] = [
        { icon: <Bold size={15} />, label: 'Gras', prefix: '**', suffix: '**' },
        { icon: <Italic size={15} />, label: 'Italique', prefix: '*', suffix: '*' },
        'separator',
        { icon: <Heading1 size={15} />, label: 'Titre 1', prefix: '# ', suffix: '', block: true },
        { icon: <Heading2 size={15} />, label: 'Titre 2', prefix: '## ', suffix: '', block: true },
        { icon: <Heading3 size={15} />, label: 'Titre 3', prefix: '### ', suffix: '', block: true },
        'separator',
        { icon: <List size={15} />, label: 'Liste', prefix: '- ', suffix: '', block: true },
        { icon: <ListOrdered size={15} />, label: 'Liste numérotée', prefix: '1. ', suffix: '', block: true },
        { icon: <Quote size={15} />, label: 'Citation', prefix: '> ', suffix: '', block: true },
        'separator',
        { icon: <Code size={15} />, label: 'Code', prefix: '`', suffix: '`' },
        { icon: <Link2 size={15} />, label: 'Lien', prefix: '[', suffix: '](url)' },
        { icon: <Minus size={15} />, label: 'Séparateur', prefix: '\n---\n', suffix: '' },
    ]

    const handleCreate = async () => {
        if (!form.title) return
        setSaving(true)
        const slug = form.slug || generateSlug(form.title)
        
        const tagsArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        
        const payload = {
            title: form.title,
            slug,
            excerpt: form.excerpt,
            content: form.content,
            cover_image: form.cover_image,
            category: form.category,
            is_published: form.is_published,
            tags: tagsArray,
            author: 'Retour Gagnant'
        }

        const { error } = await supabase.from('blog_posts').insert(payload)
        if (error) {
            alert(`Erreur lors de la création de l'article : ${error.message}`)
            setSaving(false)
            return
        }

        setCreating(false)
        resetForm()
        fetchPosts()
        setSaving(false)
    }

    const handleUpdate = async () => {
        if (!editing) return
        setSaving(true)
        
        const tagsArray = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
        
        const payload = {
            title: form.title,
            slug: form.slug,
            excerpt: form.excerpt,
            content: form.content,
            cover_image: form.cover_image,
            category: form.category,
            is_published: form.is_published,
            tags: tagsArray,
            updated_at: new Date().toISOString(),
        }

        const { error } = await supabase.from('blog_posts').update(payload).eq('id', editing.id)
        if (error) {
            alert(`Erreur lors de la mise à jour de l'article : ${error.message}`)
            setSaving(false)
            return
        }

        setEditing(null)
        resetForm()
        fetchPosts()
        setSaving(false)
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
        setAutoSlug(false)
        setForm({
            title: post.title || '',
            slug: post.slug || '',
            excerpt: post.excerpt || '',
            content: post.content || '',
            cover_image: post.cover_image || '',
            category: post.category || 'general',
            is_published: !!post.is_published,
            meta_title: post.meta_title || '',
            meta_description: post.meta_description || '',
            tags: Array.isArray(post.tags) ? (post.tags as string[]).join(', ') : (post.tags || ''),
        })
        setActiveTab('write')
        setUndoStack([])
        setRedoStack([])
    }

    const resetForm = () => {
        setForm({
            title: '', slug: '', excerpt: '', content: '',
            cover_image: '', category: 'general', is_published: false,
            meta_title: '', meta_description: '', tags: '',
        })
        setAutoSlug(true)
        setUndoStack([])
        setRedoStack([])
        setShowSEO(false)
        setShowMediaPanel(false)
        setFullscreen(false)
    }

    const filtered = posts.filter(p => {
        const s = search.toLowerCase()
        const title = (p.title || '').toLowerCase()
        const cat = (p.category || '').toLowerCase()
        return title.includes(s) || cat.includes(s)
    })

    // Simple Markdown to HTML converter for preview
    const renderMarkdown = (text: string): string => {
        if (!text) return '<p class="text-gray-500 italic">Aucun contenu à prévisualiser...</p>'

        let html = text
            // Escape HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        // Restore HTML video tags
        html = html.replace(/&lt;video src="([^"]*)" controls width="100%"&gt;&lt;\/video&gt;/g,
            '<video src="$1" controls style="width:100%;border-radius:12px;margin:16px 0"></video>')

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.1em;font-weight:800;color:white;margin:20px 0 8px">$1</h3>')
        html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.3em;font-weight:800;color:white;margin:24px 0 10px">$1</h2>')
        html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.6em;font-weight:900;color:white;margin:28px 0 12px">$1</h1>')

        // Horizontal rule
        html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">')

        // Bold & Italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:white;font-weight:700">$1</strong>')
        html = html.replace(/\*(.+?)\*/g, '<em style="color:#d1d5db">$1</em>')

        // Code
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.85em;color:#FCD116">$1</code>')

        // Blockquotes
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #008751;padding:8px 16px;margin:12px 0;background:rgba(0,135,81,0.05);border-radius:0 8px 8px 0;color:#9ca3af">$1</blockquote>')

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="width:100%;border-radius:12px;margin:16px 0">')

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#FCD116;text-decoration:underline">$1</a>')

        // Unordered lists
        html = html.replace(/^- (.+)$/gm, '<li style="color:#d1d5db;margin:4px 0;padding-left:8px">$1</li>')

        // Ordered lists
        html = html.replace(/^\d+\. (.+)$/gm, '<li style="color:#d1d5db;margin:4px 0;padding-left:8px;list-style:decimal">$1</li>')

        // Paragraphs
        html = html.replace(/\n\n/g, '</p><p style="color:#9ca3af;line-height:1.7;margin:12px 0">')
        html = '<p style="color:#9ca3af;line-height:1.7;margin:12px 0">' + html + '</p>'

        return html
    }

    // ───────────── EDITOR VIEW ─────────────
    if (editing || creating) {
        return (
            <div className={`min-h-screen bg-[#0a0f14] ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
                {/* Top bar */}
                <div className="sticky top-0 z-40 bg-[#0a0f14]/95 backdrop-blur-xl border-b border-white/5">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                        <button
                            onClick={() => { setEditing(null); setCreating(false); resetForm() }}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                        >
                            <ArrowLeft size={16} /> <T>Retour</T>
                        </button>

                        <div className="flex items-center gap-2">
                            {/* Word count & reading time */}
                            <div className="hidden sm:flex items-center gap-3 text-[10px] text-gray-600 mr-2">
                                <span className="flex items-center gap-1"><Type size={10} /> {readingTime.words} <T>mots</T></span>
                                <span className="flex items-center gap-1"><Clock size={10} /> {readingTime.minutes} min</span>
                            </div>

                            <button
                                onClick={() => setFullscreen(!fullscreen)}
                                className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all"
                                title={fullscreen ? 'Réduire' : 'Plein écran'}
                            >
                                {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>

                            <button
                                onClick={editing ? handleUpdate : handleCreate}
                                disabled={saving || !form.title}
                                className="bg-gradient-to-r from-emerald-500 to-[#008751] hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-40 text-white font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {editing ? 'Mettre à jour' : 'Publier'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* ── LEFT: Main Editor ── */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Title */}
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => {
                                    const title = e.target.value
                                    setForm(f => ({
                                        ...f,
                                        title,
                                        slug: autoSlug ? generateSlug(title) : f.slug,
                                    }))
                                }}
                                className="w-full bg-transparent text-white text-2xl sm:text-3xl font-black focus:outline-none placeholder:text-gray-700"
                                placeholder={t("Titre de l'article...")}
                            />

                            {/* Excerpt */}
                            <textarea
                                rows={2}
                                value={form.excerpt}
                                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                                className="w-full bg-transparent text-gray-400 text-sm focus:outline-none resize-none placeholder:text-gray-700 border-b border-white/5 pb-4"
                                placeholder={t("Résumé / chapeau de l'article...")}
                            />

                            {/* Cover Image Upload */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                    <ImageIcon size={12} /> <T>Image de couverture</T>
                                </label>
                                <MediaUpload
                                    value={form.cover_image}
                                    onChange={(url) => setForm({ ...form, cover_image: url })}
                                    bucket="blog-assets"
                                    folder="covers"
                                    accept="image"
                                    maxSizeMB={10}
                                />
                            </div>

                            {/* Editor Tabs */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                {/* Tab header */}
                                <div className="flex items-center justify-between border-b border-white/5 px-4">
                                    <div className="flex items-center gap-0">
                                        <button
                                            onClick={() => setActiveTab('write')}
                                            className={`px-4 py-3 text-xs font-bold transition-all relative ${activeTab === 'write'
                                                    ? 'text-white'
                                                    : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <Edit3 size={13} /> <T>Écrire</T>
                                            </div>
                                            {activeTab === 'write' && (
                                                <motion.div
                                                    layoutId="tab-indicator"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-[#FCD116]"
                                                />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('preview')}
                                            className={`px-4 py-3 text-xs font-bold transition-all relative ${activeTab === 'preview'
                                                    ? 'text-white'
                                                    : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <Eye size={13} /> <T>Aperçu</T>
                                            </div>
                                            {activeTab === 'preview' && (
                                                <motion.div
                                                    layoutId="tab-indicator"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-[#FCD116]"
                                                />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Toolbar (only in write mode) */}
                                {activeTab === 'write' && (
                                    <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-white/5 bg-white/[0.01]">
                                        {/* Undo/Redo */}
                                        <button
                                            onClick={undo}
                                            disabled={undoStack.length === 0}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
                                            title="Annuler"
                                        >
                                            <Undo2 size={14} />
                                        </button>
                                        <button
                                            onClick={redo}
                                            disabled={redoStack.length === 0}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
                                            title="Rétablir"
                                        >
                                            <Redo2 size={14} />
                                        </button>

                                        <div className="w-px h-5 bg-white/5 mx-1" />

                                        {toolbarActions.map((action, i) => {
                                            if (action === 'separator') {
                                                return <div key={`sep-${i}`} className="w-px h-5 bg-white/5 mx-1" />
                                            }
                                            return (
                                                <button
                                                    key={action.label}
                                                    onClick={() => insertMarkdown(action.prefix, action.suffix, action.block)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                                                    title={action.label}
                                                >
                                                    {action.icon}
                                                </button>
                                            )
                                        })}

                                        <div className="w-px h-5 bg-white/5 mx-1" />

                                        {/* Media insert buttons */}
                                        <button
                                            onClick={() => setShowMediaPanel(!showMediaPanel)}
                                            className={`p-1.5 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold ${showMediaPanel ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white hover:bg-white/5'
                                                }`}
                                            title="Insérer média"
                                        >
                                            <ImageIcon size={14} />
                                            <Film size={14} />
                                        </button>
                                    </div>
                                )}

                                {/* Media insertion panel */}
                                <AnimatePresence>
                                    {showMediaPanel && activeTab === 'write' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-b border-white/5"
                                        >
                                            <div className="p-4 bg-white/[0.02] space-y-3">
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                    <T>Insérer un média dans le contenu</T>
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <MediaUpload
                                                        value=""
                                                        onChange={insertMediaInContent}
                                                        bucket="blog-assets"
                                                        folder="content"
                                                        accept="image"
                                                        maxSizeMB={10}
                                                        label="📷 Image"
                                                    />
                                                    <MediaUpload
                                                        value=""
                                                        onChange={insertMediaInContent}
                                                        bucket="blog-assets"
                                                        folder="content"
                                                        accept="video"
                                                        maxSizeMB={50}
                                                        label="🎬 Vidéo"
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Content area */}
                                <div className="relative">
                                    {activeTab === 'write' ? (
                                        <textarea
                                            ref={contentRef}
                                            rows={fullscreen ? 30 : 20}
                                            value={form.content}
                                            onChange={(e) => setForm({ ...form, content: e.target.value })}
                                            onKeyDown={(e) => {
                                                // Ctrl+B = bold, Ctrl+I = italic
                                                if (e.ctrlKey || e.metaKey) {
                                                    if (e.key === 'b') {
                                                        e.preventDefault()
                                                        insertMarkdown('**', '**')
                                                    } else if (e.key === 'i') {
                                                        e.preventDefault()
                                                        insertMarkdown('*', '*')
                                                    } else if (e.key === 'z') {
                                                        e.preventDefault()
                                                        undo()
                                                    } else if (e.key === 'y') {
                                                        e.preventDefault()
                                                        redo()
                                                    }
                                                }
                                                // Tab -> insert 4 spaces
                                                if (e.key === 'Tab') {
                                                    e.preventDefault()
                                                    insertMarkdown('    ', '')
                                                }
                                            }}
                                            onBlur={pushUndo}
                                            className="w-full bg-transparent py-4 px-5 text-white text-sm focus:outline-none resize-none font-mono leading-relaxed"
                                            placeholder={t("Commencez à écrire votre article...\n\n# Titre principal\n\nVotre contenu ici. Utilisez la barre d'outils pour formater le texte, insérer des images et vidéos.")}
                                        />
                                    ) : (
                                        <div
                                            className="prose prose-invert max-w-none py-4 px-5 min-h-[400px]"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT: Sidebar ── */}
                        <div className="space-y-4">
                            {/* Status */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Sparkles size={12} /> <T>Publication</T>
                                </h3>
                                <label onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))} className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`relative w-10 h-5 rounded-full transition-colors ${form.is_published ? 'bg-emerald-500' : 'bg-white/10'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_published ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                                        {form.is_published ? <T>Publié</T> : <T>Brouillon</T>}
                                    </span>
                                </label>
                            </div>

                            {/* Category */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Globe2 size={12} /> <T>Catégorie</T>
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {CATEGORIES.map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => setForm({ ...form, category: c.value })}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${form.category === c.value
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-white/5 text-gray-400 border border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <span>{c.icon}</span> {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Slug */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Link2 size={12} /> <T>URL (Slug)</T>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={form.slug}
                                        onChange={(e) => {
                                            setAutoSlug(false)
                                            setForm({ ...form, slug: e.target.value })
                                        }}
                                        className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/30 font-mono"
                                        placeholder="url-de-l-article"
                                    />
                                </div>
                                <p className="text-[9px] text-gray-600 mt-2">
                                    /blog/{form.slug || 'url-de-l-article'}
                                </p>
                            </div>

                            {/* Tags */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Tag size={12} /> <T>Tags</T>
                                </h3>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20"
                                        >
                                            {tag}
                                            <button onClick={() => removeTag(i)} className="hover:text-white transition-colors" title="Supprimer le tag" aria-label="Supprimer le tag">
                                                <X size={10} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); addTag() }
                                        }}
                                        className="flex-1 bg-white/5 border border-white/5 rounded-xl py-2 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/30"
                                        placeholder={t("Ajouter un tag...")}
                                    />
                                    <button
                                        onClick={addTag}
                                        className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                        title="Ajouter un tag"
                                        aria-label="Ajouter un tag"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* SEO */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                <button
                                    onClick={() => setShowSEO(!showSEO)}
                                    className="w-full flex items-center justify-between p-4 text-left"
                                >
                                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <FileText size={12} /> <T>SEO & Métadonnées</T>
                                    </h3>
                                    <ChevronDown size={14} className={`text-gray-500 transition-transform ${showSEO ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showSEO && (
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: 'auto' }}
                                            exit={{ height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 space-y-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-600 mb-1 block"><T>Meta titre</T></label>
                                                    <input
                                                        type="text"
                                                        value={form.meta_title}
                                                        onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/30"
                                                        placeholder={form.title || t("Titre pour les moteurs de recherche")}
                                                    />
                                                    <p className="text-[9px] text-gray-600 mt-1">{(form.meta_title || form.title).length}/60</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-600 mb-1 block"><T>Meta description</T></label>
                                                    <textarea
                                                        rows={3}
                                                        value={form.meta_description}
                                                        onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                                                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 px-3 text-white text-xs focus:outline-none focus:border-emerald-500/30 resize-none"
                                                        placeholder={form.excerpt || t("Description pour les moteurs de recherche...")}
                                                    />
                                                    <p className="text-[9px] text-gray-600 mt-1">{(form.meta_description || form.excerpt).length}/160</p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Reading Stats */}
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <AlignLeft size={12} /> <T>Statistiques</T>
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-white">{readingTime.words}</p>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase"><T>Mots</T></p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-white">{readingTime.minutes}</p>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase"><T>Min lecture</T></p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-white">{(form.content || '').split('\n').length}</p>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase"><T>Lignes</T></p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-white">{((form.content || '').match(/!\[/g) || []).length}</p>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase"><T>Médias</T></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ───────────── POST LIST VIEW ─────────────
    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Gestion</T></span>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2">
                            <BookOpen size={22} className="text-emerald-400" /> Blog
                        </h1>
                        <p className="text-xs text-gray-500 mt-1">{posts.length} <T>articles</T></p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 bg-white/5 rounded-xl p-0.5">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                                title="Vue liste"
                                aria-label="Vue liste"
                            >
                                <LayoutList size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-500'}`}
                                title="Vue grille"
                                aria-label="Vue grille"
                            >
                                <LayoutGrid size={14} />
                            </button>
                        </div>
                        <button
                            onClick={() => { setCreating(true); setAutoSlug(true); resetForm() }}
                            className="bg-gradient-to-r from-emerald-500 to-[#008751] hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            <Plus size={16} /> <T>Nouvel Article</T>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("Rechercher par titre ou catégorie...")}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                    />
                </div>

                {/* Posts */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                            <BookOpen size={28} className="text-gray-600" />
                        </div>
                        <p className="text-gray-400 font-bold mb-1"><T>Aucun article</T></p>
                        <p className="text-xs text-gray-600"><T>Créez votre premier article de blog</T></p>
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filtered.map((post, i) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all group"
                            >
                                {/* Cover */}
                                <div className="relative h-36 bg-gradient-to-br from-emerald-900/30 to-gray-900">
                                    {post.cover_image && (
                                        <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                                    )}
                                    <div className="absolute top-2 right-2 flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${post.is_published ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                    </div>
                                    <div className="absolute bottom-2 left-2">
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/60 text-gray-300">
                                            {CATEGORIES.find(c => c.value === post.category)?.icon} {post.category}
                                        </span>
                                    </div>
                                </div>
                                {/* Content */}
                                <div className="p-4">
                                    <p className="text-sm font-bold text-white truncate mb-1">{post.title || 'Sans titre'}</p>
                                    <p className="text-[10px] text-gray-500 line-clamp-2 mb-3">{post.excerpt || ''}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                            <Calendar size={10} /> {formatDateSafe(post.created_at)}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => togglePublish(post)} className={`p-1.5 rounded-lg transition-all ${post.is_published ? 'text-emerald-400' : 'text-gray-600'}`} title={post.is_published ? 'Dépublier' : 'Publier'} aria-label={post.is_published ? 'Dépublier' : 'Publier'}>
                                                {post.is_published ? <Eye size={12} /> : <EyeOff size={12} />}
                                            </button>
                                            <button onClick={() => startEdit(post)} className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-all" title="Modifier" aria-label="Modifier l'article">
                                                <Edit3 size={12} />
                                            </button>
                                            <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 transition-all" title="Supprimer" aria-label="Supprimer l'article">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-3">
                        {filtered.map((post, i) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-white/10 transition-all group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {/* Cover thumbnail */}
                                    {post.cover_image && (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/5 hidden sm:block">
                                            <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${post.is_published ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-white truncate">{post.title || 'Sans titre'}</p>
                                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                {CATEGORIES.find(c => c.value === post.category)?.icon} {post.category}
                                            </span>
                                            <span className="flex items-center gap-1"><Eye size={10} /> {post.views}</span>
                                            <span className="flex items-center gap-1"><Calendar size={10} /> {formatDateSafe(post.created_at)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <button onClick={() => togglePublish(post)} className={`p-2 rounded-lg transition-all ${post.is_published ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-500'}`} title={post.is_published ? 'Dépublier' : 'Publier'}>
                                        {post.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                    <button onClick={() => startEdit(post)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all" title="Modifier" aria-label="Modifier l'article"><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(post.id)} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 transition-all" title="Supprimer" aria-label="Supprimer l'article"><Trash2 size={14} /></button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
