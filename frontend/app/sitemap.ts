import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'https://www.retourgagnantbenin.bj'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
        { url: `${BASE_URL}/services`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
        { url: `${BASE_URL}/a-propos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${BASE_URL}/rendez-vous`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
        { url: `${BASE_URL}/simulateur`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${BASE_URL}/notre-histoire`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
        { url: `${BASE_URL}/evenements`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
        { url: `${BASE_URL}/boutique`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
        { url: `${BASE_URL}/partenaires`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${BASE_URL}/nationalite`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${BASE_URL}/suivi-dossier`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${BASE_URL}/mentions-legales`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE_URL}/confidentialite`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE_URL}/conditions-generales`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ]

    // Service detail pages
    const servicesSlugs = [
        'passeport', 'logement', 'business', 'culture',
        'construction', 'investissement', 'nationalite-vip',
        'recherche-ancestrale', 'autres',
    ]
    const servicePages: MetadataRoute.Sitemap = servicesSlugs.map(slug => ({
        url: `${BASE_URL}/services/${slug}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }))

    // Blog posts (dynamic)
    let blogPages: MetadataRoute.Sitemap = []
    try {
        const { data: posts } = await supabase
            .from('blog_posts')
            .select('slug, updated_at, created_at')
            .eq('is_published', true)
            .order('created_at', { ascending: false })

        if (posts) {
            blogPages = posts.map(post => ({
                url: `${BASE_URL}/blog/${post.slug}`,
                lastModified: new Date(post.updated_at || post.created_at),
                changeFrequency: 'monthly' as const,
                priority: 0.6,
            }))
        }
    } catch {
        // Silently fail : static pages still generated
    }

    return [...staticPages, ...servicePages, ...blogPages]
}
