import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWithGroqRotation } from '@/lib/groq';
import { sendEmail, getEmailTemplates, getEmailConfig } from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

const serviceMapping: Record<string, { service: string, slug: string }> = {
    'nationalite': { service: 'Passeport & Documents', slug: 'passeport' },
    'investir': { service: 'Investissement', slug: 'investissement' },
    'construire': { service: 'Construction', slug: 'construction' },
    'business': { service: "Création d'Entreprise", slug: 'business' },
    'culture': { service: 'Guide Culturel', slug: 'culture' },
    'logement': { service: 'Acheter ou Louer', slug: 'logement' },
}

// ═══════════════════════════════════════════════════════════════
// Algorithme de scoring multi-critères (5 dimensions, 100 pts max)
//
//   1. Origines béninoises  → 0-20 pts
//   2. Objectif (clarté)    → 0-20 pts
//   3. Timeline (urgence)   → 0-15 pts
//   4. Budget               → 0-25 pts
//   5. Expérience terrain   → 0-20 pts
//
// Total possible : 100 pts
// ═══════════════════════════════════════════════════════════════
function calculateEligibilityScore(answers: OracleAnswers): number {
    let score = 0

    // ── 1. Origines (max 20 pts) ─────────────────────────────
    const originScores: Record<string, number> = {
        'oui': 20,      // Origines béninoises confirmées
        'partiel': 12,   // Liens familiaux/affectifs
        'non': 5,        // Intéressé mais pas de lien direct
    }
    score += originScores[answers.origin || ''] ?? 5

    // ── 2. Objectif (max 20 pts) ─────────────────────────────
    const objectiveScores: Record<string, number> = {
        'nationalite': 20,  // Très clair et spécifique
        'construire': 18,   // Projet concret
        'logement': 17,     // Besoin tangible
        'business': 16,     // Ambition entrepreneuriale
        'investir': 15,     // Intérêt financier
        'culture': 10,      // Exploration (moins urgent)
    }
    score += objectiveScores[answers.objective || ''] ?? 10

    // ── 3. Timeline / Urgence (max 15 pts) ───────────────────
    const timelineScores: Record<string, number> = {
        'urgent': 15,       // Prêt immédiatement = client chaud
        '6mois': 12,        // Court terme
        '1an': 8,           // Moyen terme
        'exploration': 4,   // Juste curieux
    }
    score += timelineScores[answers.timeline || ''] ?? 4

    // ── 4. Budget (max 25 pts) ───────────────────────────────
    const budgetScores: Record<string, number> = {
        'illimite': 25,     // Budget très confortable
        'grand': 20,        // Bon budget
        'moyen': 14,        // Budget raisonnable
        'petit': 7,         // Budget limité
    }
    score += budgetScores[answers.budget || ''] ?? 7

    // ── 5. Expérience terrain (max 20 pts) ───────────────────
    const experienceScores: Record<string, number> = {
        'oui': 20,          // Expérience = sérieux et déterminé
        'peu': 12,          // A commencé mais a besoin d'aide
        'jamais': 6,        // Débutant total
    }
    score += experienceScores[answers.experience || ''] ?? 6

    // Plafond à 100 et plancher à 15
    return Math.max(15, Math.min(100, score))
}

// ─── Language map for Oracle ──────────────────────────────────────────────────
const ORACLE_LANG_MAP: Record<string, string> = {
    fr: 'French',
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese (Brazilian)',
    cr: 'Guadeloupean Creole (Antillean Creole)',
    ht: 'Haitian Creole',
}

