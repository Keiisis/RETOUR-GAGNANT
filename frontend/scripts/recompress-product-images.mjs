/**
 * Recompression des visuels produit déjà en ligne.
 *
 * Pourquoi : les images de la boutique ont été téléversées brutes, jusqu'à
 * 3,3 Mo pièce. Onze produits = ~36 Mo au chargement de l'onglet Boutique,
 * ce qui laissait les cartes vides plusieurs secondes sur réseau mobile.
 * `components/admin/ImageUpload.tsx` compresse désormais à l'envoi, mais
 * cela ne vaut que pour les futurs téléversements : ce script traite
 * l'existant.
 *
 * Ce qu'il fait :
 *   1. lit la table `products` et collecte toutes les URLs d'images ;
 *   2. télécharge chaque fichier depuis Supabase Storage ;
 *   3. le redimensionne (1600 px max) et le ré-encode en WebP ;
 *   4. téléverse la version allégée SOUS UN NOUVEAU NOM ;
 *   5. met à jour la ligne `products` pour pointer dessus.
 *
 * Les originaux ne sont jamais écrasés ni supprimés : en cas de doute sur un
 * rendu, l'ancien fichier reste accessible dans le bucket.
 *
 * Usage :
 *   node scripts/recompress-product-images.mjs --dry     (simulation)
 *   node scripts/recompress-product-images.mjs           (application)
 *
 * Requiert dans l'environnement :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const DRY = process.argv.includes('--dry')
const MAX_DIM = 1600
const QUALITY = 80
const BUCKET = 'products'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
    process.exit(1)
}
const supabase = createClient(url, key)

const ko = (n) => `${Math.round(n / 1024)} Ko`

/** Extrait le chemin interne au bucket depuis une URL publique Supabase. */
function storagePath(publicUrl) {
    const marker = `/storage/v1/object/public/${BUCKET}/`
    const i = publicUrl.indexOf(marker)
    return i < 0 ? null : publicUrl.slice(i + marker.length)
}

async function main() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, title, images')

    if (error) {
        console.error('Lecture des produits impossible :', error.message)
        process.exit(1)
    }

    let totalBefore = 0
    let totalAfter = 0
    let converted = 0
    let skipped = 0

    for (const product of products || []) {
        const images = Array.isArray(product.images) ? product.images : []
        if (images.length === 0) continue

        const nextImages = []
        let changed = false

        for (const imageUrl of images) {
            const path = storagePath(imageUrl)
            if (!path) {
                // URL externe : hors de notre Storage, on n'y touche pas.
                nextImages.push(imageUrl)
                skipped++
                continue
            }

            const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path)
            if (dlErr || !blob) {
                console.warn(`  ! téléchargement impossible : ${path} (${dlErr?.message || 'vide'})`)
                nextImages.push(imageUrl)
                skipped++
                continue
            }

            const original = Buffer.from(await blob.arrayBuffer())
            const optimised = await sharp(original)
                .rotate()                                    // respecte l'orientation EXIF
                .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: QUALITY })
                .toBuffer()

            totalBefore += original.length

            // Si la compression ne gagne rien, on garde l'original.
            if (optimised.length >= original.length) {
                console.log(`  = ${path} déjà optimal (${ko(original.length)})`)
                nextImages.push(imageUrl)
                totalAfter += original.length
                skipped++
                continue
            }

            const newPath = path.replace(/\.[^./]+$/, '') + `-opt.webp`

            if (DRY) {
                console.log(`  ~ ${path}  ${ko(original.length)} -> ${ko(optimised.length)}  (simulation)`)
            } else {
                const { error: upErr } = await supabase.storage
                    .from(BUCKET)
                    .upload(newPath, optimised, {
                        contentType: 'image/webp',
                        cacheControl: '31536000',
                        upsert: true,
                    })
                if (upErr) {
                    console.warn(`  ! envoi impossible : ${newPath} (${upErr.message})`)
                    nextImages.push(imageUrl)
                    totalAfter += original.length
                    skipped++
                    continue
                }
                const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(newPath)
                nextImages.push(pub.publicUrl)
                changed = true
                console.log(`  + ${path}  ${ko(original.length)} -> ${ko(optimised.length)}`)
            }

            totalAfter += optimised.length
            converted++
        }

        if (changed && !DRY) {
            const { error: updErr } = await supabase
                .from('products')
                .update({ images: nextImages })
                .eq('id', product.id)
            if (updErr) console.warn(`  ! mise à jour produit "${product.title}" : ${updErr.message}`)
            else console.log(`  → "${product.title}" pointe sur les versions allégées`)
        }
    }

    console.log('')
    console.log(`images converties : ${converted}`)
    console.log(`images ignorées   : ${skipped}`)
    if (totalBefore > 0) {
        const gain = 100 - Math.round((totalAfter * 100) / totalBefore)
        console.log(`poids total       : ${ko(totalBefore)} -> ${ko(totalAfter)}  (-${gain}%)`)
    }
    if (DRY) console.log('\n(simulation — relancez sans --dry pour appliquer)')
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
