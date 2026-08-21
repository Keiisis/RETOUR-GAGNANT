/* ═══════════════════════════════════════════════════════════
   Dépôts — ce que chaque écran lit et écrit dans la base locale.

   Une règle, tenue partout : le miroir local REMPLACE le jeu de données reçu
   du serveur, il ne le complète pas. Sans cela, un dossier annulé côté agence
   ou une facture supprimée resteraient visibles indéfiniment sur le téléphone.
   La suppression et les insertions se font dans une seule transaction : à
   aucun moment l'écran ne peut lire une liste à moitié effacée.

   Le serveur reste la vérité. La base locale ne fait que se souvenir de la
   dernière vérité connue — pour l'afficher tout de suite, et hors ligne.
═══════════════════════════════════════════════════════════ */
import { ouvrirBase, marquerSynchro, depuisChargeUtile } from './base'

/** Toute entité venue de l'API porte au moins un identifiant. */
interface AvecId { id?: string | number | null }

const texte = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v)

const nombre = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

/* ── SERVICES (catalogue public) ──────────────────────────── */

export interface ServiceLocal { slug: string }

export async function lireServices<T = Record<string, unknown>>(): Promise<T[]> {
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ charge_utile: string }>(
            'SELECT charge_utile FROM services WHERE actif = 1 ORDER BY ordre ASC, titre ASC',
        )
        return lignes.map(l => depuisChargeUtile<T>(l)).filter((x): x is T => x !== null)
    } catch {
        return []
    }
}

export async function enregistrerServices(
    liste: Array<Record<string, unknown>>,
): Promise<void> {
    if (!Array.isArray(liste)) return
    try {
        const db = await ouvrirBase()
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM services')
            for (const s of liste) {
                const slug = texte(s.slug ?? s.id)
                if (!slug) continue
                await db.runAsync(
                    'INSERT OR REPLACE INTO services (slug, titre, ordre, actif, charge_utile, maj) VALUES (?, ?, ?, ?, ?, ?)',
                    slug,
                    texte(s.title ?? s.titre),
                    nombre(s.order_index ?? s.ordre),
                    s.is_active === false ? 0 : 1,
                    JSON.stringify(s),
                    Date.now(),
                )
            }
        })
        await marquerSynchro('services')
    } catch (e) {
        if (__DEV__) console.warn('[depots] services non enregistrés :', e)
    }
}

/* ── DOSSIERS (par client) ────────────────────────────────── */

export async function lireDossiers<T = Record<string, unknown>>(clientId: string): Promise<T[]> {
    if (!clientId) return []
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ charge_utile: string }>(
            'SELECT charge_utile FROM dossiers WHERE client_id = ? ORDER BY cree_le DESC',
            clientId,
        )
        return lignes.map(l => depuisChargeUtile<T>(l)).filter((x): x is T => x !== null)
    } catch {
        return []
    }
}

export async function enregistrerDossiers(
    clientId: string,
    liste: Array<Record<string, unknown> & AvecId>,
): Promise<void> {
    if (!clientId || !Array.isArray(liste)) return
    try {
        const db = await ouvrirBase()
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM dossiers WHERE client_id = ?', clientId)
            for (const d of liste) {
                const id = texte(d.id)
                if (!id) continue
                await db.runAsync(
                    `INSERT OR REPLACE INTO dossiers
                     (id, client_id, statut, progression, service_type, cree_le, maj_le, charge_utile, maj)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    id, clientId,
                    texte(d.status ?? d.statut),
                    nombre(d.progress ?? d.progression),
                    texte(d.service_type),
                    texte(d.created_at),
                    texte(d.updated_at),
                    JSON.stringify(d),
                    Date.now(),
                )
            }
        })
        await marquerSynchro(`dossiers:${clientId}`)
    } catch (e) {
        if (__DEV__) console.warn('[depots] dossiers non enregistrés :', e)
    }
}

/* ── FACTURES (par client) ────────────────────────────────── */

export async function lireFactures<T = Record<string, unknown>>(clientId: string): Promise<T[]> {
    if (!clientId) return []
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ charge_utile: string }>(
            'SELECT charge_utile FROM factures WHERE client_id = ? ORDER BY emise_le DESC',
            clientId,
        )
        return lignes.map(l => depuisChargeUtile<T>(l)).filter((x): x is T => x !== null)
    } catch {
        return []
    }
}

export async function enregistrerFactures(
    clientId: string,
    liste: Array<Record<string, unknown> & AvecId>,
): Promise<void> {
    if (!clientId || !Array.isArray(liste)) return
    try {
        const db = await ouvrirBase()
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM factures WHERE client_id = ?', clientId)
            for (const f of liste) {
                const id = texte(f.id)
                if (!id) continue
                await db.runAsync(
                    `INSERT OR REPLACE INTO factures
                     (id, client_id, numero, total, devise, statut, emise_le, charge_utile, maj)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    id, clientId,
                    texte(f.invoice_ref ?? f.numero),
                    nombre(f.amount ?? f.total),
                    texte(f.currency ?? f.devise) || 'XOF',
                    texte(f.status ?? f.statut),
                    texte(f.issued_at ?? f.created_at),
                    JSON.stringify(f),
                    Date.now(),
                )
            }
        })
        await marquerSynchro(`factures:${clientId}`)
    } catch (e) {
        if (__DEV__) console.warn('[depots] factures non enregistrées :', e)
    }
}

