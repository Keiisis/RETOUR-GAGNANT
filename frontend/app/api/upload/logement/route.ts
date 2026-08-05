import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanUpload } from '@/lib/waf'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 10
const BUCKET = 'partner-assets'

// Upload d'une image de logement (catalogue). Staff only, scanné par le WAF.
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Format non autorisé. Utilisez JPG, PNG, WebP ou GIF.' }, { status: 400 })
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `Fichier trop lourd. Maximum ${MAX_SIZE_MB} Mo.` }, { status: 400 })
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `logements/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`
        const buffer = Buffer.from(await file.arrayBuffer())

        const up = scanUpload({ filename: file.name, mime: file.type, bytes: new Uint8Array(buffer) })
        if (!up.safe) {
            return NextResponse.json({ error: 'Fichier rejeté par le pare-feu.', threat: up.threat }, { status: 400 })
        }

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(filename, buffer, { contentType: file.type, upsert: false, cacheControl: '31536000' })
        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename)
        return NextResponse.json({ url: publicUrl })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
