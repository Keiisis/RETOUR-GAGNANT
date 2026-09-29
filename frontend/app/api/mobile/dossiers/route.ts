import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scanRequestBody } from '@/lib/waf'
import { getMobileUserId } from '@/lib/mobile-auth'
import { facturerPaiementService } from '@/lib/service-invoice'
import { ttcFromHt } from '@/lib/tax'
import { toXOFStrict } from '@/lib/server-rates'
import {
    verifierKkiapay, montantCouvert, usagesTransaction, appartientAuClient,
    emailDuProfil, motifOuRien,
} from '@/lib/mobile-paiement'
import { DOSSIER_VERS_MOBILE, DOSSIER_STATUTS_ACTIFS, normaliserStatutDossier } from '@/lib/constants/statuts'

// Service role : bypasse RLS pour créer/lire les dossiers depuis l'app mobile
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* ⚠️ SOURCE DE VÉRITÉ = `dossier_tracking` (le tracker admin/agent).
   La table `dossiers` est celle de la GÉNÉALOGIE (tree_id/dossier_type) : elle
   n'a PAS de client_id/service_type et faisait échouer toute création. On lit
   et écrit donc les dossiers de SERVICE dans `dossier_tracking`, ce qui unifie
   mobile <-> admin <-> agent sur une seule table + les statuts globaux. */
/* Statut suivi → statut mobile : RÉFÉRENCE UNIQUE (lib/constants/statuts).
   L'ancienne table locale ignorait les valeurs historiques encore écrites
   (`en_cours` par la synchro boutique, `verifie`, `completed`…) : elles
   retombaient sur « soumis », un dossier en traitement paraissait tout juste
   déposé. On normalise d'abord (alias), puis on traduit. */
function statutMobile(statut: unknown): string {
    const n = normaliserStatutDossier(String(statut || ''))
    return (DOSSIER_VERS_MOBILE as Record<string, string>)[n] || 'soumis'
}
const ACTIVE_TRACKING_STATUTS: string[] = DOSSIER_STATUTS_ACTIFS

