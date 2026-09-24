/* ═══════════════════════════════════════════════════════════════════════
   ARCHIVE PERMANENTE DES CLIENTS — la collecte qui tourne seule, chaque nuit

   Le bouton « Exporter » refaisait TOUT à chaque clic : relire la base,
   retélécharger chaque fichier, regénérer chaque PDF, puis renvoyer le ZIP
   dans la réponse. Deux murs :
     · le temps : 5 minutes maximum par requête ;
     · la taille : une réponse Vercel est plafonnée à ~4,5 Mo. L'archive
       complète pèse déjà ~60 Mo, et cinq clients dépassent seuls 4 Mo —
       leur export ne pouvait pas aboutir.

   Désormais, chaque nuit (01h00 UTC, AVANT la purge des pièces traitées de
   02h00) :
     1. collecte complète (aggregate.ts) ;
     2. EMPREINTE de chaque client : seuls les nouveaux ou modifiés voient
        leur dossier reconstruit, 4 à la fois ;
     3. chaque dossier est rangé dans `sauvegardes/clients/<clé>.zip` ;
     4. l'ARCHIVE COMPLÈTE est assemblée en parties de 38 Mo au plus (le
        stockage refuse un fichier de plus de 50 Mo) : `complet/…` ;
     5. un instantané daté de toutes les données (`historique/…json.gz`),
        conservé 30 jours ;
     6. un MANIFESTE décrit l'état.

   « Exporter » ne renvoie plus de fichier : il renvoie des LIENS signés vers
   les parties, que le navigateur télécharge directement depuis le stockage.
   Si rien n'a changé depuis la nuit, c'est instantané.
═══════════════════════════════════════════════════════════════════════ */
import { gzipSync } from 'zlib'
import { createHash, randomBytes } from 'crypto'
import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
    collecter, empreinte, clientKey, cleStockage, toSummary, matchesKey,
    type Collecte, type LigneRapport, type ClientSummary, type ClientRecord,
} from './aggregate'
import {
    construireZipClient, fillClientFolder, folderName, masquer, sommaireHtml, csvIndex,
    rapportHtml, ajouterNonRattachees, lisezMoi,
} from './dossier-client'

export const BUCKET_SAUVEGARDES = 'sauvegardes'
const CHEMIN_MANIFESTE = 'manifeste.json'
const JOURS_HISTORIQUE = 30
/** Taille brute maximale d'une partie. Le stockage refuse au-delà de 50 Mo. */
const TAILLE_PARTIE = 38 * 1024 * 1024
/** Durée de validité d'un lien de téléchargement. */
const VALIDITE_LIEN_S = 3600

export interface EntreeManifeste {
    key: string
    stockage: string
    dossier: string
    empreinte: string
    construit_le: string
    taille: number
    resume: ClientSummary
    fichiers_manquants: string[]
    pdf_non_generes: string[]
}

export interface ArchiveComplete {
    empreinte_globale: string
    construit_le: string
    parties: { chemin: string; taille: number }[]
    clients: number
}

export interface Manifeste {
    version: 1
    derniere_collecte: string
    duree_ms: number
    origine: 'nuit' | 'manuel'
    clients: EntreeManifeste[]
    /** Clients qui n'ont pas pu être reconstruits dans le temps imparti : repris au passage suivant. */
    en_attente: string[]
    rapport: LigneRapport[]
    non_couvertes: Collecte['nonCouvertes']
    exclusions: Collecte['exclusions']
    non_rattachees: Record<string, number>
    historique: string | null
    complet: ArchiveComplete | null
    erreurs: string[]
}

/* ─────────────── Outils ─────────────── */

async function enParallele<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
    let i = 0
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
        while (i < items.length) await fn(items[i++])
    }))
}

/** Crée le bucket PRIVÉ s'il n'existe pas. Jamais public : ce sont des données personnelles. */
export async function assurerBucket(sb: SupabaseClient): Promise<void> {
    const { data } = await sb.storage.getBucket(BUCKET_SAUVEGARDES)
    if (data) {
        if (data.public) await sb.storage.updateBucket(BUCKET_SAUVEGARDES, { public: false })
        return
    }
    const { error } = await sb.storage.createBucket(BUCKET_SAUVEGARDES, { public: false })
    if (error && !/already exists/i.test(error.message)) throw new Error(`Création du stockage impossible : ${error.message}`)
}

