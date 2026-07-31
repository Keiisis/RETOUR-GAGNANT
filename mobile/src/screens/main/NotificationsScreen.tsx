'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import { confirm, toast } from '../../lib/feedback'
import {
    View, Text, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, Switch, ActivityIndicator,
    Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { LucideIcon } from '../../components/Icon'
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
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   NotificationsScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec tous les écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'Notifications'>

/* ── Types ── */
interface AppNotification {
    id: string
    title: string
    body: string
    type: 'dossier' | 'message' | 'payment' | 'appointment' | 'event' | 'system'
    is_read: boolean
    created_at: string
}

/* ── Config visuelle par type ── */
const TYPE_CONFIG: Record<string, {
    icon: string
    color: string
    bgRgba: string
    borderRgba: string
    label: string
}> = {
    dossier: {
        icon: 'folder-open',
        color: C.primary,
        bgRgba: C.surfaceSoft,
        borderRgba: C.border,
        label: 'DOSSIER',
    },
    message: {
        icon: 'chatbubble-ellipses',
        color: C.info,
        bgRgba: C.surfaceSoft,
        borderRgba: C.border,
        label: 'MESSAGE',
    },
    payment: {
        icon: 'card',
        color: C.success,
        bgRgba: C.surfaceSoft,
        borderRgba: C.border,
        label: 'PAIEMENT',
    },
    appointment: {
        icon: 'calendar',
        color: C.purple,
        bgRgba: C.accentSoft,
        borderRgba: C.border,
        label: 'RENDEZ-VOUS',
    },
    event: {
        icon: 'sparkles',
        color: C.accent,
        bgRgba: C.accentSoft,
        borderRgba: C.border,
        label: 'ÉVÉNEMENT',
    },
    system: {
        icon: 'information-circle',
        color: C.textSec,
        bgRgba: C.surfaceAlt,
        borderRgba: C.border,
        label: 'SYSTÈME',
    },
}

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
   COMPOSANT : NOTIFICATION CARD
═══════════════════════════════════════════════════════════ */
function NotifCard({
    notif, onPress, formatDate, t, delay,
}: {
    notif: AppNotification
    onPress: () => void
    formatDate: (iso: string) => string
    t: (k: string) => string
    delay: number
}) {
    const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
    const pressAnim = useSharedValue(0)
    const entryAnim = useSharedValue(0)

    useEffect(() => {
        entryAnim.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }))
    }, [delay])

    const entryStyle = useAnimatedStyle(() => ({
        opacity: entryAnim.value,
        transform: [{ translateX: 30 * (1 - entryAnim.value) }],
    }))

    const pressStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) }],
    }))

    return (
        <Animated.View style={entryStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <Animated.View style={[
                    styles.notifCard,
                    !notif.is_read && styles.notifCardUnread,
                    pressStyle,
                ]}>
                    {/* Indicateur non-lu (barre gauche) */}
                    {!notif.is_read && (
                        <View style={styles.unreadBar} />
                    )}

                    {/* Icône typée */}
                    <View style={[
                        styles.notifIcon,
                        { backgroundColor: cfg.bgRgba, borderColor: cfg.borderRgba },
                    ]}>
                        <LucideIcon name={cfg.icon} size={18} color={cfg.color} />
                    </View>

                    {/* Contenu */}
                    <View style={styles.notifContent}>
                        <View style={styles.notifTopRow}>
                            <Text style={[
                                styles.notifTypeBadge,
                                { color: cfg.color },
                            ]}>
                                {t(cfg.label)}
                            </Text>
                            <Text style={styles.notifTime}>
                                {formatDate(notif.created_at)}
                            </Text>
                        </View>

                        <Text
                            style={[
                                styles.notifTitle,
                                !notif.is_read && styles.notifTitleUnread,
                            ]}
                            numberOfLines={1}
                        >
                            {t(notif.title)}
                        </Text>
                        <Text style={styles.notifBody} numberOfLines={2}>
                            {t(notif.body)}
                        </Text>
                    </View>

                    {/* Dot non-lu (droite) */}
                    {!notif.is_read && (
                        <View style={styles.unreadDot} />
                    )}
                </Animated.View>
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function NotificationsScreen({ navigation }: { navigation: Nav }) {
    const { profile, updateProfile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [pushEnabled, setPushEnabled] = useState(false)
    const [registeringPush, setRegisteringPush] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const bellPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        bellPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const bellPulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(bellPulse.value, [0, 1], [0.4, 1]),
        transform: [{ scale: interpolate(bellPulse.value, [0, 1], [0.9, 1.15]) }],
    }))

    /* ── Charger notifications ── */
    const fetchNotifications = useCallback(async () => {
        if (!profile) return
        try {
            const { data } = await supabase
                .from('notifications')
                .select('id, title, body, type, is_read, created_at')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(50)
            setNotifications((data || []) as AppNotification[])
        } catch { /* ignore */ } finally { setLoading(false) }
    }, [profile])

    /* ── Vérifier état push ── */
    const checkPushStatus = useCallback(async () => {
        const { status } = await Notifications.getPermissionsAsync()
        setPushEnabled(status === 'granted' && !!profile?.push_token)
    }, [profile])

    useEffect(() => {
        fetchNotifications()
        checkPushStatus()
    }, [fetchNotifications, checkPushStatus])

    /* ── Temps réel : nouvelle notification poussée par le staff ── */
    useEffect(() => {
        if (!profile?.id) return
        const channel = supabase
            .channel(`notifications-${profile.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
                (payload) => {
                    const n = payload.new as AppNotification
                    setNotifications(prev => (prev.some(p => p.id === n.id) ? prev : [n, ...prev]))
                },
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [profile?.id])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchNotifications()
        setRefreshing(false)
    }

    /* ── Toggle push ── */
    const handleTogglePush = async (value: boolean) => {
        if (value) {
            setRegisteringPush(true)
            try {
                const { status: existing } = await Notifications.getPermissionsAsync()
                let finalStatus = existing
                if (existing !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync()
                    finalStatus = status
                }
                if (finalStatus !== 'granted') {
                    toast(t('Permission refusée'), t('Activez les notifications dans les paramètres de votre appareil pour recevoir des alertes.'))
                    return
                }
                const projectId =
                    Constants.expoConfig?.extra?.eas?.projectId
                    ?? Constants.easConfig?.projectId
                if (!projectId) {
                    toast(t('Configuration'), t('Identifiant projet EAS introuvable. Contactez le support.'))
                    return
                }
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
                const token = tokenData.data
                await updateProfile({ push_token: token })
                setPushEnabled(true)
                toast(t('Notifications activées'), t('Vous recevrez désormais des alertes pour vos dossiers et messages.'))
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : t('Erreur')
                toast(t('Erreur'), msg)
            } finally {
                setRegisteringPush(false)
            }
        } else {
            confirm({
                title: t('Désactiver les notifications'),
                message: t('Vous ne recevrez plus d\'alertes push. Vous pourrez les réactiver à tout moment.'),
                confirmLabel: t('Désactiver'),
                cancelLabel: t('Annuler'),
                destructive: true,
                onConfirm: async () => {
                    await updateProfile({ push_token: undefined })
                    setPushEnabled(false)
                },
            })
        }
    }

    /* ── Mark as read ── */
    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    }

    const markAllRead = async () => {
        if (!profile) return
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        await supabase.from('notifications')
            .update({ is_read: true })
            .eq('user_id', profile.id)
            .eq('is_read', false)
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    /* ── Stats par type ── */
    const stats = notifications.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1
        return acc
    }, {})

    const formatDate = (iso: string) => {
        const d = new Date(iso)
        const now = new Date()
        const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
        if (diff < 60) return t("À l'instant")
        if (diff < 3600) return `${Math.floor(diff / 60)} min`
        if (diff < 86400) return `${Math.floor(diff / 3600)} h`
        if (diff < 604800) return `${Math.floor(diff / 86400)} j`
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    }

    const filteredNotifs = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications

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

                <View style={styles.navCounter}>
                    <Animated.View style={bellPulseStyle}>
                        <LucideIcon name="notifications" size={12} color={C.accent} />
                    </Animated.View>
                    <Text style={styles.navCounterText}>
                        {unreadCount > 0
                            ? t('{n} non lue(s)').replace('{n}', String(unreadCount))
                            : t('À jour')}
                    </Text>
                </View>
            </View>

            <FlatList
                data={loading ? [] : filteredNotifs}
                keyExtractor={(n) => n.id}
                renderItem={({ item, index }) => (
                    <NotifCard
                        notif={item}
                        onPress={() => { Haptics.selectionAsync(); markAsRead(item.id) }}
                        formatDate={formatDate}
                        t={t}
                        delay={Math.min(index, 8) * 45}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.accent}
                        colors={[C.accent]}
                    />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.loadingState}>
                            <View style={styles.loadingIconWrap}>
                                <ActivityIndicator color={C.primary} size="large" />
                            </View>
                            <Text style={styles.loadingTitle}>{t('Chargement')}</Text>
                            <Text style={styles.loadingText}>{t('Récupération de vos notifications…')}</Text>
                        </View>
                    ) : notifications.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyHero}>
                                <View style={styles.emptyHeroGlow} />
                                <View style={styles.emptyIconWrap}>
                                    <LucideIcon name="notifications-off-outline" size={36} color={C.accent} />
                                </View>
                            </View>
                            <Text style={styles.emptyTitle}>{t('Aucune notification')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Vous serez alerté ici lors des mises à jour de vos dossiers, messages et rendez-vous.')}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.emptyFilterState}>
                            <View style={styles.emptyFilterIcon}>
                                <LucideIcon name="checkmark-done" size={28} color={C.success} />
                            </View>
                            <Text style={styles.emptyFilterTitle}>{t('Tout est lu')}</Text>
                            <Text style={styles.emptyFilterText}>
                                {t("Vous n'avez plus de notifications non lues.")}
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    notifications.length > 0 ? (
                        <View style={styles.footerInfo}>
                            <View style={styles.footerDivider}>
                                <View style={styles.dividerLine} />
                                <View style={styles.dividerDot} />
                                <View style={styles.dividerLine} />
                            </View>
                            <Text style={styles.footerText}>
                                {t('Les notifications sont conservées 30 jours.')}
                            </Text>
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <>
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Notifications')}</Text>
                    <Text style={styles.subtitle}>
                        {unreadCount > 0
                            ? t("Vous avez de nouvelles alertes à consulter.")
                            : t("Tout est à jour. Vous serez alerté en temps réel.")}
                    </Text>
                </Animated.View>

                {/* ═══ PUSH STATUS CARD ═══ */}
                <AnimatedSection delay={100}>
                    <View style={[styles.pushCard, pushEnabled && styles.pushCardActive]}>
                        <View style={[
                            styles.pushIconWrap,
                            { backgroundColor: pushEnabled ? 'rgba(0, 135, 81, 0.10)' : 'rgba(138, 138, 138, 0.08)' },
                            { borderColor: pushEnabled ? 'rgba(0, 135, 81, 0.25)' : 'rgba(138, 138, 138, 0.18)' },
                        ]}>
                            <LucideIcon
                                name={pushEnabled ? 'notifications' : 'notifications-off-outline'}
                                size={20}
                                color={pushEnabled ? C.success : C.textSec}
                            />
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={styles.pushLabelRow}>
                                <Text style={styles.pushLabel}>{t('Notifications push')}</Text>
                                {pushEnabled && (
                                    <View style={styles.pushStatusBadge}>
                                        <View style={styles.pushStatusDot} />
                                        <Text style={styles.pushStatusText}>{t('ACTIF')}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.pushSub}>
                                {pushEnabled
                                    ? t('Alertes en temps réel activées')
                                    : t('Activez pour recevoir des alertes')}
                            </Text>
                        </View>

                        {registeringPush ? (
                            <ActivityIndicator color={C.primary} size="small" />
                        ) : (
                            <Switch
                                value={pushEnabled}
                                onValueChange={handleTogglePush}
                                trackColor={{ false: C.borderStrong, true: C.accent }}
                                thumbColor={C.surfaceSolid}
                                ios_backgroundColor="#E4E4E4"
                            />
                        )}
                    </View>
                </AnimatedSection>

                {/* ═══ STATS RAPIDES (mini-grid) ═══ */}
                {notifications.length > 0 && (
                    <AnimatedSection delay={200}>
                        <View style={styles.statsHeaderWrap}>
                            <Text style={styles.statsTitle}>{t('APERÇU')}</Text>
                            <View style={styles.statsUnderline} />
                        </View>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: C.accentSoft, borderColor: C.border }]}>
                                    <LucideIcon name="notifications-outline" size={14} color={C.accent} />
                                </View>
                                <Text style={styles.statValue}>{notifications.length}</Text>
                                <Text style={styles.statLabel}>{t('TOTAL')}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: C.surfaceSoft, borderColor: C.border }]}>
                                    <LucideIcon name="mail-unread-outline" size={14} color={C.primary} />
                                </View>
                                <Text style={styles.statValue}>{unreadCount}</Text>
                                <Text style={styles.statLabel}>{t('NON LUES')}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: C.surfaceSoft, borderColor: C.border }]}>
                                    <LucideIcon name="checkmark-done" size={14} color={C.success} />
                                </View>
                                <Text style={styles.statValue}>{notifications.length - unreadCount}</Text>
                                <Text style={styles.statLabel}>{t('LUES')}</Text>
                            </View>
                        </View>
                    </AnimatedSection>
                )}

                {/* ═══ FILTRES + ACTIONS ═══ */}
                {notifications.length > 0 && (
                    <AnimatedSection delay={300}>
                        <View style={styles.filterRow}>
                            <View style={styles.filterPills}>
                                <Pressable
                                    style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
                                    onPress={() => setFilter('all')}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
                                        {t('Toutes')}
                                    </Text>
                                    <View style={[styles.filterCount, filter === 'all' && styles.filterCountActive]}>
                                        <Text style={[styles.filterCountText, filter === 'all' && styles.filterCountTextActive]}>
                                            {notifications.length}
                                        </Text>
                                    </View>
                                </Pressable>
                                <Pressable
                                    style={[styles.filterPill, filter === 'unread' && styles.filterPillActive]}
                                    onPress={() => setFilter('unread')}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <Text style={[styles.filterPillText, filter === 'unread' && styles.filterPillTextActive]}>
                                        {t('Non lues')}
                                    </Text>
                                    <View style={[styles.filterCount, filter === 'unread' && styles.filterCountActive]}>
                                        <Text style={[styles.filterCountText, filter === 'unread' && styles.filterCountTextActive]}>
                                            {unreadCount}
                                        </Text>
                                    </View>
                                </Pressable>
                            </View>

                            {unreadCount > 0 && (
                                <TouchableOpacity
                                    style={styles.markAllBtn}
                                    onPress={markAllRead}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <LucideIcon name="checkmark-done" size={14} color={C.accent} />
                                    <Text style={styles.markAllText}>{t('Tout lire')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </AnimatedSection>
                )}

                    </>
                }
            />
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
    navBack: { width: 44, height: 44, justifyContent: 'center' },
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
    navCounterText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.xl,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: spacing.sm,
        marginBottom: spacing.gutter,
        paddingHorizontal: spacing.xs,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.bodySmall,
        color: C.textSec,
        marginTop: 12,
            },

    /* ── Push Card ── */
    pushCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: spacing.gutter,
        ...shadows.card,
    },
    pushCardActive: {
        borderColor: C.border,
        backgroundColor: C.surfaceSoft,
    },
    pushIconWrap: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    pushLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xxs,
    },
    pushLabel: {
        ...typography.button, fontSize: 13.5,
                color: C.primary,
        letterSpacing: -0.1,
    },
    pushStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderWidth: 1,
        borderColor: C.border,
    },
    pushStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    pushStatusText: {
        ...typography.button, fontSize: 12,
                color: C.success,
        letterSpacing: 0.8,
    },
    pushSub: {
        ...typography.caption,
        color: C.textSec,
            },

    /* ── Stats ── */
    statsHeaderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    statsTitle: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1.5,
    },
    statsUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.gutter,
    },
    statCard: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        ...shadows.card,
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        borderWidth: 1,
    },
    statValue: {
        ...typography.h2, fontSize: 20,
                color: C.primary,
        letterSpacing: -0.5,
        marginBottom: spacing.xxs,
    },
    statLabel: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1,
    },

    /* ── Filters ── */
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    filterPills: {
        flexDirection: 'row',
        gap: spacing.xs,
        flex: 1,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: 12,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
        backgroundColor: C.surface,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    filterPillActive: {
        backgroundColor: C.primary,
        borderColor: C.primary,
    },
    filterPillText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
        letterSpacing: 0.2,
    },
    filterPillTextActive: {
        color: C.primaryText,
    },
    filterCount: {
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xs,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
        minWidth: 20,
        alignItems: 'center',
    },
    filterCountActive: {
        backgroundColor: C.accentSoft,
    },
    filterCountText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
    },
    filterCountTextActive: {
        color: C.accent,
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.sm,
        paddingHorizontal: 12,
        paddingVertical: spacing.sm,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    markAllText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Loading ── */
    loadingState: {
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
    },
    loadingIconWrap: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: C.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        ...shadows.card,
    },
    loadingTitle: {
        ...typography.h3, fontSize: 16,
                color: C.primary,
        letterSpacing: -0.2,
        marginTop: spacing.xs,
    },
    loadingText: {
        ...typography.label,
        color: C.textSec,
            },

    /* ── Empty State ── */
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.gutter,
    },
    emptyHero: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.gutter,
    },
    emptyHeroGlow: { display: 'none' },
    emptyIconWrap: {
        width: 84,
        height: 84,
        borderRadius: radius.xxl,
        backgroundColor: C.surfaceSolid,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.border,
        ...shadows.card,
    },
    emptyTitle: {
        ...typography.h2,
                color: C.primary,
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    emptyText: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
        textAlign: 'center',
                paddingHorizontal: spacing.gutter,
    },

    /* ── Empty Filter (Tout lu) ── */
    emptyFilterState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: spacing.xl,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    emptyFilterIcon: {
        width: 60,
        height: 60,
        borderRadius: radius.xl,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    emptyFilterTitle: {
        ...typography.h3, fontSize: 16,
                color: C.primary,
        letterSpacing: -0.2,
        marginBottom: spacing.xs,
    },
    emptyFilterText: {
        ...typography.label, fontSize: 12.5,
        color: C.textSec,
        textAlign: 'center',
            },

    /* ── Notif List ── */
    notifList: {
        gap: spacing.sm,
    },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1.2,
        borderColor: C.border,
        position: 'relative',
        overflow: 'hidden',
        ...shadows.card,
    },
    notifCardUnread: {
        backgroundColor: C.surfaceSolid,
        borderColor: C.border,
        shadowOpacity: 0.08,
    },
    unreadBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: C.accent,
    },
    notifIcon: {
        width: 40,
        height: 40,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginLeft: spacing.xs,
    },
    notifContent: {
        flex: 1,
        gap: spacing.xs,
    },
    notifTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xxs,
    },
    notifTypeBadge: {
        ...typography.button, fontSize: 12,
                letterSpacing: 1.2,
    },
    notifTime: {
        ...typography.caption,
        color: C.textMuted,
                letterSpacing: 0.2,
    },
    notifTitle: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.primary,
                letterSpacing: -0.1,
    },
    notifTitleUnread: {
        fontFamily: fonts.extrabold,
    },
    notifBody: {
        ...typography.label, fontSize: 12.5,
        color: C.textSec,
            },
    unreadDot: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: C.accent,
        borderWidth: 1.5,
        borderColor: C.surfaceSolid,
    },

    /* ── Footer ── */
    footerInfo: {
        alignItems: 'center',
        marginTop: spacing.lg,
        paddingHorizontal: spacing.xl,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 12,
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
    footerText: {
        ...typography.caption,
        color: C.textMuted,
                letterSpacing: 0.2,
        textAlign: 'center',
    },
})