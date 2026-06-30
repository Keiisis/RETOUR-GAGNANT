import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { buildFec, serializeFec, fecBalance } from '@/lib/fec-syscohada'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const isValidPeriode = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)
const isValidAnnee = (a: string) => /^\d{4}$/.test(a)

// ══════════════════════════════════════════════════════════════
// GET /api/admin/comptabilite/fec?periode=YYYY-MM  (ou ?annee=YYYY)
// Export FEC / SYSCOHADA (écritures en partie double) — fichier .txt tabulé,
// importable par un logiciel comptable / transmissible à l'expert-comptable.
// ══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const periode = searchParams.get('periode')
    const annee = searchParams.get('annee')

    let start: Date, end: Date, label: string
    if (annee && isValidAnnee(annee)) {
        const y = Number(annee)
        start = new Date(Date.UTC(y, 0, 1)); end = new Date(Date.UTC(y + 1, 0, 1)); label = annee
    } else if (periode && isValidPeriode(periode)) {
        const [y, m] = periode.split('-').map(Number)
        start = new Date(Date.UTC(y, m - 1, 1)); end = new Date(Date.UTC(y, m, 1)); label = periode
    } else {
        const now = new Date()
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        label = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    }
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const startDay = startIso.slice(0, 10)
    const endDay = endIso.slice(0, 10)

    const supabase = createClient(supabaseUrl, serviceKey)

    const [docsRes, paiemRes, depRes, curRes] = await Promise.all([
        supabase.from('documents_financiers')
            .select('id, numero, type, status, total, total_tva, sous_total, remise, currency, created_at, client_nom, client_prenom')
            .eq('type', 'facture')
            .gte('created_at', startIso).lt('created_at', endIso),
        supabase.from('paiements_manuels')
            .select('id, document_id, montant, date_paiement, type, reference')
            .gte('date_paiement', startDay).lt('date_paiement', endDay),
        supabase.from('depenses')
            .select('id, titre, categorie, montant, date_depense')
            .gte('date_depense', startDay).lt('date_depense', endDay),
        supabase.from('currencies').select('code, exchange_rate_to_base, is_base'),
    ])

    // Carte de taux XOF par unité (table currencies = source de vérité)
    const rates: Record<string, number> = { XOF: 1 }
    for (const c of curRes.data || []) {
        const r = c.is_base ? 1 : Number(c.exchange_rate_to_base)
        if (c.code && isFinite(r) && r > 0) rates[String(c.code).toUpperCase()] = r
    }
    const toXof = (amount: number, currency?: string | null) => {
        const rate = rates[(currency || 'XOF').toUpperCase()] ?? 1
        return Math.round((Number(amount) || 0) * rate)
    }

    const rows = buildFec({
        docs: docsRes.data || [],
        paiements: paiemRes.data || [],
        depenses: depRes.data || [],
        toXof,
        validDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    })

    const balance = fecBalance(rows)
    const content = serializeFec(rows)
    // BOM UTF-8 pour compat tableurs/logiciels comptables
    const buffer = Buffer.from('﻿' + content, 'utf-8')
    const filename = `RGB_FEC_${label}.txt`

    return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(buffer.length),
            'X-FEC-Lines': String(rows.length),
            'X-FEC-Balanced': String(balance.balanced),
            'X-FEC-Debit': String(balance.debit),
            'X-FEC-Credit': String(balance.credit),
        },
    })
}
