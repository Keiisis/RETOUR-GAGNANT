// ══════════════════════════════════════════════════════════════
//  Libellé CLIENT du moyen de paiement (factures, reçus, écrans).
//
//  Module pur (navigateur + serveur). Avant le 30/09/2026, le PDF DEVINAIT le
//  moyen à partir des notes : « kkiapay » → « Mobile Money ». Faux pour un
//  paiement par carte via Kkiapay (cas TOUCHE, FAC-2026-0007, Visa).
//  Règle : on affiche ce qui est ENREGISTRÉ (payment_method, enrichi au
//  paiement par lib/moyen-paiement-detail.ts), jamais une supposition.
// ══════════════════════════════════════════════════════════════

const PRESTATAIRES: Record<string, string> = {
    kkiapay: 'Kkiapay',
    fedapay: 'FedaPay',
    stripe: 'Carte bancaire · Stripe',
    paypal: 'PayPal',
    zeyow: 'Zeyow',
    virement: 'Virement bancaire',
    especes: 'Espèces',
    cheque: 'Chèque',
    mobile_money: 'Mobile Money',
    carte: 'Carte bancaire',
}

/** Codes internes sans valeur pour le client : rien n'est affiché. */
// « pending » : statut écrit par erreur dans le champ moyen (commande test du 29/09).
const MUETS = new Set(['', 'manuel', 'manual', 'en ligne', 'online', 'autre', 'null', 'undefined', 'pending', 'en_attente'])

/**
 * Libellé lisible d'un moyen de paiement enregistré.
 * « kkiapay » → « Kkiapay » ; « Carte bancaire Visa · Kkiapay » → inchangé ;
 * « manuel » / vide → '' (le document n'affiche alors aucun moyen).
 */
export function libelleMoyenPaiement(brut?: string | null): string {
    const v = String(brut ?? '').trim()
    const cle = v.toLowerCase().replace(/[\s-]+/g, '_')
    if (MUETS.has(v.toLowerCase())) return ''
    if (PRESTATAIRES[cle]) return PRESTATAIRES[cle]
    // Déjà un libellé détaillé (contient une majuscule, un espace ou « · »)
    return v
}
