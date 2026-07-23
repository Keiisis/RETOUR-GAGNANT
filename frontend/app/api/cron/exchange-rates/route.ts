// ══════════════════════════════════════════════════════════════
//  CRON — Rafraîchissement des taux de change réels
// ──────────────────────────────────────────────────────────────
// S'exécute chaque nuit via Vercel Cron (voir vercel.json).
//
// Source : open.er-api.com (gratuit, sans clé). Base XOF.
// Met à jour la table `currencies.exchange_rate_to_base` (= XOF par 1 unité
// de la devise) pour toutes les devises présentes, SAUF :
//   • XOF (devise de base, toujours 1)
//   • EUR (parité FIXE 655,957 — jamais dépendante d'une API)
//
// Robustesse : si l'API échoue ou renvoie une valeur aberrante, on NE touche
// PAS la ligne (on conserve la dernière valeur connue/manuelle). Pas de
// surécriture destructive.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { executerCron } from '@/lib/cron-journal'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const FX_URL = 'https://open.er-api.com/v6/latest/XOF'
const EUR_PEG = 655.957  // parité fixe FCFA ↔ EUR (exacte)


async function runRefresh() {
    if (!serviceKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Lire les devises gérées
    const { data: currencies, error: curErr } = await supabase
        .from('currencies')
        .select('code, is_base')
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 })

    // 2. Récupérer les taux réels (base XOF)
    let apiRates: Record<string, number> = {}
    try {
        const res = await fetch(FX_URL, { headers: { Accept: 'application/json' } })
        const json = await res.json()
        // open.er-api : json.rates[CODE] = nb de CODE pour 1 XOF
        if (json?.result === 'success' && json.rates) apiRates = json.rates
        else throw new Error(`Réponse FX inattendue (${json?.result || 'no result'})`)
    } catch (e) {
        return NextResponse.json(
            { error: 'Échec récupération taux FX', detail: e instanceof Error ? e.message : String(e) },
            { status: 502 },
        )
    }

    // 3. Mettre à jour chaque devise
    const now = new Date().toISOString()
    const updated: { code: string; rate: number }[] = []
    const skipped: string[] = []

    for (const c of currencies || []) {
        if (c.is_base) continue                          // XOF = 1, intouchable
        if (c.code === 'EUR') {                           // parité fixe
            await supabase.from('currencies')
                .update({ exchange_rate_to_base: EUR_PEG, updated_at: now })
                .eq('code', c.code)
            updated.push({ code: 'EUR', rate: EUR_PEG })
            continue
        }
        const perXof = apiRates[c.code]                   // CODE par 1 XOF
        if (!perXof || !isFinite(perXof) || perXof <= 0) { skipped.push(c.code); continue }
        const xofPerUnit = 1 / perXof                     // XOF par 1 unité de CODE
        if (!isFinite(xofPerUnit) || xofPerUnit <= 0) { skipped.push(c.code); continue }

        const { error } = await supabase.from('currencies')
            .update({ exchange_rate_to_base: Math.round(xofPerUnit * 10000) / 10000, updated_at: now })
            .eq('code', c.code)
        if (error) skipped.push(c.code)
        else updated.push({ code: c.code, rate: Math.round(xofPerUnit * 100) / 100 })
    }

    return NextResponse.json({
        success: true,
        source: 'open.er-api.com',
        base: 'XOF',
        refreshed_at: now,
        updated,
        skipped,
    })
}

export async function GET(request: NextRequest) {
    return executerCron('exchange-rates', request, async () => {
        try {
            return await runRefresh()
        } catch (err) {
            console.error('[CRON/exchange-rates]', err)
            return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
        }
    })
}

export async function POST(request: NextRequest) {
    return GET(request)
}
