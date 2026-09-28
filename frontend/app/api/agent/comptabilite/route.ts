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

    const [docs, depenses, paiements, reglage] = await Promise.all([
        supabase.from('documents_financiers').select('*').eq('agent_id', moi).order('created_at', { ascending: false }),
        supabase.from('depenses').select('*').eq('agent_id', moi).order('date_depense', { ascending: false }),
        supabase.from('paiements_manuels')
            .select('id, document_id, type, montant, date_paiement, reference, notes')
            .eq('agent_id', moi)
            .order('date_paiement', { ascending: false }),
        supabase.from('settings').select('key, value').eq('key', 'commission_rate').maybeSingle(),
    ])

    const erreur = docs.error || depenses.error || paiements.error
    if (erreur) return NextResponse.json({ error: erreur.message }, { status: 500 })

    return NextResponse.json({
        documents: docs.data || [],
        depenses: depenses.data || [],
        paiements: paiements.data || [],
        commission_rate: reglage.data?.value ?? null,
    })
}
