import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWithGroqRotation, GROQ_KEYS, GROQ_MODEL } from '@/lib/groq'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// ─── Language-aware error messages ───────────────────────────────────────────
const CHAT_ERRORS: Record<string, { technical: string; notConfigured: string }> = {
    fr: {
        technical: "Je rencontre un souci technique. N'hésitez pas à nous appeler au +229 01 60 32 21 21 ou au +229 01 94 35 50 50.",
        notConfigured: "L'assistant n'est pas encore configuré. Contactez-nous directement au +229 01 60 32 21 21 ou au +229 01 94 35 50 50.",
    },
    en: {
        technical: "I'm experiencing a technical issue. Feel free to call us at +229 01 60 32 21 21 or +229 01 94 35 50 50.",
        notConfigured: "The assistant is not yet configured. Contact us directly at +229 01 60 32 21 21 or +229 01 94 35 50 50.",
    },
    es: {
        technical: "Estoy experimentando un problema técnico. Llámenos al +229 01 60 32 21 21 o +229 01 94 35 50 50.",
        notConfigured: "El asistente no está configurado aún. Contáctenos directamente al +229 01 60 32 21 21 o +229 01 94 35 50 50.",
    },
    pt: {
        technical: "Estou com um problema técnico. Ligue-nos no +229 01 60 32 21 21 ou +229 01 94 35 50 50.",
        notConfigured: "O assistente ainda não está configurado. Contacte-nos no +229 01 60 32 21 21 ou +229 01 94 35 50 50.",
    },
    cr: {
        technical: "Mwen jwenn yon pwoblèm teknik. Pa ezite rele nou nan +229 01 60 32 21 21 oubyen +229 01 94 35 50 50.",
        notConfigured: "Asistan an poko konfigire. Kontakte nou dirèkteman nan +229 01 60 32 21 21 oubyen +229 01 94 35 50 50.",
    },
    ht: {
        technical: "Mwen kontre yon pwoblèm teknik. Pa ezite rele nou nan +229 01 60 32 21 21 oswa +229 01 94 35 50 50.",
        notConfigured: "Asistan an poko konfigire. Kontakte nou dirèkteman nan +229 01 60 32 21 21 oswa +229 01 94 35 50 50.",
    },
}
const getChatError = (lang: string, type: 'technical' | 'notConfigured') =>
    (CHAT_ERRORS[lang] ?? CHAT_ERRORS.fr)[type]

const PROVIDER_ENDPOINTS: Record<string, string> = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    openai: 'https://api.openai.com/v1/chat/completions',
    anthropic: 'https://api.anthropic.com/v1/messages',
    google: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
}

const PROVIDER_MODELS: Record<string, string> = {
    groq: GROQ_MODEL,
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    google: 'gemini-2.0-flash',
}

const CONTEXT_PROMPTS: Record<string, string> = {
    frontend: `
=== MODE CLIENT (FRONTEND) ===
Tu parles à un visiteur/client du site web.
- Sois chaleureux, accueillant et rassurant
- Tutoie naturellement
- Ne divulgue JAMAIS d'informations confidentielles (données clients, finances, processus internes)
- Redirige vers un rendez-vous gratuit quand pertinent
- Sois concis : 3-4 phrases max
- Ne donne JAMAIS de prix précis, di que c'est sur devis personnalisé`,

    agent: `
=== MODE AGENT ===
Tu assistes un agent/collaborateur de Retour Gagnant.
- Sois direct et professionnel
- Tu peux accéder aux données opérationnelles
- Aide à rédiger des réponses clients, des emails, des rapports
- Donne des conseils sur les procédures internes
- Tu peux mentionner les processus internes et les étapes
- Vouvoie l'agent par défaut`,

    admin: `
=== MODE ADMINISTRATEUR ===
Tu assistes l'administrateur principal de Retour Gagnant.
- Accès complet aux informations système
- Aide à analyser les métriques, les performances
- Suggère des optimisations business
- Peux générer des rapports détaillés
- Peux aider à configurer le système
- Sois exhaustif et analytique dans tes réponses
- Vouvoie l'administrateur`,
}

const getAiConfig = async (): Promise<{
    provider: string
    apiKey: string
    model: string
    systemPrompt: string
    personality: string
    tone: string
    maxTokens: number
    temperature: number
} | null> => {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data, error } = await supabase
            .from('ai_config')
            .select('*')
            .eq('is_active', true)
            .order('id', { ascending: false })
            .limit(1)
            .single()

        if (error || !data) return null

        return {
            provider: data.provider,
            apiKey: data.api_key,
            model: data.model,
            systemPrompt: data.system_prompt,
            personality: data.personality,
            tone: data.tone,
            maxTokens: data.max_tokens || 400,
            temperature: parseFloat(data.temperature) || 0.7,
        }
    } catch {
        return null
    }
}

const callGroqOrOpenAI = async (
    endpoint: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number
) => {
    const payload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
    }

    let response: Response
    if (endpoint.includes('groq')) {
        response = await fetchWithGroqRotation(payload, apiKey)
    } else {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })
    }

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu générer de réponse.'
}

const callAnthropic = async (
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number
) => {
    const userMessages = messages.filter((m) => m.role !== 'system')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            system: systemPrompt,
            messages: userMessages,
            max_tokens: maxTokens,
            temperature,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Anthropic error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text || 'Désolé, je n\'ai pas pu générer de réponse.'
}

