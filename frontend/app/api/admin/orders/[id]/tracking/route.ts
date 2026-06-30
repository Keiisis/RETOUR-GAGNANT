import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

/* ════════════════════════════════════════════════════════════════════════════
   PATCH /api/admin/orders/:id/tracking
   Allows admin/agent to update tracking info on an order. Adds an event row
   to `order_tracking_events` so the client mobile timeline reflects the change.
   ════════════════════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_STATUS = ['pending', 'preparing', 'shipped', 'in_transit', 'delivered', 'failed', 'returned']

interface TrackingBody {
    tracking_code?: string | null
    tracking_carrier?: string | null
    tracking_url?: string | null
    shipping_status?: string
    /** Optional event to log alongside the update (auto-generated if omitted). */
    event_label?: string
    event_description?: string
    event_location?: string
}

const STATUS_DEFAULT_LABEL: Record<string, string> = {
    pending:    'Commande en attente',
    preparing:  'En préparation',
    shipped:    'Colis expédié',
    in_transit: 'En transit',
    delivered:  'Livré',
    failed:     'Livraison échouée',
    returned:   'Colis retourné',
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await verifyApiAuth(req, 'agent')
        if (!auth.authenticated) return auth.error!
        const { id: orderId } = await ctx.params
        if (!orderId) return NextResponse.json({ error: 'order id manquant' }, { status: 400 })

        const body = (await req.json()) as TrackingBody

        // Validation
        if (body.shipping_status && !ALLOWED_STATUS.includes(body.shipping_status)) {
            return NextResponse.json({ error: 'shipping_status invalide' }, { status: 400 })
        }
        if (body.tracking_code !== undefined && body.tracking_code !== null) {
            const code = String(body.tracking_code).trim()
            if (code.length > 100) {
                return NextResponse.json({ error: 'tracking_code trop long' }, { status: 400 })
            }
        }
        if (body.tracking_url) {
            try { new URL(body.tracking_url) } catch {
                return NextResponse.json({ error: 'tracking_url invalide' }, { status: 400 })
            }
        }

        // ── Construire le payload de mise à jour ──
        const updates: Record<string, unknown> = {}
        if (body.tracking_code !== undefined) {
            updates.tracking_code = body.tracking_code
                ? String(body.tracking_code).trim().toUpperCase()
                : null
        }
        if (body.tracking_carrier !== undefined) {
            updates.tracking_carrier = body.tracking_carrier || null
        }
        if (body.tracking_url !== undefined) {
            updates.tracking_url = body.tracking_url || null
        }
        if (body.shipping_status) {
            updates.shipping_status = body.shipping_status
            // Stamp les timestamps métier selon le statut
            if (body.shipping_status === 'shipped' || body.shipping_status === 'in_transit') {
                updates.shipped_at = new Date().toISOString()
            }
            if (body.shipping_status === 'delivered') {
                updates.delivered_at = new Date().toISOString()
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
        }

        // ── Update ──
        const { data: order, error: updateErr } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', orderId)
            .select('id, tracking_code, tracking_carrier, tracking_url, shipping_status, shipped_at, delivered_at')
            .single()

        if (updateErr || !order) {
            return NextResponse.json({ error: updateErr?.message || 'Commande introuvable' }, { status: 404 })
        }

        // ── Logger un événement de tracking ──
        if (body.shipping_status) {
            const label = body.event_label || STATUS_DEFAULT_LABEL[body.shipping_status] || 'Mise à jour de statut'
            let description = body.event_description || ''
            if (!description && body.shipping_status === 'shipped' && order.tracking_code) {
                description = `Colis expédié — code de suivi : ${order.tracking_code}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}`
            }

            await supabase.from('order_tracking_events').insert({
                order_id: orderId,
                status: body.shipping_status,
                label,
                description: description || null,
                location: body.event_location || null,
            })
        } else if (body.tracking_code) {
            // Pas de changement de statut, mais ajout du code → événement de référence
            await supabase.from('order_tracking_events').insert({
                order_id: orderId,
                status: order.shipping_status || 'preparing',
                label: 'Code de suivi disponible',
                description: `Code : ${order.tracking_code}${order.tracking_carrier ? ` (${order.tracking_carrier})` : ''}`,
            })
        }

        return NextResponse.json({ ok: true, order })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
