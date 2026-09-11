// ══════════════════════════════════════════════════════════════
//  PAYSTACK — vérifié sur la documentation (septembre 2026) et appelé.
//
//    · base          : https://api.paystack.co   (une seule ; le mode test
//                      dépend de la CLÉ, pas de l'URL — pas de sandbox à part)
//    · initialiser   : POST /transaction/initialize
//    · vérifier      : GET  /transaction/verify/{reference}
//    · authentif.    : `Authorization: Bearer sk_test_… | sk_live_…`
//    · webhook       : en-tête `x-paystack-signature`, HMAC-SHA512 du CORPS
//                      BRUT, clé = la clé SECRÈTE elle-même (pas un secret
//                      distinct, contrairement à Stripe ou Revolut).
//
//  ⚠️ PIÈGE MAJEUR, ET IL EST L'INVERSE DE STRIPE.
//  Paystack veut le montant en sous-unités, ET IL EXIGE ×100 MÊME POUR LE XOF,
//  qui n'a pourtant aucune subdivision. Appliquer ici la règle « zéro décimale »
//  de Stripe reviendrait à encaisser CENT FOIS MOINS que le prix. La règle de
//  chaque passerelle lui appartient : elles ne se recopient pas.
//
//  Le franc CFA est pris en charge (NGN, GHS, ZAR, KES, USD, XOF) : aucune
//  conversion n'est nécessaire, contrairement à Revolut.
// ══════════════════════════════════════════════════════════════
import crypto from 'crypto'

export const BASE_PAYSTACK = 'https://api.paystack.co'

/** Devises acceptées par Paystack — le XOF en fait partie. */
export const DEVISES_PAYSTACK = ['XOF', 'NGN', 'GHS', 'ZAR', 'KES', 'USD'] as const

/**
 * Montant en sous-unités selon la règle PAYSTACK : toujours ×100.
 *
 * Documenté explicitement par Paystack pour le XOF : « bien qu'il n'y ait pas
 * de sous-unité, multipliez tout de même par 100 ». Ne pas « corriger » ceci
 * en s'inspirant de Stripe.
 */
export const enSousUnitesPaystack = (montant: number): number => Math.round(montant * 100)

/** L'inverse, pour relire un montant renvoyé par Paystack. */
export const depuisSousUnitesPaystack = (mineur: number): number => mineur / 100

export interface ConfigPaystack {
    secretKey: string
}

interface Enveloppe<T> { status: boolean; message?: string; data?: T }

interface DonneesInit {
    authorization_url: string
    access_code: string
    reference: string
}

export interface DonneesVerif {
    status: string
    reference: string
    amount: number
    currency: string
    metadata?: { order_id?: string } | string | null
}

async function appeler<T>(
    cfg: ConfigPaystack, chemin: string, init?: RequestInit,
): Promise<{ ok: boolean; data: T | null; erreur?: string }> {
    try {
        const res = await fetch(`${BASE_PAYSTACK}${chemin}`, {
            ...init,
            headers: {
                'Authorization': `Bearer ${cfg.secretKey}`,
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
            cache: 'no-store',
        })
        const json = (await res.json().catch(() => null)) as Enveloppe<T> | null
        if (!res.ok || !json?.status) {
            return { ok: false, data: null, erreur: json?.message || `Paystack a répondu ${res.status}` }
        }
        return { ok: true, data: (json.data ?? null) as T }
    } catch (e) {
        return { ok: false, data: null, erreur: e instanceof Error ? e.message : 'Connexion à Paystack impossible' }
    }
}

/**
 * Ouvre une transaction.
 *
 * `reference` est NOTRE identifiant de commande : Paystack le renvoie tel quel
 * à la vérification, ce qui prouve qu'un paiement appartient bien à cette
 * commande-ci. `metadata.order_id` le double, par sécurité.
 */
export async function initierPaystack(
    cfg: ConfigPaystack,
    p: { montant: number; devise: string; email: string; reference: string; callbackUrl?: string },
) {
    return appeler<DonneesInit>(cfg, '/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
            email: p.email,
            amount: enSousUnitesPaystack(p.montant),
            currency: p.devise.toUpperCase(),
            reference: p.reference,
            ...(p.callbackUrl ? { callback_url: p.callbackUrl } : {}),
            metadata: { order_id: p.reference },
        }),
    })
}

/** Lit une transaction — la seule source de vérité sur son issue. */
export async function verifierPaystack(cfg: ConfigPaystack, reference: string) {
    return appeler<DonneesVerif>(cfg, `/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' })
}

/**
 * Vérifie la signature d'un webhook Paystack.
 *
 * HMAC-SHA512 du corps BRUT, clé = la clé secrète. Comparaison à temps
 * constant : une comparaison naïve laisse deviner la signature octet par
 * octet. Le corps ne doit jamais être re-sérialisé avant vérification.
 */
export function verifierSignaturePaystack(
    corpsBrut: string, signature: string | null, secretKey: string,
): { ok: boolean; motif?: string } {
    if (!secretKey) return { ok: false, motif: 'Clé secrète non configurée' }
    if (!signature) return { ok: false, motif: 'En-tête de signature absent' }

    const attendu = crypto.createHmac('sha512', secretKey).update(corpsBrut).digest('hex')
    try {
        const a = Buffer.from(attendu, 'hex')
        const b = Buffer.from(signature.trim(), 'hex')
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return { ok: false, motif: 'Signature non concordante' }
        }
        return { ok: true }
    } catch {
        return { ok: false, motif: 'Signature illisible' }
    }
}

/** Lit `order_id` dans les métadonnées, qui peuvent arriver en objet OU en texte. */
export function orderIdDepuisMetadata(meta: DonneesVerif['metadata']): string | null {
    if (!meta) return null
    if (typeof meta === 'string') {
        try { return (JSON.parse(meta) as { order_id?: string }).order_id || null } catch { return null }
    }
    return meta.order_id || null
}

/**
 * La devise de repli, VALIDÉE.
 *
 * Le réglage est désormais une liste fermée dans l'interface, mais la valeur
 * en base peut être vide (ligne créée avant ce champ) ou avoir été modifiée
 * par une autre voie. On ne transmet donc JAMAIS ce texte tel quel à l'API :
 * un code inconnu ferait échouer le paiement avec un message incompréhensible
 * pour le client. Une valeur invalide retombe sur le XOF, qui est la devise de
 * l'agence — jamais sur rien.
 */
export function deviseDeRepliPaystack(configuree?: string | null): string {
    const c = String(configuree || '').trim().toUpperCase()
    return (DEVISES_PAYSTACK as readonly string[]).includes(c) ? c : 'XOF'
}
