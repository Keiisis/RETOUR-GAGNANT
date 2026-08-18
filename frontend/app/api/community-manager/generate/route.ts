import { GROQ_MODEL } from '@/lib/groq'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groqApiKeys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
    process.env.GROQ_API_KEY_6,
    process.env.GROQ_API_KEY,
].filter(Boolean) as string[]

async function callGroqWithRetry(systemPrompt: string, userPrompt: string): Promise<string> {
    const shuffled = [...groqApiKeys].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(shuffled.length, 3); i++) {
        try {
            const groq = new Groq({ apiKey: shuffled[i] })
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                model: GROQ_MODEL,
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 3000,
            })
            return completion.choices[0].message.content || '{}'
        } catch (err) {
            console.warn(`[generate] Groq key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

const SYSTEM_PROMPT = `Tu es un expert en création de contenus viraux pour les réseaux sociaux africains.
Tu crées des publications percutantes pour Retour Gagnant Bénin, une entreprise d'accompagnement à l'investissement et au trading au Bénin.
Tu génères 3 variantes de publications différentes en termes de style et d'approche.
Tu retournes UNIQUEMENT un objet JSON valide :
{
  "variants": [
    {
      "id": 1,
      "text": "string (texte complet de la publication)",
      "hashtags": ["string", ...] (5-10 hashtags pertinents),
      "best_time": "string (ex: Lundi-Vendredi 18h-20h)",
      "viral_tips": ["string", "string"] (2 conseils pour maximiser la portée),
      "emoji_suggestions": ["string", ...] (emojis recommandés),
      "style_label": "string (ex: Inspirant, Éducatif, Urgent...)",
      "estimated_engagement": "string (faible/moyen/élevé/viral)"
    },
    { "id": 2, ... },
    { "id": 3, ... }
  ]
}`

// POST /api/community-manager/generate
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            topic,
            platform,
            tone,
            target_audience,
            style_inspiration,
            language = 'fr',
            dossier_context,
        } = body

        if (!topic?.trim()) {
            return NextResponse.json({ error: 'Le sujet est obligatoire.' }, { status: 400 })
        }

        // Parser le dossier concurrent si fourni
        let dossierBlock = ''
        if (dossier_context?.trim()) {
            try {
                const d = JSON.parse(dossier_context)
                const style = d.style || {}
                const competitive = d.competitive || {}
                const meta = d.meta || {}
                dossierBlock = `
DOSSIER CONCURRENT @${meta.username || 'inconnu'} (${meta.platform || platform}) :
- Formule virale : "${style.viral_formula || ''}"
- Ton : ${style.tone || ''}
- Structure : ${style.structure || ''}
- Hooks efficaces : ${(style.hooks || []).slice(0, 3).join(' / ')}
- Triggers d'engagement : ${(style.engagement_triggers || []).join(', ')}
- Faiblesses à exploiter : ${(competitive.weaknesses || []).join(', ')}
- Opportunités non exploitées : ${(competitive.opportunities || []).join(', ')}

MISSION : Crée du contenu qui utilise les forces de ce concurrent mais surpasse ses faiblesses.`
            } catch {
                // Dossier non parseable → ignorer silencieusement
            }
        }

        const langLabel = language === 'fon' ? 'en Fon (langue locale béninoise)' : language === 'en' ? 'en anglais' : 'en français'
        const platformLabel = platform || 'réseaux sociaux'

        const userPrompt = `Crée 3 variantes de publications ${platformLabel} ${langLabel} sur ce sujet :

SUJET : ${topic}
TON SOUHAITÉ : ${tone || 'inspirant'}
AUDIENCE CIBLE : ${target_audience || 'investisseurs et entrepreneurs béninois'}
${style_inspiration ? `INSPIRATION DE STYLE : ${style_inspiration}` : ''}
${dossierBlock}

Contexte : Retour Gagnant Bénin accompagne des personnes dans le trading, l'investissement et la création de richesse en Afrique.

Génère 3 variantes très différentes les unes des autres (style, longueur, accroche différents).`

        const rawJson = await callGroqWithRetry(SYSTEM_PROMPT, userPrompt)

        let result: { variants?: unknown[] } = {}
        try {
            result = JSON.parse(rawJson)
        } catch {
            console.warn('[generate] JSON.parse failed, raw:', rawJson?.slice(0, 200))
            return NextResponse.json({ error: 'Réponse IA invalide, veuillez réessayer.' }, { status: 502 })
        }

        // S'assurer que variants est un tableau non-vide
        if (!Array.isArray(result.variants) || result.variants.length === 0) {
            console.warn('[generate] variants manquants dans la réponse:', rawJson?.slice(0, 300))
            return NextResponse.json({ error: 'L\'IA n\'a pas retourné de variantes. Veuillez réessayer.' }, { status: 502 })
        }

        // Normaliser chaque variante
        const variants = result.variants.map((v: unknown, i: number) => {
            const variant = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
            return {
                id: Number(variant.id ?? i + 1),
                text: String(variant.text || ''),
                hashtags: Array.isArray(variant.hashtags) ? variant.hashtags.map(String) : [],
                best_time: String(variant.best_time || 'Lundi-Vendredi 18h-20h'),
                viral_tips: Array.isArray(variant.viral_tips) ? variant.viral_tips.map(String) : [],
                emoji_suggestions: Array.isArray(variant.emoji_suggestions) ? variant.emoji_suggestions.map(String) : [],
                style_label: String(variant.style_label || 'Standard'),
                estimated_engagement: String(variant.estimated_engagement || 'moyen'),
            }
        })

        return NextResponse.json({ success: true, variants, topic, platform, tone, language })
    } catch (err) {
        console.error('[generate] Error:', err)
        const message = err instanceof Error ? err.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
