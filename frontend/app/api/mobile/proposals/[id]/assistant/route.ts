// ══════════════════════════════════════════════════════════════
//  Conseiller IA d'une proposition de séjour.
//
//  Le mot d'accueil avait un auteur mais pas de voix : le client ne pouvait
//  rien lui demander. « Le petit-déjeuner est-il compris ? », « Puis-je
//  décaler d'un jour ? » — ces questions partaient vers la messagerie
//  générale, sans contexte, et attendaient un agent.
//
//  Ici l'assistant répond SUR CETTE proposition : il reçoit les prestations
//  réelles, leurs prix, les dates, le nombre de voyageurs et l'échéancier.
//  Il ne peut donc pas inventer un tarif ni promettre une prestation absente.
//
//  GET  → le fil de la conversation
//  POST → une question, une réponse, les deux consignées
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'
import { fetchWithGroqRotation, GROQ_MODEL } from '@/lib/groq'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const NON_FACTURABLE = ['hero', 'pricing', 'intro', 'cover']
const MAX_QUESTION = 600
const MAX_HISTORIQUE = 12

/** Contrôle d'appartenance : identifiant client, ou email du profil. */
async function maProposition(id: string, clientId: string) {
    const { data: cp } = await supabase
        .from('client_profiles').select('email, prenom, nom').eq('id', clientId).maybeSingle()
    const email = String(cp?.email || '').trim().toLowerCase()

    const { data: prop } = await supabase
        .from('ai_client_proposals')
        .select('id, client_id, client_email, client_name, sent_to_mobile, destination, start_date, end_date, currency, status, signed_at, notes')
        .eq('id', id)
        .maybeSingle()

    if (!prop) return { prop: null, cp: null }
    const mienne = prop.client_id === clientId
        || (prop.sent_to_mobile && !!email && String(prop.client_email || '').trim().toLowerCase() === email)
    return { prop: mienne ? prop : null, cp }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { id } = await params
    const { prop } = await maProposition(id, clientId)
    if (!prop) return NextResponse.json({ error: 'Proposition non autorisée.' }, { status: 403 })

    const { data, error } = await supabase
        .from('proposal_assistant_messages')
        .select('id, role, content, created_at')
        .eq('proposal_id', id)
        .order('created_at', { ascending: true })
        .limit(60)

    // Table absente tant que la migration 20260819 n'est pas exécutée : on le
    // dit, plutôt que de laisser croire à une conversation vide.
    if (error) {
        return NextResponse.json(
            { messages: [], migration_requise: /does not exist|schema cache/i.test(error.message) },
        )
    }

    return NextResponse.json({ messages: data || [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const trop = guardPublic(req, 'mobile/proposals/assistant', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const question = String(body.question || '').trim().slice(0, MAX_QUESTION)
    if (!question) return NextResponse.json({ error: 'Question vide.' }, { status: 400 })

    const { prop, cp } = await maProposition(id, clientId)
    if (!prop) return NextResponse.json({ error: 'Proposition non autorisée.' }, { status: 403 })

    // ── Le contexte : la proposition telle qu'elle est réellement ──
    const { data: items } = await supabase
        .from('ai_proposal_items')
        .select('type, title, subtitle, description, location, selling_price, highlights, order_index')
        .eq('proposal_id', id)
        .order('order_index', { ascending: true })

    const prestations = (items || []).filter(i => !NON_FACTURABLE.includes(String(i.type || '')))
    const devise = prop.currency === 'XOF' || !prop.currency ? 'FCFA' : prop.currency
    const total = prestations.reduce((s, i) => s + (Number(i.selling_price) || 0), 0)

    // Les colonnes de séjour n'existent qu'après la migration : on les lit à
    // part pour qu'une base non migrée n'emporte pas toute la requête.
    const { data: extra } = await supabase
        .from('ai_client_proposals').select('nb_voyageurs, echeancier, conseiller_id').eq('id', id).maybeSingle()

    const catalogue = prestations.map((i, n) =>
        `${n + 1}. [${i.type || 'prestation'}] ${i.title || 'Sans titre'}`
        + `${i.location ? ` — ${i.location}` : ''}`
        + ` — ${Number(i.selling_price) > 0 ? `${Math.round(Number(i.selling_price))} ${devise}` : 'compris'}`
        + `${i.subtitle ? `\n   ${i.subtitle}` : ''}`
        + `${i.description ? `\n   ${String(i.description).slice(0, 400)}` : ''}`
        + `${Array.isArray(i.highlights) && i.highlights.length ? `\n   Inclus : ${i.highlights.join(', ')}` : ''}`,
    ).join('\n')

    const echeancier = Array.isArray(extra?.echeancier) && extra.echeancier.length
        ? (extra.echeancier as Array<{ label?: string; pourcentage?: number }>)
            .map(e => `${e.label || 'Échéance'} : ${e.pourcentage ?? '?'} % du total retenu`).join(' · ')
        : 'non défini'

    // Persona du conseiller, telle que l'administration l'a réglée.
    let conf = await supabase.from('ai_config')
        .select('system_prompt, personality, tone, display_name, role_label')
        .eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle()
    if (conf.error) {
        conf = await supabase.from('ai_config')
            .select('system_prompt, personality, tone')
            .eq('is_active', true).order('id', { ascending: false }).limit(1).maybeSingle()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persona = conf.data as any

    const prenom = String(cp?.prenom || prop.client_name || '').trim().split(' ')[0]

    const systeme = [
        `Tu es ${persona?.display_name || 'l’Assistant Retour Gagnant'}, ${persona?.role_label || 'conseiller séjour diaspora'} du cabinet Retour Gagnant Bénin.`,
        persona?.personality ? `Personnalité : ${persona.personality}.` : '',
        persona?.tone ? `Ton : ${persona.tone}.` : 'Ton : vouvoiement, phrases courtes, chaleureux et précis.',
        '',
        `Tu réponds à ${prenom || 'un client de la diaspora'} au sujet de SA proposition de séjour. Voici tout ce que tu sais :`,
        `· Destination : ${prop.destination || 'non précisée'}`,
        `· Dates : ${prop.start_date || '?'} → ${prop.end_date || '?'}`,
        `· Voyageurs : ${extra?.nb_voyageurs || 1}`,
        `· Devise : ${devise} — Total si tout est retenu : ${Math.round(total)} ${devise}`,
        `· Règlement : ${echeancier}`,
        `· État : ${prop.signed_at ? 'devis signé' : 'devis non signé'}${prop.status === 'paid' ? ', réglé' : ''}`,
        '',
        'Prestations de la proposition :',
        catalogue || '(aucune prestation détaillée pour l’instant)',
        '',
        'RÈGLES ABSOLUES :',
        '— Ne cite JAMAIS un prix, une date, un hôtel ou une inclusion qui ne figure pas ci-dessus.',
        '— Si l’information manque, dis-le franchement et propose que le cabinet la confirme.',
        '— Rappelle que le client peut retirer une prestation avant de signer : le total se recalcule.',
        '— N’invente aucune promesse commerciale (surclassement, remise, garantie) qui ne soit pas écrite ici.',
        '— Réponds en français, en 4 phrases maximum, sans formule d’ouverture creuse.',
    ].filter(Boolean).join('\n')

    // Fil de la conversation : sans lui l'assistant se répète à chaque tour.
    const { data: fil } = await supabase
        .from('proposal_assistant_messages')
        .select('role, content')
        .eq('proposal_id', id)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORIQUE)

    const historique = (fil || []).reverse().map(m => ({ role: m.role, content: m.content }))

    let reponse = ''
    try {
        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: systeme }, ...historique, { role: 'user', content: question }],
            temperature: 0.4,
            max_tokens: 500,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error?.message || 'Assistant indisponible.')
        reponse = String(json?.choices?.[0]?.message?.content || '').trim()
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Assistant indisponible.' },
            { status: 502 },
        )
    }

    if (!reponse) return NextResponse.json({ error: 'Assistant sans réponse.' }, { status: 502 })

    // Consigné après coup : une réponse manquée ne doit pas laisser une
    // question orpheline dans le fil.
    await supabase.from('proposal_assistant_messages').insert([
        { proposal_id: id, client_id: clientId, role: 'user', content: question },
        { proposal_id: id, client_id: clientId, role: 'assistant', content: reponse },
    ]).then(() => undefined, () => undefined)

    return NextResponse.json({ reponse })
}
