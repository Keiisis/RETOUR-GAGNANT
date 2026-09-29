// ══════════════════════════════════════════════════════════════
//  Paiements de l'application mobile : preuve, montant, unicité.
//
//  Trois routes mobiles (boutique, événements, dossiers) vérifiaient une
//  transaction Kkiapay chacune à sa façon, et aucune ne contrôlait :
//    · le MONTANT encaissé face au prix serveur (payer 100 XOF suffisait à
//      obtenir un billet VIP ou une commande complète) ;
//    · la RÉUTILISATION d'une transaction déjà consommée ailleurs (le même
//      reçu ouvrait plusieurs inscriptions, commandes ou dossiers).
//  Ce module centralise les trois contrôles. Serveur uniquement.
// ══════════════════════════════════════════════════════════════
import type { SupabaseClient } from '@supabase/supabase-js'
import { motifEmailExact } from './email-motif'

export interface VerifKkiapay {
    ok: boolean
    status: string
    /** Montant confirmé par la passerelle, en XOF (0 si inconnu). */
    montant: number
}

/** Interroge Kkiapay (statut + montant). Fail-closed : sans clé, rien n'est prouvé. */
export async function verifierKkiapay(db: SupabaseClient, transactionId: string): Promise<VerifKkiapay> {
    const tx = String(transactionId || '').trim()
    if (!tx || tx.length > 128) return { ok: false, status: 'transaction_invalide', montant: 0 }

    const { data: settings, error } = await db
        .from('settings')
        .select('key, value')
        .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    if (error) return { ok: false, status: 'config_illisible', montant: 0 }
    const privateKey = settings?.find(s => s.key === 'kkiapay_private_key')?.value
    const secretKey = settings?.find(s => s.key === 'kkiapay_secret_key')?.value
    const sandbox = settings?.find(s => s.key === 'kkiapay_sandbox')?.value === 'true'
    if (!privateKey || !secretKey) return { ok: false, status: 'config_missing', montant: 0 }

    const apiUrl = sandbox
        ? 'https://api-sandbox.kkiapay.me/api/v1/transactions/status'
        : 'https://api.kkiapay.me/api/v1/transactions/status'
    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-private-key': String(privateKey),
                'x-secret-key': String(secretKey),
            },
            body: JSON.stringify({ transactionId: tx }),
        })
        if (!res.ok) return { ok: false, status: `kkiapay_http_${res.status}`, montant: 0 }
        const data = await res.json()
        const montant = Number(data?.amount)
        return {
            ok: data?.status === 'SUCCESS',
            status: String(data?.status || 'unknown'),
            montant: Number.isFinite(montant) && montant > 0 ? montant : 0,
        }
    } catch (e) {
        return { ok: false, status: e instanceof Error ? e.message : 'verify_failed', montant: 0 }
    }
}

/** L'encaissement couvre-t-il le dû ? Tolérance d'arrondi : 1 XOF. */
export function montantCouvert(encaisseXof: number, attenduXof: number): boolean {
    return Number.isFinite(encaisseXof) && Number.isFinite(attenduXof) && encaisseXof + 1 >= attenduXof
}

export interface UsageTransaction {
    table: 'orders' | 'event_registrations' | 'dossier_tracking' | 'documents_financiers'
        | 'nationality_applications' | 'myafro_recap_requests'
    id: string
    email: string | null
    clientId: string | null
    /** orders : statut du paiement. */
    statut?: string | null
}

/**
 * Où cette transaction a-t-elle déjà servi ? `erreur` est rempli si une
 * lecture a échoué : l'appelant doit alors refuser (503), jamais supposer
 * que la transaction est libre.
 */
export async function usagesTransaction(
    db: SupabaseClient,
    transactionId: string,
): Promise<{ usages: UsageTransaction[]; erreur: string | null }> {
    const tx = String(transactionId || '').trim()
    const [o, e, d, f, n, r] = await Promise.all([
        db.from('orders').select('id, customer_email, payment_status').eq('transaction_id', tx).limit(5),
        db.from('event_registrations').select('id, email').eq('transaction_id', tx).limit(5),
        db.from('dossier_tracking').select('id, client_id, client_email').eq('transaction_id', tx).limit(5),
        db.from('documents_financiers').select('id, client_id, client_email').eq('payment_transaction_id', tx).limit(5),
        db.from('nationality_applications').select('id, email').eq('payment_ref', tx).limit(5),
        db.from('myafro_recap_requests').select('id, email').eq('paiement_ref', tx).limit(5),
    ])
    const erreurs = [o, e, d, f, n, r].map(x => x.error?.message).filter(Boolean)
    const usages: UsageTransaction[] = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((o.data || []) as any[]).map(x => ({ table: 'orders' as const, id: String(x.id), email: x.customer_email || null, clientId: null, statut: x.payment_status || null })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((e.data || []) as any[]).map(x => ({ table: 'event_registrations' as const, id: String(x.id), email: x.email || null, clientId: null })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((d.data || []) as any[]).map(x => ({ table: 'dossier_tracking' as const, id: String(x.id), email: x.client_email || null, clientId: x.client_id || null })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((f.data || []) as any[]).map(x => ({ table: 'documents_financiers' as const, id: String(x.id), email: x.client_email || null, clientId: x.client_id || null })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((n.data || []) as any[]).map(x => ({ table: 'nationality_applications' as const, id: String(x.id), email: x.email || null, clientId: null })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...((r.data || []) as any[]).map(x => ({ table: 'myafro_recap_requests' as const, id: String(x.id), email: x.email || null, clientId: null })),
    ]
    return { usages, erreur: erreurs.length ? erreurs.join(' | ') : null }
}

/** La ligne appartient-elle au client (compte, sinon email du PROFIL) ? */
export function appartientAuClient(u: { clientId?: string | null; email?: string | null }, clientId: string | null, emailProfil: string): boolean {
    if (clientId && u.clientId && u.clientId === clientId) return true
    const a = String(u.email || '').trim().toLowerCase()
    return !!emailProfil && !!a && a === emailProfil.trim().toLowerCase()
}

/** Email du profil rattaché au compte (jamais un email transmis par l'appelant). */
export async function emailDuProfil(db: SupabaseClient, clientId: string): Promise<string> {
    const { data } = await db.from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    return String(data?.email || '').trim().toLowerCase()
}

/** Motif ILIKE exact de l'email, ou un motif qui ne correspond à rien. */
export function motifOuRien(email: string): string {
    return motifEmailExact(email) ?? '\u0000'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function estUuid(v: unknown): v is string {
    return typeof v === 'string' && UUID_RE.test(v)
}
