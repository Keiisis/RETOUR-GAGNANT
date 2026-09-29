// ══════════════════════════════════════════════════════════════
//  Description multi-éléments d'une ligne de devis / facture.
//
//  Une ligne peut regrouper plusieurs prestations vendues ENSEMBLE pour un
//  seul prix (ex. « Étude de marché », « Création de société », …). Elles
//  sont saisies une par ligne dans le champ description (séparateur `\n`,
//  tiret facultatif) et restituées partout — écran, portail, PDF — comme une
//  liste à tirets, sous un seul prix.
//
//  Une description d'une seule ligne (tous les documents existants) reste
//  affichée telle quelle : aucune donnée à migrer.
// ══════════════════════════════════════════════════════════════

/** Tiret, puce ou astérisque en tête d'élément (retiré à l'affichage). */
const PUCE = /^\s*(?:[-–—•*·]\s*)+/

/** Éléments d'une description : une entrée par ligne non vide, sans la puce. */
export function elementsDescription(description: string | null | undefined): string[] {
    return String(description ?? '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(l => l.replace(PUCE, '').trim())
        .filter(Boolean)
}

/** Vrai si la description regroupe plusieurs éléments. */
export function estMultiElements(description: string | null | undefined): boolean {
    return elementsDescription(description).length > 1
}

/**
 * Texte prêt pour jsPDF (`splitTextToSize` respecte les `\n`) :
 * un élément seul → tel quel ; plusieurs → « - élément » par ligne.
 */
export function descriptionPourPdf(description: string | null | undefined): string {
    const el = elementsDescription(description)
    if (el.length === 0) return '-'
    if (el.length === 1) return el[0]
    return el.map(e => `- ${e}`).join('\n')
}

/** Texte brut sur une ligne (emails, messages) : éléments séparés par « ; ». */
export function descriptionEnLigne(description: string | null | undefined): string {
    return elementsDescription(description).join(' ; ')
}

/**
 * Nettoyage à l'enregistrement : fins de ligne normalisées, lignes vides et
 * espaces superflus retirés, tiret « - » uniforme quand il y a plusieurs éléments.
 */
export function normaliserDescription(description: string | null | undefined): string {
    const el = elementsDescription(description)
    return el.length > 1 ? el.map(e => `- ${e}`).join('\n') : (el[0] ?? '')
}
