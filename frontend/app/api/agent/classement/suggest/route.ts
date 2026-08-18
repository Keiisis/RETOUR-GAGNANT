import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { fetchWithGroqRotation, GROQ_KEYS, GROQ_MODEL } from '@/lib/groq'
import { getCategory, getStatus, daysSince } from '@/lib/classement/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ══════════════════════════════════════════════════════════════
// POST /api/agent/classement/suggest { id }
// Conseils IA à la demande pour un client (depuis l'UI).
// ══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: c } = await supabase
        .from('client_classement')
        .select('full_name, service_category, status, notes, first_contact_at')
        .eq('id', id).maybeSingle()
    if (!c) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

    if (GROQ_KEYS.length === 0) {
        return NextResponse.json({ suggestions: "Assistant IA non configuré. Recontactez le client et planifiez la prochaine action concrète." })
    }

    const days = daysSince(c.first_contact_at)
    try {
        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `Tu es un conseiller senior de Retour Gagnant Bénin (accompagnement diaspora). Donne 3 actions CONCRÈTES, professionnelles et priorisées pour faire avancer ce dossier client, selon le service et les problèmes notés. Réponds en français, 3 puces commençant par "• ", courtes et actionnables. Aucun markdown autre que les puces, aucune introduction.`,
                },
                {
                    role: 'user',
                    content: `Service : ${getCategory(c.service_category).label}\nStatut : ${getStatus(c.status).label}\nJours depuis le 1er contact : ${days}\nNotes / problèmes : ${c.notes?.trim() || '(aucune note)'}\nClient : ${c.full_name || '-'}`,
                },
            ],
            temperature: 0.5,
            max_tokens: 320,
        })
        const data = await res.json()
        const txt = data.choices?.[0]?.message?.content?.trim()
        return NextResponse.json({ suggestions: txt || 'Aucune suggestion générée. Réessayez.' })
    } catch {
        return NextResponse.json({ error: 'Génération impossible' }, { status: 500 })
    }
}
