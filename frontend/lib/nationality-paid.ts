// Statut de paiement « payé » d'un dossier de nationalité : tolère les
// variantes (accents, libellés de webhooks). Source de vérité unique côté
// serveur pour la règle « réservé aux dossiers payés ».
export function isPaidNationality(status?: string | null): boolean {
    const v = String(status || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .trim()
    return ['paye', 'paid', 'success', 'reussi', 'completed', 'ok'].includes(v)
}
