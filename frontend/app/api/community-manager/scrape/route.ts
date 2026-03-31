import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

// ── Pool de clés Apify (rotation dynamique) ─────────────
const APIFY_KEYS: string[] = [
    process.env.APIFY_API_KEY_1,
    process.env.APIFY_API_KEY_2,
    process.env.APIFY_API_KEY_3,
].filter(Boolean) as string[]

const SERPER_KEYS: string[] = [
    process.env.SERPER_API_KEY_1,
    process.env.SERPER_API_KEY_2,
    process.env.SERPER_API_KEY_3,
    process.env.SERPER_API_KEY,
].filter(Boolean) as string[]

let apifyKeyIndex = 0

// ── Type normalisé universel ──────────────────────────────
type NormalizedPost = {
    text: string
    likes: number
    comments: number
    shares: number
    date: string
    url: string
    views?: number   // Twitter, TikTok
    stars?: number   // Google Maps (0-5)
}

// ── Actors Apify — IDs vérifiés sur console.apify.com ────
const APIFY_ACTORS: Record<string, {
    actor: string
    buildInput: (url: string, username: string) => Record<string, unknown>
    timeout: number
}> = {
    facebook: {
        // https://console.apify.com/actors/KoJrdxJCTtpon81KY
        // Retourne tableau PLAT de posts (contrairement à facebook-pages-scraper)
        actor: 'KoJrdxJCTtpon81KY',
        buildInput: (url) => ({
            startUrls: [{ url: url.replace(/\/$/, '') }],
            maxPosts: 15,
            maxPostComments: 0,
            proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
        }),
        timeout: 180,
    },
    instagram: {
        // https://console.apify.com/actors/shu8hvrXbJbY3Eb9W
        // Sortie: {url, caption, likesCount, commentsCount, timestamp, shortCode, ...}
        actor: 'shu8hvrXbJbY3Eb9W',
        buildInput: (url) => ({
            directUrls: [url.replace(/\/$/, '')],
            resultsType: 'posts',
            resultsLimit: 20,
        }),
        timeout: 120,
    },
    tiktok: {
        // https://console.apify.com/actors/GdWCkxBtKWOsKjdch
        // Sortie: {text/caption, diggCount/heartCount, commentCount, shareCount, createTimeISO, webVideoUrl}
        actor: 'GdWCkxBtKWOsKjdch',
        buildInput: (_url, username) => ({
            profiles: [username],
            resultsPerPage: 20,
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
            maxItems: 20,
        }),
        timeout: 180,
    },
    twitter: {
        // https://console.apify.com/actors/61RPP7dywgiy0JPD0
        // Sortie: {text, likes, retweets, replies, views, url, timestamp, author{username,...}}
        actor: '61RPP7dywgiy0JPD0',
        buildInput: (_url, username) => ({
            handles: [username.replace(/^@/, '')],
            maxItems: 20,
            sort: 'Latest',
        }),
        timeout: 120,
    },
    google_maps: {
        // https://console.apify.com/actors/nwua9Gu5YrADL7ZDj
        // Sortie: {title/name, address, rating, reviewCount, reviews:[{text, stars, publishedAtDate}]}
        actor: 'nwua9Gu5YrADL7ZDj',
        buildInput: (url, username) => {
            const isGmapsUrl = url.includes('google.com/maps') || url.includes('maps.google')
            return {
                ...(isGmapsUrl
                    ? { startUrls: [{ url }] }
                    : { searchStringsArray: [username || url] }),
                maxCrawledPlaces: 5,
                maxReviews: 20,
                language: 'fr',
                includeHistogram: false,
                includeOpeningHours: false,
                includePeopleAlsoSearch: false,
            }
        },
        timeout: 180,
    },
    linkedin: {
        actor: 'apify~linkedin-profile-scraper',
        buildInput: (url) => ({ profileUrls: [url] }),
        timeout: 120,
    },
}

