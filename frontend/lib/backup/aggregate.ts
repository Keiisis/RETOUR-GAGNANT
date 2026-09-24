import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

/* ═══════════════════════════════════════════════════════════════════════
   SAUVEGARDE CLIENT — Agrégation multi-tables, sans perte silencieuse

   Objectif : rassembler, pour CHAQUE client reçu depuis le début (qu'il ait
   un compte ou non), ABSOLUMENT tout ce qui le concerne, réparti dans une
   base hétérogène où la liaison se fait tantôt par `client_id`, tantôt par
   e-mail, tantôt par une table parente (un billet appartient à une
   inscription, une ligne de proposition à une proposition…).

   Trois garanties, vérifiables dans le rapport de collecte :

   1. AUCUNE TRONCATURE. PostgREST plafonne une réponse à 1000 lignes quel
      que soit le `limit` demandé : chaque table est lue PAR PAGES jusqu'au
      bout.
   2. AUCUNE ERREUR AVALÉE. Une table illisible (renommée, droits, colonne
      absente) apparaît dans le rapport avec son message, au lieu de
      disparaître de la sauvegarde sans que personne le sache.
   3. CONSERVATION DES LIGNES. Pour chaque table : lues = rattachées + non
      rattachées. Les lignes qu'aucun client ne réclame ne sont pas jetées :
      elles sont exportées à part (« _NON RATTACHÉES »).
═══════════════════════════════════════════════════════════════════════ */

export function getAdminClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    return createClient(url, key, { auth: { persistSession: false } })
}

const norm = (e?: unknown): string => (typeof e === 'string' ? e : '').trim().toLowerCase()

/**
 * Téléphone ramené à ses 9 derniers chiffres : « +229 97 20 00 09 »,
 * « 0022997200009 » et « 97200009 » désignent la même ligne. En dessous de
 * 8 chiffres, ce n'est pas un numéro exploitable (saisie tronquée) : ignoré.
 */
const telCle = (v?: unknown): string => {
    const chiffres = String(v ?? '').replace(/\D/g, '')
    return chiffres.length >= 8 ? chiffres.slice(-9) : ''
}

/** Mots d'un nom, sans accents ni casse, pour comparer « MONPIERRE Aymeric ». */
const mots = (v?: unknown): string[] => String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(m => m.length >= 2)

/** Champs candidats pour résoudre l'identité d'une ligne. */
const ID_FIELDS = ['client_id', 'user_id', 'profile_id', 'owner_id']
const EMAIL_FIELDS = ['client_email', 'email', 'customer_email', 'contact_email', 'user_email']
const NOM_FIELDS = ['client_nom', 'nom', 'customer_name', 'client_name', 'name', 'full_name', 'lastname', 'client_last_name']
const PRENOM_FIELDS = ['client_prenom', 'prenom', 'firstname', 'client_first_name']
const PHONE_FIELDS = ['client_phone', 'phone', 'client_whatsapp', 'whatsapp', 'telephone', 'tel', 'customer_phone']

/** Rôles internes : un compte d'équipe n'est pas un client. */
const ROLES_EQUIPE = ['admin', 'super_admin', 'superadmin', 'agent', 'staff']

export type Row = Record<string, unknown>

function pick(row: Row, fields: string[]): string {
    for (const f of fields) {
        const v = row[f]
        if (typeof v === 'string' && v.trim()) return v.trim()
        if (typeof v === 'number') return String(v)
    }
    return ''
}

/**
 * Une source de données client.
 *
 * · directe : la ligne porte l'identité (id de compte ou e-mail) ;
 * · enfant  : la ligne n'a pas d'identité propre, elle suit son parent
 *   (`parent.section` déjà réparti, relié par `parent.fk` → `id`) ;
 * · `orphelins: false` : la source rattache aux clients CONNUS sans en créer
 *   (un e-mail de journal d'envoi ou d'abonné newsletter ne fait pas, à lui
 *   seul, un client).
 */
