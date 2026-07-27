import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, UPLOAD_LIMIT } from '@/lib/api-guard'

// ══════════════════════════════════════════════════════════════
//  URLS D'UPLOAD SIGNÉES — PIÈCES JOINTES NATIONALITÉ
//  L'upload se faisait navigateur → Storage avec la clé ANON, donc
//  soumis aux policies RLS du bucket `nationality_documents`. Quand ces
//  policies refusent l'INSERT anon (ou après un changement de config),
//  TOUS les uploads échouent silencieusement → « upload échoué ».
//  Ici on signe chaque chemin AVEC la clé service role (bypass RLS) :
//  le navigateur téléverse ensuite via uploadToSignedUrl, sans dépendre
//  d'aucune policy anon. Le transfert reste direct (pas de RAM serveur).
// ══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET = 'nationality_documents'
const MAX_FILES = 20

// Extensions acceptées pour un dossier de nationalité (scans / photos).
const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx'])
const sanitizeExt = (ext: unknown): string => {
    const e = String(ext ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    return ALLOWED_EXT.has(e) ? e : 'bin'
}
const sanitizeKey = (key: unknown): string =>
    String(key ?? 'doc').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'doc'

export async function POST(request: Request) {
    const trop = guardPublic(request, 'nationality-upload-url', UPLOAD_LIMIT)
    if (trop) return trop

    if (!serviceKey) {
        // Sans service role on retomberait sur l'anon (le bug qu'on corrige).
        return NextResponse.json({ error: 'Service de dépôt indisponible.' }, { status: 503 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Corps invalide.' }, { status: 400 })
    }

    const files = (body as { files?: unknown })?.files
    if (!Array.isArray(files) || files.length === 0) {
        return NextResponse.json({ error: 'Aucun fichier.' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
        return NextResponse.json({ error: `Maximum ${MAX_FILES} fichiers.` }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    })

    // Un dossier unique par soumission → aucun risque de collision de chemin.
    const folder = `nat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const results: { key: string; path: string; token: string }[] = []
    for (let i = 0; i < files.length; i++) {
        const f = files[i] as { key?: unknown; ext?: unknown }
        const key = sanitizeKey(f?.key)
        const ext = sanitizeExt(f?.ext)
        const path = `${folder}/${key}_${i}.${ext}`

        const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
        if (error || !data) {
            return NextResponse.json(
                { error: `Impossible de préparer le dépôt : ${error?.message || 'erreur inconnue'}` },
                { status: 502 },
            )
        }
        results.push({ key, path: data.path, token: data.token })
    }

    return NextResponse.json({ uploads: results })
}