export async function lireManifeste(sb: SupabaseClient): Promise<Manifeste | null> {
    try {
        const { data, error } = await sb.storage.from(BUCKET_SAUVEGARDES).download(CHEMIN_MANIFESTE)
        if (error || !data) return null
        const m = JSON.parse(await data.text()) as Manifeste
        return m?.version === 1 ? { ...m, complet: m.complet ?? null } : null
    } catch {
        return null
    }
}

async function deposer(sb: SupabaseClient, chemin: string, contenu: Buffer | string, type: string) {
    const { error } = await sb.storage
        .from(BUCKET_SAUVEGARDES)
        .upload(chemin, typeof contenu === 'string' ? Buffer.from(contenu, 'utf8') : contenu, { contentType: type, upsert: true })
    if (error) throw new Error(`${chemin} : ${error.message}`)
}

export async function telechargerZipClient(sb: SupabaseClient, stockage: string): Promise<Buffer | null> {
    try {
        const { data, error } = await sb.storage.from(BUCKET_SAUVEGARDES).download(`clients/${stockage}.zip`)
        if (error || !data) return null
        return Buffer.from(await data.arrayBuffer())
    } catch {
        return null
    }
}

async function supprimerDossier(sb: SupabaseClient, prefixe: string) {
    // Garde-fou : seuls les sous-dossiers d'exports et d'archives complètes
    // se suppriment. Un préfixe vide viderait la racine — manifeste compris.
    if (!/^(exports|complet)\/[^/]+$/.test(prefixe)) return
    const { data } = await sb.storage.from(BUCKET_SAUVEGARDES).list(prefixe, { limit: 1000 })
    const chemins = (data || []).filter(f => f.id).map(f => `${prefixe}/${f.name}`)
    if (chemins.length) await sb.storage.from(BUCKET_SAUVEGARDES).remove(chemins)
}

/**
 * Empreinte de l'ENSEMBLE : change dès qu'un client, ou une ligne sans
 * client, change. L'archive complète n'est réutilisable que si elle est
 * identique.
 */
export function empreinteGlobale(collecte: Collecte): string {
    const h = createHash('sha256')
    for (const rec of [...collecte.clients].sort((a, b) => clientKey(a).localeCompare(clientKey(b)))) {
        h.update(`${clientKey(rec)}=${empreinte(rec)};`)
    }
    h.update(JSON.stringify(collecte.nonRattachees))
    return h.digest('hex')
}

/* ─────────────── Collecte incrémentale ─────────────── */

/**
 * Passe de collecte complète, incrémentale.
 *
 * `budgetMs` : temps maximal consacré à reconstruire des dossiers. Au-delà,
 * les clients restants sont notés `en_attente` et repris au passage suivant
 * — plutôt qu'une coupure brutale du serveur qui ne laisserait rien d'écrit.
 */
