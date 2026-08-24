// ══════════════════════════════════════════════════════════════
//  Document d'un client — en PDF, pour l'application.
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
//  ⚠️ La source a changé : cette route lisait la table `invoices`, VIDE en
//  production. Elle lit désormais `documents_financiers`, comme la liste
//  (`/api/mobile/invoices`) et le panel — sinon toute facture affichée était
//  intéléchargeable (404 systématique). Elle sert les DEUX natures : facture
//  et devis, le générateur sachant produire les deux.
//
//  Le document n'est servi qu'à son propriétaire : le client est déduit du
//  jeton, jamais d'un paramètre (anti-IDOR). Comme les documents nés d'un
//  formulaire web ne portent pas toujours le compte, l'email DU PROFIL sert
//  de second verrou — jamais un email transmis par l'appelant.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { parapheDuClient } from '@/lib/mobile-facture'
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
        .from('documents_financiers')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (error || !f) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })

    // ── Appartenance : le compte, sinon l'email du profil ──
    let aLui = f.client_id === clientId
    if (!aLui) {
        const { data: profil } = await supabase
            .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
        const emailProfil = String(profil?.email || '').trim().toLowerCase()
        const emailDoc = String(f.client_email || '').trim().toLowerCase()
        aLui = !!emailProfil && emailProfil === emailDoc
    }
    // Le document d'un autre répond comme s'il n'existait pas.
    if (!aLui) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })

    const devise = String(f.currency || 'XOF').toUpperCase()
    const estDevis = String(f.type || 'facture') === 'devis'

    /* `items` est du jsonb libre : selon l'origine (boutique, dossier, ERP) les
       clés diffèrent. On accepte les formes rencontrées, et à défaut on émet
       une ligne unique — un document sans ligne serait illisible. */
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
            description: String(f.notes || '').split('\n')[0] || 'Prestation Retour Gagnant Bénin',
            quantity: 1,
            unit_price: Number(f.total) || 0,
            tva: TVA_RATE,
        }]

    /* Les totaux stockés font foi : ce sont eux qui ont servi à l'encaissement
       et qui sont en comptabilité. Le recalcul ne sert que de repli. */
    const calcSousTotal = lignes.reduce((s, l) => s + l.unit_price * l.quantity, 0)
    const calcTva = lignes.reduce((s, l) => s + (l.unit_price * l.quantity * (l.tva || 0)) / 100, 0)
    const sousTotal = Number.isFinite(Number(f.sous_total)) && f.sous_total !== null
        ? Number(f.sous_total) : calcSousTotal
    const totalTva = Number.isFinite(Number(f.total_tva)) && f.total_tva !== null
        ? Number(f.total_tva) : calcTva
    const remise = Number(f.remise) || 0
    const total = Number(f.total) > 0 ? Number(f.total) : sousTotal + totalTva - remise

    /* Paraphe du client sur le document.
       Il était absent : le client qui avait pris la peine d'enregistrer sa
       signature dans l'application recevait un « Bon pour accord » vide.
         · le document déjà signé porte SA signature (`signature_url`) ;
         · sinon, pour une FACTURE, le paraphe enregistré au profil, si la
           préférence l'autorise (`auto_sign` ≠ never) ;
         · un DEVIS non signé reste vierge — y apposer un paraphe
           reviendrait à faire signer un client qui n'a rien accepté. */
    const paraphe = f.signature_url
        || (estDevis ? undefined : await parapheDuClient(clientId))

    const base64 = generateInvoicePdf({
        invoiceRef: String(f.numero || f.id),
        date: dateFr(f.created_at),
        paidAt: f.paid_at ? dateFr(f.paid_at) : undefined,
        isPaid: !!f.paid_at || String(f.status) === 'paye' || String(f.status) === 'payee',
        clientName: [f.client_prenom, f.client_nom].filter(Boolean).join(' ').trim(),
        clientEmail: f.client_email || undefined,
        clientPhone: f.client_phone || undefined,
        clientAddress: f.client_adresse || undefined,
        items: lignes,
        currency: devise,
        sous_total: sousTotal,
        total_tva: totalTva,
        remise,
        total,
        notes: f.notes || undefined,
        conditions: f.conditions || undefined,
        validite: f.validite || undefined,
        docType: estDevis ? 'devis' : 'facture',
        clientSignatureDataUrl: paraphe || undefined,
    })

    const nom = `${estDevis ? 'DEVIS' : 'FACTURE'}-${String(f.numero || f.id).replace(/[^\w-]/g, '-')}.pdf`

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