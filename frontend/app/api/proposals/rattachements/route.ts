// ══════════════════════════════════════════════════════════════
//  GET /api/proposals/rattachements
//
//  Renvoie, pour chaque proposition, si elle est envoyée dans l'application
//  d'un client et duquel. Le panel fusionne ces informations avec sa liste.
//
//  Pourquoi une route à part plutôt qu'un champ de plus dans la liste ?
//  La liste du panel provient de la VUE `slide_proposals`, qui fige les
//  colonnes retenues à sa création et exclut les liens de paiement. Y ajouter
//  `client_id` obligerait à recréer la vue sans en connaître la clause exacte,
//  au risque de faire disparaître des propositions du panel. On lit donc la
//  table à côté, et on fusionne : aucun risque pour l'existant.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { data, error } = await supabase
        .from('ai_client_proposals')
        .select('id, client_id, sent_to_mobile, sent_at, signed_at, signed_name')
        .order('created_at', { ascending: false })
        .limit(500)

    if (error) return NextResponse.json({ error: error.message, rattachements: {} }, { status: 500 })

    const rattachees = (data || []).filter(p => p.client_id)
    const ids = [...new Set(rattachees.map(p => p.client_id as string))]

    const noms = new Map<string, string>()
    if (ids.length) {
        const { data: profils } = await supabase
            .from('client_profiles').select('id, nom, prenom, email').in('id', ids)
        for (const p of profils || []) {
            noms.set(p.id, `${p.prenom || ''} ${p.nom || ''}`.trim() || String(p.email || ''))
        }
    }

    const rattachements: Record<string, {
        client_id: string | null; client_nom: string | null
        sent_to_mobile: boolean; sent_at: string | null
        signed_at: string | null; signed_name: string | null
    }> = {}

    for (const p of data || []) {
        rattachements[p.id] = {
            client_id: p.client_id ?? null,
            client_nom: p.client_id ? (noms.get(p.client_id) || null) : null,
            sent_to_mobile: !!p.sent_to_mobile,
            sent_at: p.sent_at ?? null,
            signed_at: p.signed_at ?? null,
            signed_name: p.signed_name ?? null,
        }
    }

    return NextResponse.json({ rattachements })
}