// Fallback insights in each language (used when Groq fails)
const ORACLE_FALLBACK_INSIGHTS: Record<string, string[]> = {
    fr: [
        "Votre profil présente un excellent potentiel pour cette démarche.",
        "Les éléments fournis constituent une base solide pour avancer.",
        "Notre équipe est prête à vous accompagner à chaque étape.",
    ],
    en: [
        "Your profile shows excellent potential for this process.",
        "The elements you provided form a solid foundation to move forward.",
        "Our team is ready to guide you every step of the way.",
    ],
    es: [
        "Su perfil muestra un excelente potencial para este proceso.",
        "Los elementos proporcionados constituyen una base sólida para avanzar.",
        "Nuestro equipo está listo para acompañarle en cada etapa.",
    ],
    pt: [
        "Seu perfil apresenta excelente potencial para este processo.",
        "Os elementos fornecidos formam uma base sólida para avançar.",
        "Nossa equipe está pronta para acompanhá-lo em cada etapa.",
    ],
    cr: [
        "Pwofil ou montre yon potansyèl ekselan pou pwosesis sa a.",
        "Eleman ou bay yo fòme yon baz solid pou avanse.",
        "Ekip nou an prè pou gide ou nan chak etap.",
    ],
    ht: [
        "Pwofil ou montre yon potansyèl ekselan pou pwosesis sa a.",
        "Eleman ou bay yo fòme yon baz solid pou avanse.",
        "Ekip nou an prè pou gide ou nan chak etap.",
    ],
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { nom, prenom, email, whatsapp, answers, lang = 'fr' } = body as {
            nom: string
            prenom: string
            email: string
            whatsapp: string
            answers: OracleAnswers
            lang?: string
        }

        if (!answers || !answers.objective) {
            return NextResponse.json({ error: 'Réponses incomplètes' }, { status: 400 })
        }

        const safeLang = ORACLE_LANG_MAP[lang] ? lang : 'fr'
        const targetLangName = ORACLE_LANG_MAP[safeLang] || 'French'
        const clientName = `${prenom || ''} ${nom || ''}`.trim()

        // Determine recommended service
        const rec = serviceMapping[answers.objective] || serviceMapping['culture']
        const hasOrigins = answers.origin === 'oui' || answers.origin === 'partiel'

        // Calculate real multi-criteria score
        const finalScore = calculateEligibilityScore(answers)

        // Fallback insights in user's language
        let dynamicInsights = ORACLE_FALLBACK_INSIGHTS[safeLang] || ORACLE_FALLBACK_INSIGHTS.fr

        try {
            const langInstruction = safeLang !== 'fr'
                ? ` CRITICAL: Write all 3 insights in ${targetLangName}. Do NOT write in French.`
                : ''

            const prompt = `Analyze this profile of a person wanting to obtain Beninese nationality or return to Benin:
First name: ${prenom}
Country of residence: ${answers.pays_residence || 'Not specified'}
Connection to Benin: ${answers.lien_benin || 'Not specified'}
Proof of origin: ${(answers.preuve_origine || []).join(', ')}
Main motivation: ${answers.motivation || 'Not specified'}
Free message: ${answers.message_libre || 'None'}
Calculated eligibility score: ${finalScore}%
Recommended service: ${rec.service}

Return ONLY a JSON array of exactly 3 strings. Each string is one short insight (one sentence max), professional, reassuring and premium. Address the person directly.${langInstruction}
Example format: ["Insight 1.", "Insight 2.", "Insight 3."]`

            const res = await fetchWithGroqRotation({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'You are a premium eligibility advisor. Output only strict JSON arrays of strings, no prose.' },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.5,
                max_tokens: 512,
            })

            if (res.ok) {
                const aiData = await res.json()
                const raw: string = aiData?.choices?.[0]?.message?.content ?? ''
                const clean = raw.trim().replace(/^```(?:json)?[\r\n]*/i, '').replace(/[\r\n]*```$/i, '').trim()
                const parsed = JSON.parse(clean)
                if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((s: unknown) => typeof s === 'string')) {
                    dynamicInsights = parsed
                }
            }
        } catch (aiError) {
            console.error("[Oracle] Groq insights error:", aiError);
            // Keep the language-appropriate fallback already set above
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: insertedLead, error } = await supabase.from('eligibility_results').insert({
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
        }).select('id').single();

        if (error) throw error
        const leadId = insertedLead?.id || '';

        // Fire-and-forget emails
        (async () => {
            try {
                if (email) {
                    const aiReply = `Félicitations pour avoir complété le test de l'Oracle. Votre profil indique un score d'éligibilité de ${finalScore}%. Nous sommes ravis de vous accompagner vers "${rec.service}".`;
                    await sendEmail({
                        to: email,
                        subject: `Retour Gagnant — Les résultats de l'Oracle`,
                        html: await (await getEmailTemplates('fr')).autoReply(clientName || 'Cher client', aiReply),
                        context: 'auto_reply',
                        relatedId: leadId,
                    });
                }

                const config = await getEmailConfig();
                if (config.adminEmail) {
                    await sendEmail({
                        to: config.adminEmail,
 subject: `Nouveau Lead Oracle — ${clientName || email}`,
                        html: await (await getEmailTemplates('fr')).newLeadNotification(clientName || 'Inconnu', email || 'Inconnu', finalScore, rec.service, 'L\'Oracle'),
                        context: 'lead_notification',
                        relatedId: leadId,
                    });
                }
            } catch (emailErr) {
                console.log('[ORACLE] Email send failed (non-blocking):', emailErr);
            }
        })();

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
