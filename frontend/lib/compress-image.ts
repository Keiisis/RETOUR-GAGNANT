// ══════════════════════════════════════════════════════════════
//  COMPRESSION NATIVE D'IMAGES AVANT UPLOAD (aucune dépendance)
//  Les photos de documents prises au téléphone pèsent souvent 5-15 Mo.
//  On les redimensionne + ré-encode en JPEG côté navigateur (canvas)
//  AVANT l'envoi vers Storage : gain typique ×4 à ×10, upload plus
//  rapide, quota Storage économisé.
//
//  Règles de sûreté :
//   - N'agit QUE sur les images bitmap (jpeg/png/webp/…). Les PDF, SVG et
//     autres documents sont renvoyés tels quels (jamais dégradés).
//   - Respecte l'orientation EXIF (photos portrait iPhone).
//   - Si la décodage échoue (HEIC non supporté par le navigateur) ou si le
//     résultat n'est pas plus petit, on renvoie le fichier ORIGINAL intact.
//   - Qualité volontairement haute (0,82) + 2400 px max : un scan de pièce
//     d'identité reste parfaitement lisible.
// ══════════════════════════════════════════════════════════════

export interface CompressOptions {
    /** Dimension max (largeur ou hauteur) en pixels. */
    maxDim?: number
    /** Qualité JPEG (0-1). */
    quality?: number
    /** En dessous de cette taille, on ne touche pas au fichier. */
    skipBelowBytes?: number
}

export async function compressImage(
    file: File,
    { maxDim = 2400, quality = 0.82, skipBelowBytes = 500 * 1024 }: CompressOptions = {},
): Promise<File> {
    // Non-images et formats vectoriels : jamais recompressés.
    if (!file.type.startsWith('image/')) return file
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
    // Déjà léger → inutile de dégrader.
    if (file.size <= skipBelowBytes) return file
    if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file

    try {
        // imageOrientation: applique la rotation EXIF pour ne pas envoyer une
        // photo couchée. Peut lever une exception sur HEIC → on retombe sur l'original.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

        const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * ratio))
        const height = Math.max(1, Math.round(bitmap.height * ratio))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { bitmap.close?.(); return file }
        ctx.drawImage(bitmap, 0, 0, width, height)
        bitmap.close?.()

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', quality),
        )
        // Pas de blob, ou compression sans gain → on garde l'original.
        if (!blob || blob.size >= file.size) return file

        const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
    } catch {
        return file
    }
}
