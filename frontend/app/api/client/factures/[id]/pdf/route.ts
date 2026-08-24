// ══════════════════════════════════════════════════════════════
//  FACTURE CLIENT : PDF téléchargeable
//
//  Le générateur generateInvoicePdf existait mais n'était branché nulle
//  part : le client ne pouvait PAS télécharger ses factures
//  documents_financiers (seules les commandes boutique avaient un PDF).
//  Cette route comble ce manque, avec vérification de propriété : on ne
//  télécharge que SA propre facture.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientUser } from '@/lib/client-auth'
import { generateInvoicePdf, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/* La date était passée BRUTE (« 2026-08-21T11:52:35.626706+00:00 ») : c'est
   l'horodatage de la base qui s'imprimait sur le document du client. */
const dateFr = (iso?: string | null) => {
    if (!iso) return ''
    const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? String(iso) : `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const supabase = db()
    const { data: doc } = await supabase
        .from('documents_financiers')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (!doc) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

    // Propriété : la facture doit être celle du client connecté.
    const aLui = doc.client_id === user.id
        || (!!doc.client_email && String(doc.client_email).toLowerCase() === user.email.toLowerCase())
    if (!aLui) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const items: InvoicePdfItem[] = Array.isArray(doc.items)
        ? doc.items.map((it: Record<string, unknown>) => ({
            description: String(it.description || ''),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            tva: Number(it.tva) || 0,
        }))
        : []

    const estDevis = String(doc.type || 'facture') === 'devis'

    /* Paraphe du client : le document signé porte SA signature, sinon le
       paraphe enregistré au profil pour une facture. Un devis non signé
       reste vierge — on ne fait pas signer quelqu'un qui n'a rien accepté. */
    let paraphe: string | undefined = doc.signature_url || undefined
    if (!paraphe && !estDevis) {
        const { data: sig } = await supabase
            .from('client_signatures')
            .select('signature_data, auto_sign')
            .eq('client_id', user.id)
            .maybeSingle()
        if (sig?.signature_data && sig.auto_sign !== 'never') paraphe = sig.signature_data
    }

    const base64 = generateInvoicePdf({
        invoiceRef: doc.numero || doc.id,
        date: dateFr(doc.created_at),
        paidAt: doc.paid_at ? dateFr(doc.paid_at) : undefined,
        isPaid: doc.status === 'paye',
        clientName: `${doc.client_prenom || ''} ${doc.client_nom || ''}`.trim() || doc.client_email || 'Client',
        clientEmail: doc.client_email || undefined,
        clientPhone: doc.client_phone || undefined,
        clientAddress: doc.client_adresse || undefined,
        items,
        currency: doc.currency || 'XOF',
        sous_total: Number(doc.sous_total) || 0,
        total_tva: Number(doc.total_tva) || 0,
        remise: Number(doc.remise) || 0,
        total: Number(doc.total) || 0,
        notes: doc.notes || undefined,
        conditions: doc.conditions || undefined,
        validite: doc.validite || undefined,
        // Sans ce type, un DEVIS téléchargé ici s'intitulait « FACTURE ».
        docType: estDevis ? 'devis' : 'facture',
        clientSignatureDataUrl: paraphe,
    })

    const pdf = Buffer.from(base64, 'base64')
    const nom = `${estDevis ? 'Devis' : 'Facture'}-${(doc.numero || doc.id).replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nom}"`,
            'Cache-Control': 'private, no-store',
        },
    })
}
