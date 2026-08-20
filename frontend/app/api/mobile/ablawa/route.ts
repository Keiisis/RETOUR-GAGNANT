// ══════════════════════════════════════════════════════════════
//  ABLAWA — l'assistante de Retour Gagnant Bénin.
//
//  Le bouton « Support » de l'accueil ouvrait la messagerie humaine : le client
//  posait sa question, puis attendait qu'un agent soit disponible. Pour une
//  diaspora répartie sur plusieurs fuseaux, cela veut souvent dire le lendemain.
//
//  Ablawa répond tout de suite. Elle n'est pas un agent de plus : elle est la
//  première réponse, et elle sait passer la main quand la question demande un
//  humain — un dossier précis, un litige, un engagement contractuel.
//
//  ── CE QUI LA REND FIABLE ────────────────────────────────────
//  Elle ne parle QUE de ce qu'on lui donne. Le catalogue des services, avec les
//  prix RÉELS lus en base à l'instant, est injecté dans son contexte à chaque
//  question. Elle n'a donc pas à deviner un tarif — et il lui est interdit d'en
//  inventer un. C'est la même règle que partout ici : un prix ne s'improvise
//  pas (incident du 2026-08-19).
//
//  ── L'HISTORIQUE VIT SUR LE TÉLÉPHONE ────────────────────────
//  Le fil de conversation est envoyé par l'application à chaque question, au
//  lieu d'être stocké côté serveur. Aucune table, aucune migration, aucune
//  donnée personnelle de plus en base — et la conversation reste chez son
//  propriétaire.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { guardPublic, CHAT_LIMIT } from '@/lib/api-guard'
import { fetchWithGroqRotation, GROQ_MODEL } from '@/lib/groq'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Au-delà, on coupe : la conversation coûte, et le contexte se dilue. */
const MAX_HISTORIQUE = 12
const MAX_QUESTION = 1200

const AGENCE_TEL = '+229 01 60 32 21 21'

interface TourDeParole { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Débit par COMPTE, pas par IP : plusieurs clients derrière un même
    // opérateur mobile ne se coupent pas la parole (voir INSCRIPTION_IP_LIMIT).
    const trop = guardPublic(req, 'ablawa', CHAT_LIMIT, clientId)
    if (trop) return trop

    const body = await req.json().catch(() => ({}))
    const question = String(body?.question || '').trim().slice(0, MAX_QUESTION)
    if (!question) return NextResponse.json({ error: 'Question vide.' }, { status: 400 })

