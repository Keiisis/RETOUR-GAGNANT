'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, Dimensions,
    Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { ttcFromHt } from '../../lib/tax'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   EventsScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppEvent {
    id: string
    title: string
    short_description?: string
    description?: string
    start_date: string
    end_date?: string
    location: string
    address?: string
    price_standard: number
    price_vip?: number
    currency: string
    max_capacity?: number
    is_featured: boolean
    cover_image?: string
    status: string
    category?: string
    my_registration?: { id: string; status: string; ticket_type: string } | null
}

const CATEGORIES = ['Tous', 'Gala', 'Forum', 'Tourisme', 'Séminaire', 'Conférence']

const CATEGORY_ICONS: Record<string, string> = {
    'Tous': 'apps-outline',
    'Gala': 'sparkles-outline',
    'Forum': 'people-outline',
    'Tourisme': 'map-outline',
    'Séminaire': 'school-outline',
    'Conférence': 'mic-outline',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// TVA « en sus » : le prix billet est HORS TAXE en base ; on affiche le TTC
// (HT × 1,18), identique au montant réellement payé. Gratuit (0) reste gratuit.
function formatPrice(price: number, currency: string, t: any) {
    if (price === 0) return t('Gratuit')
    return `${ttcFromHt(price).toLocaleString('fr-FR')} ${currency}`
}

function getDaysUntil(iso: string): number {
    const event = new Date(iso)
    const now = new Date()
    const diffMs = event.getTime() - now.getTime()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION
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
   COMPOSANT : FEATURED EVENT CARD (Hero premium)
═══════════════════════════════════════════════════════════ */

function FeaturedEventCard({
    event, onPress, t,
}: {
    event: AppEvent
    onPress: () => void
    t: any
}) {
    const pressAnim = useSharedValue(0)
    const glowAnim = useSharedValue(0)

    useEffect(() => {
        // Halo doré qui respire en arrière-plan
        glowAnim.value = withTiming(1, { duration: 600 })
    }, [])

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) }],
    }))

    const glowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(glowAnim.value, [0, 1], [0.15, 0.35]),
        transform: [{ scale: interpolate(glowAnim.value, [0, 1], [1, 1.1]) }],
    }))

    const daysUntil = getDaysUntil(event.start_date)
    const isRegistered = !!event.my_registration

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { pressAnim.value = withSpring(1) }}
            onPressOut={() => { pressAnim.value = withSpring(0) }}
            accessibilityRole="button"
            hitSlop={6}
        >
            <Animated.View style={[featuredStyles.card, cardStyle]}>
                {/* Halo doré pulsant en arrière-plan */}
                <Animated.View style={[featuredStyles.glow, glowStyle]} />

                {/* Pattern décoratif */}
                <View style={featuredStyles.patternDot1} />
                <View style={featuredStyles.patternDot2} />
                <View style={featuredStyles.patternLine} />

                {/* Top row : badges */}
                <View style={featuredStyles.topRow}>
                    <View style={featuredStyles.starBadge}>
                        <LucideIcon name="star" size={11} color={C.primary} />
                        <Text style={featuredStyles.starText}>{t('ÉVÉNEMENT PHARE')}</Text>
                    </View>

                    {isRegistered && (
                        <View style={featuredStyles.registeredBadge}>
                            <LucideIcon name="checkmark-circle" size={12} color={C.success} />
                            <Text style={featuredStyles.registeredText}>{t('Inscrit')}</Text>
                        </View>
                    )}
                </View>

                {/* Date card massive */}
                <View style={featuredStyles.dateRow}>
                    <View style={featuredStyles.dateBlock}>
                        <Text style={featuredStyles.dateDay}>
                            {new Date(event.start_date).getDate()}
                        </Text>
                        <View style={featuredStyles.dateDivider} />
                        <Text style={featuredStyles.dateMonth}>
                            {new Date(event.start_date).toLocaleDateString('fr-FR', { month: 'short' })
                                .toUpperCase().replace('.', '')}
                        </Text>
                    </View>

                    {daysUntil > 0 && daysUntil <= 30 && (
                        <View style={featuredStyles.countdownBadge}>
                            <LucideIcon name="time-outline" size={11} color={C.accent} />
                            <Text style={featuredStyles.countdownText}>
                                {daysUntil === 1
                                    ? t('Demain')
                                    : `${t('Dans')} ${daysUntil} ${t('jours')}`}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Titre + infos */}
                <Text style={featuredStyles.title} numberOfLines={2}>
                    {event.title}
                </Text>

                {event.short_description && (
                    <Text style={featuredStyles.desc} numberOfLines={2}>
                        {event.short_description}
                    </Text>
                )}

                <View style={featuredStyles.metaRow}>
                    <LucideIcon name="location-outline" size={13} color={C.accent} />
                    <Text style={featuredStyles.metaText} numberOfLines={1}>
                        {event.address || event.location}
                    </Text>
                </View>

                {/* Footer */}
                <View style={featuredStyles.footer}>
                    <View>
                        <Text style={featuredStyles.priceLabel}>
                            {event.price_standard === 0 ? t('Inscription') : t('À partir de')}
                        </Text>
                        <Text style={featuredStyles.priceValue}>
                            {event.price_standard === 0
                                ? t('Gratuite')
                                : `${ttcFromHt(event.price_standard).toLocaleString('fr-FR')} ${event.currency}`}
                        </Text>
                    </View>

                    <View style={featuredStyles.cta}>
                        <Text style={featuredStyles.ctaText}>{t("S'inscrire")}</Text>
                        <LucideIcon name="arrow-forward" size={14} color={C.accent} />
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    )
}

