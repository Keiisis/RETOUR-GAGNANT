// ══════════════════════════════════════════════════════════════
//  ADMIN : Upload d'images des Prêtres Fa (portrait & galerie)
//  Fichier envoyé depuis l'appareil → Supabase Storage (bucket public
//  « fa-priests ») → URL publique renvoyée et stockée en base.
//  Le bucket est créé automatiquement au premier envoi.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const BUCKET = 'fa-priests'
const MAX_BYTES = 8 * 1024 * 1024 // 8 Mo
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Crée le bucket public s'il n'existe pas encore (idempotent). */
async function ensureBucket(supabase: ReturnType<typeof db>) {
    const { data } = await supabase.storage.getBucket(BUCKET)
    if (data) return
    await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: [...ALLOWED],
    })
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    let form: FormData
    try { form = await request.formData() }
    catch { return NextResponse.json({ error: 'Envoi invalide.' }, { status: 400 }) }

    const files = form.getAll('file').filter((f): f is File => f instanceof File)
    if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
    if (files.length > 20) return NextResponse.json({ error: 'Maximum 20 images par envoi.' }, { status: 400 })

    const supabase = db()
    try { await ensureBucket(supabase) }
    catch (e) {
        return NextResponse.json(
            { error: `Stockage indisponible : ${e instanceof Error ? e.message : 'erreur inconnue'}` },
            { status: 503 },
        )
    }

    const urls: string[] = []
    const errors: string[] = []

    for (const file of files) {
        if (!ALLOWED.has(file.type)) { errors.push(`${file.name} : format non pris en charge`); continue }
        if (file.size > MAX_BYTES) { errors.push(`${file.name} : dépasse 8 Mo`); continue }

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
        const path = `${new Date().getFullYear()}/${safe}`

        const buffer = Buffer.from(await file.arrayBuffer())
        const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
            contentType: file.type,
            cacheControl: '31536000',
            upsert: false,
        })
        if (error) { errors.push(`${file.name} : ${error.message}`); continue }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
    }

    if (urls.length === 0) {
        return NextResponse.json({ error: errors[0] || 'Aucune image envoyée.' }, { status: 400 })
    }
    return NextResponse.json({ success: true, urls, errors })
}

// DELETE ?url=… : retire une image du stockage
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url requise' }, { status: 400 })

    // Extrait le chemin interne depuis l'URL publique
    const marker = `/object/public/${BUCKET}/`
    const idx = url.indexOf(marker)
    if (idx === -1) return NextResponse.json({ success: true }) // image externe : rien à supprimer

    const path = decodeURIComponent(url.slice(idx + marker.length))
    const { error } = await db().storage.from(BUCKET).remove([path])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
