import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import BlogPostClient from './BlogPostClient'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getPost(slug: string) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single()
    return data
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>
}): Promise<Metadata> {
    const { slug } = await params
    const post = await getPost(slug)

    if (!post) {
        return {
            title: 'Article introuvable | Retour Gagnant Bénin',
            description: 'Cet article n\'existe pas ou a été supprimé.',
        }
    }

    const title = post.title || 'Article | Retour Gagnant Bénin'
    const description = post.excerpt || (post.content || '').substring(0, 160).replace(/[#*_\n]/g, '')
    const image = post.cover_image || 'https://www.retourgagnantbenin.bj/og-image.jpg'
    const url = `https://www.retourgagnantbenin.bj/blog/${post.slug}`
    const tags = Array.isArray(post.tags) ? post.tags : []

    return {
        title: `${title} | Retour Gagnant Bénin`,
        description,
        keywords: tags.join(', '),
        authors: [{ name: post.author || 'Retour Gagnant Bénin' }],
        openGraph: {
            title,
            description,
            url,
            siteName: 'Retour Gagnant Bénin',
            images: [
                {
                    url: image,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
            locale: 'fr_FR',
            type: 'article',
            publishedTime: post.created_at,
            modifiedTime: post.updated_at,
            authors: [post.author || 'Retour Gagnant Bénin'],
            tags,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
        alternates: {
            canonical: url,
        },
        robots: {
            index: true,
            follow: true,
            'max-snippet': -1,
            'max-image-preview': 'large' as const,
            'max-video-preview': -1,
        },
    }
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    // Generate JSON-LD structured data for SEO
    const post = await getPost(slug)
    const jsonLd = post ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || (post.content || '').substring(0, 160).replace(/[#*_\n]/g, ''),
        image: post.cover_image || 'https://www.retourgagnantbenin.bj/og-image.jpg',
        datePublished: post.created_at,
        dateModified: post.updated_at || post.created_at,
        author: {
            '@type': 'Organization',
            name: post.author || 'Retour Gagnant Bénin',
            url: 'https://www.retourgagnantbenin.bj',
        },
        publisher: {
            '@type': 'Organization',
            name: 'Retour Gagnant Bénin',
            url: 'https://www.retourgagnantbenin.bj',
            logo: {
                '@type': 'ImageObject',
                url: 'https://www.retourgagnantbenin.bj/logo.png',
            },
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://www.retourgagnantbenin.bj/blog/${post.slug}`,
        },
        keywords: Array.isArray(post.tags) ? post.tags.join(', ') : '',
        articleSection: post.category || 'Général',
        inLanguage: 'fr-FR',
    } : null

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <BlogPostClient slug={slug} />
        </>
    )
}