const featuredStyles = StyleSheet.create({
    card: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.cardRaised,
    },
    glow: { display: 'none' },
    patternDot1: {
        position: 'absolute',
        top: 80,
        right: 30,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.accent,
        opacity: 0.3,
    },
    patternDot2: {
        position: 'absolute',
        bottom: 90,
        right: 60,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: C.accent,
        opacity: 0.5,
    },
    patternLine: {
        position: 'absolute',
        bottom: 70,
        right: -10,
        width: 60,
        height: 1,
        backgroundColor: C.accent,
        opacity: 0.2,
        transform: [{ rotate: '-15deg' }],
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    starBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accent,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
    },
    starText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1,
    },
    registeredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    registeredText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 0.3,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.md,
    },
    dateBlock: {
        backgroundColor: C.surfaceAlt,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    dateDay: {
        ...typography.h1, fontSize: 32,
                color: C.textPrimary,
        letterSpacing: -1,
    },
    dateDivider: {
        width: 30,
        height: 1,
        backgroundColor: C.accent,
        marginVertical: spacing.xs,
        opacity: 0.5,
    },
    dateMonth: {
        ...typography.button, fontSize: 12,
                color: C.accent,
        letterSpacing: 2,
    },
    countdownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    countdownText: {
        ...typography.button, fontSize: 12,
                color: C.accent,
        letterSpacing: 0.3,
    },
    title: { ...typography.h1, color: C.text },
    desc: {
        ...typography.label,
        color: C.textMuted,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    metaText: {
        ...typography.caption,
        color: C.textMuted,
                flex: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    priceLabel: {
        ...typography.overline,
        color: C.textMuted,
    },
    priceValue: {
        ...typography.h3,
                color: C.accent,
        marginTop: spacing.xxs,
        letterSpacing: -0.2,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.accentSoft,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: C.border,
    },
    ctaText: {
        color: C.accent,
        ...typography.button, fontSize: 13,
                letterSpacing: 0.2,
    },
})

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : EVENT CARD (Liste)
═══════════════════════════════════════════════════════════ */

function EventCard({
    event, onPress, t, index,
}: {
    event: AppEvent
    onPress: () => void
    t: any
    index: number
}) {
    const enterAnim = useSharedValue(0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        enterAnim.value = withDelay(
            index * 80,
            withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
        )
    }, [index])

    const cardStyle = useAnimatedStyle(() => ({
        opacity: enterAnim.value,
        transform: [
            { translateY: 30 * (1 - enterAnim.value) },
            { scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) },
        ],
    }))

    const isFree = event.price_standard === 0
    const isRegistered = !!event.my_registration
    const daysUntil = getDaysUntil(event.start_date)

    return (
        <Animated.View style={cardStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <View style={cardStyles.card}>
                    {/* Colonne date à gauche */}
                    <View style={cardStyles.dateCol}>
                        <Text style={cardStyles.dateDay}>
                            {new Date(event.start_date).getDate()}
                        </Text>
                        <Text style={cardStyles.dateMonth}>
                            {new Date(event.start_date)
                                .toLocaleDateString('fr-FR', { month: 'short' })
                                .toUpperCase().replace('.', '')}
                        </Text>
                        <View style={cardStyles.dateLine} />
                        <Text style={cardStyles.dateTime}>{formatTime(event.start_date)}</Text>
                    </View>

                    {/* Contenu */}
                    <View style={cardStyles.content}>
                        {/* Badges top */}
                        <View style={cardStyles.badgesRow}>
                            {event.category && (
                                <View style={cardStyles.catBadge}>
                                    <View style={cardStyles.catDot} />
                                    <Text style={cardStyles.catText}>
                                        {t(event.category).toUpperCase()}
                                    </Text>
                                </View>
                            )}

                            {event.is_featured && (
                                <View style={cardStyles.featuredBadge}>
                                    <LucideIcon name="star" size={9} color={C.accent} />
                                </View>
                            )}

                            {isRegistered && (
                                <View style={cardStyles.miniRegistered}>
                                    <LucideIcon name="checkmark-circle" size={11} color={C.success} />
                                </View>
                            )}
                        </View>

                        {/* Titre */}
                        <Text style={cardStyles.title} numberOfLines={2}>
                            {event.title}
                        </Text>

                        {/* Description */}
                        {(event.short_description || event.description) && (
                            <Text style={cardStyles.desc} numberOfLines={1}>
                                {event.short_description || event.description}
                            </Text>
                        )}

                        {/* Lieu */}
                        <View style={cardStyles.metaRow}>
                            <LucideIcon name="location-outline" size={11} color={C.textMuted} />
                            <Text style={cardStyles.metaText} numberOfLines={1}>
                                {event.location}
                            </Text>

                            {daysUntil > 0 && daysUntil <= 7 && (
                                <View style={cardStyles.soonBadge}>
                                    <View style={cardStyles.soonDot} />
                                    <Text style={cardStyles.soonText}>
                                        {daysUntil === 1 ? t('Demain') : `J-${daysUntil}`}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Footer prix */}
                        <View style={cardStyles.footer}>
                            <View style={[
                                cardStyles.priceBadge,
                                isFree && cardStyles.priceBadgeFree,
                            ]}>
                                <Text style={[
                                    cardStyles.priceText,
                                    isFree && cardStyles.priceTextFree,
                                ]}>
                                    {formatPrice(event.price_standard, event.currency, t)}
                                </Text>
                            </View>

                            <View style={cardStyles.viewBtn}>
                                <Text style={cardStyles.viewBtnText}>{t('Détails')}</Text>
                                <LucideIcon name="arrow-forward" size={11} color={C.accent} />
                            </View>
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    )
}

const cardStyles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 12,
        ...shadows.card,
        overflow: 'hidden',
    },
    dateCol: {
        width: 64,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: C.border,
        marginRight: spacing.md,
    },
    dateDay: {
        ...typography.h2,
                color: C.primary,
        letterSpacing: -0.5,
    },
    dateMonth: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1.2,
        marginTop: spacing.xxs,
    },
    dateLine: {
        width: 24,
        height: 1,
        backgroundColor: C.border,
        marginVertical: spacing.xs,
    },
    dateTime: {
        ...typography.caption,
                color: C.textSec,
        letterSpacing: 0.3,
    },
    content: {
        flex: 1,
        gap: spacing.xs,
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xxs,
    },
    catBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderWidth: 1,
        borderColor: C.border,
    },
    catDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: C.accent,
    },
    catText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.5,
    },
    featuredBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    miniRegistered: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    title: {
        ...typography.button, fontSize: 14.5,
                color: C.primary,
        letterSpacing: -0.2,
        marginTop: spacing.xs,
    },
    desc: {
        ...typography.caption,
        color: C.textSec,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xs,
    },
    metaText: {
        flex: 1,
        ...typography.caption,
        color: C.textMuted,
            },
    soonBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    soonDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.accent,
    },
    soonText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.3,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
    },
    priceBadge: {
        backgroundColor: C.surfaceSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    priceBadgeFree: {
        backgroundColor: C.surfaceSoft,
        borderColor: C.border,
    },
    priceText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: -0.2,
    },
    priceTextFree: {
        color: C.success,
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.primary,
        paddingHorizontal: 12,
        paddingVertical: spacing.sm,
        borderRadius: radius.xs,
    },
    viewBtnText: {
        ...typography.button, fontSize: 12,
                color: C.primaryText,
        letterSpacing: 0.2,
    },
})

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : EVENTS
═══════════════════════════════════════════════════════════ */

