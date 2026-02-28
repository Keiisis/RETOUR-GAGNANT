'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Clock, Eye, Share2, BookOpen } from 'lucide-react'

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

export default function BlogPostPage() {
    const params = useParams()
    const slug = params?.slug as string
    const [post, setPost] = useState<BlogPost | null>(null)
    const [loading, setLoading] = useState(true)

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
                // Increment views
                await supabase.from('blog_posts').update({ views: (data.views || 0) + 1 }).eq('id', data.id)
            }
            setLoading(false)
        }
        fetchPost()
    }, [slug])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
        )
    }

    if (!post) {
        return (
            <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center text-white text-center p-8">
                <div>
                    <BookOpen className="mx-auto mb-4 text-gray-600" size={48} />
                    <h1 className="text-2xl font-bold mb-2">Article introuvable</h1>
                    <Link href="/blog" className="text-emerald-400 text-sm hover:underline">← Retour au blog</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0f14]">
            {/* Hero Cover */}
            <div className="relative h-64 md:h-96 overflow-hidden">
                {post.cover_image ? (
                    <Image src={post.cover_image} alt={post.title} fill className="object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 to-yellow-900/40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f14] via-[#0a0f14]/60 to-transparent" />
                <div className="absolute top-4 left-4">
                    <Link href="/blog" className="flex items-center gap-2 text-xs font-bold text-white/70 hover:text-white bg-black/40 backdrop-blur-md px-3 py-2 rounded-full border border-white/10 transition-all">
                        <ArrowLeft size={14} /> Blog
                    </Link>
                </div>
            </div>

            {/* Article Content */}
            <article className="max-w-3xl mx-auto px-4 -mt-20 md:-mt-32 relative z-10 pb-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                        {post.category}
                    </span>

                    <h1 className="text-3xl md:text-4xl font-black text-white mt-4 mb-4 leading-tight">{post.title}</h1>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-8 pb-6 border-b border-white/5">
                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><Eye size={12} /> {post.views} vues</span>
                        <span>Par {post.author}</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(window.location.href)}
                            className="ml-auto flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <Share2 size={12} /> Partager
                        </button>
                    </div>

                    {/* Markdown-like content rendered as HTML */}
                    <div
                        className="prose prose-invert prose-emerald max-w-none
                            prose-headings:font-black prose-headings:text-white
                            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-l-2 prose-h2:border-emerald-500 prose-h2:pl-4
                            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                            prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-sm
                            prose-li:text-gray-300 prose-li:text-sm
                            prose-strong:text-white
                            prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
                            prose-hr:border-white/10
                            prose-em:text-gray-400"
                        dangerouslySetInnerHTML={{
                            __html: post.content
                                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/^- (.*$)/gm, '<li>$1</li>')
                                .replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>')
                                .replace(/^---$/gm, '<hr />')
                                .replace(/\n\n/g, '</p><p>')
                                .replace(/^(?!<[hul]|<li|<hr)(.*)/gm, '<p>$1</p>')
                                .replace(/<p><\/p>/g, '')
                        }}
                    />

                    {/* CTA */}
                    <div className="mt-12 p-6 bg-gradient-to-br from-emerald-900/20 to-yellow-900/20 border border-emerald-500/10 rounded-2xl text-center">
                        <h3 className="text-lg font-bold text-white mb-2">Prêt à passer à l&apos;action ?</h3>
                        <p className="text-sm text-gray-400 mb-4">Notre équipe vous accompagne dans chaque étape de votre projet.</p>
                        <div className="flex flex-wrap gap-3 justify-center">
                            <Link href="/rendez-vous" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all">
                                Prendre rendez-vous
                            </Link>
                            <Link href="/contact" className="bg-white/5 hover:bg-white/10 text-white font-bold text-sm px-6 py-3 rounded-xl border border-white/10 transition-all">
                                Nous contacter
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </article>
        </div>
    )
}
