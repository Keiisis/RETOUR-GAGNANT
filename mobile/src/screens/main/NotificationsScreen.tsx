'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, Switch, Alert, ActivityIndicator,
    Pressable, Dimensions,
} from 'react-native'
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
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'

/* ═══════════════════════════════════════════════════════════
   NotificationsScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec tous les écrans)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',
    primaryDark: '#022C22',
    accent: '#C9A84C',
    accentDark: '#A68B3C',
    accentLight: '#E2C97E',
    auraGreen: '#10B981',
    error: '#EF4444',
    success: '#10B981',
    info: '#3B82F6',
    purple: '#8B5CF6',

    textSec: '#64748B',
    textMuted: '#94A3B8',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

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
    icon: keyof typeof Ionicons.glyphMap
    color: string
    bgRgba: string
    borderRgba: string
    label: string
}> = {
    dossier: {
        icon: 'folder-open',
        color: C.primary,
        bgRgba: 'rgba(13, 43, 78, 0.08)',
        borderRgba: 'rgba(13, 43, 78, 0.18)',
        label: 'DOSSIER',
    },
    message: {
        icon: 'chatbubble-ellipses',
        color: C.info,
        bgRgba: 'rgba(59, 130, 196, 0.10)',
        borderRgba: 'rgba(59, 130, 196, 0.25)',
        label: 'MESSAGE',
    },
    payment: {
        icon: 'card',
        color: C.success,
        bgRgba: 'rgba(10, 107, 59, 0.10)',
        borderRgba: 'rgba(10, 107, 59, 0.25)',
        label: 'PAIEMENT',
    },
    appointment: {
        icon: 'calendar',
        color: C.purple,
        bgRgba: 'rgba(124, 92, 202, 0.10)',
        borderRgba: 'rgba(124, 92, 202, 0.25)',
        label: 'RENDEZ-VOUS',
    },
    event: {
        icon: 'sparkles',
        color: C.accent,
        bgRgba: 'rgba(212, 160, 23, 0.10)',
        borderRgba: 'rgba(212, 160, 23, 0.25)',
        label: 'ÉVÉNEMENT',
    },
    system: {
        icon: 'information-circle',
        color: C.textSec,
        bgRgba: 'rgba(100, 116, 139, 0.08)',
        borderRgba: 'rgba(100, 116, 139, 0.18)',
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
                        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
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
    const [notifications, setNotifications] = useState<AppNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [pushEnabled, setPushEnabled] = useState(false)
    const [registeringPush, setRegisteringPush] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)
    const bellPulse = useSharedValue(0)

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
        bellPulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))
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
                    Alert.alert(
                        t('Permission refusée'),
                        t('Activez les notifications dans les paramètres de votre appareil pour recevoir des alertes.')
                    )
                    return
                }
                const projectId =
                    Constants.expoConfig?.extra?.eas?.projectId
                    ?? Constants.easConfig?.projectId
                if (!projectId) {
                    Alert.alert(t('Configuration'), t('Identifiant projet EAS introuvable. Contactez le support.'))
                    return
                }
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
                const token = tokenData.data
                await updateProfile({ push_token: token })
                setPushEnabled(true)
                Alert.alert(t('Notifications activées'), t('Vous recevrez désormais des alertes pour vos dossiers et messages.'))
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : t('Erreur')
                Alert.alert(t('Erreur'), msg)
            } finally {
                setRegisteringPush(false)
            }
        } else {
            Alert.alert(
                t('Désactiver les notifications'),
                t('Vous ne recevrez plus d\'alertes push. Vous pourrez les réactiver à tout moment.'),
                [
                    { text: t('Annuler'), style: 'cancel' },
                    {
                        text: t('Désactiver'), style: 'destructive', onPress: async () => {
                            await updateProfile({ push_token: undefined })
                            setPushEnabled(false)
                        },
                    },
                ]
            )
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
            {/* 🎨 BACKGROUND PREMIUM : Auras */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <Animated.View style={bellPulseStyle}>
                        <Ionicons name="notifications" size={12} color={C.accent} />
                    </Animated.View>
                    <Text style={styles.navCounterText}>
                        {unreadCount > 0
                            ? t('{n} non lue(s)').replace('{n}', String(unreadCount))
                            : t('À jour')}
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.accent}
                        colors={[C.accent]}
                    />
                }
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Vos')}</Text>
                    <Text style={styles.titleHighlight}>{t('notifications.')}</Text>
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
                            { backgroundColor: pushEnabled ? 'rgba(10, 107, 59, 0.10)' : 'rgba(100, 116, 139, 0.08)' },
                            { borderColor: pushEnabled ? 'rgba(10, 107, 59, 0.25)' : 'rgba(100, 116, 139, 0.18)' },
                        ]}>
                            <Ionicons
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
                                trackColor={{ false: '#CBD5E1', true: C.accent }}
                                thumbColor={C.surfaceSolid}
                                ios_backgroundColor="#CBD5E1"
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
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(212, 160, 23, 0.10)', borderColor: 'rgba(212, 160, 23, 0.25)' }]}>
                                    <Ionicons name="notifications-outline" size={14} color={C.accent} />
                                </View>
                                <Text style={styles.statValue}>{notifications.length}</Text>
                                <Text style={styles.statLabel}>{t('TOTAL')}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(13, 43, 78, 0.08)', borderColor: 'rgba(13, 43, 78, 0.18)' }]}>
                                    <Ionicons name="mail-unread-outline" size={14} color={C.primary} />
                                </View>
                                <Text style={styles.statValue}>{unreadCount}</Text>
                                <Text style={styles.statLabel}>{t('NON LUES')}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: 'rgba(10, 107, 59, 0.10)', borderColor: 'rgba(10, 107, 59, 0.25)' }]}>
                                    <Ionicons name="checkmark-done" size={14} color={C.success} />
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
                                >
                                    <Ionicons name="checkmark-done" size={14} color={C.accent} />
                                    <Text style={styles.markAllText}>{t('Tout lire')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </AnimatedSection>
                )}

                {/* ═══ LISTE / ÉTATS ═══ */}
                {loading ? (
                    <View style={styles.loadingState}>
                        <View style={styles.loadingIconWrap}>
                            <ActivityIndicator color={C.primary} size="large" />
                        </View>
                        <Text style={styles.loadingTitle}>{t('Chargement')}</Text>
                        <Text style={styles.loadingText}>{t('Récupération de vos notifications…')}</Text>
                    </View>
                ) : notifications.length === 0 ? (
                    <AnimatedSection delay={300}>
                        <View style={styles.emptyState}>
                            <View style={styles.emptyHero}>
                                <View style={styles.emptyHeroGlow} />
                                <View style={styles.emptyIconWrap}>
                                    <Ionicons name="notifications-off-outline" size={36} color={C.accent} />
                                </View>
                                <View style={styles.emptyHeroBadge}>
                                    <Ionicons name="checkmark" size={10} color={C.accent} />
                                    <Text style={styles.emptyHeroBadgeText}>{t('À JOUR')}</Text>
                                </View>
                            </View>

                            <Text style={styles.emptyTitle}>{t('Aucune notification')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Vous serez alerté ici lors des mises à jour de vos dossiers, messages et rendez-vous.')}
                            </Text>
                        </View>
                    </AnimatedSection>
                ) : filteredNotifs.length === 0 ? (
                    <AnimatedSection delay={300}>
                        <View style={styles.emptyFilterState}>
                            <View style={styles.emptyFilterIcon}>
                                <Ionicons name="checkmark-done" size={28} color={C.success} />
                            </View>
                            <Text style={styles.emptyFilterTitle}>{t('Tout est lu')}</Text>
                            <Text style={styles.emptyFilterText}>
                                {t("Vous n'avez plus de notifications non lues.")}
                            </Text>
                        </View>
                    </AnimatedSection>
                ) : (
                    <View style={styles.notifList}>
                        {filteredNotifs.map((notif, i) => (
                            <NotifCard
                                key={notif.id}
                                notif={notif}
                                onPress={() => markAsRead(notif.id)}
                                formatDate={formatDate}
                                t={t}
                                delay={i * 60}
                            />
                        ))}
                    </View>
                )}

                {/* ═══ FOOTER INFO ═══ */}
                {notifications.length > 0 && (
                    <AnimatedSection delay={400}>
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
                    </AnimatedSection>
                )}

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
    aura1: { top: -100, right: -100, backgroundColor: C.primary },
    aura2: { bottom: 50, left: -100, backgroundColor: C.auraGreen },

    /* ── Nav Bar ── */
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 10,
        zIndex: 10,
    },
    navBack: { width: 44, height: 44, justifyContent: 'center' },
    iconContainer: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        justifyContent: 'center', alignItems: 'center',
    },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    navCounterText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 22,
        paddingHorizontal: 4,
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
        fontSize: 14,
        color: C.textSec,
        marginTop: 12,
        lineHeight: 20,
        fontWeight: '400',
    },

    /* ── Push Card ── */
    pushCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 22,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    pushCardActive: {
        borderColor: 'rgba(10, 107, 59, 0.3)',
        backgroundColor: 'rgba(10, 107, 59, 0.03)',
    },
    pushIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    pushLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 3,
    },
    pushLabel: {
        fontSize: 13.5,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
    },
    pushStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(10, 107, 59, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: 'rgba(10, 107, 59, 0.25)',
    },
    pushStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.success,
    },
    pushStatusText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.success,
        letterSpacing: 0.8,
    },
    pushSub: {
        fontSize: 11.5,
        color: C.textSec,
        fontWeight: '500',
    },

    /* ── Stats ── */
    statsHeaderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    statsTitle: {
        fontSize: 11,
        fontWeight: '800',
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
        gap: 10,
        marginBottom: 22,
    },
    statCard: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    statIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1,
    },

    /* ── Filters ── */
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 16,
    },
    filterPills: {
        flexDirection: 'row',
        gap: 6,
        flex: 1,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: C.surface,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    filterPillActive: {
        backgroundColor: C.primary,
        borderColor: C.primary,
    },
    filterPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.2,
    },
    filterPillTextActive: {
        color: C.primaryText,
    },
    filterCount: {
        backgroundColor: 'rgba(13, 43, 78, 0.08)',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        minWidth: 20,
        alignItems: 'center',
    },
    filterCountActive: {
        backgroundColor: 'rgba(212, 160, 23, 0.25)',
    },
    filterCountText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.primary,
    },
    filterCountTextActive: {
        color: C.accent,
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1.2,
        borderColor: 'rgba(212, 160, 23, 0.3)',
    },
    markAllText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Loading ── */
    loadingState: {
        alignItems: 'center',
        gap: 14,
        paddingVertical: 50,
        paddingHorizontal: 30,
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
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    loadingTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
        marginTop: 6,
    },
    loadingText: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '500',
    },

    /* ── Empty State ── */
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 20,
    },
    emptyHero: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 22,
    },
    emptyHeroGlow: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: C.accent,
        opacity: 0.08,
    },
    emptyIconWrap: {
        width: 84,
        height: 84,
        borderRadius: 28,
        backgroundColor: C.surfaceSolid,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.3)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
    },
    emptyHeroBadge: {
        position: 'absolute',
        bottom: -8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.primary,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1.5,
        borderColor: C.accent,
    },
    emptyHeroBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.2,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: 10,
    },
    emptyText: {
        fontSize: 13.5,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '400',
        paddingHorizontal: 20,
    },

    /* ── Empty Filter (Tout lu) ── */
    emptyFilterState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 30,
        backgroundColor: C.surface,
        borderRadius: 18,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    emptyFilterIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(10, 107, 59, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(10, 107, 59, 0.25)',
        marginBottom: 14,
    },
    emptyFilterTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
        marginBottom: 6,
    },
    emptyFilterText: {
        fontSize: 12.5,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 18,
        fontWeight: '500',
    },

    /* ── Notif List ── */
    notifList: {
        gap: 10,
    },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    notifCardUnread: {
        backgroundColor: C.surfaceSolid,
        borderColor: 'rgba(212, 160, 23, 0.3)',
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
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginLeft: 4,
    },
    notifContent: {
        flex: 1,
        gap: 4,
    },
    notifTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    notifTypeBadge: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 1.2,
    },
    notifTime: {
        fontSize: 10.5,
        color: C.textMuted,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    notifTitle: {
        fontSize: 13.5,
        color: C.primary,
        fontWeight: '600',
        letterSpacing: -0.1,
        lineHeight: 18,
    },
    notifTitleUnread: {
        fontWeight: '800',
    },
    notifBody: {
        fontSize: 12.5,
        color: C.textSec,
        lineHeight: 18,
        fontWeight: '400',
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
        marginTop: 24,
        paddingHorizontal: 30,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
})