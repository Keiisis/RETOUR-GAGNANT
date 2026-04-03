import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TICKET_SECRET = process.env.TICKET_HMAC_SECRET || 'rgb-ticket-secret-2026'

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase config missing')
    return createClient(supabaseUrl, supabaseKey)
}

// POST /api/events/[id]/validate — validate a ticket (admin/agent only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(req, 'agent')
    if (!auth.authenticated) return auth.error!
    try {
        const { id: eventId } = await params
        const supabase = getSupabase()
        const { ticket_code, qr_data, validated_by } = await req.json()

        if (!ticket_code) {
            return NextResponse.json({ error: 'Code ticket requis' }, { status: 400 })
        }

        // Verify HMAC if qr_data provided
        if (qr_data) {
            try {
                const parsed = JSON.parse(qr_data)
                const { hash, ...payload } = parsed
                const expectedHash = crypto
                    .createHmac('sha256', TICKET_SECRET)
                    .update(JSON.stringify(payload))
                    .digest('hex')

                if (hash !== expectedHash) {
                    return NextResponse.json({
                        valid: false,
                        error: 'QR Code invalide — signature incorrecte',
                    }, { status: 403 })
                }
            } catch {
                return NextResponse.json({ valid: false, error: 'QR Code malformé' }, { status: 400 })
            }
        }

        // Atomic validation: UPDATE only if is_used = false
        const { data: ticket, error } = await supabase
            .from('event_tickets')
            .update({
                is_used: true,
                used_at: new Date().toISOString(),
                used_by: validated_by || 'admin',
            })
            .eq('ticket_code', ticket_code)
            .eq('event_id', eventId)
            .eq('is_used', false)
            .select('*, event_registrations(full_name, email, phone, ticket_type)')
            .single()

        if (error || !ticket) {
            // Check if ticket exists but already used
            const { data: existing } = await supabase
                .from('event_tickets')
                .select('is_used, used_at, used_by')
                .eq('ticket_code', ticket_code)
                .single()

            if (existing?.is_used) {
                return NextResponse.json({
                    valid: false,
                    error: `Ticket déjà utilisé le ${new Date(existing.used_at).toLocaleString('fr-FR')} par ${existing.used_by}`,
                    already_used: true,
                }, { status: 409 })
            }

            return NextResponse.json({ valid: false, error: 'Ticket introuvable' }, { status: 404 })
        }

        return NextResponse.json({
            valid: true,
            ticket,
            message: `Ticket validé pour ${ticket.event_registrations?.full_name}`,
        })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
