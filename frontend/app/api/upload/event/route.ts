import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanUpload } from '@/lib/waf'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 8

export async function POST(request: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const type = (formData.get('type') as string) || 'cover' // 'cover' | 'gallery'

        if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Format non autorisé. Utilisez JPG, PNG ou WebP.' }, { status: 400 })
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `Fichier trop lourd. Maximum ${MAX_SIZE_MB}MB.` }, { status: 400 })
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // ── WAF : analyse du fichier (polyglote, double-ext, MIME mismatch) ──
        const up = scanUpload({ filename: file.name, mime: file.type, bytes: new Uint8Array(buffer) })
        if (!up.safe) {
            return NextResponse.json({ error: 'Fichier rejeté par le pare-feu.', threat: up.threat }, { status: 400 })
        }

        const { error: uploadError } = await supabase.storage
            .from('event-assets')
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
                cacheControl: '31536000',
            })

        if (uploadError) {
            if (uploadError.message.includes('Bucket not found')) {
                return NextResponse.json({
                    error: 'Bucket "event-assets" introuvable. Créez-le dans Supabase Storage (public).'
                }, { status: 500 })
            }
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from('event-assets')
            .getPublicUrl(filename)

        return NextResponse.json({ url: publicUrl })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur lors de l\'upload' },
            { status: 500 }
        )
    }
}
