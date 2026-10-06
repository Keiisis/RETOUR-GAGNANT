// Masquage des marques avant hachage : la clé d'une traduction est le hash du texte masqué.
// Partagé par le site (TranslationProvider) et le script des dictionnaires (scripts/i18n.ts).
// Extract brand names to prevent them from being translated, EXCEPT "VOTRE RETOUR GAGNANT"
export const extractBrands = (text: string) => {
    let masked = text || '';
    const extractedVars: Record<string, string> = {};

    const vrgMatch = masked.match(/VOTRE RETOUR GAGNANT/gi);
    if (vrgMatch) {
        masked = masked.replace(/VOTRE RETOUR GAGNANT/ig, '___VRG___');
    }

    const rgbMatch1 = masked.match(/RETOUR GAGNANT BÉNIN/i);
    if (rgbMatch1) {
        extractedVars['RGB1'] = rgbMatch1[0];
        masked = masked.replace(/RETOUR GAGNANT BÉNIN/ig, '{RGB1}');
    }

    const rgbMatch2 = masked.match(/RETOUR GAGNANT BENIN/i);
    if (rgbMatch2) {
        extractedVars['RGB2'] = rgbMatch2[0];
        masked = masked.replace(/RETOUR GAGNANT BENIN/ig, '{RGB2}');
    }

    const rgMatch = masked.match(/RETOUR GAGNANT/i);
    if (rgMatch) {
        extractedVars['RG'] = rgMatch[0];
        masked = masked.replace(/RETOUR GAGNANT/ig, '{RG}');
    }

    if (vrgMatch) {
        masked = masked.replace(/___VRG___/g, vrgMatch[0]);
    }

    return { maskedText: masked, extractedVars };
};
