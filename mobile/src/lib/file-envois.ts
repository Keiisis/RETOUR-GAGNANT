import NetInfo from '@react-native-community/netinfo'
import { AppState, type AppStateStatus } from 'react-native'
import { ouvrirBase } from './db/base'
import { authHeaders } from '../config/api'
import { fetchWithTimeout } from './fetch'

/* Même déclaration que dans les écrans : le domaine n'est pas exporté d'un
   module commun dans ce projet. */
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* ═══════════════════════════════════════════════════════════════
   FILE D'ENVOIS — CE QUI A ÉTÉ PAYÉ FINIT PAR ARRIVER

   Le défaut réparé ici touchait tous les services payants de
   l'application. Après l'encaissement, l'écran appelait le serveur pour
   ouvrir le dossier, et écrivait :

       .catch(() => { /* non bloquant : le paiement est déjà encaissé *​/ })

   Une coupure réseau d'une seconde à cet instant précis suffisait : l'argent
   partait chez la passerelle, aucune ligne n'était créée côté RGB, le client
   voyait un écran de succès et personne n'était averti. Le dossier
   n'existait pour personne.

   Désormais l'envoi qui échoue est CONSERVÉ sur le téléphone et rejoué :
     · au lancement de l'application,
     · dès que le réseau revient,
     · à chaque retour au premier plan.

   POURQUOI REJOUER NE CRÉE PAS DE DOUBLON — condition à ne jamais lever :
   les routes admises dédoublonnent côté serveur. /api/mobile/dossiers
   reconnaît un `transaction_id` déjà traité et renvoie le dossier existant ;
   /api/nationality reconnaît un `payment_ref` et complète la fiche au lieu
   d'en créer une seconde. N'inscrire dans cette file QUE des routes qui
   offrent cette garantie.

   La file est volontairement bornée : après TENTATIVES_MAX, l'envoi cesse
   d'être rejoué mais reste en base avec son motif d'échec, consultable par
   `envoisAbandonnes()`. Rien n'est effacé en silence.
   ═══════════════════════════════════════════════════════════════ */

/** Au-delà, on cesse de réessayer — sans effacer. */
const TENTATIVES_MAX = 25
/** Progression de l'attente entre deux essais, en millisecondes. */
const ATTENTES = [0, 5_000, 15_000, 60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000]
const DELAI_REQUETE_MS = 25_000

export interface EnvoiEnAttente {
    id: string
    chemin: string
    methode: string
    corps: string
    besoin_jeton: number
    service: string | null
    reference: string | null
    cree_le: number
    tentatives: number
    prochaine_le: number
    derniere_err: string | null
}

export interface DemandeEnvoi {
    /** Chemin d'API, domaine exclu — « /api/mobile/dossiers ». */
    chemin: string
    corps: Record<string, unknown>
    /** Verbe HTTP. POST par defaut ; PATCH pour une confirmation. */
    methode?: 'POST' | 'PATCH'
    /** Faut-il joindre le jeton de session ? Vrai pour /api/mobile/*. */
    besoinJeton?: boolean
    /** Libellé lisible du service, pour les messages destinés au client. */
    service?: string
    /** Transaction ou référence : ce qui permet de retrouver l'envoi. */
    reference?: string
}

const identifiant = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
const attente = (tentatives: number) => ATTENTES[Math.min(tentatives, ATTENTES.length - 1)]

/* ── Écriture ─────────────────────────────────────────────── */

async function inscrire(d: DemandeEnvoi, erreur: string): Promise<void> {
    const db = await ouvrirBase()
    await db.runAsync(
        `INSERT INTO envois_en_attente
            (id, chemin, methode, corps, besoin_jeton, service, reference, cree_le, tentatives, prochaine_le, derniere_err)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        identifiant(),
        d.chemin,
        d.methode ?? 'POST',
        JSON.stringify(d.corps),
        d.besoinJeton === false ? 0 : 1,
        d.service ?? null,
        d.reference ?? null,
        Date.now(),
        Date.now() + attente(1),
        erreur.slice(0, 300),
    )
}

/** Exécute l'appel. Renvoie une erreur lisible, ou `null` si le serveur a pris. */
async function tenter(chemin: string, corps: string, besoinJeton: boolean, methode: string): Promise<string | null> {
    try {
        const entetes: Record<string, string> = { 'Content-Type': 'application/json' }
        if (besoinJeton) Object.assign(entetes, await authHeaders())

        const res = await fetchWithTimeout(`${API_BASE}${chemin}`, {
            method: methode,
            headers: entetes,
            body: corps,
            timeoutMs: DELAI_REQUETE_MS,
        })

        if (res.ok) return null

        /* Une requête refusée sur le fond ne deviendra jamais valide en la
           répétant. On la retient tout de même en base — la trace du paiement
           vaut mieux qu'un silence — mais sans la rejouer indéfiniment. */
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
            const detail = await res.text().catch(() => '')
            return `definitif ${res.status} ${detail.slice(0, 200)}`
        }
        return `serveur ${res.status}`
    } catch (e) {
        return e instanceof Error ? e.message : 'réseau'
    }
}

/**
 * Envoie maintenant ; en cas d'échec, met en file et réessaiera tout seul.
 *
 * Ne rejette jamais : l'appelant vient d'encaisser un paiement, une exception
 * à cet endroit ferait plus de dégâts que l'échec lui-même. La valeur de
 * retour dit si le serveur a pris la main immédiatement.
 */
export async function envoyerOuMettreEnFile(d: DemandeEnvoi): Promise<{ transmis: boolean }> {
    const corps = JSON.stringify(d.corps)
    const erreur = await tenter(d.chemin, corps, d.besoinJeton !== false, d.methode ?? 'POST')
    if (!erreur) return { transmis: true }

    try {
        await inscrire(d, erreur)
    } catch {
        /* La base locale est indisponible : il ne reste rien à tenter ici.
           L'écran appelant affiche déjà la référence de transaction au
           client, qui reste la preuve du paiement. */
    }
    return { transmis: false }
}

/* ── Rejeu ────────────────────────────────────────────────── */

let enCours = false

/** Rejoue les envois dont l'heure est venue. Sûr à appeler souvent. */
export async function rejouerFile(): Promise<{ transmis: number; restants: number }> {
    if (enCours) return { transmis: 0, restants: 0 }
    enCours = true
    let transmis = 0

    try {
        const etat = await NetInfo.fetch().catch(() => null)
        if (etat && etat.isConnected === false) return { transmis: 0, restants: await compter() }

        const db = await ouvrirBase()
        const lots = await db.getAllAsync<EnvoiEnAttente>(
            `SELECT * FROM envois_en_attente
              WHERE prochaine_le <= ? AND tentatives < ?
              ORDER BY cree_le ASC LIMIT 20`,
            Date.now(), TENTATIVES_MAX,
        )

        for (const envoi of lots) {
            const erreur = await tenter(envoi.chemin, envoi.corps, envoi.besoin_jeton === 1, envoi.methode || 'POST')

            if (!erreur) {
                await db.runAsync('DELETE FROM envois_en_attente WHERE id = ?', envoi.id)
                transmis++
                continue
            }

            /* Refus définitif : on arrête d'insister sans effacer la trace. */
            const tentatives = erreur.startsWith('definitif ') ? TENTATIVES_MAX : envoi.tentatives + 1
            await db.runAsync(
                'UPDATE envois_en_attente SET tentatives = ?, prochaine_le = ?, derniere_err = ? WHERE id = ?',
                tentatives, Date.now() + attente(tentatives), erreur.slice(0, 300), envoi.id,
            )
        }
    } catch {
        // Rien à signaler : la prochaine occasion relancera le cycle.
    } finally {
        enCours = false
    }

    return { transmis, restants: await compter() }
}

/** Nombre d'envois encore rejouables. */
export async function compter(): Promise<number> {
    try {
        const db = await ouvrirBase()
        const l = await db.getFirstAsync<{ n: number }>(
            'SELECT COUNT(*) AS n FROM envois_en_attente WHERE tentatives < ?', TENTATIVES_MAX,
        )
        return l?.n ?? 0
    } catch {
        return 0
    }
}

/** Envois auxquels on a renoncé : à montrer, jamais à cacher. */
export async function envoisAbandonnes(): Promise<EnvoiEnAttente[]> {
    try {
        const db = await ouvrirBase()
        return await db.getAllAsync<EnvoiEnAttente>(
            'SELECT * FROM envois_en_attente WHERE tentatives >= ? ORDER BY cree_le DESC', TENTATIVES_MAX,
        )
    } catch {
        return []
    }
}

/* ── Déclenchement automatique ────────────────────────────── */

let branchee = false

/**
 * Branche le rejeu sur le retour du réseau et le retour au premier plan.
 * À appeler UNE fois, au démarrage de l'application.
 */
export function surveillerFile(): () => void {
    if (branchee) return () => undefined
    branchee = true

    void rejouerFile()

    const surReseau = NetInfo.addEventListener((etat) => {
        if (etat.isConnected) void rejouerFile()
    })

    const surEtat = AppState.addEventListener('change', (s: AppStateStatus) => {
        if (s === 'active') void rejouerFile()
    })

    return () => {
        surReseau()
        surEtat.remove()
        branchee = false
    }
}
