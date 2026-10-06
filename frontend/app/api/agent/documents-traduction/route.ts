// ══════════════════════════════════════════════════════════════
//  RELECTURE D'UNE TRADUCTION DE DEVIS / FACTURE (équipe)
//
//  PUT { lang, corrections: { segment français → traduction relue } }
//  Les corrections sont enregistrées comme traductions validées : elles
//  priment ensuite sur l'IA, pour ce document et pour tout autre qui
//  reprend le même texte. Une correction qui modifie un nombre, un e-mail,
//  un code ou une marque est refusée (renvoyée dans `refusees`).
//  Sous /api/agent : agents ET admins (middleware + verifyApiAuth).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { langueDoc } from '@/lib/document-langues'
import { enregistrerCorrections } from '@/lib/translation/documents'

export async function PUT(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => null) as { lang?: string; corrections?: Record<string, unknown> } | null
    const lang = langueDoc(body?.lang)
    if (!body || lang === 'fr' || !body.corrections || typeof body.corrections !== 'object') {
        return NextResponse.json({ error: 'Langue et corrections requises' }, { status: 400 })
    }
    const corrections = Object.fromEntries(Object.entries(body.corrections)
        .filter(([s, t]) => typeof t === 'string' && t.trim() && s.trim() && s.length <= 2000 && t.length <= 2000)) as Record<string, string>
    try {
        const r = await enregistrerCorrections(lang, corrections)
        return NextResponse.json(r)
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Enregistrement impossible' }, { status: 500 })
    }
}
