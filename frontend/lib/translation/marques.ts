// ══════════════════════════════════════════════════════════════
//  Les noms propres ne se traduisent pas.
//
//  En anglais, « Retour Gagnant Bénin » devenait « Winning Return Benin ».
//  Une marque n'a pas de traduction : c'est un nom, au même titre que celui
//  d'une personne. Le client anglophone qui cherche l'agence, la retrouve sous
//  le nom qu'elle porte sur ses factures et sur son enseigne — pas sous une
//  version traduite qui n'existe nulle part.
//
//  Demander poliment au modèle de ne pas traduire ne suffit pas : il le fait
//  quand même, une fois sur dix. On MASQUE donc les marques avant l'envoi —
//  elles deviennent des jetons que le modèle recopie — et on les restitue
//  après. Le modèle ne voit jamais le nom, il ne peut donc pas le traduire.
//
//  Ordre important : les formes longues d'abord, sinon « Retour Gagnant »
//  masquerait le début de « Retour Gagnant Bénin » et laisserait « Bénin »
//  traduisible à la dérive.
// ══════════════════════════════════════════════════════════════

/** Tout ce qui doit traverser une traduction sans être touché. */
export const MARQUES_PROTEGEES: string[] = [
    'Retour Gagnant Bénin',
    'Retour Gagnant Benin',
    'RETOUR GAGNANT BÉNIN',
    'RETOUR GAGNANT BENIN',
    'Retour Gagnant',
    'RETOUR GAGNANT',
    'MyAfroOrigins',
    'Ablawa',
    'Kkiapay',
    'FedaPay',
    'SIMAU',
]

/* Jeton volontairement proche des raccourcis déjà préservés par le prompt
   ({name}, {RG}…) : le modèle a l'habitude de les recopier tels quels. */
const jeton = (i: number) => `{{M${i}}}`
const MOTIF_JETON = /\{\{M\d+\}\}/g

export interface TexteMasque {
    texte: string
    /** Ce qu'il faudra remettre, dans l'ordre des jetons. */
    remplacements: string[]
}

/** Remplace chaque marque par un jeton. Insensible à la casse, forme longue d'abord. */
export function masquerMarques(texte: string): TexteMasque {
    const remplacements: string[] = []
    let sortie = texte

    for (const marque of MARQUES_PROTEGEES) {
        // Échappement : une marque peut contenir un caractère spécial de regex.
        const motif = new RegExp(marque.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        sortie = sortie.replace(motif, (trouve) => {
            const i = remplacements.length
            // On garde la forme EXACTE rencontrée (majuscules comprises).
            remplacements.push(trouve)
            return jeton(i)
        })
    }

    return { texte: sortie, remplacements }
}

/** Remet les marques à la place des jetons. */
export function demasquerMarques(texte: string, remplacements: string[]): string {
    return texte.replace(MOTIF_JETON, (j) => {
        const i = Number(j.slice(3, -2))
        return remplacements[i] ?? j
    })
}

/**
 * Le modèle a-t-il bien rendu tous les jetons ?
 *
 * S'il en a perdu un, la restitution laisserait une phrase amputée du nom de
 * l'agence. Mieux vaut alors garder le texte français : un nom absent est une
 * faute que le lecteur ne peut pas rattraper, une phrase en français est une
 * gêne qu'il comprend.
 */
export function jetonsIntacts(traduction: string, attendus: number): boolean {
    if (attendus === 0) return true
    const trouves = traduction.match(MOTIF_JETON)
    return (trouves?.length ?? 0) === attendus
}

/** Règle à insérer dans le prompt, pour que le modèle laisse les jetons tranquilles. */
export const CONSIGNE_MARQUES =
    'Some words are replaced by tokens like {{M0}}, {{M1}}. These are brand names. '
    + 'Copy every token EXACTLY as it appears, in the same place in the sentence. '
    + 'Never translate, never reorder, never remove, never add a token.'
