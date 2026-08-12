// ══════════════════════════════════════════════════════════════
//  Identifiant de FLUX pour le parcours « demande de nationalité ».
//
//  Le formulaire et le dépôt enchaînent plusieurs requêtes (lead, URLs
//  signées, une requête PAR pièce jointe, soumission…). Le débit de ces
//  routes publiques est plafonné côté serveur. S'il était plafonné PAR IP,
//  plusieurs clients derrière une même IP (mobile CGNAT, VPN, réseau
//  d'entreprise) épuisaient le quota et se bloquaient mutuellement : pièces
//  perdues, soumission refusée.
//
//  On attache donc à chaque requête un identifiant STABLE par session de
//  navigateur (en-tête `x-rgb-flow`). Le serveur plafonne PAR CE FLUX au lieu
//  de l'IP : chaque dossier a son propre compteur, jamais bloqué « par IP ».
//  Voir lib/api-guard.ts (flowKey / guardPublic).
// ══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'rgb-nat-flow'

/** Identifiant de flux stable pour la session de navigateur courante. */
export function natFlowId(): string {
    if (typeof window === 'undefined') return ''
    try {
        let id = sessionStorage.getItem(STORAGE_KEY)
        if (!id) {
            id =
                (typeof crypto !== 'undefined' && crypto.randomUUID)
                    ? crypto.randomUUID()
                    : `flow-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
            sessionStorage.setItem(STORAGE_KEY, id)
        }
        return id
    } catch {
        // Mode privé / stockage indisponible : identifiant volatil (mieux que l'IP).
        return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    }
}

/**
 * `fetch` enrichi de l'en-tête `x-rgb-flow`. N'impose AUCUN Content-Type :
 * les envois `FormData` (multipart) gardent leur frontière automatique.
 */
export function natFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers || {})
    const id = natFlowId()
    if (id) headers.set('x-rgb-flow', id)
    return fetch(input, { ...init, headers })
}