export async function executerCollecte(
    sb: SupabaseClient,
    opts: { origine: 'nuit' | 'manuel'; budgetMs?: number; forcer?: boolean } = { origine: 'nuit' },
): Promise<{ manifeste: Manifeste; reconstruits: number; inchanges: number; collecte: Collecte }> {
    const debut = Date.now()
    const budget = opts.budgetMs ?? 200_000
    const erreurs: string[] = []

    await assurerBucket(sb)
    const precedent = await lireManifeste(sb)
    const avant = new Map((precedent?.clients || []).map(e => [e.key, e]))

    const collecte = await collecter(sb)

    const entrees: EntreeManifeste[] = []
    const enAttente: string[] = []
    let reconstruits = 0
    let inchanges = 0

    // Les clients jamais archivés passent en premier : ce sont eux qui n'existent nulle part.
    const ordre = [...collecte.clients].sort((a, b) => Number(avant.has(clientKey(a))) - Number(avant.has(clientKey(b))))
    const aConstruire: ClientRecord[] = []
    for (const rec of ordre) {
        const ancien = avant.get(clientKey(rec))
        if (!opts.forcer && ancien && ancien.empreinte === empreinte(rec)) {
            entrees.push({ ...ancien, resume: toSummary(rec), dossier: folderName(rec) })
            inchanges++
        } else {
            aConstruire.push(rec)
        }
    }

    /* Construction PARALLÈLE (4 dossiers à la fois) : chaque dossier attend
       surtout le réseau — téléchargement des pièces, dépôt du zip. */
    await enParallele(aConstruire, 4, async rec => {
        const key = clientKey(rec)
        const ancien = avant.get(key)
        const resume = toSummary(rec)
        if (Date.now() - debut > budget) {
            enAttente.push(key)
            // L'ancienne archive reste disponible en attendant ; son empreinte la dit périmée.
            if (ancien) entrees.push({ ...ancien, resume })
            return
        }
        try {
            const { zip, bilan } = await construireZipClient(sb, rec)
            const stockage = cleStockage(rec)
            await deposer(sb, `clients/${stockage}.zip`, zip, 'application/zip')
            entrees.push({
                key, stockage, dossier: folderName(rec), empreinte: empreinte(rec),
                construit_le: new Date().toISOString(), taille: zip.length, resume,
                fichiers_manquants: bilan.fichiers.manquants.map(m => `${m.libelle} (${m.source})`),
                pdf_non_generes: bilan.pdfEchoues,
            })
            reconstruits++
        } catch (e) {
            erreurs.push(`${key} : ${e instanceof Error ? e.message : String(e)}`)
            if (ancien) entrees.push({ ...ancien, resume })
            else enAttente.push(key)
        }
    })

    /* Un client disparu de la base (supprimé, anonymisé) garde son archive :
       c'est précisément le cas où une sauvegarde sert. */
    const presents = new Set(entrees.map(e => e.key))
    for (const ancien of precedent?.clients || []) {
        if (!presents.has(ancien.key) && !enAttente.includes(ancien.key)) entrees.push(ancien)
    }

    // Instantané daté de TOUTES les données (clients + lignes non rattachées).
    const jour = new Date().toISOString().slice(0, 10)
    let historique: string | null = null
    try {
        const instantane = gzipSync(Buffer.from(JSON.stringify(masquer({
            genere_le: collecte.genere_le,
            clients: collecte.clients,
            non_rattachees: collecte.nonRattachees,
            rapport: collecte.rapport,
        }))))
        historique = `historique/${jour}.json.gz`
        await deposer(sb, historique, instantane, 'application/gzip')
        await purgerAnciens(sb, 'historique', JOURS_HISTORIQUE)
        await purgerAnciens(sb, 'exports', 1)
    } catch (e) {
        erreurs.push(`Instantané quotidien : ${e instanceof Error ? e.message : String(e)}`)
    }

    const manifeste: Manifeste = {
        version: 1,
        derniere_collecte: new Date().toISOString(),
        duree_ms: Date.now() - debut,
        origine: opts.origine,
        clients: entrees,
        en_attente: enAttente,
        rapport: collecte.rapport,
        non_couvertes: collecte.nonCouvertes,
        exclusions: collecte.exclusions,
        non_rattachees: Object.fromEntries(Object.entries(collecte.nonRattachees).map(([t, r]) => [t, r.length])),
        historique,
        complet: precedent?.complet ?? null,
        erreurs,
    }

    /* Archive complète : seulement si TOUS les dossiers sont prêts et qu'il
       reste du temps — sinon l'export la construira à la demande. */
    if (!enAttente.length && Date.now() - debut < budget) {
        const glob = empreinteGlobale(collecte)
        if (opts.forcer || manifeste.complet?.empreinte_globale !== glob) {
            try {
                const res = await construireArchive(sb, collecte, manifeste, { prefixe: `complet/${Date.now()}` })
                if (!res.nonInclus.length) {
                    const ancien = manifeste.complet
                    manifeste.complet = {
                        empreinte_globale: glob, construit_le: new Date().toISOString(),
                        parties: res.parties, clients: collecte.clients.length,
                    }
                    if (ancien) await supprimerDossier(sb, ancien.parties[0]?.chemin.split('/').slice(0, 2).join('/') || '')
                }
            } catch (e) {
                erreurs.push(`Archive complète : ${e instanceof Error ? e.message : String(e)}`)
            }
        }
    }

    manifeste.duree_ms = Date.now() - debut
    await deposer(sb, CHEMIN_MANIFESTE, JSON.stringify(manifeste), 'application/json')

    return { manifeste, reconstruits, inchanges, collecte }
}

