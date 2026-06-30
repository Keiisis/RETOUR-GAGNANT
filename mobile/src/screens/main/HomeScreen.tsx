import React, { useEffect, useState, useMemo } from 'react'
import {
    View, Text, StyleSheet, Image, ScrollView,
    Dimensions, StatusBar, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withTiming, withRepeat, withSequence, withDelay,
    Easing, interpolate, FadeInDown, FadeIn,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'

const { width } = Dimensions.get('window')

/* ═══════════════════════════════════════════════════════════
   PALETTE C — CORPORATE PREMIUM 2026
═══════════════════════════════════════════════════════════ */
const PAL = {
    primary: '#047857',   // émeraude profond (identité app)
    primaryDeep: '#022C22',
    primarySoft: '#10B981',
    accent: '#C9A84C',   // or institutionnel
    accentSoft: '#E2C97E',
    accentDeep: '#A68B3C',
    auraGreen: '#10B981',
    auraGreenSoft: '#34D399',
    danger: '#EF4444',
    success: '#10B981',
    info: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
    teal: '#14B8A6',
    bg: '#FFFFFF',   // fond clair (aligné thème global)
    bgSoft: '#F8FAF9',
    card: '#FFFFFF',
    border: 'rgba(16,185,129,0.12)',
    borderSoft: 'rgba(16,185,129,0.06)',
    text: '#1a2332',
    textMuted: '#4A5568',
    textFaint: '#718096',
    white: '#FFFFFF',
}

const FONT = {
    heading: 'PlayfairDisplay_700Bold',
    body: 'Inter_400Regular',
    bodyM: 'Inter_500Medium',
    bodySB: 'Inter_600SemiBold',
    bodyB: 'Inter_700Bold',
}

interface DossierInfo { status: string; progress: number; service_type: string | null }

const STATUS_LABEL: Record<string, string> = {
    soumis: 'Dossier soumis', verifie: 'En vérification', traitement: 'En traitement',
    validation: 'En validation', termine: 'Terminé', annule: 'Annulé',
}

/* ─── Section animée (entrée échelonnée) ─── */
const AnimatedSection = ({ delay = 0, children, style }: any) => {
    const o = useSharedValue(0); const y = useSharedValue(18)
    useEffect(() => {
        o.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))
        y.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 110 }))
    }, [])
    const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }))
    return <Animated.View style={[s, style]}>{children}</Animated.View>
}

/* ─── Aura décorative animée ─── */
const Aura = ({ color, size = 220, top, left, right, bottom, delay = 0, opacity = 0.18 }: any) => {
    const v = useSharedValue(0)
    useEffect(() => {
        v.value = withDelay(delay, withRepeat(withSequence(
            withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        ), -1, false))
    }, [])
    const s = useAnimatedStyle(() => ({
        opacity: interpolate(v.value, [0, 1], [opacity * 0.55, opacity]),
        transform: [{ scale: interpolate(v.value, [0, 1], [0.92, 1.1]) }],
    }))
    return (
        <Animated.View pointerEvents="none" style={[{
            position: 'absolute', width: size, height: size, borderRadius: size / 2,
            backgroundColor: color, top, left, right, bottom,
        }, s]} />
    )
}

