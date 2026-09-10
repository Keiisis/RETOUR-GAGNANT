// ══════════════════════════════════════════════════════════════
//  FLUTTERWAVE v3 — vérifié sur la documentation (septembre 2026) et appelé.
//
//    · base        : https://api.flutterwave.com/v3   (une seule ; le mode
//                    test dépend de la CLÉ `FLWSECK_TEST-…`)
//    · payer       : POST /payments  → renvoie un LIEN de paiement hébergé
//    · vérifier    : GET  /transactions/{id}/verify
//                    GET  /transactions/verify_by_reference?tx_ref=…
//    · authentif.  : `Authorization: Bearer FLWSECK-…`
//
//  ⚠️ LE WEBHOOK A DEUX FORMES, ET LES DEUX CIRCULENT.
//  Historiquement : en-tête `verif-hash`, comparé PAR ÉGALITÉ au « secret
//  hash » saisi dans le tableau de bord. La documentation récente décrit
//  `flutterwave-signature`, un HMAC-SHA256 du corps avec ce même secret.
//  On accepte les DEUX : refuser l'ancienne casserait les comptes non encore
//  migrés, n'accepter que l'ancienne casserait les nouveaux. Dans les deux cas
//  la comparaison est à temps constant.
//
//  ⚠️ ET SURTOUT : la notification ne fait pas foi. Flutterwave le dit
//  lui-même — on RE-INTERROGE l'API avant de donner la moindre valeur. Un
//  webhook prouve l'émetteur, pas l'état réel de la transaction.
//
//  Le franc CFA est pris en charge nativement : aucune conversion.
// ══════════════════════════════════════════════════════════════
import crypto from 'crypto'

export const BASE_FLUTTERWAVE = 'https://api.flutterwave.com/v3'

/** Devises courantes de Flutterwave — le XOF en fait partie. */
export const DEVISES_FLUTTERWAVE = ['XOF', 'XAF', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'USD', 'EUR', 'GBP'] as const

export interface ConfigFlutterwave {
    secretKey: string
    /** Secret de webhook saisi dans le tableau de bord. */
    secretHash?: string
}

interface Enveloppe<T> { status: string; message?: string; data?: T }

interface DonneesPaiement { link: string }

export interface DonneesTransaction {
    id: number
    tx_ref: string
    status: string
    amount: number
    charged_amount?: number
    currency: string
    customer?: { email?: string }
}

async function appeler<T>(
    cfg: ConfigFlutterwave, chemin: string, init?: RequestInit,
): Promise<{ ok: boolean; data: T | null; erreur?: string }> {
    try {
        const res = await fetch(`${BASE_FLUTTERWAVE}${chemin}`, {
            ...init,
            headers: {
                'Authorization': `Bearer ${cfg.secretKey}`,
                'Content-Type': 'application/json',
                ...(init?.headers || {}),
            },
            cache: 'no-store',
        })
        const json = (await res.json().catch(() => null)) as Enveloppe<T> | null
        if (!res.ok || json?.status !== 'success') {
            return { ok: false, data: null, erreur: json?.message || `Flutterwave a répondu ${res.status}` }
        }
        return { ok: true, data: (json.data ?? null) as T }
    } catch (e) {
        return { ok: false, data: null, erreur: e instanceof Error ? e.message : 'Connexion à Flutterwave impossible' }
    }
}

/**
 * Ouvre un paiement hébergé et renvoie le lien où envoyer le client.
 *
 * `tx_ref` est NOTRE identifiant de commande : il revient dans la transaction
 * vérifiée, et c'est lui qui rattache le paiement à la bonne commande.
 */
export async function initierFlutterwave(
    cfg: ConfigFlutterwave,
    p: {
        montant: number; devise: string; txRef: string; redirectUrl: string
        email: string; nom?: string | null; telephone?: string | null
        titre?: string; description?: string
    },
) {
    return appeler<DonneesPaiement>(cfg, '/payments', {
        method: 'POST',
        body: JSON.stringify({
            tx_ref: p.txRef,
            amount: p.montant,
            currency: p.devise.toUpperCase(),
            redirect_url: p.redirectUrl,
            customer: {
                email: p.email,
                name: p.nom || undefined,
                phonenumber: p.telephone || undefined,
            },
            customizations: {
                title: p.titre || 'Retour Gagnant Bénin',
                description: p.description || undefined,
            },
        }),
    })
}

/** Vérifie par identifiant de transaction (celui du retour ou du webhook). */
export async function verifierFlutterwaveParId(cfg: ConfigFlutterwave, id: string | number) {
    return appeler<DonneesTransaction>(cfg, `/transactions/${encodeURIComponent(String(id))}/verify`, { method: 'GET' })
}

/** Vérifie par NOTRE référence — utile quand l'identifiant s'est perdu. */
export async function verifierFlutterwaveParRef(cfg: ConfigFlutterwave, txRef: string) {
    return appeler<DonneesTransaction>(
        cfg, `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`, { method: 'GET' },
    )
}

/** Une transaction n'est acquise que dans cet état. */
export const ETAT_PAYE_FLW = 'successful'

/**
 * Vérifie un webhook Flutterwave, dans ses DEUX formes.
 *
 * · `verif-hash` : égalité stricte avec le secret du tableau de bord ;
 * · `flutterwave-signature` : HMAC-SHA256 du corps brut avec ce même secret.
 *
 * Les deux comparaisons sont à temps constant. On accepte l'une OU l'autre :
 * les comptes n'ont pas tous migré, et refuser la forme historique couperait
 * les notifications sans prévenir.
 */
export function verifierSignatureFlutterwave(
    corpsBrut: string,
    verifHash: string | null,
    signature: string | null,
    secretHash: string,
): { ok: boolean; motif?: string } {
    if (!secretHash) return { ok: false, motif: 'Secret de webhook non configuré' }

    const egal = (a: string, b: string) => {
        const ba = Buffer.from(a), bb = Buffer.from(b)
        return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
    }

    if (verifHash && egal(verifHash.trim(), secretHash)) return { ok: true }

    if (signature) {
        const attendu = crypto.createHmac('sha256', secretHash).update(corpsBrut).digest('hex')
        if (egal(signature.trim().toLowerCase(), attendu)) return { ok: true }
    }

    return { ok: false, motif: 'Signature non concordante' }
}