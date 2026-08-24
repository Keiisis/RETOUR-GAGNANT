import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'

/* ════════════════════════════════════════════════════════════════════════════
   Devis et factures d'un client, pour l'application.

   ⚠️ Cette route lisait la table `invoices` — VIDE en production (0 ligne).
   L'écran « Mes factures » ne pouvait donc RIEN afficher, quoi qu'on achète :
   toute la facturation de l'agence vit dans `documents_financiers` (même table
   que le panel, même numérotation OHADA, même comptabilité), alimentée par
   `lib/service-invoice.ts` et `lib/document-payment.ts`.

   On sert donc les deux natures de document depuis la source réelle :
     · `invoices` → les FACTURES (clé conservée : l'application et la base
       locale SQLite la lisent déjà sous ce nom) ;
     · `devis`    → les DEVIS, qui n'étaient accessibles QUE depuis le web.

   Appartenance, deux verrous (dans cet ordre, comme `lib/mobile-facture.ts`) :
     · le compte (`client_id`), lien le plus fort ;
     · à défaut l'EMAIL DU PROFIL rattaché au jeton — jamais un email de
       requête. Ce repli est indispensable : les documents nés d'un formulaire
       web (nationalité, récap, portail) ne portent pas toujours le compte.

   GET                → { invoices: [...], devis: [...] }
   GET ?id=…          → { invoice: {...} } (facture OU devis, si elle est à lui)
   ════════════════════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CHAMPS = `
    id, type, numero, client_id, client_nom, client_prenom, client_email, client_phone,
    items, currency, sous_total, total_tva, remise, total, status, notes,
    conditions, validite, due_date, signature_url, signed_at,
    payment_method, payment_provider, payment_transaction_id, paid_at,
    created_at, updated_at
`

/* Statut du panel → statut connu de l'application (`paid` / `pending` /
   `cancelled`). Le statut d'origine reste transmis : l'écran affiche le mot
   juste pour un devis (« Envoyé », « Signé »…), qui n'est pas une facture. */
const STATUT_APP: Record<string, 'paid' | 'pending' | 'cancelled'> = {
    paye: 'paid',
    payee: 'paid',
    paid: 'paid',
    brouillon: 'pending',
    envoye: 'pending',
    accepte: 'pending',
    signe: 'pending',
    en_attente: 'pending',
    impaye: 'pending',
    annule: 'cancelled',
    refuse: 'cancelled',
    expire: 'cancelled',
}

interface LigneDoc { description?: string; title?: string; name?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliser(d: any) {
    const lignes: LigneDoc[] = Array.isArray(d.items) ? d.items : []
    /* L'objet du document : la première ligne facturée. À défaut la première
       ligne des notes — jamais un libellé inventé. */
    const objet = String(
        lignes[0]?.description || lignes[0]?.title || lignes[0]?.name
        || String(d.notes || '').split('\n')[0]
        || (d.type === 'devis' ? 'Devis' : 'Facture'),
    )
    const nom = [d.client_prenom, d.client_nom].filter(Boolean).join(' ').trim()

    return {
        id: d.id,
        type: d.type as 'facture' | 'devis',
        // Clés historiques : l'écran et la base locale les lisent déjà.
        invoice_ref: d.numero || String(d.id).slice(0, 8).toUpperCase(),
        numero: d.numero,
        customer_name: nom,
        amount: Number(d.total) || 0,
        total: Number(d.total) || 0,
        currency: d.currency || 'XOF',
        description: objet,
        status: STATUT_APP[String(d.status || '').toLowerCase()] || 'pending',
        raw_status: d.status,
        issued_at: d.created_at,
        paid_at: d.paid_at,
        due_date: d.due_date,
        validite: d.validite,
        signed_at: d.signed_at,
        // Le reçu part avec la facture : il n'existe pas de facture payée sans
        // email envoyé par `sendDocumentPaymentEmails`.
        sent_to_email: !!d.paid_at,
        pdf_url: null,
        items: lignes,
        sous_total: d.sous_total,
        total_tva: d.total_tva,
        remise: d.remise,
        notes: d.notes,
        payment_method: d.payment_method || d.payment_provider,
        client_email: d.client_email,
        created_at: d.created_at,
    }
}

/** Email du profil rattaché au jeton (jamais un email transmis par l'appelant). */
async function emailDuProfil(clientId: string): Promise<string> {
    const { data } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    return String(data?.email || '').trim().toLowerCase()
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const docId = url.searchParams.get('id')

        // Identité dérivée du jeton (anti-IDOR)
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const email = await emailDuProfil(clientId)

        if (docId) {
            const { data, error } = await supabase
                .from('documents_financiers')
                .select(CHAMPS)
                .eq('id', docId)
                .maybeSingle()
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })

            const aLui = !!data && (
                data.client_id === clientId
                || (!!email && String(data.client_email || '').trim().toLowerCase() === email)
            )
            /* Le document d'un autre répond comme s'il n'existait pas :
               distinguer les deux cas renseignerait un tiers. */
            if (!aLui) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

            return NextResponse.json({ invoice: normaliser(data) })
        }

        /* Deux lectures plutôt qu'un `.or()` : l'email d'un client peut contenir
           les caractères qui servent de séparateurs à PostgREST, et une requête
           mal échappée renverrait alors les documents de tout le monde. */
        const parCompte = await supabase
            .from('documents_financiers')
            .select(CHAMPS)
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(200)
        if (parCompte.error) {
            return NextResponse.json({ error: parCompte.error.message }, { status: 500 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lignes: any[] = parCompte.data || []

        if (email) {
            const parEmail = await supabase
                .from('documents_financiers')
                .select(CHAMPS)
                .ilike('client_email', email)
                .is('client_id', null)      // le compte a déjà été servi ci-dessus
                .order('created_at', { ascending: false })
                .limit(200)
            if (parEmail.data?.length) lignes = lignes.concat(parEmail.data)
        }

        const vus = new Set<string>()
        const docs = lignes
            .filter(d => (vus.has(d.id) ? false : (vus.add(d.id), true)))
            .map(normaliser)
            .sort((a, b) => new Date(b.issued_at || 0).getTime() - new Date(a.issued_at || 0).getTime())

        return NextResponse.json({
            invoices: docs.filter(d => d.type !== 'devis'),
            devis: docs.filter(d => d.type === 'devis'),
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}