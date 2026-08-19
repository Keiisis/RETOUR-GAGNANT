// ══════════════════════════════════════════════════════════════
//  Facture d'un client — en PDF, pour l'application.
//
//  L'application ouvrait `/api/invoices/[id]`, qui renvoie une page HTML : le
//  téléphone quittait l'app pour le navigateur, et le client se retrouvait
//  avec une page web au lieu d'un document. Rien à ranger, rien à envoyer à
//  son comptable.
//
//  Ici, un VRAI PDF, produit par `generateInvoicePdf` — le générateur officiel
//  du panel, celui des devis et factures de l'agence. Un seul document, une
//  seule identité visuelle.
//
//  La facture n'est servie qu'à son propriétaire : le client est déduit du
//  jeton, jamais d'un paramètre (anti-IDOR).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { generateInvoicePdf, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'
import { TVA_RATE } from '@/lib/tax'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const dateFr = (iso?: string | null) => {
    if (!iso) return ''
    const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const d = new Date(iso)
    return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { id } = await params

    const { data: f, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('client_id', clientId)   // la facture d'un autre reste inaccessible
        .maybeSingle()

    if (error || !f) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 })

    const devise = String(f.currency || 'XOF').toUpperCase()

    /* `items` est du jsonb libre : selon l'origine (boutique, dossier, ERP) les
       clés diffèrent. On accepte les formes rencontrées, et à défaut on émet
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
            description: String(f.description || 'Prestation Retour Gagnant Bénin'),
            quantity: 1,
            unit_price: Number(f.amount) || 0,
            tva: TVA_RATE,
        }]

    const sousTotal = lignes.reduce((s, l) => s + l.unit_price * l.quantity, 0)
    const totalTva = lignes.reduce((s, l) => s + (l.unit_price * l.quantity * (l.tva || 0)) / 100, 0)
    // Le total facturé fait foi : il a servi à l'encaissement.
    const total = Number(f.amount) > 0 ? Number(f.amount) : sousTotal + totalTva

    const base64 = generateInvoicePdf({
        invoiceRef: String(f.invoice_ref || f.id),
        date: dateFr(f.issued_at || f.created_at),
        paidAt: f.paid_at ? dateFr(f.paid_at) : undefined,
        isPaid: f.status === 'payee' || f.status === 'paid' || !!f.paid_at,
        clientName: String(f.customer_name || ''),
        clientEmail: f.sent_to_email || undefined,
        items: lignes,
        currency: devise,
        sous_total: sousTotal,
        total_tva: totalTva,
        remise: 0,
        total,
        docType: 'facture',
    })

    const nom = `FACTURE-${String(f.invoice_ref || f.id).replace(/[^\w-]/g, '-')}.pdf`

    return new NextResponse(new Uint8Array(Buffer.from(base64, 'base64')), {
        headers: {
            'Content-Type': 'application/pdf',
            // `inline` : le téléphone affiche le document au lieu de le
            // télécharger en aveugle. L'application, elle, l'enregistre.
            'Content-Disposition': `inline; filename="${nom}"`,
            'Cache-Control': 'no-store',
        },
    })
}
