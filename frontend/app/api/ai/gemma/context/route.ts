import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/api-guard'
import { getCachedRgbContext } from '@/lib/gemma-context'

export const maxDuration = 30

// GET /api/ai/gemma/context : retourne le contexte RGB (mis en cache 5 min).
// Contient des noms et emails de clients : réservé aux administrateurs (audit 2026-10-12, C2).
export async function GET(request: Request) {
    const g = await requireStaff(request, 'admin')
    if (!g.ok) return g.response!
    try {
        const context = await getCachedRgbContext()
        return NextResponse.json({ context })
    } catch (e) {
        console.error('[Gemma context]', e)
        // En cas d'erreur DB, retourner un contexte minimal plutôt que bloquer
        return NextResponse.json({
            context: `=== RETOUR GAGNANT BÉNIN ===\nDate : ${new Date().toLocaleString('fr-FR')}\n[Données temps réel indisponibles : répondre avec les connaissances générales sur RGB]`
        })
    }
}
