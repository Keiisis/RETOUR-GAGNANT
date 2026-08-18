import { GROQ_MODEL } from '@/lib/groq'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import axios from 'axios'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

// ── Clés ─────────────────────────────────────────────────
const GROQ_KEYS = [
    process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6,
].filter(Boolean) as string[]

const APIFY_KEYS = [
    process.env.APIFY_API_KEY_1,
    process.env.APIFY_API_KEY_2,
    process.env.APIFY_API_KEY_3,
].filter(Boolean) as string[]

const SERPER_KEYS = [
    process.env.SERPER_API_KEY_1,
    process.env.SERPER_API_KEY_2,
    process.env.SERPER_API_KEY_3,
].filter(Boolean) as string[]

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant')
}
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Apify actors (IDs vérifiés sur console.apify.com) ─────
const APIFY_ACTORS: Record<string, {
    actor: string
    buildInput: (url: string, username: string) => Record<string, unknown>
    timeout: number
}> = {
    facebook: {
        // https://console.apify.com/actors/KoJrdxJCTtpon81KY : tableau plat de posts
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
        // https://console.apify.com/actors/shu8hvrXbJbY3Eb9W : {url, caption, likesCount, timestamp, shortCode}
        actor: 'shu8hvrXbJbY3Eb9W',
        buildInput: (url) => ({
            directUrls: [url.replace(/\/$/, '')],
            resultsType: 'posts',
            resultsLimit: 20,
        }),
        timeout: 120,
    },
    tiktok: {
        // https://console.apify.com/actors/GdWCkxBtKWOsKjdch : {text, diggCount/heartCount, commentCount, shareCount, createTimeISO, webVideoUrl}
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
        // https://console.apify.com/actors/61RPP7dywgiy0JPD0 : {text, likes, retweets, replies, views, url, timestamp}
        actor: '61RPP7dywgiy0JPD0',
        buildInput: (_url, username) => ({
            handles: [username.replace(/^@/, '')],
            maxItems: 20,
            sort: 'Latest',
        }),
        timeout: 120,
    },
    google_maps: {
        // https://console.apify.com/actors/nwua9Gu5YrADL7ZDj : {title, address, rating, reviews:[{text, stars}]}
        actor: 'nwua9Gu5YrADL7ZDj',
        buildInput: (url, username) => {
            const isGmapsUrl = url.includes('google.com/maps') || url.includes('maps.google')
            return {
                ...(isGmapsUrl ? { startUrls: [{ url }] } : { searchStringsArray: [username || url] }),
                maxCrawledPlaces: 5,
                maxReviews: 20,
                language: 'fr',
                includeHistogram: false,
                includeOpeningHours: false,
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

let apifyKeyIndex = 0

// ── Helpers ───────────────────────────────────────────────
function strSafe(v: unknown): string {
    if (v === null || v === undefined) return ''
    const s = String(v).trim()
    return s === 'null' || s === 'undefined' ? '' : s
}

function ensureArray(v: unknown): string[] {
    return Array.isArray(v) ? v.map(String).filter(Boolean) : []
}

// ── Helpers normalisation (partagés avec scrape/route.ts) ─
type RawPost = { text: string; likes: number; comments: number; shares: number; date: string; url: string; views?: number; stars?: number }

function num(v: unknown): number { return Math.max(0, Number(v) || 0) }

function normFacebook(i: Record<string, unknown>, fb: string): RawPost | null {
    let url = strSafe(i.url || i.postUrl || i.link) || fb
    const text = strSafe(i.text || i.message || i.content || i.caption || i.storyName)
    if (!text && url === fb) return null
    return { text, likes: num(i.reactionsCount ?? i.likesCount ?? 0), comments: num(i.commentsCount ?? i.comments ?? 0), shares: num(i.sharesCount ?? i.shares ?? 0), date: strSafe(i.time || i.timestamp || i.date || i.publishedAt), url }
}
function normInstagram(i: Record<string, unknown>, fb: string): RawPost | null {
    let url = strSafe(i.url)
    if (!url && i.shortCode) url = `https://www.instagram.com/p/${strSafe(i.shortCode)}/`
    if (!url) url = fb
    const text = strSafe(i.caption || i.text || i.description)
    if (!text && url === fb) return null
    return { text, likes: num(i.likesCount ?? i.likes ?? 0), comments: num(i.commentsCount ?? i.comments ?? 0), shares: 0, date: strSafe(i.timestamp || i.date), url }
}
function normTikTok(i: Record<string, unknown>, fb: string): RawPost | null {
    let url = strSafe(i.webVideoUrl || i.videoUrl || i.url) || fb
    const text = strSafe(i.text || i.caption || i.description)
    if (!text && url === fb) return null
    return { text, likes: num(i.diggCount ?? i.heartCount ?? i.likeCount ?? i.likes ?? 0), comments: num(i.commentCount ?? i.commentsCount ?? 0), shares: num(i.shareCount ?? i.sharesCount ?? 0), views: num(i.playCount ?? 0), date: strSafe(i.createTimeISO || i.createTime || i.timestamp || i.date), url }
}
function normTwitter(i: Record<string, unknown>, fb: string): RawPost | null {
    const url = strSafe(i.url || i.tweetUrl) || fb
    const text = strSafe(i.text || i.fullText || i.rawContent)
    if (!text && url === fb) return null
    return { text, likes: num(i.likes ?? i.likeCount ?? i.favoriteCount ?? 0), comments: num(i.replies ?? i.replyCount ?? 0), shares: num(i.retweets ?? i.retweetCount ?? 0), views: num(i.views ?? 0), date: strSafe(i.timestamp || i.date || i.createdAt), url }
}
function normGoogleReview(review: Record<string, unknown>, placeUrl: string, placeName: string): RawPost | null {
    const text = strSafe(review.text || review.textTranslated)
    if (!text) return null
    const stars = num(review.stars || review.rating || 0)
    return { text: placeName ? `[${placeName}] ${text}` : text, likes: stars * 20, stars, comments: 0, shares: 0, date: strSafe(review.publishedAtDate || review.date), url: placeUrl }
}
function normLinkedIn(i: Record<string, unknown>, fb: string): RawPost | null {
    const url = strSafe(i.url || i.postUrl) || fb
    const text = strSafe(i.text || i.description || i.content || i.title)
    if (!text && url === fb) return null
    return { text, likes: num(i.likesCount ?? i.likes ?? 0), comments: num(i.commentsCount ?? i.comments ?? 0), shares: num(i.sharesCount ?? i.shares ?? 0), date: strSafe(i.timestamp || i.date), url }
}

// Fallback pour fiche Google Maps sans reviews[] (lieu seul)
function normGooglePlace(i: Record<string, unknown>, fb: string): RawPost | null {
    const url = strSafe(i.url || i.placeUrl || i.website) || fb
    const name = strSafe(i.title || i.name)
    const address = strSafe(i.address || i.vicinity)
    const text = name ? `${name}${address ? ` : ${address}` : ''}` : strSafe(i.description)
    if (!text) return null
    const stars = num(i.rating || i.totalScore || 0)
    return { text: stars ? `${text} (⭐ ${stars}/5)` : text, likes: stars * 20, stars, comments: num(i.reviewCount || i.reviewsCount || 0), shares: 0, date: strSafe(i.updatedAt || ''), url }
}

const PLATFORM_NORMALIZERS: Record<string, (i: Record<string, unknown>, fb: string) => RawPost | null> = {
    facebook: normFacebook, instagram: normInstagram, tiktok: normTikTok,
    twitter: normTwitter, linkedin: normLinkedIn, google_maps: normGooglePlace,
}

function normalizeItems(items: unknown[], fallbackUrl: string, platform: string): RawPost[] {
    const flat: Array<{ item: Record<string, unknown>; override?: RawPost }> = []
    for (const raw of items) {
        const i = raw as Record<string, unknown>
        if (Array.isArray(i.posts) && i.posts.length > 0) {
            for (const p of i.posts) flat.push({ item: p as Record<string, unknown> })
        } else if (platform === 'google_maps' && Array.isArray(i.reviews) && i.reviews.length > 0) {
            const placeUrl = strSafe(i.url || i.website) || fallbackUrl
            const placeName = strSafe(i.title || i.name)
            for (const rev of i.reviews) {
                const n = normGoogleReview(rev as Record<string, unknown>, placeUrl, placeName)
                if (n) flat.push({ item: rev as Record<string, unknown>, override: n })
            }
        } else { flat.push({ item: i }) }
    }
    console.log(`[analyze-full/normalize] ${items.length} raw → ${flat.length} flat`)
    if (flat[0]) console.log(`[analyze-full/normalize] 1er item keys: ${Object.keys(flat[0].item).slice(0, 10).join(', ')}`)
    const normalizer = PLATFORM_NORMALIZERS[platform]
    if (!normalizer) return []
    const result: RawPost[] = []
    for (const { item, override } of flat.slice(0, 25)) {
        const post = override ?? normalizer(item, fallbackUrl)
        if (post) result.push(post)
    }
    return result
}

async function serperFallback(profileUrl: string, platform: string): Promise<RawPost[]> {
    const cleanUrl = profileUrl.replace(/\/$/, '')
    const username = cleanUrl.split('/').filter(Boolean).pop() || ''
    for (const key of [...SERPER_KEYS].sort(() => Math.random() - 0.5)) {
        try {
            const res = await axios.post(
                'https://google.serper.dev/search',
                { q: `"${cleanUrl}"`, gl: 'bj', hl: 'fr', num: 10 },
                { headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, timeout: 12000 }
            )
            const organic = (res.data.organic || []) as Array<{ title?: string; snippet?: string; link?: string; date?: string }>
            const filtered = organic.filter(r => r.link?.includes(platform + '.com') || r.link?.includes(username) || r.snippet?.toLowerCase().includes(username.toLowerCase()))
            const results = filtered.length > 0 ? filtered : organic.slice(0, 5)
            if (results.length > 0) {
                return results.map(item => ({
                    text: item.snippet || item.title || '',
                    likes: 0, comments: 0, shares: 0,
                    date: item.date || '',
                    url: item.link || profileUrl,
                }))
            }
        } catch { /* essai suivant */ }
    }
    return []
}

async function scrapePosts(profileUrl: string, platform: string): Promise<{ posts: RawPost[]; method: string }> {
    const cfg = APIFY_ACTORS[platform]
    const username = profileUrl.replace(/\/$/, '').split('/').filter(Boolean).pop() || profileUrl

    if (APIFY_KEYS.length > 0 && cfg) {
        const triedKeys = new Set<number>()
        const errors: string[] = []
        while (triedKeys.size < APIFY_KEYS.length) {
            let keyIdx = apifyKeyIndex % APIFY_KEYS.length
            let safety = 0
            while (triedKeys.has(keyIdx) && safety < APIFY_KEYS.length) { keyIdx = (keyIdx + 1) % APIFY_KEYS.length; safety++ }
            if (triedKeys.has(keyIdx)) break
            triedKeys.add(keyIdx)
            const apiKey = APIFY_KEYS[keyIdx]
            try {
                const res = await axios.post(
                    `https://api.apify.com/v2/acts/${cfg.actor}/run-sync-get-dataset-items?token=${apiKey}&timeout=${cfg.timeout}&format=json`,
                    cfg.buildInput(profileUrl, username),
                    { headers: { 'Content-Type': 'application/json' }, timeout: (cfg.timeout + 30) * 1000 }
                )
                apifyKeyIndex = (keyIdx + 1) % APIFY_KEYS.length
                const items: unknown[] = Array.isArray(res.data) ? res.data : []
                const posts = normalizeItems(items, profileUrl, platform)
                console.log(`[analyze-full] Apify  clé ${keyIdx + 1} : ${posts.length} posts`)

                if (posts.length === 0) {
                    // Apify OK mais 0 résultats (profil privé / personnel / vide) → Serper
                    console.warn(`[analyze-full] Apify 0 posts → fallback Serper`)
                    const serperPosts = await serperFallback(profileUrl, platform)
                    return { posts: serperPosts, method: serperPosts.length > 0 ? 'serper_fallback' : 'apify_empty' }
                }
                return { posts, method: 'apify' }
            } catch (err) {
                const status = axios.isAxiosError(err) ? err.response?.status : null
                const msg = axios.isAxiosError(err) ? (err.response?.data?.error?.message || err.message) : String(err)
                errors.push(`clé ${keyIdx + 1}: ${msg}`)
                apifyKeyIndex = (keyIdx + 1) % APIFY_KEYS.length
                if (status === 400) break
                if (status === 429) await new Promise(r => setTimeout(r, 2000))
            }
        }
        console.warn(`[analyze-full] Apify échoué (${errors.join(' | ')}) → fallback Serper`)
    }

    const posts = await serperFallback(profileUrl, platform)
    return { posts, method: posts.length > 0 ? 'serper_fallback' : 'empty' }
}

// ══════════════════════════════════════════════════════════
// Deep Style DNA v2 : Moteur multi-pass
// ══════════════════════════════════════════════════════════

async function callGroq(
    systemPrompt: string, userPrompt: string,
    opts: { temperature: number; max_tokens: number }
): Promise<string> {
    const shuffled = [...GROQ_KEYS].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const groq = new Groq({ apiKey: shuffled[i] })
            const c = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: GROQ_MODEL,
                response_format: { type: 'json_object' },
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
            })
            return c.choices[0].message.content || '{}'
        } catch (err) {
            console.warn(`[analyze-full] Groq key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

function clamp(v: unknown, min: number, max: number): number {
    const n = Number(v); return isNaN(n) ? 0 : Math.max(min, Math.min(max, Math.round(n)))
}
function ensureStr(v: unknown, fb = ''): string {
    if (v == null) return fb; const s = String(v).trim(); return s === 'null' || s === 'undefined' ? fb : s
}

const PASS1_SYSTEM = `Tu es un analyste quantitatif expert en marketing digital, copywriting viral et community management africain.
Analyse les publications et extrais des METRIQUES PRECISES, PATTERNS STRUCTURELS et SCORES CHIFFRES.
Chaque score: entier 0-100. Chaque hook: CITATION EXACTE du texte.
Retourne UNIQUEMENT un JSON valide :
{
  "voice_fingerprint": {
    "signature_phrases": ["citation exacte"] (max 5),
    "transition_words": ["mot"] (max 8),
    "rhythm": "short_punchy | flowing_narrative | mixed",
    "sentence_avg_words": number,
    "punctuation_style": "exclamation_heavy | question_driven | ellipsis_lover | clean | mixed",
    "opening_patterns": ["pattern"] (max 4),
    "closing_patterns": ["pattern"] (max 4)
  },
  "hooks_masterclass": [{"hook":"texte exact","technique":"curiosity_gap|shock_stat|direct_question|bold_claim|personal_story|controversy|social_proof|scarcity|empathy_hook","power_score":number,"why_it_works":"string"}] (max 6),
  "content_blueprint": {
    "structure_template": "string",
    "ideal_length_words": number,
    "hashtag_count": number,
    "hashtag_placement": "end|inline|mixed|none",
    "emoji_density": "none|light|medium|heavy",
    "emoji_favorites": ["emoji"] (max 5),
    "visual_pairing": "lifestyle_photos|data_graphics|face_close_ups|quotes_cards|video_clips|mixed",
    "cta_formulas": ["formule CTA exacte"] (max 4),
    "posting_frequency": "string",
    "best_days": ["jour"]
  },
  "scores": {
    "hook_power": number, "emotional_depth": number, "storytelling": number,
    "authority": number, "humor": number, "urgency": number,
    "community_building": number, "viral_potential": number
  }
}`

const PASS2_SYSTEM = `Tu es un stratège marketing digital expert en psychologie d'audience et positionnement concurrentiel pour l'Afrique de l'Ouest.
Tu reçois l'analyse structurelle (Pass 1) et les publications originales.
Complète avec la dimension STRATEGIQUE, PSYCHOLOGIQUE et CREATIVE.
Le system_prompt doit être DIRECTEMENT utilisable dans Claude/ChatGPT pour imiter ce style.
Les example_rewrites montrent la TRANSFORMATION d'un texte générique vers le style analysé.
Retourne UNIQUEMENT un JSON valide :
{
  "emotional_map": {
    "dominant_emotions": [{"emotion":"string","frequency":number (0-1),"example":"citation courte"}] (max 5),
    "emotional_arc": "buildup_to_climax|steady|rollercoaster|tension_release|crescendo",
    "pain_points_addressed": ["string"] (max 5),
    "desires_activated": ["string"] (max 5),
    "emotional_density_score": number (0-100)
  },
  "audience_persona": {
    "age_range": "string",
    "gender_lean": "mixed|female_dominant|male_dominant",
    "socio_economic": "string",
    "pain_points": ["string"] (max 4),
    "language_register": "familier|informal_professional|formel|technique|mixte",
    "platform_behavior": "string"
  },
  "competitive_edge": {
    "unique_differentiator": "string",
    "content_gaps": ["string"] (max 4),
    "vulnerability": "string",
    "copy_this": ["string"] (max 4),
    "avoid_this": ["string"] (max 3),
    "strengths": ["string"] (max 3),
    "weaknesses": ["string"] (max 3),
    "opportunities": ["string"] (max 3)
  },
  "claude_instructions": {
    "system_prompt": "prompt système complet prêt à l'emploi (max 400 mots)",
    "do_list": ["string"] (max 6),
    "dont_list": ["string"] (max 5),
    "example_rewrites": [{"before":"texte générique","after":"même contenu dans le style analysé"}] (2 exemples)
  },
  "viral_formula": "formule virale condensée en 1 phrase",
  "tone": "string",
  "vocabulary_level": "simple|courant|soutenu|technique|mixte",
  "top_topics": ["string"] (max 5),
  "best_posting_times": ["string"] (max 3),
  "content_mix": "string (ex: 60% éducatif, 30% motivationnel, 10% promotionnel)"
}`

interface HookItem { hook: string; technique: string; power_score: number; why_it_works: string }
interface EmotionItem { emotion: string; frequency: number; example: string }
interface RewriteItem { before: string; after: string }

function sanitizePass1(raw: Record<string, unknown>) {
    const vf = (raw.voice_fingerprint || {}) as Record<string, unknown>
    const hm = Array.isArray(raw.hooks_masterclass) ? raw.hooks_masterclass : []
    const cb = (raw.content_blueprint || {}) as Record<string, unknown>
    const sc = (raw.scores || {}) as Record<string, unknown>
    return {
        voice_fingerprint: {
            signature_phrases: ensureArray(vf.signature_phrases).slice(0, 5),
            transition_words: ensureArray(vf.transition_words).slice(0, 8),
            rhythm: ensureStr(vf.rhythm, 'mixed'),
            sentence_avg_words: clamp(vf.sentence_avg_words, 3, 50),
            punctuation_style: ensureStr(vf.punctuation_style, 'mixed'),
            opening_patterns: ensureArray(vf.opening_patterns).slice(0, 4),
            closing_patterns: ensureArray(vf.closing_patterns).slice(0, 4),
        },
        hooks_masterclass: hm.slice(0, 6).map((h: unknown) => {
            const item = (h || {}) as Record<string, unknown>
            return { hook: ensureStr(item.hook), technique: ensureStr(item.technique, 'bold_claim'), power_score: clamp(item.power_score, 0, 100), why_it_works: ensureStr(item.why_it_works) } as HookItem
        }),
        content_blueprint: {
            structure_template: ensureStr(cb.structure_template),
            ideal_length_words: clamp(cb.ideal_length_words, 10, 2000),
            hashtag_count: clamp(cb.hashtag_count, 0, 30),
            hashtag_placement: ensureStr(cb.hashtag_placement, 'end'),
            emoji_density: ensureStr(cb.emoji_density, 'medium'),
            emoji_favorites: ensureArray(cb.emoji_favorites).slice(0, 5),
            visual_pairing: ensureStr(cb.visual_pairing, 'mixed'),
            cta_formulas: ensureArray(cb.cta_formulas).slice(0, 4),
            posting_frequency: ensureStr(cb.posting_frequency),
            best_days: ensureArray(cb.best_days),
        },
        scores: {
            hook_power: clamp(sc.hook_power, 0, 100), emotional_depth: clamp(sc.emotional_depth, 0, 100),
            storytelling: clamp(sc.storytelling, 0, 100), authority: clamp(sc.authority, 0, 100),
            humor: clamp(sc.humor, 0, 100), urgency: clamp(sc.urgency, 0, 100),
            community_building: clamp(sc.community_building, 0, 100), viral_potential: clamp(sc.viral_potential, 0, 100),
        },
    }
}

function sanitizePass2(raw: Record<string, unknown>) {
    const em = (raw.emotional_map || {}) as Record<string, unknown>
    const ap = (raw.audience_persona || {}) as Record<string, unknown>
    const ce = (raw.competitive_edge || {}) as Record<string, unknown>
    const ci = (raw.claude_instructions || {}) as Record<string, unknown>
    const dominantEmotions = Array.isArray(em.dominant_emotions) ? em.dominant_emotions : []
    const rewrites = Array.isArray(ci.example_rewrites) ? ci.example_rewrites : []
    return {
        emotional_map: {
            dominant_emotions: dominantEmotions.slice(0, 5).map((e: unknown) => {
                const item = (e || {}) as Record<string, unknown>
                return { emotion: ensureStr(item.emotion), frequency: Math.max(0, Math.min(1, Number(item.frequency) || 0)), example: ensureStr(item.example) } as EmotionItem
            }),
            emotional_arc: ensureStr(em.emotional_arc, 'steady'),
            pain_points_addressed: ensureArray(em.pain_points_addressed).slice(0, 5),
            desires_activated: ensureArray(em.desires_activated).slice(0, 5),
            emotional_density_score: clamp(em.emotional_density_score, 0, 100),
        },
        audience_persona: {
            age_range: ensureStr(ap.age_range, '25-40'), gender_lean: ensureStr(ap.gender_lean, 'mixed'),
            socio_economic: ensureStr(ap.socio_economic), pain_points: ensureArray(ap.pain_points).slice(0, 4),
            language_register: ensureStr(ap.language_register, 'informal_professional'), platform_behavior: ensureStr(ap.platform_behavior),
        },
        competitive_edge: {
            unique_differentiator: ensureStr(ce.unique_differentiator),
            content_gaps: ensureArray(ce.content_gaps).slice(0, 4), vulnerability: ensureStr(ce.vulnerability),
            copy_this: ensureArray(ce.copy_this).slice(0, 4), avoid_this: ensureArray(ce.avoid_this).slice(0, 3),
            strengths: ensureArray(ce.strengths).slice(0, 3), weaknesses: ensureArray(ce.weaknesses).slice(0, 3),
            opportunities: ensureArray(ce.opportunities).slice(0, 3),
        },
        claude_instructions: {
            system_prompt: ensureStr(ci.system_prompt), do_list: ensureArray(ci.do_list).slice(0, 6),
            dont_list: ensureArray(ci.dont_list).slice(0, 5),
            example_rewrites: rewrites.slice(0, 2).map((r: unknown) => {
                const item = (r || {}) as Record<string, unknown>
                return { before: ensureStr(item.before), after: ensureStr(item.after) } as RewriteItem
            }),
        },
        viral_formula: ensureStr(raw.viral_formula),
        tone: ensureStr(raw.tone, 'Non déterminé'),
        vocabulary_level: ensureStr(raw.vocabulary_level, 'courant'),
        top_topics: ensureArray(raw.top_topics).slice(0, 5),
        best_posting_times: ensureArray(raw.best_posting_times).slice(0, 3),
        content_mix: ensureStr(raw.content_mix),
    }
}

async function analyzeStyleDeep(posts: RawPost[], platform: string, profileUrl: string) {
    const textPosts = posts.filter(p => p.text.length > 10)
    if (textPosts.length === 0) return null
    const samples = textPosts.slice(0, 15).map(p => p.text).join('\n---\n').slice(0, 12000)
    const ctx = `Plateforme: ${platform} | Profil: ${profileUrl}`

    // Pass 1 : Structurel
    console.log(`[analyze-full] Deep Style DNA : Pass 1...`)
    let pass1
    try {
        const raw1 = await callGroq(PASS1_SYSTEM, `${ctx}\n\nAnalyse ces ${textPosts.length} publications :\n---\n${samples}\n---`, { temperature: 0.2, max_tokens: 3000 })
        pass1 = sanitizePass1(JSON.parse(raw1))
    } catch (err) {
        console.warn('[analyze-full] Pass 1 failed:', err instanceof Error ? err.message : '')
        return null
    }

    // Pass 2 : Stratégique
    console.log(`[analyze-full] Deep Style DNA : Pass 2...`)
    let pass2
    try {
        const raw2 = await callGroq(PASS2_SYSTEM, `${ctx}\n\n## Analyse structurelle (Pass 1) :\n\`\`\`json\n${JSON.stringify(pass1, null, 2)}\n\`\`\`\n\n## Publications originales :\n---\n${samples.slice(0, 6000)}\n---`, { temperature: 0.5, max_tokens: 3000 })
        pass2 = sanitizePass2(JSON.parse(raw2))
    } catch (err) {
        console.warn('[analyze-full] Pass 2 failed, partial:', err instanceof Error ? err.message : '')
        pass2 = null
    }

    const scores = {
        ...pass1.scores,
        overall: Math.round(
            pass1.scores.hook_power * 0.2 + pass1.scores.emotional_depth * 0.15 +
            pass1.scores.storytelling * 0.15 + pass1.scores.authority * 0.1 +
            pass1.scores.viral_potential * 0.2 + pass1.scores.community_building * 0.1 +
            pass1.scores.urgency * 0.05 + pass1.scores.humor * 0.05
        ),
    }

    return { pass1, pass2, scores }
}

// ── Calcul score viral ────────────────────────────────────
function computeViralScore(post: RawPost): number {
    // Likes×1 + Comments×3 + Shares×5 (amplification croissante)
    return post.likes * 1 + post.comments * 3 + post.shares * 5
}

// ── Génération du prompt Claude.ai v2 ────────────────────
function buildClaudePromptV2(dossier: Record<string, unknown>): string {
    const meta = dossier.meta as Record<string, unknown>
    const dna = dossier.style_dna as Record<string, unknown> | undefined
    const style = dossier.style as Record<string, unknown>
    const competitive = dossier.competitive as Record<string, string[]>

    // Si pas de Deep DNA, fallback vers l'ancien format
    if (!dna) {
        return `# Dossier Intelligence @${meta.username} (${meta.platform})
Formule virale: "${style.viral_formula || 'Non déterminée'}"
Ton: ${style.tone || '?'} | Structure: ${style.structure || '?'}
Forces: ${(competitive.strengths || []).join(', ')}
Faiblesses: ${(competitive.weaknesses || []).join(', ')}
Opportunités: ${(competitive.opportunities || []).join(', ')}
---
*${meta.posts_analyzed} posts analysés : ${meta.generated_at}*`
    }

    const vf = (dna.voice_fingerprint || {}) as Record<string, unknown>
    const em = (dna.emotional_map || {}) as Record<string, unknown>
    const ap = (dna.audience_persona || {}) as Record<string, unknown>
    const cb = (dna.content_blueprint || {}) as Record<string, unknown>
    const ce = (dna.competitive_edge || {}) as Record<string, unknown>
    const ci = (dna.claude_instructions || {}) as Record<string, unknown>
    const sc = (dna.scores || {}) as Record<string, number>
    const dominantEmotions = Array.isArray(em.dominant_emotions) ? em.dominant_emotions : []
    const rewrites = Array.isArray(ci.example_rewrites) ? ci.example_rewrites : []

    return `# System Prompt : Imite le style de @${meta.username} (${meta.platform})

${ci.system_prompt || `Tu es un expert en community management. Tu imites le style de @${meta.username} sur ${meta.platform}.`}

---

## REGLES A SUIVRE
${ensureArray(ci.do_list).map(d => ` ${d}`).join('\n') || '(aucune)'}

## A EVITER
${ensureArray(ci.dont_list).map(d => ` ${d}`).join('\n') || '(aucune)'}

## EMPREINTE VOCALE
- Rythme: ${vf.rhythm || '?'}
- Longueur phrases: ~${vf.sentence_avg_words || '?'} mots/phrase
- Expressions signatures: ${ensureArray(vf.signature_phrases).join(' | ') || '?'}
- Mots de transition: ${ensureArray(vf.transition_words).join(', ') || '?'}
- Ponctuation: ${vf.punctuation_style || '?'}
- Ouverture type: ${ensureArray(vf.opening_patterns).join(', ') || '?'}
- Fermeture type: ${ensureArray(vf.closing_patterns).join(', ') || '?'}

## STRUCTURE TYPE
${cb.structure_template || '?'}
- Longueur idéale: ${cb.ideal_length_words || '?'} mots
- Hashtags: ${cb.hashtag_count || '?'} (placement: ${cb.hashtag_placement || '?'})
- Emojis: ${cb.emoji_density || '?'}${ensureArray(cb.emoji_favorites).length > 0 ? ` : favoris: ${ensureArray(cb.emoji_favorites).join(' ')}` : ''}
- Visuel: ${cb.visual_pairing || '?'}

## FORMULES CTA A REUTILISER
${ensureArray(cb.cta_formulas).map(c => `→ "${c}"`).join('\n') || '(aucune)'}

## CARTE EMOTIONNELLE
- Emotions dominantes: ${dominantEmotions.map((e: Record<string, unknown>) => `${e.emotion} (${Math.round((Number(e.frequency) || 0) * 100)}%)`).join(', ') || '?'}
- Arc émotionnel: ${em.emotional_arc || '?'}
- Douleurs ciblées: ${ensureArray(em.pain_points_addressed).join(', ') || '?'}
- Désirs activés: ${ensureArray(em.desires_activated).join(', ') || '?'}

## AUDIENCE CIBLE
- Age: ${ap.age_range || '?'} | Genre: ${ap.gender_lean || '?'}
- Profil socio-économique: ${ap.socio_economic || '?'}
- Registre: ${ap.language_register || '?'}
- Comportement: ${ap.platform_behavior || '?'}

## EXEMPLES AVANT / APRES
${rewrites.map((r: Record<string, unknown>, i: number) => `### Exemple ${i + 1}\n**AVANT (générique):** "${r.before || '?'}"\n**APRES (style @${meta.username}):** "${r.after || '?'}"`).join('\n\n') || '(pas d\'exemples)'}

## INTELLIGENCE COMPETITIVE
- Différenciateur unique: ${ce.unique_differentiator || '?'}
- A copier: ${ensureArray(ce.copy_this).join(' | ') || '?'}
- A éviter: ${ensureArray(ce.avoid_this).join(' | ') || '?'}
- Failles exploitables: ${ce.vulnerability || '?'}
- Sujets non couverts: ${ensureArray(ce.content_gaps).join(', ') || '?'}

## SCORES (sur 100)
 Global: ${sc.overall || '?'}/100
- Accroche: ${sc.hook_power || '?'} | Emotion: ${sc.emotional_depth || '?'} | Story: ${sc.storytelling || '?'}
- Autorité: ${sc.authority || '?'} | Viralité: ${sc.viral_potential || '?'} | Communauté: ${sc.community_building || '?'}

---
*Dossier @${meta.username} : ${meta.posts_analyzed} posts analysés : ${meta.generated_at} : Community Manager Pro v3*`
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ═════════════════════════════════════════════════════════
// POST /api/community-manager/analyze-full
// ═════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json()
        const { profile_id, profile_url, platform, username, notes } = body

        if (!profile_url?.trim()) return NextResponse.json({ error: 'profile_url obligatoire' }, { status: 400 })
        if (!platform || !VALID_PLATFORMS.includes(platform)) {
            return NextResponse.json({ error: `Plateforme invalide. Options: ${VALID_PLATFORMS.join(', ')}` }, { status: 400 })
        }
        if (profile_id && !UUID_REGEX.test(profile_id)) {
            return NextResponse.json({ error: 'profile_id invalide.' }, { status: 400 })
        }

        const profileUsername = username || profile_url.replace(/\/$/, '').split('/').filter(Boolean).pop() || ''

        // ── 1. Scraping ───────────────────────────────────
        console.log(`[analyze-full] Début pipeline : ${platform} : ${profile_url}`)
        const { posts: rawPosts, method: scrapeMethod } = await scrapePosts(profile_url, platform)
        console.log(`[analyze-full] ${rawPosts.length} posts scrappés via ${scrapeMethod}`)

        // ── 2. Scores viraux ──────────────────────────────
        const rawScores = rawPosts.map(p => computeViralScore(p))
        const maxRaw = Math.max(...rawScores, 1)
        const postsScored = rawPosts.map((post, i) => ({
            ...post,
            viral_score: Math.round((rawScores[i] / maxRaw) * 100),
        })).sort((a, b) => b.viral_score - a.viral_score)

        // ── 3. Deep Style DNA (multi-pass) ──────────────
        console.log(`[analyze-full] Deep Style DNA Groq...`)
        const deepResult = await analyzeStyleDeep(rawPosts, platform, profile_url)
        const p1 = deepResult?.pass1
        const p2 = deepResult?.pass2
        const dnaScores = deepResult?.scores

        // ── 4. Stats d'engagement ─────────────────────────
        const withEngage = postsScored.filter(p => p.likes + p.comments + p.shares > 0)
        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
        const avgLikes = avg(withEngage.map(p => p.likes))
        const avgComments = avg(withEngage.map(p => p.comments))
        const avgShares = avg(withEngage.map(p => p.shares))
        const bestScore = postsScored[0]?.viral_score ?? 0
        const engagementLevel = withEngage.length === 0 ? 'non mesuré' : bestScore > 70 ? 'viral' : bestScore > 40 ? 'élevé' : bestScore > 20 ? 'moyen' : 'faible'

        // ── 5. Construction du Dossier Intelligence v3 ────
        const dossier: Record<string, unknown> = {
            meta: {
                version: '3.0',
                generated_at: new Date().toISOString(),
                tool: 'Retour Gagnant : Community Manager Pro v3',
                posts_analyzed: rawPosts.length,
                scrape_method: scrapeMethod,
                platform,
                profile_url,
                username: profileUsername,
            },
            profile: {
                platform,
                username: profileUsername,
                profile_url,
                notes: notes || '',
            },
            // Deep Style DNA (nouveau)
            style_dna: p1 ? {
                voice_fingerprint: p1.voice_fingerprint,
                hooks_masterclass: p1.hooks_masterclass,
                content_blueprint: p1.content_blueprint,
                scores: dnaScores,
                emotional_map: p2?.emotional_map || null,
                audience_persona: p2?.audience_persona || null,
                competitive_edge: p2?.competitive_edge || null,
                claude_instructions: p2?.claude_instructions || null,
            } : null,
            // Legacy flat style (backward compat)
            style: {
                tone: p2?.tone || 'Non déterminé',
                vocabulary_level: p2?.vocabulary_level || 'courant',
                structure: p1?.content_blueprint.structure_template || '',
                hooks: p1?.hooks_masterclass.map((h: HookItem) => h.hook) || [],
                hashtag_strategy: p1 ? `${p1.content_blueprint.hashtag_count} hashtags, placement: ${p1.content_blueprint.hashtag_placement}` : '',
                emoji_usage: p1?.content_blueprint.emoji_density || '',
                avg_post_length: p1 ? `${p1.content_blueprint.ideal_length_words} mots` : '',
                engagement_triggers: p2?.emotional_map?.pain_points_addressed || [],
                writing_patterns: p1?.voice_fingerprint.opening_patterns || [],
                improvement_tips: p2?.competitive_edge?.content_gaps || [],
                viral_formula: p2?.viral_formula || '',
                best_content_types: p1 ? [p1.content_blueprint.visual_pairing] : [],
                cta_style: p1?.content_blueprint.cta_formulas.join(' / ') || '',
                top_topics: p2?.top_topics || [],
                content_mix: p2?.content_mix || '',
            },
            top_posts: postsScored.slice(0, 10).map((p, i) => ({
                rank: i + 1,
                text: p.text.slice(0, 400),
                likes: p.likes,
                comments: p.comments,
                shares: p.shares,
                ...(p.stars !== undefined ? { stars: p.stars } : {}),
                ...(p.views !== undefined ? { views: p.views } : {}),
                viral_score: p.viral_score,
                date: p.date,
                url: p.url,
            })),
            stats: {
                avg_likes: avgLikes,
                avg_comments: avgComments,
                avg_shares: avgShares,
                best_viral_score: bestScore,
                engagement_level: engagementLevel,
                total_posts_scraped: rawPosts.length,
                posts_with_engagement: withEngage.length,
            },
            patterns: {
                best_times: p2?.best_posting_times?.length ? p2.best_posting_times : ['18h-20h', '7h-9h'],
                top_hooks: p1?.hooks_masterclass.slice(0, 5).map((h: HookItem) => h.hook) || [],
                top_topics: p2?.top_topics || [],
                content_mix: p2?.content_mix || '',
            },
            competitive: {
                strengths: p2?.competitive_edge?.strengths || [],
                weaknesses: p2?.competitive_edge?.weaknesses || [],
                opportunities: p2?.competitive_edge?.opportunities || [],
            },
        }

        // ── 6. Prompt Claude.ai v2 prêt à l'emploi ──────
        const claudePrompt = buildClaudePromptV2(dossier)
        dossier.claude_prompt = claudePrompt

        // ── 7. Sauvegarde Supabase ────────────────────────
        if (profile_id) {
            try {
                await supabase.from('social_analyses').insert({
                    profile_id,
                    analysis_type: 'style',
                    content_samples: rawPosts.slice(0, 5).map(p => p.text).join('\n---\n').slice(0, 5000),
                    result: dossier,
                })
                // Mettre à jour last_analyzed_at du profil
                await supabase.from('social_profiles').update({ last_analyzed_at: new Date().toISOString() }).eq('id', profile_id)
            } catch (dbErr) {
                console.warn('[analyze-full] Supabase save failed:', dbErr)
            }
        }

        console.log(`[analyze-full]  Dossier construit : engagement: ${engagementLevel} | style analysé: ${deepResult !== null}`)
        return NextResponse.json({ success: true, dossier })
    } catch (err) {
        console.error('[analyze-full] Error:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
