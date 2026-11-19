import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

/* Quota Supabase (nov. 2026) : l'archive complète n'est plus conservée.
   L'export dépose sous `exports/` puis s'efface ; la collecte de nuit ne
   produit plus rien sous `complet/` et purge l'ancien. */

const etat = vi.hoisted(() => ({ clients: [] as unknown[] }))

vi.mock('@/lib/backup/aggregate', async (orig) => ({
    ...(await orig<typeof import('@/lib/backup/aggregate')>()),
    collecter: vi.fn(async () => ({
        clients: etat.clients, rapport: [], nonRattachees: {}, exclusions: [], nonCouvertes: [],
        duree_ms: 0, genere_le: new Date().toISOString(),
    })),
}))

// Le dossier d'un client sans lecture de la base : une fiche.
vi.mock('@/lib/backup/dossier-client', async (orig) => ({
    ...(await orig<typeof import('@/lib/backup/dossier-client')>()),
    fillClientFolder: vi.fn(async (_sb: unknown, dir: { file: (n: string, c: string) => void }) => {
        dir.file('fiche.txt', 'Kevin')
        return { fichiers: { manquants: [] }, pdfEchoues: [] }
    }),
}))

const KEVIN = {
    id: null, email: 'kevin@exemple.bj', nom: 'Test', prenom: 'Kevin', phone: '', ville: 'Ouidah', pays: 'Bénin',
    created_at: null, hasAccount: false, profile: null, data: {}, discussions: [],
}

import { executerCollecte, exporter } from '@/lib/backup/archive'

/** Faux bucket : chemin → taille. `list` renvoie fichiers (id) et sous-dossiers (id null). */
function fauxStockage() {
    const fichiers = new Map<string, number>()
    const bucket = {
        async upload(chemin: string, contenu: Buffer | string) {
            fichiers.set(chemin, Buffer.byteLength(contenu)); return { error: null }
        },
        async download(chemin: string) {
            return fichiers.has(chemin) ? { data: new Blob(['{}']), error: null } : { data: null, error: { message: 'absent' } }
        },
        async list(prefixe: string) {
            const vus = new Map<string, boolean>()
            for (const c of fichiers.keys()) {
                if (!c.startsWith(`${prefixe}/`)) continue
                const reste = c.slice(prefixe.length + 1)
                vus.set(reste.split('/')[0], !reste.includes('/'))
            }
            return { data: [...vus].map(([name, estFichier]) => ({ name, id: estFichier ? name : null, metadata: { size: 1 } })), error: null }
        },
        async remove(chemins: string[]) {
            for (const c of chemins) fichiers.delete(c)
            return { error: null }
        },
        async createSignedUrl(chemin: string) {
            return { data: { signedUrl: `https://signe/${chemin}` }, error: null }
        },
    }
    const sb = {
        storage: {
            getBucket: async () => ({ data: { id: 'sauvegardes' }, error: null }),
            createBucket: async () => ({ error: null }),
            from: () => bucket,
        },
    } as unknown as SupabaseClient
    return { sb, fichiers }
}

const HEURE = 3_600_000
const JOUR = 24 * HEURE

describe('sauvegarde — stockage limité', () => {
    let s: ReturnType<typeof fauxStockage>
    beforeEach(() => { s = fauxStockage(); etat.clients = [] })

    it("l'export dépose sous exports/, jamais sous complet/, et efface les exports expirés", async () => {
        const vieux = `exports/${Date.now() - 2 * HEURE}-aaaaaa/partie.zip`
        const recent = `exports/${Date.now() - 10 * 60_000}-bbbbbb/partie.zip`
        s.fichiers.set(vieux, 10).set(recent, 10)
        etat.clients = [KEVIN]

        const res = await exporter(s.sb)
        expect(res).not.toBeNull()
        expect(res!.clients).toBe(1)
        expect(res!.liens).toHaveLength(1)
        expect(res!).not.toHaveProperty('deja_pret')
        expect(res!.parties.every(p => p.chemin.startsWith('exports/'))).toBe(true)
        expect([...s.fichiers.keys()].some(c => c.startsWith('complet/'))).toBe(false)
        expect(s.fichiers.has(vieux)).toBe(false)
        expect(s.fichiers.has(recent)).toBe(true)
    })

    it('export d’un client : sous exports/ ; client inconnu : null, rien déposé', async () => {
        etat.clients = [KEVIN]
        expect(await exporter(s.sb, { cle: 'inconnu@exemple.bj' })).toBeNull()
        expect([...s.fichiers.keys()].some(c => c.startsWith('exports/'))).toBe(false)

        const res = await exporter(s.sb, { cle: 'email:kevin@exemple.bj' })
        expect(res!.clients).toBe(1)
        expect(res!.parties).toHaveLength(1)
        expect(res!.parties[0].chemin).toMatch(/^exports\/\d+-[0-9a-f]{12}\/sauvegarde-/)
    })

    it('la collecte de nuit : historique 2 mois, exports expirés et ancien complet/ purgés, manifeste sans complet', async () => {
        const jour = (ms: number) => new Date(Date.now() - ms).toISOString().slice(0, 10)
        const hist8 = `historique/${jour(63 * JOUR)}.json.gz`
        const hist6 = `historique/${jour(60 * JOUR)}.json.gz`
        const complet = `complet/${Date.now() - JOUR}/sauvegarde-clients-RGB.zip`
        const exportVieux = `exports/${Date.now() - 2 * HEURE}-cccccc/partie.zip`
        const client = 'clients/kevin.zip'
        s.fichiers.set(hist8, 1).set(hist6, 1).set(complet, 270).set(exportVieux, 1).set(client, 5)

        const { manifeste } = await executerCollecte(s.sb, { origine: 'nuit' })

        expect(s.fichiers.has(hist8)).toBe(false)
        expect(s.fichiers.has(hist6)).toBe(true)
        expect(s.fichiers.has(`historique/${jour(0)}.json.gz`)).toBe(true)
        expect(s.fichiers.has(complet)).toBe(false)
        expect(s.fichiers.has(exportVieux)).toBe(false)
        expect(s.fichiers.has(client)).toBe(true)
        expect(s.fichiers.has('manifeste.json')).toBe(true)
        expect(manifeste).not.toHaveProperty('complet')
        expect(manifeste.erreurs).toEqual([])
    })
})
