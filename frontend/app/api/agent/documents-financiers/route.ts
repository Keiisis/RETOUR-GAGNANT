// ══════════════════════════════════════════════════════════════
//  DEVIS / FACTURES / AVOIRS : mutation serveur (service key)
//  Les UPDATE/DELETE directs depuis le navigateur sont bloqués par
//  RLS (0 ligne modifiée, sans erreur → faux succès puis retour à
//  l'état d'origine au rafraîchissement). On passe donc par cette
//  route serveur. Sous /api/agent/* : autorisée aux agents ET aux
//  admins (middleware + verifyApiAuth('agent') = agent | admin).
//
//  RÈGLES (audit du 25/09/2026 — la route n'en appliquait aucune : tout
//  agent pouvait réécrire le montant d'une facture payée d'un collègue,
//  la passer « payée » sans date ni moyen, ou la supprimer avec ses
//  encaissements) :
//    1. un agent n'agit que sur SES documents ; l'admin sur tous ;
//    2. une facture normalisée DGI (MECeF) ne se modifie plus : un avoir ;
//    3. une facture payée garde ses montants : un avoir, pas une retouche ;
//    4. « payé » se pose toujours avec sa date et son moyen ;
//    5. suppression : admin seulement, et jamais d'un document payé ou
//       normalisé (la numérotation et la comptabilité en dépendent) ;
//    6. chaque modification est tracée (audit_compta).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit-compta'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ROLES_ADMIN = ['admin', 'super_admin', 'superadmin', 'ceo']

const EDITABLE = ['client_nom', 'client_prenom', 'client_email', 'client_phone', 'client_adresse',
    'items', 'sous_total', 'total_tva', 'remise', 'total', 'currency', 'notes', 'conditions', 'validite'] as const

/** Champs qui changent ce que le client doit ou a payé. */
const MONTANTS = ['items', 'sous_total', 'total_tva', 'remise', 'total', 'currency']

const STATUTS = ['brouillon', 'envoye', 'accepte', 'refuse', 'paye', 'en_retard', 'annule']

type Doc = { id: string; agent_id: string | null; status: string | null; type: string | null; mecef_code: string | null; numero: string | null }

async function chargerAutorise(request: NextRequest, id: string) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return { erreur: auth.error! }
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data: doc } = await supabase
        .from('documents_financiers').select('id, agent_id, status, type, mecef_code, numero').eq('id', id).maybeSingle()
    if (!doc) return { erreur: NextResponse.json({ error: 'Document introuvable' }, { status: 404 }) }
    const isAdmin = ROLES_ADMIN.includes(String(auth.role || ''))
    if (!isAdmin && doc.agent_id !== auth.userId) {
        return { erreur: NextResponse.json({ error: 'Ce document appartient à un autre membre de l’équipe.' }, { status: 403 }) }
    }
    return { supabase, doc: doc as Doc, isAdmin, auth }
}

export async function PATCH(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const r = await chargerAutorise(request, id)
    if ('erreur' in r) return r.erreur
    const { supabase, doc, isAdmin, auth } = r

    if (doc.mecef_code) {
        return NextResponse.json(
            { error: 'Facture normalisée auprès de la DGI : elle ne se modifie plus. Émettez un avoir.' },
            { status: 409 },
        )
    }

    const update: Record<string, unknown> = {}

    // Action « marquer payé / impayé »
    if (body.action === 'mark_paid' || body.status === 'paye') {
        // « Payé » ne se pose jamais sans date ni moyen : c'est ce qui fait foi en comptabilité.
        update.status = 'paye'
        update.payment_method = typeof body.payment_method === 'string' && body.payment_method ? body.payment_method : 'manuel'
        update.paid_at = new Date().toISOString()
    } else if (body.action === 'mark_unpaid') {
        // Défaire un encaissement : décision de l'administration.
        if (doc.status === 'paye' && !isAdmin) {
            return NextResponse.json({ error: 'Seul un administrateur peut annuler un encaissement.' }, { status: 403 })
        }
        update.status = 'envoye'
        update.paid_at = null
    } else if (typeof body.status === 'string') {
        if (!STATUTS.includes(body.status)) {
            return NextResponse.json({ error: `Statut inconnu : ${body.status}` }, { status: 400 })
        }
        if (doc.status === 'paye' && !isAdmin) {
            return NextResponse.json({ error: 'Cette facture est payée : seul un administrateur peut changer son statut.' }, { status: 403 })
        }
        update.status = body.status
    }

    // Édition de champs (whitelist)
    for (const f of EDITABLE) {
        if (f in body) update[f] = body[f]
    }

    if (doc.status === 'paye' && MONTANTS.some(f => f in update)) {
        return NextResponse.json(
            { error: 'Facture payée : ses montants sont figés. Émettez un avoir pour corriger.' },
            { status: 409 },
        )
    }

    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { data: avant } = await supabase.from('documents_financiers').select(Object.keys(update).join(',')).eq('id', id).maybeSingle()
    const { data, error } = await supabase
        .from('documents_financiers').update(update).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'documents_financiers', recordId: id, action: 'update',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avant || null) as Record<string, unknown> | null, apres: update,
        motif: body.action ? `Action ${body.action} sur ${doc.numero || id}` : `Modification de ${doc.numero || id}`,
    })
    return NextResponse.json({ success: true, document: data })
}

export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id') || ''
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const r = await chargerAutorise(request, id)
    if ('erreur' in r) return r.erreur
    const { supabase, doc, isAdmin, auth } = r

    if (!isAdmin) {
        return NextResponse.json({ error: 'La suppression d’un document est réservée à l’administration.' }, { status: 403 })
    }
    if (doc.status === 'paye' || doc.mecef_code) {
        return NextResponse.json(
            { error: 'Un document payé ou normalisé ne se supprime pas : émettez un avoir.' },
            { status: 409 },
        )
    }

    const { data: avant } = await supabase.from('documents_financiers').select('*').eq('id', id).maybeSingle()
    // Nettoyer les paiements liés puis supprimer le document
    await supabase.from('paiements_manuels').delete().eq('document_id', id)
    const { error } = await supabase.from('documents_financiers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit(supabase, {
        table: 'documents_financiers', recordId: id, action: 'delete',
        acteur: { userId: auth.userId, role: auth.role },
        avant: (avant || null) as Record<string, unknown> | null,
        motif: `Suppression de ${doc.numero || id}`,
    })
    return NextResponse.json({ success: true })
}
