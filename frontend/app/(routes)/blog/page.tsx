'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import {
    BookOpen, Search, Clock, ArrowRight, Eye,
    TrendingUp, Building2, Globe2, Briefcase, Landmark
} from 'lucide-react'
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
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.excerpt.toLowerCase().includes(search.toLowerCase())
        const matchCat = category === 'all' || p.category === category
        return matchSearch && matchCat
    })

    return (
        <div className="min-h-screen bg-[#0a0f14]">
            {/* Hero */}
            <section className="relative py-20 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-transparent to-transparent" />
                <div className="max-w-6xl mx-auto relative z-10 text-center">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.4em] flex items-center justify-center gap-2 mb-4">
                            <BookOpen size={14} /> <T>Centre de Ressources</T>
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
                            <T>Le</T> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-yellow-400"><T>Blog</T></span>
                        </h1>
                        <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base">
                            <T>Guides, conseils et actualités pour réussir votre retour au Bénin</T>
                        </p>
                    </motion.div>

                    {/* Search */}
                    <div className="mt-8 max-w-md mx-auto relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("Rechercher un article...")}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 text-sm"
                        />
                    </div>

                    {/* Categories */}
                    <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setCategory(cat.key)}
                                className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${category === cat.key
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'
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
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">
                        <BookOpen className="mx-auto mb-3 text-gray-700" size={40} />
                        <p className="text-sm"><T>Aucun article trouvé</T></p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filtered.map((post, i) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Link href={`/blog/${post.slug}`} className="group block">
                                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/30 transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.05)]">
                                        {/* Cover */}
                                        <div className="relative h-48 overflow-hidden">
                                            {post.cover_image ? (
                                                <Image
                                                    src={post.cover_image}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-emerald-900/30 to-yellow-900/30 flex items-center justify-center">
                                                    <BookOpen size={40} className="text-white/20" />
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3">
                                                <span className="text-[10px] font-bold uppercase bg-black/60 backdrop-blur-md text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                    {t(post.category)}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Content */}
                                        <div className="p-5">
                                            <h2 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-2 mb-2">{t(post.title)}</h2>
                                            <p className="text-xs text-gray-500 line-clamp-3 mb-4">{t(post.excerpt)}</p>
                                            <div className="flex items-center justify-between text-[10px] text-gray-600">
                                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span className="flex items-center gap-1"><Eye size={10} /> {post.views} {t("vues")}</span>
                                            </div>
                                            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-400 group-hover:gap-2 transition-all">
                                                <T>Lire l&apos;article</T> <ArrowRight size={12} />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