const VALID_PLATFORMS = Object.keys(APIFY_ACTORS)

// ── Helpers ───────────────────────────────────────────────
function strSafe(v: unknown): string {
    if (v === null || v === undefined) return ''
    const s = String(v).trim()
    return s === 'null' || s === 'undefined' ? '' : s
}

function num(v: unknown): number {
    return Math.max(0, Number(v) || 0)
}

// ── Normalisateurs par plateforme ─────────────────────────
function normalizeFacebook(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    let url = strSafe(i.url || i.postUrl || i.link)
    if (!url) url = fallbackUrl
    const text = strSafe(i.text || i.message || i.content || i.caption || i.storyName)
    if (!text && url === fallbackUrl) return null
    return {
        text,
        likes: num(i.reactionsCount ?? i.likesCount ?? i.reactions ?? 0),
        comments: num(i.commentsCount ?? i.comments ?? 0),
        shares: num(i.sharesCount ?? i.shares ?? 0),
        date: strSafe(i.time || i.timestamp || i.date || i.publishedAt || i.postedAt),
        url,
    }
}

function normalizeInstagram(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    let url = strSafe(i.url)
    if (!url && i.shortCode) url = `https://www.instagram.com/p/${strSafe(i.shortCode)}/`
    if (!url) url = fallbackUrl
    const text = strSafe(i.caption || i.text || i.description)
    if (!text && url === fallbackUrl) return null
    return {
        text,
        likes: num(i.likesCount ?? i.likes ?? 0),
        comments: num(i.commentsCount ?? i.comments ?? 0),
        shares: 0, // Instagram ne publie pas les partages
        date: strSafe(i.timestamp || i.date),
        url,
    }
}

function normalizeTikTok(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    let url = strSafe(i.webVideoUrl || i.videoUrl || i.url)
    if (!url) url = fallbackUrl
    const text = strSafe(i.text || i.caption || i.description)
    if (!text && url === fallbackUrl) return null
    return {
        text,
        likes: num(i.diggCount ?? i.heartCount ?? i.likeCount ?? i.likes ?? 0),
        comments: num(i.commentCount ?? i.commentsCount ?? 0),
        shares: num(i.shareCount ?? i.sharesCount ?? 0),
        views: num(i.playCount ?? i.viewCount ?? 0),
        date: strSafe(i.createTimeISO || i.createTime || i.timestamp || i.date),
        url,
    }
}

function normalizeTwitter(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    const url = strSafe(i.url || i.tweetUrl) || fallbackUrl
    const text = strSafe(i.text || i.fullText || i.rawContent)
    if (!text && url === fallbackUrl) return null
    return {
        text,
        likes: num(i.likes ?? i.likeCount ?? i.favoriteCount ?? 0),
        comments: num(i.replies ?? i.replyCount ?? 0),
        shares: num(i.retweets ?? i.retweetCount ?? 0),
        views: num(i.views ?? i.viewCount ?? 0),
        date: strSafe(i.timestamp || i.date || i.createdAt),
        url,
    }
}

function normalizeGoogleMapsReview(
    review: Record<string, unknown>,
    placeUrl: string,
    placeName: string
): NormalizedPost | null {
    const text = strSafe(review.text || review.textTranslated)
    if (!text) return null
    const stars = num(review.stars || review.rating || 0)
    return {
        text: placeName ? `[${placeName}] ${text}` : text,
        likes: stars * 20, // 0-5 étoiles → 0-100 pour comparaison avec autres plateformes
        stars,
        comments: 0,
        shares: 0,
        date: strSafe(review.publishedAtDate || review.date || review.updatedAt),
        url: placeUrl,
    }
}

