import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateInvoicePdf, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'
import { TVA_RATE } from '@/lib/tax'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/* ══════════════════════════════════════════════════════════════════
   DEVIS D'UNE PROPOSITION SMART SLIDES

   Avant : un générateur PDF maison, différent du devis/facture officiel
   du cabinet → mise en page incohérente. Désormais on réutilise
   EXACTEMENT le générateur officiel `generateInvoicePdf` (mode 'devis'),
   celui du dashboard Agent/Admin. Un seul document, une seule identité.

   Les prix (`selling_price`) sont déjà libellés dans `proposal.currency`
   (converti à la génération), et la TVA 18 % s'ajoute (EN SUS).
══════════════════════════════════════════════════════════════════ */

// Référence : XX-MM/F/RGB/BENIN/YYYY-MM-DD/INITIALES
function generateRef(clientName: string, createdAt: string): string {
    const d = new Date(createdAt)
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${d.getFullYear()}-${mm}-${dd}`
    const initials = clientName.trim().split(/\s+/).map(p => p[0]?.toUpperCase() || '').join('')
    return `${yy}-${mm}/D/RGB/BENIN/${dateStr}/${initials}`
}

function dateFr(iso: string): string {
    const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const d = new Date(iso)
    return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`
}

interface ProposalRow {
    id: string
    client_name: string
    client_email: string | null
    client_phone?: string | null
    destination: string
    total_amount: number
    currency?: string
    created_at: string
}

interface ItemRow {
    type: string
    title: string
    selling_price: number
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: proposal, error: pe } = await supabase
            .from('ai_client_proposals')
            .select('id, client_name, client_email, client_phone, destination, total_amount, currency, created_at')
            .eq('id', id)
            .single()

        if (pe || !proposal) {
            return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
        }

        const { data: rawItems } = await supabase
            .from('ai_proposal_items')
            .select('type, title, selling_price')
            .eq('proposal_id', id)
            .order('order_index', { ascending: true })

        const p = proposal as ProposalRow
        const allItems: ItemRow[] = (rawItems || []) as ItemRow[]
        const currency = (p.currency || 'XOF').toUpperCase()
        const isZeroDecimal = currency === 'XOF' || currency === 'FCFA'
        const round = (v: number) => isZeroDecimal ? Math.round(v) : Math.round(v * 100) / 100

        // Éléments facturables (TVA au taux effectif — 0 % en cas d'exonération)
        const billable = allItems.filter(i => i.type !== 'hero' && i.type !== 'pricing' && i.selling_price > 0)
        const items: InvoicePdfItem[] = billable.map(i => ({
            description: `${i.title}${p.destination ? ` : ${p.destination}` : ''}`,
            quantity: 1,
            unit_price: round(Number(i.selling_price) || 0),
            tva: TVA_RATE,
        }))

        const sous_total = round(items.reduce((s, i) => s + i.unit_price, 0))
        const total_tva = round(sous_total * (TVA_RATE / 100))
        const total = round(sous_total + total_tva)

        // Document officiel : même générateur que le dashboard Agent/Admin.
        const base64 = generateInvoicePdf({
            invoiceRef: generateRef(p.client_name, p.created_at),
            date: dateFr(p.created_at),
            isPaid: false,
            clientName: p.client_name,
            clientEmail: p.client_email || undefined,
            clientPhone: p.client_phone || undefined,
            items,
            currency,
            sous_total,
            total_tva,
            remise: 0,
            total,
            validite: '14 jours',
            docType: 'devis',
        })

        const pdfBuffer = Buffer.from(base64, 'base64')
        const filename = `DEVIS-${p.client_name.replace(/\s+/g, '-').toUpperCase()}-${new Date(p.created_at).getFullYear()}.pdf`

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (err) {
        console.error('Devis PDF error:', err)
        return NextResponse.json({ error: 'Erreur génération PDF' }, { status: 500 })
    }
}
