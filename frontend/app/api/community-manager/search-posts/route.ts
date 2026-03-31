import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const serperApiKeys = [
    process.env.SERPER_API_KEY_1,
    process.env.SERPER_API_KEY_2,
    process.env.SERPER_API_KEY_3,
    process.env.SERPER_API_KEY,
].filter(Boolean) as string[]

const PLATFORM_SITE_MAP: Record<string, string> = {
    facebook:    'site:facebook.com',
    instagram:   'site:instagram.com',
    tiktok:      'site:tiktok.com',
    linkedin:    'site:linkedin.com',
    twitter:     'site:twitter.com OR site:x.com',
    google_maps: 'site:google.com/maps OR site:goo.gl/maps',
    all: '',
}

async function callSerperSearch(query: string, num = 10): Promise<unknown[]> {
    const shuffled = [...serperApiKeys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const res = await axios.post(
                'https://google.serper.dev/search',
                { q: query, gl: 'bj', hl: 'fr', num },
                {
                    headers: { 'X-API-KEY': shuffled[i], 'Content-Type': 'application/json' },
                    timeout: 15000,
                }
            )
            return res.data.organic || []
        } catch (err) {
            console.warn(`[search-posts] Serper key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) return []
        }
    }
    return []
}

function estimateEngagement(snippet: string): string {
    const text = snippet?.toLowerCase() || ''
    if (text.includes('viral') || text.includes('million') || text.includes('millions')) return 'viral'
    if (text.includes('k') || text.includes('millier') || text.includes('partage')) return 'élevé'
    if (text.includes('réaction') || text.includes('commentaire') || text.includes('like')) return 'moyen'
    return 'inconnu'
}

// POST /api/community-manager/search-posts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { keywords, platform = 'all', profile_url, num = 10 } = body

        if (!keywords?.trim() && !profile_url?.trim()) {
            return NextResponse.json(
                { error: 'Veuillez fournir des mots-clés ou une URL de profil.' },
                { status: 400 }
            )
        }

        const siteFilter = PLATFORM_SITE_MAP[platform] || ''

        // Construire la requête Serper
        let query = ''
        if (profile_url) {
            // Extraire le username de l'URL
            const urlParts = profile_url.replace(/\/$/, '').split('/')
            const username = urlParts[urlParts.length - 1]
            query = `${siteFilter} ${username} ${keywords || 'publication post'}`.trim()
        } else {
            query = `${siteFilter} ${keywords} Bénin OR Benin OR Afrique`.trim()
        }

        const results = await callSerperSearch(query, Math.min(num, 20))

        const posts = (results as Array<{ title?: string; link?: string; snippet?: string; date?: string }>).map((item) => ({
            title: item.title || '',
            url: item.link || '',
            snippet: item.snippet || '',
            date: item.date || '',
            platform: platform !== 'all' ? platform : detectPlatformFromUrl(item.link || ''),
            engagement_estimate: estimateEngagement(item.snippet || ''),
        }))

        return NextResponse.json({ success: true, posts, query, total: posts.length })
    } catch (err) {
        console.error('[search-posts] Error:', err)
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

function detectPlatformFromUrl(url: string): string {
    if (url.includes('facebook.com')) return 'facebook'
    if (url.includes('instagram.com')) return 'instagram'
    if (url.includes('tiktok.com')) return 'tiktok'
    if (url.includes('linkedin.com')) return 'linkedin'
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter'
    if (url.includes('google.com/maps') || url.includes('maps.google') || url.includes('goo.gl/maps')) return 'google_maps'
    return 'web'
}
