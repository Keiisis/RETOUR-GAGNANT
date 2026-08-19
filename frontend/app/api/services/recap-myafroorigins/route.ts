// ══════════════════════════════════════════════════════════════
//  Service « Récap de dossier MyAfroOrigins » — dépôt d'une demande.
//
//  Jusqu'ici, reprendre un dossier bloqué chez MyAfroOrigins supposait qu'un
//  agent envoie un lien au client. Le client ne pouvait pas venir de lui-même.
//  Cette route ouvre la porte dans l'autre sens : il décrit sa situation,
//  règle 50 €, et une fiche d'analyse est produite puis remise à l'équipe.
//
//  Le paiement est PROUVÉ avant la moindre écriture — la leçon du 2026-08-19 :
//  vérifier qu'une transaction existe ne suffit pas, il faut vérifier qu'elle
//  couvre le tarif lu en base.
//
//  Données personnelles (Code du numérique béninois, loi n° 2017-20) :
//  consentement explicite exigé et horodaté, collecte minimale, échéance de
//  conservation posée dès l'enregistrement.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, PUBLIC_FORM_LIMIT, flowKey } from '@/lib/api-guard'
import { toXOFStrict } from '@/lib/server-rates'
import { ttcFromHt } from '@/lib/tax'
import { fetchWithGroqRotation, GROQ_MODEL } from '@/lib/groq'
import { sendEmail, EMAIL_WRAPPER, emailInfoCard } from '@/lib/email'
import { ouvrirDossier } from '@/lib/dossier-service'
import { facturerPaiementService } from '@/lib/service-invoice'
import { getMobileUserId } from '@/lib/mobile-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/** Version du texte d'information soumis au client : elle est consignée avec
 *  le consentement, faute de quoi on ne saurait pas à QUOI il a consenti. */
const VERSION_CONSENTEMENT = '2026-08-20'

/** Conservation : 3 ans après le dépôt, aligné sur la durée d'un accompagnement
 *  administratif et sur la prescription commerciale usuelle. */
const CONSERVATION_ANNEES = 3

const LIMITES = { court: 120, moyen: 200, long: 4000 }

/** Tarif officiel du récap, en XOF TTC. `null` si introuvable. */
async function tarifRecapXof(): Promise<{ xof: number | null; montant: number; devise: string }> {
    const { data } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'recap-myafroorigins').eq('section_key', 'form_settings').maybeSingle()

    const c = (data?.content || {}) as Record<string, unknown>
    const montant = Number(c.amount) > 0 ? Number(c.amount) : 50
    const devise = String(c.currency || 'EUR').toUpperCase()
    const brut = await toXOFStrict(montant, devise)
    return { xof: brut === null ? null : ttcFromHt(brut, 'XOF'), montant, devise }
}

