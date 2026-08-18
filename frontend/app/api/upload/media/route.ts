// ══════════════════════════════════════════════════════════════
//  UPLOAD D'IMAGE GÉNÉRIQUE — une seule route pour tout le site.
//
//  De nombreux écrans d'administration ne proposaient qu'un champ « URL de
//  l'image » : il fallait déjà héberger le fichier quelque part. Cette route
//  permet de téléverser depuis l'appareil ; le champ URL reste rempli
//  automatiquement, donc rien d'autre ne change en base.
//
//  Réservée au PERSONNEL (admins + agents) : les routes d'upload publiques
//  existantes couvrent les parcours clients, celle-ci sert les panels.
//
//  Chaque fichier est :
//    · contrôlé par le pare-feu (polyglotte, double extension, MIME menteur) ;
//    · redimensionné et converti en WebP (poids divisé, format homogène) ;
//    · rangé par dossier, sous un nom aléatoire (aucune collision, aucune
//      information déduite du nom d'origine).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { scanUpload } from '@/lib/waf'
import { requireStaff, UPLOAD_LIMIT, guardPublic } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_SIZE_MB = 8
const BUCKET = 'media'

/** Gabarits de redimensionnement selon l'usage déclaré. */
const GABARITS = {
    // Portrait / photo de profil : cadrage carré.
    portrait: { width: 800, height: 800, fit: 'cover' as const },
    // Logo : on CONTIENT pour ne jamais rogner une marque.
    logo: { width: 600, height: 600, fit: 'contain' as const },
    // Couverture / bannière large.
    couverture: { width: 1600, height: 700, fit: 'cover' as const },
    // Photo de catalogue (produit, logement, école…).
    photo: { width: 1400, height: 1000, fit: 'inside' as const },
    // Image libre : on borne seulement la taille maximale.
    libre: { width: 2000, height: 2000, fit: 'inside' as const },
}
type Gabarit = keyof typeof GABARITS

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'upload/media', UPLOAD_LIMIT)
    if (trop) return trop

    // Panels uniquement.
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: 'Configuration Supabase manquante.' }, { status: 500 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const form = await request.formData()
        const file = form.get('file') as File | null
        const gabarit = (String(form.get('gabarit') || 'photo') as Gabarit)
        // Dossier de rangement : lettres, chiffres, tirets uniquement (pas de
        // remontée d'arborescence via « ../ »).
        const dossier = String(form.get('dossier') || 'divers').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'divers'

        if (!file) return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 })
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Format non pris en charge. Utilisez JPG, PNG, WebP, GIF ou AVIF.' }, { status: 400 })
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({ error: `Fichier trop lourd (maximum ${MAX_SIZE_MB} Mo).` }, { status: 400 })
        }

        const brut = Buffer.from(await file.arrayBuffer())

        const verdict = scanUpload({ filename: file.name, mime: file.type, bytes: new Uint8Array(brut) })
        if (!verdict.safe) {
            return NextResponse.json({ error: 'Fichier rejeté par le pare-feu.', menace: verdict.threat }, { status: 400 })
        }

        const g = GABARITS[gabarit] || GABARITS.photo
        const optimise = await sharp(brut)
            .rotate() // respecte l'orientation EXIF : sinon les photos de téléphone arrivent couchées
            .resize(g.width, g.height, { fit: g.fit, withoutEnlargement: true, background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .webp({ quality: 85 })
            .toBuffer()

        const nom = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.webp`

        const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
            public: true,
            fileSizeLimit: MAX_SIZE_MB * 1024 * 1024,
            allowedMimeTypes: [...ALLOWED_TYPES, 'image/webp'],
        })
        if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
            console.warn('[upload/media] bucket :', bucketErr.message)
        }

        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(nom, optimise, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' })

        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(nom)
        return NextResponse.json({ url: publicUrl, poids: optimise.length })
    } catch (e) {
        console.error('[upload/media]', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Téléversement impossible.' }, { status: 500 })
    }
}