// ─── GET : tous les dossiers d'un client avec leurs documents ────────────────
export async function GET(req: NextRequest) {
    try {
        // Identité dérivée du jeton (anti-IDOR) : on ignore tout client_id fourni
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // Rattachement par identifiant OU par EMAIL.
        //
        // Mesuré en base le 2026-08-18 : 23 dossiers sur 25 n'ont PAS de
        // client_id — les dossiers ouverts depuis le site ne portent que
        // l'email. Filtrer sur le seul client_id revenait donc à cacher au
        // client la quasi-totalité de ses dossiers (compteur « 00 » sur le
        // profil, onglet Dossier vide).
        //
        // L'email est lu sur le PROFIL rattaché au jeton, jamais sur un
        // paramètre : sinon il suffirait d'envoyer l'email d'autrui pour lire
        // ses dossiers.
        const { data: cp, error: cpErr } = await supabase
            .from('client_profiles')
            .select('email')
            .eq('id', clientId)
            .maybeSingle()
        if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 })
        const email = String(cp?.email || '').trim().toLowerCase()

        /* DEUX lectures plutôt qu'un `.or()` : l'email était injecté brut dans
           le filtre PostgREST (une virgule ou une parenthèse dans l'adresse
           cassait ou élargissait la requête) et comparé à la casse près — un
           dossier saisi « Jean@x.com » sur le site restait invisible. */
        const CHAMPS_DOSSIER = 'id, dossier_ref_id, statut, progression, service_type, notes, created_at, updated_at'
        const [parCompte, parEmail] = await Promise.all([
            supabase.from('dossier_tracking').select(CHAMPS_DOSSIER)
                .eq('client_id', clientId).order('created_at', { ascending: false }).limit(200),
            email
                ? supabase.from('dossier_tracking').select(CHAMPS_DOSSIER)
                    .ilike('client_email', motifOuRien(email)).order('created_at', { ascending: false }).limit(200)
                : Promise.resolve({ data: [], error: null }),
        ])
        const error = parCompte.error || parEmail.error
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        const vus = new Set<string>()
        const tracking = [...(parCompte.data || []), ...(parEmail.data || [])]
            .filter(t => (vus.has(t.id) ? false : (vus.add(t.id), true)))
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

        /* Les pièces, en DEUX requêtes — pas deux par dossier.
           L'ancien code interrogeait la base pour CHAQUE dossier, et une
           seconde fois quand la première ne rendait rien : un client avec dix
           dossiers déclenchait jusqu'à vingt allers-retours à chaque ouverture
           de l'onglet. Multiplié par une base d'utilisateurs, c'est la base de
           données qui paie. Ici on demande toutes les pièces d'un coup, puis
           on les distribue en mémoire. */
        const tousLesIds = (tracking || [])
            .flatMap(t => [t.id, t.dossier_ref_id])
            .filter(Boolean) as string[]

        const CHAMPS_PIECE = 'id, dossier_id, file_name, file_url, file_type, status, created_at'
        type Piece = {
            id: string; dossier_id: string; file_name: string | null
            file_url: string | null; file_type: string | null
            status: string | null; created_at: string | null
        }

        let piecesParDossier = new Map<string, Piece[]>()
        if (tousLesIds.length > 0) {
            const [principales, deSecours] = await Promise.all([
                supabase.from('dossier_documents').select(CHAMPS_PIECE)
                    .in('dossier_id', tousLesIds).order('created_at', { ascending: false }),
                // La table historique : certains dossiers anciens n'ont que celle-ci.
                supabase.from('documents').select(CHAMPS_PIECE)
                    .in('dossier_id', tousLesIds).order('created_at', { ascending: false }),
            ])

            const indexer = (lignes: Piece[] | null) => {
                const carte = new Map<string, Piece[]>()
                for (const p of lignes || []) {
                    const liste = carte.get(p.dossier_id) || []
                    liste.push(p)
                    carte.set(p.dossier_id, liste)
                }
                return carte
            }
            const carteA = indexer(principales.data as Piece[] | null)
            const carteB = indexer(deSecours.data as Piece[] | null)
            // Priorité à la table courante ; la table historique ne sert qu'à
            // combler un dossier qui n'y a rien — exactement l'ancien repli.
            piecesParDossier = new Map([...carteB, ...carteA])
        }

        const dossiersWithDocs = (tracking || []).map((t) => {
            const ids = [t.id, t.dossier_ref_id].filter(Boolean) as string[]
            const documents = ids.flatMap(id => piecesParDossier.get(id) || [])
            return {
                id: t.id,
                status: statutMobile(t.statut),
                progress: typeof t.progression === 'number' ? t.progression : 0,
                service_type: t.service_type,
                notes: t.notes,
                created_at: t.created_at,
                updated_at: t.updated_at,
                documents,
            }
        })

        // ─── Conseiller assigné ───────────────────────────────────────────
        // L'assignation vit dans dossier_tracking.agent_assigne (voir
        // /api/admin/dossiers/assign). On remonte le dossier suivi le plus
        // récent qui possède un agent, puis son nom d'affichage.
        // On n'expose QUE le nom : ni l'e-mail, ni l'identifiant de l'agent.
        let advisor: { name: string } | null = null
        try {
            /* Même rattachement que la liste : compte OU email du profil. Sur le
               seul client_id, les dossiers déposés depuis le site (sans compte)
               n'avaient jamais de conseiller affiché. */
            const lireAgent = (q: ReturnType<typeof supabase.from>) => q
                .select('agent_assigne, updated_at')
                .not('agent_assigne', 'is', null)
                .order('updated_at', { ascending: false })
                .limit(1)
            const [aCompte, aEmail] = await Promise.all([
                lireAgent(supabase.from('dossier_tracking')).eq('client_id', clientId),
                email
                    ? lireAgent(supabase.from('dossier_tracking')).ilike('client_email', motifOuRien(email))
                    : Promise.resolve({ data: [] as Array<{ agent_assigne: string; updated_at: string }> }),
            ])
            const tracking = [...(aCompte.data || []), ...(aEmail.data || [])]
                .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0]

            if (tracking?.agent_assigne) {
                const { data: agent } = await supabase
                    .from('user_profiles')
                    .select('full_name, role')
                    .eq('id', tracking.agent_assigne)
                    .eq('role', 'agent')
                    .maybeSingle()

                const name = (agent?.full_name || '').trim()
                if (name) advisor = { name }
            }
        } catch {
            // Pas de conseiller remonté : l'app retombe sur « Équipe RGB ».
        }

        return NextResponse.json({ dossiers: dossiersWithDocs, advisor })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

