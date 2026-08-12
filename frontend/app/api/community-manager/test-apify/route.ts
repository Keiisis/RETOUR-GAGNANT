import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

const APIFY_KEYS: string[] = [
    process.env.APIFY_API_KEY_1,
    process.env.APIFY_API_KEY_2,
    process.env.APIFY_API_KEY_3,
].filter(Boolean) as string[]

const ACTORS: Record<string, { actor: string; buildInput: (url: string, username: string) => Record<string, unknown>; timeout: number }> = {
    facebook: {
        actor: 'KoJrdxJCTtpon81KY', // https://console.apify.com/actors/KoJrdxJCTtpon81KY
        buildInput: (url) => ({
            startUrls: [{ url: url.replace(/\/$/, '') }],
            maxPosts: 3,
            maxPostComments: 0,
            proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
        }),
        timeout: 180,
    },
    instagram: {
        actor: 'shu8hvrXbJbY3Eb9W', // https://console.apify.com/actors/shu8hvrXbJbY3Eb9W
        buildInput: (url) => ({
            directUrls: [url.replace(/\/$/, '')],
            resultsType: 'posts',
            resultsLimit: 3,
        }),
        timeout: 60,
    },
    tiktok: {
        actor: 'GdWCkxBtKWOsKjdch', // https://console.apify.com/actors/GdWCkxBtKWOsKjdch
        buildInput: (_url, username) => ({
            profiles: [username],
            resultsPerPage: 3,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            maxItems: 3,
        }),
        timeout: 90,
    },
    twitter: {
        actor: '61RPP7dywgiy0JPD0', // https://console.apify.com/actors/61RPP7dywgiy0JPD0
        buildInput: (_url, username) => ({
            handles: [username.replace(/^@/, '')],
            maxItems: 3,
            sort: 'Latest',
        }),
        timeout: 60,
    },
    google_maps: {
        actor: 'nwua9Gu5YrADL7ZDj', // https://console.apify.com/actors/nwua9Gu5YrADL7ZDj
        buildInput: (url, username) => {
            const isGmapsUrl = url.includes('google.com/maps') || url.includes('maps.google')
            return {
                ...(isGmapsUrl ? { startUrls: [{ url }] } : { searchStringsArray: [username || url] }),
                maxCrawledPlaces: 2,
                maxReviews: 5,
                language: 'fr',
                includeHistogram: false,
                includeOpeningHours: false,
            }
        },
        timeout: 120,
    },
    linkedin: {
        actor: 'apify~linkedin-profile-scraper',
        buildInput: (url) => ({ profileUrls: [url] }),
        timeout: 60,
    },
}

