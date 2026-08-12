// ══════════════════════════════════════════════════════════════
//  RENDEZ-VOUS : mutation centralisée (client + agent + admin)
//
//  Un seul point d'autorité pour changer le statut d'un rendez-vous,
//  au lieu de mises à jour Supabase directes éparpillées :
//   • le CLIENT ne peut qu'ANNULER son propre RDV, et seulement s'il
//     est encore à venir (pas de « décommande » d'un RDV passé/terminé) ;
//   • le STAFF (agent/admin) peut porter n'importe quel statut sur
//     n'importe quel RDV (confirmer, annuler, terminer, remettre en
//     attente).
//
//  Toute transition notifie le client (cloche in-app via la fonction
//  create_client_notification déjà en place) : un RDV confirmé ou refusé
//  ne doit jamais rester silencieux.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientUser } from '@/lib/client-auth'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Statut = 'en_attente' | 'confirme' | 'annule' | 'termine'
const STATUTS: Statut[] = ['en_attente', 'confirme', 'annule', 'termine']

const LIBELLE_NOTIF: Record<Statut, { titre: string; corps: string }> = {
    confirme: {
        titre: 'Rendez-vous confirmé',
        corps: 'Votre rendez-vous a été confirmé. Retrouvez le détail dans votre espace.',
    },
    annule: {
        titre: 'Rendez-vous annulé',
        corps: 'Votre rendez-vous a été annulé. Vous pouvez en reprogrammer un à tout moment.',
    },
    termine: {
        titre: 'Rendez-vous terminé',
        corps: 'Votre rendez-vous est marqué comme terminé. Merci de votre confiance.',
    },
    en_attente: {
        titre: 'Rendez-vous mis à jour',
        corps: 'Le statut de votre rendez-vous a évolué. Consultez votre espace.',
    },
}

/** Un RDV encore à venir peut-il être annulé par le client ? */
function estAVenir(rdv: { date: string; statut: string }): boolean {
    if (rdv.statut === 'annule' || rdv.statut === 'termine') return false
    const jour = new Date(`${rdv.date}T23:59:59`)
    return !isNaN(jour.getTime()) && jour.getTime() >= Date.now()
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const cible = String(body.statut || '').trim() as Statut
    if (!STATUTS.includes(cible)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    const supabase = db()
    const { data: rdv } = await supabase
        .from('rdv_requests')
        .select('id, client_id, client_email, date, heure, type, motif, statut')
        .eq('id', id)
        .maybeSingle()

    if (!rdv) return NextResponse.json({ error: 'Rendez-vous introuvable' }, { status: 404 })

    // ── Qui appelle ? Staff d'abord, puis client. ─────────────────
    const staff = await verifyApiAuth(request, 'agent')
    let acteur: 'staff' | 'client' | null = staff.authenticated ? 'staff' : null

    if (!acteur) {
        const client = await getClientUser(request)
        if (!client) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // Le RDV lui appartient-il ? (par id de compte OU par email vérifié)
        const aLui = rdv.client_id === client.id
            || (!!rdv.client_email && rdv.client_email.toLowerCase() === client.email.toLowerCase())
        if (!aLui) return NextResponse.json({ error: 'Ce rendez-vous ne vous appartient pas.' }, { status: 403 })

        // Un client ne peut QU'annuler, et seulement un RDV à venir.
        if (cible !== 'annule') {
            return NextResponse.json({ error: 'Vous ne pouvez qu’annuler un rendez-vous.' }, { status: 403 })
        }
        if (!estAVenir(rdv)) {
            return NextResponse.json({ error: 'Ce rendez-vous ne peut plus être annulé.' }, { status: 409 })
        }
        acteur = 'client'
    }

    if (rdv.statut === cible) {
        return NextResponse.json({ success: true, rdv, inchange: true })
    }

    const { data: maj, error } = await supabase
        .from('rdv_requests')
        .update({ statut: cible })
        .eq('id', id)
        .select('id, client_id, client_email, date, heure, type, motif, statut')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Notifier le client (sauf s'il est lui-même l'acteur) ──────
    // Inutile de notifier quelqu'un de sa propre action.
    if (acteur === 'staff') {
        try {
            const { data: uid } = await supabase.rpc('resolve_client_user_id', {
                p_client_id: rdv.client_id, p_email: rdv.client_email,
            })
            if (uid) {
                const n = LIBELLE_NOTIF[cible]
                await supabase.rpc('create_client_notification', {
                    p_user_id: uid, p_title: n.titre, p_body: n.corps, p_type: 'rdv',
                })
            }
        } catch { /* la notif ne doit jamais bloquer la mise à jour */ }
    }

    return NextResponse.json({ success: true, rdv: maj, acteur })
}
