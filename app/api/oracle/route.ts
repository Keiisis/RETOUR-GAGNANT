import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface OracleAnswers {
    origin: string
    objective: string
    timeline: string
    budget: string
    experience: string
}

const recommendations: Record<string, { service: string, slug: string, score: number }> = {
    'nationalite': { service: 'Passeport & Documents', slug: 'passeport', score: 95 },
    'investir': { service: 'Investissement', slug: 'investissement', score: 88 },
    'construire': { service: 'Construction', slug: 'construction', score: 90 },
    'business': { service: "Création d'Entreprise", slug: 'business', score: 85 },
    'culture': { service: 'Guide Culturel', slug: 'culture', score: 92 },
    'logement': { service: 'Acheter ou Louer', slug: 'logement', score: 87 },
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nom, prenom, email, whatsapp, answers } = body as {
            nom: string
            prenom: string
            email: string
            whatsapp: string
            answers: OracleAnswers
        }

        if (!answers || !answers.objective) {
            return NextResponse.json({ error: 'Réponses incomplètes' }, { status: 400 })
        }

        // Determine recommended service
        const rec = recommendations[answers.objective] || recommendations['culture']
        const hasOrigins = answers.origin === 'oui' || answers.origin === 'partiel'
        const bonusScore = hasOrigins ? 5 : 0

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { error } = await supabase.from('eligibility_results').insert({
            client_nom: nom || '',
            client_prenom: prenom || '',
            client_email: email || '',
            client_whatsapp: whatsapp || '',
            answers: answers,
            recommended_service: rec.service,
            recommended_slug: rec.slug,
            eligibility_score: Math.min(rec.score + bonusScore, 100),
            has_origins: hasOrigins,
            objective: answers.objective,
            is_contacted: false,
        })

        if (error) throw error

        return NextResponse.json({
            success: true,
            result: {
                service: rec.service,
                slug: rec.slug,
                score: Math.min(rec.score + bonusScore, 100),
                hasOrigins,
            }
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
