/* ═══════════════════════════════════════════════════════════
   Base locale — SQLite (expo-sqlite).

   Jusqu'ici, chaque écran repartait du réseau : ouvrir « Dossier » sans
   connexion donnait une liste vide, et rouvrir l'onglet une minute plus tard
   refaisait la même requête. Pour une diaspora sur réseau irrégulier, c'est
   une application qui a l'air cassée alors qu'elle attend simplement.

   Ici, les données STRUCTURÉES vivent sur le téléphone. L'écran lit d'abord la
   base — instantanément, hors ligne compris — puis le réseau vient rafraîchir
   en arrière-plan. Les préférences et le cache de traduction, eux, restent
   dans MMKV (`src/lib/stockage.ts`) : ce sont des clés-valeurs, pas des tables.

   CONVENTION DE SCHÉMA. Chaque table porte :
     · des colonnes réelles pour ce qu'on TRIE ou FILTRE en SQL ;
     · une colonne `charge_utile` qui garde l'objet complet de l'API.
   Ainsi un nouveau champ côté serveur n'exige aucune migration, et les écrans
   continuent de recevoir exactement la forme qu'ils attendaient du réseau.

   CLOISONNEMENT. Toute donnée personnelle porte `client_id`, et les lectures
   filtrent dessus : sur un téléphone partagé, changer de compte ne montre pas
   les dossiers du précédent. `oublierClient()` efface tout à la déconnexion.
═══════════════════════════════════════════════════════════ */
import * as SQLite from 'expo-sqlite'

const NOM_BASE = 'rgb.db'

/** Version du schéma. À incrémenter en AJOUTANT une migration ci-dessous. */
const VERSION_SCHEMA = 2

let instance: SQLite.SQLiteDatabase | null = null
let ouverture: Promise<SQLite.SQLiteDatabase> | null = null

/**
 * Ouvre la base (une seule fois, même si dix écrans la demandent en même
 * temps) et applique les migrations manquantes.
 */
export function ouvrirBase(): Promise<SQLite.SQLiteDatabase> {
    if (instance) return Promise.resolve(instance)
    if (ouverture) return ouverture

    ouverture = (async () => {
        const db = await SQLite.openDatabaseAsync(NOM_BASE)

        /* WAL : lectures et écritures cessent de se bloquer mutuellement —
           un rafraîchissement en arrière-plan ne fige plus la liste affichée. */
        await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')

        await migrer(db)

        instance = db
        return db
    })()

    /* Un échec ne doit pas condamner l'application à ne plus jamais réessayer :
       on relâche la promesse mémorisée pour permettre une nouvelle tentative. */
    ouverture.catch(() => { ouverture = null })

    return ouverture
}