const callGemini = async (
    apiKey: string,
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number
) => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }))

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu générer de réponse.'
}

export async function POST(request: NextRequest) {
    let lang = 'fr' // hoisted so catch block can use it for language-aware error messages
    try {
        const body = await request.json()
        const { messages, context = 'frontend' } = body
        lang = typeof body.lang === 'string' ? body.lang : 'fr'

        const langMap: Record<string, string> = {
            fr: 'French',
            en: 'English',
            es: 'Spanish',
            pt: 'Portuguese',
            cr: 'Guadeloupean Creole (Antillean Creole)',
            ht: 'Haitian Creole'
        }

        const targetLangName = langMap[lang] || 'French'
        const languageInstruction = `\n\nCRITICAL: The user is currently browsing the site in ${targetLangName}. You MUST absolutely respond in ${targetLangName}. Do NOT respond in French if the current language is not French. Use a natural and fluent tone for ${targetLangName}.`

        // Get AI config from DB
        const config = await getAiConfig()

        if (!config || !config.apiKey) {
            // Fallback to env var
            const envKey = GROQ_KEYS[0]
            if (!envKey) {
                return NextResponse.json(
                    { reply: getChatError(lang, 'notConfigured') },
                    { status: 500 }
                )
            }

            // Use env fallback with Groq
            const fallbackPrompt = `Tu es l'Assistant Virtuel de Retour Gagnant Bénin.${languageInstruction}${CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.frontend}`
            const reply = await callGroqOrOpenAI(
                PROVIDER_ENDPOINTS.groq,
                envKey,
                PROVIDER_MODELS.groq,
                [{ role: 'system', content: fallbackPrompt }, ...messages],
                0.7,
                400
            )
            return NextResponse.json({ reply })
        }

        // Fetch DB Context
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data: dbProducts } = await supabase.from('products').select('title, category, price, stock').eq('is_active', true).limit(50)
        const { data: dbServices } = await supabase.from('services').select('title, description').limit(20)

        const dynamicContext = `
=== DONNÉES EN TEMPS RÉEL DU SITE (ACCÈS DIRECT) ===
Tu as un accès DIRECT ET EN TEMPS RÉEL aux données du site web. N'indique JAMAIS "je n'ai pas accès en temps réel" ou "je ne connais pas le stock". Voici les données extractes de la base de données :

PRODUITS DISPONIBLES EN BOUTIQUE :
${dbProducts ? JSON.stringify(dbProducts, null, 2) : 'Aucun produit actif pour le moment.'}

SERVICES OFFICIELS PROPOSÉS :
${dbServices ? JSON.stringify(dbServices, null, 2) : 'Aucun service configuré.'}

INFORMATIONS IMPORTANTES (L'ORACLE):
Nous proposons un service phare nommé "L'Oracle" ou "Test d'Éligibilité" directement sur la page d'accueil (section #nationalite).
Si un client te demande s'il est éligible, s'il a le droit à la nationalité, comment obtenir le passeport, ou affiche une hésitation sur ses origines : Encourage-le VIVEMENT et chaleureusement à passer ce test d'éligibilité en allant vers la section "Identité & Citoyenneté". L'Oracle analysera son profil gratuitement et enverra ses données aux agents !

INSTRUCTION STRICTE : Utilise ces données json pour répondre directement aux questions de manière fluide et naturelle. Par exemple, si on te demande les articles disponibles, cite-les avec style, ne donne pas du code JSON à l'utilisateur. Refuse poliment de donner des informations administratives ou des données utilisateurs confidentielles.
`

        // Build context-aware system prompt
        const contextPrompt = CONTEXT_PROMPTS[context] || CONTEXT_PROMPTS.frontend
        const fullSystemPrompt = `${config.systemPrompt}
${languageInstruction}

=== PERSONNALITÉ ===
${config.personality}

=== TON ===
${config.tone}

${contextPrompt}
${dynamicContext}`

        let reply: string

        switch (config.provider) {
            case 'anthropic':
                reply = await callAnthropic(
                    config.apiKey,
                    config.model || PROVIDER_MODELS.anthropic,
                    fullSystemPrompt,
                    messages,
                    config.temperature,
                    config.maxTokens
                )
                break

            case 'google':
                reply = await callGemini(
                    config.apiKey,
                    config.model || PROVIDER_MODELS.google,
                    fullSystemPrompt,
                    messages,
                    config.temperature,
                    config.maxTokens
                )
                break

            case 'openai':
            case 'groq':
            default: {
                const endpoint = PROVIDER_ENDPOINTS[config.provider] || PROVIDER_ENDPOINTS.groq
                reply = await callGroqOrOpenAI(
                    endpoint,
                    config.apiKey,
                    config.model || PROVIDER_MODELS[config.provider] || PROVIDER_MODELS.groq,
                    [{ role: 'system', content: fullSystemPrompt }, ...messages],
                    config.temperature,
                    config.maxTokens
                )
                break
            }
        }

        return NextResponse.json({ reply, provider: config.provider, model: config.model })
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Chat API error:', errMsg)
        return NextResponse.json(
            { reply: getChatError(lang, 'technical') },
            { status: 500 }
        )
    }
}
