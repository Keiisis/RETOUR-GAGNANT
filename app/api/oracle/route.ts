import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { groq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

interface OracleAnswers {
    lien_benin?: string;
    preuve_origine?: string[];
    motivation?: string;
    pays_residence?: string;
    message_libre?: string;
    origin?: string;
    objective?: string;
    timeline?: string;
    budget?: string;
    experience?: string;
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
        const finalScore = Math.min(rec.score + bonusScore, 100);

        // Generate dynamic insights using Groq
        let dynamicInsights = [
            "Vos origines offrent un excellent potentiel pour cette démarche.",
            "L'analyse des documents mentionnés est très positive."
        ];

        try {
            if (process.env.GROQ_API_KEY) {
                const { object } = await generateObject({
                    model: groq('llama-3.3-70b-versatile'),
                    schema: z.object({
                        insights: z.array(z.string()).describe("3 points clés très pertinents, vendeurs et rassurants (max une phrase par point) concernant l'éligibilité de cette personne à la nationalité béninoise, ou son retour au Bénin. Parlez directement à la personne (ex: 'Votre profil...', 'Le fait que vous ayez...')"),
                    }),
                    prompt: `Analysez ce profil d'une personne voulant obtenir la nationalité béninoise ou retourner au Bénin :
Prenom: ${prenom}
Pays de résidence: ${answers.pays_residence || 'Non défini'}
Lien avec le Bénin: ${answers.lien_benin || 'Non défini'}
Preuves d'origine: ${(answers.preuve_origine || []).join(', ')}
Motivation principale: ${answers.motivation || 'Non défini'}
Message libre: ${answers.message_libre || 'Aucun'}

Générez 3 insights ou commentaires inspirants pertinents basés précisément sur ces éléments. Exprimez-vous de manière professionnelle, rassurante et très "premium".`,
                });

                dynamicInsights = object.insights;
            } else {
                console.log("GROQ_API_KEY non configurée, utilisation des insights par défaut.");
            }
        } catch (aiError) {
            console.error("Erreur lors de la génération avec Groq:", aiError);
            // On continue avec les insights par défaut si l'IA échoue
        }


        const supabase = createClient(supabaseUrl, supabaseKey)

        const { error } = await supabase.from('eligibility_results').insert({
            client_nom: nom || '',
            client_prenom: prenom || '',
            client_email: email || '',
            client_whatsapp: whatsapp || '',
            answers: answers,
            recommended_service: rec.service,
            recommended_slug: rec.slug,
            eligibility_score: finalScore,
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
                score: finalScore,
                hasOrigins,
                insights: dynamicInsights
            }
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur serveur'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
