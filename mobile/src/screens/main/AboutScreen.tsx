'use strict'
import React, { useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, Linking, Image, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    Easing,
    interpolate,
} from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   AboutScreen : THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen / ServicesScreen / SignatureScreen / BoutiqueScreen)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (strictement identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'About'>

const APP_VERSION = '1.0.0'
const BUILD_NUMBER = '100'

const LINKS = [
    { label: 'Site officiel', icon: 'globe-outline' as const, url: 'https://www.retourgagnantbenin.bj' },
    { label: "Conditions d'utilisation", icon: 'document-text-outline' as const, url: 'https://www.retourgagnantbenin.bj/cgu' },
    { label: 'Politique de confidentialité', icon: 'shield-checkmark-outline' as const, url: 'https://www.retourgagnantbenin.bj/privacy' },
    { label: 'Nous contacter', icon: 'mail-outline' as const, url: 'mailto:contact@retourgagnantbenin.bj' },
]

const SOCIALS = [
    { icon: 'logo-linkedin' as const, label: 'LinkedIn', url: 'https://www.linkedin.com/company/retour-gagnant-benin' },
    { icon: 'logo-instagram' as const, label: 'Instagram', url: 'https://www.instagram.com/retourgagnantbenin' },
    { icon: 'logo-whatsapp' as const, label: 'WhatsApp', url: 'https://wa.me/2290194355050' },
]

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION (Stagger d'entrée)
═══════════════════════════════════════════════════════════ */

function AnimatedSection({
    children, delay = 0, style,
}: {
    children: React.ReactNode
    delay?: number
    style?: any
}) {
    const anim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, {
            duration: 800,
            easing: Easing.out(Easing.quad),
        }))
    }, [delay])

    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))

    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : LINK ITEM (avec press feedback)
═══════════════════════════════════════════════════════════ */

function LinkItem({
    icon, label, onPress, isLast,
}: {
    icon: string
    label: string
    onPress: () => void
    isLast: boolean
}) {
    const pressAnim = useSharedValue(0)

    const animStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolate(pressAnim.value, [0, 1], [0, 0.04]) > 0.02
            ? 'rgba(0, 135, 81, 0.04)'
            : 'transparent',
    }))

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { pressAnim.value = withSpring(1) }}
            onPressOut={() => { pressAnim.value = withSpring(0) }}
            accessibilityRole="button"
            hitSlop={6}
        >
            <Animated.View style={[styles.linkItem, !isLast && styles.linkItemBorder, animStyle]}>
                <View style={styles.linkIconWrap}>
                    <LucideIcon name={icon} size={18} color={C.primary} />
                </View>
                <Text style={styles.linkLabel}>{label}</Text>
                <LucideIcon name="open-outline" size={16} color={C.textMuted} />
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : ABOUT
═══════════════════════════════════════════════════════════ */

