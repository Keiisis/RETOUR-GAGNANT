// ══════════════════════════════════════════════════════════════
//  AGENT : lecture de SA comptabilité (documents, dépenses, paiements)
//
//  La page /agent/comptabilite lisait ces tables depuis le navigateur.
//  Les règles d'accès Postgres ouvrent ces tables à toute l'équipe :
//  la réserve « Comptabilité = Ornel » (décision du 16/07/2026) n'était
//  donc tenue que par l'interface. Cette route porte le contrôle côté
//  serveur ; la page ne lit plus rien en direct.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/api-guard'
import { supabaseServeur as supabase } from '@/lib/supabase-serveur'
import { agentHasComptaAccess } from '@/lib/constants/compta'

export const dynamic = 'force-dynamic'

/** Admins : accès. Agents : seulement ceux de COMPTA_AGENT_EMAILS. */
async function accesComptaAgent(garde: { isAdmin: boolean; userId?: string }): Promise<NextResponse | null> {
    if (garde.isAdmin) return null
    const { data } = await supabase.from('user_profiles').select('email').eq('id', garde.userId || '').maybeSingle()
    return agentHasComptaAccess(data?.email)
        ? null
        : NextResponse.json({ error: 'Comptabilité réservée à l’administration.' }, { status: 403 })
}

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!
    const refus = await accesComptaAgent(garde)
    if (refus) return refus
    const moi = garde.userId!

    /* Documents : les siens + ceux de l'AGENCE (agent_id vide) — factures
       émises automatiquement au paiement en ligne (nationalité, propositions,
       services…). Avant : visibles chez l'admin seulement ; la comptable ne
       les voyait pas, ses totaux divergeaient et elle risquait de refacturer
       (cas TOUCHE Teddy Mickaël, FAC-2026-0007). */
    const [docs, depenses, reglage] = await Promise.all([
        supabase.from('documents_financiers').select('*')
            .or(`agent_id.eq.${moi},agent_id.is.null`)
            .order('created_at', { ascending: false }),
        supabase.from('depenses').select('*').eq('agent_id', moi).order('date_depense', { ascending: false }),
        supabase.from('settings').select('key, value').eq('key', 'commission_rate').maybeSingle(),
    ])
    if (docs.error || depenses.error) {
        return NextResponse.json({ error: (docs.error || depenses.error)!.message }, { status: 500 })
    }

    // Paiements : ceux qu'elle a saisis + ceux rattachés aux documents de
    // l'agence (saisis par l'admin), sinon ces factures paraîtraient impayées.
    const idsAgence = (docs.data || []).filter(d => !d.agent_id).map(d => d.id as string)
    const paiements = await supabase.from('paiements_manuels')
        .select('id, document_id, type, montant, date_paiement, reference, notes')
        .or(idsAgence.length ? `agent_id.eq.${moi},document_id.in.(${idsAgence.join(',')})` : `agent_id.eq.${moi}`)
        .order('date_paiement', { ascending: false })
    if (paiements.error) return NextResponse.json({ error: paiements.error.message }, { status: 500 })

    return NextResponse.json({
        // `agence` : document émis automatiquement (aucun agent) — badge côté page
        documents: (docs.data || []).map(d => ({ ...d, agence: !d.agent_id })),
        depenses: depenses.data || [],
        paiements: paiements.data || [],
        commission_rate: reglage.data?.value ?? null,
    })
}
