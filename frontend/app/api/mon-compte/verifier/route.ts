// POST /api/mon-compte/verifier — { defi, code } → cookie de session `rg_mc`.
import { NextRequest, NextResponse } from 'next/server'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { verifierDefi, ouvrirSession } from '@/lib/espace-email'

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'mon-compte/verifier', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const body = await req.json().catch(() => ({}))
    const email = verifierDefi(String(body?.defi || ''), String(body?.code || ''))
    if (!email) {
        return NextResponse.json({ error: 'Code incorrect ou expiré.' }, { status: 401 })
    }
    const res = NextResponse.json({ ok: true, email })
    ouvrirSession(res, email)
    return res
}
