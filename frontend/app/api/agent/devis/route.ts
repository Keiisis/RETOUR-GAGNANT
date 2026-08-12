// ══════════════════════════════════════════════════════════════
//  DOCUMENTS FINANCIERS : création / mise à jour / liste (agent)
//
//  Route en service-role : la RLS ne protège plus rien ici, le
//  cloisonnement est donc explicite.
//   • l'auteur d'un document est pris SUR LA SESSION, jamais dans le
//     corps de la requête (sinon un agent signe au nom d'un autre)
//   • un agent ne lit et ne modifie QUE ses propres documents
//   • la mise à jour passe par une liste blanche : le montant d'une
//     pièce déjà émise ne se réécrit pas par un PATCH libre
//   • période comptable clôturée → modification refusée
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { isPeriodLocked } from '@/lib/comptaLock'
import { logAudit } from '@/lib/audit-compta'

// Service role key : bypasse complètement RLS et l'accès à auth.users
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Champs qu'un PATCH peut toucher.
 *
 * Volontairement restreint : `total`, `items`, `numero` et `agent_id` en
 * sont absents. Corriger un montant après émission se fait par un avoir
 * (/api/admin/avoirs), pas par une réécriture silencieuse : c'est ce que
 * l'administration fiscale attend, et c'est ce que le journal d'audit
 * peut prouver.
 */
const CHAMPS_MODIFIABLES = new Set([
    'status', 'notes', 'conditions', 'validite',
    'client_nom', 'client_prenom', 'client_email', 'client_phone',
    'client_adresse', 'client_ifu', 'paid_at',
])

// ─── POST : créer un document financier (devis / facture) ─────────────────────
export async function POST(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await req.json()

        const {
            agent_id, type, numero,
            client_nom, client_prenom, client_email, client_phone, client_adresse,
            currency, exchange_rate_applied,
            items, sous_total, total_tva, remise, total,
            status, notes, conditions, validite,
        } = body

        // L'auteur vient de la session. Un admin peut créer au nom d'un agent
        // (saisie de rattrapage) ; un agent, jamais.
        const auteur = garde.isAdmin ? (agent_id || garde.userId) : garde.userId

        if (!auteur || !type || !numero || !client_nom || !items?.length) {
            return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('documents_financiers')
            .insert({
                agent_id: auteur, type, numero,
                client_nom, client_prenom: client_prenom || null,
                client_email: client_email || null,
                client_phone: client_phone || null,
                client_adresse: client_adresse || null,
                currency: currency || 'XOF',
                exchange_rate_applied: exchange_rate_applied || 1,
                items,
                sous_total, total_tva, remise: remise || 0, total,
                status: status || 'brouillon',
                notes: notes || null,
                conditions: conditions || null,
                validite: validite || null,
            })
            .select('id')
            .single()

        if (error) {
            console.error('[api/agent/devis POST]', error)
            return NextResponse.json(
                { error: error.message, code: error.code, details: error.details },
                { status: 500 }
            )
        }

        return NextResponse.json({ id: data.id }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── PATCH : mettre à jour un document (statut, etc.) ────────────────────────
export async function PATCH(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await req.json()
        const { id, ...updates } = body

        if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

        const { data: avant } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (!avant) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

        // Cloisonnement : un agent ne touche que ses propres documents.
        if (!garde.isAdmin && avant.agent_id !== garde.userId) {
            return NextResponse.json({ error: 'Ce document ne vous appartient pas.' }, { status: 403 })
        }

        if (await isPeriodLocked(supabase, avant.created_at)) {
            return NextResponse.json({ error: 'Période clôturée : modification refusée.' }, { status: 423 })
        }

        // Liste blanche : tout champ hors périmètre est ignoré, et signalé
        // pour que l'appelant sache que sa modification n'a pas été prise.
        const patch: Record<string, unknown> = {}
        const refuses: string[] = []
        for (const [k, v] of Object.entries(updates)) {
            if (CHAMPS_MODIFIABLES.has(k)) patch[k] = v
            else refuses.push(k)
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json(
                { error: 'Aucun champ modifiable.', refuses },
                { status: 400 }
            )
        }

        const { error } = await supabase
            .from('documents_financiers')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        await logAudit(supabase, {
            table: 'documents_financiers', recordId: id, action: 'update',
            acteur: { userId: garde.userId, role: garde.role },
            avant: avant as Record<string, unknown>,
            apres: { ...avant, ...patch } as Record<string, unknown>,
        })

        return NextResponse.json({ ok: true, refuses: refuses.length ? refuses : undefined })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── GET : liste des documents d'un agent ────────────────────────────────────
export async function GET(req: NextRequest) {
    const garde = await requireStaff(req, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { searchParams } = new URL(req.url)
        const demande = searchParams.get('agent_id')

        // Un agent est ramené à lui-même quoi qu'il demande ; l'admin peut
        // cibler un agent précis, ou tout voir s'il ne précise rien.
        const agentId = garde.isAdmin ? demande : garde.userId

        let q = supabase
            .from('documents_financiers')
            .select('*')
            .order('created_at', { ascending: false })

        if (agentId) q = q.eq('agent_id', agentId)

        const { data, error } = await q
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ documents: data || [] })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