async function purgerAnciens(sb: SupabaseClient, dossier: string, jours: number) {
    const limite = Date.now() - jours * 86_400_000
    const { data } = await sb.storage.from(BUCKET_SAUVEGARDES).list(dossier, { limit: 1000 })
    const vieux: string[] = []
    for (const f of data || []) {
        // « historique/AAAA-MM-JJ.json.gz » ou sous-dossier « exports/<horodatage>-… »
        const date = /^\d{4}-\d{2}-\d{2}/.test(f.name) ? Date.parse(f.name.slice(0, 10)) : Number(f.name.split('-')[0])
        if (!isFinite(date) || date >= limite) continue
        if (f.id) vieux.push(`${dossier}/${f.name}`)
        else await supprimerDossier(sb, `${dossier}/${f.name}`)
    }
    if (vieux.length) await sb.storage.from(BUCKET_SAUVEGARDES).remove(vieux)
}

export async function listerHistorique(sb: SupabaseClient): Promise<{ nom: string; taille: number }[]> {
    const { data } = await sb.storage.from(BUCKET_SAUVEGARDES).list('historique', { limit: 1000, sortBy: { column: 'name', order: 'desc' } })
    return (data || []).map(f => ({ nom: f.name, taille: Number((f.metadata as { size?: number } | null)?.size || 0) }))
}

/* ─────────────── Assemblage d'une archive (complète ou un client) ─────────────── */

interface Fichier { chemin: string; octets: Buffer }

/** Fichiers d'un client, sous le dossier racine voulu. */
async function fichiersClient(
    sb: SupabaseClient, rec: ClientRecord, racine: string, archive: EntreeManifeste | undefined,
): Promise<{ fichiers: Fichier[]; repris: boolean; manquants: string[] }> {
    if (archive && archive.empreinte === empreinte(rec)) {
        const buf = await telechargerZipClient(sb, archive.stockage)
        if (buf) {
            const z = await JSZip.loadAsync(buf)
            const fichiers: Fichier[] = []
            for (const f of Object.values(z.files)) {
                if (f.dir) continue
                const relatif = f.name.includes('/') ? f.name.slice(f.name.indexOf('/') + 1) : f.name
                fichiers.push({ chemin: `${racine}/${relatif}`, octets: await f.async('nodebuffer') })
            }
            if (fichiers.length) return { fichiers, repris: true, manquants: archive.fichiers_manquants }
        }
    }
    const tmp = new JSZip()
    const bilan = await fillClientFolder(sb, tmp.folder(racine)!, rec)
    const fichiers: Fichier[] = []
    for (const f of Object.values(tmp.files)) if (!f.dir) fichiers.push({ chemin: f.name, octets: await f.async('nodebuffer') })
    return { fichiers, repris: false, manquants: bilan.fichiers.manquants.map(m => `${m.libelle} (${m.source})`) }
}

/**
 * Répartit des groupes de fichiers (un groupe = un client) en parties d'au
 * plus TAILLE_PARTIE. Un client reste entier dans une partie quand c'est
 * possible ; un client plus gros qu'une partie est réparti fichier par
 * fichier — il n'est jamais écarté.
 */
function repartir(groupes: { cle: string; fichiers: Fichier[] }[]): { cle: string; fichiers: Fichier[] }[][] {
    const parties: { cle: string; fichiers: Fichier[] }[][] = [[]]
    const poids = (fs: Fichier[]) => fs.reduce((n, f) => n + f.octets.length, 0)
    let courant = 0
    for (const g of groupes) {
        const p = poids(g.fichiers)
        if (courant + p <= TAILLE_PARTIE) { parties[parties.length - 1].push(g); courant += p; continue }
        if (p <= TAILLE_PARTIE) { parties.push([g]); courant = p; continue }
        // Client plus gros qu'une partie : ses fichiers sont répartis.
        let morceau: Fichier[] = []
        let m = 0
        if (courant > 0) { parties.push([]); courant = 0 }
        for (const f of g.fichiers) {
            if (m + f.octets.length > TAILLE_PARTIE && morceau.length) {
                parties[parties.length - 1].push({ cle: g.cle, fichiers: morceau })
                parties.push([]); morceau = []; m = 0
            }
            morceau.push(f); m += f.octets.length
        }
        parties[parties.length - 1].push({ cle: g.cle, fichiers: morceau })
        courant = m
    }
    return parties.filter(p => p.length)
}

