import { NextResponse } from 'next/server'
import { getCachedRgbContext } from '@/lib/gemma-context'

export const maxDuration = 30

// GET /api/ai/gemma/context : retourne le contexte RGB (mis en cache 5 min)
export async function GET() {
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
