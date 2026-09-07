// ══════════════════════════════════════════════════════════════
//  RAPPORTS HEBDOMADAIRES — chacun le sien, la direction les voit tous.
//
//  Route placée sous /api/agent et NON /api/admin : le middleware ouvre déjà
//  /api/agent aux agents ET aux administrateurs, alors que /api/admin exige
//  une exception nommée pour chaque chemin. Un rapport hebdomadaire est un
//  acte d'agent avant d'être un acte de direction.
//
//  CLOISONNEMENT, appliqué à chaque verbe et jamais laissé au client :
//    · un agent ne lit et ne modifie QUE ses propres rapports ;
//    · un administrateur les voit tous, et peut les marquer comme lus.
//  Un rapport nomme des clients et des montants : la liste complète n'a rien
//  à faire dans le navigateur d'un agent.
//
//  GET    → la liste (cloisonnée), ou un rapport précis via ?id=
//  POST   → créer / mettre à jour le rapport d'une semaine (un seul par
//           auteur et par semaine — contrainte tenue par la base)
//  PATCH  → changer le statut (transmettre, marquer lu, archiver)
//  DELETE → supprimer SON brouillon
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { normaliserContenu, lundiDe, dimancheDe } from '@/lib/rapport-hebdo'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUTS = ['brouillon', 'transmis', 'lu', 'archive'] as const

/** Le nom d'affichage de l'auteur, lu en base et non déclaré par le client. */
async function auteurDe(userId: string): Promise<{ nom: string; role: string }> {
    const { data } = await supabase
        .from('user_profiles').select('full_name, role').eq('id', userId).maybeSingle()
    return {
        nom: String(data?.full_name || '').trim() || 'Membre de l’équipe',
        role: data?.role === 'agent' ? 'Agent' : 'Direction',
    }
}

/** Réponse d'erreur quand la migration n'a pas encore été exécutée. */
function siTableAbsente(message: string) {
    const manque = /does not exist|schema cache/i.test(message)
    return NextResponse.json(
        {
            error: manque
                ? 'Table absente : exécutez la migration 20260905_rapports_hebdo.sql dans Supabase.'
                : message,
            migration_requise: manque,
            rapports: [],
        },
        { status: 500 },
    )
}

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const id = new URL(request.url).searchParams.get('id')

    let req = supabase.from('rapports_hebdo').select('*').order('semaine_du', { ascending: false }).limit(120)
    if (id) req = req.eq('id', id)
    // Un agent ne voit que les siens. La restriction est POSÉE ICI, pas
    // proposée au client : une requête forgée ne peut pas s'en affranchir.
    if (!garde.isAdmin) req = req.eq('auteur_id', garde.userId!)

    const { data, error } = await req
    if (error) return siTableAbsente(error.message)

    return NextResponse.json({
        rapports: data || [],
        moi: garde.userId,
        est_admin: garde.isAdmin,
    })
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const semaine = String(body.semaine_du || '').trim() || lundiDe()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(semaine)) {
        return NextResponse.json({ error: 'Semaine invalide.' }, { status: 400 })
    }

    const contenu = normaliserContenu(body.contenu)
    const auteur = await auteurDe(garde.userId!)

    /* `upsert` sur (auteur_id, semaine_du) : l'index unique garantit qu'un même
       auteur n'a qu'un rapport par semaine. Enregistrer deux fois met à jour,
       au lieu de créer un doublon que la direction devrait départager. */
    const { data, error } = await supabase
        .from('rapports_hebdo')
        .upsert({
            auteur_id: garde.userId,
            auteur_nom: auteur.nom,
            auteur_role: String(body.auteur_role || auteur.role).slice(0, 80),
            semaine_du: semaine,
            semaine_au: dimancheDe(semaine),
            titre: String(body.titre || '').slice(0, 200) || null,
            destinataire: String(body.destinataire || 'Madame la Directrice Générale').slice(0, 160),
            contenu,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'auteur_id,semaine_du' })
        .select('*')
        .single()

    if (error) return siTableAbsente(error.message)
    return NextResponse.json({ success: true, rapport: data })
}

export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    const statut = String(body.statut || '')
    if (!id || !(STATUTS as readonly string[]).includes(statut)) {
        return NextResponse.json({ error: 'Rapport ou statut manquant.' }, { status: 400 })
    }

    /* « Lu » est un acte de DIRECTION : c'est elle qui accuse réception. Un
       agent qui pourrait marquer son propre rapport comme lu viderait
       l'information de son sens. */
    if ((statut === 'lu' || statut === 'archive') && !garde.isAdmin) {
        return NextResponse.json(
            { error: 'Seule la direction peut marquer un rapport comme lu ou archivé.' },
            { status: 403 },
        )
    }

    const patch: Record<string, unknown> = { statut, updated_at: new Date().toISOString() }
    if (statut === 'transmis') patch.transmis_le = new Date().toISOString()
    if (statut === 'lu') patch.lu_le = new Date().toISOString()

    let req = supabase.from('rapports_hebdo').update(patch).eq('id', id)
    if (!garde.isAdmin) req = req.eq('auteur_id', garde.userId!)

    const { error } = await req
    if (error) return siTableAbsente(error.message)
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Rapport manquant.' }, { status: 400 })

    /* On ne supprime qu'un BROUILLON : un rapport transmis appartient à
       l'historique de la direction, pas à son auteur. */
    let req = supabase.from('rapports_hebdo').delete().eq('id', id).eq('statut', 'brouillon')
    if (!garde.isAdmin) req = req.eq('auteur_id', garde.userId!)

    const { error } = await req
    if (error) return siTableAbsente(error.message)
    return NextResponse.json({ success: true })
}