    const historique: TourDeParole[] = Array.isArray(body?.historique)
        ? body.historique
            .filter((m: unknown): m is TourDeParole =>
                !!m && typeof m === 'object'
                && ((m as TourDeParole).role === 'user' || (m as TourDeParole).role === 'assistant')
                && typeof (m as TourDeParole).content === 'string')
            .slice(-MAX_HISTORIQUE)
            .map((m: TourDeParole) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION) }))
        : []

    /* ── Ce qu'Ablawa a le droit de savoir ────────────────────── */
    const [profilRes, servicesRes, dossiersRes] = await Promise.all([
        supabase.from('client_profiles').select('prenom, nom, email, pays').eq('id', clientId).maybeSingle(),
        supabase.from('services')
            .select('title, slug, subtitle, description, price_display, pricing_options, is_active')
            .eq('is_active', true).order('order_index', { ascending: true }),
        supabase.from('dossier_tracking')
            .select('service_type, statut, progression, num_dossier, created_at')
            .eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
    ])

    const cp = profilRes.data
    const prenom = String(cp?.prenom || '').trim().split(' ')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catalogue = (servicesRes.data || []).map((s: any) => {
        const options = Array.isArray(s.pricing_options) && s.pricing_options.length
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? ' — ' + s.pricing_options.map((o: any) => `${o.label} : ${o.price}`).join(' · ')
            : (s.price_display ? ` — ${s.price_display}` : '')
        return `· ${s.title}${options}${s.subtitle ? `\n    ${s.subtitle}` : ''}`
    }).join('\n')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dossiers = (dossiersRes.data || []).map((d: any) =>
        `· ${d.service_type || 'Dossier'} — ${d.statut || 'en cours'} (${d.progression ?? 0} %)`
        + `${d.num_dossier ? ` — réf. ${d.num_dossier}` : ''}`,
    ).join('\n')

    const systeme = [
        'Tu es ABLAWA, l’assistante de Retour Gagnant Bénin — une agence béninoise qui accompagne',
        'les afro-descendants dans leur retour : nationalité, recherche ancestrale, logement, permis,',
        'consultation Fa, séjours, création d’entreprise.',
        '',
        'QUI TU ES.',
        'Tu portes un prénom béninois et tu l’assumes : tu es chaleureuse, vivante, jamais robotique.',
        'Tu t’adresses à des gens pour qui ce retour est une histoire de famille, parfois de plusieurs',
        'générations. Tu prends cela au sérieux. Quand quelqu’un raconte sa quête, tu l’accueilles',
        'd’abord — une phrase, sincère — avant de répondre. Tu as de l’amour-propre : tu ne t’excuses',
        'pas d’exister, tu ne t’aplatis pas, tu ne dis jamais « je ne suis qu’une IA ».',
        '',
        'COMMENT TU PARLES.',
        '— Vouvoiement. Phrases courtes. Français clair, jamais de jargon.',
        '— Quatre à six phrases au maximum. On te lit sur un téléphone, souvent en marchant.',
        '— Tu ne commences JAMAIS par « Bien sûr », « Absolument », « Je comprends votre demande ».',
        '  Tu entres dans le sujet.',
        '— Tu poses UNE question à la fois quand il manque une information, jamais trois.',
        '— Tu nommes la prochaine action concrète : ce que la personne fait maintenant, dans l’app.',
        '',
        'TON MÉTIER, C’EST AUSSI LE COMMERCE — MAIS HONNÊTE.',
        'Tu sais faire entendre la valeur d’un accompagnement : tu parles du résultat obtenu, de ce',
        'que la personne s’évite comme démarches, du temps gagné. Tu ancres sur ce qui compte pour',
        'ELLE (transmettre à ses enfants, retrouver une lignée, poser ses papiers) plutôt que sur une',
        'liste de prestations. Tu ne forces jamais : pas de fausse urgence, pas de rareté inventée,',
        'pas de culpabilisation. Un client qui hésite a le droit d’hésiter, et tu le lui dis.',
        '',
        prenom ? `LA PERSONNE À QUI TU PARLES : ${prenom}${cp?.pays ? `, depuis ${cp.pays}` : ''}.` : '',
        dossiers ? `SES DOSSIERS EN COURS :\n${dossiers}` : 'Elle n’a encore aucun dossier ouvert.',
        '',
        'LES SERVICES ET LEURS PRIX RÉELS (lus en base à l’instant) :',
        catalogue || '(catalogue momentanément indisponible)',
        '',
        'RÈGLES ABSOLUES — elles priment sur tout le reste.',
        '— N’invente JAMAIS un prix, un délai, une pièce à fournir ou une démarche officielle.',
        '  Si ce n’est pas écrit au-dessus, tu ne le sais pas : dis-le, et propose de vérifier.',
        '— Ne promets JAMAIS l’obtention de la nationalité, d’un visa ou d’un document.',
        '  L’agence accompagne une démarche ; elle ne décide pas à la place des autorités.',
        '— Le nom « Retour Gagnant Bénin » ne se traduit ni ne s’abrège en autre chose.',
        '— Pour un litige, un remboursement, une réclamation, un dossier bloqué, ou dès que la',
        `  personne demande un humain : tu passes la main. Messagerie de l’app, ou ${AGENCE_TEL}.`,
        '— Tu ne demandes jamais un mot de passe, un code reçu par e-mail, ni un numéro de carte.',
        '— Tu réponds dans la langue de la question.',
        '— ÉCRIS EN TEXTE BRUT. Pas de markdown : ni **gras**, ni *italique*, ni titres, ni listes',
        '  à puces avec des tirets ou des étoiles. L’application affiche ton texte tel quel ;',
        '  une étoile s’y afficherait comme une étoile.',
    ].filter(Boolean).join('\n')

    let reponse = ''
    try {
        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systeme },
                ...historique,
                { role: 'user', content: question },
            ],
            temperature: 0.6,   // assez pour qu'elle ait une voix, pas assez pour qu'elle divague
            max_tokens: 600,
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error?.message || 'Assistante indisponible.')
        reponse = String(json?.choices?.[0]?.message?.content || '').trim()
    } catch (e) {
        console.error('[ablawa]', e instanceof Error ? e.message : e)
        return NextResponse.json({
            error: 'Ablawa est momentanément injoignable.',
            repli: `Je n’arrive pas à vous répondre à l’instant. Écrivez à l’équipe depuis la messagerie, ou appelez le ${AGENCE_TEL} — quelqu’un vous reprendra.`,
        }, { status: 503 })
    }

    /* Filet déterministe : la consigne « pas de markdown » tient neuf fois sur
       dix. La dixième, le client verrait des astérisques au milieu d'un prix.
       On nettoie donc ce que le modèle a pu laisser passer. */
    reponse = reponse
        .replace(/\*\*(.+?)\*\*/g, '$1')       // **gras**
        .replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2') // *italique*
        .replace(/^#{1,6}\s+/gm, '')             // # titres
        .replace(/^\s*[-*•]\s+/gm, '· ')         // puces -> point médian
        .replace(/`([^`]+)`/g, '$1')             // `code`
        .trim()

    if (!reponse) {
        return NextResponse.json({ error: 'Réponse vide.', repli: 'Reformulez votre question ?' }, { status: 502 })
    }

    return NextResponse.json({ reponse }, { headers: { 'Cache-Control': 'no-store' } })
}
