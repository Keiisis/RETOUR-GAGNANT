'use strict'
import React, { useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, Linking, Image, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
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
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   AboutScreen — THEME "CORPORATE PREMIUM 2026"
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
    { icon: 'logo-facebook' as const, label: 'Facebook', url: 'https://facebook.com' },
    { icon: 'logo-instagram' as const, label: 'Instagram', url: 'https://instagram.com' },
    { icon: 'logo-youtube' as const, label: 'YouTube', url: 'https://youtube.com' },
    { icon: 'logo-whatsapp' as const, label: 'WhatsApp', url: 'https://wa.me/' },
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
                contentContainerStyle={styles.scroll}
                bounces={true}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('À propos')}</Text>
                    <Text style={styles.subtitle}>
                        {t("L'histoire, les valeurs et l'équipe derrière votre retour gagnant.")}
                    </Text>
                </Animated.View>

                {/* ═══ BRAND CARD : Logo + Nom + Version ═══ */}
                <AnimatedSection delay={150}>
                    <View style={styles.brandCard}>
                        {/* Halo doré animé */}
                        <Animated.View style={[styles.logoHalo, logoHaloStyle]} />

                        <View style={styles.logoWrap}>
                            <Image
                                source={require('../../../assets/icon.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <Text style={styles.brandName}>RETOUR GAGNANT</Text>
                        <View style={styles.brandSubWrap}>
                            <View style={styles.brandLine} />
                            <Text style={styles.brandSub}>BÉNIN</Text>
                            <View style={styles.brandLine} />
                        </View>

                        <Text style={styles.tagline}>
                            {t("L'Agence du Retour des Afro-descendants")}
                        </Text>

                        <View style={styles.versionBadge}>
                            <View style={styles.versionDot} />
                            <Text style={styles.versionText}>
                                {t('Version')} {APP_VERSION} · {t('Build')} {BUILD_NUMBER}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ NOTRE HISTOIRE ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="book-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardLabel}>{t('NOTRE HISTOIRE')}</Text>
                        </View>

                        <Text style={styles.cardTitle}>
                            {t('Née de la diaspora,')}
                            {'\n'}
                            <Text style={{ color: C.primary }}>{t('pour la diaspora.')}</Text>
                        </Text>

                        <Text style={styles.cardText}>
                            {t("Fondée par des membres de la diaspora béninoise ayant eux-mêmes vécu l'expérience du retour, Retour Gagnant est née d'un constat simple : rentrer au pays ne devrait pas être un parcours du combattant.")}
                        </Text>
                        <Text style={[styles.cardText, { marginTop: 12 }]}>
                            {t("Aujourd'hui, nous avons accompagné plus de 500 projets de retour réussis. Des passeports aux investissements immobiliers, en passant par la création d'entreprise, nous sommes le partenaire de confiance de la diaspora.")}
                        </Text>

                        {/* Citation décorative */}
                        <View style={styles.quoteBox}>
                            <Text style={styles.quoteMark}>"</Text>
                            <Text style={styles.quoteText}>
                                {t("Le retour ne s'improvise pas. Il se prépare avec rigueur.")}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ LIENS LÉGAUX ═══ */}
                <AnimatedSection delay={650}>
                    <View style={styles.sectionTitleWrap}>
                        <Text style={styles.sectionLabel}>{t('INFORMATIONS LÉGALES')}</Text>
                        <View style={styles.sectionUnderline} />
                    </View>

                    <View style={styles.linksCard}>
                        {LINKS.map((link, i) => (
                            <LinkItem
                                key={i}
                                icon={link.icon}
                                label={t(link.label)}
                                onPress={() => handleLink(link.url)}
                                isLast={i === LINKS.length - 1}
                            />
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ RÉSEAUX SOCIAUX ═══ */}
                <AnimatedSection delay={750}>
                    <View style={styles.sectionTitleWrap}>
                        <Text style={styles.sectionLabel}>{t('SUIVEZ-NOUS')}</Text>
                        <View style={styles.sectionUnderline} />
                    </View>

                    <View style={styles.socialRow}>
                        {SOCIALS.map((s) => (
                            <TouchableOpacity
                                key={s.label}
                                style={styles.socialBtn}
                                activeOpacity={0.7}
                                onPress={() => handleLink(s.url)}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <View style={styles.socialIconWrap}>
                                    <LucideIcon name={s.icon} size={22} color={C.primary} />
                                </View>
                                <Text style={styles.socialLabel}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ COPYRIGHT ═══ */}
                <AnimatedSection delay={850}>
                    <View style={styles.copyrightWrap}>
                        <View style={styles.copyrightDivider}>
                            <View style={styles.dividerLine} />
                            <View style={styles.dividerDot} />
                            <View style={styles.dividerLine} />
                        </View>
                        <Text style={styles.copyright}>
                            © {new Date().getFullYear()} Retour Gagnant Bénin
                        </Text>
                        <Text style={styles.copyrightSub}>
                            {t('Tous droits réservés · Fait avec excellence à Cotonou')}
                        </Text>
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
    brandCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
        marginBottom: spacing.gutter,
        position: 'relative',
        overflow: 'hidden',
    },
    logoHalo: { display: 'none' },
    logoWrap: {
        width: 88,
        height: 88,
        borderRadius: radius.xl,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    logo: {
        width: 60,
        height: 60,
    },
    brandName: {
        color: C.primary,
        ...typography.h2, fontSize: 20,
                letterSpacing: 5,
    },
    brandSubWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    brandLine: {
        width: 30,
        height: 1.5,
        backgroundColor: C.accent,
    },
    brandSub: {
        color: C.primary,
        ...typography.button, fontSize: 14,
                letterSpacing: 8,
    },
    tagline: {
        color: C.textSec,
        fontSize: 12,
        fontStyle: 'italic',
        letterSpacing: 0.3,
        marginTop: spacing.md,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    versionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    versionText: {
        ...typography.caption,
        color: C.textSec,
                letterSpacing: 0.2,
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