/* ── NOTIFICATIONS (par client) ───────────────────────────── */

export async function lireNotifications<T = Record<string, unknown>>(clientId: string): Promise<T[]> {
    if (!clientId) return []
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ charge_utile: string }>(
            'SELECT charge_utile FROM notifications WHERE client_id = ? ORDER BY cree_le DESC LIMIT 200',
            clientId,
        )
        return lignes.map(l => depuisChargeUtile<T>(l)).filter((x): x is T => x !== null)
    } catch {
        return []
    }
}

export async function enregistrerNotifications(
    clientId: string,
    liste: Array<Record<string, unknown> & AvecId>,
): Promise<void> {
    if (!clientId || !Array.isArray(liste)) return
    try {
        const db = await ouvrirBase()
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM notifications WHERE client_id = ?', clientId)
            for (const n of liste) {
                const id = texte(n.id)
                if (!id) continue
                await db.runAsync(
                    `INSERT OR REPLACE INTO notifications
                     (id, client_id, titre, lu, cree_le, charge_utile, maj)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    id, clientId,
                    texte(n.title ?? n.titre),
                    n.is_read || n.lu ? 1 : 0,
                    texte(n.created_at),
                    JSON.stringify(n),
                    Date.now(),
                )
            }
        })
        await marquerSynchro(`notifications:${clientId}`)
    } catch (e) {
        if (__DEV__) console.warn('[depots] notifications non enregistrées :', e)
    }
}

/** Marque une notification lue localement, sans attendre le serveur. */
export async function marquerNotificationLue(id: string): Promise<void> {
    try {
        const db = await ouvrirBase()
        await db.runAsync('UPDATE notifications SET lu = 1 WHERE id = ?', id)
    } catch { /* sans effet visible : le serveur reste la référence */ }
}

/* ── ÉVÉNEMENTS (public) ──────────────────────────────────── */

export async function lireEvenements<T = Record<string, unknown>>(): Promise<T[]> {
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ charge_utile: string }>(
            'SELECT charge_utile FROM evenements ORDER BY debut_le ASC',
        )
        return lignes.map(l => depuisChargeUtile<T>(l)).filter((x): x is T => x !== null)
    } catch {
        return []
    }
}

export async function enregistrerEvenements(
    liste: Array<Record<string, unknown> & AvecId>,
): Promise<void> {
    if (!Array.isArray(liste)) return
    try {
        const db = await ouvrirBase()
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM evenements')
            for (const e of liste) {
                const id = texte(e.id)
                if (!id) continue
                await db.runAsync(
                    'INSERT OR REPLACE INTO evenements (id, titre, debut_le, charge_utile, maj) VALUES (?, ?, ?, ?, ?)',
                    id,
                    texte(e.title ?? e.titre),
                    texte(e.start_date ?? e.date),
                    JSON.stringify(e),
                    Date.now(),
                )
            }
        })
        await marquerSynchro('evenements')
    } catch (e) {
        if (__DEV__) console.warn('[depots] événements non enregistrés :', e)
    }
}

/* ═══════════════════════════════════════════════════════════
   TRADUCTIONS — mémoire longue du téléphone.

   Ces deux fonctions ne REMPLACENT jamais le jeu de données, contrairement aux
   autres dépôts : une traduction déjà obtenue reste valable indéfiniment, et
   l'effacer obligerait à la redemander au serveur pour rien. On n'ajoute donc
   que ce qui manque.
═══════════════════════════════════════════════════════════ */

/** Toutes les traductions connues pour une langue. */
export async function lireTraductions(langue: string): Promise<Map<string, string>> {
    const carte = new Map<string, string>()
    try {
        const db = await ouvrirBase()
        const lignes = await db.getAllAsync<{ source: string; cible: string }>(
            'SELECT source, cible FROM traductions WHERE langue = ?',
            langue,
        )
        for (const l of lignes) carte.set(l.source, l.cible)
    } catch (e) {
        if (__DEV__) console.warn('[depots] traductions illisibles :', e)
    }
    return carte
}

/**
 * Ajoute des traductions. Seules les NOUVELLES lignes sont écrites : le reste
 * du cache n'est pas touché, quelle que soit sa taille.
 */
export async function ajouterTraductions(
    langue: string, entrees: Record<string, string>,
): Promise<void> {
    const paires = Object.entries(entrees).filter(([s, c]) => s && c)
    if (paires.length === 0) return
    try {
        const db = await ouvrirBase()
        const maintenant = Date.now()
        await db.withTransactionAsync(async () => {
            for (const [source, cible] of paires) {
                await db.runAsync(
                    'INSERT OR REPLACE INTO traductions (langue, source, cible, maj) VALUES (?, ?, ?, ?)',
                    langue, source, cible, maintenant,
                )
            }
        })
    } catch (e) {
        if (__DEV__) console.warn('[depots] traductions non enregistrées :', e)
    }
}

/** Purge d'une langue — utilisée quand la VERSION de cache change. */
export async function oublierTraductions(langue: string): Promise<void> {
    try {
        const db = await ouvrirBase()
        await db.runAsync('DELETE FROM traductions WHERE langue = ?', langue)
    } catch { /* sans conséquence : le serveur les renverra */ }
}
