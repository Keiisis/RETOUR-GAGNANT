import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyResumeToken } from '@/lib/nationality-token'
import { isPaidNationality } from '@/lib/nationality-paid'
import { guardPublic, UPLOAD_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

const cleanLabel = (s: unknown) =>
    String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/:/g, '-').trim().slice(0, 80) || 'Document'

// Résout un dossier PAYÉ à partir du jeton signé. Le jeton EST l'autorisation.
async function resolvePaidApp(token: string) {
    const v = verifyResumeToken(token)
    if (!v?.id) return { error: 'Lien invalide ou expiré', status: 401 as const }
    const { data: app } = await supabase
        .from('nationality_applications')
        .select('id, application_ref, prenom, nom, payment_status, documents_uploaded')
        .eq('id', v.id)
        .maybeSingle()
    if (!app) return { error: 'Dossier introuvable', status: 404 as const }
    if (!isPaidNationality(app.payment_status)) return { error: 'Dépôt réservé aux dossiers payés', status: 403 as const }
    return { app }
}

// GET /api/nationality/depot?token=… — valide le lien et renvoie l'entête du dossier.
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token') || ''
    const r = await resolvePaidApp(token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    const count = Array.isArray(r.app.documents_uploaded) ? r.app.documents_uploaded.length : 0
    return NextResponse.json({ ok: true, ref: r.app.application_ref, prenom: r.app.prenom, nom: r.app.nom, existingCount: count })
}

// POST /api/nationality/depot  { token, docs: [{label, path}] }
// Le client ajoute lui-même des pièces qu'il a nommées.
export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'nationality-depot', UPLOAD_LIMIT)
    if (trop) return trop

    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '')
    const r = await resolvePaidApp(token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

    const docs = Array.isArray(body.docs) ? body.docs : []
    const clean = docs
        .filter((d: unknown): d is { label: string; path: string } =>
            !!d && typeof (d as { path?: unknown }).path === 'string' && String((d as { path: string }).path).startsWith('nat-'))
        .map((d: { label: string; path: string }) => `${cleanLabel(d.label)}: ${d.path}`)
    if (clean.length === 0) return NextResponse.json({ error: 'Aucune pièce valide.' }, { status: 400 })

    const existing = Array.isArray(r.app.documents_uploaded) ? (r.app.documents_uploaded as string[]) : []
    const { error } = await supabase
        .from('nationality_applications')
        .update({ documents_uploaded: [...existing, ...clean] })
        .eq('id', r.app.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, added: clean.length })
}
