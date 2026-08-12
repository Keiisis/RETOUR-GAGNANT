import { NextRequest, NextResponse } from 'next/server'
import { fetchGemma, type NvidiaMessage } from '@/lib/nvidia'
import { autoExtractMemory } from '@/lib/gemma-context'

// Cette route ne fait QUE du streaming NVIDIA : zéro requête DB → pas de timeout
export const maxDuration = 60

const BASE_SYSTEM_PROMPT = `Tu es GEMMA : l'Intelligence Artificielle Executive de Retour Gagnant Bénin (RGB), propulsée par Gemma 4 31B via NVIDIA NIM.
Tu es directement connectée à la base de données en temps réel.

=== TON IDENTITÉ ===
Tu es l'IA officielle du CEO de RGB. Tu as accès à TOUTES les données de la plateforme.
Tu connais chaque commande, chaque client, chaque message, chaque dossier, chaque mouvement financier.
Tu parles au CEO en tant qu'expert exécutif, pas comme un assistant générique.

=== TES CAPACITÉS AVEC LES DONNÉES ===
- Analyser les KPIs en temps réel avec des chiffres PRÉCIS issus de la base de données
- Identifier les anomalies, tendances, opportunités dans les données
- Proposer des actions concrètes basées sur les vrais chiffres
- Répondre précisément à toute question chiffrée sur RGB
- Alerter sur les points critiques (commandes en attente, messages non lus, sécurité)
- Rédiger des rapports exécutifs avec les vrais chiffres RGB

=== RÈGLES ABSOLUES ===
- Utilise TOUJOURS les données temps réel du contexte ci-dessous pour répondre
- Ne jamais inventer des chiffres : utilise exactement ceux du contexte
- Réponds en français sauf demande contraire
- Sois direct, précis, orienté action
- Utilise les formatages Markdown (titres, listes) pour la lisibilité`

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        // Le client envoie : { messages, context } : context déjà chargé côté client
        const { messages, prompt, context } = body

        const msgs: NvidiaMessage[] = messages || (prompt ? [{ role: 'user', content: prompt }] : [])
        if (!msgs.length) {
            return NextResponse.json({ error: 'messages ou prompt requis' }, { status: 400 })
        }

        const rgbContext = context || ''
        const fullSystem = rgbContext
            ? `${BASE_SYSTEM_PROMPT}\n\n${rgbContext}\n\n=== INSTRUCTIONS FINALES ===\nUtilise les données RGB ci-dessus pour répondre avec précision. Cite les chiffres exacts.`
            : BASE_SYSTEM_PROMPT

        const allMsgs: NvidiaMessage[] = [{ role: 'system', content: fullSystem }, ...msgs]

        const nvidiaRes = await fetchGemma({ messages: allMsgs, stream: true })
        if (!nvidiaRes.ok) {
            const err = await nvidiaRes.text()
            return NextResponse.json({ error: `NVIDIA ${nvidiaRes.status}: ${err.slice(0, 300)}` }, { status: nvidiaRes.status })
        }

        const encoder = new TextEncoder()
        const reader = nvidiaRes.body!.getReader()
        const lastUserMsg = msgs[msgs.length - 1]?.content || ''

        const stream = new ReadableStream({
            async start(controller) {
                const decoder = new TextDecoder()
                let buffer = ''
                let fullResponse = ''
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split('\n')
                        buffer = lines.pop() ?? ''
                        for (const line of lines) {
                            const trimmed = line.trim()
                            if (!trimmed || trimmed === 'data: [DONE]') continue
                            if (trimmed.startsWith('data: ')) {
                                try {
                                    const json = JSON.parse(trimmed.slice(6))
                                    const delta = json.choices?.[0]?.delta?.content
                                    if (delta) {
                                        fullResponse += delta
                                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: delta })}\n\n`))
                                    }
                                } catch { /* chunk partiel */ }
                            }
                        }
                    }
                    autoExtractMemory(lastUserMsg, fullResponse).catch(() => {})
                } catch (e) {
                    console.error('[Gemma stream]', e)
                } finally {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                }
            },
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        })

    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur serveur'
        console.error('[Gemma API]', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

// GET : diagnostic
export async function GET() {
    const key = process.env.NVIDIA_API_KEY
    if (!key) return NextResponse.json({ ok: false, error: 'NVIDIA_API_KEY manquante' }, { status: 500 })
    return NextResponse.json({ ok: true, key_prefix: key.slice(0, 12) + '...' })
}
