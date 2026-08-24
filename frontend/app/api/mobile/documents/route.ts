import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { lienSigne } from '@/lib/livrables'

/* ═══════════════════════════════════════════════════════════
   GET /api/mobile/documents — tout ce qui appartient au client, en un appel.

   L'écran « Mes documents » interrogeait quatre routes en parallèle et
   recollait les morceaux côté téléphone. Ça marchait, mais chaque nouveau
   type de document imposait de modifier l'application — donc un build, donc
   une attente. Et surtout, les LIVRABLES de l'agence (fiches d'analyse) ne
   figuraient nulle part, faute d'exister en base.

   Cette route rassemble cinq sources et rend une forme unique :

     livrable    ← client_documents, origine 'agence'  ← LA NOUVEAUTÉ
     piece       ← client_documents, origine 'client' + pièces de dossier
     facture     ← documents_financiers (type facture)
     devis       ← documents_financiers (type devis)
     recap       ← myafro_recap_requests (avec l'analyse rédigée)

   Le rattachement se fait par identifiant de compte ET par e-mail : un
   dossier déposé depuis le site précède souvent l'ouverture du compte
   mobile, et ces documents seraient invisibles sans le second critère.

   Identité prise dans le JETON, jamais dans la requête : c'est ce qui
   empêche de lire les documents d'autrui en changeant un paramètre.
   ═══════════════════════════════════════════════════════════ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type CategorieDoc = 'livrable' | 'facture' | 'devis' | 'recap' | 'piece' | 'proposition'

interface DocSortie {
    id: string
    categorie: CategorieDoc
    titre: string
    detail: string
    date: string
    /** Lien signé, court, quand un fichier est réellement téléchargeable. */
    lien?: string | null
    /** Texte long à lire dans l'application (analyse d'un récap). */
    texte?: string | null
    /** Écran de destination quand il n'y a pas de fichier à ouvrir. */
    cible?: string | null
    cibleId?: string | null
}

