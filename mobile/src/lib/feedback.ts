/* ═══════════════════════════════════════════════════════════
   RETOURS UTILISATEUR — point d'entrée unique

   Pourquoi ce module : l'app appelait `Alert.alert` à 105 endroits. La boîte
   système est grise, non stylable, bloque l'interface pour une simple erreur
   de saisie, et n'a rien à voir avec la charte. On la remplace par un toast
   (message passager, non bloquant) et une feuille de confirmation (choix
   explicite, bloquant à raison).

   Ce fichier n'est PAS un composant : c'est un relais. Il peut donc être
   appelé depuis n'importe où — corps de composant, callback asynchrone,
   fonction utilitaire hors React. Le provider s'enregistre au montage ;
   tant qu'il ne l'est pas, on retombe sur Alert.alert pour ne jamais
   perdre un message.
═══════════════════════════════════════════════════════════ */

import { Alert } from 'react-native'

export type ToastTone = 'success' | 'danger' | 'warning' | 'neutral'

export interface ToastOptions {
    title: string
    message?: string
    tone?: ToastTone
}

export interface ConfirmOptions {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Rouge + annonce explicite : suppression, annulation, déconnexion. */
    destructive?: boolean
    onConfirm: () => void | Promise<void>
    onCancel?: () => void
}

export interface ChoiceOption {
    label: string
    onPress: () => void | Promise<void>
    destructive?: boolean
}

export interface ChooseOptions {
    title: string
    message?: string
    options: ChoiceOption[]
    cancelLabel?: string
}

interface Handler {
    toast: (o: ToastOptions) => void
    confirm: (o: ConfirmOptions) => void
    choose: (o: ChooseOptions) => void
}

let handler: Handler | null = null

/** Appelé par FeedbackProvider au montage. */
export function registerFeedback(h: Handler | null) {
    handler = h
}

/* Le ton se déduit du titre : les 105 appels d'origine n'en passaient aucun,
   mais leurs intitulés sont explicites (« Erreur », « Paiement reçu »…).
   On lit ce que le message dit déjà plutôt que d'imposer un ton neutre. */
const DANGER = /erreur|échou|echou|refus|invalide|impossible|annul/i
const WARNING = /attention|requis|manquant|faible|expir|limite/i
const SUCCESS = /succès|succes|reçu|recu|enregistr|mise à jour|mis à jour|validé|valide|envoyé|envoye|bienvenue|confirmé|confirme|ajouté|ajoute/i

export function toneFromTitle(title: string, message = ''): ToastTone {
    const s = `${title} ${message}`
    if (DANGER.test(s)) return 'danger'
    if (SUCCESS.test(s)) return 'success'
    if (WARNING.test(s)) return 'warning'
    return 'neutral'
}

/** Message passager. N'interrompt pas l'utilisateur. */
export function toast(title: string, message?: string, tone?: ToastTone) {
    if (!handler) {
        Alert.alert(title, message)
        return
    }
    handler.toast({ title, message, tone: tone ?? toneFromTitle(title, message) })
}

/** Plusieurs actions possibles (choisir un avatar, une source d'image…). */
export function choose(options: ChooseOptions) {
    if (!handler) {
        Alert.alert(options.title, options.message, [
            ...options.options.map(o => ({
                text: o.label,
                style: (o.destructive ? 'destructive' : 'default') as 'destructive' | 'default',
                onPress: () => { void o.onPress() },
            })),
            { text: options.cancelLabel || 'Annuler', style: 'cancel' as const },
        ])
        return
    }
    handler.choose(options)
}

/** Choix explicite. Bloque volontairement : l'action est conséquente. */
export function confirm(options: ConfirmOptions) {
    if (!handler) {
        Alert.alert(options.title, options.message, [
            { text: options.cancelLabel || 'Annuler', style: 'cancel', onPress: options.onCancel },
            {
                text: options.confirmLabel || 'Confirmer',
                style: options.destructive ? 'destructive' : 'default',
                onPress: () => { void options.onConfirm() },
            },
        ])
        return
    }
    handler.confirm(options)
}
