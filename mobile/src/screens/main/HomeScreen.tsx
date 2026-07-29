import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Image, Linking,
    StatusBar, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    Bell, FolderOpen, MessageSquare, FileText, CreditCard,
    Calendar, Headphones, HelpCircle, ShieldCheck, ShoppingBag,
    BadgeCheck, ChevronRight, ArrowRight, FileCheck2, Phone,
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withTiming, withDelay, Easing,
} from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'
import { authHeaders } from '../../config/api'
import { fetchWithTimeout } from '../../lib/fetch'
import { colors, typography, spacing, radius, shadows } from '../../config/theme'
import { FlagBar, Card, IconTile } from '../../components/ui'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

interface DossierInfo { status: string; progress: number; service_type: string | null }

/* Étapes réelles du cycle de vie d'un dossier (voir mobile/CLAUDE.md).
   Sert à afficher « Étape n sur 5 » sans inventer de valeur. */
const STATUS_STEPS = ['soumis', 'verifie', 'traitement', 'validation', 'termine'] as const
const STATUS_LABEL: Record<string, string> = {
    soumis: 'Dossier soumis', verifie: 'En vérification', traitement: 'En traitement',
    validation: 'En validation', termine: 'Terminé', annule: 'Annulé',
}
const STATUS_HINT: Record<string, string> = {
    soumis: 'Votre dossier a bien été reçu. Un agent va le prendre en charge.',
    verifie: 'Vérification de vos pièces justificatives en cours.',
    traitement: 'Traitement du dossier par l\'administration compétente.',
    validation: 'Dernière validation avant délivrance de votre document.',
    termine: 'Votre dossier est finalisé. Vous pouvez récupérer vos documents.',
    annule: 'Ce dossier a été annulé. Contactez votre conseiller pour en savoir plus.',
}

/* Entrée échelonnée des sections — un seul effet, pas de boucle infinie. */
const AnimatedSection = ({ delay = 0, children, style }: any) => {
    const o = useSharedValue(0); const y = useSharedValue(14)
    useEffect(() => {
        o.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }))
        y.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }))
    }, [])
    const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }))
    return <Animated.View style={[s, style]}>{children}</Animated.View>
}

