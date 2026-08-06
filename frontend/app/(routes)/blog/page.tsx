'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen, MagnifyingGlass as Search, Clock, ArrowRight, Eye, TrendUp as TrendingUp, Buildings as Building2, Globe as Globe2, Briefcase, Bank as Landmark } from '@phosphor-icons/react';
import { useTranslation, T } from '@/lib/translation'

interface BlogPost {
    id: string
    title: string
    slug: string
    excerpt: string
    cover_image: string
    category: string
    author: string
    views: number
    created_at: string
}

const CATEGORIES = [
    { key: 'all', label: 'Tous', icon: BookOpen },
    { key: 'citoyennete', label: 'Citoyenneté', icon: Landmark },
    { key: 'investissement', label: 'Investissement', icon: TrendingUp },
    { key: 'immobilier', label: 'Immobilier', icon: Building2 },
    { key: 'culture', label: 'Culture', icon: Globe2 },
    { key: 'business', label: 'Business', icon: Briefcase },
]

export default function BlogPage() {
    const { t } = useTranslation()
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('all')
    const [page, setPage] = useState(1)
    const POSTS_PER_PAGE = 9

    useEffect(() => {
        const fetchPosts = async () => {
            const { data } = await supabase
                .from('blog_posts')
                .select('id, title, slug, excerpt, cover_image, category, author, views, created_at')
                .eq('is_published', true)
                .order('created_at', { ascending: false })

            setPosts((data || []) as BlogPost[])
            setLoading(false)
        }
        fetchPosts()
    }, [])

    const filtered = posts.filter(p => {
        const s = search.toLowerCase()
        const matchSearch = (p.title || '').toLowerCase().includes(s) ||
            (p.excerpt || '').toLowerCase().includes(s)
        const matchCat = category === 'all' || p.category === category
        return matchSearch && matchCat
    })

    // Reset page when search/category changes
    useEffect(() => { setPage(1) }, [search, category])

    const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE))
    const paginated = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

    return (
        <div className="min-h-screen bg-[#fafbfc]">
            {/* Hero */}
            <section className="relative py-20 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="max-w-6xl mx-auto relative z-10 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.4em] flex items-center justify-center gap-2 mb-4">
                            <BookOpen size={14} /> <T>Centre de Ressources</T>
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
                            <T>Le</T> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-amber-500"><T>Blog</T></span>
                        </h1>
                        <p className="text-slate-600 max-w-xl mx-auto text-sm md:text-base">
                            <T>Guides, conseils et actualités pour réussir votre retour au Bénin</T>
                        </p>
                    </motion.div>

                    {/* Search */}
                    <div className="mt-8 max-w-md mx-auto relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("Rechercher un article...")}
                            className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                        />
                    </div>

                    {/* Categories */}
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setCategory(cat.key)}
                                className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 border shadow-sm ${category === cat.key
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <cat.icon size={12} /> {t(cat.label)}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Posts Grid */}
            <section className="max-w-6xl mx-auto px-4 pb-20">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <BookOpen className="mx-auto mb-3 text-slate-200" size={40} />
                        <p className="text-sm"><T>Aucun article trouvé</T></p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {paginated.map((post, i) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link href={`/blog/${post.slug}`} className="group block">
                                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:border-emerald-500/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-all duration-300">
                                            {/* Cover */}
                                            <div className="relative h-48 overflow-hidden bg-slate-50">
                                                {post.cover_image ? (
                                                    <Image
                                                        src={post.cover_image}
                                                        alt={post.title}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-yellow-500/10 flex items-center justify-center">
                                                        <BookOpen size={40} className="text-emerald-500/20" />
                                                    </div>
                                                )}
                                                <div className="absolute top-3 left-3">
                                                    <span className="text-[10px] font-bold uppercase bg-white/90 backdrop-blur-md text-emerald-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                                                        {t(post.category)}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Content */}
                                            <div className="p-5">
                                                <h2 className="text-base font-bold text-slate-800 group-hover:text-emerald-600 transition-colors line-clamp-2 mb-2">{t(post.title)}</h2>
                                                <p className="text-xs text-slate-500 line-clamp-3 mb-4">{t(post.excerpt)}</p>
                                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    <span className="flex items-center gap-1"><Eye size={10} /> {post.views} {t("vues")}</span>
                                                </div>
                                                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-600 group-hover:gap-2 transition-all">
                                                    <T>Lire l&apos;article</T> <ArrowRight size={12} />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 mt-12">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    ← {t("Précédent")}
                                </button>
                                <span className="text-xs text-slate-500 font-medium">
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="text-xs font-bold px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    {t("Suivant")} →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    )
}