/** Confronte la transaction à la passerelle PUIS au tarif. `null` = conforme. */
async function refusPaiement(provider: string, txId: string, attenduXof: number | null): Promise<string | null> {
    if (!txId) return 'Référence de transaction manquante.'

    const sousPaye = (paye: number) =>
        attenduXof !== null && isFinite(paye) && paye > 0 && paye < attenduXof * 0.98

    if (provider === 'kkiapay') {
        const { data: rows } = await supabase.from('settings').select('key, value')
            .in('key', ['kkiapay_private_key', 'kkiapay_secret_key', 'kkiapay_sandbox'])
        const sm: Record<string, string> = {}
        for (const r of rows || []) sm[r.key] = r.value
        // Fail-closed : sans clé, aucune preuve possible.
        if (!sm.kkiapay_private_key || !sm.kkiapay_secret_key) return 'Vérification indisponible.'

        const base = sm.kkiapay_sandbox === 'true' ? 'https://api-sandbox.kkiapay.me' : 'https://api.kkiapay.me'
        try {
            const res = await fetch(`${base}/api/v1/transactions/status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-private-key': sm.kkiapay_private_key,
                    'x-secret-key': sm.kkiapay_secret_key,
                },
                body: JSON.stringify({ transactionId: txId }),
            })
            const d = await res.json().catch(() => ({}))
            if (d?.status !== 'SUCCESS') return `Paiement non confirmé (${d?.status || 'inconnu'}).`
            if (sousPaye(Number(d?.amount))) {
                return `Montant insuffisant : ${d.amount} XOF reçus pour ${attenduXof} XOF attendus.`
            }
            return null
        } catch { return 'Passerelle injoignable.' }
    }

    if (provider === 'fedapay') {
        const { data: rows } = await supabase.from('settings').select('key, value')
            .in('key', ['fedapay_secret_key', 'fedapay_sandbox'])
        const sm: Record<string, string> = {}
        for (const r of rows || []) sm[r.key] = r.value
        if (!sm.fedapay_secret_key) return 'Vérification indisponible.'

        const base = sm.fedapay_sandbox === 'true' ? 'https://sandbox-api.fedapay.com' : 'https://api.fedapay.com'
        try {
            const res = await fetch(`${base}/v1/transactions/${encodeURIComponent(txId)}`, {
                headers: { Authorization: `Bearer ${sm.fedapay_secret_key}` },
            })
            const d = await res.json().catch(() => ({}))
            const tx = d?.['v1/transaction'] || d?.transaction || d
            if (String(tx?.status).toLowerCase() !== 'approved') {
                return `Paiement non confirmé (${tx?.status || 'inconnu'}).`
            }
            if (sousPaye(Number(tx?.amount))) {
                return `Montant insuffisant : ${tx.amount} XOF reçus pour ${attenduXof} XOF attendus.`
            }
            return null
        } catch { return 'Passerelle injoignable.' }
    }

    return 'Ce moyen de paiement doit être confirmé par nos équipes.'
}

/** La fiche d'analyse. Elle décrit ce qui bloque, jamais une promesse de résultat. */
async function genererRecap(d: Record<string, string>): Promise<string | null> {
    const systeme = [
        'Tu es analyste de dossiers au agence Retour Gagnant Bénin. Tu rédiges la fiche',
        '« RÉCAP DE DOSSIER MYAFROORIGINS » remise à un afro-descendant dont la demande,',
        'déposée sur la plateforme MyAfroOrigins, n\'avance plus.',
        '',
        'STRUCTURE IMPOSÉE (titres en majuscules, pas de markdown, pas d\'astérisques) :',
        '1. SITUATION — reformulation fidèle et sobre de ce que le client décrit.',
        '2. CE QUI BLOQUE VRAISEMBLABLEMENT — hypothèses hiérarchisées, formulées comme',
        '   des hypothèses ; distingue ce qui relève de la plateforme, du dossier lui-même',
        '   et des pièces d\'état civil.',
        '3. PIÈCES À RÉUNIR — liste concrète, dans l\'ordre où les obtenir.',
        '4. MARCHE À SUIVRE — étapes numérotées, une action par étape, réalisables.',
        '5. CE QUE LE CABINET PREND EN CHARGE — ce que nos équipes font ensuite.',
        '',
        'RÈGLES ABSOLUES :',
        '— N\'invente aucun délai officiel, aucun numéro de dossier, aucune référence de loi',
        '  que le client n\'a pas fournie. La seule loi citable est la loi n° 2024-31 sur la',
        '  nationalité béninoise pour les afro-descendants.',
        '— Ne promets JAMAIS l\'obtention de la nationalité ni un délai garanti.',
        '— Si une information manque pour trancher, écris-le et indique quoi demander.',
        '— Français clair, vouvoiement, phrases courtes. 450 mots maximum.',
    ].join('\n')

    const contexte = [
        `Nom : ${d.prenom} ${d.nom}`,
        `Pays de résidence : ${d.pays_residence || 'non précisé'}`,
        `Référence MyAfroOrigins : ${d.myafro_reference || 'non communiquée'}`,
        `Demande déposée depuis : ${d.depuis_quand || 'non précisé'}`,
        '',
        'Situation décrite par le client :',
        d.situation,
        '',
        `Attentes exprimées : ${d.attentes || 'non précisées'}`,
    ].join('\n')

    try {
        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systeme },
                { role: 'user', content: contexte },
            ],
            temperature: 0.35,
            max_tokens: 1400,
        })
        const json = await res.json()
        if (!res.ok) return null
        return String(json?.choices?.[0]?.message?.content || '').trim() || null
    } catch {
        // L'analyse est un confort, pas la prestation : l'équipe la rédige à la
        // main si le modèle est indisponible. On n'échoue pas le dépôt payé.
        return null
    }
}

export async function POST(request: NextRequest) {
    const trop = guardPublic(request, 'services/recap-myafroorigins', PUBLIC_FORM_LIMIT, flowKey(request))
    if (trop) return trop

    const body = await request.json().catch(() => ({}))

    const txt = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
    const nom = txt(body.nom, LIMITES.court)
    const prenom = txt(body.prenom, LIMITES.court)
    const email = txt(body.email, LIMITES.moyen).toLowerCase()
    const telephone = txt(body.telephone, 40)
    const situation = txt(body.situation, LIMITES.long)

    if (!nom || !prenom || !email || !telephone || !situation) {
        return NextResponse.json({ error: 'Nom, prénom, email, téléphone et description sont requis.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
    }
    if (situation.length < 40) {
        return NextResponse.json(
            { error: 'Décrivez votre situation en quelques phrases : c’est la matière de l’analyse.' },
            { status: 400 },
        )
    }

    // ── Consentement : condition d'existence de la donnée ──────────
    if (body.consentement !== true) {
        return NextResponse.json(
            { error: 'Votre consentement au traitement de vos données est nécessaire pour poursuivre.' },
            { status: 400 },
        )
    }

    // ── Preuve de paiement AVANT toute écriture ────────────────────
    const tarif = await tarifRecapXof()
    const refus = await refusPaiement(
        String(body.payment_provider || ''),
        String(body.payment_ref || ''),
        tarif.xof,
    )
    if (refus) {
        console.warn(`[recap-myafro] REFUS (${email}) : ${refus}`)
        return NextResponse.json({ error: refus }, { status: 402 })
    }

    // Idempotence : le navigateur peut rejouer l'envoi (réseau, double clic).
    const { data: deja } = await supabase
        .from('myafro_recap_requests').select('reference')
        .eq('paiement_ref', String(body.payment_ref)).maybeSingle()
    if (deja?.reference) {
        return NextResponse.json({ success: true, reference: deja.reference, deja_enregistre: true })
    }

    const maintenant = new Date()
    const purge = new Date(maintenant)
    purge.setFullYear(purge.getFullYear() + CONSERVATION_ANNEES)

    const reference = `RG-RECAP-${maintenant.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

    const donnees = {
        reference,
        nom, prenom, email, telephone,
        pays_residence: txt(body.pays_residence, LIMITES.court) || null,
        myafro_reference: txt(body.myafro_reference, LIMITES.court) || null,
        depuis_quand: txt(body.depuis_quand, LIMITES.court) || null,
        situation,
        attentes: txt(body.attentes, LIMITES.long) || null,
        montant: tarif.montant,
        devise: tarif.devise,
        paiement_statut: 'paye',
        paiement_ref: txt(body.payment_ref, LIMITES.moyen),
        paiement_moyen: txt(body.payment_provider, 40),
        statut: 'nouveau',
        consentement: true,
        consentement_le: maintenant.toISOString(),
        consentement_version: VERSION_CONSENTEMENT,
        purge_apres: purge.toISOString().slice(0, 10),
    }

    const { data: cree, error } = await supabase
        .from('myafro_recap_requests').insert(donnees).select('id, reference').single()

    if (error) {
        // L'argent est encaissé : la trace doit survivre à l'échec d'insertion.
        console.error('[recap-myafro] INSERT ÉCHOUÉ — paiement encaissé', {
            reference, email, tx: donnees.paiement_ref, erreur: error.message,
        })
        return NextResponse.json(
            {
                error: 'Votre règlement est bien reçu mais l’enregistrement a échoué. '
                    + 'Conservez cette référence de transaction et contactez-nous, nous reprenons la main.',
                reference_transaction: donnees.paiement_ref,
            },
            { status: 500 },
        )
    }

    // ── Le récap devient un DOSSIER, comme les autres services ─────
    //  Sans cela, la prestation existait en comptabilité mais dans aucun
    //  suivi : ni l'onglet Dossiers, ni l'application ne la voyaient passer.
    const dossierId = await ouvrirDossier({
        service_type: 'Récap MyAfroOrigins',
        nom, prenom, email, telephone,
        notes: [
            `Réf. récap : ${reference}`,
            donnees.myafro_reference ? `Réf. MyAfroOrigins : ${donnees.myafro_reference}` : '',
            donnees.depuis_quand ? `Sans nouvelle depuis : ${donnees.depuis_quand}` : '',
            '',
            situation.slice(0, 1500),
        ].filter(Boolean).join('\n'),
        source: String(body.source) === 'mobile' ? 'mobile' : 'web',
        transaction_id: donnees.paiement_ref,
        payment_method: donnees.paiement_moyen,
    })

    if (dossierId) {
        await supabase.from('myafro_recap_requests')
            .update({ dossier_id: dossierId }).eq('id', cree.id)
            .then(() => undefined, () => undefined)
    }

    /* ── FACTURE ────────────────────────────────────────────────────
       La prestation était encaissée sans qu'aucune facture ne soit établie :
       ni pour le client, ni pour la comptabilité. Le montant facturé est le
       tarif VÉRIFIÉ à l'instant (`tarif.xof`), celui que la passerelle a
       confirmé couvrir — jamais un montant venu du navigateur.
       Le compte client, quand la demande vient de l'application, permet
       d'apposer le paraphe enregistré sur le « Bon pour accord ». */
    const compteClient = await getMobileUserId(request).catch(() => null)
    void facturerPaiementService({
        transactionId: String(donnees.paiement_ref),
        montantXof: Number(tarif.xof) || 0,
        libelle: 'Récap de dossier MyAfroOrigins',
        clientId: compteClient,
        clientNom: nom, clientPrenom: prenom, clientEmail: email, clientPhone: telephone,
        provider: String(body.payment_provider || 'kkiapay'),
        source: String(body.source) === 'mobile' ? 'Application mobile' : 'Site web',
        reference,
    })

    // ── Fiche d'analyse (non bloquante) ────────────────────────────
    const recap = await genererRecap({
        nom, prenom, situation,
        pays_residence: donnees.pays_residence || '',
        myafro_reference: donnees.myafro_reference || '',
        depuis_quand: donnees.depuis_quand || '',
        attentes: donnees.attentes || '',
    })
    if (recap) {
        await supabase.from('myafro_recap_requests')
            .update({ recap_ia: recap, recap_genere_le: new Date().toISOString(), statut: 'en_analyse' })
            .eq('id', cree.id)
            .then(() => undefined, () => undefined)
    }

    // ── Courriers (non bloquants) ──────────────────────────────────
    const { data: contactRow } = await supabase
        .from('settings').select('value').eq('key', 'contact_email').maybeSingle()
    const staff = String(contactRow?.value || '').trim()

    const corpsClient = await EMAIL_WRAPPER(
        `<p style="margin:0 0 16px">Bonjour ${prenom},</p>
         <p style="margin:0 0 16px">Votre demande de <strong>récap de dossier MyAfroOrigins</strong> est enregistrée
         et votre règlement est confirmé. Un analyste reprend votre situation.</p>
         ${emailInfoCard([
            ['Référence', reference],
            ['Montant réglé', `${tarif.montant} ${tarif.devise}`],
            ['Délai de réponse', '48 heures ouvrées'],
        ])}
         <p style="margin:16px 0 0;font-size:13px;color:#666">
         Vos données ne servent qu’à traiter cette demande. Vous pouvez à tout moment demander à
         les consulter, les corriger ou les faire effacer en répondant à cet email.</p>`,
        'fr',
        { preheader: `Récap de dossier — ${reference}`, heroTitle: 'Demande enregistrée' },
    )
    sendEmail({
        to: email,
        subject: `Récap de dossier MyAfroOrigins — ${reference}`,
        html: corpsClient,
        context: 'recap-myafroorigins',
        relatedId: cree.id,
    }).catch(() => undefined)

    if (staff) {
        const corpsStaff = await EMAIL_WRAPPER(
            `<p style="margin:0 0 16px"><strong>Nouveau récap de dossier MyAfroOrigins réglé.</strong></p>
             ${emailInfoCard([
                ['Référence', reference],
                ['Client', `${prenom} ${nom}`],
                ['Email', email],
                ['Téléphone', telephone],
                ['Depuis', donnees.depuis_quand || 'non précisé'],
                ['Réf. MyAfroOrigins', donnees.myafro_reference || 'non communiquée'],
                ['Montant', `${tarif.montant} ${tarif.devise}`],
            ])}
             <p style="margin:16px 0 8px"><strong>Situation décrite :</strong></p>
             <p style="margin:0;white-space:pre-wrap">${situation.replace(/</g, '&lt;')}</p>`,
            'fr',
            { preheader: `${prenom} ${nom} — ${reference}`, heroTitle: 'Récap MyAfroOrigins' },
        )
        sendEmail({
            to: staff,
            subject: `[RÉCAP MYAFRO] ${prenom} ${nom} — ${reference}`,
            html: corpsStaff,
            replyTo: email,
            context: 'recap-myafroorigins-staff',
            relatedId: cree.id,
        }).catch(() => undefined)
    }

    return NextResponse.json({ success: true, reference, recap_disponible: !!recap })
}
