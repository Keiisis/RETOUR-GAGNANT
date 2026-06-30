'use strict'
import React, { useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, Linking, Image, Pressable, Dimensions,
} from 'react-native'
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
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'

/* ═══════════════════════════════════════════════════════════
   AboutScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen / ServicesScreen / SignatureScreen / BoutiqueScreen)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (strictement identique aux autres écrans)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',      // Bleu Profond (Agence)
    primaryDark: '#022C22',
    accent: '#C9A84C',       // Or (Agence)
    accentDark: '#A68B3C',
    accentLight: '#E2C97E',
    auraGreen: '#10B981',    // Vert (Agence)
    error: '#EF4444',        // Rouge (Agence)
    success: '#10B981',

    textSec: '#64748B',
    textMuted: '#94A3B8',
    primaryText: '#FFFFFF',
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'About'>

const APP_VERSION = '1.0.0'
const BUILD_NUMBER = '100'

const LINKS = [
    { label: 'Site officiel', icon: 'globe-outline' as const, url: 'https://www.retourgagnantbenin.bj' },
    { label: "Conditions d'utilisation", icon: 'document-text-outline' as const, url: 'https://www.retourgagnantbenin.bj/cgu' },
    { label: 'Politique de confidentialité', icon: 'shield-checkmark-outline' as const, url: 'https://www.retourgagnantbenin.bj/privacy' },
    { label: 'Nous contacter', icon: 'mail-outline' as const, url: 'mailto:contact@retourgagnantbenin.bj' },
]

const VALUES = [
    { title: 'Excellence', desc: 'Un service irréprochable à chaque étape.', icon: 'diamond-outline' as const },
    { title: 'Engagement', desc: 'Votre réussite est notre mission première.', icon: 'heart-outline' as const },
    { title: 'Proximité', desc: 'Présents au Bénin et dans la diaspora.', icon: 'earth-outline' as const },
    { title: 'Confiance', desc: '500+ familles nous ont fait confiance.', icon: 'people-outline' as const },
]

const TEAM = [
    { name: 'Équipe Juridique', role: 'Passeports & Documents', icon: 'briefcase-outline' as const },
    { name: 'Équipe Immobilier', role: 'Logement & Construction', icon: 'home-outline' as const },
    { name: 'Équipe Business', role: 'Investissement & Entreprise', icon: 'trending-up-outline' as const },
    { name: 'Équipe Culture', role: 'Guide & Accompagnement', icon: 'map-outline' as const },
]

const SOCIALS = [
    { icon: 'logo-facebook' as const, label: 'Facebook', url: 'https://facebook.com' },
    { icon: 'logo-instagram' as const, label: 'Instagram', url: 'https://instagram.com' },
    { icon: 'logo-youtube' as const, label: 'YouTube', url: 'https://youtube.com' },
    { icon: 'logo-whatsapp' as const, label: 'WhatsApp', url: 'https://wa.me/' },
]

const STATS = [
    { value: '500+', label: 'Familles accompagnées' },
    { value: '9', label: 'Services premium' },
    { value: '24/7', label: 'Support diaspora' },
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
    icon: keyof typeof Ionicons.glyphMap
    label: string
    onPress: () => void
    isLast: boolean
}) {
    const pressAnim = useSharedValue(0)

    const animStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolate(pressAnim.value, [0, 1], [0, 0.04]) > 0.02
            ? 'rgba(13, 43, 78, 0.04)'
            : 'transparent',
    }))

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { pressAnim.value = withSpring(1) }}
            onPressOut={() => { pressAnim.value = withSpring(0) }}
        >
            <Animated.View style={[styles.linkItem, !isLast && styles.linkItemBorder, animStyle]}>
                <View style={styles.linkIconWrap}>
                    <Ionicons name={icon} size={18} color={C.primary} />
                </View>
                <Text style={styles.linkLabel}>{label}</Text>
                <Ionicons name="open-outline" size={16} color={C.textMuted} />
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : ABOUT
═══════════════════════════════════════════════════════════ */

