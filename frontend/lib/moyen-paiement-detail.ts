// ══════════════════════════════════════════════════════════════
//  Moyen de paiement EXACT d'une transaction (serveur uniquement).
//
//  Kkiapay encaisse cartes ET Mobile Money : le nom du prestataire ne dit
//  pas comment le client a payé. Sa transaction le dit (`source`,
//  `source_common_name`). On l'interroge une fois, au paiement, et on
//  enregistre un libellé client dans documents_financiers.payment_method
//  (« Carte bancaire Visa · Kkiapay », « MTN Mobile Money · Kkiapay »…).
//  Échec de lecture → libellé du prestataire seul (jamais une supposition).
// ══════════════════════════════════════════════════════════════
import { supabaseServeur as supabase } from '@/lib/supabase-serveur'
import { libelleMoyenPaiement } from '@/lib/moyen-paiement-libelle'

const RESEAUX: Array<[RegExp, string]> = [
    [/visa/i, 'Carte bancaire Visa'],
    [/master/i, 'Carte bancaire Mastercard'],
    [/amex|american/i, 'Carte bancaire American Express'],
    [/mtn/i, 'MTN Mobile Money'],
    [/moov/i, 'Moov Money'],
    [/celtiis/i, 'Celtiis Cash'],
    [/orange/i, 'Orange Money'],
    [/wave/i, 'Wave'],
    [/free/i, 'Free Money'],
]

/** Libellé d'après les champs Kkiapay `source` / `source_common_name`. */
export function libelleSourceKkiapay(source?: string | null, nomCommun?: string | null): string {
    const nom = String(nomCommun || '')
    for (const [re, libelle] of RESEAUX) if (re.test(nom)) return libelle
    const s = String(source || '').toUpperCase()
    if (s === 'CARD') return 'Carte bancaire'
    if (s === 'MOBILE_MONEY') return 'Mobile Money'
    if (s === 'WALLET') return 'Portefeuille Kkiapay'
    return ''
}

async function sourceKkiapay(transactionId: string): Promise<string> {
    const { data } = await supabase.from('settings').select('key, value')
        .in('key', ['kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
    const v = (k: string) => String(data?.find(s => s.key === k)?.value || '')
    if (!v('kkiapay_private_key')) return ''
    const base = v('kkiapay_sandbox') === 'true' ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'
    try {
        const res = await fetch(`${base}/api/v1/transactions/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': v('kkiapay_public_key'),
                'x-private-key': v('kkiapay_private_key'),
                'x-secret-key': v('kkiapay_secret_key'),
            },
            body: JSON.stringify({ transactionId }),
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) return ''
        const j = await res.json() as { source?: string; source_common_name?: string }
        return libelleSourceKkiapay(j.source, j.source_common_name)
    } catch {
        return ''
    }
}

/**
 * Libellé client du moyen de paiement d'une transaction.
 * kkiapay + transaction → « Carte bancaire Visa · Kkiapay » ; sinon libellé
 * du prestataire (« PayPal », « Carte bancaire · Stripe »…) ; '' si inconnu.
 */
export async function detaillerMoyenPaiement(prestataire?: string | null, transactionId?: string | null): Promise<string> {
    const p = String(prestataire || '').trim().toLowerCase()
    const tx = String(transactionId || '').trim()
    const base = libelleMoyenPaiement(p)
    if (p === 'kkiapay' && tx) {
        const detail = await sourceKkiapay(tx)
        if (detail) return `${detail} · Kkiapay`
    }
    return base
}
