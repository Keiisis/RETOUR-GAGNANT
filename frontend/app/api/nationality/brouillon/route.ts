// ══════════════════════════════════════════════════════════════
//  Brouillon du formulaire de nationalité (voir lib/nationality-brouillon.ts).
//
//  POST { jeton, form, documents, etape } → enregistre / met à jour
//  GET  ?t=<jeton>                         → { dossier_ref } si le webhook a
//                                            déjà reconstitué le dossier
//
//  Public par nature (le visiteur n'a pas de compte) : le jeton aléatoire de
//  128 bits est la seule clé, et il ne sort jamais du navigateur du client
//  sauf vers Kkiapay, dans les données de SA transaction.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, flowKey } from '@/lib/api-guard'
import { assainir, ecrireBrouillon, jetonValide, lireBrouillon } from '@/lib/nationality-brouillon'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/* Écrit à chaque étape franchie et relu au rechargement : quelques dizaines
   d'appels par dossier au plus. Plafond par flux, pas par IP (IP partagées). */
const LIMITE_BROUILLON = { limit: 60, window: 10 * 60_000, blockDuration: 10 * 60_000, blockMultiplier: 2, maxBlockDuration: 60 * 60_000 }

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'nationality-brouillon', LIMITE_BROUILLON, flowKey(request))
    if (trop) return trop

    const brut = await request.text()
    if (brut.length > 200_000) return NextResponse.json({ error: 'Brouillon trop volumineux' }, { status: 413 })
    let body: Record<string, unknown> = {}
    try { body = JSON.parse(brut) } catch { return NextResponse.json({ error: 'Envoi invalide' }, { status: 400 }) }

    const jeton = body.jeton
    if (!jetonValide(jeton)) return NextResponse.json({ error: 'Jeton invalide' }, { status: 400 })

    const existant = await lireBrouillon(supabase, jeton)
    // Un brouillon déjà transformé en dossier par le webhook ne se réécrit plus.
    if (existant?.dossier_ref) return NextResponse.json({ ok: true, dossier_ref: existant.dossier_ref })

    const { form, documents } = assainir(body.form, body.documents)
    const erreur = await ecrireBrouillon(supabase, {
        jeton,
        form,
        // Jamais de perte : une pièce déjà enregistrée reste, même si le navigateur l'a oubliée.
        documents: [...new Set([...(existant?.documents || []), ...documents])],
        etape: Math.max(0, Math.min(6, Number(body.etape) || 0)),
        maj_le: new Date().toISOString(),
        dossier_ref: null,
    })
    if (erreur) {
        console.error('[nationality/brouillon] écriture :', erreur)
        return NextResponse.json({ error: 'Enregistrement du brouillon impossible' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
    const trop = guardPublic(request, 'nationality-brouillon-lecture', LIMITE_BROUILLON, flowKey(request))
    if (trop) return trop
    const jeton = request.nextUrl.searchParams.get('t')
    if (!jetonValide(jeton)) return NextResponse.json({ error: 'Jeton invalide' }, { status: 400 })
    const b = await lireBrouillon(supabase, jeton)
    return NextResponse.json({ existe: !!b, dossier_ref: b?.dossier_ref || null })
}
