import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { recordNationalityIncome } from '@/lib/nationality-income'

/* ═══════════════════════════════════════════════════════════════
   CRÉATION MANUELLE D'UN DOSSIER DE NATIONALITÉ

   Tous les dossiers naissaient du formulaire public, donc d'un paiement
   Kkiapay. Or une partie des clients ne peut pas payer par ce canal — une
   carte émise hors zone UEMOA est refusée avant même l'authentification — et
   règle autrement : Mobile Money de la main à la main, virement, TapTap Send,
   espèces à l'agence. Leur dossier n'existait alors NULLE PART : ni suivi, ni
   pièces, ni facture. Il vivait dans une boîte mail.

   Cette route ouvre le dossier depuis le panneau, avec le moyen de paiement
   réellement employé. Les pièces se déposent ensuite par la chaîne déjà en
   place (`/api/nationality/upload-file` puis `[id]/add-documents`) : aucun
   second mécanisme concurrent n'est introduit.

   TROIS PRÉCAUTIONS

   1. Personnel uniquement (`requireStaff`). Un dossier créé ici est réputé
      payé sur parole : c'est un acte de gestion, jamais une porte publique.

   2. Le moyen de paiement est validé CONTRE UNE LISTE côté serveur. Le
      formulaire n'est pas une garantie — un appel direct à l'API en est
      dépourvu.

   3. Le montant vient de la configuration (`page_sections`), comme dans le
      flux public, sauf si le personnel saisit explicitement un autre montant
      — cas réel d'un règlement partiel ou d'un geste commercial, qui doit
      alors rester visible tel quel en comptabilité.
   ═══════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

/** Moyens de règlement acceptés hors passerelle en ligne. */
export const MOYENS_PAIEMENT = {
    momo: 'Mobile Money',
    rib: 'Virement bancaire (RIB)',
    kkiapay: 'Kkiapay',
    taptap: 'TapTap Send',
    especes: 'Espèces',
    autre: 'Autre',
    /* Dossier offert : aucune somme n est encaissee, donc aucune facture.
       Present dans la liste pour que le moyen soit NOMME plutot que devine. */
    invitation: "Code d'invitation (offert)",
} as const

type MoyenPaiement = keyof typeof MOYENS_PAIEMENT

