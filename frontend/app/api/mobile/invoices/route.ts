import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/* ════════════════════════════════════════════════════════════════════════════
   Mobile invoices listing.
   GET ?client_id=...           → list all invoices for a client
   GET ?client_id=...&id=...    → fetch one invoice (metadata only)
   The HTML view itself stays at /api/invoices/[id] (shared with web).
   ════════════════════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const clientId = url.searchParams.get('client_id')
        const invoiceId = url.searchParams.get('id')

        if (!clientId) {
            return NextResponse.json({ error: 'client_id manquant' }, { status: 400 })
        }

        if (invoiceId) {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .eq('client_id', clientId)
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            if (!data) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
            return NextResponse.json({ invoice: data })
        }

        const { data, error } = await supabase
            .from('invoices')
            .select(`
                id, invoice_ref, order_id, dossier_id,
                customer_name, amount, currency, description,
                status, issued_at, paid_at, sent_to_email,
                pdf_url, items, created_at
            `)
            .eq('client_id', clientId)
            .order('issued_at', { ascending: false })
            .limit(100)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ invoices: data || [] })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