// GET /api/community-manager/test-apify?url=...&platform=...&key_index=1
// Retourne le résultat brut Apify pour diagnostic
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const profileUrl = searchParams.get('url')
    const platform = searchParams.get('platform') || 'facebook'
    const keyIndexParam = searchParams.get('key_index')

    if (!profileUrl) {
        return NextResponse.json({ error: 'url paramètre requis' }, { status: 400 })
    }

    if (APIFY_KEYS.length === 0) {
        return NextResponse.json({ error: 'Aucune clé Apify configurée (APIFY_API_KEY_1/2/3)' }, { status: 503 })
    }

    const cfg = ACTORS[platform]
    if (!cfg) {
        return NextResponse.json({ error: `Plateforme ${platform} non supportée. Options: facebook, instagram, tiktok` }, { status: 400 })
    }

    const username = profileUrl.replace(/\/$/, '').split('/').filter(Boolean).pop() || profileUrl

    // Choisir la clé (par défaut: toutes en séquence)
    const keyIdx = keyIndexParam !== null ? Math.max(0, Math.min(parseInt(keyIndexParam) - 1, APIFY_KEYS.length - 1)) : 0
    const apiKey = APIFY_KEYS[keyIdx]

    const input = cfg.buildInput(profileUrl, username)
    const startTime = Date.now()

    try {
        console.log(`[test-apify] actor=${cfg.actor} | url=${profileUrl} | key=${keyIdx + 1}`)

        const res = await axios.post(
            `https://api.apify.com/v2/acts/${cfg.actor}/run-sync-get-dataset-items?token=${apiKey}&timeout=${cfg.timeout}&format=json`,
            input,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: (cfg.timeout + 30) * 1000,
            }
        )

        const elapsed = Math.round((Date.now() - startTime) / 1000)
        const items: unknown[] = Array.isArray(res.data) ? res.data : []

        // Analyser la structure du premier item
        const firstItem = items[0] as Record<string, unknown> | undefined
        const firstItemKeys = firstItem ? Object.keys(firstItem) : []
        const hasNestedPosts = firstItem && Array.isArray(firstItem.posts)
        const nestedPostsCount = hasNestedPosts ? (firstItem.posts as unknown[]).length : 0
        const firstPost = hasNestedPosts && nestedPostsCount > 0
            ? (firstItem!.posts as Record<string, unknown>[])[0]
            : firstItem

        return NextResponse.json({
            success: true,
            diagnostic: {
                actor: cfg.actor,
                platform,
                url: profileUrl,
                key_used: keyIdx + 1,
                elapsed_seconds: elapsed,
                http_status: res.status,
                raw_items_count: items.length,
                has_nested_posts_structure: hasNestedPosts,
                nested_posts_count: nestedPostsCount,
                total_posts_available: hasNestedPosts ? nestedPostsCount : items.length,
            },
            structure_analysis: {
                top_level_keys: firstItemKeys,
                first_post_keys: firstPost ? Object.keys(firstPost as object) : [],
                first_post_preview: firstPost ? {
                    text: String((firstPost as Record<string, unknown>).text || (firstPost as Record<string, unknown>).caption || '').slice(0, 200),
                    time: (firstPost as Record<string, unknown>).time || (firstPost as Record<string, unknown>).timestamp || (firstPost as Record<string, unknown>).date,
                    url: (firstPost as Record<string, unknown>).url || (firstPost as Record<string, unknown>).postUrl,
                    reactionsCount: (firstPost as Record<string, unknown>).reactionsCount || (firstPost as Record<string, unknown>).likesCount,
                    commentsCount: (firstPost as Record<string, unknown>).commentsCount,
                    sharesCount: (firstPost as Record<string, unknown>).sharesCount,
                } : null,
                sample_items: items.slice(0, 2),
            },
            input_sent: input,
        })
    } catch (err) {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        const status: number | null = axios.isAxiosError(err) ? (err.response?.status ?? null) : null
        const msg = axios.isAxiosError(err)
            ? (err.response?.data?.error?.message || err.response?.data?.message || err.message)
            : (err instanceof Error ? err.message : String(err))

        return NextResponse.json({
            success: false,
            diagnostic: {
                actor: cfg.actor,
                platform,
                url: profileUrl,
                key_used: keyIdx + 1,
                elapsed_seconds: elapsed,
                http_status: status,
                error: msg,
            },
            input_sent: input,
            advice: getAdvice(status ?? null, msg, elapsed, cfg.timeout),
        }, { status: 200 }) // 200 pour que le client puisse lire le diagnostic
    }
}

function getAdvice(status: number | null, msg: string, elapsed: number, timeout: number): string[] {
    const tips: string[] = []
    if (status === 401 || status === 403) {
        tips.push('Clé Apify invalide ou expirée → vérifier dans Apify Console > API tokens')
    }
    if (status === 402) {
        tips.push('Crédits Apify épuisés → recharger ou attendre le reset mensuel')
    }
    if (status === 429) {
        tips.push('Rate limit Apify → attendre quelques minutes avant de réessayer')
    }
    if (elapsed >= timeout - 10) {
        tips.push(`Timeout après ${elapsed}s : Facebook anti-bot détecté ou trop de posts demandés`)
        tips.push('Essayer avec maxPosts: 3 ou utiliser PhantomBuster pour Facebook')
    }
    if (msg.includes('timeout')) {
        tips.push('Augmenter le timeout ou réduire maxPosts pour accélérer le scraping Facebook')
    }
    if (tips.length === 0) {
        tips.push('Erreur inattendue : voir le champ "error" pour plus de détails')
        tips.push('Tester avec platform=instagram ou tiktok pour vérifier que les clés fonctionnent')
    }
    return tips
}