export default function AboutScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    // Pulse subtil sur le logo (effet "vivant")
    const logoPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

        // Halo doré qui respire autour du logo
        logoPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const logoHaloStyle = useAnimatedStyle(() => ({
        opacity: interpolate(logoPulse.value, [0, 1], [0.15, 0.45]),
        transform: [{ scale: interpolate(logoPulse.value, [0, 1], [1, 1.15]) }],
    }))

    const handleLink = (url: string) => {
        Linking.openURL(url).catch(() => { /* ignore */ })
    }

    return (
        <View style={styles.container}>

            {/* NAV BAR */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}>
                    <View style={styles.iconContainer}>
                        <LucideIcon name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.lg }]}
                bounces={true}
            >
                {/* ═══ EN-TÊTE MARQUE (style export) ═══ */}
                <Animated.View style={[styles.brandHeader, styleHeader]}>
                    <Image
                        source={require('../../../assets/images/logo-transparent.png')}
                        style={styles.brandLogo}
                        resizeMode="contain"
                    />
                    <Text style={styles.brandName}>{t('Retour Gagnant Bénin')}</Text>
                    <Text style={styles.brandTagline}>{t('Expertise & Racines')}</Text>
                </Animated.View>

                {/* ═══ NOTRE MISSION ═══ */}
                <AnimatedSection delay={150}>
                    <Text style={styles.blockLabelCenter}>{t('Notre Mission')}</Text>
                    <Text style={styles.missionText}>
                        {t("Faciliter le retour de la diaspora afro-descendante vers sa terre d'origine en alliant sécurité juridique et reconnexion spirituelle.")}
                    </Text>
                </AnimatedSection>

                {/* ═══ VALEURS ═══ */}
                <AnimatedSection delay={300}>
                    <View style={styles.valueCard}>
                        <View style={styles.valueIconBox}>
                            <LucideIcon name="shield-checkmark" size={22} color={C.primary} />
                        </View>
                        <Text style={styles.valueTitle}>{t('Sécurité Juridique')}</Text>
                        <Text style={styles.valueDesc}>
                            {t('Accompagnement par des avocats, notaires et experts fonciers assermentés.')}
                        </Text>
                    </View>
                    <View style={[styles.valueCard, { marginTop: 16 }]}>
                        <View style={styles.valueIconBox}>
                            <LucideIcon name="construct-outline" size={22} color={C.primary} />
                        </View>
                        <Text style={styles.valueTitle}>{t('Héritage Culturel')}</Text>
                        <Text style={styles.valueDesc}>
                            {t('Valorisation des traditions ancestrales et de la sagesse du Fa.')}
                        </Text>
                    </View>
                </AnimatedSection>

                {/* ═══ CONTACT (dernière section) ═══ */}
                <AnimatedSection delay={450}>
                    <View style={styles.contactWrap}>
                        <Text style={styles.blockLabelCenter}>{t('Contact')}</Text>
                        <Text style={styles.contactAddress}>{t('Cotonou, Bénin')}</Text>
                        <Text style={styles.contactEmail}>contact@retourgagnantbenin.bj</Text>
                        <View style={styles.socialsRow}>
                            {SOCIALS.map((s) => (
                                <TouchableOpacity
                                    key={s.label}
                                    onPress={() => handleLink(s.url)}
                                    style={styles.socialIconBtn}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={s.label}
                                    hitSlop={8}
                                >
                                    <Ionicons name={s.icon} size={26} color={C.primary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </AnimatedSection>
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
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: 40,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.sm,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
            },

    /* ── Brand Card ── */
    /* ── En-tête marque (style export) ── */
    brandHeader: {
        alignItems: 'center',
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
    },
    brandLogo: {
        width: 116,
        height: 116,
        marginBottom: spacing.md,
    },
    brandName: {
        ...typography.h2,
        fontFamily: fonts.extrabold,
        fontSize: 23,
        color: C.text,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    brandTagline: {
        ...typography.button,
        fontSize: 12,
        color: C.primary,
        textTransform: 'uppercase',
        letterSpacing: 3,
        marginTop: spacing.sm,
    },

    /* ── Libellé de section centré ── */
    blockLabelCenter: {
        ...typography.caption,
        fontSize: 10,
        color: C.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    missionText: {
        ...typography.h3,
        fontSize: 18,
        color: C.text,
        textAlign: 'center',
        lineHeight: 27,
        marginBottom: spacing.xl,
    },

    /* ── Cartes valeurs ── */
    valueCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xxl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    valueIconBox: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: C.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    valueTitle: {
        ...typography.button,
        fontSize: 16,
        color: C.text,
        marginBottom: spacing.xs,
    },
    valueDesc: {
        ...typography.bodySmall,
        fontSize: 12.5,
        color: C.textMuted,
        lineHeight: 19,
    },

    /* ── Contact (dernière section) ── */
    contactWrap: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    contactAddress: {
        ...typography.button,
        fontSize: 14,
        color: C.text,
        textAlign: 'center',
    },
    contactEmail: {
        ...typography.bodySmall,
        color: C.textMuted,
        marginTop: spacing.xs,
    },
    socialsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 28,
        marginTop: spacing.lg,
    },
    socialIconBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Stats Row ── */

    /* ── Card générique ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.gutter,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.gutter,
        ...shadows.card,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    cardHeaderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabel: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1.5,
    },
    cardTitle: {
        ...typography.h2,
                color: C.primary,
        letterSpacing: -0.4,
        marginBottom: spacing.md,
    },
    cardText: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
            },
    quoteBox: {
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: C.accentSoft,
        borderRadius: radius.sm,
        borderLeftWidth: 3,
        borderLeftColor: C.accent,
        position: 'relative',
    },
    quoteMark: {
        position: 'absolute',
        top: -2,
        left: 12,
        ...typography.h1, fontSize: 36,
        color: C.primary,
                opacity: 0.4,
    },
    quoteText: {
        ...typography.label,
        color: C.primary,
        fontStyle: 'italic',
        paddingLeft: spacing.lg,
        paddingTop: spacing.xs,
    },

    /* ── Section title ── */
    sectionTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    sectionLabel: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1.5,
    },
    sectionUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },

    /* ── Values Grid ── */
    valueIconWrap: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },

    /* ── Team Card ── */

    /* ── Links Card ── */
    linksCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.lg,
        ...shadows.card,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: 12,
    },
    linkItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    linkIconWrap: {
        width: 36,
        height: 36,
        borderRadius: radius.xs,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    linkLabel: {
        flex: 1,
        ...typography.bodySmall, fontSize: 13.5,
                color: C.primary,
        letterSpacing: -0.1,
    },

    /* ── Social Row ── */
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.lg,
        ...shadows.card,
    },
    socialBtn: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
    },
    socialIconWrap: {
        width: 48,
        height: 48,
        borderRadius: radius.md,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    socialLabel: {
        ...typography.caption,
        color: C.textSec,
                letterSpacing: 0.2,
    },

    /* ── Copyright ── */
    copyrightWrap: {
        alignItems: 'center',
        marginTop: 12,
    },
    copyrightDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
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
    copyright: {
        ...typography.button, fontSize: 13,
        color: C.primary,
                textAlign: 'center',
        letterSpacing: 0.2,
    },
    copyrightSub: {
        fontSize: 12,
        color: C.textMuted,
        textAlign: 'center',
        marginTop: spacing.xs,
        fontStyle: 'italic',
        letterSpacing: 0.2,
    },
})