/* ─── Tarif serveur d'un service payé directement depuis l'app ──────────────
   Seuls les services dont le prix est tenu en base (page_sections) sont
   rapprochés : Logement (frais de dossier) et Recherche Ancestrale. Les
   autres parcours payants passent par une COMMANDE (/api/checkout), déjà
   rapprochée par /api/checkout/verify. Renvoie le TTC en XOF, ou null. */
async function tarifServiceXof(serviceType: string): Promise<{ xof: number; devise: string } | null> {
    const s = serviceType.trim().toLowerCase()
    const cible = s === 'logement'
        ? { page: 'logement', montant: 'dossier_amount', devise: 'dossier_currency', defaut: 'EUR' }
        : (s === 'recherche ancestrale' || s === 'recherche-ancestrale')
            ? { page: 'nationalite', montant: 'recherche_ancestrale_amount', devise: 'recherche_ancestrale_currency', defaut: 'EUR' }
            : null
    if (!cible) return null
    const { data } = await supabase
        .from('page_sections').select('content')
        .eq('page', cible.page).eq('section_key', 'form_settings').maybeSingle()
    const c = (data?.content || {}) as Record<string, unknown>
    const ht = Number(c[cible.montant])
    if (!Number.isFinite(ht) || ht <= 0) return null
    const devise = String(c[cible.devise] || cible.defaut).toUpperCase()
    const ttc = ttcFromHt(ht, devise)
    const xof = await toXOFStrict(ttc, devise)
    return xof === null ? null : { xof, devise }
}

