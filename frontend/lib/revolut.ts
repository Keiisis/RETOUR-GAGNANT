// ══════════════════════════════════════════════════════════════
//  REVOLUT PAY — Merchant API.
//
//  Références vérifiées sur la documentation Revolut (septembre 2026) :
//    · base sandbox     : https://sandbox-merchant.revolut.com/api
//    · base production  : https://merchant.revolut.com/api
//    · créer une commande : POST /orders
//    · lire une commande  : GET  /orders/{id}
//    · authentification : `Authorization: Bearer sk_…` (clé SECRÈTE marchand)
//    · versionnage PAR EN-TÊTE : `Revolut-Api-Version: AAAA-MM-JJ` — sans lui,
//      l'API répond une erreur. Ce n'est pas un détail : Revolut versionne par
//      date, et une version non épinglée casserait le jour d'un changement.
//
//  DEUX PIÈGES QUI COÛTENT DE L'ARGENT, traités ici et pas ailleurs :
//
//  1. LES MONTANTS SONT EN UNITÉS MINEURES (ISO 4217). 10 EUR = 1000.
//     Mais toutes les devises n'ont pas de centimes : XOF, XAF, JPY… n'en ont
//     aucune. Multiplier par 100 y facturerait CENT FOIS le prix. Le projet
//     connaît déjà ce piège pour Stripe ; la même liste est réutilisée.
//
//  2. REVOLUT NE RÈGLE PAS EN FRANCS CFA. Le compte Revolut Business tient des
//     devises internationales (EUR, GBP, USD…), pas le XOF. Une commande en
//     XOF serait refusée par l'API. On CONVERTIT donc vers la devise de
//     règlement configurée en admin, avec la marge déjà appliquée aux autres
//     passerelles — et le montant réellement présenté au client est renvoyé,
//     pour que l'écran affiche ce qui sera débité.
// ══════════════════════════════════════════════════════════════
import crypto from 'crypto'

