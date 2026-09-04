// ══════════════════════════════════════════════════════════════
//  La FICHE D'ANALYSE d'un récap MyAfroOrigins.
//
//  Extraite de `app/api/services/recap-myafroorigins/route.ts`, où elle était
//  une fonction locale : le panel doit pouvoir produire la même fiche pour un
//  client saisi à la main par un agent. La recopier aurait garanti que les deux
//  versions divergent — l'une gagnant une consigne que l'autre n'aurait pas.
//  Un seul texte, un seul comportement, deux appelants.
// ══════════════════════════════════════════════════════════════
import { fetchWithGroqRotation, GROQ_MODEL } from '@/lib/groq'

/** La fiche d'analyse. Elle décrit ce qui bloque, jamais une promesse de résultat. */
export async function genererRecap(d: Record<string, string>): Promise<string | null> {
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
