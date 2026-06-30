import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role key — bypasse complètement RLS et l'accès à auth.users
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── POST : créer un document financier (devis / facture) ─────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const {
            agent_id, type, numero,
            client_nom, client_prenom, client_email, client_phone, client_adresse,
            currency, exchange_rate_applied,
            items, sous_total, total_tva, remise, total,
            status, notes, conditions, validite,
        } = body

        if (!agent_id || !type || !numero || !client_nom || !items?.length) {
            return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('documents_financiers')
            .insert({
                agent_id, type, numero,
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
    try {
        const body = await req.json()
        const { id, ...updates } = body

        if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

        const { error } = await supabase
            .from('documents_financiers')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── GET : liste des documents d'un agent ────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const agentId = searchParams.get('agent_id')

        if (!agentId) return NextResponse.json({ error: 'agent_id manquant' }, { status: 400 })

        const { data, error } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ documents: data || [] })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
