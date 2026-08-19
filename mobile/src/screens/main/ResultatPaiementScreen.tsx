/* ═══════════════════════════════════════════════════════════
   Résultat d'un paiement — écran commun à tous les services.

   Jusqu'ici, dix parcours encaissaient et se contentaient d'un toast : trois
   secondes d'affichage après une dépense de plusieurs centaines d'euros, et
   la référence de transaction disparaissait avec le message. Un échec, lui,
   n'avait aucun écran du tout — le client restait devant un formulaire figé,
   sans savoir si son argent avait bougé.

   Un seul écran, trois états, réutilisé partout :
     · succès  — la coche se pose, la référence reste sous les yeux ;
     · échec   — le motif réel de la passerelle, et comment nous joindre ;
     · annulé  — dire clairement que RIEN n'a été débité, et proposer de
                 reprendre là où on en était.

   Reprend la langue visuelle des maquettes Sleek du paiement de séjour
   (DevisPaiementScreen) : mêmes cercles, mêmes cartes de détail, mêmes CTA.
   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useEffect } from 'react'
import {
    View, Text, StyleSheet, Pressable, ScrollView, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, {
    FadeIn, FadeInDown, FadeInUp, Easing,
    useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated'
import {
    Check, X, RotateCcw, Headphones, ArrowLeft, ArrowRight, ShieldCheck, Info,
} from 'lucide-react-native'
import { screenColors as C, radius, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'

const VERT_PROFOND = '#00643C'
const AGENCE_TEL = '+2290160322121'

export type EtatPaiement = 'succes' | 'echec' | 'annule'

export interface ParamsResultatPaiement {
    etat: EtatPaiement
    /** Ce qui a été payé, en clair : « Consultation Fa », « Pass Événement »… */
    objet: string
    /** Phrase d'accompagnement, propre au service. */
    message?: string
    montant?: number
    devise?: string
    /** Référence de transaction — la seule preuve que garde le client. */
    reference?: string
    moyen?: string
    /** Motif réel renvoyé par la passerelle (échec uniquement). */
    motif?: string
    /** Bouton principal : libellé + destination. Par défaut, retour à l'accueil. */
    actionLabel?: string
    actionRoute?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actionParams?: any
}

const money = (v?: number, devise?: string) => {
    if (typeof v !== 'number' || v <= 0) return null
    const d = (devise || 'XOF').toUpperCase()
    const n = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: d === 'XOF' ? 0 : 2,
        maximumFractionDigits: d === 'XOF' ? 0 : 2,
    }).format(d === 'XOF' ? Math.round(v) : v)
    if (d === 'XOF') return `${n} FCFA`
    if (d === 'USD') return `$${n}`
    return `${n} ${d === 'EUR' ? '€' : d}`
}

/* La coche se POSE — elle n'apparaît pas. Un paiement qui aboutit mérite
   qu'on marque le geste. */