export async function GET(request: NextRequest) {
    const userId = await getMobileUserId(request)
    if (!userId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: profil } = await supabase
        .from('client_profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle()

    const email = (profil?.email || '').toLowerCase().trim()
    const documents: DocSortie[] = []

    /* ── 1. Livrables de l'agence et pièces du client ──────────
       Même table, deux sens de circulation. On demande les deux d'un coup
       et on trie ensuite : une requête au lieu de deux. */
    /* DEUX lectures plutôt qu'un `.or()` : un e-mail peut contenir les
       caractères qui servent de séparateurs à PostgREST, et une requête mal
       échappée renverrait les documents de tout le monde. La route des
       factures avait déjà tiré cette leçon ; on ne la réapprend pas. */
    const champsFichiers = 'id, origine, categorie, titre, nom_fichier, storage_path, taille, created_at'

    const parCompte = await supabase
        .from('client_documents')
        .select(champsFichiers)
        .eq('client_id', userId)
        .order('created_at', { ascending: false })
        .limit(200)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fichiers: any[] = parCompte.data || []

    if (email) {
        const parEmail = await supabase
            .from('client_documents')
            .select(champsFichiers)
            .ilike('client_email', email)
            .is('client_id', null)      // le compte a déjà été servi ci-dessus
            .order('created_at', { ascending: false })
            .limit(200)
        if (parEmail.data?.length) fichiers = fichiers.concat(parEmail.data)
    }

    for (const f of fichiers) {
        const estLivrable = String(f.origine || 'client') === 'agence'
        /* Lien signé et court : une fiche d'analyse contient l'état civil et
           la filiation, elle ne doit jamais être servie par une URL publique
           devinable. */
        const lien = f.storage_path ? await lienSigne(String(f.storage_path)) : null
        documents.push({
            id: `doc-${f.id}`,
            categorie: estLivrable ? 'livrable' : 'piece',
            titre: String(f.titre || f.nom_fichier || 'Document'),
            detail: estLivrable ? 'Remis par Retour Gagnant' : 'Pièce que vous avez déposée',
            date: String(f.created_at || ''),
            lien,
        })
    }

    /* ── 2. Factures et devis ─────────────────────────────────
       Même table `documents_financiers`, distinguées par `type`. */
    {
        const champsFin = 'id, type, numero, total, currency, status, created_at'
        const finCompte = await supabase
            .from('documents_financiers')
            .select(champsFin)
            .eq('client_id', userId)
            .order('created_at', { ascending: false })
            .limit(100)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let financiers: any[] = finCompte.data || []

        if (email) {
            const finEmail = await supabase
                .from('documents_financiers')
                .select(champsFin)
                .ilike('client_email', email)
                .is('client_id', null)
                .order('created_at', { ascending: false })
                .limit(100)
            if (finEmail.data?.length) financiers = financiers.concat(finEmail.data)
        }

        for (const d of financiers) {
            const estDevis = String(d.type || '').toLowerCase() === 'devis'
            documents.push({
                id: `fin-${d.id}`,
                categorie: estDevis ? 'devis' : 'facture',
                titre: `${estDevis ? 'Devis' : 'Facture'} ${d.numero || ''}`.trim(),
                detail: [
                    d.status ? String(d.status) : null,
                    d.total != null ? `${Number(d.total).toLocaleString('fr-FR')} ${d.currency || 'FCFA'}` : null,
                ].filter(Boolean).join(' · '),
                date: String(d.created_at || ''),
                cible: 'Invoices',
            })
        }
    }

    /* ── 3. Récaps MyAfroOrigins ──────────────────────────────
       `recap_ia` est l'analyse rédigée par l'agence. Elle était stockée mais
       n'apparaissait qu'au fond du parcours du service : on la renvoie ici
       pour qu'elle se lise depuis « Mes documents ». */
    if (email) {
        const { data: recaps } = await supabase
            .from('myafro_recap_requests')
            .select('id, reference, statut, recap_ia, created_at')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(50)

        for (const r of recaps || []) {
            documents.push({
                id: `rec-${r.id}`,
                categorie: 'recap',
                titre: r.reference ? `Récap MyAfroOrigins ${r.reference}` : 'Récap MyAfroOrigins',
                detail: r.recap_ia ? 'Analyse disponible' : String(r.statut || 'en cours'),
                date: String(r.created_at || ''),
                texte: r.recap_ia ? String(r.recap_ia) : null,
                cible: 'RecapMyafroDemande',
            })
        }
    }

    /* ── 4. Propositions de séjour ──────────────────────────────
       Table `ai_client_proposals`, et surtout : une proposition rattachée
       par e-mail n'est visible QUE si l'agence l'a explicitement envoyée au
       mobile (`sent_to_mobile`). Cette règle vient de la route existante ;
       la contourner ici montrerait au client des brouillons de devis. */
    {
        const champsProp = 'id, destination, status, signed_at, created_at, sent_to_mobile'
        const propCompte = await supabase
            .from('ai_client_proposals')
            .select(champsProp)
            .eq('client_id', userId)
            .order('created_at', { ascending: false })
            .limit(50)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let props: any[] = propCompte.data || []

        if (email) {
            const propEmail = await supabase
                .from('ai_client_proposals')
                .select(champsProp)
                .ilike('client_email', email)
                .eq('sent_to_mobile', true)
                .is('client_id', null)
                .order('created_at', { ascending: false })
                .limit(50)
            if (propEmail.data?.length) props = props.concat(propEmail.data)
        }

        for (const p of props) {
            documents.push({
                id: `prop-${p.id}`,
                categorie: 'proposition',
                titre: p.destination ? `Séjour — ${p.destination}` : 'Proposition de séjour',
                detail: [String(p.status || ''), p.signed_at ? 'signée' : null].filter(Boolean).join(' · '),
                date: String(p.created_at || ''),
                cible: 'PropositionDetail',
                cibleId: String(p.id),
            })
        }
    }

    documents.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    return NextResponse.json({ documents })
}
