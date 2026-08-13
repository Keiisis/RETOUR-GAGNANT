import { createClient, SupabaseClient } from '@supabase/supabase-js'

/* ═══════════════════════════════════════════════════════════════════════
   SAUVEGARDE CLIENT — Agrégation robuste multi-tables

   Objectif : rassembler, pour CHAQUE client reçu depuis le début (qu'il ait
   un compte ou non), ABSOLUMENT tout ce qui le concerne, réparti dans une
   base hétérogène où la liaison se fait tantôt par `client_id`, tantôt par
   e-mail (`client_email`, `email`, `customer_email`…).

   Principe : on charge chaque table UNE fois (best-effort, tolérant aux
   colonnes/tables absentes), puis on répartit chaque ligne vers le bon client
   via une identité résolue (id de compte prioritaire, sinon e-mail normalisé).
   Les clients sans compte sont créés comme « orphelins » à partir des lignes
   qui portent leur e-mail (dossiers, demandes de nationalité, commandes…).

   Aucune donnée n'est omise : chaque ligne brute est conservée telle quelle.
═══════════════════════════════════════════════════════════════════════ */

export function getAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createClient(url, key, { auth: { persistSession: false } })
}

const norm = (e?: unknown): string => (typeof e === 'string' ? e : '').trim().toLowerCase()

/** Champs candidats pour résoudre l'identité d'une ligne. */
const ID_FIELDS = ['client_id', 'user_id', 'profile_id', 'owner_id']
const EMAIL_FIELDS = ['client_email', 'email', 'customer_email', 'contact_email', 'user_email']
const NOM_FIELDS = ['client_nom', 'nom', 'customer_name', 'name', 'full_name', 'lastname']
const PRENOM_FIELDS = ['client_prenom', 'prenom', 'firstname']
const PHONE_FIELDS = ['client_phone', 'phone', 'client_whatsapp', 'whatsapp', 'telephone', 'tel']

type Row = Record<string, unknown>

function pick(row: Row, fields: string[]): string {
    for (const f of fields) {
        const v = row[f]
        if (typeof v === 'string' && v.trim()) return v.trim()
        if (typeof v === 'number') return String(v)
    }
    return ''
}

/** Tables agrégées, avec la clé de section retournée au client. */
const CLIENT_TABLES: { table: string; key: string }[] = [
    { table: 'dossier_tracking', key: 'dossiers' },
    { table: 'nationality_applications', key: 'nationalite' },
    { table: 'nationality_documents', key: 'nationalite_documents' },
    { table: 'orders', key: 'commandes' },
    { table: 'order_tracking_events', key: 'commandes_suivi' },
    { table: 'documents_financiers', key: 'documents_financiers' }, // factures + devis + avoirs (type)
    { table: 'invoices', key: 'invoices' },
    { table: 'paiements', key: 'paiements' },
    { table: 'paiements_manuels', key: 'paiements_manuels' },
    { table: 'messages', key: 'messages' },
    { table: 'rdv_requests', key: 'rendez_vous' },
    { table: 'client_documents', key: 'documents' },
    { table: 'logement_leads', key: 'logements' },
    { table: 'event_registrations', key: 'evenements' },
    { table: 'event_tickets', key: 'evenements_billets' },
    { table: 'contracts', key: 'contrats' },
    { table: 'ai_client_proposals', key: 'devis_smart' },
    { table: 'client_signatures', key: 'signatures' },
    { table: 'client_classement', key: 'classement' },
    { table: 'eligibility_results', key: 'eligibilite' },
    { table: 'recherche_ancestrale', key: 'recherche_ancestrale' },
]

export interface ClientRecord {
    /** id de compte si le client possède un profil, sinon null. */
    id: string | null
    email: string
    nom: string
    prenom: string
    phone: string
    ville: string
    pays: string
    created_at: string | null
    hasAccount: boolean
    /** e-mails supplémentaires rattachés à ce client. */
    profile: Row | null
    /** Toutes les sections de données brutes, par clé. */
    data: Record<string, Row[]>
    /** Fil de discussion (chat_messages) par thread. */
    discussions: { thread: Row; messages: Row[] }[]
}

