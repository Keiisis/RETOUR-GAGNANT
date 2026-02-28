import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createGroq } from '@ai-sdk/groq'

export async function POST(req: Request) {
    try {
        const { query, context } = await req.json()

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json(
                { answer: "Veuillez configurer la clé API Groq (GROQ_API_KEY) pour utiliser l'Assistant IA." },
                { status: 500 }
            )
        }

        const groq = createGroq({
            apiKey: process.env.GROQ_API_KEY,
        })

        const systemPrompt = `Tu es l'assistant IA de l'intranet Retour Gagnant.
Ton rôle est d'aider les agents du service client à trouver des réponses rapidement ou à rédiger des articles pour la base de connaissances.
Voici les articles de la base de connaissances (Wiki) actuellement disponibles en contexte:
${JSON.stringify(context)}

Si la réponse se trouve dans le contexte, utilise-la pour formuler une réponse claire, directe et professionnelle. 
Si la réponse ne s'y trouve pas, réponds à la question de manière experte (en tant qu'expert juridique et administratif français) et suggère à l'agent d'ajouter cette réponse au Wiki.`

        const { text } = await generateText({
            model: groq('llama3-8b-8192'),
            system: systemPrompt,
            prompt: query,
        })

        return NextResponse.json({ answer: text })
    } catch (error) {
        console.error('Erreur API ask:', error)
        return NextResponse.json({ error: 'Failed to answer query' }, { status: 500 })
    }
}
