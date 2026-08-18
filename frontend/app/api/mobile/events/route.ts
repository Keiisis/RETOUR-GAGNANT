import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { createTicketForRegistration } from '@/lib/event-tickets'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Verify Kkiapay transaction (server-side, anti-fraud) ───────────────────
async function verifyKkiapayTransaction(transactionId: string): Promise<{ ok: boolean; status: string; amount?: number }> {
    const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'

    if (!privateKey || !secretKey) return { ok: false, status: 'config_missing' }

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}` }
        const data = await res.json()
        return { ok: data?.status === 'SUCCESS', status: data?.status || 'unknown', amount: data?.amount }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed' }
    }
}

// ─── GET : liste des événements publiés ──────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const featured = searchParams.get('featured')
        const clientId = searchParams.get('client_id')

        let query = supabase
            .from('events')
            // ⚠️ Colonnes ALIGNÉES sur le schéma réellement déployé (vérifié en
            // base le 2026-08-18). Les noms visés ici n'existaient pas :
            //   · `cover_image` → la colonne s'appelle `cover_image_url` ;
            //   · `address`     → cette colonne n'existe pas (il y a `location`
            //                     et `location_map_url`) ;
            //   · `event_images.image_url` / `is_cover` → cette table expose
            //     `url`, `alt_text` et `sort_order` (aucune notion de couverture ;
            //     la couverture vit dans events.cover_image_url).
            // PostgREST rejette la requête ENTIÈRE dès qu'un seul nom est
            // inconnu : l'application ne recevait donc AUCUN événement, même
            // publié. C'est pourquoi l'événement de test n'apparaissait pas.
            //
            // Les alias conservent le contrat attendu par l'application
            // (`cover_image`, `image_url`) sans avoir à la modifier.
            .select(`
                id, title, slug, description, short_description,
                start_date, end_date, location, location_map_url,
                price_standard, price_vip, currency,
                max_capacity, max_vip_seats, status,
                is_featured, cover_image:cover_image_url, category,
                event_images(image_url:url, sort_order)
            `)
            .eq('status', 'published')
            .order('start_date', { ascending: true })
            // Sans borne, l'app téléchargeait TOUT l'historique d'événements à
            // chaque ouverture de l'onglet : payload qui grossit sans fin,
            // bande passante Vercel consommée et liste non virtualisée côté
            // mobile. On ne renvoie que ce qui est encore pertinent.
            .gte('start_date', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
            .limit(60)

        if (featured === 'true') query = query.eq('is_featured', true)

        const { data: events, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Compter les inscriptions confirmées par event (pour calculer la capacité restante)
        const eventIds = (events || []).map((e: Record<string, unknown>) => e.id as string)
        const seatsMap: Record<string, { standard: number; vip: number }> = {}
        if (eventIds.length > 0) {
            const { data: regs } = await supabase
                .from('event_registrations')
                .select('event_id, ticket_type, payment_status')
                .in('event_id', eventIds)
                .in('payment_status', ['pending', 'completed'])
            // Une inscription = une place : la table ne porte pas de quantité.
            for (const r of (regs || []) as Array<{ event_id: string; ticket_type: string }>) {
                if (!seatsMap[r.event_id]) seatsMap[r.event_id] = { standard: 0, vip: 0 }
                if (r.ticket_type === 'vip') seatsMap[r.event_id].vip += 1
                else seatsMap[r.event_id].standard += 1
            }
        }

        // Inscriptions du client demandé (pour afficher "déjà inscrit")
        let registrationsMap: Record<string, { id: string; status: string; ticket_type: string; payment_status?: string }> = {}
        if (clientId && eventIds.length > 0) {
            // Rattachement par EMAIL : event_registrations n'a pas de client_id.
            const { data: cp } = await supabase
                .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
            const email = String(cp?.email || '').trim().toLowerCase()
            if (email) {
                const { data: regs } = await supabase
                    .from('event_registrations')
                    .select('id, event_id, ticket_type, payment_status')
                    .eq('email', email)
                    .in('event_id', eventIds)
                if (regs) {
                    registrationsMap = (regs as Array<{ id: string; event_id: string; ticket_type: string; payment_status?: string }>).reduce((acc, r) => {
                        // `status` est dérivé du paiement : l'app affiche « confirmé »
                        // dès que plus rien n'est dû.
                        acc[r.event_id] = {
                            id: r.id,
                            status: r.payment_status === 'completed' ? 'confirmed' : 'pending_payment',
                            ticket_type: r.ticket_type,
                            payment_status: r.payment_status,
                        }
                        return acc
                    }, {} as Record<string, { id: string; status: string; ticket_type: string; payment_status?: string }>)
                }
            }
        }

        const enriched = (events || []).map((e: Record<string, unknown>) => {
            const reserved = seatsMap[e.id as string] || { standard: 0, vip: 0 }
            const max = (e.max_capacity as number) || 0
            const maxVip = (e.max_vip_seats as number) || 0
            return {
                ...e,
                my_registration: registrationsMap[e.id as string] || null,
                seats_remaining: max > 0 ? Math.max(0, max - reserved.standard) : null,
                vip_seats_remaining: maxVip > 0 ? Math.max(0, maxVip - reserved.vip) : null,
            }
        })

        return NextResponse.json({ events: enriched })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// ─── POST : s'inscrire à un événement ────────────────────────────────────────
//   Body : { event_id, client_id, ticket_type, quantity, transaction_id? }
//   Si `transaction_id` est fourni → vérifie le paiement Kkiapay côté serveur
//   et marque la registration comme `confirmed/paid` directement.
export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'mobile/events', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    // L'inscrit est celui qui présente le jeton, pas celui qu'annonce le
    // corps de la requête : sinon on inscrit : et on facture : au nom d'un
    // autre client. Repli sur body.client_id pour les anciennes versions.
    const sessionClientId = await getMobileUserId(req)

    try {
        const body = await req.json()
        const { event_id, ticket_type = 'standard', quantity = 1, transaction_id } = body
        const client_id = sessionClientId || body.client_id

        if (!event_id || !client_id) {
            return NextResponse.json({ error: 'event_id et client_id sont requis' }, { status: 400 })
        }
        const qty = Math.max(1, Math.min(10, parseInt(String(quantity), 10) || 1))

        // Event publié
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, slug, price_standard, price_vip, currency, max_capacity, max_vip_seats, status, start_date')
            .eq('id', event_id)
            .eq('status', 'published')
            .single()

        if (eventError || !event) {
            return NextResponse.json({ error: 'Événement introuvable ou non disponible' }, { status: 404 })
        }

        // ⚠️ SCHÉMA RÉELLEMENT DÉPLOYÉ (vérifié en base le 2026-08-17) :
        //    event_registrations = id, event_id, full_name, email, phone, whatsapp,
        //    ticket_type, amount_paid, currency, payment_status, payment_method,
        //    transaction_id, order_id, created_at.
        //    Il n'y a NI client_id, NI status, NI quantity, et payment_status
        //    n'accepte que pending | completed | failed | refunded.
        //    Ce code visait un schéma plus récent jamais appliqué : il insérait
        //    client_id/quantity/status et le statut 'paid' — donc TOUTE inscription
        //    depuis l'application échouait (la table était vide, sans erreur visible
        //    pour le client). On s'aligne sur la table réelle : le rattachement au
        //    client se fait par EMAIL, pris sur son profil (pas sur le corps de la
        //    requête, pour ne pas inscrire quelqu'un d'autre).
        const { data: cp } = await supabase
            .from('client_profiles')
            .select('nom, prenom, email, phone')
            .eq('id', client_id)
            .maybeSingle()

        const inscritEmail = String(cp?.email || body.email || '').trim().toLowerCase()
        const inscritNom = `${cp?.prenom || ''} ${cp?.nom || ''}`.trim() || String(body.full_name || '').trim()
        const inscritTel = String(cp?.phone || body.phone || '').trim()

        if (!inscritEmail) {
            return NextResponse.json(
                { error: 'Aucun email sur votre profil : complétez-le avant de vous inscrire.' },
                { status: 400 },
            )
        }

        // Déjà inscrit ?
        const { data: existing } = await supabase
            .from('event_registrations')
            .select('id, ticket_type, payment_status')
            .eq('event_id', event_id)
            .eq('email', inscritEmail)
            .neq('payment_status', 'refunded')
            .maybeSingle()

        if (existing) {
            return NextResponse.json({
                exists: true,
                registration: existing,
                message: 'Vous êtes déjà inscrit à cet événement.',
            }, { status: 200 })
        }

        // Vérification capacité
        const max = ticket_type === 'vip' ? (event.max_vip_seats as number) : (event.max_capacity as number)
        if (max && max > 0) {
            // Une inscription = une place (la table ne porte pas de quantité).
            const { count: reserved0 } = await supabase
                .from('event_registrations')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', event_id)
                .eq('ticket_type', ticket_type)
                .in('payment_status', ['pending', 'completed'])
            const reserved = reserved0 || 0
            if (reserved + qty > max) {
                return NextResponse.json(
                    { error: `Plus que ${Math.max(0, max - reserved)} place(s) disponible(s) pour cette catégorie` },
                    { status: 409 }
                )
            }
        }

        const unitPrice = ticket_type === 'vip'
            ? (event.price_vip || event.price_standard || 0)
            : (event.price_standard || 0)
        const totalAmount = unitPrice * qty
        const isFree = totalAmount === 0

        // Statut de paiement : SEULES les valeurs de la contrainte sont permises
        // (pending | completed | failed | refunded). Une place gratuite est
        // « completed » : il n'y a plus rien à régler.
        let paymentStatus: 'pending' | 'completed' = isFree ? 'completed' : 'pending'

        if (!isFree && transaction_id) {
            const verify = await verifyKkiapayTransaction(transaction_id)
            if (!verify.ok) {
                return NextResponse.json(
                    { error: `Paiement non confirmé (${verify.status})` },
                    { status: 402 }
                )
            }
            paymentStatus = 'completed'
        }

        const now = new Date().toISOString()
        const { data: registration, error: regError } = await supabase
            .from('event_registrations')
            .insert({
                event_id,
                full_name: inscritNom || 'Invité',
                email: inscritEmail,
                phone: inscritTel || null,
                ticket_type,
                amount_paid: paymentStatus === 'completed' ? totalAmount : 0,
                currency: event.currency || 'XOF',
                payment_status: paymentStatus,
                payment_method: transaction_id ? 'kkiapay' : (isFree ? 'gratuit' : null),
                transaction_id: transaction_id || null,
                created_at: now,
            })
            .select('id, amount_paid, currency, ticket_type, payment_status')
            .single()

        if (regError) {
            console.error('[POST /api/mobile/events]', regError)
            return NextResponse.json({ error: regError.message }, { status: 500 })
        }

        // Billet + QR dès que la place est acquise (événement gratuit, ou payé
        // d'emblée). Un pass acheté depuis l'application ne donnait AUCUN billet :
        // le client n'avait rien à présenter à l'entrée.
        let ticket: { ticket_code: string; qr_data: string } | null = null
        if (paymentStatus === 'completed') {
            ticket = await createTicketForRegistration(supabase, {
                registrationId: registration.id,
                eventId: event_id,
                eventSlug: String(event.slug || event.title || 'RGB'),
                ticketType: ticket_type,
            })
        }

        // Notification client (non bloquant)
        const notifTitle = isFree
            ? 'Inscription confirmée !'
            : (paymentStatus === 'completed' ? 'Paiement confirmé !' : 'Inscription enregistrée')
        const notifBody = isFree
            ? `Votre inscription à "${event.title}" est confirmée. À très bientôt !`
            : (paymentStatus === 'completed'
                ? `Votre place à "${event.title}" est confirmée. Référence : ${transaction_id}.`
                : `Votre inscription à "${event.title}" est en attente de paiement (${totalAmount.toLocaleString('fr-FR')} ${event.currency || 'XOF'}).`)

        supabase.from('notifications').insert({
            user_id: client_id,
            title: notifTitle,
            body: notifBody,
            type: 'event',
            is_read: false,
            created_at: now,
        }).then(() => null, () => null)

        return NextResponse.json({ registration, ticket }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── PATCH : confirmer le paiement d'une inscription existante ──────────────
//   Body : { registration_id, transaction_id }
export async function PATCH(req: NextRequest) {
    const trop = guardPublic(req, 'mobile/events', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    const sessionClientId = await getMobileUserId(req)

    try {
        const body = await req.json()
        const { registration_id, transaction_id } = body
        if (!registration_id || !transaction_id) {
            return NextResponse.json({ error: 'registration_id et transaction_id requis' }, { status: 400 })
        }

        const { data: reg, error: regErr } = await supabase
            .from('event_registrations')
            .select('id, event_id, email, amount_paid, payment_status, ticket_type')
            .eq('id', registration_id)
            .maybeSingle()
        if (regErr || !reg) {
            return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 })
        }

        // On ne confirme que SA propre inscription. La table n'ayant pas de
        // client_id, l'appartenance se vérifie par l'email du profil.
        if (sessionClientId) {
            const { data: cp } = await supabase
                .from('client_profiles').select('email').eq('id', sessionClientId).maybeSingle()
            const mien = String(cp?.email || '').trim().toLowerCase()
            if (mien && String(reg.email || '').trim().toLowerCase() !== mien) {
                return NextResponse.json({ error: 'Inscription non autorisée' }, { status: 403 })
            }
        }

        if (reg.payment_status === 'completed') {
            return NextResponse.json({ ok: true, message: 'Already paid', registration: reg })
        }

        const verify = await verifyKkiapayTransaction(transaction_id)
        if (!verify.ok) {
            return NextResponse.json(
                { error: `Paiement non confirmé (${verify.status})` },
                { status: 402 }
            )
        }

        const { data: updated, error: updErr } = await supabase
            .from('event_registrations')
            .update({
                payment_status: 'completed',
                payment_method: 'kkiapay',
                transaction_id,
                amount_paid: reg.amount_paid || 0,
            })
            .eq('id', registration_id)
            .select('id, payment_status, ticket_type')
            .single()

        if (updErr) {
            return NextResponse.json({ error: updErr.message }, { status: 500 })
        }

        // Paiement vérifié auprès de la passerelle → le billet peut être émis.
        const { data: evForTicket } = await supabase
            .from('events').select('slug, title').eq('id', reg.event_id).maybeSingle()
        const ticket = await createTicketForRegistration(supabase, {
            registrationId: registration_id,
            eventId: reg.event_id,
            eventSlug: String(evForTicket?.slug || evForTicket?.title || 'RGB'),
            ticketType: String((reg as Record<string, unknown>).ticket_type || 'standard'),
        })

        // Notification (non bloquant)
        supabase.from('notifications').insert({
            user_id: sessionClientId,
            title: 'Paiement confirmé !',
            body: `Votre paiement pour cet événement a été reçu. Réf : ${transaction_id}.`,
            type: 'event',
            is_read: false,
            created_at: new Date().toISOString(),
        }).then(() => null, () => null)

        return NextResponse.json({ ok: true, registration: updated, ticket })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