export default function HomeScreen({ navigation }: { navigation: { navigate: (route: string) => void } }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()
    const [loading, setLoading] = useState(true)
    const [dossier, setDossier] = useState<DossierInfo | null>(null)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [unreadNotifs, setUnreadNotifs] = useState(0)

    /* ─── Anim values ─── */
    const pulse = useSharedValue(1)
    const shimmer = useSharedValue(-1)
    const progressAnim = useSharedValue(0)
    const haloRing = useSharedValue(0)
    const crownGlow = useSharedValue(0)

    useEffect(() => {
        pulse.value = withRepeat(withSequence(
            withTiming(1.08, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }),
        ), -1, false)
        shimmer.value = withRepeat(
            withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }), -1, false,
        )
        haloRing.value = withRepeat(withSequence(
            withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        ), -1, false)
        crownGlow.value = withRepeat(withSequence(
            withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
        ), -1, false)
    }, [])

    useEffect(() => {
        if (dossier) {
            progressAnim.value = withDelay(450, withSpring(
                Math.max(0, Math.min(100, dossier.progress)),
                { damping: 18, stiffness: 90 },
            ))
        }
    }, [dossier])

    /* ─── Data (logique inchangée) ─── */
    const fetchData = async () => {
        if (!profile) return
        try {
            const [dossierRes, notifRes, conversationRes] = await Promise.all([
                supabase.from('dossiers').select('status, progress, service_type')
                    .eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('notifications').select('*', { count: 'exact', head: true })
                    .eq('user_id', profile.id).eq('is_read', false),
                supabase.from('messages').select('id')
                    .eq('client_id', profile.id).eq('type', 'chat')
                    .order('created_at', { ascending: false }).limit(1).maybeSingle(),
            ])
            if (dossierRes.data) setDossier(dossierRes.data as DossierInfo)
            setUnreadNotifs(notifRes.count || 0)
            if (conversationRes.data?.id) {
                const lastSeenKey = `@rg_chat_last_seen_${profile.id}`
                const lastSeenIso = await AsyncStorage.getItem(lastSeenKey).catch(() => null)
                let q = supabase.from('chat_messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('conversation_id', conversationRes.data.id).eq('role', 'agent')
                if (lastSeenIso) q = q.gt('created_at', lastSeenIso)
                const { count } = await q
                setUnreadMessages(count || 0)
            } else { setUnreadMessages(0) }
        } catch { /* silent */ } finally { setLoading(false) }
    }
    useEffect(() => { fetchData() }, [profile])

    /* ─── Helpers ─── */
    const getGreeting = () => {
        const h = new Date().getHours()
        return h < 12 ? t('Bonjour') : h < 18 ? t('Bon après-midi') : t('Bonsoir')
    }
    const initials = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase() || 'RG'
    const dossierStatusLabel = dossier ? t(STATUS_LABEL[dossier.status] || dossier.status) : ''

    const QUICK_ACTIONS = useMemo(() => ([
        { icon: 'folder-open-outline' as const, label: t('Dossiers'), tint: PAL.info, dest: 'Dossier' },
        { icon: 'chatbubbles-outline' as const, label: t('Messages'), tint: PAL.purple, badge: unreadMessages, dest: 'Messages' },
        { icon: 'document-text-outline' as const, label: t('Documents'), tint: PAL.accent, dest: 'Signature' },
        { icon: 'card-outline' as const, label: t('Paiements'), tint: PAL.success, dest: 'Payments' },
    ]), [unreadMessages, t])

    const SECONDARY = useMemo(() => ([
        { icon: 'calendar-outline' as const, label: t('Rendez-vous'), desc: t('Planifier un entretien'), tint: PAL.teal, dest: 'Appointments' },
        { icon: 'headset-outline' as const, label: t('Support 24/7'), desc: t('Assistance dédiée'), tint: PAL.pink, dest: 'Messages' },
        { icon: 'help-circle-outline' as const, label: t('Aide & FAQ'), desc: t('Questions fréquentes'), tint: PAL.accentDeep, dest: 'FAQ' },
    ]), [t])

    /* ─── Animated styles ─── */
    const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
    const shimmerStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: interpolate(shimmer.value, [-1, 1], [-width, width * 1.3]) },
            { skewX: '-22deg' },
        ],
        opacity: interpolate(shimmer.value, [-1, -0.5, 0.5, 1], [0, 0.45, 0.45, 0]),
    }))
    const progressBarStyle = useAnimatedStyle(() => ({ width: `${progressAnim.value}%` }))
    const haloStyle = useAnimatedStyle(() => ({
        opacity: interpolate(haloRing.value, [0, 1], [0.15, 0.45]),
        transform: [{ scale: interpolate(haloRing.value, [0, 1], [1, 1.18]) }],
    }))
    const crownGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(crownGlow.value, [0, 1], [0.35, 0.85]),
        transform: [{ scale: interpolate(crownGlow.value, [0, 1], [0.9, 1.15]) }],
    }))

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* ════════ AURAS GLOBALES ════════ */}
            <Aura color={PAL.accent} size={300} top={-120} right={-100} opacity={0.10} />
            <Aura color={PAL.auraGreen} size={280} top={180} left={-110} opacity={0.08} delay={1500} />
            <Aura color={PAL.primary} size={260} bottom={120} right={-80} opacity={0.06} delay={2800} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
            >
                {/* ════════ HEADER ════════ */}
                <AnimatedSection delay={0} style={styles.header}>
                    <Pressable onPress={() => navigation.navigate('Profil')} style={styles.headerLeft}>
                        <View style={styles.avatarWrap}>
                            <Animated.View style={[styles.avatarHalo, haloStyle]} />
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: PAL.primary }]}>
                                    <Text style={styles.avatarText}>{initials}</Text>
                                </View>
                            )}
                            <View style={styles.avatarRing} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.greeting}>{getGreeting()}</Text>
                            <Text style={styles.userName} numberOfLines={1}>
                                {profile?.prenom || t('Bienvenue')}
                            </Text>
                        </View>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.notifBtn}>
                        <Ionicons name="notifications-outline" size={20} color={PAL.primary} />
                        {unreadNotifs > 0 && (
                            <Animated.View style={[styles.notifBadge, pulseStyle]}>
                                <Text style={styles.notifBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
                            </Animated.View>
                        )}
                    </Pressable>
                </AnimatedSection>

                {/* ════════ HERO DOSSIER (Corporate dark card) ════════ */}
                <AnimatedSection delay={120} style={styles.heroWrap}>
                    <Pressable onPress={() => navigation.navigate(dossier ? 'Dossier' : 'Services')}>
                        <View style={styles.heroCard}>
                            {/* Fond corporate */}
                            <View style={StyleSheet.absoluteFillObject} />
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PAL.primaryDeep }]} />
                            <Aura color={PAL.accent} size={180} top={-70} right={-50} opacity={0.22} />
                            <Aura color={PAL.auraGreen} size={160} bottom={-60} left={-40} opacity={0.28} delay={900} />

                            {/* Grille décorative */}
                            <View style={styles.heroGrid}>
                                {[...Array(8)].map((_, i) => (
                                    <View key={i} style={[styles.heroGridDot, { left: 18 + i * 28, top: 14 }]} />
                                ))}
                            </View>

                            {/* Shimmer */}
                            <View style={styles.shimmerWrap} pointerEvents="none">
                                <Animated.View style={[styles.shimmerBand, shimmerStyle]} />
                            </View>

                            {/* Bordure or */}
                            <View style={styles.heroBorder} pointerEvents="none" />

                            <View style={styles.heroContent}>
                                <View style={styles.heroTop}>
                                    <View style={styles.heroBadge}>
                                        <View style={styles.heroBadgeDot} />
                                        <Text style={styles.heroBadgeText}>
                                            {dossier ? t('VOTRE DOSSIER ACTIF') : t('DÉMARCHE CERTIFIÉE RGB')}
                                        </Text>
                                    </View>
                                    <View style={styles.heroChevron}>
                                        <Ionicons name="arrow-forward" size={14} color={PAL.primaryDeep} />
                                    </View>
                                </View>

                                <Text style={styles.heroTitle} numberOfLines={2}>
                                    {dossier
                                        ? (dossier.service_type || t('Dossier en cours'))
                                        : t('Initier une démarche officielle')}
                                </Text>

                                {dossier ? (
                                    <View style={{ marginTop: 8 }}>
                                        <View style={styles.progressRow}>
                                            <Text style={styles.progressLabel}>{dossierStatusLabel}</Text>
                                            <Text style={styles.progressPct}>{dossier.progress}%</Text>
                                        </View>
                                        <View style={styles.progressBg}>
                                            <Animated.View style={[styles.progressFill, progressBarStyle]} />
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={styles.heroSub} numberOfLines={2}>
                                        {t('Nationalité, état civil, légalisation — un accompagnement de bout en bout.')}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </Pressable>
                </AnimatedSection>

                {/* ════════ QUICK ACTIONS ════════ */}
                <AnimatedSection delay={220} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionBar} />
                        <Text style={styles.sectionLabel}>{t('ACCÈS RAPIDE')}</Text>
                    </View>
                    <View style={styles.actionsRow}>
                        {QUICK_ACTIONS.map((s, i) => {
                            const badge = (s as any).badge || 0
                            return (
                                <Pressable
                                    key={i}
                                    onPress={() => navigation.navigate(s.dest)}
                                    style={({ pressed }) => [
                                        styles.actionItem,
                                        pressed && { transform: [{ scale: 0.96 }] },
                                    ]}
                                >
                                    <View style={[styles.actionIcon, { borderColor: s.tint + '40' }]}>
                                        <View style={[styles.actionIconBg, { backgroundColor: s.tint + '14' }]} />
                                        <Ionicons name={s.icon} size={22} color={s.tint} />
                                        {badge > 0 && (
                                            <Animated.View style={[styles.actionBadge, pulseStyle]}>
                                                <Text style={styles.actionBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                                            </Animated.View>
                                        )}
                                    </View>
                                    <Text style={styles.actionLabel} numberOfLines={1}>{s.label}</Text>
                                </Pressable>
                            )
                        })}
                    </View>
                </AnimatedSection>

                {/* ════════ DUO PREMIUM (Boutique + VIP) ════════ */}
                <AnimatedSection delay={320} style={styles.duoSection}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionBar, { backgroundColor: PAL.accent }]} />
                        <Text style={styles.sectionLabel}>{t('SIGNATURES MAISON')}</Text>
                    </View>

                    <View style={styles.duoRow}>
                        {/* ── BOUTIQUE — Ivoire & Or ── */}
                        <Pressable
                            onPress={() => navigation.navigate('Boutique')}
                            style={({ pressed }) => [styles.boutiqueCard, pressed && { transform: [{ scale: 0.98 }] }]}
                        >
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PAL.bg }]} />
                            <Aura color={PAL.accent} size={140} top={-50} right={-40} opacity={0.32} />
                            <Aura color={PAL.accentSoft} size={120} bottom={-50} left={-30} opacity={0.22} delay={1200} />

                            <View style={styles.boutiqueBorder} pointerEvents="none" />

                            <View style={styles.shimmerWrap} pointerEvents="none">
                                <Animated.View style={[styles.shimmerBand, shimmerStyle, { backgroundColor: 'transparent' }]}>
                                    <View style={{ flex: 1, backgroundColor: 'rgba(212,160,23,0.22)' }} />
                                </Animated.View>
                            </View>

                            <View style={styles.boutiqueContent}>
                                <View style={styles.boutiqueHeader}>
                                    <View style={styles.boutiquePill}>
                                        <View style={styles.boutiqueLiveDot} />
                                        <Text style={styles.boutiquePillText}>{t('NEW')}</Text>
                                    </View>
                                    <View style={styles.boutiqueArrowMini}>
                                        <Ionicons name="arrow-forward" size={12} color={PAL.primary} />
                                    </View>
                                </View>

                                <View style={styles.boutiqueBagContainer}>
                                    <View style={styles.boutiqueBagGlow} />
                                    <View style={styles.boutiqueBagCircle}>
                                        <Ionicons name="bag-handle-outline" size={26} color={PAL.primary} />
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.boutiqueTitle}>{t('Boutique')}</Text>
                                    <Text style={styles.boutiqueSubtitle}>RGB</Text>
                                    <View style={styles.boutiqueRatingRow}>
                                        <Ionicons name="star" size={10} color={PAL.accent} />
                                        <Text style={styles.boutiqueRating}>4.9 · {t('Artisanat')}</Text>
                                    </View>
                                </View>
                            </View>
                        </Pressable>

                        {/* ── VIP NATIONALITÉ — Ticket sombre ── */}
                        <Pressable
                            onPress={() => navigation.navigate('NationaliteForm')}
                            style={({ pressed }) => [styles.vipCard, pressed && { transform: [{ scale: 0.98 }] }]}
                        >
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: PAL.primaryDeep }]} />
                            <Aura color={PAL.accent} size={130} top={-50} right={-35} opacity={0.22} />
                            <Aura color={PAL.auraGreen} size={120} bottom={-40} left={-30} opacity={0.18} delay={900} />

                            <View style={styles.vipBorder} pointerEvents="none" />

                            {/* Pattern lignes obliques */}
                            <View style={styles.vipPattern} pointerEvents="none">
                                <View style={[styles.vipLine, { top: 30 }]} />
                                <View style={[styles.vipLine, { top: 75 }]} />
                                <View style={[styles.vipLine, { top: 120 }]} />
                            </View>

                            <View style={styles.shimmerWrap} pointerEvents="none">
                                <Animated.View style={[styles.shimmerBand, shimmerStyle]} />
                            </View>

                            <View style={styles.vipContent}>
                                <View style={styles.vipCrownWrap}>
                                    <Animated.View style={[styles.vipCrownGlow, crownGlowStyle]} />
                                    <View style={styles.vipCrownCircle}>
                                        <Ionicons name="ribbon" size={16} color={PAL.accent} />
                                    </View>
                                </View>

                                <View style={styles.vipBadge}>
                                    <Text style={styles.vipBadgeText}>{t('SERVICE VIP')}</Text>
                                </View>

                                <View>
                                    <Text style={styles.vipTitle}>{t('Nationalité')}</Text>
                                    <View style={styles.vipTitleAccentRow}>
                                        <Text style={styles.vipTitleAccent}>{t('Béninoise')}</Text>
                                        <View style={styles.vipDot} />
                                    </View>
                                </View>

                                <View style={styles.vipPerfLine}>
                                    {[...Array(14)].map((_, i) => (
                                        <View key={i} style={styles.vipPerfDot} />
                                    ))}
                                </View>

                                <View style={styles.vipFooter}>
                                    <Text style={styles.vipFooterText}>{t('Découvrir')}</Text>
                                    <View style={styles.vipArrow}>
                                        <Ionicons name="arrow-forward" size={13} color={PAL.primaryDeep} />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.vipNotch, { left: -11 }]} />
                            <View style={[styles.vipNotch, { right: -11 }]} />
                        </Pressable>
                    </View>
                </AnimatedSection>

                {/* ════════ TIP CARD (sécurité / engagement) ════════ */}
                <AnimatedSection delay={400} style={{ paddingHorizontal: 20, marginBottom: 14 }}>
                    <View style={styles.tipCard}>
                        <View style={styles.tipIconWrap}>
                            <Ionicons name="shield-checkmark" size={18} color={PAL.auraGreen} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tipTitle}>{t('Engagement RGB')}</Text>
                            <Text style={styles.tipDesc} numberOfLines={2}>
                                {t('Vos données sont chiffrées et traitées par des agents certifiés.')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ════════ AUTRES SERVICES (formCard list) ════════ */}
                <AnimatedSection delay={460} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={[styles.sectionBar, { backgroundColor: PAL.auraGreen }]} />
                        <Text style={styles.sectionLabel}>{t('AUTRES SERVICES')}</Text>
                    </View>
                    <View style={styles.formCard}>
                        {SECONDARY.map((s, i) => {
                            const isLast = i === SECONDARY.length - 1
                            return (
                                <Pressable
                                    key={i}
                                    onPress={() => navigation.navigate(s.dest)}
                                    style={({ pressed }) => [
                                        styles.listRow,
                                        !isLast && styles.listRowBorder,
                                        pressed && { backgroundColor: PAL.bgSoft },
                                    ]}
                                >
                                    <View style={[styles.listIcon, { backgroundColor: s.tint + '14', borderColor: s.tint + '35' }]}>
                                        <Ionicons name={s.icon} size={18} color={s.tint} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.listLabel}>{s.label}</Text>
                                        <Text style={styles.listDesc}>{s.desc}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={PAL.textFaint} />
                                </Pressable>
                            )
                        })}
                    </View>
                </AnimatedSection>

                {/* ════════ FOOTER SIGNATURE ════════ */}
                <AnimatedSection delay={540} style={styles.footerSig}>
                    <View style={styles.footerLine} />
                    <Text style={styles.footerText}>RGB · {t('Excellence administrative')}</Text>
                    <View style={styles.footerLine} />
                </AnimatedSection>
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PAL.bg },

    /* ─── Header ─── */
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatarWrap: { position: 'relative', width: 44, height: 44 },
    avatarHalo: {
        position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
        borderRadius: 26, backgroundColor: PAL.accent,
    },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarRing: {
        position: 'absolute', top: -2, left: -2, right: -2, bottom: -2,
        borderRadius: 24, borderWidth: 1.5, borderColor: PAL.accent, opacity: 0.6,
    },
    avatarText: { fontFamily: FONT.bodyB, fontSize: 15, color: PAL.white },
    greeting: { fontFamily: FONT.bodyM, fontSize: 12, color: PAL.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
    userName: { fontFamily: FONT.heading, fontSize: 22, color: PAL.primary, letterSpacing: -0.4 },
    notifBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: PAL.white, borderWidth: 1, borderColor: PAL.border,
        alignItems: 'center', justifyContent: 'center',
    },
    notifBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: PAL.danger, borderRadius: 10,
        minWidth: 18, height: 18, paddingHorizontal: 5,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: PAL.bg,
    },
    notifBadgeText: { color: PAL.white, fontSize: 10, fontFamily: FONT.bodyB },

    /* ─── Section ─── */
    section: { marginBottom: 14 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginHorizontal: 20, marginBottom: 10,
    },
    sectionBar: { width: 3, height: 14, borderRadius: 2, backgroundColor: PAL.primary },
    sectionLabel: {
        fontFamily: FONT.bodyB, fontSize: 11, color: PAL.primary,
        letterSpacing: 1.6, textTransform: 'uppercase',
    },

    /* ─── Hero ─── */
    heroWrap: { paddingHorizontal: 20, marginBottom: 18 },
    heroCard: {
        height: 148, borderRadius: 22, overflow: 'hidden',
        shadowColor: PAL.primary, shadowOpacity: 0.32,
        shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 10,
    },
    heroBorder: {
        ...StyleSheet.absoluteFillObject, borderRadius: 22,
        borderWidth: 1, borderColor: 'rgba(212,160,23,0.45)',
    },
    heroGrid: { ...StyleSheet.absoluteFillObject },
    heroGridDot: {
        position: 'absolute', width: 3, height: 3, borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    heroContent: { flex: 1, padding: 16, justifyContent: 'space-between' },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(212,160,23,0.18)',
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(212,160,23,0.55)',
    },
    heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAL.accent },
    heroBadgeText: { fontFamily: FONT.bodyB, fontSize: 10, color: PAL.accentSoft, letterSpacing: 1.2 },
    heroChevron: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: PAL.accent, alignItems: 'center', justifyContent: 'center',
    },
    heroTitle: { fontFamily: FONT.heading, fontSize: 19, color: PAL.white, letterSpacing: -0.4, lineHeight: 23 },
    heroSub: { fontFamily: FONT.body, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 18, marginTop: 6 },
    progressRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 6,
    },
    progressLabel: { fontFamily: FONT.bodySB, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    progressPct: { fontFamily: FONT.heading, fontSize: 16, color: PAL.accentSoft },
    progressBg: {
        height: 5, backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 3, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: PAL.accent },

    /* ─── Quick actions ─── */
    actionsRow: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingHorizontal: 20, gap: 10,
    },
    actionItem: { alignItems: 'center', flex: 1, gap: 8 },
    actionIcon: {
        width: 60, height: 60, borderRadius: 18,
        backgroundColor: PAL.white, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
    },
    actionIconBg: { ...StyleSheet.absoluteFillObject },
    actionBadge: {
        position: 'absolute', top: -3, right: -3,
        backgroundColor: PAL.danger, borderRadius: 9,
        minWidth: 18, height: 18, paddingHorizontal: 4,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: PAL.white,
    },
    actionBadgeText: { color: PAL.white, fontSize: 9, fontFamily: FONT.bodyB },
    actionLabel: {
        fontFamily: FONT.bodyM, fontSize: 11,
        color: PAL.primary, textAlign: 'center',
    },

    /* ─── Duo Premium ─── */
    duoSection: { marginBottom: 18 },
    duoRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, height: 200 },

    /* Boutique */
    boutiqueCard: {
        flex: 1.05, borderRadius: 22, overflow: 'hidden',
        shadowColor: PAL.accent, shadowOpacity: 0.35,
        shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8,
    },
    boutiqueBorder: {
        ...StyleSheet.absoluteFillObject, borderRadius: 22,
        borderWidth: 1.5, borderColor: PAL.accent + '60',
    },
    boutiqueContent: { flex: 1, padding: 14, justifyContent: 'space-between' },
    boutiqueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    boutiquePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: PAL.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    boutiqueLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PAL.accent },
    boutiquePillText: { fontFamily: FONT.bodyB, fontSize: 9, color: PAL.white, letterSpacing: 1.2 },
    boutiqueArrowMini: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: PAL.accent, alignItems: 'center', justifyContent: 'center',
    },
    boutiqueBagContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    boutiqueBagGlow: {
        position: 'absolute', width: 70, height: 70, borderRadius: 35,
        backgroundColor: PAL.accent, opacity: 0.25,
    },
    boutiqueBagCircle: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: PAL.white, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: PAL.accent,
    },
    boutiqueTitle: { fontFamily: FONT.heading, fontSize: 18, color: PAL.primary, letterSpacing: -0.4, lineHeight: 22 },
    boutiqueSubtitle: { fontFamily: FONT.heading, fontSize: 18, color: PAL.accentDeep, letterSpacing: -0.4, lineHeight: 22, marginTop: -2 },
    boutiqueRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    boutiqueRating: { fontFamily: FONT.bodySB, fontSize: 11, color: PAL.textMuted },

    /* VIP */
    vipCard: {
        flex: 1, borderRadius: 22, overflow: 'hidden',
        shadowColor: PAL.primary, shadowOpacity: 0.4,
        shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8,
    },
    vipBorder: {
        ...StyleSheet.absoluteFillObject, borderRadius: 22,
        borderWidth: 1, borderColor: 'rgba(212,160,23,0.40)',
    },
    vipPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.12, overflow: 'hidden' },
    vipLine: {
        position: 'absolute', left: -20, right: -20, height: 1,
        backgroundColor: PAL.accent, transform: [{ rotate: '-15deg' }],
    },
    vipContent: { flex: 1, padding: 14, justifyContent: 'space-between' },
    vipCrownWrap: {
        width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
        position: 'relative', alignSelf: 'flex-start',
    },
    vipCrownGlow: {
        position: 'absolute', width: 36, height: 36, borderRadius: 18,
        backgroundColor: PAL.accent,
    },
    vipCrownCircle: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(212,160,23,0.18)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(212,160,23,0.55)',
    },
    vipBadge: {
        backgroundColor: 'rgba(212,160,23,0.18)',
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5,
        alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(212,160,23,0.55)',
    },
    vipBadgeText: { fontFamily: FONT.bodyB, fontSize: 9, color: PAL.accentSoft, letterSpacing: 0.9 },
    vipTitle: { fontFamily: FONT.heading, fontSize: 16, color: PAL.white, letterSpacing: -0.3, lineHeight: 20 },
    vipTitleAccentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    vipTitleAccent: { fontFamily: FONT.heading, fontSize: 16, color: PAL.accentSoft, letterSpacing: -0.3, lineHeight: 20 },
    vipDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: PAL.accentSoft },
    vipPerfLine: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
    vipPerfDot: { width: 3, height: 1, backgroundColor: 'rgba(212,160,23,0.5)' },
    vipFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    vipFooterText: { fontFamily: FONT.bodyB, fontSize: 12, color: PAL.white },
    vipArrow: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: PAL.accent, alignItems: 'center', justifyContent: 'center',
    },
    vipNotch: {
        position: 'absolute', top: '50%', width: 22, height: 22, borderRadius: 11,
        backgroundColor: PAL.bg, marginTop: -11,
    },

    /* ─── Tip card ─── */
    tipCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: PAL.auraGreen + '10',
        borderWidth: 1, borderColor: PAL.auraGreen + '30',
        borderRadius: 14, padding: 12,
    },
    tipIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: PAL.auraGreen + '18',
        alignItems: 'center', justifyContent: 'center',
    },
    tipTitle: { fontFamily: FONT.bodyB, fontSize: 13, color: PAL.primary, marginBottom: 2 },
    tipDesc: { fontFamily: FONT.body, fontSize: 12, color: PAL.textMuted, lineHeight: 16 },

    /* ─── Form card list ─── */
    formCard: {
        marginHorizontal: 20, backgroundColor: PAL.white,
        borderRadius: 16, borderWidth: 1, borderColor: PAL.border,
        overflow: 'hidden',
    },
    listRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 12,
    },
    listRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: PAL.borderSoft,
    },
    listIcon: {
        width: 38, height: 38, borderRadius: 11, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center',
    },
    listLabel: { fontFamily: FONT.bodySB, fontSize: 14, color: PAL.primary, letterSpacing: -0.2 },
    listDesc: { fontFamily: FONT.body, fontSize: 11.5, color: PAL.textMuted, marginTop: 1 },

    /* ─── Footer signature ─── */
    footerSig: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 40, marginTop: 8,
    },
    footerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: PAL.border },
    footerText: {
        fontFamily: FONT.bodyM, fontSize: 10, color: PAL.textFaint,
        letterSpacing: 1.5, textTransform: 'uppercase',
    },

    /* ─── Shimmer commun ─── */
    shimmerWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
    shimmerBand: {
        position: 'absolute', top: -50, bottom: -50, width: 110,
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
})
