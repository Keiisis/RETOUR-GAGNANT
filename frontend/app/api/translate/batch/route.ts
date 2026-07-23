import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashText } from '@/lib/translation/hash'
import { SUPPORTED_LANGUAGES, type LangCode } from '@/lib/translation'
import { guardPublic, TRANSLATE_LIMIT } from '@/lib/api-guard'

export const maxDuration = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BATCH_SIZE = 30          // texts per Groq call (llama-3.3-70b handles 30 comfortably)
const TIME_BUDGET_MS = 52_000  // leave 8s buffer before Vercel 60s limit

// ─── Robust JSON array parser ──────────────────────────────────────────────────
function parseJsonArray(raw: string, expected: number): string[] | null {
    const clean = raw
        .trim()
        .replace(/^```(?:json)?[\r\n]*/i, '')
        .replace(/[\r\n]*```$/i, '')
        .trim()

    // Attempt 1: direct parse
    try {
        const arr = JSON.parse(clean)
        if (Array.isArray(arr) && arr.length === expected) {
            return arr.map(s => String(s ?? ''))
        }
    } catch { /* continue */ }

    // Attempt 2: extract first [...] block (handles extra prose around JSON)
    const match = clean.match(/\[[\s\S]*\]/)
    if (match) {
        try {
            const arr = JSON.parse(match[0])
            if (Array.isArray(arr) && arr.length === expected) {
                return arr.map(s => String(s ?? ''))
            }
        } catch { /* continue */ }
    }

    // Attempt 3: line-by-line extraction (Groq sometimes returns numbered list)
    const lines = clean.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    if (lines.length === expected) {
        return lines
    }

    return null
}

// ─── Static string extractor ────────────────────────────────────────────────────
// Scans app/ and components/ source files for <T>text</T> and t('text') patterns
async function collectStaticStrings(): Promise<Set<string>> {
    const texts = new Set<string>()
    const root = process.cwd()
    const SKIP = new Set(['node_modules', '.next', '.git', 'public', '__tests__', '.turbo'])

    async function scanDir(dir: string): Promise<void> {
        try {
            const entries = await readdir(dir, { withFileTypes: true })
            await Promise.all(entries.map(async entry => {
                if (entry.isDirectory()) {
                    if (!SKIP.has(entry.name)) await scanDir(join(dir, entry.name))
                } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
                    try {
                        const code = await readFile(join(dir, entry.name), 'utf-8')

                        // <T>plain text</T> — ignore JSX expressions ({...}) and nested tags
                        const tagRe = /<T(?:\s[^>]*)?>([^<{][^<]*?)<\/T>/g
                        // t('text') / t("text") — ignore template literals for safety
                        const fnRe = /\bt\s*\(\s*['"]([^'"\\]{2,})['"]/g

                        let m: RegExpExecArray | null
                        while ((m = tagRe.exec(code)) !== null) {
                            const text = m[1].replace(/\s+/g, ' ').trim()
                            if (text.length > 1 && !/^\d+(%|px|em|rem|vh|vw)?$/.test(text)) {
                                texts.add(text)
                            }
                        }
                        while ((m = fnRe.exec(code)) !== null) {
                            const text = m[1].replace(/\s+/g, ' ').trim()
                            if (text.length > 1 && !/^\d+(%|px|em|rem|vh|vw)?$/.test(text)) {
                                texts.add(text)
                            }
                        }
                    } catch { /* unreadable file */ }
                }
            }))
        } catch { /* dir doesn't exist */ }
    }

    await scanDir(join(root, 'app'))
    await scanDir(join(root, 'components'))
    return texts
}

// ─── Paginated Supabase select ────────────────────────────────────────────────
async function paginatedSelect(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    table: string,
    columns: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filter?: (q: any) => any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
    const PAGE = 1000
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = []
    let page = 0
    while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = supabase.from(table).select(columns).range(page * PAGE, (page + 1) * PAGE - 1)
        if (filter) q = filter(q)
        const { data, error } = await q
        if (error || !data || data.length === 0) break
        all.push(...data)
        if (data.length < PAGE) break
        page++
    }
    return all
}

