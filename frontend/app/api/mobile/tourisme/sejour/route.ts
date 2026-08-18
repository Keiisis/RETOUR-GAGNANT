// ══════════════════════════════════════════════════════════════
//  POST /api/mobile/tourisme/sejour
//
//  « Préparer mon séjour » : une seule soumission qui produit DEUX choses
//   1. un rendez-vous (rdv_requests) — comme n'importe quel service ;
//   2. le PARCOURS souhaité (tourism_itineraries) : villes, activités, récit.
//
//  Le parcours est la matière première de l'agent : sans lui, il ne peut pas
//  construire une proposition illustrée qui ait du sens. Les deux sont liés
//  (`rdv_id`), pour qu'on retrouve toujours l'un depuis l'autre.
//
//  L'identité vient du JETON, jamais du corps de la requête : sinon on
//  déposerait une demande au nom d'un autre client.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Borne une liste de textes : longueur, taille unitaire, valeurs vides. */
function listePropre(v: unknown, max = 20): string[] {
    if (!Array.isArray(v)) return []
    return v
        .map(x => String(x || '').trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, max)
}

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'mobile/tourisme/sejour', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    try {
        const body = await req.json()
        const rdv = (body.rdv || {}) as Record<string, unknown>
        const it = (body.itineraire || {}) as Record<string, unknown>

        const villes = listePropre(it.villes)
        const activites = listePropre(it.activites)
        const recit = String(it.recit || '').trim().slice(0, 4000)

        // Un parcours vide n'apporte rien à l'agent : on exige au moins une
        // intention, quelle qu'en soit la forme.
        if (villes.length === 0 && activites.length === 0 && !recit) {
            return NextResponse.json(
                { error: 'Indiquez au moins une ville, une activité ou quelques mots sur votre projet.' },
                { status: 400 },
            )
        }

        // Profil : sert à remplir le rendez-vous ET à retrouver le client par
        // email côté panel (les demandes créées hors application n'ont pas
        // d'identifiant — c'est le lien qui manquait ailleurs dans le projet).
        const { data: cp } = await supabase
            .from('client_profiles')
            .select('nom, prenom, email, phone')
            .eq('id', clientId)
            .maybeSingle()

        const email = String(cp?.email || '').trim().toLowerCase()
        const nowIso = new Date().toISOString()

        // ── 1. Rendez-vous ──
        let rdvId: string | null = null
        const dateRdv = String(rdv.date || '').trim()
        if (dateRdv) {
            const { data, error } = await supabase
                .from('rdv_requests')
                .insert({
                    client_id: clientId,
                    client_email: email || null,
                    date: dateRdv,
                    heure: String(rdv.heure || '').trim() || null,
                    type: String(rdv.type || 'visio').trim(),
                    motif: 'Tourisme & Culture : préparation de séjour',
                    notes: [
                        `${cp?.prenom || ''} ${cp?.nom || ''}`.trim() || null,
                        villes.length ? `Étapes souhaitées : ${villes.join(' → ')}.` : null,
                        activites.length ? `Activités : ${activites.join(', ')}.` : null,
                    ].filter(Boolean).join('\n'),
                    statut: 'confirme',
                    created_at: nowIso,
                })
                .select('id')
                .single()
            if (!error && data) rdvId = data.id
        }

        // ── 2. Parcours souhaité ──
        const duree = Number(it.duree_jours)
        const voyageurs = Number(it.voyageurs)
        const budget = Number(it.budget)

        const { data: parcours, error: errIt } = await supabase
            .from('tourism_itineraries')
            .insert({
                client_id: clientId,
                rdv_id: rdvId,
                nom: cp?.nom || null,
                prenom: cp?.prenom || null,
                email: email || null,
                telephone: cp?.phone || null,
                date_debut: String(it.date_debut || '').trim() || null,
                date_fin: String(it.date_fin || '').trim() || null,
                duree_jours: isFinite(duree) && duree > 0 ? Math.round(duree) : null,
                voyageurs: isFinite(voyageurs) && voyageurs > 0 ? Math.round(voyageurs) : 1,
                budget: isFinite(budget) && budget > 0 ? budget : null,
                devise: String(it.devise || 'EUR').toUpperCase().slice(0, 3),
                villes,
                activites,
                recit: recit || null,
                statut: 'nouveau',
                created_at: nowIso,
                updated_at: nowIso,
            })
            .select('id')
            .single()

        if (errIt) {
            console.error('[tourisme/sejour]', errIt)
            return NextResponse.json({ error: errIt.message }, { status: 500 })
        }

        // ── 3. L'équipe est prévenue dans la messagerie ──
        // Le fil est rattaché par email : c'est ce qui rend la conversation
        // visible côté Console Live comme dans l'application.
        await supabase.from('messages').insert({
            client_id: clientId,
            type: 'rdv',
            nom: cp?.nom || '',
            prenom: cp?.prenom || '',
            email: email || null,
            telephone: cp?.phone || null,
            sujet: 'Préparation de séjour : Tourisme & Culture',
            message: [
                'Nouvelle demande de préparation de séjour depuis l’application.',
                villes.length ? `Étapes : ${villes.join(' → ')}` : null,
                activites.length ? `Activités : ${activites.join(', ')}` : null,
                recit ? `\nSon projet :\n${recit}` : null,
                '\n→ À traiter dans l’onglet Smart Slides : construire la proposition et l’envoyer dans son application.',
            ].filter(Boolean).join('\n'),
            is_read: false,
            lu: false,
        }).then(() => undefined, () => undefined)

        // ── 4. Accusé de réception côté client ──
        await supabase.from('notifications').insert({
            user_id: clientId,
            title: 'Demande de séjour reçue',
            body: 'Votre projet est entre les mains d’un conseiller. Vous recevrez une proposition illustrée dans l’application.',
            type: 'service',
            is_read: false,
            created_at: nowIso,
        }).then(() => undefined, () => undefined)

        return NextResponse.json({ success: true, itinerary_id: parcours.id, rdv_id: rdvId }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 },
        )
    }
}
