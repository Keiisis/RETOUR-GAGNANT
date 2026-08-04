import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { signResumeToken } from '@/lib/nationality-token'
import { isPaidNationality } from '@/lib/nationality-paid'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// POST /api/admin/nationalite/depot-link  { id }
// Génère un lien de dépôt « nommage libre » à envoyer au client.
// RÉSERVÉ aux dossiers PAYÉS (le jeton signé est la preuve d'autorisation).
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { data: app, error } = await supabase
        .from('nationality_applications')
        .select('id, payment_status')
        .eq('id', id)
        .maybeSingle()
    if (error || !app) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    if (!isPaidNationality(app.payment_status)) {
        return NextResponse.json({ error: 'Dépôt client réservé aux dossiers payés.' }, { status: 403 })
    }

    const token = signResumeToken(app.id, 30)
    const link = `${SITE}/nationalite/depot?t=${encodeURIComponent(token)}`
    return NextResponse.json({ success: true, link })
}
