import { NextResponse } from 'next/server'
import { fetchWithGroqRotation, GROQ_MODEL } from '@/lib/groq'

export async function POST(req: Request) {
    let lang = 'fr'
    try {
        const { query, context, lang: reqLang } = await req.json()
        if (typeof reqLang === 'string') lang = reqLang

        if (!query || typeof query !== 'string' || !query.trim()) {
            return NextResponse.json({ error: 'Requête vide.' }, { status: 400 })
        }

        const langMap: Record<string, string> = {
            fr: 'French', en: 'English', es: 'Spanish',
            pt: 'Portuguese', cr: 'Guadeloupean Creole', ht: 'Haitian Creole',
        }
        const targetLang = langMap[lang] || 'French'
        const langInstruction = lang !== 'fr'
            ? `\n\nCRITICAL: The agent is using the interface in ${targetLang}. Respond in ${targetLang}.`
            : ''

        const systemPrompt = `Tu es l'assistant IA de l'intranet Retour Gagnant Bénin.
Ton rôle est d'aider les agents du service client à trouver des réponses rapidement ou à rédiger des articles pour la base de connaissances.
Tu es expert en droit de la nationalité béninoise, immigration, patrimoine immobilier au Bénin, et services pour la diaspora africaine.

Voici les articles de la base de connaissances (Wiki) actuellement disponibles en contexte :
${JSON.stringify(context || [])}

Si la réponse se trouve dans le contexte, utilise-la pour formuler une réponse claire, directe et professionnelle.
Si la réponse ne s'y trouve pas, réponds de manière experte en tant que spécialiste du droit béninois et des services diaspora, et suggère à l'agent d'ajouter cette réponse au Wiki.
Sois concis, structuré et utile.${langInstruction}`

        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query.trim() },
            ],
            temperature: 0.4,
            max_tokens: 1500,
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('[Wiki/Ask] Groq error:', errText)
            return NextResponse.json(
                { error: "Erreur de connexion à l'IA. Veuillez réessayer." },
                { status: 502 }
            )
        }

        const data = await res.json()
        const answer = data?.choices?.[0]?.message?.content?.trim() || "Je n'ai pas pu générer de réponse."

        return NextResponse.json({ answer })
    } catch (error) {
        console.error('[Wiki/Ask] Error:', error)
        return NextResponse.json(
            { error: 'Erreur serveur. Veuillez réessayer.' },
            { status: 500 }
        )
    }
}