/** Devises sans sous-unité : le montant mineur est le montant lui-même. */
const SANS_CENTIMES = new Set([
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/** Devises que Revolut Business accepte à l'encaissement. */
export const DEVISES_REVOLUT = ['EUR', 'GBP', 'USD', 'CHF', 'PLN', 'RON', 'SEK', 'NOK', 'DKK'] as const

/**
 * Version d'API ÉPINGLÉE.
 *
 * Revolut versionne par date : on fixe la nôtre pour qu'une évolution de leur
 * côté ne change jamais le comportement sans qu'on l'ait décidé. À faire
 * évoluer sciemment, après lecture du journal des changements.
 */
export const REVOLUT_API_VERSION = '2024-09-01'

export interface ConfigRevolut {
    secretKey: string
    sandbox: boolean
    /** Devise d'encaissement (le compte Revolut Business). */
    devise: string
    /** Secret de signature des webhooks (`wsk_…`). */
    webhookSecret?: string
}

export const baseRevolut = (sandbox: boolean) =>
    sandbox ? 'https://sandbox-merchant.revolut.com/api' : 'https://merchant.revolut.com/api'

/** Convertit un montant en unités mineures pour l'API. */
export function enUnitesMineures(montant: number, devise: string): number {
    const d = devise.toUpperCase()
    return SANS_CENTIMES.has(d) ? Math.round(montant) : Math.round(montant * 100)
}

/** L'inverse : lit un montant renvoyé par Revolut. */
export function depuisUnitesMineures(mineur: number, devise: string): number {
    const d = devise.toUpperCase()
    return SANS_CENTIMES.has(d) ? mineur : mineur / 100
}

interface ReponseCommande {
    id: string
    token: string
    state: string
    amount: number
    currency: string
    checkout_url?: string
    merchant_order_data?: { reference?: string }
    payments?: Array<Record<string, unknown>>
}

async function appeler<T>(
    cfg: ConfigRevolut, chemin: string, init?: RequestInit,
): Promise<{ ok: boolean; statut: number; data: T | null; erreur?: string }> {
    try {
        const res = await fetch(`${baseRevolut(cfg.sandbox)}${chemin}`, {
            ...init,
            headers: {
                'Authorization': `Bearer ${cfg.secretKey}`,
                'Revolut-Api-Version': REVOLUT_API_VERSION,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(init?.headers || {}),
            },
            cache: 'no-store',
        })
        const texte = await res.text()
        let data: unknown = null
        try { data = texte ? JSON.parse(texte) : null } catch { /* corps non JSON */ }

        if (!res.ok) {
            const msg = (data as { message?: string; code?: string } | null)?.message
                || `Revolut a répondu ${res.status}`
            return { ok: false, statut: res.status, data: null, erreur: msg }
        }
        return { ok: true, statut: res.status, data: data as T }
    } catch (e) {
        return {
            ok: false, statut: 0, data: null,
            erreur: e instanceof Error ? e.message : 'Connexion à Revolut impossible',
        }
    }
}

/**
 * Crée une commande Revolut.
 *
 * `reference` est notre identifiant de commande : il revient dans la commande
 * lue à la vérification, et c'est LUI qui permet d'affirmer qu'un paiement
 * appartient bien à cette commande-ci. Sans ce lien, un identifiant de
 * transaction valide mais étranger suffirait à faire valider n'importe quoi.
 */
export async function creerCommandeRevolut(
    cfg: ConfigRevolut,
    p: {
        montant: number
        reference: string
        description?: string
        email?: string | null
        nom?: string | null
        redirectUrl?: string
    },
) {
    const devise = cfg.devise.toUpperCase()
    return appeler<ReponseCommande>(cfg, '/orders', {
        method: 'POST',
        body: JSON.stringify({
            amount: enUnitesMineures(p.montant, devise),
            currency: devise,
            capture_mode: 'automatic',
            description: p.description?.slice(0, 240),
            merchant_order_data: { reference: p.reference },
            ...(p.redirectUrl ? { redirect_url: p.redirectUrl } : {}),
            ...(p.email ? { customer: { email: p.email, full_name: p.nom || undefined } } : {}),
        }),
    })
}

/** Lit une commande — la SEULE source de vérité sur son état. */
export async function lireCommandeRevolut(cfg: ConfigRevolut, id: string) {
    return appeler<ReponseCommande>(cfg, `/orders/${encodeURIComponent(id)}`, { method: 'GET' })
}

/** Un paiement est acquis dans ces états, et dans ceux-là seulement. */
export const ETATS_PAYES = new Set(['completed', 'authorised'])

/**
 * Vérifie la signature d'un webhook Revolut.
 *
 * Charge signée : `v1.{timestamp}.{corps BRUT}`, HMAC-SHA256 avec le secret
 * `wsk_…`, comparé au champ `v1=<hex>` de l'en-tête `Revolut-Signature`.
 *
 * Trois points sur lesquels on ne transige pas :
 *   · le corps doit être le TEXTE BRUT reçu. Le re-sérialiser (JSON.parse puis
 *     stringify) change un espace ou un ordre de clés, et la signature ne
 *     correspond plus ;
 *   · l'en-tête peut contenir PLUSIEURS signatures séparées par des virgules
 *     pendant une rotation de secret : il suffit qu'une corresponde ;
 *   · une livraison datée de plus de cinq minutes est refusée — sans quoi une
 *     requête interceptée pourrait être rejouée indéfiniment.
 */
export function verifierSignatureRevolut(
    corpsBrut: string,
    signatureHeader: string | null,
    timestampHeader: string | null,
    secret: string,
): { ok: boolean; motif?: string } {
    if (!secret) return { ok: false, motif: 'Secret de webhook non configuré' }
    if (!signatureHeader || !timestampHeader) return { ok: false, motif: 'En-têtes de signature absents' }

    const ts = Number(timestampHeader)
    if (!Number.isFinite(ts)) return { ok: false, motif: 'Horodatage invalide' }
    // Revolut horodate en MILLISECONDES.
    if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) return { ok: false, motif: 'Livraison trop ancienne' }

    const attendu = crypto
        .createHmac('sha256', secret)
        .update(`v1.${timestampHeader}.${corpsBrut}`)
        .digest('hex')

    const fournies = signatureHeader.split(',')
        .map(s => s.trim())
        .map(s => (s.startsWith('v1=') ? s.slice(3) : s))

    const attenduBuf = Buffer.from(attendu, 'hex')
    for (const f of fournies) {
        try {
            const buf = Buffer.from(f, 'hex')
            // Comparaison à temps constant : une comparaison naïve laisse
            // deviner la signature octet par octet.
            if (buf.length === attenduBuf.length && crypto.timingSafeEqual(buf, attenduBuf)) {
                return { ok: true }
            }
        } catch { /* signature illisible : on essaie la suivante */ }
    }
    return { ok: false, motif: 'Signature non concordante' }
}

/**
 * La devise d'encaissement, VALIDÉE.
 *
 * Revolut ne tient PAS le franc CFA : le repli ne peut donc pas être le XOF
 * comme ailleurs. Une valeur invalide retombe sur l'EUR, qui est en parité
 * fixe avec le franc CFA — c'est la conversion la moins surprenante pour
 * l'agence, et la seule qui soit exacte au centime.
 */
export function deviseDeRepliRevolut(configuree?: string | null): string {
    const c = String(configuree || '').trim().toUpperCase()
    return (DEVISES_REVOLUT as readonly string[]).includes(c) ? c : 'EUR'
}