export interface ClientSummary {
    id: string | null
    email: string
    nom: string
    prenom: string
    phone: string
    ville: string
    pays: string
    created_at: string | null
    hasAccount: boolean
    counts: {
        dossiers: number
        nationalite: number
        commandes: number
        factures: number
        devis: number
        paiements: number
        messages: number
        rendez_vous: number
        documents: number
        logements: number
        evenements: number
        contrats: number
        total: number
    }
    services: string[]
}

async function safeSelectAll(sb: SupabaseClient, table: string): Promise<Row[]> {
    try {
        const { data, error } = await sb.from(table).select('*').limit(20000)
        if (error) return []
        return (data as Row[]) || []
    } catch {
        return []
    }
}

/** Charge tous les clients (comptes + orphelins) avec toutes leurs données. */
export async function loadAllClients(sb: SupabaseClient): Promise<ClientRecord[]> {
    // 1) Comptes clients (source canonique)
    const profiles = await safeSelectAll(sb, 'client_profiles')

    const byId = new Map<string, ClientRecord>()
    const byEmail = new Map<string, ClientRecord>()

    const makeRecord = (base: Partial<ClientRecord>): ClientRecord => ({
        id: base.id ?? null,
        email: base.email ?? '',
        nom: base.nom ?? '',
        prenom: base.prenom ?? '',
        phone: base.phone ?? '',
        ville: base.ville ?? '',
        pays: base.pays ?? '',
        created_at: base.created_at ?? null,
        hasAccount: base.hasAccount ?? false,
        profile: base.profile ?? null,
        data: {},
        discussions: [],
    })

    for (const p of profiles) {
        const email = norm(p.email)
        const rec = makeRecord({
            id: (p.id as string) || null,
            email,
            nom: pick(p, NOM_FIELDS),
            prenom: pick(p, PRENOM_FIELDS),
            phone: pick(p, PHONE_FIELDS),
            ville: (p.ville as string) || (p.city as string) || '',
            pays: (p.pays as string) || (p.country as string) || '',
            created_at: (p.created_at as string) || null,
            hasAccount: true,
            profile: p,
        })
        if (rec.id) byId.set(rec.id, rec)
        if (email) byEmail.set(email, rec)
    }

    // Trouve (ou crée) le client d'une ligne selon son identité.
    const resolve = (row: Row): ClientRecord | null => {
        for (const f of ID_FIELDS) {
            const v = row[f]
            if (typeof v === 'string' && byId.has(v)) return byId.get(v)!
        }
        for (const f of EMAIL_FIELDS) {
            const e = norm(row[f])
            if (!e) continue
            if (byEmail.has(e)) return byEmail.get(e)!
            // Orphelin : client sans compte, reconstruit depuis la ligne.
            const rec = makeRecord({
                id: null,
                email: e,
                nom: pick(row, NOM_FIELDS),
                prenom: pick(row, PRENOM_FIELDS),
                phone: pick(row, PHONE_FIELDS),
                created_at: (row.created_at as string) || null,
                hasAccount: false,
            })
            byEmail.set(e, rec)
            return rec
        }
        return null
    }

    // 2) Répartition de chaque table vers son client.
    for (const { table, key } of CLIENT_TABLES) {
        const rows = await safeSelectAll(sb, table)
        for (const row of rows) {
            const rec = resolve(row)
            if (!rec) continue
            if (!rec.data[key]) rec.data[key] = []
            rec.data[key].push(row)
            // Complète les infos d'un orphelin si vides.
            if (!rec.hasAccount) {
                if (!rec.nom) rec.nom = pick(row, NOM_FIELDS)
                if (!rec.prenom) rec.prenom = pick(row, PRENOM_FIELDS)
                if (!rec.phone) rec.phone = pick(row, PHONE_FIELDS)
            }
        }
    }

    // 3) Fils de discussion : chat_messages rattachés aux threads `messages`.
    const chat = await safeSelectAll(sb, 'chat_messages')
    if (chat.length) {
        const byConversation = new Map<string, Row[]>()
        for (const m of chat) {
            const cid = (m.conversation_id as string) || ''
            if (!cid) continue
            if (!byConversation.has(cid)) byConversation.set(cid, [])
            byConversation.get(cid)!.push(m)
        }
        const all = [...byId.values(), ...byEmail.values()]
        const seen = new Set<ClientRecord>()
        for (const rec of all) {
            if (seen.has(rec)) continue
            seen.add(rec)
            const threads = rec.data['messages'] || []
            for (const thread of threads) {
                const tid = (thread.id as string) || ''
                const msgs = (byConversation.get(tid) || []).sort(
                    (a, b) => String(a.created_at).localeCompare(String(b.created_at))
                )
                rec.discussions.push({ thread, messages: msgs })
            }
        }
    }

    // Déduplique (un compte peut être indexé par id ET email).
    const unique = new Map<ClientRecord, true>()
    const out: ClientRecord[] = []
    for (const rec of [...byId.values(), ...byEmail.values()]) {
        if (unique.has(rec)) continue
        unique.set(rec, true)
        out.push(rec)
    }

    // Tri : comptes d'abord, puis par date de création décroissante.
    out.sort((a, b) => {
        if (a.hasAccount !== b.hasAccount) return a.hasAccount ? -1 : 1
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })

    return out
}

