/* ═══════════════════════════════════════════════════════════
   Widget de paiement Kkiapay — notre propre hôte.

   POURQUOI NE PAS UTILISER `KkiapayProvider` DU SDK.

   Le provider du SDK rend ceci :

       {widgetOpened && <SafeAreaView><WebView …/></SafeAreaView>}
       {!widgetOpened && children}

   À l'ouverture du widget, il DÉMONTE donc tout l'arbre de l'application —
   NavigationContainer compris. À la fermeture, l'arbre est remonté à neuf :
   navigation réinitialisée, écrans détruits, saisies perdues, retour à
   l'accueil. C'est ce que l'on prenait pour « l'application redémarre ».
   Et c'est aussi pourquoi aucun écran de résultat n'apparaissait : le
   composant qui devait naviguer n'existait plus au moment de le faire.

   Ici, le widget vit dans un `Modal` : React Native le rend dans une fenêtre
   séparée, SANS toucher à l'arbre en dessous. L'application reste debout,
   l'écran appelant garde son état, et la navigation fonctionne.

   Le SDK n'apporte rien d'autre : il charge `widget-v3.kkiapay.me` avec la
   configuration encodée en base64 et écoute les messages de la page. C'est
   exactement ce que fait ce fichier — vérifié dans
   node_modules/@kkiapay-org/react-native-sdk/src/kkiapay.tsx.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useRef } from 'react'
import { Modal, View, StyleSheet, ActivityIndicator, Linking, Platform, KeyboardAvoidingView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { screenColors as C } from '../config/theme'

const WIDGET_URI = 'https://widget-v3.kkiapay.me?'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Encodage base64 de la configuration.
 *
 * Hermes n'expose ni `btoa` ni `Buffer` : on encode donc à la main, sur les
 * octets UTF-8 — la raison du paiement contient des accents (« Récap de
 * dossier »), et un encodage naïf caractère par caractère les corromprait.
 */
function base64(texte: string): string {
    const octets: number[] = []
    for (const c of unescape(encodeURIComponent(texte))) octets.push(c.charCodeAt(0))

    let sortie = ''
    for (let i = 0; i < octets.length; i += 3) {
        const a = octets[i]
        const b = octets[i + 1]
        const c = octets[i + 2]
        sortie += ALPHABET[a >> 2]
        sortie += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)]
        sortie += b === undefined ? '=' : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)]
        sortie += c === undefined ? '=' : ALPHABET[c & 63]
    }
    return sortie
}

/** Noms d'événements émis par la page du widget (typings.ts du SDK). */
const EV = {
    SUCCESS: 'PAYMENT_SUCCESS',
    FAILED: 'PAYMENT_FAILED',
    ABORTED: 'PAYMENT_ABORTED',
    CLOSE: 'CLOSE_WIDGET',
    WAVE: 'WAVE_LINK',
} as const

export interface ConfigKkiapay {
    amount: number
    api_key: string
    sandbox?: boolean
    email?: string
    phone?: string
    name?: string
    reason: string
    data?: string
}

interface Props {
    visible: boolean
    config: ConfigKkiapay | null
    onSucces: (transactionId: string) => void
    onEchec: (motif?: string) => void
    /** Fermé sans payer. Rien n'a été débité. */
    onAnnule: () => void
}

export default function KkiapayWidget({ visible, config, onSucces, onEchec, onAnnule }: Props) {
    // Une ouverture = une issue. Sans ce verrou, la page émet parfois
    // `CLOSE_WIDGET` juste après un succès et l'on annoncerait une annulation
    // sur un paiement abouti.
    const conclu = useRef(false)

    const conclure = useCallback((action: () => void) => {
        if (conclu.current) return
        conclu.current = true
        action()
    }, [])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surMessage = useCallback((e: any) => {
        const brut = e?.nativeEvent?.data
        if (!brut) return

        let msg: { name?: string; data?: unknown }
        try { msg = JSON.parse(brut) } catch { return }

        switch (msg.name) {
            case EV.WAVE: {
                // Paiement Wave : la page demande l'ouverture de l'application.
                if (typeof msg.data === 'string') Linking.openURL(msg.data).catch(() => undefined)
                return
            }
            case EV.SUCCESS: {
                const d = msg.data as { transactionId?: string; transaction_id?: string } | undefined
                const tx = String(d?.transactionId || d?.transaction_id || `KK-${Date.now()}`)
                conclure(() => onSucces(tx))
                return
            }
            case EV.FAILED: {
                const d = msg.data as { reason?: string } | undefined
                conclure(() => onEchec(typeof d?.reason === 'string' ? d.reason : undefined))
                return
            }
            case EV.ABORTED:
            case EV.CLOSE: {
                conclure(onAnnule)
                return
            }
            default:
                // Les autres événements (init, réseau, retour utilisateur) ne
                // concluent rien : on les ignore volontairement.
                return
        }
    }, [conclure, onSucces, onEchec, onAnnule])

    if (!config) return null

    // À chaque ouverture, on repart d'une ardoise propre.
    if (visible && conclu.current) conclu.current = false

    const uri = WIDGET_URI + base64(JSON.stringify(config))

    return (
        <Modal
            visible={visible}
            animationType="slide"
            // Le bouton retour physique vaut abandon : c'est ainsi que le client
            // le comprend, et rien n'a été débité.
            onRequestClose={() => conclure(onAnnule)}
            statusBarTranslucent={false}
        >
            <SafeAreaView style={styles.plein} edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    style={styles.plein}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <WebView
                        source={{ uri }}
                        style={styles.plein}
                        onMessage={surMessage}
                        javaScriptEnabled
                        domStorageEnabled
                        allowsInlineMediaPlayback
                        startInLoadingState
                        originWhitelist={['*']}
                        mixedContentMode="compatibility"
                        androidLayerType="hardware"
                        renderLoading={() => (
                            <View style={styles.attente}>
                                <ActivityIndicator size="large" color={C.primary} />
                            </View>
                        )}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}

const styles = StyleSheet.create({
    plein: { flex: 1, backgroundColor: '#FFFFFF' },
    attente: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
})
