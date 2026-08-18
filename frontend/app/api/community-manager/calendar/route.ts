import { GROQ_MODEL } from '@/lib/groq'
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const GROQ_KEYS = [
    process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3, process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6,
].filter(Boolean) as string[]

const WEEKDAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const SYSTEM_PROMPT = `Tu es un expert en stratégie de contenu pour les réseaux sociaux africains, spécialisé en trading, investissement et création de richesse.

Tu génères des calendriers éditoriaux de 30 jours percutants et réalistes.
Tu retournes UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "calendar": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "weekday": "Lundi",
      "topic": "string (sujet précis et accrocheur)",
      "content_type": "post|reel|story|carrousel|live|sondage",
      "posting_time": "string (ex: 18h30)",
      "hook": "string (phrase d'accroche courte et percutante, max 15 mots)",
      "hashtags": ["string"],
      "brief": "string (description du contenu en 1-2 phrases actionnables)",
      "tone": "inspirant|informatif|urgent|humoristique|storytelling|autoritaire",
      "visual_idea": "string (idée visuelle courte)"
    }
  ]
}`

async function callGroq(systemPrompt: string, userPrompt: string): Promise<string> {
    const shuffled = [...GROQ_KEYS].sort(() => Math.random() - 0.5)
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
                temperature: 0.6,
                max_tokens: 5000,
            })
            return completion.choices[0].message.content || '{}'
        } catch (err) {
            console.warn(`[calendar] Groq key ${i + 1} failed:`, err instanceof Error ? err.message : '')
            if (i === Math.min(shuffled.length, 3) - 1) throw err
        }
    }
    throw new Error('Toutes les clés Groq ont échoué')
}

