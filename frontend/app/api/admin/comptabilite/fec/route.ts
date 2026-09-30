import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { buildFec, serializeFec, fecBalance, facturesPayeesEnLigne, type FecDoc } from '@/lib/fec-syscohada'
import { buildFecWorkbook } from '@/lib/fec-workbook'

const DOC_COLS = 'id, numero, type, status, total, total_tva, sous_total, remise, currency, created_at, paid_at, payment_method, client_id, client_email, client_nom, client_prenom'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const isValidPeriode = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)
const isValidAnnee = (a: string) => /^\d{4}$/.test(a)

// ══════════════════════════════════════════════════════════════
// GET /api/admin/comptabilite/fec?periode=YYYY-MM  (ou ?annee=YYYY)
// Export FEC / SYSCOHADA (écritures en partie double) : fichier .txt tabulé,
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

    const [docsRes, payeesRes, paiemRes, depRes, curRes] = await Promise.all([
        // Ventes : factures ÉMISES dans la période (date = created_at)
        supabase.from('documents_financiers')
            .select(DOC_COLS)
            .eq('type', 'facture')
            .gte('created_at', startIso).lt('created_at', endIso),
        // Encaissements en ligne : factures PAYÉES dans la période (paid_at),
        // quelle que soit leur date d'émission
        supabase.from('documents_financiers')
            .select(DOC_COLS)
            .eq('type', 'facture').eq('status', 'paye')
            .gte('paid_at', startIso).lt('paid_at', endIso),
        supabase.from('paiements_manuels')
            .select('id, document_id, montant, date_paiement, type, reference')
            .gte('date_paiement', startDay).lt('date_paiement', endDay),
        supabase.from('depenses')
            .select('id, titre, categorie, montant, devise, date_depense')
            .gte('date_depense', startDay).lt('date_depense', endDay),
        supabase.from('currencies').select('code, exchange_rate_to_base, is_base'),
    ])

    // Une lecture ratée produisait un FEC vide mais « équilibré » : export
    // trompeur transmis à l'expert-comptable. On refuse.
    const erreurLecture = docsRes.error || payeesRes.error || paiemRes.error || depRes.error
    if (erreurLecture) {
        return NextResponse.json({ error: `Lecture comptable impossible : ${erreurLecture.message}` }, { status: 500 })
    }
    const docs = (docsRes.data || []) as FecDoc[]
    const paiements = paiemRes.data || []

    // Factures payées sans paiement manuel → écriture d'encaissement datée
    // du paiement. Candidates : payées dans la période (paid_at) + émises dans
    // la période, payées, sans paid_at (repli created_at).
    const candidats = [...((payeesRes.data || []) as FecDoc[]), ...docs.filter(d => d.status === 'paye' && !d.paid_at)]
    const idsCandidats = [...new Set(candidats.map(d => d.id))]
    // Factures liées aux paiements de la période mais émises un autre mois
    const idsLies = [...new Set(paiements.map(p => p.document_id).filter((x): x is string => !!x && !docs.some(d => d.id === x)))]
    const [avecPaiementRes, liesRes] = await Promise.all([
        idsCandidats.length
            ? supabase.from('paiements_manuels').select('document_id').in('document_id', idsCandidats)
            : Promise.resolve({ data: [] as { document_id: string | null }[], error: null }),
        idsLies.length
            ? supabase.from('documents_financiers').select(DOC_COLS).in('id', idsLies)
            : Promise.resolve({ data: [] as FecDoc[], error: null }),
    ])
    const erreur2 = avecPaiementRes.error || liesRes.error
    if (erreur2) {
        return NextResponse.json({ error: `Lecture comptable impossible : ${erreur2.message}` }, { status: 500 })
    }
    const idsAvecPaiement = new Set((avecPaiementRes.data || []).map(p => p.document_id).filter((x): x is string => !!x))
    const facturesEncaissees = facturesPayeesEnLigne(candidats, idsAvecPaiement, start, end)
    const docsRef = (liesRes.data || []) as FecDoc[]

    // Carte de taux XOF par unité (table currencies = source de vérité).
    // EUR : parité FIXE BCEAO en repli — sans elle, une table currencies
    // incomplète comptait 1 € pour 1 FCFA.
    const rates: Record<string, number> = { XOF: 1, EUR: 655.957 }
    for (const c of curRes.data || []) {
        const r = c.is_base ? 1 : Number(c.exchange_rate_to_base)
        if (c.code && isFinite(r) && r > 0) rates[String(c.code).toUpperCase()] = r
    }
    const toXof = (amount: number, currency?: string | null) => {
        const rate = rates[(currency || 'XOF').toUpperCase()] ?? 1
        return Math.round((Number(amount) || 0) * rate)
    }

    const rows = buildFec({
        docs,
        paiements,
        depenses: depRes.data || [],
        facturesEncaissees,
        docsRef,
        toXof,
        validDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    })

    const balance = fecBalance(rows)

    // ── Format .txt réglementaire (import logiciels comptables) : ?format=txt ──
    const format = searchParams.get('format') || 'xlsx'
    if (format === 'txt') {
        const content = serializeFec(rows)
        // BOM UTF-8 pour compat tableurs/logiciels comptables
        const buffer = Buffer.from('﻿' + content, 'utf-8')
        return new NextResponse(buffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="RGB_FEC_${label}.txt"`,
                'Content-Length': String(buffer.length),
                'X-FEC-Lines': String(rows.length),
                'X-FEC-Balanced': String(balance.balanced),
            },
        })
    }

    // ── Format Excel professionnel (défaut) : feuilles LISIBLES (Factures,
    //    Encaissements, Dépenses : une ligne par opération) + feuille partie
    //    double (expert-comptable) + synthèse ──────────────────────────────────
    const xlsxBuffer = await buildFecWorkbook(rows, balance, label, {
        docs,
        paiements,
        depenses: depRes.data || [],
        facturesEncaissees,
        docsRef,
        toXof,
    })
    return new NextResponse(xlsxBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="RGB_FEC_${label}.xlsx"`,
            'Content-Length': String((xlsxBuffer as ArrayBuffer).byteLength),
            'X-FEC-Lines': String(rows.length),
            'X-FEC-Balanced': String(balance.balanced),
        },
    })
}
