// ══════════════════════════════════════════════════════════════
//  Récaps de dossier MyAfroOrigins — côté panel.
//
//  GET    → la file des demandes reçues
//  PATCH  → avancement, notes, ou fiche d'analyse corrigée à la main
//  DELETE → droit à l'effacement (Code du numérique béninois) : la ligne part
//           réellement, elle n'est pas simplement masquée.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { livrerRecap, type RecapALivrer } from '@/lib/recap-livraison'
import { genererRecap } from '@/lib/recap-analyse'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUTS = ['nouveau', 'en_analyse', 'recap_livre', 'clos'] as const

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const statut = new URL(request.url).searchParams.get('statut')

    let req = supabase
        .from('myafro_recap_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

    if (statut && (STATUTS as readonly string[]).includes(statut)) req = req.eq('statut', statut)

    const { data, error } = await req
    if (error) {
        // La table n'existe pas tant que la migration 20260820 n'est pas passée :
        // le dire, plutôt que d'afficher une file vide qui rassure à tort.
        return NextResponse.json(
            {
                error: error.message,
                demandes: [],
                migration_requise: /does not exist|schema cache/i.test(error.message),
            },
            { status: 500 },
        )
    }

    return NextResponse.json({ demandes: data || [] })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.statut === 'string') {
        if (!(STATUTS as readonly string[]).includes(body.statut)) {
            return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 })
        }
        patch.statut = body.statut
    }
    if (typeof body.notes_agent === 'string') patch.notes_agent = body.notes_agent.slice(0, 6000)
    // La fiche générée reste modifiable : l'analyste a le dernier mot sur ce
    // qui est remis au client.
    if (typeof body.recap_ia === 'string') patch.recap_ia = body.recap_ia.slice(0, 20000)

    const { error } = await supabase.from('myafro_recap_requests').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    /* ── Livraison au client ──────────────────────────────────
       Passer au statut « récap livré » EST l'acte de livraison : la fiche
       PDF part par e-mail et se dépose dans l'espace documents du client.
       Rien de nouveau à cliquer côté panel — l'action qui portait déjà le
       sens porte désormais l'effet.

       Volontairement après la mise à jour et sans la conditionner : une
       panne d'envoi ne doit pas empêcher l'analyste d'avancer son dossier.
       Le résultat remonte quand même dans la réponse, pour que le panel
       puisse le dire. */
    let livraison: { envoye: boolean; motif?: string } | null = null
    if (patch.statut === 'recap_livre') {
        const { data: recap } = await supabase
            .from('myafro_recap_requests')
            .select('id, reference, nom, prenom, email, situation, recap_ia')
            .eq('id', id)
            .maybeSingle()

        if (recap) livraison = await livrerRecap(supabase, recap as RecapALivrer)
    }

    return NextResponse.json({ success: true, livraison })
}

