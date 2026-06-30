import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Convertit 'YYYY-MM' → [startISO, endISO) borné au mois exact
const monthRange = (periode: string) => {
    const [y, m] = periode.split('-').map(Number)
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
    const end   = new Date(Date.UTC(y, m,     1)).toISOString()
    return { start, end }
}

const isValidPeriode = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)

// Arrondi monétaire 2 décimales (évite la dérive des flottants à l'agrégation)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Taux de commission agent normalisé [0..1] (settings.commission_rate)
async function fetchCommissionRate(supabase: SupabaseClient): Promise<number> {
    const { data } = await supabase.from('settings').select('value').eq('key', 'commission_rate').maybeSingle()
    let rate = 0.10
    const raw = data?.value != null ? parseFloat(String(data.value)) : NaN
    if (!isNaN(raw)) rate = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw))
    return rate
}

// ══════════════════════════════════════════════════════════════
// GET /api/admin/comptabilite/cloture
// Retourne la liste des périodes clôturées
// ══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('clotures_mensuelles')
        .select('*')
        .order('periode', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ clotures: data || [] })
}

// ══════════════════════════════════════════════════════════════
// POST /api/admin/comptabilite/cloture
// Body: { periode: 'YYYY-MM', notes?: string, fichier_export_url?: string }
// Clôture la période = snapshot figé + verrou UI
// ══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const periode: string = body.periode
    const notes: string | null = body.notes ?? null
    const fichier_export_url: string | null = body.fichier_export_url ?? null

    if (!periode || !isValidPeriode(periode)) {
        return NextResponse.json({ error: 'Période invalide (format attendu YYYY-MM)' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Une période 'closed' ne peut pas être reclôturée. Une période 'reopened'
    // peut l'être (recalcul du snapshot) → UPDATE au lieu d'INSERT.
    const { data: existing } = await supabase
        .from('clotures_mensuelles')
        .select('id, periode, status, hash_integrite')
        .eq('periode', periode)
        .maybeSingle()

    if (existing && ((existing.status as string) ?? 'closed') === 'closed') {
        return NextResponse.json({ error: 'Période déjà clôturée' }, { status: 409 })
    }
    const isRecloture = !!existing // existait → forcément 'reopened' ici

    const { start, end } = monthRange(periode)

    // Snapshot : on calcule les totaux figés sur la période
    const [docsRes, paiemRes, depRes] = await Promise.all([
        supabase.from('documents_financiers')
            .select('id, type, total, total_tva, status, created_at')
            .gte('created_at', start).lt('created_at', end),
        supabase.from('paiements_manuels')
            .select('id, montant, date_paiement')
            .gte('date_paiement', start.slice(0, 10)).lt('date_paiement', end.slice(0, 10)),
        supabase.from('depenses')
            .select('id, montant, date_depense')
            .gte('date_depense', start.slice(0, 10)).lt('date_depense', end.slice(0, 10)),
    ])

    const docs = docsRes.data || []
    const paiements = paiemRes.data || []
    const depenses = depRes.data || []

    const totalEncaisse = round2(paiements.reduce((s, p) => s + Number(p.montant || 0), 0))
    const totalDepenses = round2(depenses.reduce((s, d) => s + Number(d.montant || 0), 0))
    const totalTVA = round2(docs
        .filter(d => d.type === 'facture' && d.status === 'paye')
        .reduce((s, d) => s + Number(d.total_tva || 0), 0))
    const beneficeNet = round2(totalEncaisse - totalDepenses)

    // Commissions agents : déduites APRÈS la marge opérationnelle (visibilité)
    const commissionRate = await fetchCommissionRate(supabase)
    const totalCommissions = round2(totalEncaisse * commissionRate)
    const beneficeNetFinal = round2(beneficeNet - totalCommissions)

    // Récupérer le nom du clôtureur
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', auth.userId!)
        .maybeSingle()

    // Hash d'intégrité = snapshot des IDs + totaux (détecte les altérations)
    const snapshotPayload = JSON.stringify({
        periode,
        doc_ids: docs.map(d => d.id).sort(),
        paiement_ids: paiements.map(p => p.id).sort(),
        depense_ids: depenses.map(d => d.id).sort(),
        totalEncaisse, totalDepenses, totalTVA, beneficeNet, totalCommissions, beneficeNetFinal,
    })
    const hash = createHash('sha256').update(snapshotPayload).digest('hex')

    const payload = {
        cloture_par: auth.userId,
        cloture_par_nom: profile?.full_name || null,
        total_encaisse: totalEncaisse,
        total_depenses: totalDepenses,
        total_tva: totalTVA,
        benefice_net: beneficeNet,
        total_commissions: totalCommissions,
        benefice_net_final: beneficeNetFinal,
        nb_documents: docs.length,
        nb_paiements: paiements.length,
        nb_depenses: depenses.length,
        fichier_export_url,
        hash_integrite: hash,
        notes,
        status: 'closed',
        date_cloture: new Date().toISOString(),
    }

    let inserted: unknown = null
    let error: { message: string } | null = null

    if (isRecloture) {
        // Reclôture d'une période rouverte : on referme + on conserve l'historique
        const res = await supabase.from('clotures_mensuelles')
            .update(payload).eq('periode', periode).select().single()
        inserted = res.data; error = res.error
    } else {
        const res = await supabase.from('clotures_mensuelles')
            .insert({ periode, ...payload }).select().single()
        inserted = res.data; error = res.error
        // Contrainte UNIQUE(periode) → race de double clôture concurrente
        if (error && /duplicate key|unique/i.test(error.message)) {
            return NextResponse.json({ error: 'Période déjà clôturée' }, { status: 409 })
        }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Trace d'audit permanente (jamais supprimée)
    await supabase.from('clotures_audit').insert({
        periode,
        action: isRecloture ? 're-cloture' : 'cloture',
        acteur_id: auth.userId,
        acteur_nom: profile?.full_name || null,
        hash_avant: isRecloture ? (existing?.hash_integrite ?? null) : null,
        hash_apres: hash,
        details: { totalEncaisse, totalDepenses, beneficeNet, totalCommissions, beneficeNetFinal },
    })

    return NextResponse.json({ success: true, cloture: inserted })
}

// ══════════════════════════════════════════════════════════════
// DELETE /api/admin/comptabilite/cloture?periode=YYYY-MM
// RÉOUVERTURE (admin/ceo). N'efface PLUS la ligne : soft-reopen audité.
// Le snapshot + hash d'origine sont conservés ; le verrou DB est levé
// (status='reopened'). Toute reclôture recalculera un nouveau hash, et
// l'écart hash_avant/hash_apres reste tracé dans clotures_audit → toute
// altération entre réouverture et reclôture est détectable a posteriori.
// ══════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = new URL(request.url)
    const periode = searchParams.get('periode')
    if (!periode || !isValidPeriode(periode)) {
        return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: existing } = await supabase
        .from('clotures_mensuelles')
        .select('id, status, hash_integrite, reopen_count')
        .eq('periode', periode)
        .maybeSingle()

    if (!existing) {
        return NextResponse.json({ error: 'Période non clôturée' }, { status: 404 })
    }
    if (((existing.status as string) ?? 'closed') === 'reopened') {
        return NextResponse.json({ error: 'Période déjà rouverte' }, { status: 409 })
    }

    const { data: profile } = await supabase
        .from('user_profiles').select('full_name').eq('id', auth.userId!).maybeSingle()

    const { error } = await supabase
        .from('clotures_mensuelles')
        .update({
            status: 'reopened',
            reopened_at: new Date().toISOString(),
            reopened_by: auth.userId,
            reopened_par_nom: profile?.full_name || null,
            reopen_count: (Number(existing.reopen_count) || 0) + 1,
        })
        .eq('periode', periode)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from('clotures_audit').insert({
        periode,
        action: 'reopen',
        acteur_id: auth.userId,
        acteur_nom: profile?.full_name || null,
        hash_avant: existing.hash_integrite ?? null,
        hash_apres: null,
        details: { reopen_count: (Number(existing.reopen_count) || 0) + 1 },
    })

    return NextResponse.json({ success: true, reopened: true })
}