export default function AboutScreen({ navigation }: { navigation: Nav }) {
    const { t } = useLang()

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    // Pulse subtil sur le logo (effet "vivant")
    const logoPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

        aura1Y.value = withRepeat(
            withSequence(
                withTiming(25, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
                withTiming(-10, { duration: 6000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
        aura2X.value = withRepeat(
            withSequence(
                withTiming(-30, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
                withTiming(15, { duration: 7000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )

        // Halo doré qui respire autour du logo
        logoPulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
            ), -1, false
        )
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

    const logoHaloStyle = useAnimatedStyle(() => ({
        opacity: interpolate(logoPulse.value, [0, 1], [0.15, 0.45]),
        transform: [{ scale: interpolate(logoPulse.value, [0, 1], [1, 1.15]) }],
    }))

    const handleLink = (url: string) => {
        Linking.openURL(url).catch(() => { /* ignore */ })
    }

    return (
        <View style={styles.container}>
            {/* 🎨 BACKGROUND PREMIUM : Auras diffuses */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
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
                    <Text style={styles.titleHighlight}>{t("de l'agence.")}</Text>
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

                {/* ═══ STATS ROW ═══ */}
                <AnimatedSection delay={250}>
                    <View style={styles.statsRow}>
                        {STATS.map((s, i) => (
                            <React.Fragment key={i}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{s.value}</Text>
                                    <Text style={styles.statLabel}>{t(s.label)}</Text>
                                </View>
                                {i < STATS.length - 1 && <View style={styles.statDivider} />}
                            </React.Fragment>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ NOTRE HISTOIRE ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="book-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardLabel}>{t('NOTRE HISTOIRE')}</Text>
                        </View>

                        <Text style={styles.cardTitle}>
                            {t('Née de la diaspora,')}
                            {'\n'}
                            <Text style={{ color: C.accent }}>{t('pour la diaspora.')}</Text>
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

                {/* ═══ NOS VALEURS ═══ */}
                <AnimatedSection delay={450}>
                    <View style={styles.sectionTitleWrap}>
                        <Text style={styles.sectionLabel}>{t('NOS VALEURS')}</Text>
                        <View style={styles.sectionUnderline} />
                    </View>

                    <View style={styles.valuesGrid}>
                        {VALUES.map((v, i) => (
                            <View key={i} style={styles.valueCard}>
                                <View style={styles.valueIconWrap}>
                                    <Ionicons name={v.icon} size={22} color={C.accent} />
                                </View>
                                <Text style={styles.valueTitle}>{t(v.title)}</Text>
                                <Text style={styles.valueDesc}>{t(v.desc)}</Text>
                            </View>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ ÉQUIPE ═══ */}
                <AnimatedSection delay={550}>
                    <View style={styles.sectionTitleWrap}>
                        <Text style={styles.sectionLabel}>{t('NOTRE ÉQUIPE')}</Text>
                        <View style={styles.sectionUnderline} />
                    </View>

                    <View style={styles.teamCard}>
                        {TEAM.map((m, i) => (
                            <View
                                key={i}
                                style={[styles.teamItem, i < TEAM.length - 1 && styles.teamItemBorder]}
                            >
                                <View style={styles.teamIcon}>
                                    <Ionicons name={m.icon} size={18} color={C.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.teamName}>{t(m.name)}</Text>
                                    <Text style={styles.teamRole}>{t(m.role)}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                            </View>
                        ))}
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
                            >
                                <View style={styles.socialIconWrap}>
                                    <Ionicons name={s.icon} size={22} color={C.primary} />
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

                <View style={{ height: 60 }} />
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

    /* ── Auras Corporate ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05,
    },
    aura1: {
        top: -100,
        right: -100,
        backgroundColor: C.primary,
    },
    aura2: {
        bottom: 50,
        left: -100,
        backgroundColor: C.auraGreen,
    },

    /* ── Nav Bar ── */
    navBar: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 10,
        zIndex: 10,
    },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 38,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.5,
    },
    titleHighlight: {
        fontSize: 38,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.5,
        marginTop: -4,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Brand Card ── */
    brandCard: {
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden',
    },
    logoHalo: {
        position: 'absolute',
        top: 0,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: C.accent,
    },
    logoWrap: {
        width: 88,
        height: 88,
        borderRadius: 22,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.4)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    logo: {
        width: 60,
        height: 60,
    },
    brandName: {
        color: C.primary,
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: 5,
    },
    brandSubWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 6,
    },
    brandLine: {
        width: 30,
        height: 1.5,
        backgroundColor: C.accent,
    },
    brandSub: {
        color: C.accent,
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: 8,
    },
    tagline: {
        color: C.textSec,
        fontSize: 12,
        fontStyle: 'italic',
        letterSpacing: 0.3,
        marginTop: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    versionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.1)',
    },
    versionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    versionText: {
        fontSize: 11,
        color: C.textSec,
        fontWeight: '600',
        letterSpacing: 0.2,
    },

    /* ── Stats Row ── */
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 12,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 10.5,
        color: C.textSec,
        fontWeight: '500',
        marginTop: 4,
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    statDivider: {
        width: 1,
        height: 36,
        backgroundColor: C.border,
    },

    /* ── Card générique ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 20,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    cardHeaderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.4,
        lineHeight: 28,
        marginBottom: 14,
    },
    cardText: {
        fontSize: 13.5,
        color: C.textSec,
        lineHeight: 21,
        fontWeight: '400',
    },
    quoteBox: {
        marginTop: 18,
        padding: 16,
        backgroundColor: 'rgba(212, 160, 23, 0.06)',
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: C.accent,
        position: 'relative',
    },
    quoteMark: {
        position: 'absolute',
        top: -2,
        left: 12,
        fontSize: 36,
        color: C.accent,
        fontWeight: '800',
        opacity: 0.4,
    },
    quoteText: {
        fontSize: 13,
        color: C.primary,
        fontStyle: 'italic',
        fontWeight: '500',
        lineHeight: 19,
        paddingLeft: 24,
        paddingTop: 4,
    },

    /* ── Section title ── */
    sectionTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    sectionUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },

    /* ── Values Grid ── */
    valuesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    valueCard: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        gap: 6,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    valueIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.20)',
    },
    valueTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        textAlign: 'center',
        letterSpacing: -0.1,
    },
    valueDesc: {
        fontSize: 11,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 15,
        fontWeight: '400',
    },

    /* ── Team Card ── */
    teamCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    teamItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    teamItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    teamIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.08)',
    },
    teamName: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.1,
    },
    teamRole: {
        fontSize: 11.5,
        color: C.textSec,
        marginTop: 2,
        fontWeight: '500',
    },

    /* ── Links Card ── */
    linksCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    linkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 12,
    },
    linkItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    linkIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.08)',
    },
    linkLabel: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '600',
        color: C.primary,
        letterSpacing: -0.1,
    },

    /* ── Social Row ── */
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    socialBtn: {
        flex: 1,
        alignItems: 'center',
        gap: 8,
    },
    socialIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.10)',
    },
    socialLabel: {
        fontSize: 11,
        color: C.textSec,
        fontWeight: '600',
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
    copyright: {
        fontSize: 13,
        color: C.primary,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    copyrightSub: {
        fontSize: 11,
        color: C.textMuted,
        textAlign: 'center',
        marginTop: 6,
        fontStyle: 'italic',
        letterSpacing: 0.2,
    },
})