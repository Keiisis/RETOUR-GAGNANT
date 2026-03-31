import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq';
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashText } from '@/lib/translation/hash'
import { SUPPORTED_LANGUAGES, type LangCode } from '@/lib/translation'

// ═══════════════════════════════════════════════════════
// Translation API Endpoint
// 1. Checks Supabase batch
// 2. Translates missing texts via Groq Llama 3.3
// 3. Saves new translations to Supabase
// ═══════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!


export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { texts, lang }: { texts: string[], lang: LangCode } = body

        if (!texts || texts.length === 0 || !lang || lang === 'fr') {
            return NextResponse.json({ translations: {} })
        }

        const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === lang)
        if (!langConfig) {
            return NextResponse.json({ error: 'Unsupported language' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Calculate hashes
        const textHashes: Record<string, string> = {}
        const hashArray: string[] = []

        for (const text of texts) {
            const h = hashText(text)
            textHashes[h] = text
            hashArray.push(h)
        }

        // 2. Check cache in Supabase
        const { data: cached } = await supabase
            .from('translations')
            .select('source_hash, translated_text')
            .eq('lang', lang)
            .in('source_hash', hashArray)

        const translations: Record<string, string> = {}
        const missingTexts: { hash: string, text: string }[] = []

        // Fill translations from cache
        const cachedHashes = new Set(cached?.map(c => c.source_hash) || [])
        if (cached) {
            for (const row of cached) {
                const originalText = textHashes[row.source_hash]
                if (originalText) {
                    translations[originalText] = row.translated_text
                }
            }
        }

        // Find missing ones
        for (const h of hashArray) {
            if (!cachedHashes.has(h)) {
                missingTexts.push({ hash: h, text: textHashes[h] })
            }
        }

        // 3. If everything is cached, return early
        if (missingTexts.length === 0) {
            return NextResponse.json({
                translations,
                fromCache: hashArray.length,
                newlyTranslated: 0
            })
        }

        // 4. Translate missing texts with Groq
        if (missingTexts.length > 0 && GROQ_KEYS.length > 0) {
            const textsToTranslate = missingTexts.map(m => m.text)

            const prompt = `Translate the following JSON array of strings from French to ${langConfig.groqName}. 
CRITICAL RULES:
1. Return ONLY a valid JSON array of strings in the exact same order.
2. DO NOT add any markdown formatting, explanations, or notes.
3. Preserve shortcodes like {name}, {RG}, {RGB1}, {RGB2} exactly as they are.
4. IMPORTANT: Translate everything to a natural, high-quality translation for a premium service. For the exact phrase "VOTRE RETOUR GAGNANT", translate it as "YOUR WINNING RETURN" or similar. But DO NOT translate the tags {RG}, {RGB1}, {RGB2} if they appear.
5. EXTREMELY IMPORTANT: Preserve ANY and ALL HTML tags exactly identical. Do not modify or remove attributes like 'class', 'className', 'style'. Do not translate the class names or style values.

French array:
${JSON.stringify(textsToTranslate)}`

            const aiRes = await fetchWithGroqRotation({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a translation API. You only output strict JSON arrays.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1, // low temperature for consistency
                max_tokens: 4000
            })

            if (aiRes.ok) {
                const aiData = await aiRes.json()
                const aiContent = aiData.choices[0].message.content.trim()

                // Clean markdown from AI just in case it disobeys
                const cleanContent = aiContent.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim()

                try {
                    const translatedArray = JSON.parse(cleanContent)

                    if (Array.isArray(translatedArray) && translatedArray.length === missingTexts.length) {
                        const recordsToInsert = []

                        for (let i = 0; i < missingTexts.length; i++) {
                            const original = missingTexts[i].text
                            const translated = translatedArray[i]

                            translations[original] = translated

                            recordsToInsert.push({
                                source_text: original,
                                source_hash: missingTexts[i].hash,
                                lang: lang,
                                translated_text: translated,
                                context: 'auto'
                            })
                        }

                        // 5. Save to Supabase (awaited for reliability)
                        if (recordsToInsert.length > 0) {
                            const { error: upsertErr } = await supabase.from('translations')
                                .upsert(recordsToInsert, { onConflict: 'source_hash,lang' })
                            if (upsertErr) console.error('Error saving translations:', upsertErr)
                        }
                    }
                } catch (parseErr) {
                    console.error('Failed to parse Groq response:', cleanContent, parseErr)
                }
            }
        }

        return NextResponse.json({
            translations,
            fromCache: hashArray.length - missingTexts.length,
            newlyTranslated: Object.keys(translations).length - (hashArray.length - missingTexts.length)
        })

    } catch (err: unknown) {
        console.error('Translation API error:', err instanceof Error ? err.message : '')
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
