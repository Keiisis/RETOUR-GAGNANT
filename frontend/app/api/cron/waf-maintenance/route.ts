// ══════════════════════════════════════════════════════════════
//  CRON — Maintenance quotidienne du WAF
// ──────────────────────────────────────────────────────────────
// S'exécute chaque nuit via Vercel Cron (voir vercel.json).
//
// Appelle la RPC waf_daily_maintenance() qui :
//   • fait décroître les threat scores (decay) — sinon une IP bannie le reste
//     éternellement et la défense ne se concentre jamais sur les menaces vives
//   • purge logs/alertes/campagnes/fingerprints/honeypot/IDOR expirés
//   • réhabilite graduellement les IP inactives + auto-unblock
//   • RAFRAÎCHIT la vue matérialisée waf_threat_dashboard (sinon données figées)
//
//  SUPABASE_SERVICE_ROLE_KEY requis (la fonction est SECURITY DEFINER,
//    GRANT EXECUTE TO service_role).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function verifyAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true
    if (process.env.NODE_ENV === 'development') return true
    return false
}

async function runMaintenance() {
    if (!serviceKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase.rpc('waf_daily_maintenance')

    if (error) {
        console.error('[CRON/waf-maintenance]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        triggered_at: new Date().toISOString(),
        report: data,
    })
}

export async function GET(request: NextRequest) {
    if (!verifyAuth(request)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return runMaintenance()
}

export async function POST(request: NextRequest) {
    return GET(request)
}
