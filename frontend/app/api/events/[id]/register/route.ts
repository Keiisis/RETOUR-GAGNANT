import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { ttcFromHt } from '@/lib/tax'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TICKET_SECRET = process.env.TICKET_HMAC_SECRET || 'rgb-ticket-secret-2026'

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase config missing')
    return createClient(supabaseUrl, supabaseKey)
}

function generateTicketCode(eventSlug: string): string {
    const prefix = eventSlug.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X')
    const random = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `RGB-${prefix}-${random}`
}

function signTicket(ticketCode: string, eventId: string, registrationId: string): string {
    const payload = { ticket_code: ticketCode, event_id: eventId, registration_id: registrationId }
    const hmac = crypto.createHmac('sha256', TICKET_SECRET).update(JSON.stringify(payload)).digest('hex')
    return JSON.stringify({ ...payload, hash: hmac })
}

// POST /api/events/[id]/register — inscription publique
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: eventId } = await params
        const supabase = getSupabase()
        const body = await req.json()

        const { full_name, email, phone, whatsapp, ticket_type, payment_method } = body

        if (!full_name || !email || !phone) {
            return NextResponse.json({ error: 'Nom, email et téléphone requis' }, { status: 400 })
        }

        // 1. Get event details
        const { data: event, error: evtErr } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .eq('status', 'published')
            .single()

        if (evtErr || !event) {
            return NextResponse.json({ error: 'Événement introuvable ou non publié' }, { status: 404 })
        }

        // 2. Check capacity
        const { count: regCount } = await supabase
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .eq('payment_status', 'completed')

        if (event.max_capacity > 0 && (regCount || 0) >= event.max_capacity) {
            return NextResponse.json({ error: 'Événement complet' }, { status: 400 })
        }

        if (ticket_type === 'vip') {
            const { count: vipCount } = await supabase
                .from('event_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('ticket_type', 'vip')
                .eq('payment_status', 'completed')

            if (event.max_vip_seats > 0 && (vipCount || 0) >= event.max_vip_seats) {
                return NextResponse.json({ error: 'Places VIP complètes' }, { status: 400 })
            }
        }

        // 3. Calculate amount — TVA « en sus » : le prix du billet est HORS TAXE ;
        // la TVA 18 % s'ajoute (le client paie le TTC), comme boutique/prestations.
        // Un billet gratuit (0) reste gratuit.
        const priceHt = ticket_type === 'vip'
            ? (event.price_vip || 0)
            : (event.price_standard || 0)
        const amount = priceHt > 0 ? ttcFromHt(priceHt, event.currency || 'XOF') : 0

        // 4. Create order in orders table (reuse existing payment flow)
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .insert({
                product_title: `${event.title} — ${ticket_type === 'vip' ? 'VIP' : 'Standard'}`,
                quantity: 1,
                amount,
                currency: event.currency || 'XOF',
                customer_name: full_name,
                customer_email: email,
                customer_phone: phone,
                payment_method: payment_method || 'pending',
                payment_status: amount === 0 ? 'completed' : 'pending',
            })
            .select('id')
            .single()

        if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

        // 5. Create registration
        const { data: registration, error: regErr } = await supabase
            .from('event_registrations')
            .insert({
                event_id: eventId,
                full_name: full_name.trim(),
                email: email.trim().toLowerCase(),
                phone,
                whatsapp: whatsapp || null,
                ticket_type: ticket_type || 'standard',
                amount_paid: amount,
                currency: event.currency || 'XOF',
                payment_status: amount === 0 ? 'completed' : 'pending',
                payment_method: payment_method || null,
                order_id: order.id,
            })
            .select()
            .single()

        if (regErr) return NextResponse.json({ error: regErr.message }, { status: 500 })

        // 6. If free event, generate ticket immediately
        let ticket = null
        if (amount === 0) {
            const ticketCode = generateTicketCode(event.slug)
            const qrData = signTicket(ticketCode, eventId, registration.id)

            const { data: ticketData } = await supabase
                .from('event_tickets')
                .insert({
                    registration_id: registration.id,
                    event_id: eventId,
                    ticket_code: ticketCode,
                    qr_data: qrData,
                    ticket_type: ticket_type || 'standard',
                })
                .select()
                .single()

            ticket = ticketData
        }

        return NextResponse.json({
            registration,
            order_id: order.id,
            ticket,
            requires_payment: amount > 0,
            amount,
            currency: event.currency,
        }, { status: 201 })

    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// GET /api/events/[id]/register — list registrations (admin)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id: eventId } = await params
        const supabase = getSupabase()

        const { data, error } = await supabase
            .from('event_registrations')
            .select('*, event_tickets(id, ticket_code, is_used, used_at, ticket_type)')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ registrations: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