async function migrer(db: SQLite.SQLiteDatabase): Promise<void> {
    const ligne = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')
    const version = ligne?.user_version ?? 0
    if (version >= VERSION_SCHEMA) return

    if (version < 1) {
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS services (
                slug          TEXT PRIMARY KEY NOT NULL,
                titre         TEXT,
                ordre         INTEGER DEFAULT 0,
                actif         INTEGER DEFAULT 1,
                charge_utile  TEXT NOT NULL,
                maj           INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dossiers (
                id            TEXT PRIMARY KEY NOT NULL,
                client_id     TEXT NOT NULL,
                statut        TEXT,
                progression   INTEGER DEFAULT 0,
                service_type  TEXT,
                cree_le       TEXT,
                maj_le        TEXT,
                charge_utile  TEXT NOT NULL,
                maj           INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_dossiers_client ON dossiers (client_id, cree_le DESC);

            CREATE TABLE IF NOT EXISTS factures (
                id            TEXT PRIMARY KEY NOT NULL,
                client_id     TEXT NOT NULL,
                numero        TEXT,
                total         REAL DEFAULT 0,
                devise        TEXT DEFAULT 'XOF',
                statut        TEXT,
                emise_le      TEXT,
                charge_utile  TEXT NOT NULL,
                maj           INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_factures_client ON factures (client_id, emise_le DESC);

            CREATE TABLE IF NOT EXISTS notifications (
                id            TEXT PRIMARY KEY NOT NULL,
                client_id     TEXT NOT NULL,
                titre         TEXT,
                lu            INTEGER DEFAULT 0,
                cree_le       TEXT,
                charge_utile  TEXT NOT NULL,
                maj           INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_client ON notifications (client_id, cree_le DESC);

            CREATE TABLE IF NOT EXISTS evenements (
                id            TEXT PRIMARY KEY NOT NULL,
                titre         TEXT,
                debut_le      TEXT,
                charge_utile  TEXT NOT NULL,
                maj           INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_evenements_debut ON evenements (debut_le);

            -- Quand chaque jeu de données a été rafraîchi pour la dernière fois :
            -- c'est ce qui permet de dire « mis à jour il y a 3 minutes » et
            -- d'éviter de rappeler le réseau pour rien.
            CREATE TABLE IF NOT EXISTS synchros (
                cle   TEXT PRIMARY KEY NOT NULL,
                maj   INTEGER NOT NULL
            );
        `)
    }

    if (version < 2) {
        /* ── TRADUCTIONS ──────────────────────────────────────────
           Elles vivaient uniquement dans MMKV, sous forme d'UN SEUL objet JSON
           par langue. Conséquence : chaque lot reçu du serveur réécrivait la
           TOTALITÉ du cache — plus l'utilisateur traduisait, plus chaque
           nouvelle phrase coûtait cher à enregistrer. C'est exactement le
           défaut qu'on avait corrigé en quittant AsyncStorage, et il avait
           survécu au déménagement.

           En base, une phrase traduite est une LIGNE : on n'écrit que les
           nouvelles, le reste ne bouge pas. La clé primaire (langue, source)
           rend l'insertion idempotente.

           MMKV n'est pas abandonné pour autant : il garde le cache de la langue
           courante pour que le premier rendu soit traduit SANS attendre une
           lecture asynchrone — c'est ce qui supprime l'éclair de français au
           lancement. SQLite est la mémoire longue, MMKV la mémoire immédiate. */
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS traductions (
                langue  TEXT NOT NULL,
                source  TEXT NOT NULL,
                cible   TEXT NOT NULL,
                maj     INTEGER NOT NULL,
                PRIMARY KEY (langue, source)
            );

            CREATE INDEX IF NOT EXISTS idx_traductions_langue ON traductions(langue);
        `)
    }

    await db.execAsync(`PRAGMA user_version = ${VERSION_SCHEMA}`)
}

/* ── Fraîcheur ────────────────────────────────────────────── */

export async function marquerSynchro(cle: string): Promise<void> {
    const db = await ouvrirBase()
    await db.runAsync(
        'INSERT INTO synchros (cle, maj) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET maj = excluded.maj',
        cle, Date.now(),
    )
}

/** Millisecondes écoulées depuis le dernier rafraîchissement, `null` si jamais. */
export async function ageSynchro(cle: string): Promise<number | null> {
    const db = await ouvrirBase()
    const l = await db.getFirstAsync<{ maj: number }>('SELECT maj FROM synchros WHERE cle = ?', cle)
    return l ? Date.now() - l.maj : null
}

/* ── Déconnexion ──────────────────────────────────────────────
   Les données personnelles quittent le téléphone avec le compte. Le catalogue
   des services et les événements sont publics : ils restent, ce qui évite un
   écran vide à la prochaine ouverture. */
export async function oublierClient(clientId?: string): Promise<void> {
    try {
        const db = await ouvrirBase()
        const tables = ['dossiers', 'factures', 'notifications']
        for (const table of tables) {
            if (clientId) await db.runAsync(`DELETE FROM ${table} WHERE client_id = ?`, clientId)
            else await db.runAsync(`DELETE FROM ${table}`)
        }
        await db.runAsync("DELETE FROM synchros WHERE cle LIKE 'dossiers:%' OR cle LIKE 'factures:%' OR cle LIKE 'notifications:%'")
    } catch (e) {
        if (__DEV__) console.warn('[db] purge impossible :', e)
    }
}

/** Utilitaire : relit l'objet complet stocké dans `charge_utile`. */
export function depuisChargeUtile<T>(ligne: { charge_utile: string } | null | undefined): T | null {
    if (!ligne?.charge_utile) return null
    try {
        return JSON.parse(ligne.charge_utile) as T
    } catch {
        return null
    }
}
