import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { ttcFromHt } from '@/lib/tax'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── POST : inscription à un événement depuis l'app mobile ───────────────────
export async function POST(req: NextRequest,
    { params }: { params: Promise<{ id: string }> }) {
    const trop = guardPublic(req, 'mobile/events/[id]/register', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const { id: eventId } = await params
        const body = await req.json()
        const { client_id, full_name, email, phone, ticket_type = 'standard' } = body

        if (!client_id || !full_name || !email) {
            return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
        }

        // Charger l'événement
        const { data: event, error: evErr } = await supabase
            .from('events')
            .select('id, title, price_standard, price_vip, currency, max_capacity, max_vip_seats, status, start_date')
            .eq('id', eventId)
            .single()

        if (evErr || !event) {
            return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
        }
        if (event.status !== 'published') {
            return NextResponse.json({ error: 'Cet événement n\'est plus disponible' }, { status: 400 })
        }

        // Vérifier capacité
        const { count: regCount } = await supabase
            .from('event_registrations')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .in('payment_status', ['pending', 'paid'])

        if (event.max_capacity && (regCount || 0) >= event.max_capacity) {
            return NextResponse.json({ error: 'L\'événement est complet' }, { status: 400 })
        }

        if (ticket_type === 'vip' && event.max_vip_seats) {
            const { count: vipCount } = await supabase
                .from('event_registrations')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('ticket_type', 'vip')
                .in('payment_status', ['pending', 'paid'])

            if ((vipCount || 0) >= event.max_vip_seats) {
                return NextResponse.json({ error: 'Les places VIP sont épuisées' }, { status: 400 })
            }
        }

        // Vérifier si déjà inscrit
        const { data: existing } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('event_id', eventId)
            .eq('email', email.toLowerCase())
            .in('payment_status', ['pending', 'paid'])
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Vous êtes déjà inscrit à cet événement' }, { status: 409 })
        }

        // TVA « en sus » : prix billet HORS TAXE, la TVA 18 % s'ajoute (TTC).
        const priceHt = ticket_type === 'vip' ? (event.price_vip || 0) : (event.price_standard || 0)
        const amount = priceHt > 0 ? ttcFromHt(priceHt, event.currency || 'XOF') : 0

        // Créer l'inscription
        const { data: registration, error: regErr } = await supabase
            .from('event_registrations')
            .insert({
                event_id: eventId,
                client_id,
                full_name,
                email: email.toLowerCase(),
                phone: phone || null,
                ticket_type,
                amount_paid: amount,
                currency: event.currency || 'XOF',
                payment_status: amount === 0 ? 'paid' : 'pending',
                payment_method: amount === 0 ? 'gratuit' : null,
            })
            .select('id')
            .single()

        if (regErr) {
            return NextResponse.json({ error: regErr.message }, { status: 500 })
        }

        // Notification client
        await supabase.from('notifications').insert({
            user_id: client_id,
            title: amount === 0 ? 'Inscription confirmée !' : 'Inscription enregistrée',
            body: amount === 0
                ? `Vous êtes inscrit à "${event.title}". À bientôt !`
                : `Votre inscription à "${event.title}" est en attente de paiement.`,
            type: 'event',
            is_read: false,
            created_at: new Date().toISOString(),
        })

        return NextResponse.json({
            id: registration.id,
            amount,
            currency: event.currency || 'XOF',
            is_free: amount === 0,
            event_title: event.title,
            event_date: event.start_date,
        }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
