'use strict'
import React, { useEffect } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView,
    Pressable, Dimensions, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
} from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   OrderConfirmationScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec tous les écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrderConfirmation'>
type Route = RouteProp<RootStackParamList, 'OrderConfirmation'>

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION
═══════════════════════════════════════════════════════════ */
function AnimatedSection({ children, delay = 0, style }: any) {
    const anim = useSharedValue(0)
    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }))
    }, [delay])
    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 25 * (1 - anim.value) }],
    }))
    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : CONFETTI DOT (décoration animée)
═══════════════════════════════════════════════════════════ */
function ConfettiDot({ delay, x, y, color, size = 6 }: {
    delay: number
    x: number
    y: number
    color: string
    size?: number
}) {
    const anim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay,
            withSequence(
                withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: 1800, easing: Easing.in(Easing.quad) })
            )
        )
    }, [])

    const style = useAnimatedStyle(() => ({
        opacity: interpolate(anim.value, [0, 0.5, 1], [0, 1, 0]),
        transform: [
            { translateY: interpolate(anim.value, [0, 1], [0, -25]) },
            { scale: interpolate(anim.value, [0, 0.5, 1], [0.5, 1, 0.3]) },
        ],
    }))

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
                style,
            ]}
        />
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function OrderConfirmationScreen({ navigation, route }: { navigation: Nav; route: Route }) {
    const insets = useSafeAreaInsets()
    const { orderId, transactionId } = route.params
    const { t } = useLang()

    /* ── Animations Corporate ── */
    const sealAnim = useSharedValue(0)
    const sealPulse = useSharedValue(0)
    const checkAnim = useSharedValue(0)
    const ringAnim = useSharedValue(0)

    useEffect(() => {

        // Seal entry (bounce premium)
        sealAnim.value = withDelay(100,
            withSpring(1, { damping: 10, stiffness: 100, mass: 0.8 })
        )
        // Checkmark draw
        checkAnim.value = withDelay(500,
            withSpring(1, { damping: 12, stiffness: 120 })
        )
        // Un seul battement a l'entree, puis repos.
        sealPulse.value = withDelay(1200,
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            )
        )
        // Une seule expansion de l'anneau.
        ringAnim.value = withDelay(300,
            withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) })
        )
    }, [])


    const sealStyle = useAnimatedStyle(() => ({
        opacity: sealAnim.value,
        transform: [
            { scale: interpolate(sealAnim.value, [0, 0.7, 1], [0.3, 1.1, 1]) },
        ],
    }))
    const sealPulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(sealPulse.value, [0, 1], [0.1, 0.25]),
        transform: [{ scale: interpolate(sealPulse.value, [0, 1], [1, 1.1]) }],
    }))
    const checkStyle = useAnimatedStyle(() => ({
        opacity: checkAnim.value,
        transform: [{ scale: interpolate(checkAnim.value, [0, 0.6, 1], [0, 1.3, 1]) }],
    }))
    const ringStyle = useAnimatedStyle(() => ({
        opacity: interpolate(ringAnim.value, [0, 0.5, 1], [0.6, 0.2, 0]),
        transform: [{ scale: interpolate(ringAnim.value, [0, 1], [0.8, 1.8]) }],
    }))

    const goToOrder = () => navigation.replace('OrderDetail', { orderId })
    const backToBoutique = () => navigation.popToTop()

    const handleShare = async () => {
        try {
            await Share.share({
                message: t("Ma commande #{ref} est confirmée sur Retour Gagnant Bénin !").replace('{ref}', orderId.slice(0, 8).toUpperCase()),
            })
        } catch { /* ignore */ }
    }

    const shortRef = orderId.slice(0, 8).toUpperCase()
    const now = new Date()
    const formattedDate = now.toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
    })
    const formattedTime = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
    })

    return (
        <View style={styles.container}>

            {/* NAV BAR */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable onPress={backToBoutique} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Fermer')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="close" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <Ionicons name="checkmark-circle" size={12} color={C.success} />
                    <Text style={styles.navCounterText}>{t('Confirmée')}</Text>
                </View>

                <Pressable onPress={handleShare} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Partager')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="share-outline" size={20} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
            >
                {/* ═══ HERO SUCCESS SEAL ═══ */}
                <View style={styles.heroWrap}>
                    {/* Confettis décoratifs */}
                    <ConfettiDot delay={0} x={20} y={20} color={C.accent} size={6} />
                    <ConfettiDot delay={300} x={width - 60} y={30} color={C.success} size={5} />
                    <ConfettiDot delay={600} x={40} y={100} color={C.info} size={4} />
                    <ConfettiDot delay={900} x={width - 80} y={120} color={C.accent} size={7} />
                    <ConfettiDot delay={400} x={80} y={60} color={C.accentLight} size={5} />
                    <ConfettiDot delay={700} x={width - 100} y={80} color={C.success} size={4} />

                    <View style={styles.sealContainer}>
                        {/* Ring expansion */}
                        <Animated.View style={[styles.sealRing, ringStyle]} />
                        {/* Glow pulse */}
                        <Animated.View style={[styles.sealGlow, sealPulseStyle]} />

                        <Animated.View style={[styles.seal, sealStyle]}>
                            <Animated.View style={checkStyle}>
                                <Ionicons name="checkmark" size={56} color={C.primaryText} />
                            </Animated.View>
                        </Animated.View>

                        {/* Badge couronne en bas */}
                        <View style={styles.sealBadge}>
                            <Ionicons name="ribbon" size={14} color={C.accent} />
                        </View>
                    </View>
                </View>

                {/* ═══ TITRE & SOUS-TITRE ═══ */}
                <AnimatedSection delay={400}>
                    <Text style={styles.successBadgeText}>{t('PAIEMENT RÉUSSI')}</Text>
                    <Text style={styles.title}>{t('Commande confirmée')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Votre paiement a été reçu avec succès. Votre commande est désormais en préparation par notre équipe.')}
                    </Text>
                </AnimatedSection>

                {/* ═══ TICKET DE COMMANDE (style facture) ═══ */}
                <AnimatedSection delay={500}>
                    <View style={styles.ticket}>
                        {/* Header du ticket */}
                        <View style={styles.ticketHeader}>
                            <View style={styles.ticketHeaderLeft}>
                                <Ionicons name="receipt" size={14} color={C.accent} />
                                <Text style={styles.ticketHeaderText}>{t('REÇU OFFICIEL')}</Text>
                            </View>
                            <View style={styles.ticketStatusBadge}>
                                <View style={styles.ticketStatusDot} />
                                <Text style={styles.ticketStatusText}>{t('PAYÉ')}</Text>
                            </View>
                        </View>

                        {/* Numéro de commande XL */}
                        <View style={styles.ticketRefBlock}>
                            <Text style={styles.ticketRefLabel}>{t('NUMÉRO DE COMMANDE')}</Text>
                            <Text style={styles.ticketRefValue}>#{shortRef}</Text>
                        </View>

                        {/* Séparateur perforé */}
                        <View style={styles.perforation}>
                            <View style={styles.perfNotchLeft} />
                            <View style={styles.perfLine}>
                                {Array.from({ length: 14 }).map((_, i) => (
                                    <View key={i} style={styles.perfDot} />
                                ))}
                            </View>
                            <View style={styles.perfNotchRight} />
                        </View>

                        {/* Infos détails */}
                        <View style={styles.ticketInfo}>
                            <View style={styles.ticketRow}>
                                <View style={styles.ticketRowLeft}>
                                    <View style={styles.ticketRowIcon}>
                                        <Ionicons name="calendar-outline" size={14} color={C.accent} />
                                    </View>
                                    <Text style={styles.ticketRowLabel}>{t('Date')}</Text>
                                </View>
                                <Text style={styles.ticketRowValue}>{formattedDate}</Text>
                            </View>

                            <View style={styles.ticketDivider} />

                            <View style={styles.ticketRow}>
                                <View style={styles.ticketRowLeft}>
                                    <View style={styles.ticketRowIcon}>
                                        <Ionicons name="time-outline" size={14} color={C.accent} />
                                    </View>
                                    <Text style={styles.ticketRowLabel}>{t('Heure')}</Text>
                                </View>
                                <Text style={styles.ticketRowValue}>{formattedTime}</Text>
                            </View>

                            {transactionId && (
                                <>
                                    <View style={styles.ticketDivider} />
                                    <View style={styles.ticketRow}>
                                        <View style={styles.ticketRowLeft}>
                                            <View style={styles.ticketRowIcon}>
                                                <Ionicons name="card-outline" size={14} color={C.accent} />
                                            </View>
                                            <Text style={styles.ticketRowLabel}>{t('Réf. paiement')}</Text>
                                        </View>
                                        <Text style={styles.ticketRowValueSmall} numberOfLines={1}>
                                            {transactionId.slice(0, 14)}…
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ TIMELINE PROCHAINES ÉTAPES ═══ */}
                <AnimatedSection delay={600}>
                    <View style={styles.timelineHeader}>
                        <Text style={styles.timelineTitle}>{t('PROCHAINES ÉTAPES')}</Text>
                        <View style={styles.timelineLine} />
                    </View>

                    <View style={styles.timeline}>
                        {[
                            {
                                icon: 'mail-outline' as const,
                                title: t('Email de confirmation'),
                                desc: t('Vous recevrez votre facture par email sous peu.'),
                                status: 'current',
                            },
                            {
                                icon: 'cube-outline' as const,
                                title: t('Préparation du colis'),
                                desc: t('Notre équipe prépare et conditionne votre commande.'),
                                status: 'next',
                            },
                            {
                                icon: 'airplane-outline' as const,
                                title: t('Livraison'),
                                desc: t('Suivez votre colis depuis votre espace.'),
                                status: 'next',
                            },
                        ].map((step, i, arr) => (
                            <View key={i} style={styles.timelineItem}>
                                <View style={styles.timelineLeft}>
                                    <View style={[
                                        styles.timelineDot,
                                        step.status === 'current' && styles.timelineDotActive,
                                    ]}>
                                        <Ionicons
                                            name={step.icon}
                                            size={14}
                                            color={step.status === 'current' ? C.accent : C.textMuted}
                                        />
                                    </View>
                                    {i < arr.length - 1 && <View style={styles.timelineConnector} />}
                                </View>
                                <View style={styles.timelineContent}>
                                    <Text style={[
                                        styles.timelineItemTitle,
                                        step.status === 'current' && styles.timelineItemTitleActive,
                                    ]}>
                                        {step.title}
                                    </Text>
                                    <Text style={styles.timelineItemDesc}>{step.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ ACTIONS ═══ */}
                <AnimatedSection delay={700}>
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={goToOrder}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <Ionicons name="cube" size={18} color={C.accent} style={{ marginRight: 10 }} />
                            <Text style={styles.primaryBtnText}>{t('Suivre ma commande')}</Text>
                            <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 10 }} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={backToBoutique}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <Ionicons name="storefront-outline" size={18} color={C.primary} style={{ marginRight: 10 }} />
                            <Text style={styles.secondaryBtnText}>{t('Retour à la boutique')}</Text>
                        </TouchableOpacity>
                    </View>
                </AnimatedSection>

                {/* ═══ FOOTER SUPPORT ═══ */}
                <AnimatedSection delay={800}>
                    <View style={styles.footerInfo}>
                        <View style={styles.footerDivider}>
                            <View style={styles.dividerLine} />
                            <View style={styles.dividerDot} />
                            <View style={styles.dividerLine} />
                        </View>
                        <View style={styles.supportCard}>
                            <View style={styles.supportIcon}>
                                <Ionicons name="headset" size={16} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.supportTitle}>{t('Besoin d\'aide ?')}</Text>
                                <Text style={styles.supportText}>
                                    {t("Contactez notre équipe via la messagerie.")}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                        </View>
                    </View>
                </AnimatedSection>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0, 135, 81, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.25)',
    },
    navCounterText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.success,
        letterSpacing: 0.3,
    },

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },

    /* ── Hero Seal ── */
    heroWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
        position: 'relative',
        minHeight: 200,
    },
    sealContainer: {
        width: 130,
        height: 130,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    sealRing: {
        position: 'absolute',
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 2,
        borderColor: C.success,
    },
    sealGlow: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: C.success,
    },
    seal: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: C.success,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: C.accent,
        shadowColor: C.success,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 12,
    },
    sealBadge: {
        position: 'absolute',
        bottom: 0,
        right: 5,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: C.accent,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },

    /* ── Titre ── */
    successBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.success,
        letterSpacing: 1.8,
        textAlign: 'center',
        marginBottom: 8,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 14,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 21,
        fontWeight: '400',
        textAlign: 'center',
        paddingHorizontal: 8,
    },

    /* ── Ticket ── */
    ticket: {
        backgroundColor: C.surfaceSolid,
        borderRadius: 22,
        marginTop: 28,
        marginBottom: 24,
        borderWidth: 1.2,
        borderColor: C.border,
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    ticketHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 10,
    },
    ticketHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    ticketHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.3,
    },
    ticketStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0, 135, 81, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.25)',
    },
    ticketStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    ticketStatusText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.success,
        letterSpacing: 1,
    },
    ticketRefBlock: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 18,
    },
    ticketRefLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: C.textSec,
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    ticketRefValue: {
        fontSize: 30,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: 2,
    },

    /* ── Perforation ── */
    perforation: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 22,
    },
    perfNotchLeft: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: C.bg,
        marginLeft: -11,
    },
    perfNotchRight: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: C.bg,
        marginRight: -11,
    },
    perfLine: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    perfDot: {
        width: 5,
        height: 1.5,
        backgroundColor: C.border,
        borderRadius: 1,
    },

    /* ── Ticket Info ── */
    ticketInfo: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 18,
    },
    ticketRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    ticketRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    ticketRowIcon: {
        width: 28,
        height: 28,
        borderRadius: 9,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(252, 209, 22, 0.22)',
    },
    ticketRowLabel: {
        fontSize: 12.5,
        color: C.textSec,
        fontWeight: '500',
    },
    ticketRowValue: {
        fontSize: 13,
        color: C.primary,
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    ticketRowValueSmall: {
        fontSize: 12,
        color: C.primary,
        fontWeight: '700',
        letterSpacing: 0.2,
        maxWidth: 160,
    },
    ticketDivider: {
        height: 1,
        backgroundColor: 'rgba(226, 232, 240, 0.7)',
    },

    /* ── Timeline ── */
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
        paddingHorizontal: 4,
    },
    timelineTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    timelineLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    timeline: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    timelineItem: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
    },
    timelineLeft: {
        alignItems: 'center',
        width: 32,
    },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 11,
        backgroundColor: 'rgba(138, 138, 138, 0.06)',
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineDotActive: {
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        borderColor: 'rgba(252, 209, 22, 0.35)',
    },
    timelineConnector: {
        width: 2,
        height: 28,
        backgroundColor: C.border,
        marginVertical: 4,
    },
    timelineContent: {
        flex: 1,
        paddingTop: 4,
        paddingBottom: 16,
    },
    timelineItemTitle: {
        fontSize: 13.5,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: -0.1,
        marginBottom: 3,
    },
    timelineItemTitleActive: {
        color: C.primary,
        fontWeight: '800',
    },
    timelineItemDesc: {
        fontSize: 12,
        color: C.textMuted,
        lineHeight: 16,
        fontWeight: '400',
    },

    /* ── Actions ── */
    actions: {
        gap: 12,
        marginBottom: 24,
    },
    primaryBtn: {
        height: 60,
        backgroundColor: C.primary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(252, 209, 22, 0.35)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    primaryBtnText: {
        color: C.primaryText,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    secondaryBtn: {
        height: 56,
        backgroundColor: C.surfaceSolid,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    secondaryBtnText: {
        color: C.primary,
        fontSize: 14.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Footer ── */
    footerInfo: {
        alignItems: 'center',
        marginTop: 8,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    dividerLine: {
        width: 40,
        height: 1,
        backgroundColor: C.accent,
        opacity: 0.4,
    },
    dividerDot: {
        width: 6,
        height: 6,
        backgroundColor: C.accent,
        transform: [{ rotate: '45deg' }],
    },
    supportCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    supportIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(252, 209, 22, 0.25)',
    },
    supportTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    supportText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
    },
})