const texte = (v: unknown, max = 200): string | null => {
    const s = String(v ?? '').replace(/[\r\n]+/g, ' ').trim()
    return s ? s.slice(0, max) : null
}
/** Une date vide doit valoir `null` : PostgreSQL refuse la chaîne vide. */
const date = (v: unknown): string | null => {
    const s = String(v ?? '').trim()
    return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
/**
 * Booléen à TROIS états. « Non renseigné » ne vaut pas « non » : ignorer la
 * différence reviendrait à déclarer mort un ascendant dont on ignore le sort.
 */
const oui = (v: unknown): boolean | null => {
    const s = String(v ?? '').trim().toLowerCase()
    if (['oui', 'true', '1', 'yes'].includes(s)) return true
    if (['non', 'false', '0', 'no'].includes(s)) return false
    return null
}

/** Étapes du suivi, identiques à celles du flux public. */
function etapesNationalite() {
    return [
        { id: 1, label: 'Réception du dossier', status: 'completed', date: new Date().toISOString().split('T')[0], note: 'Saisie par l’équipe' },
        { id: 2, label: 'Vérification des pièces justificatives', status: 'pending', date: null, note: '' },
        { id: 3, label: 'Contrôle de conformité juridique', status: 'pending', date: null, note: '' },
        { id: 4, label: 'Instruction du dossier (Ministère)', status: 'pending', date: null, note: '' },
        { id: 5, label: 'Commission de validation', status: 'pending', date: null, note: '' },
        { id: 6, label: 'Décision et notification', status: 'pending', date: null, note: '' },
        { id: 7, label: 'Délivrance du certificat', status: 'pending', date: null, note: '' },
    ]
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    // ── Le strict nécessaire pour qu'un dossier soit exploitable ──
    const nom = texte(body.nom, 80)
    const prenom = texte(body.prenom, 80)
    const email = texte(body.email, 160)?.toLowerCase() || null
    if (!nom || !prenom || !email) {
        return NextResponse.json(
            { error: 'Nom, prénom et email sont indispensables : sans eux le dossier ne peut être ni suivi ni relié à un client.' },
            { status: 400 },
        )
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
    }

    // ── Moyen de paiement : validé contre la liste, jamais accepté tel quel ──
    const moyenBrut = String(body.payment_method ?? '').trim().toLowerCase()
    if (!(moyenBrut in MOYENS_PAIEMENT)) {
        return NextResponse.json(
            { error: `Moyen de paiement inconnu. Attendu : ${Object.keys(MOYENS_PAIEMENT).join(', ')}.` },
            { status: 400 },
        )
    }
    const moyen = moyenBrut as MoyenPaiement
    const referencePaiement = texte(body.payment_ref, 120)
    const paye = body.payment_status !== 'en_attente'

    /* Un règlement « autre » sans précision est ingérable en comptabilité :
       on exige alors une note. */
    if (moyen === 'autre' && !referencePaiement) {
        return NextResponse.json(
            { error: 'Moyen « Autre » : précisez la référence ou la nature du règlement.' },
            { status: 400 },
        )
    }

    // ── Montant : configuration par défaut, saisie explicite sinon ──
    const { data: fsRow } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'nationalite').eq('section_key', 'form_settings').maybeSingle()
    const fs = (fsRow?.content || {}) as Record<string, unknown>
    const tarifConfig = Number(fs.amount)
    const deviseConfig = String(fs.currency || 'EUR').toUpperCase()

    const montantSaisi = Number(body.amount)
    const montant = isFinite(montantSaisi) && montantSaisi >= 0
        ? montantSaisi
        : (isFinite(tarifConfig) && tarifConfig > 0 ? tarifConfig : null)
    const devise = texte(body.currency, 8)?.toUpperCase() || deviseConfig

    const ref = `RG-NAT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

    const noteEquipe = [
        `Dossier saisi manuellement dans le panneau le ${new Date().toLocaleDateString('fr-FR')}.`,
        `Règlement : ${MOYENS_PAIEMENT[moyen]}${referencePaiement ? ` — ${referencePaiement}` : ''}.`,
        texte(body.agent_notes, 800) || '',
    ].filter(Boolean).join('\n')

    const insertion: Record<string, unknown> = {
        application_ref: ref,
        status: texte(body.status, 40) || 'soumis',
        submitted_at: new Date().toISOString(),

        nom, prenom, email,
        telephone: texte(body.telephone, 40),
        genre: texte(body.genre, 20),
        date_naissance: date(body.date_naissance),
        pays_naissance: texte(body.pays_naissance, 80),
        ville_naissance: texte(body.ville_naissance, 80),
        nationalite: texte(body.nationalite, 80) || 'Non spécifiée',
        pays_residence: texte(body.pays_residence, 80),
        adresse_residence: texte(body.adresse_residence, 300),
        profession: texte(body.profession, 120),
        demande_depuis_benin: oui(body.demande_depuis_benin) === true,

        knows_about_law: true,
        is_afro_descendant: body.is_afro_descendant === false ? false : true,
        afro_descendant_description: texte(body.afro_descendant_description, 2000) || '',

        ancestor1_nom: texte(body.ancestor1_nom, 80),
        ancestor1_prenom: texte(body.ancestor1_prenom, 80),
        ancestor1_date_naissance: date(body.ancestor1_date_naissance),
        ancestor1_lien_parente: texte(body.ancestor1_lien_parente, 60),
        ancestor1_nationalite: texte(body.ancestor1_nationalite, 80),
        ancestor1_pays_residence: texte(body.ancestor1_pays_residence, 80),
        ancestor1_vivant: oui(body.ancestor1_vivant),
        ancestor1_autres_infos: texte(body.ancestor1_autres_infos, 500),

        ancestor2_nom: texte(body.ancestor2_nom, 80),
        ancestor2_prenom: texte(body.ancestor2_prenom, 80),
        ancestor2_date_naissance: date(body.ancestor2_date_naissance),
        ancestor2_lien_parente: texte(body.ancestor2_lien_parente, 60),
        ancestor2_nationalite: texte(body.ancestor2_nationalite, 80),
        ancestor2_pays_residence: texte(body.ancestor2_pays_residence, 80),
        ancestor2_vivant: oui(body.ancestor2_vivant),
        ancestor2_autres_infos: texte(body.ancestor2_autres_infos, 500),

        type_document_identite: texte(body.type_document_identite, 60),
        numero_document: texte(body.numero_document, 80),
        date_expiration_document: date(body.date_expiration_document),
        pays_delivrance: texte(body.pays_delivrance, 80),
        lieu_delivrance: texte(body.lieu_delivrance, 80),
        autorite_delivrance: texte(body.autorite_delivrance, 120),

        pere_nom: texte(body.pere_nom, 80),
        pere_prenom: texte(body.pere_prenom, 80),
        pere_date_naissance: date(body.pere_date_naissance),
        mere_nom: texte(body.mere_nom, 80),
        mere_prenom: texte(body.mere_prenom, 80),
        mere_date_naissance: date(body.mere_date_naissance),

        documents_uploaded: [],
        amount: montant,
        currency: devise,
        payment_status: paye ? 'payé' : 'en_attente',
        payment_method: moyen,
        payment_ref: referencePaiement,
        last_step_completed: 6,
        agent_notes: noteEquipe,

        situation_matrimoniale: texte(body.situation_matrimoniale, 40),
        nombre_enfants: Number.isInteger(Number(body.nombre_enfants)) ? Number(body.nombre_enfants) : 0,
        motivation_lettre: texte(body.motivation_lettre, 4000),
        consentement_rgpd: true,
    }

    const { data: cree, error } = await supabase
        .from('nationality_applications')
        .insert([insertion])
        .select('id, application_ref')
        .single()

    if (error || !cree) {
        return NextResponse.json(
            { error: `Création refusée par la base : ${error?.message || 'raison inconnue'}` },
            { status: 500 },
        )
    }

    /* Suivi : sans cette ligne, le dossier n'apparaîtrait ni dans
       /admin/dossiers, ni dans « Mon Dossier » côté client. Un échec ici ne
       doit pas annuler la création — le dossier existe, le suivi se rattrape. */
    const { error: erreurSuivi } = await supabase.from('dossier_tracking').insert({
        num_dossier: cree.application_ref,
        client_nom: nom,
        client_prenom: prenom,
        client_email: email,
        client_whatsapp: texte(body.telephone, 40) || '',
        client_phone: texte(body.telephone, 40) || '',
        service_type: 'Reconnaissance de Nationalité',
        service: 'nationalite',
        statut: 'reception',
        etapes: etapesNationalite(),
        progression: Math.round((1 / 7) * 100),
        source: 'admin',
        payment_method: moyen,
        transaction_id: referencePaiement,
        notes_internes: noteEquipe,
    })

    /* ── COMPTABILITÉ ────────────────────────────────────────────────
       Le flux public facture déjà (recordNationalityIncome, appelé par
       /api/nationality et le webhook Kkiapay). Un dossier saisi à la main
       doit produire la MÊME facture, sur la même série de numéros, avec la
       TVA en sus — sinon l'encaissement n'existe pour personne : ni le
       client, qui n'a aucun justificatif, ni la comptabilité.

       DEUX CAS À NE PAS CONFONDRE :

       · un règlement réel (Mobile Money, virement, TapTap Send, espèces)
         → facture au statut payé, avec le moyen employé ;

       · un dossier OFFERT par code d'invitation, ou encore en attente
         → aucune facture. Facturer 260 € qui n'ont jamais été encaissés
         inventerait une recette : la comptabilité afficherait un revenu
         que la banque ne verra jamais. Le dossier reste tracé par sa note
         interne et son moyen de paiement.

       La facturation est idempotente (source_ref « nationality:REF ») et
       ne doit jamais faire échouer la création : le dossier existe, le
       retour dit ce qui a réellement eu lieu. */
    let facture = false
    let erreurFacture: string | null = null
    const montantEncaisse = typeof montant === 'number' ? montant : 0

    if (paye && moyen !== 'invitation' && montantEncaisse > 0) {
        try {
            await recordNationalityIncome(supabase, {
                ref: cree.application_ref,
                nom, prenom, email,
                phone: texte(body.telephone, 40),
                amount: montantEncaisse,
                currency: devise,
                paymentMethod: MOYENS_PAIEMENT[moyen],
                txId: referencePaiement,
            })
            facture = true
        } catch (e) {
            erreurFacture = e instanceof Error ? e.message : 'facturation interrompue'
        }
    }

    const avertissements = [
        erreurSuivi
            ? `Le suivi n'a pas pu être créé (${erreurSuivi.message}) : le dossier n'apparaîtra pas dans « Mon Dossier » tant qu'il n'est pas rétabli.`
            : null,
        erreurFacture
            ? `La facture n'a pas pu être émise (${erreurFacture}). L'encaissement n'apparaît donc pas encore en comptabilité.`
            : null,
    ].filter(Boolean)

    return NextResponse.json({
        success: true,
        id: cree.id,
        reference: cree.application_ref,
        suivi: !erreurSuivi,
        facture,
        avertissement: avertissements.length ? avertissements.join(' ') : null,
    })
}