// POST /api/community-manager/calendar
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            platform = 'facebook',
            topics = [],
            frequency = '3x_semaine',  // daily | 3x_semaine | hebdo
            tone = 'varié',
            language = 'fr',
            start_date,
            style_context,  // JSON string du dossier concurrent (optionnel)
        } = body

        // Calculer les 30 dates
        const startDate = start_date ? new Date(start_date) : new Date()
        const dates: { day: number; date: string; weekday: string }[] = []

        // Nombre de jours selon fréquence
        const FREQ_MAP: Record<string, { totalDays: number; postDays: number[] }> = {
            daily: { totalDays: 30, postDays: [0, 1, 2, 3, 4, 5, 6] },
            '3x_semaine': { totalDays: 30, postDays: [1, 3, 5] }, // Lundi, Mercredi, Vendredi
            hebdo: { totalDays: 30, postDays: [1] }, // Lundi seulement
        }
        const freq = FREQ_MAP[frequency] || FREQ_MAP['3x_semaine']

        for (let i = 0; i < 60 && dates.length < 30; i++) {
            const d = new Date(startDate)
            d.setDate(startDate.getDate() + i)
            const dayOfWeek = d.getDay()
            if (freq.postDays.includes(dayOfWeek)) {
                const dayNum = dates.length + 1
                dates.push({
                    day: dayNum,
                    date: d.toISOString().split('T')[0],
                    weekday: WEEKDAYS_FR[dayOfWeek],
                })
            }
        }

        const langLabel = language === 'fon' ? 'en Fon (langue locale béninoise)' : language === 'en' ? 'en anglais' : 'en français'
        const PLATFORM_LABELS: Record<string, string> = {
            facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok',
            twitter: 'Twitter/X', linkedin: 'LinkedIn', google_maps: 'Google Maps',
        }
        const platformLabel = PLATFORM_LABELS[platform] || platform

        // Types de contenu disponibles par plateforme
        const PLATFORM_CONTENT_TYPES: Record<string, string> = {
            facebook:    'post|reel|story|carrousel|live|sondage',
            instagram:   'post|reel|story|carrousel|sondage',
            tiktok:      'video|live|duet|challenge',
            twitter:     'tweet|thread|poll|quote_tweet',
            linkedin:    'post|article|carrousel|sondage|video',
            google_maps: 'avis|reponse_avis|post_etablissement',
        }
        const contentTypes = PLATFORM_CONTENT_TYPES[platform] || 'post|reel|story|carrousel|live|sondage'

        const topicsStr = topics.length > 0 ? topics.join(', ') : 'trading, investissement, liberté financière, témoignages clients, formation'

        let contextBlock = ''
        if (style_context) {
            try {
                const parsed = typeof style_context === 'string' ? JSON.parse(style_context) : style_context
                const s = parsed.style || {}
                const patterns = parsed.patterns || {}
                contextBlock = `
CONTEXTE CONCURRENT ANALYSÉ :
- Formule virale : "${s.viral_formula || ''}"
- Ton qui fonctionne : ${s.tone || ''}
- Structure : ${s.structure || ''}
- Types de contenu gagnants : ${(s.best_content_types || []).join(', ')}
- Sujets récurrents : ${(patterns.top_topics || []).join(', ')}
- Faiblesses à exploiter : ${((parsed.competitive || {}).weaknesses || []).join(', ')}
- Opportunités : ${((parsed.competitive || {}).opportunities || []).join(', ')}

En t'inspirant de ce concurrent mais en étant meilleur et plus différenciant :`
            } catch { /* style_context ignoré si non parseable */ }
        }

        const datesInfo = dates.slice(0, 30).map(d => `Jour ${d.day}: ${d.date} (${d.weekday})`).join('\n')

        const userPrompt = `Génère un calendrier éditorial de ${dates.length} publications ${platformLabel} ${langLabel} pour Retour Gagnant Bénin (accompagnement en trading, investissement et création de richesse en Afrique).

SUJETS PRIORITAIRES : ${topicsStr}
TON GÉNÉRAL : ${tone}
FRÉQUENCE : ${frequency === 'daily' ? 'quotidien' : frequency === '3x_semaine' ? '3 fois par semaine' : 'hebdomadaire'}
${contextBlock}

DATES DE PUBLICATION (à respecter exactement) :
${datesInfo}

Règles :
- Varie les formats disponibles pour ${platformLabel} : ${contentTypes}
- Alterne les tons (inspirant, éducatif, urgent, storytelling)
- Inclus des témoignages, tips pratiques, coulisses, offres
- Hooks courts et percutants (max 15 mots)
- Hashtags locaux et niche (3-7 par post)
- Meilleur horaire selon le jour de la semaine

Retourne les ${dates.length} jours en JSON.`

        const rawJson = await callGroq(SYSTEM_PROMPT, userPrompt)

        let result: { calendar?: unknown[] } = {}
        try {
            result = JSON.parse(rawJson)
        } catch {
            console.warn('[calendar] JSON.parse failed:', rawJson?.slice(0, 200))
            return NextResponse.json({ error: 'Réponse IA invalide, veuillez réessayer.' }, { status: 502 })
        }

        if (!Array.isArray(result.calendar) || result.calendar.length === 0) {
            return NextResponse.json({ error: 'Calendrier vide. Veuillez réessayer.' }, { status: 502 })
        }

        // Normaliser chaque jour
        const calendar = result.calendar.map((day: unknown, i: number) => {
            const d = (day && typeof day === 'object' ? day : {}) as Record<string, unknown>
            const dateInfo = dates[i] || dates[dates.length - 1]
            return {
                day: Number(d.day ?? i + 1),
                date: String(d.date || dateInfo?.date || ''),
                weekday: String(d.weekday || dateInfo?.weekday || ''),
                topic: String(d.topic || ''),
                content_type: String(d.content_type || 'post'),
                posting_time: String(d.posting_time || '18h30'),
                hook: String(d.hook || ''),
                hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(String) : [],
                brief: String(d.brief || ''),
                tone: String(d.tone || 'inspirant'),
                visual_idea: String(d.visual_idea || ''),
            }
        })

        return NextResponse.json({
            success: true,
            calendar,
            total: calendar.length,
            platform,
            frequency,
            language,
        })
    } catch (err) {
        console.error('[calendar] Error:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