function normalizeLinkedIn(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    const url = strSafe(i.url || i.postUrl) || fallbackUrl
    const text = strSafe(i.text || i.description || i.content || i.title)
    if (!text && url === fallbackUrl) return null
    return {
        text,
        likes: num(i.likesCount ?? i.likes ?? i.reactionsCount ?? 0),
        comments: num(i.commentsCount ?? i.comments ?? 0),
        shares: num(i.sharesCount ?? i.shares ?? 0),
        date: strSafe(i.timestamp || i.date || i.publishedAt),
        url,
    }
}

// Fallback pour un item Google Maps sans reviews[] (fiche lieu seule)
function normalizeGoogleMapsPlace(i: Record<string, unknown>, fallbackUrl: string): NormalizedPost | null {
    const url = strSafe(i.url || i.placeUrl || i.website) || fallbackUrl
    const name = strSafe(i.title || i.name)
    const address = strSafe(i.address || i.vicinity)
    const text = name ? `${name}${address ? ` — ${address}` : ''}` : strSafe(i.description)
    if (!text) return null
    const stars = num(i.rating || i.totalScore || 0)
    return {
        text: stars ? `${text} (⭐ ${stars}/5)` : text,
        likes: stars * 20,
        stars,
        comments: num(i.reviewCount || i.reviewsCount || i.userRatingsTotal || 0),
        shares: 0,
        date: strSafe(i.updatedAt || i.createdAt || ''),
        url,
    }
}

const PLATFORM_NORMALIZERS: Record<string, (i: Record<string, unknown>, fallback: string) => NormalizedPost | null> = {
    facebook: normalizeFacebook,
    instagram: normalizeInstagram,
    tiktok: normalizeTikTok,
    twitter: normalizeTwitter,
    linkedin: normalizeLinkedIn,
    google_maps: normalizeGoogleMapsPlace,
}

// ── Aplatissement + normalisation ────────────────────────
function flattenAndNormalize(
    items: unknown[],
    platform: string,
    fallbackUrl: string
): NormalizedPost[] {
    const flat: Array<{ item: Record<string, unknown>; override?: NormalizedPost }> = []

    for (const raw of items) {
        const i = raw as Record<string, unknown>

        // Facebook: posts peuvent être imbriqués dans item.posts[]
        if (Array.isArray(i.posts) && i.posts.length > 0) {
            for (const p of i.posts) {
                flat.push({ item: p as Record<string, unknown> })
            }

        // Google Maps: chaque lieu a ses avis dans item.reviews[]
        } else if (platform === 'google_maps' && Array.isArray(i.reviews) && i.reviews.length > 0) {
            const placeUrl = strSafe(i.url || i.placeUrl || i.website) || fallbackUrl
            const placeName = strSafe(i.title || i.name)
            for (const rev of i.reviews) {
                const norm = normalizeGoogleMapsReview(rev as Record<string, unknown>, placeUrl, placeName)
                if (norm) flat.push({ item: rev as Record<string, unknown>, override: norm })
            }

        // Tous les autres formats : tableau plat
        } else {
            flat.push({ item: i })
        }
    }

    const normalizer = PLATFORM_NORMALIZERS[platform]
    if (!normalizer) return []

    const result: NormalizedPost[] = []
    for (const { item, override } of flat.slice(0, 25)) {
        const post = override ?? normalizer(item, fallbackUrl)
        if (post) result.push(post)
    }

    console.log(`[flattenAndNormalize] ${items.length} items bruts → ${flat.length} aplatis → ${result.length} posts normalisés`)
    if (flat.length > 0 && flat[0].item) {
        console.log(`[flattenAndNormalize] Champs 1er item: ${Object.keys(flat[0].item).slice(0, 12).join(', ')}`)
    }

    return result
}