export default function HomeScreen({ navigation }: { navigation: { navigate: (route: string, params?: object) => void } }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()
    const [dossier, setDossier] = useState<DossierInfo | null>(null)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [unreadNotifs, setUnreadNotifs] = useState(0)
    const [advisor, setAdvisor] = useState<string | null>(null)

    const progressAnim = useSharedValue(0)
    useEffect(() => {
        if (dossier) {
            progressAnim.value = withDelay(350, withSpring(
                Math.max(0, Math.min(100, dossier.progress)),
                { damping: 18, stiffness: 90 },
            ))
        }
    }, [dossier])
    const progressBarStyle = useAnimatedStyle(() => ({ width: `${progressAnim.value}%` }))

    /* ─── Données (logique inchangée) ─── */
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
        } catch { /* silencieux */ }
    }
    /* Sans cela, revenir de la messagerie laissait le compteur de messages
       non lus fige : `profile` n'ayant pas change, fetchData ne rejouait pas. */
    useEffect(() => { fetchData() }, [profile])
    useFocusEffect(useCallback(() => { fetchData() }, [profile]))

    /* Conseiller reellement assigne (dossier_tracking.agent_assigne, expose par
       /api/mobile/dossiers). Sans assignation, on garde « Equipe RGB » : on
       n'affiche jamais un nom qui n'existe pas. */
    useEffect(() => {
        let alive = true
        const loadAdvisor = async () => {
            try {
                const res = await fetchWithTimeout(
                    `${API_BASE}/api/mobile/dossiers`,
                    { timeoutMs: 8000, headers: { ...(await authHeaders()) } },
                )
                const json = await res.json().catch(() => ({}))
                if (alive && json?.advisor?.name) setAdvisor(String(json.advisor.name))
            } catch { /* silencieux : le repli suffit */ }
        }
        if (profile) loadAdvisor()
        return () => { alive = false }
    }, [profile])

    /* ─── Dérivations ─── */
    const getGreeting = () => {
        const h = new Date().getHours()
        return h < 12 ? t('Bonjour') : h < 18 ? t('Bon après-midi') : t('Bonsoir')
    }
    const stepIndex = dossier ? STATUS_STEPS.indexOf(dossier.status as typeof STATUS_STEPS[number]) : -1
    const stepLabel = stepIndex >= 0
        ? `${t('Étape')} ${stepIndex + 1} ${t('sur')} ${STATUS_STEPS.length}`
        : dossier ? t(STATUS_LABEL[dossier.status] || dossier.status) : ''

    const SHORTCUTS = useMemo(() => ([
        { icon: FolderOpen, label: t('Dossiers'), tone: 'primary' as const, dest: 'Dossier' },
        { icon: MessageSquare, label: t('Messages'), tone: 'accent' as const, badge: unreadMessages, dest: 'Messages' },
        { icon: FileText, label: t('Documents'), tone: 'neutral' as const, dest: 'Signature' },
    ]), [unreadMessages, t])

    const HIGHLIGHTS = useMemo(() => ([
        {
            icon: BadgeCheck, tone: 'primary' as const, dest: 'NationaliteForm',
            title: t('Nationalité béninoise'), desc: t('Constituez votre dossier de reconnaissance.'),
        },
        {
            icon: ShoppingBag, tone: 'accent' as const, dest: 'Boutique',
            title: t('Boutique RGB'), desc: t('Artisanat et objets du patrimoine béninois.'),
        },
    ]), [t])

    const SECONDARY = useMemo(() => ([
        { icon: Calendar, label: t('Rendez-vous'), desc: t('Planifier un entretien'), dest: 'Appointments' },
        { icon: CreditCard, label: t('Paiements'), desc: t('Factures et règlements'), dest: 'Payments' },
        { icon: Headphones, label: t('Support'), desc: t('Assistance dédiée'), dest: 'Messages' },
        { icon: HelpCircle, label: t('Aide & FAQ'), desc: t('Questions fréquentes'), dest: 'FAQ' },
    ]), [t])

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
            >
                {/* ── Liseré tricolore : signature de marque ── */}
                <View style={styles.topFlag}><FlagBar height={6} radiusTop={false} /></View>

                {/* ── En-tête ── */}
                <AnimatedSection delay={0} style={styles.header}>
                    <Pressable
                        onPress={() => navigation.navigate('Profil')}
                        accessibilityRole="button"
                        accessibilityLabel={t('Voir mon profil')}
                        style={styles.headerIdentity}
                        hitSlop={6}
                    >
                        <Text style={styles.greeting}>{getGreeting()},</Text>
                        <Text style={styles.userName} numberOfLines={1}>
                            {profile?.prenom || t('Bienvenue')}
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => navigation.navigate('Notifications')}
                        accessibilityRole="button"
                        accessibilityLabel={
                            unreadNotifs > 0
                                ? `${t('Notifications')} — ${unreadNotifs} ${t('non lues')}`
                                : t('Notifications')
                        }
                        style={styles.bellBtn}
                        hitSlop={6}
                    >
                        <Bell size={20} color={colors.text} strokeWidth={1.9} />
                        {unreadNotifs > 0 && <View style={styles.bellDot} />}
                    </Pressable>
                </AnimatedSection>

                {/* ── Dossier en cours ── */}
                <AnimatedSection delay={80} style={styles.section}>
                    <View style={styles.sectionRow}>
                        <Text style={styles.sectionTitle}>{t('Dossier en cours')}</Text>
                        {dossier && (
                            <Pressable
                                onPress={() => navigation.navigate('Dossier')}
                                accessibilityRole="button"
                                hitSlop={8}
                                style={styles.linkRow}
                            >
                                <Text style={styles.linkText}>{t('Voir')}</Text>
                                <ArrowRight size={15} color={colors.primary} strokeWidth={2.2} />
                            </Pressable>
                        )}
                    </View>

                    {dossier ? (
                        <Card flagTop raised onPress={() => navigation.navigate('Dossier')}>
                            <View style={styles.dossierTop}>
                                <View style={styles.stepBadge}>
                                    <FileCheck2 size={14} color={colors.accentInk} strokeWidth={2.2} />
                                    <Text style={styles.stepBadgeText}>{stepLabel}</Text>
                                </View>
                                <IconTile icon={FolderOpen} tone="primary" size={48} />
                            </View>

                            <Text style={styles.dossierTitle} numberOfLines={2}>
                                {dossier.service_type || t('Dossier en cours')}
                            </Text>

                            <View
                                accessible
                                accessibilityRole="progressbar"
                                accessibilityLabel={`${t('Avancement')} ${dossier.progress}%`}
                                style={styles.progressBg}
                            >
                                <Animated.View style={[styles.progressFill, progressBarStyle]} />
                            </View>

                            <Text style={styles.dossierHint}>
                                {t(STATUS_HINT[dossier.status] || STATUS_LABEL[dossier.status] || dossier.status)}
                            </Text>
                        </Card>
                    ) : (
                        <Card flagTop onPress={() => navigation.navigate('Services')}>
                            <View style={styles.dossierTop}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dossierTitle}>{t('Aucun dossier ouvert')}</Text>
                                    <Text style={styles.dossierHint}>
                                        {t('Choisissez une prestation pour démarrer votre démarche.')}
                                    </Text>
                                </View>
                                <IconTile icon={FolderOpen} tone="neutral" size={48} />
                            </View>
                            <View style={styles.linkRow}>
                                <Text style={styles.linkText}>{t('Voir les prestations')}</Text>
                                <ArrowRight size={15} color={colors.primary} strokeWidth={2.2} />
                            </View>
                        </Card>
                    )}
                </AnimatedSection>

                {/* ── Raccourcis ── */}
                <AnimatedSection delay={160} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('Raccourcis')}</Text>
                    <View style={styles.shortcutRow}>
                        {SHORTCUTS.map((s) => (
                            <Pressable
                                key={s.dest}
                                onPress={() => navigation.navigate(s.dest)}
                                accessibilityRole="button"
                                accessibilityLabel={s.label}
                                style={({ pressed }) => [
                                    styles.shortcut,
                                    shadows.card,
                                    pressed && { transform: [{ scale: 0.97 }] },
                                ]}
                                hitSlop={6}
                            >
                                <View>
                                    <IconTile icon={s.icon} tone={s.tone} size={52} />
                                    {(s as any).badge > 0 && (
                                        <View style={styles.shortcutBadge}>
                                            <Text style={styles.shortcutBadgeText}>
                                                {(s as any).badge > 9 ? '9+' : (s as any).badge}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.shortcutLabel} numberOfLines={1}>{s.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ── Prestations mises en avant ── */}
                <AnimatedSection delay={240} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('À la une')}</Text>
                    {HIGHLIGHTS.map((h) => (
                        <Card key={h.dest} onPress={() => navigation.navigate(h.dest)} style={styles.highlightCard}>
                            <View style={styles.highlightRow}>
                                <IconTile icon={h.icon} tone={h.tone} size={52} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.highlightTitle}>{h.title}</Text>
                                    <Text style={styles.highlightDesc} numberOfLines={2}>{h.desc}</Text>
                                </View>
                                <ChevronRight size={18} color={colors.textFaint} strokeWidth={2} />
                            </View>
                        </Card>
                    ))}
                </AnimatedSection>

                {/* ── Autres services ── */}
                <AnimatedSection delay={320} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('Autres services')}</Text>
                    <View style={[styles.listCard, shadows.card]}>
                        {SECONDARY.map((s, i) => (
                            <Pressable
                                key={s.dest + i}
                                onPress={() => navigation.navigate(s.dest)}
                                accessibilityRole="button"
                                accessibilityLabel={s.label}
                                style={({ pressed }) => [
                                    styles.listRow,
                                    i < SECONDARY.length - 1 && styles.listRowBorder,
                                    pressed && { backgroundColor: colors.surfaceMuted },
                                ]}
                                hitSlop={6}
                            >
                                <IconTile icon={s.icon} tone="neutral" size={42} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.listLabel}>{s.label}</Text>
                                    <Text style={styles.listDesc}>{s.desc}</Text>
                                </View>
                                <ChevronRight size={17} color={colors.textFaint} strokeWidth={2} />
                            </Pressable>
                        ))}
                    </View>
                </AnimatedSection>
                {/* ── Barre d'assistance ──
                Volontairement sans nom de conseiller : l'agent assigné vit dans
                dossier_tracking.agent_assigne, qui n'est pas encore exposé à
                l'app. Afficher un prénom ici serait inventé. Les deux actions
                pointent vers les canaux réels (chat in-app, ligne de l'agence). */}
                <View style={styles.advisorBar}>
                <Image
                    source={require('../../../assets/images/conseillere.webp')}
                    style={styles.advisorAvatar}
                    accessible={false}
                />
                <View style={{ flex: 1 }}>
                    <Text style={styles.advisorLabel}>
                        {advisor ? t('VOTRE CONSEILLER') : t('ASSISTANCE')}
                    </Text>
                    <Text style={styles.advisorName} numberOfLines={1}>
                        {advisor || t('Équipe RGB')}
                    </Text>
                </View>
                <Pressable
                    onPress={() => navigation.navigate('Messages')}
                    accessibilityRole="button"
                    accessibilityLabel={t('Ouvrir la messagerie')}
                    style={styles.advisorBtnGhost}
                    hitSlop={6}
                >
                    <MessageSquare size={19} color={colors.floatingText} strokeWidth={2} />
                </Pressable>
                <Pressable
                    onPress={() => navigation.navigate("Call", { sujet: "Appel depuis l'accueil" })}
                    accessibilityRole="button"
                    accessibilityLabel={t('Appeler un conseiller')}
                    style={styles.advisorBtnCall}
                    hitSlop={6}
                >
                    <Phone size={19} color={colors.textOnPrimary} strokeWidth={2} />
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    topFlag: {
        marginHorizontal: spacing.gutter,
        marginTop: spacing.sm,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },

    /* ── En-tête ── */
    header: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.lg, paddingBottom: spacing.md,
    },
    headerIdentity: { flex: 1 },
    greeting: { ...typography.overline, color: colors.textFaint },
    userName: { ...typography.h1, color: colors.text, marginTop: spacing.xs },
    bellBtn: {
        width: 48, height: 48, borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
        ...shadows.card,
    },
    bellDot: {
        position: 'absolute', top: 11, right: 12,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: colors.danger,
        borderWidth: 2, borderColor: colors.surface,
    },

    /* ── Sections ── */
    section: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg },
    sectionRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: spacing.md,
    },
    sectionTitle: { ...typography.h2, color: colors.text, marginBottom: spacing.md },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
    linkText: { ...typography.label, color: colors.primary },

    /* ── Carte dossier ── */
    dossierTop: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: spacing.md,
    },
    stepBadge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.accentSoft,
        paddingHorizontal: spacing.md, paddingVertical: 9,
        borderRadius: radius.pill, alignSelf: 'flex-start',
    },
    stepBadgeText: { ...typography.label, color: colors.accentInk },
    dossierTitle: { ...typography.h2, color: colors.text, marginTop: spacing.md },
    progressBg: {
        height: 8, borderRadius: radius.pill, overflow: 'hidden',
        backgroundColor: colors.surfaceMuted, marginTop: spacing.md,
    },
    progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
    dossierHint: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },

    /* ── Raccourcis ── */
    shortcutRow: { flexDirection: 'row', gap: spacing.md },
    shortcut: {
        flex: 1, alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: radius.xl,
        paddingVertical: spacing.lg, paddingHorizontal: spacing.sm,
    },
    shortcutLabel: { ...typography.label, color: colors.text, textAlign: 'center' },
    shortcutBadge: {
        position: 'absolute', top: -4, right: -4,
        minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: radius.pill,
        backgroundColor: colors.danger,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.surface,
    },
    shortcutBadgeText: { ...typography.caption, fontSize: 12, color: colors.textOnPrimary },

    /* ── À la une ── */
    highlightCard: { marginBottom: spacing.md },
    highlightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    highlightTitle: { ...typography.h3, color: colors.text },
    highlightDesc: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },

    /* ── Liste ── */
    listCard: {
        backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden',
    },
    listRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    listLabel: { ...typography.label, fontSize: 15, color: colors.text },
    listDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

    /* ── Engagement ── */

    /* ── Barre d'assistance ── */
    advisorBar: {
        marginHorizontal: spacing.gutter,
        marginTop: spacing.sm,
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.floating,
        borderRadius: radius.pill,
        paddingLeft: spacing.sm, paddingRight: spacing.sm, paddingVertical: spacing.sm,
        ...shadows.floating,
    },
    advisorAvatar: { width: 44, height: 44, borderRadius: radius.pill },
    advisorLabel: { ...typography.overline, fontSize: 12, color: colors.floatingMuted },
    advisorName: { ...typography.label, color: colors.floatingText, marginTop: 1 },
    advisorBtnGhost: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    advisorBtnCall: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },

})
