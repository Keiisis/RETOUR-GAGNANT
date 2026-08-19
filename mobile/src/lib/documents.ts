/* ═══════════════════════════════════════════════════════════
   Téléchargement d'un document (facture, devis, reçu).

   Les factures s'ouvraient par `Linking.openURL` : le téléphone QUITTAIT
   l'application pour le navigateur, et le client se retrouvait devant une page
   web au lieu d'un document. Rien à ranger, rien à envoyer à son comptable, et
   une session web où il n'est pas connecté.

   Ici, le fichier est réellement téléchargé sur le téléphone, avec le jeton du
   client, puis remis au système : « Enregistrer dans Fichiers », « Envoyer par
   WhatsApp », « Ouvrir dans Drive ». C'est le comportement attendu d'un
   document.
═══════════════════════════════════════════════════════════ */
import * as FileSystem from 'expo-file-system/legacy'
import { authHeaders } from '../config/api'

/* expo-sharing est un module NATIF : un `import` direct fait planter l'écran
   entier sur un build compilé avant son ajout (« Cannot find native module
   ExpoSharing »). On le charge paresseusement et on tolère son absence : le
   fichier est alors écrit sur le téléphone, sans feuille de partage. */
function chargerPartage(): {
    isAvailableAsync: () => Promise<boolean>
    shareAsync: (uri: string, options?: object) => Promise<void>
} | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('expo-sharing')
    } catch {
        return null
    }
}

/** Un nom de fichier sûr : pas de séparateur, pas d'accent perdu en route. */
function nomSur(nom: string): string {
    return nom
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 120)
}

export interface ResultatTelechargement {
    ok: boolean
    /** Emplacement du fichier sur le téléphone, quand il a pu être écrit. */
    chemin?: string
    /** Vrai si la feuille de partage système a été présentée. */
    partage?: boolean
    erreur?: string
}

/**
 * Télécharge un document authentifié, puis le remet au système.
 *
 * @param url        adresse du document (PDF)
 * @param nomFichier nom proposé au client
 */
export async function telechargerDocument(url: string, nomFichier: string): Promise<ResultatTelechargement> {
    const nom = nomSur(nomFichier.endsWith('.pdf') ? nomFichier : `${nomFichier}.pdf`)
    const destination = `${FileSystem.cacheDirectory}${nom}`

    try {
        /* Le jeton part avec la requête : sans lui, le serveur répond 401 et
           l'on écrirait une page d'erreur dans un fichier nommé « .pdf ». */
        const res = await FileSystem.downloadAsync(url, destination, {
            headers: { ...(await authHeaders()) },
        })

        if (res.status !== 200) {
            await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined)
            return {
                ok: false,
                erreur: res.status === 401
                    ? 'Session expirée. Reconnectez-vous et réessayez.'
                    : `Document indisponible (erreur ${res.status}).`,
            }
        }

        /* Contrôle du contenu : un serveur peut répondre 200 avec une page
           HTML d'erreur. Un PDF commence toujours par « %PDF ». */
        const debut = await FileSystem.readAsStringAsync(destination, {
            encoding: FileSystem.EncodingType.Base64,
            length: 8,
            position: 0,
        }).catch(() => '')
        // « %PDF » en base64 commence par « JVBER ».
        if (debut && !debut.startsWith('JVBER')) {
            await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined)
            return { ok: false, erreur: 'Le document reçu n’est pas un PDF valide. Réessayez dans un instant.' }
        }

        const partage = chargerPartage()
        if (partage && await partage.isAvailableAsync().catch(() => false)) {
            await partage.shareAsync(res.uri, {
                mimeType: 'application/pdf',
                dialogTitle: nom,
                UTI: 'com.adobe.pdf',   // iOS
            })
            return { ok: true, chemin: res.uri, partage: true }
        }

        // Sans feuille de partage, le fichier existe quand même : on le dit.
        return { ok: true, chemin: res.uri, partage: false }
    } catch (e) {
        return { ok: false, erreur: e instanceof Error ? e.message : 'Téléchargement impossible.' }
    }
}
