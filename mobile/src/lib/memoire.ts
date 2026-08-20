/* ═══════════════════════════════════════════════════════════
   « Afficher d'abord, rafraîchir ensuite » — pour TOUT l'écran.

   La base locale a été branchée sur cinq écrans seulement (Dossier, Factures,
   Notifications, Services, Événements). Partout ailleurs, l'application attend
   encore le réseau AVANT d'afficher quoi que ce soit : un rond qui tourne, puis
   le contenu. Mesuré depuis une connexion filaire rapide, chaque route répond
   en 0,6 à 1 seconde ; sur un réseau mobile béninois, comptez le double ou le
   triple, et davantage encore quand un écran enchaîne deux ou trois appels.
   C'est exactement ce que l'utilisateur ressent comme « des moments de
   chargement ».

   Ce fichier supprime l'attente au PREMIER rendu, sans rien réécrire des
   écrans : on garde la dernière réponse connue, on la ressert INSTANTANÉMENT
   (MMKV est synchrone), puis on va chercher la vraie et on remplace.

   Pourquoi ici et pas dans SQLite : SQLite garde les données STRUCTURÉES qu'on
   trie et filtre (dossiers, factures). Ceci garde des RÉPONSES entières, sans
   schéma, pour n'importe quel appel — API ou requête Supabase. Les deux se
   complètent, ils ne se remplacent pas.

   ── Règle d'or : la clé porte le compte ──────────────────────
   Une réponse personnelle mise en cache sous une clé partagée serait servie au
   client suivant sur le même téléphone. Utiliser `cleDuClient()`, jamais une
   chaîne nue, dès que la donnée appartient à quelqu'un.
═══════════════════════════════════════════════════════════ */
import { lireJson, ecrireJson, stockage } from './stockage'

const PREFIXE = 'mem:'

/** Clé rattachée à un compte. Sans identifiant, la donnée est réputée publique. */
export function cleDuClient(idClient: string | null | undefined, suffixe: string): string {
    return idClient ? `${suffixe}:${idClient}` : suffixe
}

interface Enveloppe<T> {
    v: T
    /** Horodatage d'écriture : sert à décider s'il faut rappeler le réseau. */
    t: number
}

/** Dernière réponse connue, lue de façon SYNCHRONE (donc utilisable dans un
 *  `useState(() => ...)` pour peindre dès le premier rendu). */
export function lireMemoire<T>(cle: string): T | null {
    const e = lireJson<Enveloppe<T>>(PREFIXE + cle)
    return e && 'v' in e ? e.v : null
}

/** Âge de la donnée en mémoire, en millisecondes. `null` si absente. */
export function ageMemoire(cle: string): number | null {
    const e = lireJson<Enveloppe<unknown>>(PREFIXE + cle)
    return e ? Date.now() - e.t : null
}

export function ecrireMemoire(cle: string, valeur: unknown): void {
    ecrireJson(PREFIXE + cle, { v: valeur, t: Date.now() })
}

export function oublierMemoire(cle: string): void {
    stockage.remove(PREFIXE + cle)
}

/** Efface toute la mémoire de réponses d'un compte (déconnexion). */
export function oublierMemoireDuClient(idClient: string): void {
    for (const cle of stockage.getAllKeys()) {
        if (cle.startsWith(PREFIXE) && cle.endsWith(':' + idClient)) stockage.remove(cle)
    }
}

export interface OptionsMemoire {
    /**
     * Tant que la donnée est plus jeune que cela, on ne rappelle PAS le réseau
     * du tout : le téléphone répond seul, le serveur ne voit rien passer.
     *
     * Le défaut est volontairement large — cinq minutes — parce que l'objectif
     * est que la charge vive sur l'appareil, pas sur Supabase. Les écrans qui
     * ont besoin de vif l'abaissent (compteurs : 10 s), ceux qui touchent à
     * l'argent le mettent à `0` pour interroger le serveur à chaque fois.
     */
    fraicheurMs?: number
    /** Ne pas servir le cache — utile après une action de l'utilisateur. */
    ignorerCache?: boolean
}

export interface ResultatMemoire {
    ok: boolean
    /** Vrai si le contenu affiché vient encore du cache (réseau muet). */
    servieDuCache?: boolean
    erreur?: string
}

/**
 * Applique la dernière réponse connue tout de suite, puis la vraie.
 *
 * `appliquer` est appelée UNE ou DEUX fois : d'abord avec le cache s'il existe
 * (`depuisCache = true`), ensuite avec la réponse fraîche. L'écran garde donc
 * sa logique d'affichage intacte — seul le moment change.
 *
 * Ne lève jamais : un réseau coupé laisse simplement le contenu du cache à
 * l'écran, ce qui est très exactement le comportement attendu hors ligne.
 */
export async function avecMemoire<T>(
    cle: string,
    produire: () => Promise<T | null>,
    appliquer: (valeur: T, depuisCache: boolean) => void,
    options: OptionsMemoire = {},
): Promise<ResultatMemoire> {
    const { fraicheurMs = 5 * 60_000, ignorerCache = false } = options

    let servi = false
    if (!ignorerCache) {
        const memorise = lireMemoire<T>(cle)
        if (memorise !== null && memorise !== undefined) {
            appliquer(memorise, true)
            servi = true

            // Assez frais : inutile de déranger le réseau.
            const age = ageMemoire(cle)
            if (age !== null && fraicheurMs > 0 && age < fraicheurMs) {
                return { ok: true, servieDuCache: true }
            }
        }
    }

    try {
        const frais = await produire()
        if (frais === null || frais === undefined) {
            return { ok: servi, servieDuCache: servi, erreur: servi ? undefined : 'Réponse vide' }
        }
        appliquer(frais, false)
        ecrireMemoire(cle, frais)
        return { ok: true }
    } catch (e) {
        /* Le réseau a échoué. Si l'on a déjà peint le cache, l'utilisateur ne
           voit RIEN d'anormal — c'est tout l'intérêt. Sinon, l'appelant décide
           quoi montrer. */
        return {
            ok: servi,
            servieDuCache: servi,
            erreur: e instanceof Error ? e.message : 'Réseau indisponible',
        }
    }
}

/**
 * Valeur de départ d'un `useState`, lue AVANT le premier rendu.
 *
 * C'était la pièce manquante. Mettre les données en cache ne sert à rien si
 * l'écran commence quand même par afficher un rond qui tourne : la lecture se
 * faisait dans un effet, donc APRÈS la première image. MMKV étant synchrone,
 * rien n'oblige à attendre.
 *
 *     const [factures, setFactures] = useState(() => etatMemorise(cle, []))
 *     const [chargement, setChargement] = useState(() => !aEnMemoire(cle))
 *
 * L'écran s'ouvre alors directement sur son contenu, sans une seule image
 * intermédiaire.
 */
export function etatMemorise<T>(cle: string, defaut: T): T {
    const v = lireMemoire<T>(cle)
    return v === null || v === undefined ? defaut : v
}

/** Y a-t-il quelque chose à afficher tout de suite ? (pilote l'état « chargement ») */
export function aEnMemoire(cle: string): boolean {
    return lireMemoire<unknown>(cle) !== null
}
