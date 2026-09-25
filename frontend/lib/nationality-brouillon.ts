// ══════════════════════════════════════════════════════════════
//  BROUILLON DU FORMULAIRE DE NATIONALITÉ, CONSERVÉ CÔTÉ SERVEUR
//
//  L'incident du 15/09/2026 : une cliente paie 170 549 FCFA depuis un iPhone
//  (carte Visa, validation 3-D Secure dans l'application de sa banque). Au
//  retour dans Safari, le formulaire n'a jamais été envoyé : ses réponses et
//  ses pièces n'existaient que dans la mémoire de l'onglet. Rien en base.
//
//  Désormais, AVANT le paiement :
//    · les pièces sont déposées dans le stockage dès l'étape 4 ;
//    · le formulaire et la liste des pièces déposées sont enregistrés ici,
//      sous un jeton aléatoire que seul le navigateur du client connaît, et
//      que le widget de paiement transmet à Kkiapay.
//  Si le navigateur meurt après le paiement, le webhook retrouve ce brouillon
//  par le jeton et reconstitue le dossier COMPLET, pièces comprises.
//
//  Stockage : bucket privé `nationality_documents`, `brouillons/<jeton>.json`.
//  Aucune table à créer. Purge : brouillons de plus de 30 jours (cron cleanup).
// ══════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'

export const BUCKET_BROUILLONS = 'nationality_documents'
export const JOURS_BROUILLON = 30

/** Jeton : 32 caractères hexadécimaux, tiré au sort par le navigateur. */
export const jetonValide = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v)

const chemin = (jeton: string) => `brouillons/${jeton}.json`

/**
 * Champs du formulaire recopiés dans la fiche. Liste FERMÉE : un brouillon
 * est écrit par un navigateur, il ne doit pas pouvoir poser `payment_status`,
 * `amount` ou `status`.
 */
export const CHAMPS_FORMULAIRE = [
    'nom', 'prenom', 'email', 'genre', 'date_naissance', 'pays_naissance', 'ville_naissance',
    'nationalite', 'pays_residence', 'adresse_residence', 'telephone', 'profession',
    'demande_depuis_benin', 'knows_about_law', 'is_afro_descendant', 'afro_descendant_description',
    'ancestor1_nom', 'ancestor1_prenom', 'ancestor1_date_naissance', 'ancestor1_lien_parente',
    'ancestor1_vivant', 'ancestor1_nationalite', 'ancestor1_pays_residence', 'ancestor1_autres_infos',
    'ancestor2_nom', 'ancestor2_prenom', 'ancestor2_date_naissance', 'ancestor2_lien_parente',
    'ancestor2_vivant', 'ancestor2_nationalite', 'ancestor2_pays_residence', 'ancestor2_autres_infos',
    'type_document_identite', 'numero_document', 'date_expiration_document', 'pays_delivrance',
    'lieu_delivrance', 'autorite_delivrance', 'pere_nom', 'pere_prenom', 'pere_date_naissance',
    'mere_nom', 'mere_prenom', 'mere_date_naissance', 'situation_matrimoniale', 'nombre_enfants',
    'motivation_lettre', 'consentement_rgpd',
] as const

const CHAMPS_DATE = new Set(['date_naissance', 'ancestor1_date_naissance', 'ancestor2_date_naissance', 'pere_date_naissance', 'mere_date_naissance', 'date_expiration_document'])

/** Une ligne de pièce DÉPOSÉE : « clé:Libellé: nat-…/fichier.ext ». */
const LIGNE_PIECE = /^[a-z0-9_]+:[^\n]{1,200}: nat-[A-Za-z0-9._/-]{3,200}$/

export interface Brouillon {
    jeton: string
    form: Record<string, unknown>
    documents: string[]
    etape: number
    maj_le: string
    /** Posé par le webhook quand il a reconstitué le dossier. */
    dossier_ref?: string | null
}