export interface ResultatArchive {
    parties: { chemin: string; taille: number }[]
    repris: number
    reconstruits: number
    nonInclus: string[]
}

/**
 * Construit l'archive (tous les clients, ou `cibles`) en parties, et les
 * dépose sous `prefixe/`. Chaque partie est autonome : sommaire, rapport et
 * liste des clients y figurent, avec la partie où se trouve chaque client.
 */
export async function construireArchive(
    sb: SupabaseClient,
    collecte: Collecte,
    manifeste: Manifeste | null,
    opts: { prefixe: string; cibles?: ClientRecord[]; budgetMs?: number },
): Promise<ResultatArchive> {
    const debut = Date.now()
    const cibles = opts.cibles || collecte.clients
    const complete = !opts.cibles
    const archives = new Map((manifeste?.clients || []).map(e => [e.key, e]))

    // Noms de dossier uniques : deux homonymes sans e-mail ne s'écrasent pas.
    const dossiers = new Map<ClientRecord, string>()
    const pris = new Set<string>()
    for (const rec of cibles) {
        let nom = folderName(rec)
        let i = 2
        while (pris.has(nom.toLowerCase())) nom = `${folderName(rec)} (${i++})`
        pris.add(nom.toLowerCase())
        dossiers.set(rec, nom)
    }

    const groupes = new Map<ClientRecord, Fichier[]>()
    const manquants: { client: string; fichiers: string[] }[] = []
    const nonInclus: string[] = []
    let repris = 0
    let reconstruits = 0
    const nomDe = (rec: ClientRecord) => [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.email || rec.phone

    await enParallele(cibles, 8, async rec => {
        if (opts.budgetMs && Date.now() - debut > opts.budgetMs) {
            nonInclus.push(`${nomDe(rec)} <${rec.email || rec.phone}>`)
            return
        }
        try {
            const r = await fichiersClient(sb, rec, dossiers.get(rec)!, archives.get(clientKey(rec)))
            groupes.set(rec, r.fichiers)
            if (r.repris) repris++; else reconstruits++
            if (r.manquants.length) manquants.push({ client: nomDe(rec), fichiers: r.manquants })
        } catch (e) {
            nonInclus.push(`${nomDe(rec)} <${rec.email || rec.phone}> — ${e instanceof Error ? e.message : 'erreur'}`)
        }
    })

    // Ordre du sommaire conservé dans les parties.
    const inclus = cibles.filter(rec => groupes.has(rec))
    const parties = repartir(inclus.map(rec => ({ cle: clientKey(rec), fichiers: groupes.get(rec)! })))
    const partieDe = new Map<string, number[]>()
    parties.forEach((p, i) => p.forEach(g => partieDe.set(g.cle, [...(partieDe.get(g.cle) || []), i + 1])))
    const libellePartie = new Map<ClientRecord, string>(
        inclus.map(rec => [rec, (partieDe.get(clientKey(rec)) || []).join(' + ')]),
    )

    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const n = parties.length
    const sorties: { chemin: string; taille: number }[] = []
    const origine = `${repris} dossier(s) repris de la collecte automatique, ${reconstruits} reconstruit(s)`

    for (let i = 0; i < n; i++) {
        const zip = new JSZip()
        for (const g of parties[i]) for (const f of g.fichiers) zip.file(f.chemin, f.octets)
        zip.file('LISEZ-MOI.txt', lisezMoi(inclus.length, collecte.genere_le)
            + (n > 1 ? `\n\nCETTE SAUVEGARDE EST EN ${n} PARTIES — celle-ci est la partie ${i + 1}.\nLe sommaire indique, pour chaque client, la partie qui contient son dossier.\nDécompressez toutes les parties dans le même dossier.` : ''))
        zip.file('_SOMMAIRE.html', sommaireHtml(inclus, dossiers, n > 1 ? libellePartie : undefined))
        zip.file('Liste_clients.csv', csvIndex(inclus))
        zip.file('RAPPORT DE COLLECTE.html', rapportHtml(collecte, manquants, origine))
        if (complete && i === 0) ajouterNonRattachees(zip, collecte.nonRattachees)
        if (nonInclus.length) {
            zip.file('EXPORT INCOMPLET.txt', [
                'ATTENTION — CET EXPORT EST INCOMPLET', '',
                `${nonInclus.length} client(s) n'ont pas pu être inclus :`,
                ...nonInclus.map(x => `  • ${x}`), '',
                'Cliquez sur « Actualiser maintenant » dans l’onglet Sauvegarde, puis relancez l’export.',
            ].join('\n'))
        }
        const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        const nom = complete
            ? `sauvegarde-clients-RGB-${stamp}${n > 1 ? `-partie-${i + 1}-sur-${n}` : ''}.zip`
            : `sauvegarde-${folderName(cibles[0]).replace(/[^\w\-. ()@]+/g, '_')}-${stamp}${n > 1 ? `-partie-${i + 1}` : ''}.zip`
        const chemin = `${opts.prefixe}/${nom}`
        await deposer(sb, chemin, buf, 'application/zip')
        sorties.push({ chemin, taille: buf.length })
    }

    return { parties: sorties, repris, reconstruits, nonInclus }
}

/** Liens de téléchargement signés (1 h) vers des parties déposées. */
export async function signer(sb: SupabaseClient, parties: { chemin: string; taille: number }[]) {
    const out: { nom: string; url: string; taille: number }[] = []
    for (const p of parties) {
        const nom = p.chemin.split('/').pop() || 'sauvegarde.zip'
        const { data, error } = await sb.storage.from(BUCKET_SAUVEGARDES).createSignedUrl(p.chemin, VALIDITE_LIEN_S, { download: nom })
        if (error || !data) throw new Error(`Lien de téléchargement impossible (${nom}) : ${error?.message || 'inconnu'}`)
        out.push({ nom, url: data.signedUrl, taille: p.taille })
    }
    return out
}

/**
 * Export demandé depuis le panel. Toujours sur des données relues en
 * direct. L'archive complète préparée la nuit est servie telle quelle si
 * elle correspond encore exactement à la base ; sinon elle est reconstruite
 * (en réutilisant chaque dossier client resté identique) et remplace
 * l'ancienne, pour que le clic suivant soit instantané.
 */
export async function exporter(sb: SupabaseClient, opts: { cle?: string } = {}) {
    await assurerBucket(sb)
    const collecte = await collecter(sb)
    const manifeste = await lireManifeste(sb)

    if (opts.cle) {
        const rec = collecte.clients.find(r => matchesKey(r, opts.cle!))
        if (!rec) return null
        const res = await construireArchive(sb, collecte, manifeste, {
            prefixe: `exports/${Date.now()}-${randomBytes(6).toString('hex')}`, cibles: [rec],
        })
        return { ...res, liens: await signer(sb, res.parties), deja_pret: false, clients: 1 }
    }

    const glob = empreinteGlobale(collecte)
    if (manifeste?.complet?.empreinte_globale === glob) {
        try {
            return {
                parties: manifeste.complet.parties, repris: manifeste.complet.clients, reconstruits: 0, nonInclus: [],
                liens: await signer(sb, manifeste.complet.parties), deja_pret: true, clients: manifeste.complet.clients,
            }
        } catch { /* parties absentes : on reconstruit */ }
    }

    const res = await construireArchive(sb, collecte, manifeste, { prefixe: `complet/${Date.now()}`, budgetMs: 200_000 })
    if (!res.nonInclus.length && manifeste) {
        const ancien = manifeste.complet
        manifeste.complet = { empreinte_globale: glob, construit_le: new Date().toISOString(), parties: res.parties, clients: collecte.clients.length }
        await deposer(sb, CHEMIN_MANIFESTE, JSON.stringify(manifeste), 'application/json')
        if (ancien) await supprimerDossier(sb, ancien.parties[0]?.chemin.split('/').slice(0, 2).join('/') || '')
    }
    return { ...res, liens: await signer(sb, res.parties), deja_pret: false, clients: collecte.clients.length }
}
