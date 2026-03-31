import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 5

export async function POST(request: NextRequest) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const type = (formData.get('type') as string) || 'logo' // 'logo' | 'cover'

        if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

        // Validation type MIME
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Format non autorisé. Utilisez JPG, PNG, WebP ou GIF.' }, { status: 400 })
        }

        // Validation taille
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `Fichier trop lourd. Maximum ${MAX_SIZE_MB}MB.` }, { status: 400 })
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Auto-créer le bucket si absent (service role key requis)
        const { error: bucketError } = await supabase.storage.createBucket('partner-assets', {
            public: true,
            fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
            allowedMimeTypes: ALLOWED_TYPES,
        })
        // Ignorer l'erreur si le bucket existe déjà
        if (bucketError && !bucketError.message.toLowerCase().includes('already exists') && !bucketError.message.toLowerCase().includes('duplicate')) {
            console.warn('[upload/partner] Bucket creation warning:', bucketError.message)
        }

        const { error: uploadError } = await supabase.storage
            .from('partner-assets')
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
                cacheControl: '31536000',
            })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from('partner-assets')
            .getPublicUrl(filename)

        return NextResponse.json({ url: publicUrl })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur lors de l\'upload' },
            { status: 500 }
        )
    }
}
