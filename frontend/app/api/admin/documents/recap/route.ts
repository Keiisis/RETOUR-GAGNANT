// ══════════════════════════════════════════════════════════════
//  ADMIN/DOCUMENTS : Récap génératif de l'Assistant Virtuel
//  Analyse RÉELLE des dossiers MyAfroOrigins (ancienneté déclarée,
//  paiement 50 €, recherche ancestrale 250 €, documents) puis
//  synthèse opérationnelle par Groq (LLaMA 3.3 70B) pour la
//  direction : priorités, relances à faire, risques.
//  Fallback règles si l'IA est indisponible : jamais d'échec.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchWithGroqRotation, GROQ_KEYS } from '@/lib/groq'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

interface AppRow {
    id: string
    application_ref: string
    nom: string
    prenom: string
    email: string
    payment_status: string
    myafro_date?: string | null
    needs_recherche_ancestrale?: boolean
    recherche_ancestrale_paid?: boolean
    documents_uploaded?: string[] | null
    created_at: string
}

// Ancienneté du dossier MyAfroOrigins en mois (date OU texte libre « 6 mois »)
function monthsSince(raw: string | null | undefined): number | null {
    if (!raw) return null
    const clean = String(raw).toLowerCase().trim()
    const y = clean.match(/(\d+)\s*an/); if (y) return parseInt(y[1], 10) * 12
    const m = clean.match(/(\d+)\s*mois/); if (m) return parseInt(m[1], 10)
    const w = clean.match(/(\d+)\s*semaine/); if (w) return parseInt(w[1], 10) / 4
    const d = clean.match(/(\d+)\s*jour/); if (d) return parseInt(d[1], 10) / 30
    const fr = clean.match(/(\d{2})[/\-.](\d{2})[/\-.](\d{4})/)
    const date = fr
        ? new Date(parseInt(fr[3], 10), parseInt(fr[2], 10) - 1, parseInt(fr[1], 10))
        : (isNaN(Date.parse(clean)) ? null : new Date(Date.parse(clean)))
    if (!date) return null
    return (Date.now() - date.getTime()) / (1000 * 3600 * 24 * 30)
}

function urgencyLabel(months: number | null): string {
    if (months === null) return 'indéterminée'
    if (months > 6) return 'HAUTE'
    if (months >= 3) return 'moyenne'
    return 'faible'
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const { data, error } = await supabase
            .from('nationality_applications')
            .select('id, application_ref, nom, prenom, email, payment_status, needs_recherche_ancestrale, recherche_ancestrale_paid, documents_uploaded, created_at')
            .eq('status', 'revue_myafro')
            .order('created_at', { ascending: false })
        if (error) throw error

        // myafro_date séparément : la colonne peut ne pas exister avant la migration
        const byId: Record<string, string | null> = {}
        try {
            const { data: dates } = await supabase
                .from('nationality_applications')
                .select('id, myafro_date')
                .eq('status', 'revue_myafro')
            for (const r of dates || []) byId[r.id] = r.myafro_date
        } catch { /* colonne absente : ancienneté indéterminée */ }

        const apps = (data || []) as AppRow[]
        if (apps.length === 0) {
            return NextResponse.json({
                success: true, generative: false,
                recap: 'Aucun dossier MyAfroOrigins en attente de revue actuellement. Rien à relancer.',
            })
        }

        // ── Faits structurés, calculés côté serveur (l'IA ne devine rien) ──
        const facts = apps.map(a => {
            const raw = byId[a.id] ?? null
            const months = monthsSince(raw)
            return {
                dossier: a.application_ref,
                client: `${a.prenom} ${a.nom}`.trim(),
                email: a.email,
                anciennete_myafroorigins: raw || 'non renseignée',
                anciennete_mois: months === null ? null : Math.round(months * 10) / 10,
                urgence: urgencyLabel(months),
                frais_reprise_50e: a.payment_status === 'payé' ? 'payés' : 'NON payés',
                recherche_ancestrale_250e: a.recherche_ancestrale_paid
                    ? 'payée' : (a.needs_recherche_ancestrale ? 'demandée, EN ATTENTE de paiement' : 'pas encore proposée'),
                nb_documents: Array.isArray(a.documents_uploaded) ? a.documents_uploaded.length : 0,
                recu_le: new Date(a.created_at).toLocaleDateString('fr-FR'),
            }
        })

        const fallback = facts
            .map(f => `• ${f.client} (${f.dossier}) : urgence ${f.urgence}, dossier MyAfroOrigins depuis ${f.anciennete_myafroorigins}, 50 € ${f.frais_reprise_50e}, recherche ancestrale : ${f.recherche_ancestrale_250e}.`)
            .join('\n')

        if (GROQ_KEYS.length === 0) {
            return NextResponse.json({ success: true, generative: false, recap: fallback, facts })
        }

        try {
            const res = await fetchWithGroqRotation({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: `Tu es l'assistant de direction de Retour Gagnant Bénin. On te donne l'état FACTUEL des dossiers clients bloqués sur MyAfroOrigins repris par l'agence (frais de reprise 50 €, puis recherche ancestrale 250 €). Rédige un récapitulatif opérationnel ULTRA PRÉCIS en français pour la présidente, pour piloter les relances :
1) Une phrase de vue d'ensemble chiffrée.
2) « À FAIRE EN PRIORITÉ » : les actions concrètes classées par urgence (qui relancer, pour quoi : 50 € impayés, recherche ancestrale 250 € à proposer ou relancer, documents à valider), en citant nom + référence.
3) « À SURVEILLER » : le reste, en une ligne chacun.
Règles : uniquement les faits fournis, aucun chiffre inventé, pas de blabla, puces commençant par « - », pas de markdown gras, maximum 18 lignes.`,
                    },
                    { role: 'user', content: JSON.stringify(facts) },
                ],
                temperature: 0.3,
                max_tokens: 900,
            })
            const dataAi = await res.json()
            const txt = dataAi.choices?.[0]?.message?.content?.trim()
            if (txt && txt.length > 20) {
                return NextResponse.json({ success: true, generative: true, recap: txt, facts })
            }
        } catch (e) {
            console.error('[documents/recap] Groq indisponible:', e instanceof Error ? e.message : e)
        }

        return NextResponse.json({ success: true, generative: false, recap: fallback, facts })
    } catch (err) {
        console.error('[documents/recap]', err)
        return NextResponse.json({ error: 'Récap impossible' }, { status: 500 })
    }
}
