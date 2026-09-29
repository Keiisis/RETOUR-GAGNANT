import { NextRequest, NextResponse } from 'next/server'
import { getMobileUserId } from '@/lib/mobile-auth'
import { facturerPaiementService } from '@/lib/service-invoice'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { PAYMENT_ROUTE_LIMIT } from '@/lib/rate-limit'
import { createTicketForRegistration } from '@/lib/event-tickets'
import { envoyerBilletParEmail } from '@/lib/event-ticket-email'
import { ttcFromHt } from '@/lib/tax'
import { toXOFStrict } from '@/lib/server-rates'
import { supabaseServeur as supabase } from '@/lib/supabase-serveur'
import {
    verifierKkiapay, montantCouvert, usagesTransaction, motifOuRien, estUuid,
} from '@/lib/mobile-paiement'

/* ════════════════════════════════════════════════════════════════════════════
   Événements côté application.

   Correctifs du 2026-09-28 :
   · l'inscrit est TOUJOURS celui du jeton (le repli `body.client_id`
     permettait d'inscrire — et de facturer — au nom d'un autre client ; le
     `?client_id=` du GET listait les inscriptions d'autrui) ;
   · le montant encaissé par Kkiapay est confronté au prix serveur TTC, en
     XOF (payer 100 XOF donnait un billet VIP) ;
   · une transaction ne sert qu'une fois (le même reçu confirmait plusieurs
     inscriptions) ;
   · la confirmation en deux temps (PATCH) établit enfin la facture.
   ════════════════════════════════════════════════════════════════════════════ */

type TypeBillet = 'standard' | 'vip'

interface EvenementPrix {
    price_standard: number | null
    price_vip: number | null
    currency: string | null
}

/** Prix d'une place : HT en devise de l'événement, TTC, et TTC en XOF (Kkiapay). */
async function prixPlace(ev: EvenementPrix, type: TypeBillet) {
    const devise = String(ev.currency || 'XOF').toUpperCase()
    const ht = type === 'vip'
        ? Number(ev.price_vip || ev.price_standard || 0)
        : Number(ev.price_standard || 0)
    const ttc = ht > 0 ? ttcFromHt(ht, devise) : 0
    const ttcXof = ttc > 0 ? await toXOFStrict(ttc, devise) : 0
    return { devise, ht, ttc, ttcXof }
}

/** Profil du porteur du jeton. */
async function profilDe(clientId: string) {
    const { data } = await supabase
        .from('client_profiles')
        .select('nom, prenom, email, phone')
        .eq('id', clientId)
        .maybeSingle()
    return data
}