/**
 * POST — SAISIE MANUELLE d'un client par le panel.
 *
 * Le service n'entrait que par le formulaire public : un client qui appelle,
 * qui ecrit par WhatsApp ou qui se presente a l'agence n'existait nulle part,
 * et l'equipe n'avait aucun moyen de lui produire une fiche d'analyse. Cette
 * route ouvre la meme file aux agents ET aux administrateurs.
 *
 * LE CONSENTEMENT N'EST PAS UNE CASE DE CONFORT. La table impose, au niveau de
 * la BASE, `consentement = true AND consentement_le IS NOT NULL` (Code du
 * numerique beninois, art. 383 et suivants). Pour une saisie manuelle,
 * personne ne peut cliquer a la place du client : c'est l'agent qui ATTESTE
 * avoir recueilli son accord, et l'attestation est tracee — qui, quand, par
 * quel canal. On refuse l'insertion sans elle, plutot que de cocher
 * silencieusement `true` pour satisfaire la contrainte.
 */
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const texte = (v: unknown, max = 400) => String(v ?? '').trim().slice(0, max)

    const nom = texte(body.nom, 120)
    const prenom = texte(body.prenom, 120)
    const email = texte(body.email, 180).toLowerCase()
    const telephone = texte(body.telephone, 40)
    const situation = texte(body.situation, 6000)

    const manquants: string[] = []
    if (!nom) manquants.push('nom')
    if (!prenom) manquants.push('prenom')
    if (!email) manquants.push('email')
    if (!telephone) manquants.push('telephone')
    if (!situation) manquants.push('situation')
    if (manquants.length) {
        return NextResponse.json(
            { error: `Champs obligatoires manquants : ${manquants.join(', ')}.` },
            { status: 400 },
        )
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 })
    }
    if (situation.length < 40) {
        return NextResponse.json(
            { error: 'Decrivez la situation en quelques phrases : c est la matiere de l analyse.' },
            { status: 400 },
        )
    }
    if (body.consentement !== true) {
        return NextResponse.json(
            { error: 'Attestez avoir recueilli le consentement du client avant d enregistrer sa demande.' },
            { status: 400 },
        )
    }

    const canal = texte(body.consentement_canal, 60) || 'non precise'
    const maintenant = new Date()

    /* Conservation : meme echeance que le formulaire public (3 ans), calculee
       ici et non laissee a NULL — une ligne sans echeance ne se purge jamais. */
    const purge = new Date(maintenant)
    purge.setFullYear(purge.getFullYear() + 3)

    const reference = `RG-RECAP-${maintenant.getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`

    const ligne = {
        reference,
        nom, prenom, email, telephone,
        pays_residence: texte(body.pays_residence, 80) || null,
        myafro_reference: texte(body.myafro_reference, 120) || null,
        depuis_quand: texte(body.depuis_quand, 80) || null,
        situation,
        attentes: texte(body.attentes, 2000) || null,

        /* Un dossier saisi a la main n'est PAS repute paye. Le statut de
           reglement est declare par l'agent ; par defaut il est en attente,
           pour ne pas gonfler les recettes d'un encaissement qui n'a pas eu
           lieu. */
        montant: Number(body.montant) > 0 ? Number(body.montant) : 50,
        devise: texte(body.devise, 8).toUpperCase() || 'EUR',
        paiement_statut: body.paiement_statut === 'paye' ? 'paye' : 'en_attente',
        paiement_ref: texte(body.paiement_ref, 120) || null,
        paiement_moyen: texte(body.paiement_moyen, 60) || null,

        statut: 'nouveau',
        agent_id: garde.userId,
        notes_agent: `[SAISIE MANUELLE] Consentement recueilli par ${canal}, atteste le `
            + `${maintenant.toISOString().slice(0, 10)}.`
            + (texte(body.notes_agent, 4000) ? `\n${texte(body.notes_agent, 4000)}` : ''),

        consentement: true,
        consentement_le: maintenant.toISOString(),
        purge_apres: purge.toISOString().slice(0, 10),
    }

    const { data, error } = await supabase
        .from('myafro_recap_requests')
        .insert(ligne)
        .select('*')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, demande: data })
}

/**
 * PUT — (RE)GENERER la fiche d'analyse d'une demande.
 *
 * La fiche n'etait produite qu'UNE FOIS, a la seconde du depot public. Une
 * demande saisie a la main n'en avait donc aucune, et une demande dont le
 * client precise sa situation apres coup gardait la premiere version. L'equipe
 * pouvait la reecrire entierement a la main — jamais la redemander.
 *
 * Le texte produit atterrit dans `recap_ia` et reste ENTIEREMENT modifiable
 * ensuite (PATCH) : la machine propose, l'analyste dispose.
 */
export async function PUT(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const { id } = await request.json().catch(() => ({ id: '' }))
    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const { data: d, error } = await supabase
        .from('myafro_recap_requests')
        .select('nom, prenom, pays_residence, myafro_reference, depuis_quand, situation, attentes')
        .eq('id', id)
        .maybeSingle()

    if (error || !d) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 })

    const recap = await genererRecap({
        nom: String(d.nom || ''),
        prenom: String(d.prenom || ''),
        pays_residence: String(d.pays_residence || ''),
        myafro_reference: String(d.myafro_reference || ''),
        depuis_quand: String(d.depuis_quand || ''),
        situation: String(d.situation || ''),
        attentes: String(d.attentes || ''),
    })

    /* Un echec du modele ne doit rien ecraser : la fiche deja en place, ou
       redigee a la main, reste intacte. On le dit, au lieu de vider le champ. */
    if (!recap) {
        return NextResponse.json(
            { error: 'Le service d analyse est indisponible. Reessayez, ou redigez la fiche a la main.' },
            { status: 503 },
        )
    }

    const { error: majErr } = await supabase
        .from('myafro_recap_requests')
        .update({
            recap_ia: recap,
            recap_genere_le: new Date().toISOString(),
            statut: 'en_analyse',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)

    if (majErr) return NextResponse.json({ error: majErr.message }, { status: 500 })
    return NextResponse.json({ success: true, recap_ia: recap })
}

export async function DELETE(request: NextRequest) {
    // L'effacement d'une donnée personnelle est un acte de direction, pas une
    // opération courante d'agent.
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const { error } = await supabase.from('myafro_recap_requests').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, efface: true })
}