/** Nettoie ce qu'envoie le navigateur : champs connus, valeurs bornées. */
export function assainir(form: unknown, documents: unknown): { form: Record<string, unknown>; documents: string[] } {
    const src = (form && typeof form === 'object' ? form : {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of CHAMPS_FORMULAIRE) {
        const v = src[k]
        if (v === undefined || v === null) continue
        if (typeof v === 'boolean') out[k] = v
        else if (typeof v === 'number' && isFinite(v)) out[k] = Math.max(0, Math.min(99, Math.round(v)))
        else if (typeof v === 'string') out[k] = v.slice(0, k === 'afro_descendant_description' || k === 'motivation_lettre' ? 6000 : 300)
    }
    const docs = Array.isArray(documents)
        ? documents.filter((l): l is string => typeof l === 'string' && LIGNE_PIECE.test(l)).slice(0, 60)
        : []
    return { form: out, documents: docs }
}

/** Colonnes de `nationality_applications` à partir d'un brouillon. */
export function colonnesDepuisBrouillon(b: Brouillon): Record<string, unknown> {
    const col: Record<string, unknown> = {}
    for (const k of CHAMPS_FORMULAIRE) {
        const v = b.form[k]
        if (v === undefined) continue
        col[k] = CHAMPS_DATE.has(k) && !v ? null : v
    }
    return col
}

export async function lireBrouillon(sb: SupabaseClient, jeton: string): Promise<Brouillon | null> {
    if (!jetonValide(jeton)) return null
    try {
        const { data, error } = await sb.storage.from(BUCKET_BROUILLONS).download(chemin(jeton))
        if (error || !data) return null
        const b = JSON.parse(await data.text()) as Brouillon
        return b?.jeton === jeton ? b : null
    } catch {
        return null
    }
}

export async function ecrireBrouillon(sb: SupabaseClient, b: Brouillon): Promise<string | null> {
    const { error } = await sb.storage.from(BUCKET_BROUILLONS)
        .upload(chemin(b.jeton), Buffer.from(JSON.stringify(b), 'utf8'), { contentType: 'application/json', upsert: true })
    return error ? error.message : null
}

/**
 * Purge des brouillons abandonnés (> 30 jours) ET des pièces qu'ils seuls
 * référencent : un visiteur qui dépose ses pièces puis ne paie jamais ne doit
 * pas laisser son passeport dans notre stockage indéfiniment.
 */
export async function purgerBrouillons(sb: SupabaseClient): Promise<{ brouillons: number; pieces: number }> {
    const limite = Date.now() - JOURS_BROUILLON * 86_400_000
    const { data } = await sb.storage.from(BUCKET_BROUILLONS).list('brouillons', { limit: 1000 })
    let brouillons = 0, pieces = 0
    for (const f of data || []) {
        const cree = Date.parse(String(f.updated_at || f.created_at || ''))
        if (!isFinite(cree) || cree >= limite) continue
        const jeton = f.name.replace(/\.json$/, '')
        const b = await lireBrouillon(sb, jeton)
        // Un brouillon devenu dossier : ses pièces appartiennent au dossier, on les garde.
        if (b && !b.dossier_ref) {
            const chemins = b.documents.map(l => l.slice(l.lastIndexOf(': nat-') + 2).trim())
            // Une pièce reprise dans un dossier réel n'est jamais supprimée.
            const encoreUtilisees = new Set<string>()
            if (chemins.length) {
                const { data: apps } = await sb.from('nationality_applications').select('documents_uploaded').eq('email', String(b.form.email || '').toLowerCase())
                for (const a of apps || []) for (const l of (a.documents_uploaded || []) as string[]) encoreUtilisees.add(String(l))
            }
            const aSupprimer = chemins.filter(c => ![...encoreUtilisees].some(l => l.endsWith(c)))
            if (aSupprimer.length) {
                await sb.storage.from(BUCKET_BROUILLONS).remove(aSupprimer)
                pieces += aSupprimer.length
            }
        }
        await sb.storage.from(BUCKET_BROUILLONS).remove([`brouillons/${f.name}`])
        brouillons++
    }
    return { brouillons, pieces }
}
