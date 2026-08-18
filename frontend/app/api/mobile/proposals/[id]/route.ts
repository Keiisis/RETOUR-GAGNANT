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

    const { data: prop, error } = await supabase
        .from('ai_client_proposals')
        .select(`
            id, secret_key, client_id, client_email, client_name, sent_to_mobile,
            destination, start_date, end_date, budget, activities, notes,
            total_amount, currency, status, signed_at, signed_name, created_at
        `)
        .eq('id', id)
        .maybeSingle()

    if (error || !prop) return NextResponse.json({ error: 'Proposition introuvable.' }, { status: 404 })

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
    const avecImages = prestations.map((p: any) => ({
        ...p,
        images: [
            ...(Array.isArray(p.metadata?.images) ? p.metadata.images.map((im: { url?: string }) => im?.url).filter(Boolean) : []),
            ...(p.image_url ? [p.image_url] : []),
        ].filter((u: string, i: number, t: string[]) => t.indexOf(u) === i),
    }))

    return NextResponse.json({
        proposal: {
            ...prop,
            intro_title: intro?.title || null,
            intro_text: intro?.description || null,
            intro_image: intro?.image_url || null,
        },
        prestations: avecImages,
    })
}