// ─── Groq translation with retry ─────────────────────────────────────────────
async function translateBatch(
    batch: string[],
    langName: string,
    langCode: string
): Promise<string[] | null> {
    const prompt =
        `Translate the following JSON array of strings from French to ${langName}.\n` +
        `RULES:\n` +
        `1. Return ONLY a valid JSON array of strings in the EXACT same order.\n` +
        `2. No markdown formatting, explanations, or code blocks.\n` +
        `3. Preserve {variable} placeholders exactly as-is.\n` +
        `4. Preserve HTML tags and their attributes exactly — never translate class names.\n` +
        `5. Natural, fluent, premium-quality translation suitable for a professional services website.\n` +
        `6. If a string is already in the target language or is a proper noun, keep it as-is.\n\n` +
        `French array:\n${JSON.stringify(batch)}`

    try {
        const res = await fetchWithGroqRotation({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are a professional translation API. Output only strict JSON arrays, no prose.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 4096,
        })

        if (!res.ok) {
            console.error(`[Batch/${langCode}] Groq HTTP ${res.status}`)
            return null
        }

        const aiData = await res.json()
        const rawContent: string = aiData?.choices?.[0]?.message?.content ?? ''
        return parseJsonArray(rawContent, batch.length)
    } catch (e) {
        console.error(`[Batch/${langCode}] Groq error:`, e)
        return null
    }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    const trop = guardPublic(req, 'translate/batch', TRANSLATE_LIMIT)
    if (trop) return trop

    try {
        let body: Record<string, unknown> = {}
        try { body = await req.json() } catch { /* no body */ }

        const testMode = Boolean(body.testMode)
        const onlyLang = (typeof body.lang === 'string' && body.lang !== 'fr')
            ? body.lang as LangCode
            : null

        if (GROQ_KEYS.length === 0) {
            return NextResponse.json({ error: 'Clés GROQ_API_KEY (1,2,3) manquantes' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const startTime = Date.now()

        // ── Step 1: Collect ALL translatable texts ──────────────────────────

        const allTexts = new Set<string>()
        const addText = (v: unknown) => {
            if (typeof v === 'string') {
                const t = v.trim()
                if (t.length > 1 && isNaN(Number(t))) allTexts.add(t)
            }
        }

        // 1a — Static UI strings from source files
        let staticCount = 0
        try {
            const staticStrings = await collectStaticStrings()
            staticStrings.forEach(addText)
            staticCount = staticStrings.size
        } catch (e) {
            console.warn('[Batch] Static scan skipped:', e)
        }

        // 1b — Dynamic DB content (all content tables, graceful on missing tables)
        const [
            services, products, testimonials, events, patrimoine,
            natContent, natFaq, natDocs,
            blogs, galleryItems, partenaires, sponsors, steps,
        ] = await Promise.all([
            paginatedSelect(supabase, 'services', 'title,description,short_description').catch(() => []),
            paginatedSelect(supabase, 'products', 'title,description').catch(() => []),
            paginatedSelect(supabase, 'testimonials', 'text,author_role').catch(() => []),
            paginatedSelect(supabase, 'events', 'title,description,location').catch(() => []),
            paginatedSelect(supabase, 'patrimoine', 'title,description').catch(() => []),
            paginatedSelect(supabase, 'nationality_page_content', 'content_fr').catch(() => []),
            paginatedSelect(supabase, 'nationality_faq', 'question_fr,answer_fr').catch(() => []),
            paginatedSelect(supabase, 'nationality_required_docs', 'label_fr,description_fr').catch(() => []),
            paginatedSelect(supabase, 'blog_posts', 'title,excerpt').catch(() => []),
            paginatedSelect(supabase, 'gallery', 'title,description').catch(() => []),
            paginatedSelect(supabase, 'partenaires', 'name,description').catch(() => []),
            paginatedSelect(supabase, 'sponsors', 'name,description').catch(() => []),
            paginatedSelect(supabase, 'process_steps', 'title,description').catch(() => []),
        ])

        services.forEach(s => { addText(s.title); addText(s.description); addText(s.short_description) })
        products.forEach(p => { addText(p.title); addText(p.description) })
        testimonials.forEach(t => { addText(t.text); addText(t.author_role) })
        events.forEach(e => { addText(e.title); addText(e.description); addText(e.location) })
        patrimoine.forEach(p => { addText(p.title); addText(p.description) })
        natContent.forEach(c => { addText(c.content_fr) })
        natFaq.forEach(f => { addText(f.question_fr); addText(f.answer_fr) })
        natDocs.forEach(d => { addText(d.label_fr); addText(d.description_fr) })
        blogs.forEach(b => { addText(b.title); addText(b.excerpt) })
        galleryItems.forEach(g => { addText(g.title); addText(g.description) })
        partenaires.forEach(p => { addText(p.name); addText(p.description) })
        sponsors.forEach(s => { addText(s.name); addText(s.description) })
        steps.forEach(s => { addText(s.title); addText(s.description) })

        // 1c — All previously auto-translated source texts (catches dynamic strings not in above tables)
        const knownTrans = await paginatedSelect(supabase, 'translations', 'source_text').catch(() => [])
        knownTrans.forEach(r => addText(r.source_text))

        const textArray = Array.from(allTexts)

        if (testMode) {
            return NextResponse.json({
                success: true,
                message: 'Scan terminé',
                totalTexts: textArray.length,
                staticStrings: staticCount,
                dbStrings: textArray.length - staticCount,
            })
        }

        if (textArray.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Aucun texte à traduire',
                newTranslations: 0,
                scannedTexts: 0,
            })
        }

        // ── Step 2: Translate for each target language ──────────────────────

        const targetLangs = SUPPORTED_LANGUAGES.filter(
            l => l.code !== 'fr' && (!onlyLang || l.code === onlyLang)
        )

        let totalNew = 0
        let totalErrors = 0
        const perLang: Record<string, { translated: number; skipped: number; errors: number }> = {}

        for (const langConfig of targetLangs) {
            const lang = langConfig.code
            perLang[lang] = { translated: 0, skipped: 0, errors: 0 }

            // Get all existing hashes for this language (paginated)
            const existingRows = await paginatedSelect(
                supabase, 'translations', 'source_hash',
                q => (q as ReturnType<ReturnType<typeof createClient>['from']>['select']).eq('lang', lang)
            ).catch(() => [])

            const existingHashes = new Set(existingRows.map(r => r.source_hash as string))

            // Only translate what's missing
            const missingTexts = textArray.filter(t => !existingHashes.has(hashText(t)))

            if (missingTexts.length === 0) {
                perLang[lang].skipped = textArray.length
                continue
            }

            // Translate in BATCH_SIZE chunks
            for (let i = 0; i < missingTexts.length; i += BATCH_SIZE) {
                // Time budget guard — stop if too close to Vercel limit
                if (Date.now() - startTime > TIME_BUDGET_MS) {
                    console.warn(`[Batch] Time budget exceeded at lang=${lang}, batch ${i}/${missingTexts.length}`)
                    break
                }

                const chunk = missingTexts.slice(i, i + BATCH_SIZE)
                const translated = await translateBatch(chunk, langConfig.groqName, lang)

                if (!translated) {
                    perLang[lang].errors += chunk.length
                    totalErrors += chunk.length
                    console.error(`[Batch/${lang}] Failed to parse batch ${i}-${i + chunk.length}`)
                    continue
                }

                // Build upsert records
                const records = chunk.map((text, idx) => ({
                    source_text: text,
                    source_hash: hashText(text),
                    lang,
                    translated_text: String(translated[idx] ?? text),
                    context: 'batch',
                }))

                const { error: upsertErr } = await supabase
                    .from('translations')
                    .upsert(records, { onConflict: 'source_hash,lang', ignoreDuplicates: false })

                if (upsertErr) {
                    console.error(`[Batch/${lang}] Upsert error:`, upsertErr.message)
                    perLang[lang].errors += chunk.length
                    totalErrors += chunk.length
                } else {
                    perLang[lang].translated += records.length
                    totalNew += records.length
                }
            }
        }

        const elapsed = Math.round((Date.now() - startTime) / 100) / 10

        return NextResponse.json({
            success: true,
            message: `Traduction par lot terminée en ${elapsed}s`,
            scannedTexts: textArray.length,
            staticStrings: staticCount,
            newTranslations: totalNew,
            errors: totalErrors,
            perLang,
        })

    } catch (err: unknown) {
        console.error('[Batch] Fatal error:', err instanceof Error ? err.message : err)
        return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 })
    }
}
