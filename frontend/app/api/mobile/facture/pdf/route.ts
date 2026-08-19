// ══════════════════════════════════════════════════════════════
//  La facture d'un paiement, en PDF — la MÊME que celle du site.
//
//  Un seul générateur pour toute l'agence (`generateInvoicePdf`) : le panel,
//  l'email et le téléphone impriment donc le même document, à la virgule près.
//  Rien n'est redessiné côté application : un client qui compare son écran et
//  sa pièce jointe doit voir la même facture.
//
//  Le « Bon pour accord » porte le paraphe enregistré du client quand il en a
//  un — le même fichier que la facture du site appose.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { resoudreFactureDuClient, parapheDuClient } from '@/lib/mobile-facture'
import { generateInvoicePdf, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'
import { TVA_RATE } from '@/lib/tax'

const dateFr = (iso?: string | null) => {
    if (!iso) return ''
    const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const d = new Date(iso)
    return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`
}

export async function GET(req: NextRequest) {
    const r = await resoudreFactureDuClient(req)
    if (r.erreur) return NextResponse.json({ error: r.erreur.message }, { status: r.erreur.status })

    const f = r.facture
    if (!f) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 })

    /* `items` est du jsonb : selon l'origine (service, boutique, panel) les
       clés diffèrent. On accepte les formes rencontrées et, à défaut, on émet
       une ligne unique — une facture sans ligne serait illisible. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brut: any[] = Array.isArray(f.items) ? f.items : []
    const lignes: InvoicePdfItem[] = brut.length
        ? brut.map(l => ({
            description: String(l.description || l.title || l.name || 'Prestation'),
            quantity: Number(l.quantity ?? l.qty ?? 1) || 1,
            unit_price: Number(l.unit_price ?? l.price ?? l.amount ?? 0) || 0,
            tva: Number(l.tva ?? TVA_RATE) || 0,
        }))
        : [{
            description: 'Prestation Retour Gagnant Bénin',
            quantity: 1,
            unit_price: Number(f.total) || 0,
            tva: TVA_RATE,
        }]

    const sousTotal = Number(f.sous_total) > 0
        ? Number(f.sous_total)
        : lignes.reduce((s, l) => s + l.unit_price * l.quantity, 0)
    // Le total facturé fait foi : c'est lui qui a servi à l'encaissement.
    const total = Number(f.total) || sousTotal
    const totalTva = Number(f.total_tva) >= 0 ? Number(f.total_tva) : Math.max(0, total - sousTotal)

    const paraphe = await parapheDuClient(r.clientId!)
    const acquittee = f.status === 'paye' || !!f.paid_at

    const base64 = generateInvoicePdf({
        invoiceRef: String(f.numero || f.id.slice(0, 8).toUpperCase()),
        date: dateFr(f.created_at),
        paidAt: f.paid_at ? dateFr(f.paid_at) : undefined,
        isPaid: acquittee,
        clientName: `${f.client_prenom || ''} ${f.client_nom || ''}`.trim() || 'Client',
        clientEmail: f.client_email || undefined,
        clientPhone: f.client_phone || undefined,
        clientAddress: f.client_adresse || undefined,
        items: lignes,
        currency: String(f.currency || 'XOF').toUpperCase(),
        sous_total: sousTotal,
        total_tva: totalTva,
        remise: Number(f.remise) || 0,
        total,
        notes: f.notes || undefined,
        conditions: 'Paiement effectué en ligne.',
        docType: f.type === 'devis' ? 'devis' : 'facture',
        /* Facture acquittée : le cadre de droite affiche la confirmation de
           paiement. Le paraphe, lui, rouvre le « Bon pour accord » à gauche. */
        isManual: acquittee,
        clientSignatureDataUrl: paraphe,
    })

    const nom = `FACTURE-${String(f.numero || f.id).replace(/[^\w-]/g, '-')}.pdf`

    return new NextResponse(new Uint8Array(Buffer.from(base64, 'base64')), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${nom}"`,
            'Cache-Control': 'no-store',
        },
    })
}
