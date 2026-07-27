import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, UPLOAD_LIMIT } from '@/lib/api-guard'

// ══════════════════════════════════════════════════════════════
//  UPLOAD CÔTÉ SERVEUR — PIÈCES JOINTES NATIONALITÉ
//  Le fichier transite par NOTRE API puis est déposé avec la clé
//  SERVICE ROLE (bypass RLS). Contrairement à l'upload signé, il ne
//  dépend PAS du transfert direct navigateur → Storage (bloqué chez
//  certains clients : réseau, proxy, cache PWA périmé…).
//  Limite : corps de requête ~4,5 Mo sur Vercel. Après compression des
//  images, la quasi-totalité des pièces passe ici ; les fichiers plus
//  lourds continuent via l'URL signée directe.
// ══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BUCKET = 'nationality_documents'
const MAX_BYTES = 4_400_000 // marge sous la limite Vercel (~4,5 Mo)

const ALLOWED_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx'])
const sanitizeExt = (ext: unknown): string => {
    const e = String(ext ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    return ALLOWED_EXT.has(e) ? e : 'bin'
}
const sanitizeKey = (key: unknown): string =>
    String(key ?? 'doc').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'doc'

export async function POST(request: Request) {
    const trop = guardPublic(request, 'nationality-upload-file', UPLOAD_LIMIT)
    if (trop) return trop

    if (!serviceKey) {
        return NextResponse.json({ error: 'Service de dépôt indisponible (clé serveur absente).' }, { status: 503 })
    }

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'Fichier manquant.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Fichier trop volumineux pour le dépôt serveur.', tooLarge: true }, { status: 413 })
    }

    const key = sanitizeKey(form.get('key'))
    const ext = sanitizeExt(form.get('ext'))
    const folder = form.get('folder') ? sanitizeKey(form.get('folder')) : `nat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const path = `${folder}/${key}_${Math.random().toString(36).slice(2, 6)}.${ext}`

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, {
                contentType: (file as File).type || 'application/octet-stream',
                cacheControl: '3600',
                upsert: false,
            })
        if (error || !data) {
            return NextResponse.json({ error: `Dépôt refusé : ${error?.message || 'inconnu'}` }, { status: 502 })
        }
        return NextResponse.json({ success: true, path: data.path })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
