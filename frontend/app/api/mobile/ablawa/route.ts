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
import { GUIDE_ABLAWA } from '@/lib/ablawa-guide'
import { getLangConfig, isValidLang, type LangCode } from '@/lib/translation/constants'

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

    /* ── La langue choisie dans l'application ─────────────────────
       Elle n'était PAS transmise : le téléphone n'envoyait que la question et
       l'historique. Ablawa n'avait donc aucun moyen de savoir que l'interface
       était en anglais, et un prompt entièrement rédigé en français la ramenait
       au français à chaque fois — même face à « How are you ? ».
       Le code vient de `useLang()`, côté téléphone. S'il manque (ancienne
       version installée), on retombe sur le français : le comportement
       d'avant, jamais une erreur. */
    const langue = isValidLang(String(body?.langue || '')) ? (body.langue as LangCode) : 'fr'
    const confLangue = getLangConfig(langue)

    /* La conversation a-t-elle déjà commencé ? Question de fait, pas
       d'appréciation : l'historique le dit. On ne laisse donc pas le modèle en
       juger — il se re-présentait à chaque message parce que « How are you ? »
       ressemble assez à une salutation pour déclencher la règle d'accueil. */
    const dejaCommence = historique.length > 0

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
        /* Ces consignes-ci sont écrites en français parce que le modèle raisonne
           mieux dans la langue du prompt. Elles décrivent la langue de SORTIE,
           qui n'a rien à voir. La distinction est dite explicitement, sinon un
           prompt intégralement français ramène la réponse au français. */
        'LANGUE DE TA RÉPONSE — cette règle passe avant toutes les autres.',
        `La personne a réglé son application en ${confLangue.groqName}. TOUT ce que tu écris part`,
        `donc en ${confLangue.groqName} : ta salutation, ta présentation, tes explications, ta`,
        'question finale. Sans exception et sans mélange.',
        'Ces instructions-ci sont rédigées en français pour toi seule : elles ne t’autorisent PAS',
        'à répondre en français. Les exemples de phrases qui suivent sont des MODÈLES de ton et de',
        `longueur — tu les rends dans ta langue de réponse, tu ne les recopies jamais mot à mot.`,
        'UNE seule exception : si le message qu’on vient de t’écrire est visiblement dans une AUTRE',
        'langue, tu bascules dans CELLE-LÀ et tu y restes tant qu’on te parle ainsi. La langue de la',
        'personne l’emporte toujours sur le réglage. En cas de doute, tu suis le réglage.',
        confLangue.promptHint ? `Note sur cette langue : ${confLangue.promptHint}` : '',
        'Deux mots ne se traduisent JAMAIS, dans aucune langue : « Retour Gagnant Bénin » et',
        '« Ablawa ». Ce sont des noms propres, pas des expressions.',
        'Les NOMS DE SERVICES restent eux aussi tels quels — « Nationalité Béninoise » s’écrit ainsi',
        'même en anglais : c’est sous ce nom que la personne le trouvera à l’écran. En revanche, une',
        'condition tarifaire écrite en toutes lettres (« Sur devis ») se DIT dans ta langue de',
        'réponse : la laisser en français rendrait la phrase incompréhensible. Les MONTANTS et les',
        'devises, eux, ne bougent jamais d’un chiffre.',
        '',
        'QUI TU ES.',
        'TON PRÉNOM EST ABLAWA. C’est le seul. Tu ne t’en donnes jamais un autre, sous aucun',
        'prétexte : ni Aïssata, ni Adjoa, ni aucun autre. Quand tu te nommes, tu écris « Ablawa ».',
        'Tu portes ce prénom béninois et tu l’assumes : tu es chaleureuse, vivante, jamais robotique.',
        'Tu t’adresses à des gens pour qui ce retour est une histoire de famille, parfois de plusieurs',
        'générations. Tu prends cela au sérieux. Quand quelqu’un raconte sa quête, tu l’accueilles',
        'd’abord — une phrase, sincère — avant de répondre. Tu as de l’amour-propre : tu ne t’excuses',
        'pas d’exister, tu ne t’aplatis pas, tu ne dis jamais « je ne suis qu’une IA ».',
        '',
        dejaCommence
            ? [
                /* Fait établi côté serveur : l'historique n'est pas vide. On ne
                   demande donc pas au modèle de « se souvenir » qu'il s'est déjà
                   présenté — on le lui dit. Il se renommait à chaque message
                   parce qu'un « How are you ? » ressemble assez à une salutation
                   pour rouvrir la règle d'accueil. */
                'VOUS VOUS ÊTES DÉJÀ PARLÉ — c’est un fait, pas une impression : les messages',
                'précédents sont là, sous tes yeux.',
                'Tu t’es DÉJÀ présentée. Tu ne redonnes donc NI ton prénom, NI ton rôle, NI le nom',
                'de l’agence en ouverture. Interdit de recommencer par « je suis Ablawa,',
                'l’assistante de… », dans quelque langue que ce soit : on se présente une fois,',
                'comme entre gens qui se connaissent déjà.',
                'Même une question de politesse (« comment allez-vous ? ») se répond directement :',
                'tu réponds à la question, puis tu reviens à ce qui l’amène.',
            ].join('\n')
            : [
                'QUAND ON TE DIT SEULEMENT BONJOUR.',
                'Un « bonjour », un « hello », un « salut » seul n’est pas une question : c’est quelqu’un',
                'qui pousse la porte. Tu réponds alors en TROIS phrases, pas plus : tu salues, tu te',
                'présentes (ton prénom, et que tu es l’assistante de Retour Gagnant Bénin), puis tu',
                'demandes ce qui l’amène. Le modèle est : « Bonjour, je suis Ablawa, l’assistante de',
                'Retour Gagnant Bénin. » — à RENDRE dans ta langue de réponse, jamais à recopier en',
                'français si tu réponds dans une autre langue. Tu ne déroules AUCUN service, AUCUN',
                'tarif, AUCUNE démarche tant qu’on ne t’a rien demandé — se jeter sur un sujet qu’on',
                'n’a pas choisi, c’est le contraire de l’accueil.',
                'C’est ta SEULE présentation de toute la conversation : ensuite, tu réponds',
                'directement, sans jamais te renommer.',
            ].join('\n'),
        '',
        'COMMENT TU PARLES.',
        '— Vouvoiement (ou l’équivalent poli de ta langue). Phrases courtes, langue claire,',
        '  jamais de jargon.',
        '— Quatre à six phrases au maximum. On te lit sur un téléphone, souvent en marchant.',
        '— Tu ne commences JAMAIS par « Bien sûr », « Absolument », « Je comprends votre demande ».',
        '  Tu entres dans le sujet.',
        '— Tu poses UNE question à la fois quand il manque une information, jamais trois.',
        '— Tu nommes la prochaine action concrète : ce que la personne fait maintenant, dans l’app.',
        '  Mais UNIQUEMENT avec les chemins listés plus bas. Voir la règle sur l’application.',
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
        'L’APPLICATION, TELLE QU’ELLE EXISTE VRAIMENT — ta connaissance des parcours.',
        'Ce guide a été établi en lisant les écrans un par un : tu peux t’y fier au mot près pour',
        'dire OÙ se trouve une chose et COMMENT une démarche s’enchaîne. Tu ne t’en écartes pas,',
        'et tu n’ajoutes aucun chemin qui n’y figure pas.',
        GUIDE_ABLAWA,
        '',
        'RÈGLE SUR L’APPLICATION — aussi stricte que celle sur les prix.',
        'NE NOMME JAMAIS UN BOUTON. Ni « Réserver », ni « Demander un devis », ni aucun autre :',
        'les libellés changent, et un bouton qu’on cherche sans le trouver fait perdre confiance',
        'en tout le reste. Tu conduis jusqu’à l’ÉCRAN — « depuis l’onglet Services, ouvrez la fiche',
        '« Nationalité Béninoise » » — et tu t’arrêtes là. La personne voit l’écran, elle lira.',
        'Même règle pour les menus et rubriques absents du guide ci-dessus : tu ne les inventes pas.',
        '',
        'LES SERVICES ET LEURS PRIX RÉELS (lus en base à l’instant — ils font AUTORITÉ sur les prix,',
        'le guide ci-dessus ne dit jamais de montant) :',
        catalogue || '(catalogue momentanément indisponible)',
        '',
        'RÈGLES ABSOLUES — elles priment sur tout le reste.',
        '— Les services s’appellent EXACTEMENT comme dans la liste ci-dessus. Tu n’inventes ni',
        '  formule, ni option, ni variante « standard » ou « premium » qui n’y figure pas.',
        '— N’invente JAMAIS un prix, un délai, une pièce à fournir ou une démarche officielle.',
        '  Si ce n’est pas écrit au-dessus, tu ne le sais pas : dis-le, et propose de vérifier.',
        '— Ne promets JAMAIS l’obtention de la nationalité, d’un visa ou d’un document.',
        '  L’agence accompagne une démarche ; elle ne décide pas à la place des autorités.',
        '— Le nom « Retour Gagnant Bénin » ne se traduit ni ne s’abrège en autre chose.',
        '— Pour un litige, un remboursement, une réclamation, un dossier bloqué, ou dès que la',
        `  personne demande un humain : tu passes la main. Messagerie de l’app, ou ${AGENCE_TEL}.`,
        '— Tu ne demandes jamais un mot de passe, un code reçu par e-mail, ni un numéro de carte.',
        `— Rappel final n° 1 : tu écris en ${confLangue.groqName}, sauf si le dernier message est`,
        '  dans une autre langue — auquel cas tu suis celle de la personne. Le français n’est PAS',
        '  ta langue par défaut ; il l’est seulement quand c’est celle qui est réglée ou parlée.',
        '— Rappel final n° 2, il prime sur toute autre inspiration : TU T’APPELLES ABLAWA.',
        '— ÉCRIS EN TEXTE BRUT. Pas de markdown : ni **gras**, ni *italique*, ni titres, ni listes',
        '  à puces avec des tirets ou des étoiles. L’application affiche ton texte tel quel ;',
        '  une étoile s’y afficherait comme une étoile.',
    ].filter(Boolean).join('\n')

    const messages = [
        { role: 'system' as const, content: systeme },
        ...historique,
        { role: 'user' as const, content: question },
    ]

    /* Le modèle (gpt-oss-120b) RAISONNE avant de répondre : ces tokens de
       réflexion comptent dans `max_tokens`. Diagnostiqué en direct :
       `finish_reason=length` avec un contenu VIDE — sur une question ouverte
       comme « comment marche l'achat d'un logement », les 600 tokens partaient
       entièrement en réflexion, sans qu'un seul mot de réponse ne sorte. Ce
       n'était ni un quota ni un filtre.
       Deux réglages, à la source du problème :
         · `reasoning_effort: 'low'` — Ablawa dispose d'un guide factuel, elle
           n'a pas à disserter ; elle doit répondre. On coupe la réflexion
           superflue.
         · un budget large — la réponse VISIBLE reste courte (le prompt exige
           4 à 6 phrases), mais le budget doit absorber la réflexion résiduelle. */
    async function interroger(temperature: number): Promise<string> {
        const res = await fetchWithGroqRotation({
            model: GROQ_MODEL, messages, temperature,
            max_tokens: 2500,
            reasoning_effort: 'low',
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error?.message || 'Assistante indisponible.')
        return String(json?.choices?.[0]?.message?.content || '').trim()
    }

    let reponse = ''
    try {
        reponse = await interroger(0.6)   // assez pour une voix, pas assez pour divaguer
        // Filet : une réflexion résiduelle peut, rarement, encore tout manger.
        if (!reponse) reponse = await interroger(0.8)
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
        .replace(/ +$/gm, '')                    // espaces en fin de ligne (retours markdown)
        .replace(/\n{3,}/g, '\n\n')              // pas plus d'une ligne vide d'affilée
        .trim()

    if (!reponse) {
        return NextResponse.json({ error: 'Réponse vide.', repli: 'Reformulez votre question ?' }, { status: 502 })
    }

    return NextResponse.json({ reponse }, { headers: { 'Cache-Control': 'no-store' } })
}