const countType = (rows: Row[] | undefined, type: string): number =>
    (rows || []).filter(r => String(r.type || '').toLowerCase() === type).length

/** Résumé léger pour la liste admin. */
export function toSummary(rec: ClientRecord): ClientSummary {
    const d = rec.data
    const factures = countType(d.documents_financiers, 'facture') + (d.invoices?.length || 0)
    const devis = countType(d.documents_financiers, 'devis') + (d.devis_smart?.length || 0)
    const paiements = (d.paiements?.length || 0) + (d.paiements_manuels?.length || 0)

    const services: string[] = []
    if ((d.dossiers?.length || 0) > 0) services.push('Dossiers')
    if ((d.nationalite?.length || 0) > 0) services.push('Nationalité')
    if ((d.logements?.length || 0) > 0) services.push('Logement')
    if ((d.evenements?.length || 0) > 0) services.push('Événements')
    if ((d.commandes?.length || 0) > 0) services.push('Boutique')
    if ((d.recherche_ancestrale?.length || 0) > 0) services.push('Recherche ancestrale')
    // Détection Fa / permis / auto-école via le libellé des dossiers & commandes.
    const blob = JSON.stringify([...(d.dossiers || []), ...(d.commandes || [])]).toLowerCase()
    if (blob.includes('fa') && (blob.includes('pretre') || blob.includes('prêtre') || blob.includes('consultation'))) services.push('Prêtres Fa')
    if (blob.includes('permis') || blob.includes('auto-ecole') || blob.includes('auto-école') || blob.includes('conduire')) services.push('Permis / Auto-école')

    const counts = {
        dossiers: d.dossiers?.length || 0,
        nationalite: d.nationalite?.length || 0,
        commandes: d.commandes?.length || 0,
        factures,
        devis,
        paiements,
        messages: rec.discussions.reduce((n, t) => n + t.messages.length, 0) + (d.messages?.length || 0),
        rendez_vous: d.rendez_vous?.length || 0,
        documents: d.documents?.length || 0,
        logements: d.logements?.length || 0,
        evenements: d.evenements?.length || 0,
        contrats: d.contrats?.length || 0,
        total: 0,
    }
    counts.total =
        counts.dossiers + counts.nationalite + counts.commandes + counts.factures +
        counts.devis + counts.paiements + counts.messages + counts.rendez_vous +
        counts.documents + counts.logements + counts.evenements + counts.contrats

    return {
        id: rec.id,
        email: rec.email,
        nom: rec.nom,
        prenom: rec.prenom,
        phone: rec.phone,
        ville: rec.ville,
        pays: rec.pays,
        created_at: rec.created_at,
        hasAccount: rec.hasAccount,
        counts,
        services: [...new Set(services)],
    }
}

/** Clé stable pour identifier un client dans une URL (id de compte ou e-mail). */
export function clientKey(rec: ClientRecord | ClientSummary): string {
    return rec.id ? `id:${rec.id}` : `email:${rec.email}`
}

export function matchesKey(rec: ClientRecord, key: string): boolean {
    if (key.startsWith('id:')) return rec.id === key.slice(3)
    if (key.startsWith('email:')) return norm(rec.email) === norm(key.slice(6))
    return false
}
