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
import React, { useCallback, useRef, useState } from 'react'
import { Modal, View, Text, StyleSheet, ActivityIndicator, Linking, Platform, KeyboardAvoidingView } from 'react-native'
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
    /**
     * Précharge les ressources du widget pendant que le client lit le
     * récapitulatif, au lieu d'attendre qu'il appuie sur « Payer ».
     * Voir la note sur le préchauffage plus bas.
     */
    prechauffer?: boolean
}

/* ═══════════════════════════════════════════════════════════
   PRÉCHAUFFAGE — pourquoi le premier paiement était si long.

   Mesuré sur la page de Kkiapay le 2026-08-24 :

     · widget-v3.kkiapay.me                1,3 Ko
     · /assets/index.df8cadf8.js       1 331 902 o   ← 1,33 Mo
     · /assets/index.b8737d7c.css         41 Ko

   Le paquet JavaScript est servi SANS COMPRESSION (aucun Content-Encoding)
   et SANS `Cache-Control` — seulement un `ETag` et un `Last-Modified`, ce
   qui laisse le navigateur appliquer une fraîcheur heuristique. Sur une
   connexion mobile, 1,33 Mo se téléchargent en 15 à 30 secondes, et c'est
   ce que le client attendait, écran figé, après avoir appuyé sur « Payer ».

   Ces en-têtes sont chez Kkiapay : nous ne pouvons pas les corriger. Ce que
   nous pouvons faire, c'est déplacer l'attente là où elle ne coûte rien.
   Une WebView invisible charge l'origine du widget dès que le récapitulatif
   de paiement s'affiche — pendant que le client lit le montant et appuie.
   Les ressources atterrissent dans le cache HTTP de la WebView ; à
   l'ouverture réelle, la page se monte depuis ce cache.

   Trois précautions :
     · l'URL de préchauffage ne porte AUCUNE configuration, donc aucune
       transaction n'est initiée — on ne télécharge que la coquille ;
     · la WebView invisible ne vit que le temps du récapitulatif : elle est
       démontée avec lui, la mémoire est rendue ;
     · `javaScriptEnabled` reste actif, sans quoi le HTML seul serait
       chargé et les assets — le vrai poids — ne seraient jamais demandés.
   ═══════════════════════════════════════════════════════════ */
const ORIGINE_WIDGET = 'https://widget-v3.kkiapay.me/'

export default function KkiapayWidget({ visible, config, onSucces, onEchec, onAnnule, prechauffer = true }: Props) {
    /* Progression réelle du chargement. Un rond qui tourne pendant vingt
       secondes se lit comme une panne ; une barre qui avance se lit comme
       un travail en cours. */
    const [progression, setProgression] = useState(0)
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

    /* ORDRE IMPORTANT : le préchauffage est testé AVANT `config`.
       `config` reste nul tant que le client n'a pas appuyé sur « Payer » —
       placer ce bloc après le garde ci-dessous reviendrait à ne jamais
       précharger, c'est-à-dire à ne rien corriger du tout.

       Rendue hors de l'écran plutôt que masquée par `display: none`, qui
       empêche certaines WebView Android de charger leur page. */
    if (!visible) {
        if (!prechauffer) return null
        return (
            <View style={styles.prechauffage} pointerEvents="none" accessible={false}>
                <WebView
                    source={{ uri: ORIGINE_WIDGET }}
                    javaScriptEnabled
                    domStorageEnabled
                    cacheEnabled
                    incognito={false}
                    androidLayerType="software"
                    style={styles.prechauffageVue}
                />
            </View>
        )
    }

    if (!config) return null

    // A chaque ouverture, on repart d une ardoise propre.
    if (conclu.current) conclu.current = false

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
                        cacheEnabled
                        onLoadProgress={({ nativeEvent }) => setProgression(nativeEvent.progress)}
                        onLoadEnd={() => setProgression(1)}
                        renderLoading={() => (
                            <View style={styles.attente}>
                                <ActivityIndicator size="large" color={C.primary} />
                                {/* Barre de progression réelle : le paquet de
                                    Kkiapay pèse 1,33 Mo non compressé, l'attente
                                    doit se voir avancer. */}
                                <View style={styles.barre}>
                                    <View style={[styles.barreRemplie, { width: `${Math.round(progression * 100)}%` }]} />
                                </View>
                                <Text style={styles.attenteTexte}>
                                    {progression < 0.9 ? 'Connexion sécurisée à Kkiapay…' : 'Presque prêt…'}
                                </Text>
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
    attente: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', gap: 14, paddingHorizontal: 40 },
    barre: { width: '100%', maxWidth: 260, height: 4, borderRadius: 2, backgroundColor: C.surfaceAlt, overflow: 'hidden' },
    barreRemplie: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
    attenteTexte: { fontSize: 13, color: C.textSec, textAlign: 'center' },
    /* Hors champ plutot que masquee : une WebView en display:none ne charge
       pas sa page sur certaines versions d Android. */
    prechauffage: { position: 'absolute', width: 1, height: 1, left: -9999, top: -9999, opacity: 0 },
    prechauffageVue: { width: 1, height: 1 },
})
