// ══════════════════════════════════════════════════════════════
// Politique de mot de passe fort : source unique (serveur).
// Utilisée par TOUS les formulaires de création de compte :
//   • /api/client/register
//   • /api/admin/users/create
// (Le mobile duplique ces règles côté écran, mais passe par
//  /api/client/register qui revalide → obligation systeme.)
// ══════════════════════════════════════════════════════════════

export const PASSWORD_RULES = {
    minLength: 12,
    minDigits: 2,
} as const

/** Retourne la liste des règles NON satisfaites (vide = mot de passe fort). */
export function validateStrongPassword(password: string): string[] {
    const errors: string[] = []
    if (typeof password !== 'string' || password.length < PASSWORD_RULES.minLength) {
        errors.push(`${PASSWORD_RULES.minLength} caractères minimum`)
    }
    if (!/[A-Z]/.test(password || '')) errors.push('1 lettre majuscule')
    if (((password || '').match(/\d/g) || []).length < PASSWORD_RULES.minDigits) {
        errors.push(`${PASSWORD_RULES.minDigits} chiffres minimum`)
    }
    if (/^[A-Za-z0-9]*$/.test(password || '')) errors.push('1 caractère spécial')
    return errors
}

/** true si le mot de passe respecte toutes les règles. */
export function isStrongPassword(password: string): boolean {
    return validateStrongPassword(password).length === 0
}
