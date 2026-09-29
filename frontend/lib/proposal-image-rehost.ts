import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/* ══════════════════════════════════════════════════════════════════
   RÉ-HÉBERGEMENT DES IMAGES DE PROPOSITIONS DE SÉJOUR (serveur uniquement)

   Les photos issues de la recherche Google Maps (Serper → thumbnailUrl)
   sont des liens `lh3.googleusercontent.com/gps-cs-s/…` TEMPORAIRES :
   quelques jours plus tard ils répondent 403 et la présentation (web,
   mobile, PowerPoint) perd ses images.

   Règle : toute image externe écrite dans `ai_proposal_items` est copiée
   dans le stockage Supabase public `partner-assets` (dossier
   `proposals/items/`) et c'est l'URL Supabase qui est enregistrée.
   Échec du téléchargement :
     - lien éphémère (Google) → null, jamais un lien qui expirera ;
     - autre hôte (lien collé par l'agent) → conservé tel quel.
══════════════════════════════════════════════════════════════════ */

const BUCKET = 'partner-assets'
const DOSSIER = 'proposals/items'
const TAILLE_MAX = 10 * 1024 * 1024
const DELAI_MS = 10_000

// Hôtes dont les liens expirent (photos Google Maps / Images).
const HOTES_EPHEMERES = [
    /(^|\.)googleusercontent\.com$/i,
    /(^|\.)ggpht\.com$/i,
    /(^|\.)gstatic\.com$/i,
    /(^|\.)googleapis\.com$/i,
    /(^|\.)google\.com$/i,
]

function hoteDe(url: string): string | null {
    try {
        const u = new URL(url)
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
        return u.hostname
    } catch {
        return null
    }
}

export function estLienEphemere(url: string): boolean {
    const h = hoteDe(url)
    return !!h && HOTES_EPHEMERES.some(re => re.test(h))
}

// Déjà sur notre stockage Supabase : rien à faire.
function estDejaHeberge(url: string): boolean {
    const h = hoteDe(url)
    const base = hoteDe(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    return !!h && !!base && h === base
}

// Signature binaire → type réel (on ne fait pas confiance au content-type).
function typeImage(b: Uint8Array): { mime: string; ext: string } | null {
    if (b.length < 12) return null
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' }
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: 'image/gif', ext: 'gif' }
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
        && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: 'image/webp', ext: 'webp' }
    return null
}

// Les vignettes Google Maps sont servies en 163×92 (`=w163-h92-k-no`) :
// on demande d'abord une version large, lisible en plein écran / diapo.
function variantesGoogle(url: string): string[] {
    if (!/googleusercontent\.com$/i.test(hoteDe(url) || '')) return [url]
    const large = url.replace(/=w\d+(-h\d+)?[^/?#]*$/i, '=w1600-h1000-k-no')
    return large !== url ? [large, url] : [url]
}

async function telecharger(url: string): Promise<Uint8Array | null> {
    const ctrl = new AbortController()
    const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS)
    try {
        const resp = await fetch(url, {
            signal: ctrl.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (RetourGagnantBenin; proposition)' },
        })
        if (!resp.ok) return null
        const annonce = Number(resp.headers.get('content-length') || 0)
        if (annonce > TAILLE_MAX) return null
        const buf = new Uint8Array(await resp.arrayBuffer())
        if (buf.length === 0 || buf.length > TAILLE_MAX) return null
        return buf
    } catch {
        return null
    } finally {
        clearTimeout(minuteur)
    }
}

/**
 * Copie une image externe dans `partner-assets/proposals/items/` et
 * renvoie l'URL publique Supabase. Voir la règle d'échec en tête de fichier.
 */
export async function reheberger(supabase: SupabaseClient, url: string | null | undefined): Promise<string | null> {
    const src = typeof url === 'string' ? url.trim() : ''
    if (!src) return null
    if (src.startsWith('data:')) return null            // jamais de base64 en base
    if (!hoteDe(src)) return null                        // URL invalide
    if (estDejaHeberge(src)) return src

    const repli = estLienEphemere(src) ? null : src
    for (const candidat of variantesGoogle(src)) {
        const octets = await telecharger(candidat)
        if (!octets) continue
        const type = typeImage(octets)
        if (!type) continue
        // Nom = empreinte du contenu : ré-enregistrer la même image ne crée pas de doublon.
        const nom = `${DOSSIER}/${createHash('sha256').update(octets).digest('hex').slice(0, 32)}.${type.ext}`
        const { error } = await supabase.storage.from(BUCKET).upload(nom, octets, {
            contentType: type.mime,
            upsert: true,
            cacheControl: '31536000',
        })
        if (error) {
            console.warn('[proposal-image] upload échoué :', error.message)
            return repli
        }
        return supabase.storage.from(BUCKET).getPublicUrl(nom).data.publicUrl
    }
    console.warn('[proposal-image] téléchargement impossible :', src.slice(0, 120))
    return repli
}

interface ImageGalerie { url?: string; caption?: string; [k: string]: unknown }

/**
 * Ré-héberge `image_url` et `metadata.images[].url` d'une ligne
 * `ai_proposal_items` avant écriture. Les images de galerie perdues sont retirées.
 */
export async function rehebergerImagesItem<T extends Record<string, unknown>>(supabase: SupabaseClient, item: T): Promise<T> {
    const sortie: Record<string, unknown> = { ...item }
    if ('image_url' in item) {
        sortie.image_url = await reheberger(supabase, item.image_url as string | null | undefined)
    }
    const meta = item.metadata as Record<string, unknown> | null | undefined
    const galerie = meta && Array.isArray(meta.images) ? (meta.images as ImageGalerie[]) : null
    if (meta && galerie) {
        const images = await Promise.all(galerie.map(async g => {
            if (!g || typeof g.url !== 'string') return null
            const u = await reheberger(supabase, g.url)
            return u ? { ...g, url: u } : null
        }))
        sortie.metadata = { ...meta, images: images.filter(Boolean) }
    }
    return sortie as T
}
