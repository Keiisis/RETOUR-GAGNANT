import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanUpload, checkOrigin } from '@/lib/waf'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const ALLOWED_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_TYPES = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS]

const MAX_SIZE_MB = 50

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration Supabase manquante (URL ou Service Role Key)' }, { status: 500 })
        }

        // ── WAF CSRF : refuse une origine cross-site (forgery navigateur) ──
        // Mode sûr : on ne bloque QUE si un Origin est présent et ne correspond
        // pas (les clients API/mobile sans Origin ne sont pas impactés).
        const origin = request.headers.get('origin')
        if (origin) {
            const host = request.headers.get('host') || ''
            const allowed = [host, 'retourgagnantbenin.bj', 'www.retourgagnantbenin.bj'].filter(Boolean)
            const csrf = checkOrigin('POST', origin, null, allowed)
            if (!csrf.valid) {
                return NextResponse.json({ error: 'Origine non autorisée.' }, { status: 403 })
            }
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const folder = (formData.get('folder') as string) || 'media'

        if (!file) {
            return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Format non autorisé. Utilisez des images (JPG, PNG, WebP, GIF) ou des vidéos (MP4, WebM).' }, { status: 400 })
        }

        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `Fichier trop lourd. Maximum ${MAX_SIZE_MB} Mo.` }, { status: 400 })
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
        const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // ── WAF : analyse du fichier (SVG XSS, polyglote, double-ext, MIME mismatch) ──
        // Les SVG sont autorisés ici → vecteur XSS stocké réel : on scanne le contenu.
        const uploadVerdict = scanUpload({
            filename: file.name,
            mime: file.type,
            bytes: new Uint8Array(buffer),
            text: file.type.includes('svg') ? buffer.toString('utf-8') : undefined,
        })
        if (!uploadVerdict.safe) {
            return NextResponse.json(
                { error: 'Fichier rejeté par le pare-feu applicatif.', threat: uploadVerdict.threat },
                { status: 400 }
            )
        }

        // Auto-create the 'blog-assets' bucket if it is missing
        const { error: bucketError } = await supabase.storage.createBucket('blog-assets', {
            public: true,
            fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
            allowedMimeTypes: ALLOWED_TYPES,
        })

        if (bucketError && !bucketError.message.toLowerCase().includes('already exists') && !bucketError.message.toLowerCase().includes('duplicate')) {
            console.warn('[upload/blog] Bucket creation warning:', bucketError.message)
        }

        const { error: uploadError } = await supabase.storage
            .from('blog-assets')
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
                cacheControl: '31536000',
            })

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 })
        }

        const { data: { publicUrl } } = supabase.storage
            .from('blog-assets')
            .getPublicUrl(filename)

        return NextResponse.json({ url: publicUrl })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur lors de l\'upload' },
            { status: 500 }
        )
    }
}
