/* ═══════════════════════════════════════════════════════════
   Règlement d'une proposition (devis) depuis l'application.

   On réutilise la page de paiement du site (/p/{secret}/paiement) plutôt que
   de réécrire le parcours : elle porte déjà la sélection des prestations, le
   choix de la devise, les trois passerelles actives selon l'admin, et la
   vérification serveur du paiement. Dupliquer tout cela en natif créerait deux
   vérités sur l'encaissement — la pire des situations pour de l'argent.

   L'écran ajoute ce qui manque à une simple page web : un cadre applicatif
   (barre tricolore, retour), et la détection du retour de paiement pour
   revenir aux propositions avec un état à jour.
═══════════════════════════════════════════════════════════ */
import React, { useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { WebViewNavigation } from 'react-native-webview'
import { ChevronLeft, ShieldCheck } from 'lucide-react-native'
import { screenColors as C, spacing, radius, typography, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DevisPaiementScreen({ navigation, route }: { navigation: any; route: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const secretKey: string | undefined = route?.params?.secretKey
    const [chargement, setChargement] = useState(true)
    const fini = useRef(false)

    /* La page de paiement redirige vers une confirmation quand tout est réglé.
       On le détecte pour ramener le client dans l'application, à jour, plutôt
       que de le laisser sur une page web sans issue. */
    const surNavigation = (nav: WebViewNavigation) => {
        if (fini.current) return
        if (/succes|success|confirmation|merci/i.test(nav.url)) {
            fini.current = true
            toast(t('Paiement confirmé'), t('Merci ! Votre proposition est réglée.'))
            setTimeout(() => navigation.navigate('MesPropositions'), 600)
        }
    }

    if (!secretKey) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.centre}>
                    <Text style={styles.vide}>{t('Proposition introuvable.')}</Text>
                    <Pressable onPress={() => navigation.goBack()} style={styles.btn} accessibilityRole="button">
                        <Text style={styles.btnText}>{t('Retour')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Régler ma proposition')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <WebView
                source={{ uri: `${API_BASE}/p/${secretKey}/paiement` }}
                style={{ flex: 1, backgroundColor: C.bg }}
                onNavigationStateChange={surNavigation}
                onLoadEnd={() => setChargement(false)}
                startInLoadingState
                renderLoading={() => (
                    <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
                )}
                // Le widget de paiement ouvre ses propres fenêtres.
                javaScriptCanOpenWindowsAutomatically
                setSupportMultipleWindows={false}
            />

            <View style={[styles.pied, { paddingBottom: insets.bottom + 10 }]}>
                <ShieldCheck size={14} color={C.primary} strokeWidth={2} />
                <Text style={styles.piedText}>
                    {t('Paiement sécurisé. Le règlement est vérifié auprès de la passerelle avant validation.')}
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    pied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: spacing.gutter, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    piedText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: C.textMuted, lineHeight: 16 },
    vide: { ...typography.body, color: C.textMuted },
    btn: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 13 },
    btnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
})