// ── Rotation Apify avec retry sur toutes les clés ────────
async function callApifyWithRotation(
    platform: string,
    profileUrl: string
): Promise<{ posts: NormalizedPost[]; usedKeyIndex: number; rawItemsCount: number; firstItemKeys: string[] }> {
    if (APIFY_KEYS.length === 0) throw new Error('Aucune clé Apify configurée')

    const cfg = APIFY_ACTORS[platform]
    if (!cfg) throw new Error(`Plateforme ${platform} non supportée`)

    const username = profileUrl.replace(/\/$/, '').split('/').filter(Boolean).pop() || profileUrl
    const triedKeys = new Set<number>()
    const errors: string[] = []

    while (triedKeys.size < APIFY_KEYS.length) {
        let keyIdx = apifyKeyIndex % APIFY_KEYS.length
        let safety = 0
        while (triedKeys.has(keyIdx) && safety < APIFY_KEYS.length) {
            keyIdx = (keyIdx + 1) % APIFY_KEYS.length
            safety++
        }
        if (triedKeys.has(keyIdx)) break
        triedKeys.add(keyIdx)

        const apiKey = APIFY_KEYS[keyIdx]
        const label = `[Apify clé ${keyIdx + 1}/${APIFY_KEYS.length}]`

        try {
            console.log(`${label} → ${cfg.actor} | ${platform} | ${username}`)

            const res = await axios.post(
                `https://api.apify.com/v2/acts/${cfg.actor}/run-sync-get-dataset-items?token=${apiKey}&timeout=${cfg.timeout}&format=json`,
                cfg.buildInput(profileUrl, username),
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: (cfg.timeout + 30) * 1000,
                }
            )

            apifyKeyIndex = (keyIdx + 1) % APIFY_KEYS.length

            const items: unknown[] = Array.isArray(res.data) ? res.data : []
            const firstItem = items[0] as Record<string, unknown> | undefined
            const firstItemKeys = firstItem ? Object.keys(firstItem) : []
            const posts = flattenAndNormalize(items, platform, profileUrl)

            console.log(`${label} ✓ raw:${items.length} → posts:${posts.length} | clés:[${firstItemKeys.slice(0, 8).join(',')}]`)

            return { posts, usedKeyIndex: keyIdx, rawItemsCount: items.length, firstItemKeys }
        } catch (err) {
            const status = axios.isAxiosError(err) ? err.response?.status : null
            const msg = axios.isAxiosError(err)
                ? (err.response?.data?.error?.message || err.response?.data?.message || err.message)
                : (err instanceof Error ? err.message : String(err))

            errors.push(`clé ${keyIdx + 1}: ${status ? `HTTP ${status}` : ''} ${msg}`)
            console.warn(`${label} ✗ ${status ? `HTTP ${status}` : ''} ${msg}`)

            apifyKeyIndex = (keyIdx + 1) % APIFY_KEYS.length

            if (status === 401 || status === 403) continue
            if (status === 429) { await new Promise(r => setTimeout(r, 2000)); continue }
            if (status === 400) throw new Error(`Apify: paramètres invalides — ${msg}`)
            continue // timeout, 5xx, réseau → clé suivante
        }
    }

    throw new Error(`Apify: toutes les clés ont échoué. Détails: ${errors.join(' | ')}`)
}

