import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 5

// Dimensions cibles selon le type
const RESIZE_CONFIG = {
    logo:    { width: 400,  height: 400, fit: 'contain' as const, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    cover:   { width: 1200, height: 400, fit: 'cover'   as const, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    gallery: { width: 600,  height: 400, fit: 'cover'   as const, background: { r: 255, g: 255, b: 255, alpha: 1 } },
}

async function resizeImage(buffer: Buffer, type: string): Promise<Buffer> {
    const config = RESIZE_CONFIG[type as keyof typeof RESIZE_CONFIG] ?? RESIZE_CONFIG.logo
    return sharp(buffer)
        .resize(config.width, config.height, {
            fit: config.fit,
            background: config.background,
            withoutEnlargement: false,
        })
        .webp({ quality: 85 })
        .toBuffer()
}

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

        const bytes = await file.arrayBuffer()
        const rawBuffer = Buffer.from(bytes)

        // Redimensionnement + conversion WebP
        const optimizedBuffer = await resizeImage(rawBuffer, type)

        // Nom de fichier toujours en .webp après optimisation
        const filename = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.webp`

        // Auto-créer le bucket si absent (service role key requis)
        const { error: bucketError } = await supabase.storage.createBucket('partner-assets', {
            public: true,
            fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
            allowedMimeTypes: [...ALLOWED_TYPES, 'image/webp'],
        })
        if (bucketError && !bucketError.message.toLowerCase().includes('already exists') && !bucketError.message.toLowerCase().includes('duplicate')) {
            console.warn('[upload/partner] Bucket creation warning:', bucketError.message)
        }

        const { error: uploadError } = await supabase.storage
            .from('partner-assets')
            .upload(filename, optimizedBuffer, {
                contentType: 'image/webp',
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