export default function EventsScreen({ navigation }: any) {
    const { profile } = useAuth()
    const insets = useSafeAreaInsets()
    const [events, setEvents] = useState<AppEvent[]>([])
    const { t } = useLang()
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [category, setCategory] = useState('Tous')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const fetchEvents = useCallback(async () => {
        try {
            const clientParam = profile?.id ? `&client_id=${profile.id}` : ''
            const text = await fetchWithTimeout(`${API_BASE}/api/mobile/events?${clientParam}`, { timeoutMs: 10000 }).then(r => r.text())
            let json: { events?: AppEvent[] } = {}
            try { json = JSON.parse(text) } catch { /* ignore */ }
            setEvents(json.events || [])
        } catch (err) {
            console.warn('[Events] fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [profile?.id])

    useEffect(() => { fetchEvents() }, [fetchEvents])
    const onRefresh = async () => { setRefreshing(true); await fetchEvents(); setRefreshing(false) }

    const filtered = category === 'Tous'
        ? events
        : events.filter(e => e.category === category)

    const featured = events.filter(e => e.is_featured)[0]
    const otherEvents = featured
        ? filtered.filter(e => e.id !== featured.id)
        : filtered

    // Comptage par catégorie
    const getCount = (cat: string) =>
        cat === 'Tous' ? events.length : events.filter(e => e.category === cat).length

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

                {/* Compteur d'événements */}
                {!loading && events.length > 0 && (
                    <View style={styles.navCounter}>
                        <View style={styles.navCounterDot} />
                        <Text style={styles.navCounterText}>
                            {events.length} {events.length > 1 ? t('événements') : t('événement')}
                        </Text>
                    </View>
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.primary}
                    />
                }
                contentContainerStyle={styles.scroll}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Événements')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Galas, forums, circuits culturels et séminaires de la diaspora.')}
                    </Text>
                </Animated.View>

                {/* LOADING SKELETON */}
                {loading ? (
                    <View style={styles.skeletonWrap}>
                        {[0, 1, 2].map(i => (
                            <View key={i} style={styles.skeletonCard}>
                                <View style={styles.skeletonDate} />
                                <View style={styles.skeletonContent}>
                                    <View style={[styles.skeletonLine, { width: '70%', height: 14 }]} />
                                    <View style={[styles.skeletonLine, { width: '50%', height: 10, marginTop: 8 }]} />
                                    <View style={[styles.skeletonLine, { width: '30%', height: 10, marginTop: 4 }]} />
                                </View>
                            </View>
                        ))}
                    </View>
                ) : events.length === 0 ? (
                    /* ── État vide global ── */
                    <AnimatedSection delay={150}>
                        <View style={styles.emptyGlobalCard}>
                            <View style={styles.emptyGlobalIcon}>
                                <LucideIcon name="calendar-outline" size={42} color={C.accent} />
                            </View>
                            <Text style={styles.emptyGlobalTitle}>
                                {t('Aucun événement pour le moment')}
                            </Text>
                            <Text style={styles.emptyGlobalDesc}>
                                {t('Les prochains galas, forums et circuits culturels seront affichés ici dès leur publication.')}
                            </Text>

                            <View style={styles.emptyDecorator}>
                                <View style={styles.emptyDot} />
                                <View style={styles.emptyLine} />
                                <View style={[styles.emptyDot, { backgroundColor: C.accent }]} />
                                <View style={styles.emptyLine} />
                                <View style={styles.emptyDot} />
                            </View>

                            <Text style={styles.emptyHint}>
                                {t('Restez connecté · Tirez pour rafraîchir')}
                            </Text>
                        </View>
                    </AnimatedSection>
                ) : (
                    <>
                        {/* ═══ ÉVÉNEMENT À LA UNE ═══ */}
                        {featured && (
                            <AnimatedSection delay={150}>
                                <FeaturedEventCard
                                    event={featured}
                                    onPress={() => navigation.navigate('EventDetail', { event: featured })}
                                    t={t}
                                />
                            </AnimatedSection>
                        )}

                        {/* ═══ FILTRES CATÉGORIE ═══ */}
                        <AnimatedSection delay={250}>
                            <View style={styles.filterTitleWrap}>
                                <Text style={styles.filterTitle}>{t('FILTRER PAR')}</Text>
                                <View style={styles.filterUnderline} />
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.filtersContent}
                            >
                                {CATEGORIES.map(cat => {
                                    const active = category === cat
                                    const count = getCount(cat)
                                    return (
                                        <CategoryPill
                                            key={cat}
                                            label={t(cat)}
                                            icon={CATEGORY_ICONS[cat] || 'apps-outline'}
                                            count={count}
                                            active={active}
                                            onPress={() => setCategory(cat)}
                                        />
                                    )
                                })}
                            </ScrollView>
                        </AnimatedSection>

                        {/* ═══ LISTE ═══ */}
                        <AnimatedSection delay={350}>
                            {category !== 'Tous' && (
                                <View style={styles.listHeader}>
                                    <Text style={styles.listHeaderText}>
                                        {t(category)} · {otherEvents.length} {otherEvents.length > 1 ? t('événements') : t('événement')}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.listWrap}>
                                {otherEvents.length === 0 ? (
                                    <View style={styles.emptyCatWrap}>
                                        <View style={styles.emptyCatIcon}>
                                            <LucideIcon name="search-outline" size={28} color={C.textMuted} />
                                        </View>
                                        <Text style={styles.emptyCatTitle}>
                                            {t('Aucun événement')}
                                        </Text>
                                        <Text style={styles.emptyCatText}>
                                            {t('Pas d\'événement dans cette catégorie pour le moment.')}
                                        </Text>
                                        <Pressable
                                            onPress={() => setCategory('Tous')}
                                            style={styles.emptyCatBtn}
                                            accessibilityRole="button"
                                            hitSlop={6}
                                        >
                                            <Text style={styles.emptyCatBtnText}>
                                                {t('Voir tous les événements')}
                                            </Text>
                                            <LucideIcon name="arrow-forward" size={13} color={C.accent} />
                                        </Pressable>
                                    </View>
                                ) : (
                                    otherEvents.map((event, idx) => (
                                        <EventCard
                                            key={event.id}
                                            event={event}
                                            index={idx}
                                            onPress={() => navigation.navigate('EventDetail', { event })}
                                            t={t}
                                        />
                                    ))
                                )}
                            </View>
                        </AnimatedSection>
                    </>
                )}
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : CATEGORY PILL (Animée)
═══════════════════════════════════════════════════════════ */

function CategoryPill({
    label, icon, count, active, onPress,
}: {
    label: string
    icon: string
    count: number
    active: boolean
    onPress: () => void
}) {
    const anim = useSharedValue(active ? 1 : 0)

    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 180 })
    }, [active])

    const pillStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            anim.value,
            [0, 1],
            [C.surface, C.primary]
        ),
        borderColor: interpolateColor(
            anim.value,
            [0, 1],
            [C.border, C.primary]
        ),
    }))

    const iconColor = active ? C.accent : C.textSec
    const textColor = active ? C.primaryText : C.textSec

    return (
        <Pressable onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.filterPill, pillStyle]}>
                <LucideIcon name={icon} size={14} color={iconColor} />
                <Text style={[styles.filterText, { color: textColor }]}>
                    {label}
                </Text>
                {count > 0 && (
                    <View style={[
                        styles.filterCount,
                        active && styles.filterCountActive,
                    ]}>
                        <Text style={[
                            styles.filterCountText,
                            active && styles.filterCountTextActive,
                        ]}>
                            {count}
                        </Text>
                    </View>
                )}
            </Animated.View>
        </Pressable>
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
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    navCounterDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    navCounterText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.xl,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.sm,
    },
    title: {
        ...typography.h1, fontSize: 38,
                color: C.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
            },

    /* ── Skeleton ── */
    skeletonWrap: {
        gap: 12,
    },
    skeletonCard: {
        flexDirection: 'row',
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    skeletonDate: {
        width: 64,
        height: 88,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.sm,
        marginRight: spacing.md,
    },
    skeletonContent: {
        flex: 1,
        justifyContent: 'center',
    },
    skeletonLine: {
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xs,
    },

    /* ── Filter title ── */
    filterTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    filterTitle: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1.5,
    },
    filterUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },

    /* ── Filtres ── */
    filtersContent: {
        gap: spacing.sm,
        paddingRight: spacing.gutter,
        paddingVertical: spacing.xs,
        marginBottom: spacing.lg,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    filterText: {
        ...typography.button, fontSize: 12.5,
                letterSpacing: 0.2,
    },
    filterCount: {
        minWidth: 20,
        height: 18,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.xs,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountActive: {
        backgroundColor: C.accent,
    },
    filterCountText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
    },
    filterCountTextActive: {
        color: C.primary,
    },

    /* ── List header ── */
    listHeader: {
        marginBottom: 12,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    listHeaderText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
        letterSpacing: 0.3,
    },

    listWrap: {
        gap: 0,
    },

    /* ── Empty Global (aucun événement) ── */
    emptyGlobalCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
        marginTop: spacing.gutter,
    },
    emptyGlobalIcon: {
        width: 88,
        height: 88,
        borderRadius: radius.xxl,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.gutter,
        borderWidth: 1,
        borderColor: C.border,
    },
    emptyGlobalTitle: {
        ...typography.h3, fontSize: 18,
                color: C.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: -0.3,
    },
    emptyGlobalDesc: {
        ...typography.label,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.gutter,
                paddingHorizontal: spacing.xs,
    },
    emptyDecorator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    emptyDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.border,
    },
    emptyLine: {
        width: 30,
        height: 1,
        backgroundColor: C.border,
    },
    emptyHint: {
        fontSize: 12,
        color: C.textMuted,
        fontStyle: 'italic',
        letterSpacing: 0.3,
    },

    /* ── Empty Catégorie ── */
    emptyCatWrap: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: spacing.gutter,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
        borderStyle: 'dashed',
        gap: spacing.sm,
    },
    emptyCatIcon: {
        width: 56,
        height: 56,
        borderRadius: radius.lg,
        backgroundColor: C.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    emptyCatTitle: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.2,
    },
    emptyCatText: {
        ...typography.caption,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.sm,
            },
    emptyCatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: C.border,
    },
    emptyCatBtnText: {
        color: C.accentDark,
        ...typography.button, fontSize: 12,
                letterSpacing: 0.2,
    },
})