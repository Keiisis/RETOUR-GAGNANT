import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'justificatifs-compta'

const ALLOWED_MIME = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

// ══════════════════════════════════════════════════════════════
// GET /api/admin/comptabilite/justificatifs?document_id=... | paiement_id=... | depense_id=...
// Liste les justificatifs attachés à une transaction
// ══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = new URL(request.url)
    const document_id = searchParams.get('document_id')
    const paiement_id = searchParams.get('paiement_id')
    const depense_id  = searchParams.get('depense_id')

    const supabase = createClient(supabaseUrl, serviceKey)
    let query = supabase
        .from('justificatifs')
        .select('*')
        .order('created_at', { ascending: false })

    if (document_id) query = query.eq('document_id', document_id)
    else if (paiement_id) query = query.eq('paiement_id', paiement_id)
    else if (depense_id) query = query.eq('depense_id', depense_id)
    // Sinon : tout (utilisé pour la feuille "Justificatifs" de l'export)

    const { data, error } = await query.limit(2000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ justificatifs: data || [] })
}

// ══════════════════════════════════════════════════════════════
// POST /api/admin/comptabilite/justificatifs
// FormData: file, entity_type (document|paiement|depense), entity_id, categorie?, description?
// ══════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const formData = await request.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'FormData invalide' }, { status: 400 })

    const file = formData.get('file') as File | null
    const entity_type = formData.get('entity_type') as string | null
    const entity_id = formData.get('entity_id') as string | null
    const categorie = (formData.get('categorie') as string | null) || 'autre'
    const description = (formData.get('description') as string | null) || null

    if (!file || !entity_type || !entity_id) {
        return NextResponse.json({ error: 'Fichier ou entité manquant' }, { status: 400 })
    }
    if (!['document', 'paiement', 'depense'].includes(entity_type)) {
        return NextResponse.json({ error: 'entity_type invalide' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: 'Fichier trop lourd (> 10 MB)' }, { status: 413 })
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
        return NextResponse.json({ error: `Type de fichier non autorisé: ${file.type}` }, { status: 415 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Créer le bucket à la volée si nécessaire (privé)
    await supabase.storage.createBucket(BUCKET, { public: false }).catch(() => {})

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const path = `${entity_type}/${entity_id}/${Date.now()}-${safeName}`
    const arrayBuf = await file.arrayBuffer()

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arrayBuf, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
    })
    if (upErr) return NextResponse.json({ error: `Upload: ${upErr.message}` }, { status: 500 })

    // URL signée 10 ans (bucket privé)
    const { data: signed } = await supabase.storage.from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', auth.userId!)
        .maybeSingle()

    const insertPayload: Record<string, unknown> = {
        file_url: signed?.signedUrl || path,
        file_name: file.name,
        file_type: file.type || null,
        file_size: file.size,
        categorie,
        description,
        uploaded_by: auth.userId,
        uploaded_by_nom: profile?.full_name || null,
    }
    insertPayload[`${entity_type}_id`] = entity_id

    const { data: row, error: insErr } = await supabase
        .from('justificatifs')
        .insert(insertPayload)
        .select()
        .single()

    if (insErr) {
        // Rollback : supprimer le fichier uploadé
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
        return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, justificatif: row })
}

// ══════════════════════════════════════════════════════════════
// DELETE /api/admin/comptabilite/justificatifs?id=xxx
// ══════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)

    // Récupérer le path du fichier pour le supprimer du storage
    const { data: row } = await supabase
        .from('justificatifs')
        .select('file_url')
        .eq('id', id)
        .maybeSingle()

    if (row?.file_url) {
        // Extraire le path depuis l'URL signée
        const m = row.file_url.match(/\/justificatifs-compta\/([^?]+)/)
        if (m) await supabase.storage.from(BUCKET).remove([m[1]]).catch(() => {})
    }

    const { error } = await supabase.from('justificatifs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