function CercleSucces() {
    const e = useSharedValue(0)
    useEffect(() => {
        e.value = withSequence(
            withTiming(1.14, { duration: 320, easing: Easing.out(Easing.back(2)) }),
            withTiming(1, { duration: 180 }),
        )
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    }, [e])
    const style = useAnimatedStyle(() => ({ transform: [{ scale: e.value }] }))
    return (
        <Animated.View style={[styles.cercle, { backgroundColor: C.primarySoft }, style]}>
            <View style={[styles.disque, { backgroundColor: C.primary }]}>
                <Check size={32} color="#FFFFFF" strokeWidth={3} />
            </View>
        </Animated.View>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ResultatPaiementScreen({ navigation, route }: { navigation: any; route: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()

    const p: ParamsResultatPaiement = route?.params || { etat: 'annule', objet: '' }
    const succes = p.etat === 'succes'
    const echec = p.etat === 'echec'
    const montant = money(p.montant, p.devise)

    useEffect(() => {
        if (echec) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
    }, [echec])

    const quand = new Date().toLocaleString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    /* Le libellé d'en-tête dit l'état AVANT que l'œil ne descende sur l'icône. */
    const surtitre = succes
        ? t('Confirmation officielle')
        : echec ? t('Statut du règlement') : t('Paiement interrompu')

    const titre = succes
        ? t('Paiement confirmé')
        : echec ? t('Le paiement n’a pas abouti') : t('Paiement annulé')

    const sousTitre = p.message || (succes
        ? t('Votre règlement est enregistré. Notre équipe prend le relais.')
        : echec
            ? t('Aucun montant n’a été validé de notre côté. Si votre compte a été débité, la transaction sera automatiquement annulée par la passerelle.')
            : t('Vous avez fermé la fenêtre de paiement. Rien n’a été débité, et vous pouvez reprendre quand vous voulez.'))

    const retour = () => {
        if (p.actionRoute) navigation.navigate(p.actionRoute, p.actionParams)
        else if (navigation.canGoBack()) navigation.goBack()
        else navigation.navigate('Main', { screen: 'Home' })
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.haut}>
                <Text style={[styles.surtitre, succes && { color: C.primary }, echec && { color: C.danger }]}>
                    {surtitre}
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.corps} showsVerticalScrollIndicator={false}>
                {succes ? (
                    <CercleSucces />
                ) : (
                    <Animated.View
                        entering={FadeIn.duration(360)}
                        style={[styles.cercle, { backgroundColor: echec ? C.dangerSoft : C.surfaceAlt }]}
                    >
                        <View style={[styles.disque, { backgroundColor: echec ? C.danger : C.textMuted }]}>
                            {echec
                                ? <X size={30} color="#FFFFFF" strokeWidth={3} />
                                : <RotateCcw size={28} color="#FFFFFF" strokeWidth={2.6} />}
                        </View>
                    </Animated.View>
                )}

                <Animated.Text entering={FadeInDown.delay(160).duration(420)} style={styles.titre}>
                    {titre}
                </Animated.Text>

                {!!montant && (
                    <Animated.Text
                        entering={FadeInUp.delay(240).duration(420)}
                        style={[styles.montant, !succes && styles.montantEteint]}
                    >
                        {montant}
                    </Animated.Text>
                )}

                <Animated.Text entering={FadeInDown.delay(300).duration(420)} style={styles.message}>
                    {sousTitre}
                </Animated.Text>

                {/* Le détail : ce que le client doit pouvoir montrer ou relire. */}
                <Animated.View entering={FadeInDown.delay(360).duration(420)} style={styles.carte}>
                    <View style={styles.ligne}>
                        <Text style={styles.label}>{t('Objet')}</Text>
                        <Text style={styles.valeurVerte} numberOfLines={2}>{p.objet || '—'}</Text>
                    </View>
                    {!!p.reference && (
                        <View style={[styles.ligne, styles.sep]}>
                            <Text style={styles.label}>{t('Référence transaction')}</Text>
                            <Text style={styles.valeurMono} selectable>{p.reference}</Text>
                        </View>
                    )}
                    <View style={[styles.ligne, styles.sep]}>
                        <Text style={styles.label}>{t('Moyen')}</Text>
                        <Text style={styles.valeur}>{p.moyen || t('Mobile Money')}</Text>
                    </View>
                    <View style={[styles.ligne, styles.sep]}>
                        <Text style={styles.label}>{t('Date & heure')}</Text>
                        <Text style={styles.valeur}>{quand}</Text>
                    </View>
                    {echec && !!p.motif && (
                        <View style={[styles.ligne, styles.sep]}>
                            <Text style={styles.label}>{t('Motif signalé')}</Text>
                            <Text style={styles.valeurRouge} numberOfLines={3}>{p.motif}</Text>
                        </View>
                    )}
                </Animated.View>

                {/* Ce qui vient ensuite — ou comment nous joindre. */}
                {succes ? (
                    <Animated.View entering={FadeInDown.delay(420).duration(420)} style={styles.bloc}>
                        <View style={styles.tuile}>
                            <ShieldCheck size={16} color={C.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.blocTexte}>
                            <Text style={styles.gras}>{t('Conservez cette référence.')} </Text>
                            {t('Un reçu vous est envoyé par email. Elle vous suffit pour toute question sur ce règlement.')}
                        </Text>
                    </Animated.View>
                ) : echec ? (
                    <Pressable
                        onPress={() => Linking.openURL(`tel:${AGENCE_TEL}`).catch(() => undefined)}
                        style={styles.blocBlanc}
                        accessibilityRole="button"
                    >
                        <View style={styles.tuile}>
                            <Headphones size={16} color={C.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.blocTexte}>
                            {t('Besoin d’aide ? Le cabinet reste joignable au ')}
                            <Text style={styles.gras}>{AGENCE_TEL}</Text>
                            {t(' ou par la messagerie de l’application.')}
                        </Text>
                    </Pressable>
                ) : (
                    <Animated.View entering={FadeInDown.delay(420).duration(420)} style={styles.bloc}>
                        <View style={styles.tuile}>
                            <Info size={16} color={C.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.blocTexte}>
                            {t('Votre demande n’a pas été enregistrée. Reprenez le formulaire : vos informations y sont encore.')}
                        </Text>
                    </Animated.View>
                )}
            </ScrollView>

            <View style={[styles.bas, { paddingBottom: insets.bottom + 16 }]}>
                <Pressable
                    onPress={retour}
                    style={({ pressed }) => [styles.ctaPlein, pressed && { transform: [{ scale: 0.98 }] }]}
                    accessibilityRole="button"
                >
                    {succes
                        ? <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.2} />
                        : <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.2} />}
                    <Text style={styles.ctaPleinText}>
                        {p.actionLabel || (succes ? t('Continuer') : t('Reprendre'))}
                    </Text>
                </Pressable>

                <Pressable
                    onPress={() => navigation.navigate('Main', { screen: 'Home' })}
                    style={({ pressed }) => [styles.ctaVide, pressed && { transform: [{ scale: 0.98 }] }]}
                    accessibilityRole="button"
                >
                    <ArrowLeft size={16} color={C.text} strokeWidth={2.2} />
                    <Text style={styles.ctaVideText}>{t('Retour à l’accueil')}</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    haut: { alignItems: 'center', paddingTop: 22 },
    surtitre: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' },
    corps: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 24 },

    cercle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    disque: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

    titre: { fontFamily: fonts.extrabold, fontSize: 23, lineHeight: 29, color: C.text, textAlign: 'center', marginTop: 18 },
    montant: { fontFamily: fonts.extrabold, fontSize: 28, color: VERT_PROFOND, textAlign: 'center', marginTop: 8 },
    montantEteint: { color: C.textMuted },
    message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, textAlign: 'center', marginTop: 10, maxWidth: 330 },

    carte: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginTop: 22, ...shadows.card },
    ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
    sep: { borderTopWidth: 1, borderTopColor: C.border },
    label: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    valeur: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.text, flexShrink: 1, textAlign: 'right' },
    valeurVerte: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.primary, flexShrink: 1, textAlign: 'right' },
    valeurMono: { fontFamily: fonts.bold, fontSize: 11.5, color: C.text, flexShrink: 1, textAlign: 'right' },
    valeurRouge: { fontFamily: fonts.bold, fontSize: 11.5, color: C.danger, flexShrink: 1, textAlign: 'right' },

    bloc: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 18, padding: 14, marginTop: 14 },
    blocBlanc: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginTop: 14, ...shadows.card },
    blocTexte: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: C.textSec },
    gras: { fontFamily: fonts.bold, color: C.text },
    tuile: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },

    bas: { paddingHorizontal: 24, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    ctaPlein: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    ctaPleinText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#FFFFFF' },
    ctaVide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: radius.pill, paddingVertical: 14 },
    ctaVideText: { fontFamily: fonts.bold, fontSize: 13, color: C.text },
})
