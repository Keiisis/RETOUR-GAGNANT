import { createHash } from 'crypto'

/* Empreinte du code de suppression. Isolée ici pour que la route qui ENVOIE
   le code et celle qui le VÉRIFIE partagent exactement le même calcul : deux
   implémentations séparées finiraient par diverger d'un `trim` ou d'une
   casse, et plus aucun code ne serait accepté. */
export function empreinteCodeSuppression(code: string): string {
    return createHash('sha256').update(code.trim()).digest('hex')
}

/** Dix minutes : assez pour relever ses mails, trop court pour trainer. */
export const VALIDITE_CODE_MINUTES = 10
