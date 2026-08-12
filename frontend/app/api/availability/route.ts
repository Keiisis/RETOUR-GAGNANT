// ══════════════════════════════════════════════════════════════
//  PUBLIC : Créneaux de rendez-vous disponibles
//  GET /api/availability?from=YYYY-MM-DD&days=14&service=nationalite
//  Renvoie les créneaux LIBRES calculés (jamais stockés).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeAvailability } from '@/lib/availability'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const sp = request.nextUrl.searchParams
    const today = new Date().toISOString().slice(0, 10)
    const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('from') || '') ? sp.get('from')! : today
    const days = Number(sp.get('days')) || 14
    const service = sp.get('service')

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    try {
        const jours = await computeAvailability(supabase, { from, days, service })
        return NextResponse.json({ from, days, service: service || null, jours })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Calcul impossible', jours: [] },
            { status: 500 },
        )
    }
}
