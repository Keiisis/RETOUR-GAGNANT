// ══════════════════════════════════════════════════════════════
//  ASSIGNATION DE DOSSIERS À UN AGENT
//
//  La colonne dossier_tracking.agent_assigne existait mais n'était
//  jamais renseignée : tous les agents voyaient tout, sans responsable
//  nommé. Cette route :
//   • GET  → la liste des agents assignables (pour le sélecteur admin) ;
//   • PATCH → pose (ou retire) l'agent responsable d'un dossier.
//
//  Réservé au STAFF. L'admin assigne à n'importe quel agent ; un agent
//  ne peut que se prendre / se retirer un dossier lui-même (pas en
//  charger un autre à sa place).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── GET : agents assignables ─────────────────────────────────
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { data } = await db()
        .from('user_profiles')
        .select('id, full_name, email')
        .eq('role', 'agent')
        .order('full_name', { ascending: true })

    const agents = (data || []).map(a => ({
        id: a.id,
        nom: a.full_name || a.email || 'Agent',
        email: a.email || '',
    }))
    return NextResponse.json({ agents })
}

// ─── PATCH : assigner / désassigner ───────────────────────────
export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const dossierId = String(body.dossier_id || '')
    // agent_id null / vide = retrait de l'assignation
    const agentId = body.agent_id ? String(body.agent_id) : null

    if (!dossierId) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 })

    // Un agent (non admin) ne peut assigner QU'À lui-même, ou se retirer.
    if (!garde.isAdmin && agentId && agentId !== garde.userId) {
        return NextResponse.json(
            { error: 'Vous ne pouvez prendre en charge un dossier qu’à votre propre nom.' },
            { status: 403 },
        )
    }

    const supabase = db()

    // Si un agent est fourni, il doit exister et avoir le rôle agent.
    if (agentId) {
        const { data: prof } = await supabase
            .from('user_profiles').select('id, role').eq('id', agentId).maybeSingle()
        if (!prof || prof.role !== 'agent') {
            return NextResponse.json({ error: 'Agent invalide.' }, { status: 400 })
        }
    }

    const { data, error } = await supabase
        .from('dossier_tracking')
        .update({ agent_assigne: agentId, updated_at: new Date().toISOString() })
        .eq('id', dossierId)
        .select('id, agent_assigne')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, dossier: data })
}
