/* ═══════════════════════════════════════════════════════════
   Stockage rapide — MMKV.

   AsyncStorage écrit dans une base SQLite via le pont JS : chaque lecture est
   une promesse, chaque écriture un aller-retour. Au démarrage, l'application
   attendait donc son cache de traduction avant de pouvoir afficher un texte
   traduit — d'où l'éclair de français au lancement. Et le cache de traduction
   était RÉÉCRIT EN ENTIER à chaque lot reçu : plus l'utilisateur traduisait,
   plus chaque écriture coûtait cher.

   MMKV lit et écrit en mémoire mappée, de façon SYNCHRONE. `lire()` rend la
   valeur immédiatement : plus d'attente, plus de course entre deux effets.

   Ce qui ne passe PAS ici : les jetons de session. MMKV n'est pas chiffré par
   défaut ; les jetons restent dans `expo-secure-store` (trousseau iOS /
   Keystore Android). Voir `src/config/supabase.ts`.
═══════════════════════════════════════════════════════════ */
import { createMMKV } from 'react-native-mmkv'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** L'instance unique. `id` fixe le fichier : ne le renommez pas, tout serait perdu.
 *  API v4 : `createMMKV()` remplace `new MMKV()`, et `remove()` remplace `delete()`. */
export const stockage = createMMKV({ id: 'rgb' })

/* ── Lecture / écriture ──────────────────────────────────── */

export function lire(cle: string): string | undefined {
    return stockage.getString(cle)
}

export function ecrire(cle: string, valeur: string): void {
    stockage.set(cle, valeur)
}

export function supprimer(cle: string): void {
    stockage.remove(cle)
}

export function existe(cle: string): boolean {
    return stockage.contains(cle)
}

/**
 * Lit un objet JSON. Une valeur corrompue n'explose pas au visage de
 * l'appelant : elle est effacée et traitée comme absente.
 */
export function lireJson<T>(cle: string): T | null {
    const brut = stockage.getString(cle)
    if (!brut) return null
    try {
        return JSON.parse(brut) as T
    } catch {
        stockage.remove(cle)
        return null
    }
}

export function ecrireJson(cle: string, valeur: unknown): void {
    try {
        stockage.set(cle, JSON.stringify(valeur))
    } catch {
        /* Valeur non sérialisable (cycle, fonction) : on n'écrit rien plutôt
           que d'enregistrer une chaîne tronquée qui casserait à la relecture. */
    }
}

export function lireBool(cle: string): boolean {
    return stockage.getBoolean(cle) ?? false
}

export function ecrireBool(cle: string, valeur: boolean): void {
    stockage.set(cle, valeur)
}

/* ── Compatibilité : même forme qu'AsyncStorage ───────────────
   Pour les rares endroits où le code appelant est déjà écrit en asynchrone
   (Supabase, bibliothèques tierces) : même signature, mais servi depuis MMKV.
   À ne PAS utiliser dans du code neuf — `lire()` suffit et évite une promesse. */
export const StockageAsync = {
    getItem: async (cle: string): Promise<string | null> => stockage.getString(cle) ?? null,
    setItem: async (cle: string, valeur: string): Promise<void> => { stockage.set(cle, valeur) },
    removeItem: async (cle: string): Promise<void> => { stockage.remove(cle) },
}

/* ── Reprise des données déjà présentes ───────────────────────
   Un utilisateur qui met l'application à jour ne doit PAS repartir de zéro :
   sa langue, son onboarding passé, son adresse de livraison et son cache de
   traduction vivent encore dans AsyncStorage. On les recopie une fois, puis on
   pose un drapeau — la reprise ne se rejoue jamais.

   Volontairement tolérant : une clé absente n'est pas une erreur, et un échec
   global ne doit pas empêcher l'application de démarrer. */
const DRAPEAU_REPRISE = '@migration_mmkv_v1'

/** Clés dont la valeur est connue à l'avance. Les caches de traduction, eux,
 *  portent la langue dans leur nom : ils sont balayés dynamiquement. */
const CLES_CONNUES = [
    'onboarding_complete_v2',
    'lang_chosen',
    '@rg_lang',
    '@rg_shipping_form',
]

export async function reprendreDonneesAsyncStorage(): Promise<void> {
    if (stockage.getBoolean(DRAPEAU_REPRISE)) return

    try {
        const toutes = await AsyncStorage.getAllKeys()
        const aReprendre = toutes.filter(k =>
            CLES_CONNUES.includes(k)
            || k.startsWith('@rg_trans_cache')     // caches de traduction (par langue)
            || k.startsWith('@rg_chat_last_seen')  // dernier passage dans la messagerie
            || k.startsWith('@rg_')                // brouillons et préférences diverses
            || k.startsWith('2fa_'),
        )

        if (aReprendre.length > 0) {
            const paires = await AsyncStorage.multiGet(aReprendre)
            for (const [cle, valeur] of paires) {
                if (typeof valeur === 'string') stockage.set(cle, valeur)
            }
        }

        stockage.set(DRAPEAU_REPRISE, true)
        if (__DEV__) console.log(`[stockage] ${aReprendre.length} clé(s) reprises depuis AsyncStorage`)

        /* On ne supprime PAS l'ancien contenu : si une version antérieure de
           l'application est réinstallée par-dessus (rétrogradation, test), elle
           doit retrouver ses données. Le volume est négligeable. */
    } catch (e) {
        // Reprise impossible : l'utilisateur reverra l'onboarding, rien de plus.
        if (__DEV__) console.warn('[stockage] reprise impossible :', e)
        stockage.set(DRAPEAU_REPRISE, true)
    }
}