// ─── GET : liste des événements publiés ──────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const featured = searchParams.get('featured')
        // Identité du JETON uniquement : `?client_id=` est ignoré (anti-IDOR).
        const clientId = await getMobileUserId(req)

        let query = supabase
            .from('events')
            // Colonnes alignées sur le schéma déployé (cover_image_url, event_images.url).
            // Les alias conservent le contrat attendu par l'application.
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
            .gte('start_date', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
            .limit(60)

        if (featured === 'true') query = query.eq('is_featured', true)

        const { data: events, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const eventIds = (events || []).map((e: Record<string, unknown>) => e.id as string)
        const seatsMap: Record<string, { standard: number; vip: number }> = {}
        if (eventIds.length > 0) {
            const { data: regs, error: regsErr } = await supabase
                .from('event_registrations')
                .select('event_id, ticket_type, payment_status')
                .in('event_id', eventIds)
                .in('payment_status', ['pending', 'completed'])
            if (regsErr) return NextResponse.json({ error: regsErr.message }, { status: 500 })
            for (const r of (regs || []) as Array<{ event_id: string; ticket_type: string }>) {
                if (!seatsMap[r.event_id]) seatsMap[r.event_id] = { standard: 0, vip: 0 }
                if (r.ticket_type === 'vip') seatsMap[r.event_id].vip += 1
                else seatsMap[r.event_id].standard += 1
            }
        }

        // Inscriptions du client connecté (« déjà inscrit »), par l'email de SON profil.
        let registrationsMap: Record<string, { id: string; status: string; ticket_type: string; payment_status?: string }> = {}
        if (clientId && eventIds.length > 0) {
            const cp = await profilDe(clientId)
            const email = String(cp?.email || '').trim().toLowerCase()
            if (email) {
                const { data: regs } = await supabase
                    .from('event_registrations')
                    .select('id, event_id, ticket_type, payment_status')
                    .ilike('email', motifOuRien(email))
                    .neq('payment_status', 'refunded')
                    .in('event_id', eventIds)
                registrationsMap = ((regs || []) as Array<{ id: string; event_id: string; ticket_type: string; payment_status?: string }>).reduce((acc, r) => {
                    acc[r.event_id] = {
                        id: r.id,
                        status: r.payment_status === 'completed' ? 'confirmed' : 'pending_payment',
                        ticket_type: r.ticket_type,
                        payment_status: r.payment_status,
                    }
                    return acc
                }, {} as typeof registrationsMap)
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
//   Headers : Authorization: Bearer <jeton>  (OBLIGATOIRE)
//   Body    : { event_id, ticket_type, transaction_id? }
//   Réponse : { registration, ticket, amount (XOF TTC à payer), currency: 'XOF' }
//   Une inscription = une place (la table ne porte pas de quantité).
export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'mobile/events', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const body = await req.json().catch(() => ({}))

    // COMPATIBILITÉ TRANSITOIRE (29/09/2026) : les apps déjà installées envoient
    // `client_id` dans le corps SANS jeton (corrigé dans la prochaine build EAS).
    // Sans ce repli, toute inscription depuis ces versions échouerait en 401.
    // Repli limité à un profil client EXISTANT ; le jeton reste prioritaire.
    // À retirer quand toutes les installations auront la nouvelle build.
    let clientId = await getMobileUserId(req)
    if (!clientId && estUuid(String(body?.client_id || ''))) {
        const { data: prof } = await supabase.from('client_profiles').select('id').eq('id', String(body.client_id)).maybeSingle()
        if (prof?.id) clientId = String(prof.id)
    }
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    try {
        const eventId = String(body.event_id || '')
        const ticketType: TypeBillet = body.ticket_type === 'vip' ? 'vip' : 'standard'
        const transactionId = body.transaction_id ? String(body.transaction_id).trim().slice(0, 128) : ''

        if (!estUuid(eventId)) {
            return NextResponse.json({ error: 'event_id invalide' }, { status: 400 })
        }

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, slug, price_standard, price_vip, currency, max_capacity, max_vip_seats, status, start_date')
            .eq('id', eventId)
            .eq('status', 'published')
            .maybeSingle()

        if (eventError || !event) {
            return NextResponse.json({ error: 'Événement introuvable ou non disponible' }, { status: 404 })
        }

        // Schéma déployé : event_registrations sans client_id ni quantity ;
        // payment_status ∈ pending | completed | failed | refunded. Le rattachement
        // se fait par l'EMAIL DU PROFIL (jamais un email du corps).
        const cp = await profilDe(clientId)
        const inscritEmail = String(cp?.email || '').trim().toLowerCase()
        const inscritNom = `${cp?.prenom || ''} ${cp?.nom || ''}`.trim()
        const inscritTel = String(cp?.phone || '').trim()

        if (!inscritEmail) {
            return NextResponse.json(
                { error: 'Aucun email sur votre profil : complétez-le avant de vous inscrire.' },
                { status: 400 },
            )
        }

        const prix = await prixPlace(event, ticketType)
        if (prix.ttcXof === null) {
            return NextResponse.json({ error: 'Devise de l’événement non prise en charge.' }, { status: 422 })
        }
        const isFree = prix.ht <= 0

        // Déjà inscrit ? (la réponse porte le montant de SA formule)
        const { data: existing, error: exErr } = await supabase
            .from('event_registrations')
            .select('id, ticket_type, payment_status')
            .eq('event_id', eventId)
            .ilike('email', motifOuRien(inscritEmail))
            .neq('payment_status', 'refunded')
            .limit(1)
            .maybeSingle()
        if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

        if (existing) {
            const prixExistant = await prixPlace(event, existing.ticket_type === 'vip' ? 'vip' : 'standard')
            return NextResponse.json({
                exists: true,
                registration: existing,
                amount: prixExistant.ttcXof,
                currency: 'XOF',
                message: 'Vous êtes déjà inscrit à cet événement.',
            }, { status: 200 })
        }

        // Capacité
        const max = ticketType === 'vip' ? (event.max_vip_seats as number) : (event.max_capacity as number)
        if (max && max > 0) {
            const { count: reserved0, error: cntErr } = await supabase
                .from('event_registrations')
                .select('id', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('ticket_type', ticketType)
                .in('payment_status', ['pending', 'completed'])
            if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 })
            const reserved = reserved0 || 0
            if (reserved + 1 > max) {
                return NextResponse.json(
                    { error: `Plus que ${Math.max(0, max - reserved)} place(s) disponible(s) pour cette catégorie` },
                    { status: 409 }
                )
            }
        }

        let paymentStatus: 'pending' | 'completed' = isFree ? 'completed' : 'pending'
        let montantEncaisseXof = 0

        if (!isFree && transactionId) {
            const { usages, erreur } = await usagesTransaction(supabase, transactionId)
            if (erreur) return NextResponse.json({ error: 'Vérification indisponible' }, { status: 503 })
            if (usages.length > 0) return NextResponse.json({ error: 'Transaction déjà utilisée' }, { status: 409 })

            const verify = await verifierKkiapay(supabase, transactionId)
            if (!verify.ok) {
                return NextResponse.json({ error: `Paiement non confirmé (${verify.status})` }, { status: 402 })
            }
            if (!montantCouvert(verify.montant, Number(prix.ttcXof))) {
                return NextResponse.json(
                    { error: `Montant encaissé insuffisant (${verify.montant} XOF pour ${prix.ttcXof} XOF). Référence : ${transactionId}` },
                    { status: 402 },
                )
            }
            paymentStatus = 'completed'
            montantEncaisseXof = verify.montant
        }

        const now = new Date().toISOString()
        const { data: registration, error: regError } = await supabase
            .from('event_registrations')
            .insert({
                event_id: eventId,
                full_name: inscritNom || 'Invité',
                email: inscritEmail,
                // `phone` NOT NULL en base : chaîne vide si le profil n'en porte pas.
                phone: inscritTel || '',
                ticket_type: ticketType,
                amount_paid: paymentStatus === 'completed' ? prix.ttc : 0,
                currency: prix.devise,
                payment_status: paymentStatus,
                payment_method: transactionId && !isFree ? 'kkiapay' : (isFree ? 'gratuit' : null),
                transaction_id: transactionId && !isFree ? transactionId : null,
                created_at: now,
            })
            .select('id, amount_paid, currency, ticket_type, payment_status')
            .single()

        if (regError) {
            console.error('[POST /api/mobile/events]', regError)
            return NextResponse.json({ error: regError.message }, { status: 500 })
        }

        if (transactionId && montantEncaisseXof > 0) {
            const r = await facturerPaiementService({
                transactionId,
                montantXof: montantEncaisseXof,
                libelle: `${event.title || 'Evenement'} : place ${ticketType === 'vip' ? 'VIP' : 'standard'}`,
                clientId,
                clientNom: cp?.nom || inscritNom,
                clientPrenom: cp?.prenom || '',
                clientEmail: inscritEmail,
                clientPhone: inscritTel,
                provider: 'kkiapay',
                source: 'Application mobile',
                reference: registration.id,
            }, supabase)
            if (!r.ok) console.error('[mobile/events] facture non etablie :', r.erreur)
        }

        let ticket: { ticket_code: string; qr_data: string } | null = null
        if (paymentStatus === 'completed') {
            ticket = await createTicketForRegistration(supabase, {
                registrationId: registration.id,
                eventId,
                eventSlug: String(event.slug || event.title || 'RGB'),
                ticketType,
            })
            if (ticket) {
                const envoi = await envoyerBilletParEmail(supabase, registration.id)
                if (!envoi.ok) console.error('[mobile/events] billet non envoye :', envoi.erreur)
            }
        }

        const notifTitle = isFree
            ? 'Inscription confirmée !'
            : (paymentStatus === 'completed' ? 'Paiement confirmé !' : 'Inscription enregistrée')
        const notifBody = isFree
            ? `Votre inscription à "${event.title}" est confirmée. À très bientôt !`
            : (paymentStatus === 'completed'
                ? `Votre place à "${event.title}" est confirmée. Référence : ${transactionId}.`
                : `Votre inscription à "${event.title}" est en attente de paiement (${Number(prix.ttcXof).toLocaleString('fr-FR')} XOF).`)

        supabase.from('notifications').insert({
            user_id: clientId,
            title: notifTitle,
            body: notifBody,
            type: 'event',
            is_read: false,
            created_at: now,
        }).then(() => null, () => null)

        return NextResponse.json({ registration, ticket, amount: prix.ttcXof, currency: 'XOF' }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// ─── PATCH : confirmer le paiement d'une inscription existante ──────────────
//   Body : { registration_id, transaction_id }
//   Jeton recommandé. Sans jeton (ancienne version / file de reprise), la
//   confirmation reste sûre : la transaction doit être vérifiée, neuve, et
//   couvrir le prix de CETTE place — payer la place d'un autre ne lèse personne.
export async function PATCH(req: NextRequest) {
    const trop = guardPublic(req, 'mobile/events', PAYMENT_ROUTE_LIMIT)
    if (trop) return trop

    const sessionClientId = await getMobileUserId(req)

    try {
        const body = await req.json().catch(() => ({}))
        const registrationId = String(body.registration_id || '')
        const transactionId = String(body.transaction_id || '').trim().slice(0, 128)
        if (!estUuid(registrationId) || !transactionId) {
            return NextResponse.json({ error: 'registration_id et transaction_id requis' }, { status: 400 })
        }

        const { data: reg, error: regErr } = await supabase
            .from('event_registrations')
            .select('id, event_id, email, full_name, phone, amount_paid, payment_status, ticket_type, transaction_id')
            .eq('id', registrationId)
            .maybeSingle()
        if (regErr || !reg) {
            return NextResponse.json({ error: 'Inscription introuvable' }, { status: 404 })
        }

        // Avec jeton : on ne confirme que SA propre inscription (email du profil).
        if (sessionClientId) {
            const cp = await profilDe(sessionClientId)
            const mien = String(cp?.email || '').trim().toLowerCase()
            if (!mien || String(reg.email || '').trim().toLowerCase() !== mien) {
                return NextResponse.json({ error: 'Inscription non autorisée' }, { status: 403 })
            }
        }

        if (reg.payment_status === 'completed') {
            // Rejeu de la même transaction : succès idempotent. Autre transaction : refus.
            if (!reg.transaction_id || reg.transaction_id === transactionId) {
                return NextResponse.json({ ok: true, message: 'Already paid', registration: { id: reg.id, payment_status: reg.payment_status, ticket_type: reg.ticket_type } })
            }
            return NextResponse.json({ error: 'Inscription déjà réglée' }, { status: 409 })
        }

        const { data: event, error: evErr } = await supabase
            .from('events').select('id, slug, title, price_standard, price_vip, currency').eq('id', reg.event_id).maybeSingle()
        if (evErr || !event) return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })

        const prix = await prixPlace(event, reg.ticket_type === 'vip' ? 'vip' : 'standard')
        if (prix.ttcXof === null) {
            return NextResponse.json({ error: 'Devise de l’événement non prise en charge.' }, { status: 422 })
        }

        const { usages, erreur } = await usagesTransaction(supabase, transactionId)
        if (erreur) return NextResponse.json({ error: 'Vérification indisponible' }, { status: 503 })
        if (usages.some(u => !(u.table === 'event_registrations' && u.id === reg.id))) {
            return NextResponse.json({ error: 'Transaction déjà utilisée' }, { status: 409 })
        }

        const verify = await verifierKkiapay(supabase, transactionId)
        if (!verify.ok) {
            return NextResponse.json({ error: `Paiement non confirmé (${verify.status})` }, { status: 402 })
        }
        if (!montantCouvert(verify.montant, Number(prix.ttcXof))) {
            return NextResponse.json(
                { error: `Montant encaissé insuffisant (${verify.montant} XOF pour ${prix.ttcXof} XOF). Référence : ${transactionId}` },
                { status: 402 },
            )
        }

        const { data: updated, error: updErr } = await supabase
            .from('event_registrations')
            .update({
                payment_status: 'completed',
                payment_method: 'kkiapay',
                transaction_id: transactionId,
                amount_paid: prix.ttc,
                currency: prix.devise,
            })
            .eq('id', registrationId)
            .neq('payment_status', 'completed')
            .select('id, payment_status, ticket_type')
            .maybeSingle()

        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        if (!updated) return NextResponse.json({ ok: true, message: 'Already paid', registration: { id: reg.id } })

        // Facture : la confirmation en deux temps n'en établissait aucune.
        const [prenom, ...reste] = String(reg.full_name || '').split(' ')
        const r = await facturerPaiementService({
            transactionId,
            montantXof: verify.montant,
            libelle: `${event.title || 'Evenement'} : place ${reg.ticket_type === 'vip' ? 'VIP' : 'standard'}`,
            clientId: sessionClientId,
            clientNom: reste.join(' ') || null,
            clientPrenom: prenom || null,
            clientEmail: reg.email || null,
            clientPhone: reg.phone || null,
            provider: 'kkiapay',
            source: 'Application mobile',
            reference: reg.id,
        }, supabase)
        if (!r.ok) console.error('[mobile/events PATCH] facture non etablie :', r.erreur)

        const ticket = await createTicketForRegistration(supabase, {
            registrationId,
            eventId: reg.event_id,
            eventSlug: String(event.slug || event.title || 'RGB'),
            ticketType: String(reg.ticket_type || 'standard'),
        })
        if (ticket) {
            const envoi = await envoyerBilletParEmail(supabase, registrationId)
            if (!envoi.ok) console.error('[mobile/events PATCH] billet non envoye :', envoi.erreur)
        }

        if (sessionClientId) {
            supabase.from('notifications').insert({
                user_id: sessionClientId,
                title: 'Paiement confirmé !',
                body: `Votre paiement pour cet événement a été reçu. Réf : ${transactionId}.`,
                type: 'event',
                is_read: false,
                created_at: new Date().toISOString(),
            }).then(() => null, () => null)
        }

        return NextResponse.json({ ok: true, registration: updated, ticket })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
