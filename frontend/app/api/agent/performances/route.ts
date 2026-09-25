// ══════════════════════════════════════════════════════════════
//  « Mes Performances » (panel agent).
//
//  Avant : l'écran lisait depuis le navigateur dossier_tracking, messages,
//  eligibility_results… SANS AUCUN FILTRE : chaque agent voyait les chiffres
//  de toute l'agence. Ici le cloisonnement est fait côté serveur, sur la
//  session (jamais sur un paramètre de requête) :
//    • dossiers   → dossier_tracking.agent_assigne = agent
//                   (colonne écrite par /api/admin/dossiers/assign)
//    • devis      → documents_financiers (type 'devis').agent_id = agent
//                   (source unique des devis ; agent_devis est vide/morte)
//    • messages   → messages.recipient_id = agent
//    • agenda     → agent_events.agent_id = agent
//    • leads      → eligibility_results ne porte AUCUNE colonne d'agent :
//                   non attribuables, renvoyés à null pour un agent.
//  Un admin garde la vue globale.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Ligne = Record<string, unknown>

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const global = garde.isAdmin
    const moi = garde.userId!

    let qDossiers = supabase.from('dossier_tracking').select('statut, created_at, client_email, email')
    let qMessages = supabase.from('messages').select('lu, is_read, type, created_at, email')
    let qDevis = supabase.from('documents_financiers').select('status').eq('type', 'devis')
    let qEvents = supabase.from('agent_events').select('id')
    if (!global) {
        qDossiers = qDossiers.eq('agent_assigne', moi)
        qMessages = qMessages.eq('recipient_id', moi)
        qDevis = qDevis.eq('agent_id', moi)
        qEvents = qEvents.eq('agent_id', moi)
    }
    const qLeads = global
        ? supabase.from('eligibility_results').select('contacted, is_contacted, eligibility_score, created_at')
        : null

    const [dRes, mRes, devRes, eRes, lRes] = await Promise.all([
        qDossiers, qMessages, qDevis, qEvents, qLeads ?? Promise.resolve({ data: null, error: null }),
    ])

    const erreur = dRes.error || mRes.error || devRes.error || eRes.error || lRes.error
    if (erreur) {
        console.error('[performances] lecture:', erreur.message)
        return NextResponse.json({ error: 'Lecture des performances impossible.' }, { status: 500 })
    }

    const dossiers = (dRes.data || []) as Ligne[]
    const messages = (mRes.data || []) as Ligne[]
    const devis = (devRes.data || []) as Ligne[]
    const events = (eRes.data || []) as Ligne[]
    const leads = (lRes.data || null) as Ligne[] | null

    const now = new Date()
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const ceMois = (r: Ligne) => String(r.created_at || '') >= debutMois

    const termines = dossiers.filter(d => d.statut === 'termine').length
    const clients = new Set(
        [...dossiers.map(d => d.client_email || d.email), ...messages.map(m => m.email)]
            .filter(Boolean)
            .map(e => String(e).toLowerCase()),
    )

    return NextResponse.json({
        portee: global ? 'agence' : 'agent',
        leadsAttribuables: leads !== null,
        perf: {
            totalDossiers: dossiers.length,
            dossiersTermines: termines,
            dossiersEnCours: dossiers.filter(d => ['traitement', 'validation', 'finalisation'].includes(String(d.statut))).length,
            dossiersNouveaux: dossiers.filter(d => d.statut === 'reception').length,
            tauxResolution: dossiers.length > 0 ? Math.round((termines / dossiers.length) * 100) : 0,
            messagesTotal: messages.length,
            messagesLus: messages.filter(m => m.lu === true || m.is_read === true).length,
            messagesRDV: messages.filter(m => m.type === 'rendez-vous').length,
            leadsTotal: leads ? leads.length : null,
            leadsContactes: leads ? leads.filter(l => l.contacted === true || l.is_contacted === true).length : null,
            leadsHot: leads ? leads.filter(l => Number(l.eligibility_score) >= 70).length : null,
            devisTotal: devis.length,
            devisEnvoyes: devis.filter(d => d.status !== 'brouillon').length,
            eventsTotal: events.length,
            clientsUniques: clients.size,
            thisMonthDossiers: dossiers.filter(ceMois).length,
            thisMonthMessages: messages.filter(ceMois).length,
            thisMonthLeads: leads ? leads.filter(ceMois).length : null,
        },
    })
}