// ─── POST : créer un dossier (commande service depuis mobile) ─────────────────
//   Body : { client_id, service_type, service_id?, notes?, payment_tx_id?, transaction_id? }
//   Si payment_tx_id (ou transaction_id) est fourni : vérification Kkiapay côté serveur
//   pour éviter qu'un client malveillant crée un dossier sans payer.
export async function POST(req: NextRequest) {
    try {
        // ── WAF #2 : analyse structurelle du body (proto pollution / RCE / SSRF / DoS) ──
        const { body: scanned, rejection } = await scanRequestBody(req)
        if (rejection) return rejection
        // Identité dérivée du jeton (anti-IDOR) : on ignore tout client_id du corps
        const client_id = await getMobileUserId(req)
        if (!client_id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = (scanned ?? {}) as any
        // Les montants du corps (payment_amount, payment_currency) sont IGNORÉS :
        // seul le montant confirmé par la passerelle compte.
        const service_type = String(body.service_type || '').trim().slice(0, 120)
        const service_id = body.service_id ? String(body.service_id).trim().slice(0, 120) : null
        const notes = body.notes ? String(body.notes).slice(0, 4000) : null
        const txBrut = body.payment_tx_id || body.transaction_id
        const transactionId: string | undefined = txBrut ? String(txBrut).trim().slice(0, 128) : undefined

        if (!service_type) {
            return NextResponse.json(
                { error: 'service_type est requis' },
                { status: 400 }
            )
        }

        // ── Idempotence paiement + anti-fraude Kkiapay ──
        /* Montant CONFIRMÉ par la passerelle : il servira de base à la facture.
           Jamais celui annoncé par le téléphone — c'est la règle depuis
           l'incident des 0,39 € sur la nationalité. */
        let montantEncaisseXof = 0
        let noteMontant: string | null = null
        if (transactionId) {
            const emailClient = await emailDuProfil(supabase, client_id)
            const { usages, erreur } = await usagesTransaction(supabase, transactionId)
            if (erreur) return NextResponse.json({ error: 'Vérification indisponible' }, { status: 503 })

            // Rejeu : le dossier de CETTE transaction existe déjà.
            const dejaDossier = usages.find(u => u.table === 'dossier_tracking')
            if (dejaDossier) {
                if (!appartientAuClient(dejaDossier, client_id, emailClient)) {
                    /* Dossier déjà ouvert pour cette transaction sous un autre
                       email (ex. Recherche Ancestrale enregistrée sur l'email du
                       dossier nationalité) : succès idempotent pour la file de
                       reprise, mais rien n'est révélé de ce dossier. */
                    return NextResponse.json({ exists: true, message: 'Already created' }, { status: 200 })
                }
                const dejaFacture = usages.find(u => u.table === 'documents_financiers')
                const { data: f } = dejaFacture
                    ? await supabase.from('documents_financiers').select('id, numero').eq('id', dejaFacture.id).maybeSingle()
                    : { data: null }
                return NextResponse.json({
                    id: dejaDossier.id, exists: true, message: 'Already created',
                    facture_id: f?.id || null,
                    facture_numero: f?.numero || null,
                }, { status: 200 })
            }

            /* Une transaction déjà consommée ne s'emploie qu'une fois. Seule
               exception : la COMMANDE réglée (Fa, Permis : /api/checkout puis ce
               dossier avec la même référence) et sa facture. L'email de la
               commande est celui SAISI au formulaire, pas forcément celui du
               compte : la possession de la référence de transaction (connue du
               seul payeur) fait foi, et le dossier n'est ouvert qu'une fois. */
            const commandeLiee = usages.find(u => u.table === 'orders' && u.statut === 'completed')
            for (const u of usages) {
                const permis = (u.table === 'orders' && u.statut === 'completed')
                    || (u.table === 'documents_financiers' && (appartientAuClient(u, client_id, emailClient)
                        || (!!commandeLiee && appartientAuClient(u, null, String(commandeLiee.email || '')))))
                    || ((u.table === 'nationality_applications' || u.table === 'myafro_recap_requests') && appartientAuClient(u, null, emailClient))
                if (!permis) return NextResponse.json({ error: 'Transaction déjà utilisée' }, { status: 409 })
            }

            const verify = await verifierKkiapay(supabase, transactionId)
            if (!verify.ok) {
                console.warn(`[mobile/dossiers] Paiement non confirmé : ${verify.status}`)
                return NextResponse.json({ error: `Paiement non confirmé (${verify.status})` }, { status: 402 })
            }
            montantEncaisseXof = verify.montant

            // Rapprochement au tarif serveur (hors commande, déjà rapprochée).
            if (!commandeLiee) {
                const tarif = await tarifServiceXof(service_type)
                if (tarif) {
                    // 2 % de tolérance hors XOF : le téléphone convertit avec son propre taux.
                    const plancher = tarif.devise === 'XOF' ? tarif.xof : Math.floor(tarif.xof * 0.98)
                    if (!montantCouvert(montantEncaisseXof, plancher)) {
                        console.warn(`[mobile/dossiers] Montant insuffisant ${montantEncaisseXof} < ${tarif.xof} XOF (tx ${transactionId})`)
                        return NextResponse.json(
                            { error: `Montant encaissé insuffisant (${montantEncaisseXof} XOF pour ${tarif.xof} XOF). Référence : ${transactionId}` },
                            { status: 402 },
                        )
                    }
                } else {
                    noteMontant = `Montant encaissé : ${montantEncaisseXof} XOF (tx ${transactionId}) : aucun tarif serveur pour « ${service_type} », à rapprocher.`
                }
            }
        }

        // S'assurer que le client existe dans client_profiles + récupérer son identité
        let cp = (await supabase.from('client_profiles')
            .select('id, nom, prenom, email, phone').eq('id', client_id).maybeSingle()).data
        if (!cp) {
            const { data: authUser } = await supabase.auth.admin.getUserById(client_id)
            if (authUser?.user) {
                await supabase.from('client_profiles').upsert({
                    id: client_id,
                    email: authUser.user.email || '',
                    nom: authUser.user.user_metadata?.nom || null,
                    prenom: authUser.user.user_metadata?.prenom || null,
                    phone: authUser.user.user_metadata?.phone || null,
                    pays: 'France',
                }, { onConflict: 'id' })
                cp = (await supabase.from('client_profiles')
                    .select('id, nom, prenom, email, phone').eq('id', client_id).maybeSingle()).data
            }
        }

        /* ── FACTURE ────────────────────────────────────────────────────
           Un service payé donne lieu à une facture, point. Elle est établie
           AVANT la déduplication de dossier : un client qui règle une seconde
           prestation alors qu'un dossier du même type est encore ouvert a
           quand même payé, et doit recevoir sa facture. L'idempotence tient à
           la transaction, pas au dossier. */
        let facture: { id?: string; numero?: string } = {}
        if (transactionId && montantEncaisseXof > 0) {
            const r = await facturerPaiementService({
                transactionId,
                montantXof: montantEncaisseXof,
                libelle: String(service_type),
                clientId: client_id,
                clientNom: cp?.nom || null,
                clientPrenom: cp?.prenom || null,
                clientEmail: cp?.email || null,
                clientPhone: cp?.phone || null,
                provider: 'kkiapay',
                source: 'Application mobile',
            })
            if (r.ok) facture = { id: r.id, numero: r.numero }
            else console.error('[mobile/dossiers] facture non établie :', r.erreur)
        }

        // ── Anti-doublon : un dossier ACTIF pour ce service ne se recrée pas ──
        const { data: existing } = await supabase
            .from('dossier_tracking')
            .select('id')
            .eq('client_id', client_id)
            .eq('service_type', service_type)
            .in('statut', ACTIVE_TRACKING_STATUTS)
            .limit(1)
            .maybeSingle()
        if (existing) {
            return NextResponse.json({ exists: true, id: existing.id, facture_id: facture.id || null, facture_numero: facture.numero || null }, { status: 200 })
        }

        // ── Créer le dossier de SERVICE dans dossier_tracking (source unique,
        //    statut global 'reception', visible admin/agent + onglet Service Mobile) ──
        const numDossier = `DOS-${Date.now().toString(36).toUpperCase()}`
        const nowIso = new Date().toISOString()
        const { data, error } = await supabase
            .from('dossier_tracking')
            .insert({
                client_id,
                num_dossier: numDossier,
                client_nom: cp?.nom || '',
                client_prenom: cp?.prenom || '',
                client_email: cp?.email || '',
                client_phone: cp?.phone || '',
                service_type,
                service_id: service_id || null,
                statut: 'reception',
                progression: 10,
                etapes: [],
                notes: notes || null,
                notes_internes: noteMontant,
                source: 'mobile',
                transaction_id: transactionId || null,
                payment_method: transactionId ? 'kkiapay' : null,
                created_at: nowIso,
                updated_at: nowIso,
            })
            .select('id')
            .single()

        if (error) {
            console.error('[api/mobile/dossiers POST]', error)
            return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }

        // Notification client (cloche in-app)
        await supabase.from('notifications').insert({
            user_id: client_id,
            title: 'Dossier créé',
            body: `Votre dossier "${service_type}" a été créé. Notre équipe vous contactera sous 24h.`,
            type: 'dossier',
            is_read: false,
            created_at: nowIso,
        })

        return NextResponse.json({ id: data.id, facture_id: facture.id || null, facture_numero: facture.numero || null }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
