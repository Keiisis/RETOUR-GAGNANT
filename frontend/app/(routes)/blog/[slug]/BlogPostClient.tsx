'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Clock, Eye, BookOpen, Tag } from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'
import ShareButtons from '@/components/blog/ShareButtons'

interface BlogPost {
    id: string
    title: string
    slug: string
    excerpt: string
    content: string
    cover_image: string
    category: string
    author: string
    views: number
    created_at: string
    tags: string[]
}

export default function BlogPostClient({ slug }: { slug: string }) {
    const { t } = useTranslation()
    const [post, setPost] = useState<BlogPost | null>(null)
    const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!slug) return
        const fetchPost = async () => {
            const { data } = await supabase
                .from('blog_posts')
                .select('*')
                .eq('slug', slug)
                .eq('is_published', true)
                .single()

            if (data) {
                setPost(data as BlogPost)
                // Increment views using our server-side API route
                try {
                    const res = await fetch('/api/blog/views', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ id: data.id }),
                    })
                    const viewsData = await res.json()
                    if (viewsData.success) {
                        setPost(prev => prev ? { ...prev, views: viewsData.views } : null)
                    }
                } catch (err) {
                    console.error('Failed to increment views:', err)
                }

                // Fetch related posts by category
                try {
                    const { data: related } = await supabase
                        .from('blog_posts')
                        .select('id, title, slug, excerpt, cover_image, category, created_at')
                        .eq('is_published', true)
                        .eq('category', data.category)
                        .neq('id', data.id)
                        .order('created_at', { ascending: false })
                        .limit(3)
                    if (related) setRelatedPosts(related as BlogPost[])
                } catch {
                    // silently fail
                }
            }
            setLoading(false)
        }
        fetchPost()
    }, [slug])

    const formatDate = (val: string) => {
        if (!mounted || !val) return '—'
        const d = new Date(val)
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    }

    // Markdown to HTML renderer
    const renderMarkdown = (text: string): string => {
        if (!text) return ''

        let html = text

        // Restore HTML video tags before escaping
        const videoPlaceholders: string[] = []
        html = html.replace(/<video[^>]*>.*?<\/video>/gi, (match) => {
            videoPlaceholders.push(match)
            return `__VIDEO_${videoPlaceholders.length - 1}__`
        })

        // Escape HTML
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        // Restore video placeholders
        videoPlaceholders.forEach((v, i) => {
            html = html.replace(`__VIDEO_${i}__`, v)
        })

        // Headers (process in order: h3, h2, h1)
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')

        // Horizontal rule
        html = html.replace(/^---$/gm, '<hr />')

        // Bold & Italic (order matters)
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

        // Code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

        // Blockquotes
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="width:100%;border-radius:12px;margin:16px 0" loading="lazy" />')

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

        // Ordered lists
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li value="$1">$2</li>')

        // Unordered lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>')

        // Wrap consecutive <li> in <ul>
        html = html.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, (match) => {
            const isOrdered = match.includes('value=')
            return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`
        })

        // Paragraphs - wrap remaining text lines
        html = html.replace(/\n\n/g, '</p><p>')
        html = '<p>' + html + '</p>'
        html = html.replace(/<p><\/p>/g, '')
        html = html.replace(/<p>(<h[123]>)/g, '$1')
        html = html.replace(/(<\/h[123]>)<\/p>/g, '$1')
        html = html.replace(/<p>(<hr \/>)<\/p>/g, '$1')
        html = html.replace(/<p>(<ul>)/g, '$1')
        html = html.replace(/(<\/ul>)<\/p>/g, '$1')
        html = html.replace(/<p>(<ol>)/g, '$1')
        html = html.replace(/(<\/ol>)<\/p>/g, '$1')
        html = html.replace(/<p>(<blockquote>)/g, '$1')
        html = html.replace(/(<\/blockquote>)<\/p>/g, '$1')

        return html
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        )
    }

    if (!post) {
        return (
            <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center text-slate-800 text-center p-8">
                <div>
                    <BookOpen className="mx-auto mb-4 text-slate-300" size={48} />
                    <h1 className="text-2xl font-bold mb-2"><T>Article introuvable</T></h1>
                    <Link href="/blog" className="text-emerald-600 text-sm hover:underline">← <T>Retour au blog</T></Link>
                </div>
            </div>
        )
    }

    const postTags = Array.isArray(post.tags) ? post.tags : []
    const readingTime = Math.max(1, Math.ceil((post.content || '').split(/\s+/).length / 200))

    return (
        <div className="min-h-screen bg-[#fafbfc]">
            {/* Hero Cover with blurred background to prevent cutouts and object-contain to avoid cropping */}
            <div className="relative h-64 md:h-[450px] w-full bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
                {post.cover_image && (
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-2xl opacity-15 scale-105"
                        style={{ backgroundImage: `url(${post.cover_image})` }}
                    />
                )}
                {post.cover_image ? (
                    <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center p-4 z-10">
                        <img
                            src={post.cover_image}
                            alt={post.title || ''}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                            style={{ width: 'auto', height: 'auto' }}
                        />
                    </div>
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-yellow-500/10 flex items-center justify-center">
                        <BookOpen size={48} className="text-emerald-500/20" />
                    </div>
                )}
                {/* Back button */}
                <div className="absolute top-4 left-4 z-20">
                    <Link href="/blog" className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-full border border-slate-200 shadow-sm transition-all hover:scale-105 hover:bg-white">
                        <ArrowLeft size={14} /> <T>Blog</T>
                    </Link>
                </div>
            </div>

            {/* Article Content */}
            <article className="max-w-3xl mx-auto px-4 pt-10 relative z-10 pb-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full">
                        {t(post.category || 'Général')}
                    </span>

                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-4 mb-4 leading-tight">{post.title}</h1>

                    {post.excerpt && (
                        <p className="text-base text-slate-600 mb-6 leading-relaxed italic border-l-2 border-emerald-500 pl-4 bg-slate-50/50 py-1.5 pr-2">
                            {post.excerpt}
                        </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-8 pb-6 border-b border-slate-100 flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(post.created_at)}</span>
                        <span className="flex items-center gap-1"><Eye size={12} /> {post.views} {t("vues")}</span>
                        <span className="flex items-center gap-1"><Clock size={12} /> {readingTime} min {t("de lecture")}</span>
                        <span>{t("Par")} {post.author || 'Retour Gagnant'}</span>
                    </div>

                    {/* Share Buttons */}
                    <div className="mb-8">
                        <ShareButtons
                            url={typeof window !== 'undefined' ? window.location.href : `https://www.retourgagnantbenin.bj/blog/${slug}`}
                            title={post.title}
                        />
                    </div>

                    {/* Article body */}
                    <div
                        className="prose prose-emerald max-w-none
                            prose-headings:font-black prose-headings:text-slate-900
                            prose-h1:text-2xl prose-h1:mt-8 prose-h1:mb-4
                            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-l-2 prose-h2:border-emerald-500 prose-h2:pl-4
                            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                            prose-p:text-slate-700 prose-p:leading-relaxed prose-p:text-[15px]
                            prose-li:text-slate-700 prose-li:text-[15px]
                            prose-strong:text-slate-900 prose-strong:font-bold
                            prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
                            prose-hr:border-slate-100
                            prose-em:text-slate-500
                            prose-blockquote:border-l-emerald-500 prose-blockquote:bg-emerald-500/5 prose-blockquote:rounded-r-xl prose-blockquote:py-2 prose-blockquote:px-4
                            prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-amber-700
                            prose-img:rounded-2xl"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content || '') }}
                    />

                    {/* Tags */}
                    {postTags.length > 0 && (
                        <div className="mt-10 pt-6 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Tag size={14} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"><T>Tags</T></span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {postTags.map((tag, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100/50 transition-colors"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related Articles */}
                    {relatedPosts.length > 0 && (
                        <div className="mt-12 pt-8 border-t border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <BookOpen size={18} className="text-emerald-600" />
                                <T>Articles similaires</T>
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {relatedPosts.map((rp) => (
                                    <Link
                                        key={rp.id}
                                        href={`/blog/${rp.slug}`}
                                        className="group bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-all"
                                    >
                                        <div className="h-28 relative bg-slate-50 overflow-hidden">
                                            {rp.cover_image ? (
                                                <img
                                                    src={rp.cover_image}
                                                    alt={rp.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-yellow-50 flex items-center justify-center">
                                                    <BookOpen size={24} className="text-emerald-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                {rp.category}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-800 mt-2 line-clamp-2 group-hover:text-emerald-700 transition-colors">
                                                {rp.title}
                                            </h4>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    <div className="mt-12 p-6 bg-gradient-to-br from-emerald-50/50 to-amber-50/50 border border-emerald-100/40 rounded-2xl text-center">
                        <h3 className="text-lg font-bold text-slate-800 mb-2"><T>Prêt à passer à l&apos;action ?</T></h3>
                        <p className="text-sm text-slate-500 mb-4"><T>Notre équipe vous accompagne dans chaque étape de votre projet.</T></p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Link href="/rendez-vous" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-sm">
                                <T>Prendre rendez-vous</T>
                            </Link>
                            <Link href="/contact" className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm px-6 py-3 rounded-xl border border-slate-200 shadow-sm transition-all">
                                <T>Nous contacter</T>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </article>
        </div>
    )
}
