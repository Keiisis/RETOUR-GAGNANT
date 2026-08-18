// ══════════════════════════════════════════════════════════════
//  GET /api/mobile/proposals/[id] — le DÉTAIL d'une proposition.
//
//  L'application affichait la page du site dans une WebView : en-tête,
//  fil d'Ariane, boutons flottants… et surtout aucun moyen de SÉLECTIONNER
//  les prestations, puisque cette page est conçue pour une souris et un grand
//  écran. Cette route sert les données brutes, pour un écran natif.
//
//  Le client ne reçoit que SA proposition : contrôle sur client_id, ou sur
//  l'email du profil rattaché au jeton.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Les prestations non facturables ne sont pas des options à cocher. */
const NON_FACTURABLE = ['hero', 'pricing', 'intro', 'cover']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { id } = await params

    const { data: cp } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    const email = String(cp?.email || '').trim().toLowerCase()

    const BASE = `
        id, secret_key, client_id, client_email, client_name, sent_to_mobile,
        destination, start_date, end_date, budget, activities, notes,
        total_amount, currency, status, signed_at, signed_name, created_at
    `
    const SEJOUR = 'conseiller_id, nb_voyageurs'

    // PostgREST rejette la requête ENTIÈRE si une seule colonne lui est
    // inconnue : demander les colonnes de la migration 20260819 avant qu'elle
    // soit exécutée ferait disparaître toute la proposition, silencieusement.
    // On tente donc la version complète, puis on retombe sur la base.
    let prop: Record<string, unknown> | null = null
    const complet = await supabase
        .from('ai_client_proposals').select(`${BASE}, ${SEJOUR}`).eq('id', id).maybeSingle()

    if (complet.error) {
        const base = await supabase
            .from('ai_client_proposals').select(BASE).eq('id', id).maybeSingle()
        prop = base.data as Record<string, unknown> | null
    } else {
        prop = complet.data as Record<string, unknown> | null
    }

    if (!prop) return NextResponse.json({ error: 'Proposition introuvable.' }, { status: 404 })

    const mienne = prop.client_id === clientId
        || (prop.sent_to_mobile && !!email && String(prop.client_email || '').trim().toLowerCase() === email)
    if (!mienne) return NextResponse.json({ error: 'Proposition non autorisée.' }, { status: 403 })

    const { data: items } = await supabase
        .from('ai_proposal_items')
        .select('id, type, title, subtitle, description, location, image_url, selling_price, original_price, highlights, order_index, metadata')
        .eq('proposal_id', id)
        .order('order_index', { ascending: true })

    const tous = items || []
    // Ne filtrer QUE sur le type. Un filtre sur le prix faisait disparaître les
    // hôtels et les restaurants — dont le prix est souvent porté par le
    // récapitulatif — et la proposition n'affichait plus qu'une seule slide.
    const prestations = tous.filter(i => !NON_FACTURABLE.includes(String(i.type || '')))
    // Le texte de présentation vit sur l'élément « hero » : on le remonte pour
    // que l'écran ait de quoi accueillir le client, sans afficher une carte
    // vide et non sélectionnable.
    const intro = tous.find(i => String(i.type || '') === 'hero')

    // Galerie multi-images du slide (metadata.images) : elle sert au balayage
    // panoramique côté application. Sans elle, chaque slide n'a qu'une photo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const galerie = (p: any): string[] => [
        // La photo de couverture choisie par l'agent passe en premier : c'est
        // celle qu'il a retenue pour représenter le lieu.
        ...(p.image_url ? [p.image_url] : []),
        ...(Array.isArray(p.metadata?.images) ? p.metadata.images.map((im: { url?: string }) => im?.url).filter(Boolean) : []),
    ].filter((u: string, i: number, t: string[]) => t.indexOf(u) === i)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const avecImages = prestations.map((p: any) => ({ ...p, images: galerie(p) }))

    // Le conseiller : c'est l'assistant IA configuré dans `ai_config`. Il a une
    // identité affichable pour que le mot d'accueil ait un auteur, et c'est lui
    // qui répondra aux questions du client (route /assistant).
    // Même précaution que plus haut : tant que la migration n'est pas passée,
    // les colonnes d'identité n'existent pas et une sélection stricte
    // renverrait zéro conseiller. On dégrade sur l'identité par défaut.
    const lireConseiller = async (colonnes: string) => {
        const q = supabase.from('ai_config').select(colonnes)
        return prop!.conseiller_id
            ? await q.eq('id', prop!.conseiller_id).maybeSingle()
            : await q.eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle()
    }
    let conf = await lireConseiller('id, display_name, role_label, avatar_url')
    if (conf.error) conf = await lireConseiller('id')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = conf.data as any
    const conseiller = c ? {
        id: c.id,
        nom: c.display_name || 'Assistant Retour Gagnant',
        role: c.role_label || 'Conseiller séjour diaspora',
        avatar_url: c.avatar_url || null,
    } : null

    return NextResponse.json({
        proposal: {
            ...prop,
            intro_title: intro?.title || null,
            intro_text: intro?.description || null,
            intro_image: intro?.image_url || null,
            intro_images: intro ? galerie(intro) : [],
            conseiller,
        },
        prestations: avecImages,
    })
}
