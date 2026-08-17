// ══════════════════════════════════════════════════════════════
//  Design du BILLET : lecture / écriture du modèle HTML.
//
//  Stocké dans page_sections (page='evenements') :
//    · 'ticket_template'            → modèle GLOBAL, par défaut
//    · 'ticket_template:<event_id>' → modèle propre à un événement
//
//  Le QR est injecté automatiquement au marqueur {{QR_CODE}} ; les autres
//  marqueurs remplissent les informations de l'invité et de l'événement.
//  Écriture réservée au personnel (admins + agents).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { defaultTicketTemplate } from '@/lib/event-tickets'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PAGE = 'evenements'
const cle = (eventId?: string | null) => eventId ? `ticket_template:${eventId}` : 'ticket_template'

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const eventId = new URL(request.url).searchParams.get('event_id')

    const { data } = await supabase
        .from('page_sections')
        .select('section_key, content')
        .eq('page', PAGE)
        .in('section_key', [cle(), ...(eventId ? [cle(eventId)] : [])])

    const rows = data || []
    const propre = rows.find(r => r.section_key === cle(eventId))
    const global = rows.find(r => r.section_key === cle())

    return NextResponse.json({
        // Le modèle spécifique s'il existe, sinon le global, sinon le défaut.
        html: String((propre?.content as Record<string, unknown>)?.html || '') || null,
        global_html: String((global?.content as Record<string, unknown>)?.html || '') || null,
        default_html: defaultTicketTemplate(),
        markers: [
            '{{QR_CODE}}', '{{TICKET_CODE}}', '{{FULL_NAME}}', '{{EMAIL}}',
            '{{PHONE}}', '{{TICKET_TYPE}}', '{{EVENT_TITLE}}', '{{EVENT_DATE}}',
            '{{EVENT_LOCATION}}',
        ],
    })
}

export async function PUT(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const html = String(body.html ?? '')
    const eventId = body.event_id ? String(body.event_id) : null

    // Un billet sans QR n'a aucune valeur au contrôle d'entrée : on refuse
    // d'enregistrer un design qui l'aurait oublié.
    if (html.trim() && !html.includes('{{QR_CODE}}')) {
        return NextResponse.json(
            { error: 'Le design doit contenir le marqueur {{QR_CODE}} : sans lui, le billet ne peut pas être scanné.' },
            { status: 400 },
        )
    }

    const section_key = cle(eventId)
    const { data: existing } = await supabase
        .from('page_sections').select('id')
        .eq('page', PAGE).eq('section_key', section_key).maybeSingle()

    // Chaîne vide = revenir au modèle hérité (global, puis défaut).
    if (!html.trim()) {
        if (existing?.id) await supabase.from('page_sections').delete().eq('id', existing.id)
        return NextResponse.json({ success: true, reset: true })
    }

    if (existing?.id) {
        const { error } = await supabase.from('page_sections')
            .update({ content: { html }, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
        const { error } = await supabase.from('page_sections').insert({
            page: PAGE, section_key,
            title: eventId ? 'Design du billet (événement)' : 'Design du billet (global)',
            content: { html }, sort_order: 1, is_active: true,
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