export interface Source {
    table: string
    section: string
    libelle: string
    emailFields?: string[]
    parent?: { section: string; fk: string }
    orphelins?: boolean
    /**
     * Dernier recours : colonne contenant le NOM du client (ex. « Plan de
     * famille MONPIERRE Aymeric »). Rattache seulement si UN SEUL client a son
     * nom ET son prénom dedans — sinon la ligne reste non rattachée plutôt que
     * d'être attribuée au hasard.
     */
    nomDans?: string
}

/** L'ordre compte : un parent est toujours lu avant ses enfants. */
export const SOURCES: Source[] = [
    // ── Démarches et services ─────────────────────────────────────
    { table: 'dossier_tracking', section: 'dossiers', libelle: 'Dossiers de suivi' },
    { table: 'nationality_applications', section: 'nationalite', libelle: 'Demandes de nationalité' },
    { table: 'nationality_requests', section: 'nationalite_contacts', libelle: 'Prises de contact nationalité' },
    { table: 'myafro_recap_requests', section: 'recaps_myafro', libelle: 'Récaps MyAfroOrigins' },
    { table: 'logement_leads', section: 'logements', libelle: 'Demandes de logement' },
    { table: 'tourism_itineraries', section: 'itineraires', libelle: 'Itinéraires de séjour' },
    { table: 'slide_proposals', section: 'propositions_sejour', libelle: 'Propositions de séjour' },
    { table: 'eligibility_results', section: 'eligibilite', libelle: 'Tests d’éligibilité' },
    { table: 'client_classement', section: 'classement', libelle: 'Classement / suivi commercial' },
    { table: 'trees', section: 'genealogie_arbres', libelle: 'Arbres généalogiques', nomDans: 'name' },
    { table: 'dossiers', section: 'genealogie_dossiers', libelle: 'Dossiers généalogie', orphelins: false },

    // ── Argent : devis, factures, paiements, commandes ───────────
    { table: 'documents_financiers', section: 'documents_financiers', libelle: 'Factures, devis et avoirs' },
    { table: 'invoices', section: 'invoices', libelle: 'Factures (ancienne table)', emailFields: ['sent_to_email'] },
    { table: 'ai_client_proposals', section: 'devis_smart', libelle: 'Devis intelligents' },
    { table: 'agent_devis', section: 'devis_agent', libelle: 'Devis d’agent' },
    { table: 'payment_links', section: 'liens_paiement', libelle: 'Liens de paiement' },
    { table: 'paiements', section: 'paiements', libelle: 'Paiements en ligne' },
    { table: 'orders', section: 'commandes', libelle: 'Commandes boutique' },
    { table: 'contracts', section: 'contrats', libelle: 'Contrats' },
    { table: 'client_signatures', section: 'signatures', libelle: 'Signatures enregistrées', orphelins: false },

    // ── Rendez-vous, événements ──────────────────────────────────
    { table: 'rdv_requests', section: 'rendez_vous', libelle: 'Demandes de rendez-vous' },
    { table: 'appointments', section: 'rendez_vous_agenda', libelle: 'Rendez-vous planifiés' },
    { table: 'event_registrations', section: 'evenements', libelle: 'Inscriptions aux événements' },

    // ── Échanges ─────────────────────────────────────────────────
    { table: 'messages', section: 'messages', libelle: 'Conversations' },
    { table: 'voice_messages', section: 'messages_vocaux', libelle: 'Messages vocaux' },
    { table: 'calls', section: 'appels', libelle: 'Appels' },
    { table: 'support_sessions', section: 'support', libelle: 'Sessions d’assistance' },
    { table: 'client_notifications', section: 'notifications_client', libelle: 'Notifications (e-mail)', orphelins: false },
    { table: 'notifications', section: 'notifications', libelle: 'Notifications (application)', orphelins: false },
    { table: 'email_logs', section: 'emails_envoyes', libelle: 'E-mails envoyés', emailFields: ['to_email'], orphelins: false },
    { table: 'newsletter_subscribers', section: 'newsletter', libelle: 'Newsletter', orphelins: false },
    { table: 'nationality_invitation_codes', section: 'codes_invitation', libelle: 'Codes d’invitation utilisés', emailFields: ['utilise_par_email'], orphelins: false },
    { table: 'product_reviews', section: 'avis_produits', libelle: 'Avis produits', emailFields: ['reviewer_email'], orphelins: false },
    { table: 'fa_priest_reviews', section: 'avis_fa', libelle: 'Avis prêtres Fa', emailFields: ['author_email'], orphelins: false },

    // ── Pièces ───────────────────────────────────────────────────
    { table: 'client_documents', section: 'documents', libelle: 'Pièces déposées' },

    // ── Enfants : suivent leur parent ────────────────────────────
    { table: 'order_tracking_events', section: 'commandes_suivi', libelle: 'Suivi des commandes', parent: { section: 'commandes', fk: 'order_id' } },
    { table: 'event_tickets', section: 'evenements_billets', libelle: 'Billets', parent: { section: 'evenements', fk: 'registration_id' } },
    { table: 'ai_proposal_items', section: 'devis_smart_lignes', libelle: 'Lignes des devis intelligents', parent: { section: 'devis_smart', fk: 'proposal_id' } },
    { table: 'proposal_views', section: 'devis_smart_vues', libelle: 'Consultations des devis', parent: { section: 'devis_smart', fk: 'proposal_id' } },
    { table: 'proposal_assistant_messages', section: 'devis_smart_assistant', libelle: 'Échanges avec l’assistant du devis', parent: { section: 'devis_smart', fk: 'proposal_id' } },
    { table: 'paiements_manuels', section: 'paiements_manuels', libelle: 'Encaissements enregistrés', parent: { section: 'documents_financiers', fk: 'document_id' } },
    { table: 'dossier_documents', section: 'dossiers_pieces', libelle: 'Pièces des dossiers', parent: { section: 'dossiers', fk: 'dossier_id' } },
    { table: 'documents', section: 'dossiers_pieces_anciennes', libelle: 'Pièces des dossiers (ancienne table)', parent: { section: 'dossiers', fk: 'dossier_id' } },
    { table: 'persons', section: 'genealogie_personnes', libelle: 'Personnes de l’arbre', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'unions', section: 'genealogie_unions', libelle: 'Unions', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'parent_child', section: 'genealogie_filiations', libelle: 'Filiations', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'person_facts', section: 'genealogie_faits', libelle: 'Faits établis', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'genealogy_documents', section: 'genealogie_documents', libelle: 'Documents généalogiques', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'person_comments', section: 'genealogie_commentaires', libelle: 'Commentaires sur l’arbre', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
    { table: 'tree_collaborators', section: 'genealogie_collaborateurs', libelle: 'Collaborateurs de l’arbre', parent: { section: 'genealogie_arbres', fk: 'tree_id' } },
]

/**
 * Tables écartées VOLONTAIREMENT, avec la raison. Elles figurent dans le
 * rapport : « absent de la sauvegarde » doit toujours être une décision
 * écrite, jamais un oubli.
 */
export const EXCLUSIONS: { table: string; raison: string }[] = [
    { table: 'account_deletion_codes', raison: 'Codes de sécurité à usage unique' },
    { table: 'totp_secrets', raison: 'Secrets d’authentification — ne doivent jamais sortir de la base' },
    { table: 'waf_trusted_ips', raison: 'Données de sécurité du pare-feu' },
    { table: 'user_profiles', raison: 'Comptes de l’équipe, pas des clients' },
    { table: 'audit_compta', raison: 'Journal interne de la comptabilité' },
    { table: 'genealogy_audit_log', raison: 'Journal interne de la généalogie' },
    { table: 'ai_prospection_leads', raison: 'Prospects jamais devenus clients' },
    { table: 'business_cards', raison: 'Cartes de visite de l’équipe' },
    { table: 'partners', raison: 'Partenaires, pas des clients' },
    { table: 'partner_applications', raison: 'Candidatures de partenaires' },
    { table: 'driving_schools', raison: 'Auto-écoles partenaires' },
    { table: 'fa_priests', raison: 'Prêtres Fa partenaires' },
    { table: 'social_analyses', raison: 'Analyses de réseaux sociaux (prospection)' },
    { table: 'v_dossiers_payes_sans_facture', raison: 'Vue de contrôle, recalculée depuis les tables sauvegardées' },
    { table: 'chat_messages', raison: 'Lu séparément : rattaché aux conversations (section Discussions)' },
    { table: 'client_profiles', raison: 'Lu séparément : source de l’identité des clients' },
    { table: 'profiles', raison: 'Lu séparément : source de l’identité des clients' },
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
    profile: Row | null
    /** Toutes les sections de données brutes, par clé. */
    data: Record<string, Row[]>
    /** Fil de discussion (chat_messages) par conversation. */
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

/** Une ligne du rapport de collecte. */
export interface LigneRapport {
    table: string
    libelle: string
    lues: number
    rattachees: number
    non_rattachees: number
    erreur?: string
}

export interface Collecte {
    clients: ClientRecord[]
    rapport: LigneRapport[]
    /** Lignes lues qu'aucun client ne réclame, par table : conservées, pas jetées. */
    nonRattachees: Record<string, Row[]>
    exclusions: typeof EXCLUSIONS
    /** Tables porteuses d'une identité client ni collectées ni exclues : un oubli à corriger. */
    nonCouvertes: { table: string; colonnes: string[] }[]
    duree_ms: number
    genere_le: string
}

const PAGE = 1000

/**
 * Tables de la base qui portent une identité client (e-mail, id de compte,
 * téléphone) sans être ni collectées ni écartées par décision écrite.
 *
 * C'est le garde-fou contre l'oubli FUTUR : une table ajoutée demain pour un
 * nouveau service apparaîtra ici — et dans le panel — tant qu'elle n'aura
 * pas été déclarée dans SOURCES ou EXCLUSIONS.
 */
export async function tablesNonCouvertes(): Promise<{ table: string; colonnes: string[] }[]> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return []
    try {
        const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
        if (!res.ok) return []
        const spec = await res.json() as { definitions?: Record<string, { properties?: Record<string, unknown> }> }
        const connues = new Set([...SOURCES.map(x => x.table), ...EXCLUSIONS.map(x => x.table)])
        const identite = /(^|_)(email|mail|client_id|user_id|profile_id|customer_id|phone|telephone|whatsapp)$/i
        const out: { table: string; colonnes: string[] }[] = []
        for (const [table, def] of Object.entries(spec.definitions || {})) {
            if (connues.has(table)) continue
            const colonnes = Object.keys(def.properties || {}).filter(c => identite.test(c))
            if (colonnes.length) out.push({ table, colonnes })
        }
        return out.sort((a, b) => a.table.localeCompare(b.table))
    } catch {
        return []
    }
}

/**
 * Lit une table ENTIÈRE, page par page.
 *
 * Tri par `id` pour que la pagination soit stable (sans tri, deux pages
 * peuvent se chevaucher ou sauter des lignes). Une table sans `id` est relue
 * sans tri, en le signalant.
 */
export async function lireTable(sb: SupabaseClient, table: string): Promise<{ rows: Row[]; erreur?: string }> {
    const rows: Row[] = []
    let avecTri = true
    for (let from = 0; ; from += PAGE) {
        let q = sb.from(table).select('*')
        if (avecTri) q = q.order('id', { ascending: true })
        const { data, error } = await q.range(from, from + PAGE - 1)
        if (error) {
            if (avecTri && from === 0 && /id/.test(error.message)) { avecTri = false; from -= PAGE; continue }
            return { rows, erreur: error.message }
        }
        const page = (data as Row[]) || []
        rows.push(...page)
        if (page.length < PAGE) break
        // Garde-fou : une table cliente à plus de 200 000 lignes est anormale.
        if (rows.length >= 200_000) return { rows, erreur: 'Lecture interrompue à 200 000 lignes' }
    }
    return { rows }
}

/** Charge tous les clients (comptes + orphelins) avec toutes leurs données. */
export async function collecter(sb: SupabaseClient): Promise<Collecte> {
    const debut = Date.now()
    const rapport: LigneRapport[] = []
    const nonRattachees: Record<string, Row[]> = {}

    const byId = new Map<string, ClientRecord>()
    const byEmail = new Map<string, ClientRecord>()
    const byTel = new Map<string, ClientRecord>()
    const indexerTel = (rec: ClientRecord, tel?: unknown) => {
        const k = telCle(tel)
        if (k && !byTel.has(k)) byTel.set(k, rec)
    }

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

    // 1) Comptes clients. `client_profiles` d'abord (source canonique), puis
    //    `profiles` pour les comptes qui n'y figurent pas — l'équipe exclue.
    for (const [table, estEquipe] of [
        ['client_profiles', () => false],
        ['profiles', (p: Row) => ROLES_EQUIPE.includes(norm(p.role))],
    ] as const) {
        const { rows, erreur } = await lireTable(sb, table)
        let pris = 0
        for (const p of rows) {
            if (estEquipe(p)) continue
            const email = norm(p.email)
            const id = (p.id as string) || null
            const existant = (id && byId.get(id)) || (email && byEmail.get(email))
            if (existant) {
                // Même personne vue dans les deux tables : on complète.
                if (!existant.phone) existant.phone = pick(p, PHONE_FIELDS)
                if (!existant.ville) existant.ville = (p.ville as string) || ''
                if (id && !byId.has(id)) byId.set(id, existant)
                pris++
                continue
            }
            const rec = makeRecord({
                id,
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
            if (id) byId.set(id, rec)
            if (email) byEmail.set(email, rec)
            indexerTel(rec, rec.phone)
            pris++
        }
        rapport.push({
            table, libelle: table === 'client_profiles' ? 'Comptes clients' : 'Profils (comptes)',
            lues: rows.length, rattachees: pris, non_rattachees: rows.length - pris, erreur,
        })
    }

    // Trouve (ou crée) le client d'une ligne selon son identité.
    const resolve = (row: Row, src: Source): ClientRecord | null => {
        for (const f of ID_FIELDS) {
            const v = row[f]
            if (typeof v === 'string' && byId.has(v)) return byId.get(v)!
        }
        for (const f of src.emailFields || EMAIL_FIELDS) {
            const e = norm(row[f])
            if (!e || !e.includes('@')) continue
            if (byEmail.has(e)) return byEmail.get(e)!
            if (src.orphelins === false) continue
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
            indexerTel(rec, rec.phone)
            return rec
        }
        /* Pas d'e-mail exploitable (effacé au titre du RGPD, jamais saisi) :
           le téléphone identifie encore la personne. */
        for (const f of PHONE_FIELDS) {
            const k = telCle(row[f])
            if (!k) continue
            if (byTel.has(k)) return byTel.get(k)!
            if (src.orphelins === false) continue
            const rec = makeRecord({
                id: null,
                email: '',
                nom: pick(row, NOM_FIELDS),
                prenom: pick(row, PRENOM_FIELDS),
                phone: pick(row, PHONE_FIELDS),
                created_at: (row.created_at as string) || null,
                hasAccount: false,
            })
            byTel.set(k, rec)
            return rec
        }
        if (src.nomDans) {
            const dans = new Set(mots(row[src.nomDans]))
            if (dans.size) {
                const candidats = new Set<ClientRecord>()
                for (const rec of [...byId.values(), ...byEmail.values(), ...byTel.values()]) {
                    const n = mots(rec.nom), p = mots(rec.prenom)
                    if (n.length && p.length && [...n, ...p].every(m => dans.has(m))) candidats.add(rec)
                }
                if (candidats.size === 1) return [...candidats][0]
            }
        }
        return null
    }

    /* Index des lignes parentes déjà réparties : section → id → client. Un
       enfant (billet, ligne de devis, personne d'un arbre) suit son parent. */
    const parents = new Map<string, Map<string, ClientRecord>>()

    // 2) Répartition de chaque source vers son client.
    for (const src of SOURCES) {
        const { rows, erreur } = await lireTable(sb, src.table)
        let pris = 0
        const index = new Map<string, ClientRecord>()
        for (const row of rows) {
            let rec: ClientRecord | null = null
            if (src.parent) {
                const fk = row[src.parent.fk]
                if (fk !== null && fk !== undefined) rec = parents.get(src.parent.section)?.get(String(fk)) || null
                // Repli : l'enfant porte parfois aussi l'identité (client_id…).
                if (!rec) rec = resolve(row, { ...src, orphelins: false })
            } else {
                rec = resolve(row, src)
            }
            if (!rec) {
                (nonRattachees[src.table] ||= []).push(row)
                continue
            }
            pris++
            ;(rec.data[src.section] ||= []).push(row)
            if (row.id !== undefined && row.id !== null) index.set(String(row.id), rec)
            // Complète les infos d'un orphelin si vides.
            if (!rec.hasAccount) {
                if (!rec.nom) rec.nom = pick(row, NOM_FIELDS)
                if (!rec.prenom) rec.prenom = pick(row, PRENOM_FIELDS)
                if (!rec.phone) rec.phone = pick(row, PHONE_FIELDS)
            }
            indexerTel(rec, pick(row, PHONE_FIELDS))
        }
        parents.set(src.section, index)
        rapport.push({
            table: src.table, libelle: src.libelle,
            lues: rows.length, rattachees: pris, non_rattachees: rows.length - pris, erreur,
        })
    }

    // 3) Fils de discussion : chat_messages rattachés aux conversations `messages`.
    {
        const { rows: chat, erreur } = await lireTable(sb, 'chat_messages')
        const byConversation = new Map<string, Row[]>()
        for (const m of chat) {
            const cid = (m.conversation_id as string) || ''
            if (!cid) continue
            if (!byConversation.has(cid)) byConversation.set(cid, [])
            byConversation.get(cid)!.push(m)
        }
        let pris = 0
        const vus = new Set<ClientRecord>()
        for (const rec of [...byId.values(), ...byEmail.values(), ...byTel.values()]) {
            if (vus.has(rec)) continue
            vus.add(rec)
            for (const thread of rec.data['messages'] || []) {
                const tid = (thread.id as string) || ''
                const msgs = (byConversation.get(tid) || []).sort(
                    (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
                )
                pris += msgs.length
                byConversation.delete(tid)
                rec.discussions.push({ thread, messages: msgs })
            }
        }
        const restants = [...byConversation.values()].flat()
        if (restants.length) nonRattachees['chat_messages'] = restants
        rapport.push({
            table: 'chat_messages', libelle: 'Messages des conversations',
            lues: chat.length, rattachees: pris, non_rattachees: restants.length, erreur,
        })
    }

    // Déduplique (un compte peut être indexé par id ET email).
    const unique = new Set<ClientRecord>()
    const clients: ClientRecord[] = []
    for (const rec of [...byId.values(), ...byEmail.values(), ...byTel.values()]) {
        if (unique.has(rec)) continue
        unique.add(rec)
        clients.push(rec)
    }

    // Tri : comptes d'abord, puis par date de création décroissante.
    clients.sort((a, b) => {
        if (a.hasAccount !== b.hasAccount) return a.hasAccount ? -1 : 1
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })

    return {
        clients, rapport, nonRattachees, exclusions: EXCLUSIONS,
        nonCouvertes: await tablesNonCouvertes(),
        duree_ms: Date.now() - debut, genere_le: new Date().toISOString(),
    }
}

/** Compatibilité : les appelants qui ne veulent que la liste des clients. */
export async function loadAllClients(sb: SupabaseClient): Promise<ClientRecord[]> {
    return (await collecter(sb)).clients
}

const countType = (rows: Row[] | undefined, type: string): number =>
    (rows || []).filter(r => String(r.type || '').toLowerCase() === type).length

const len = (rows: Row[] | undefined) => rows?.length || 0

/** Résumé léger pour la liste admin. */
export function toSummary(rec: ClientRecord): ClientSummary {
    const d = rec.data
    const factures = countType(d.documents_financiers, 'facture') + len(d.invoices)
    const devis = countType(d.documents_financiers, 'devis') + len(d.devis_smart) + len(d.devis_agent) + len(d.propositions_sejour)
    const paiements = len(d.paiements) + len(d.paiements_manuels)

    const services: string[] = []
    if (len(d.dossiers)) services.push('Dossiers')
    if (len(d.nationalite) || len(d.nationalite_contacts)) services.push('Nationalité')
    if (len(d.recaps_myafro)) services.push('Récap MyAfroOrigins')
    if (len(d.logements)) services.push('Logement')
    if (len(d.evenements)) services.push('Événements')
    if (len(d.commandes)) services.push('Boutique')
    if (len(d.genealogie_arbres)) services.push('Généalogie')
    if (len(d.itineraires) || len(d.propositions_sejour)) services.push('Séjour')
    if (len(d.devis_smart)) services.push('Devis intelligent')
    // Services identifiés par le libellé des dossiers & commandes.
    const blob = JSON.stringify([...(d.dossiers || []), ...(d.commandes || [])]).toLowerCase()
    if (blob.includes('fa') && (blob.includes('pretre') || blob.includes('prêtre') || blob.includes('consultation'))) services.push('Prêtres Fa')
    if (blob.includes('permis') || blob.includes('auto-ecole') || blob.includes('auto-école') || blob.includes('conduire')) services.push('Permis / Auto-école')
    if (blob.includes('recherche ancestrale') || blob.includes('ancestral')) services.push('Recherche ancestrale')

    const counts = {
        dossiers: len(d.dossiers),
        nationalite: len(d.nationalite),
        commandes: len(d.commandes),
        factures,
        devis,
        paiements,
        messages: rec.discussions.reduce((n, t) => n + t.messages.length, 0) + len(d.messages) + len(d.messages_vocaux),
        rendez_vous: len(d.rendez_vous) + len(d.rendez_vous_agenda),
        documents: len(d.documents) + len(d.dossiers_pieces) + len(d.dossiers_pieces_anciennes) + len(d.genealogie_documents),
        logements: len(d.logements),
        evenements: len(d.evenements),
        contrats: len(d.contrats),
        total: 0,
    }
    // Total = toutes les lignes rattachées, toutes sections confondues.
    counts.total = Object.values(d).reduce((n, rows) => n + rows.length, 0)
        + rec.discussions.reduce((n, t) => n + t.messages.length, 0)

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

/**
 * Empreinte d'un client : change dès qu'une seule de ses lignes change. Sert
 * à ne reconstruire, la nuit, que les dossiers qui ont bougé.
 */
/**
 * Version du FORMAT des dossiers. À incrémenter chaque fois que la manière de
 * construire un dossier change (nouvelle section, correctif de lecture des
 * pièces…) : toutes les empreintes changent, et la collecte suivante
 * reconstruit chaque dossier au nouveau format — sans quoi un client dont
 * les données n'ont pas bougé garderait une archive fabriquée par l'ancien
 * code.
 *   2 — pièces dont le libellé contient « : » (actes des ascendants) incluses.
 */
export const VERSION_FORMAT = 2

export function empreinte(rec: ClientRecord): string {
    const stable = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(stable)
        if (v && typeof v === 'object') {
            return Object.fromEntries(Object.keys(v as Row).sort().map(k => [k, stable((v as Row)[k])]))
        }
        return v
    }
    return createHash('sha256')
        .update(JSON.stringify(stable({ v: VERSION_FORMAT, i: [rec.id, rec.email, rec.nom, rec.prenom, rec.phone], p: rec.profile, d: rec.data, c: rec.discussions })))
        .digest('hex')
}

/** Clé stable pour identifier un client dans une URL (id de compte ou e-mail). */
export function clientKey(rec: ClientRecord | ClientSummary): string {
    if (rec.id) return `id:${rec.id}`
    if (rec.email) return `email:${rec.email}`
    return `tel:${telCle(rec.phone)}`
}

/** Nom de fichier de stockage d'un client : ne porte pas son e-mail en clair. */
export function cleStockage(rec: ClientRecord | ClientSummary): string {
    return createHash('sha256').update(clientKey(rec)).digest('hex').slice(0, 32)
}

export function matchesKey(rec: ClientRecord, key: string): boolean {
    if (key.startsWith('id:')) return rec.id === key.slice(3)
    if (key.startsWith('email:')) return !!rec.email && norm(rec.email) === norm(key.slice(6))
    if (key.startsWith('tel:')) return !rec.id && !rec.email && telCle(rec.phone) === key.slice(4)
    return false
}