// ── Fallback Serper ───────────────────────────────────────
async function serperFallback(profileUrl: string, platform: string): Promise<NormalizedPost[]> {
    const shuffled = [...SERPER_KEYS].sort(() => Math.random() - 0.5)
    const cleanUrl = profileUrl.replace(/\/$/, '')
    const username = cleanUrl.split('/').filter(Boolean).pop() || ''

    // Adapter le site de recherche selon la plateforme
    const siteMap: Record<string, string> = {
        facebook: 'facebook.com', instagram: 'instagram.com',
        tiktok: 'tiktok.com', twitter: 'twitter.com',
        linkedin: 'linkedin.com', google_maps: 'google.com/maps',
    }
    const site = siteMap[platform] || platform + '.com'

    const queries = [
        `"${cleanUrl}"`,
        `site:${site} "${username}"`,
        `"${username}" ${platform}`,
    ]

    for (const query of queries) {
        for (let i = 0; i < Math.min(shuffled.length, 2); i++) {
            try {
                const res = await axios.post(
                    'https://google.serper.dev/search',
                    { q: query, gl: 'bj', hl: 'fr', num: 10 },
                    { headers: { 'X-API-KEY': shuffled[i], 'Content-Type': 'application/json' }, timeout: 12000 }
                )
                const organic: Array<{ title?: string; snippet?: string; link?: string; date?: string }> = res.data.organic || []
                const filtered = organic.filter(r =>
                    r.link?.includes(site) || r.link?.includes(username) ||
                    r.snippet?.toLowerCase().includes(username.toLowerCase())
                )
                const results = filtered.length > 0 ? filtered : organic.slice(0, 5)
                if (results.length > 0) {
                    console.log(`[Serper fallback] ✓ query="${query}" → ${results.length} résultats`)
                    return results.map(item => ({
                        text: item.snippet || item.title || '',
                        likes: 0, comments: 0, shares: 0,
                        date: item.date || '',
                        url: item.link || profileUrl,
                    }))
                }
            } catch { /* essai suivant */ }
        }
    }
    return []
}

// ═════════════════════════════════════════════════════════
// POST /api/community-manager/scrape
// ═════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { profile_url, platform } = body

        if (!profile_url?.trim()) {
            return NextResponse.json({ error: "L'URL du profil est obligatoire." }, { status: 400 })
        }
        if (!platform || !VALID_PLATFORMS.includes(platform)) {
            return NextResponse.json(
                { error: `Plateforme invalide. Choisissez : ${VALID_PLATFORMS.join(', ')}.` },
                { status: 400 }
            )
        }

        let posts: NormalizedPost[] = []
        let method = 'serper'
        let apifyKeyUsed: number | null = null
        let apifyError: string | null = null
        let apifyDebug: Record<string, unknown> = {}

        if (APIFY_KEYS.length > 0) {
            try {
                const result = await callApifyWithRotation(platform, profile_url)
                apifyKeyUsed = result.usedKeyIndex + 1
                apifyDebug = { raw_count: result.rawItemsCount, first_item_keys: result.firstItemKeys }
                if (result.posts.length === 0) {
                    console.warn(`[scrape] Apify #${apifyKeyUsed} → 0 posts (raw:${result.rawItemsCount}) → Serper`)
                    posts = await serperFallback(profile_url, platform)
                    method = posts.length > 0 ? 'serper_fallback' : 'apify_empty'
                } else {
                    posts = result.posts
                    method = 'apify'
                    console.log(`[scrape] ✓ Apify clé #${apifyKeyUsed} — ${posts.length} posts`)
                }
            } catch (err) {
                apifyError = err instanceof Error ? err.message : String(err)
                console.warn(`[scrape] Apify échoué: ${apifyError} → Serper`)
                posts = await serperFallback(profile_url, platform)
                method = posts.length > 0 ? 'serper_fallback' : 'empty'
            }
        } else {
            posts = await serperFallback(profile_url, platform)
        }

        return NextResponse.json({
            success: true, posts, total: posts.length, method,
            apify_keys_count: APIFY_KEYS.length,
            apify_key_used: apifyKeyUsed,
            apify_error: apifyError,
            apify_debug: apifyDebug,
            profile_url, platform,
        })
    } catch (err) {
        console.error('[scrape] Error:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// GET /api/community-manager/scrape — Status
export async function GET() {
    return NextResponse.json({
        supported_platforms: VALID_PLATFORMS,
        apify_keys_count: APIFY_KEYS.length,
        current_key_index: (apifyKeyIndex % Math.max(APIFY_KEYS.length, 1)) + 1,
        keys_preview: APIFY_KEYS.map((k, i) => ({ index: i + 1, prefix: k.substring(0, 24) + '...' })),
        serper_keys_count: SERPER_KEYS.length,
    })
}
