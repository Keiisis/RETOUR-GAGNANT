'use strict'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, Linking, Pressable, Dimensions,
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   InvoicesScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
type Nav = NativeStackNavigationProp<RootStackParamList, 'Invoices'>

interface Invoice {
    id: string
    invoice_ref: string
    order_id: string | null
    dossier_id: string | null
    customer_name: string
    amount: number
    currency: string
    description: string | null
    status: string
    issued_at: string
    paid_at: string | null
    sent_to_email: boolean
    pdf_url: string | null
    items: unknown
}

const STATUS_CONFIG: Record<string, {
    label: string
    color: string
    bg: string
    icon: string
}> = {
    paid: {
        label: 'Payée',
        color: C.success,
        bg: C.surfaceSoft,
        icon: 'checkmark-circle',
    },
    pending: {
        label: 'En attente',
        color: C.primary,
        bg: C.accentSoft,
        icon: 'time-outline',
    },
    cancelled: {
        label: 'Annulée',
        color: C.error,
        bg: C.dangerSoft,
        icon: 'close-circle-outline',
    },
    refunded: {
        label: 'Remboursée',
        color: C.info,
        bg: C.surfaceSoft,
        icon: 'return-up-back-outline',
    },
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
   COMPOSANT : FILTER PILL
═══════════════════════════════════════════════════════════ */

function FilterPill({
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
        backgroundColor: interpolateColor(anim.value, [0, 1], [C.surface, C.primary]),
        borderColor: interpolateColor(anim.value, [0, 1], [C.border, C.primary]),
    }))

    return (
        <Pressable onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.filterPill, pillStyle]}>
                <LucideIcon
                    name={icon}
                    size={13}
                    color={active ? C.accent : C.textSec}
                />
                <Text style={[
                    styles.filterText,
                    { color: active ? C.primaryText : C.textSec },
                ]}>
                    {label}
                </Text>
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                    <Text style={[
                        styles.filterCountText,
                        active && styles.filterCountTextActive,
                    ]}>
                        {count}
                    </Text>
                </View>
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : INVOICE CARD
═══════════════════════════════════════════════════════════ */

function InvoiceCard({
    invoice, index, onPress, t, formatPrice, formatDate,
}: {
    invoice: Invoice
    index: number
    onPress: () => void
    t: (s: string) => string
    formatPrice: (n: number, c: string) => string
    formatDate: (iso: string) => string
}) {
    const enterAnim = useSharedValue(0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        enterAnim.value = withDelay(
            index * 70,
            withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
        )
    }, [index])

    const cardStyle = useAnimatedStyle(() => ({
        opacity: enterAnim.value,
        transform: [
            { translateY: 25 * (1 - enterAnim.value) },
            { scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) },
        ],
    }))

    const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending
    const isPaid = invoice.status === 'paid'

    return (
        <Animated.View style={cardStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <View style={styles.invCard}>
                    {/* Status accent bar à gauche */}
                    <View style={[styles.statusBar, { backgroundColor: cfg.color }]} />

                    {/* Icône statut */}
                    <View style={[styles.statusIconWrap, { backgroundColor: cfg.bg }]}>
                        <LucideIcon name={cfg.icon} size={22} color={cfg.color} />
                    </View>

                    {/* Contenu */}
                    <View style={styles.invInfo}>
                        <View style={styles.refRow}>
                            <LucideIcon name="receipt-outline" size={11} color={C.primary} />
                            <Text style={styles.invRef}>{invoice.invoice_ref}</Text>
                        </View>

                        <Text style={styles.invDesc} numberOfLines={1}>
                            {t(invoice.description || 'Facture')}
                        </Text>

                        <View style={styles.metaRow}>
                            <LucideIcon name="calendar-outline" size={10} color={C.textMuted} />
                            <Text style={styles.invDate}>{formatDate(invoice.issued_at)}</Text>

                            {invoice.sent_to_email && (
                                <>
                                    <View style={styles.metaDot} />
                                    <LucideIcon name="mail-outline" size={10} color={C.success} />
                                    <Text style={styles.emailText}>{t('Envoyée')}</Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Right column */}
                    <View style={styles.invRight}>
                        <Text style={[styles.invAmount, isPaid && { color: C.primary }]}>
                            {formatPrice(invoice.amount, invoice.currency)}
                        </Text>

                        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
                            <Text style={[styles.statusText, { color: cfg.color }]}>
                                {t(cfg.label)}
                            </Text>
                        </View>

                        <View style={styles.openHint}>
                            <LucideIcon
                                name={invoice.pdf_url ? 'download-outline' : 'open-outline'}
                                size={12}
                                color={C.accent}
                            />
                        </View>
                    </View>
                </View>
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : INVOICES
═══════════════════════════════════════════════════════════ */

export default function InvoicesScreen({ navigation }: { navigation: Nav }) {
    const { profile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const totalGlow = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })


        // Halo doré pulsant pour la card total
        totalGlow.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const totalGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(totalGlow.value, [0, 1], [0.15, 0.35]),
        transform: [{ scale: interpolate(totalGlow.value, [0, 1], [1, 1.1]) }],
    }))

    const fetchInvoices = useCallback(async () => {
        if (!profile) { setLoading(false); return }
        try {
            const res = await fetchWithTimeout(
                `${API_BASE}/api/mobile/invoices`,
                { timeoutMs: 10000, headers: { ...(await authHeaders()) } }
            )
            const data = await res.json().catch(() => ({}))
            setInvoices(data.invoices || [])
        } catch {
            setInvoices([])
        } finally {
            setLoading(false)
        }
    }, [profile])

    useEffect(() => { fetchInvoices() }, [fetchInvoices])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchInvoices()
        setRefreshing(false)
    }

    const formatPrice = (n: number, c: string) => {
        if (c === 'XOF' || c === 'XAF') return `${n.toLocaleString('fr-FR')} FCFA`
        if (c === 'EUR') return `${n.toLocaleString('fr-FR')} €`
        return `${n} ${c}`
    }

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
    })

    const openInvoice = (inv: Invoice) => {
        const url = inv.pdf_url || `${API_BASE}/api/invoices/${inv.id}`
        Linking.openURL(url).catch(() => {
            toast(t('Erreur'), t("Impossible d'ouvrir la facture."))
        })
    }

    /* ── Stats financières calculées ── */
    const stats = useMemo(() => {
        const total = invoices.reduce((acc, inv) => acc + inv.amount, 0)
        const paid = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount, 0)
        const pending = invoices.filter(i => i.status === 'pending').reduce((a, i) => a + i.amount, 0)
        const currency = invoices[0]?.currency || 'XOF'
        return {
            total,
            paid,
            pending,
            currency,
            countPaid: invoices.filter(i => i.status === 'paid').length,
            countPending: invoices.filter(i => i.status === 'pending').length,
        }
    }, [invoices])

    const filteredInvoices = useMemo(() => {
        if (filter === 'all') return invoices
        return invoices.filter(inv => inv.status === filter)
    }, [invoices, filter])

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

                {!loading && invoices.length > 0 && (
                    <View style={styles.navCounter}>
                        <LucideIcon name="receipt" size={12} color={C.accent} />
                        <Text style={styles.navCounterText}>
                            {invoices.length} {invoices.length > 1 ? t('factures') : t('facture')}
                        </Text>
                    </View>
                )}
            </View>

            <FlatList
                data={loading || invoices.length === 0 ? [] : filteredInvoices}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => (
                    <View style={styles.listWrap}>
                        <InvoiceCard
                            invoice={item}
                            index={index}
                            onPress={() => openInvoice(item)}
                            t={t}
                            formatPrice={formatPrice}
                            formatDate={formatDate}
                        />
                    </View>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.primary}
                    />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.centerState}>
                            <ActivityIndicator color={C.primary} size="large" />
                            <Text style={styles.loadingText}>{t('Chargement de vos factures...')}</Text>
                        </View>
                    ) : invoices.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconWrap}>
                                <LucideIcon name="receipt-outline" size={42} color={C.accent} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {t('Aucune facture')}
                            </Text>
                            <Text style={styles.emptyText}>
                                {t('Vos factures apparaîtront ici après chaque commande ou prestation payée.')}
                            </Text>

                            <View style={styles.emptyDecorator}>
                                <View style={styles.emptyDot} />
                                <View style={styles.emptyLine} />
                                <View style={[styles.emptyDot, { backgroundColor: C.accent }]} />
                                <View style={styles.emptyLine} />
                                <View style={styles.emptyDot} />
                            </View>

                            <Text style={styles.emptyHint}>
                                {t('Tirez pour rafraîchir')}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.emptyCatWrap}>
                            <View style={styles.emptyCatIcon}>
                                <LucideIcon name="filter-outline" size={28} color={C.textMuted} />
                            </View>
                            <Text style={styles.emptyCatTitle}>
                                {t('Aucune facture')}
                            </Text>
                            <Text style={styles.emptyCatText}>
                                {t('Aucune facture dans cette catégorie.')}
                            </Text>
                            <Pressable
                                onPress={() => setFilter('all')}
                                style={styles.emptyCatBtn}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.emptyCatBtnText}>
                                    {t('Voir toutes')}
                                </Text>
                                <LucideIcon name="arrow-forward" size={13} color={C.accent} />
                            </Pressable>
                        </View>
                    )
                }
                ListHeaderComponent={
                    <>
                        {/* HEADER TITRE */}
                        <Animated.View style={[styles.headerContainer, styleHeader]}>
                            <Text style={styles.title}>{t('Mes factures')}</Text>
                            <Text style={styles.subtitle}>
                                {t('Historique complet de votre facturation Retour Gagnant.')}
                            </Text>
                        </Animated.View>

                        {!loading && invoices.length > 0 && (
                            <>
                                {/* ═══ CARD TOTAL HERO (Bleu massif premium) ═══ */}
                                <AnimatedSection delay={150}>
                                    <View style={styles.totalCard}>
                                        {/* Halo doré pulsant */}
                                        <Animated.View style={[styles.totalGlow, totalGlowStyle]} />

                                        {/* Pattern décoratif */}
                                        <View style={styles.patternDot1} />
                                        <View style={styles.patternDot2} />

                                        <View style={styles.totalBadge}>
                                            <LucideIcon name="wallet-outline" size={11} color={C.accent} />
                                            <Text style={styles.totalBadgeText}>
                                                {t('TOTAL FACTURÉ')}
                                            </Text>
                                        </View>

                                        <Text style={styles.totalAmount}>
                                            {formatPrice(stats.total, stats.currency)}
                                        </Text>

                                        <Text style={styles.totalSub}>
                                            {invoices.length} {invoices.length > 1 ? t('factures émises') : t('facture émise')}
                                        </Text>

                                        <View style={styles.totalDivider} />

                                        {/* Split paid/pending */}
                                        <View style={styles.totalSplit}>
                                            <View style={styles.totalSplitItem}>
                                                <View style={styles.totalSplitDot}>
                                                    <LucideIcon name="checkmark" size={10} color={C.primary} />
                                                </View>
                                                <View>
                                                    <Text style={styles.totalSplitLabel}>{t('Payé')}</Text>
                                                    <Text style={styles.totalSplitValue}>
                                                        {formatPrice(stats.paid, stats.currency)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.totalSplitDivider} />

                                            <View style={styles.totalSplitItem}>
                                                <View style={[styles.totalSplitDot, { backgroundColor: C.accentSoft }]}>
                                                    <LucideIcon name="time-outline" size={10} color={C.accent} />
                                                </View>
                                                <View>
                                                    <Text style={styles.totalSplitLabel}>{t('En attente')}</Text>
                                                    <Text style={styles.totalSplitValue}>
                                                        {formatPrice(stats.pending, stats.currency)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </AnimatedSection>

                                {/* ═══ FILTRES STATUT ═══ */}
                                <AnimatedSection delay={250}>
                                    <View style={styles.filterTitleWrap}>
                                        <Text style={styles.filterTitle}>{t('FILTRER')}</Text>
                                        <View style={styles.filterUnderline} />
                                    </View>

                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.filtersContent}
                                    >
                                        <FilterPill
                                            label={t('Toutes')}
                                            icon="apps-outline"
                                            count={invoices.length}
                                            active={filter === 'all'}
                                            onPress={() => setFilter('all')}
                                        />
                                        <FilterPill
                                            label={t('Payées')}
                                            icon="checkmark-circle"
                                            count={stats.countPaid}
                                            active={filter === 'paid'}
                                            onPress={() => setFilter('paid')}
                                        />
                                        <FilterPill
                                            label={t('En attente')}
                                            icon="time-outline"
                                            count={stats.countPending}
                                            active={filter === 'pending'}
                                            onPress={() => setFilter('pending')}
                                        />
                                    </ScrollView>
                                </AnimatedSection>
                            </>
                        )}
                    </>
                }
                ListFooterComponent={
                    !loading && invoices.length > 0 ? (
                        <AnimatedSection delay={500}>
                            <View style={styles.infoBox}>
                                <View style={styles.infoIconWrap}>
                                    <LucideIcon name="information-circle" size={18} color={C.info} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.infoTitle}>
                                        {t('Téléchargement & partage')}
                                    </Text>
                                    <Text style={styles.infoText}>
                                        {t('Touchez une facture pour la consulter, la télécharger en PDF ou la partager par email.')}
                                    </Text>
                                </View>
                            </View>
                        </AnimatedSection>
                    ) : null
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
    navCounterText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
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
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
            },

    /* ── Loading ── */
    centerState: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        ...typography.label,
        color: C.textSec,
            },

    /* ── Total Card Hero ── */
    totalCard: {
        backgroundColor: C.primary,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    totalGlow: { display: 'none' },
    patternDot1: {
        position: 'absolute',
        top: 70,
        right: 40,
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.accent,
        opacity: 0.3,
    },
    patternDot2: {
        position: 'absolute',
        bottom: 90,
        right: 70,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: C.accent,
        opacity: 0.4,
    },
    totalBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    totalBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.accent,
        letterSpacing: 1.2,
    },
    totalAmount: {
        ...typography.h1, fontSize: 36,
                color: C.primaryText,
        letterSpacing: -1,
    },
    totalSub: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.6)',
                marginTop: spacing.xs,
    },
    totalDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: spacing.md,
    },
    totalSplit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    totalSplitItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    totalSplitDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    totalSplitLabel: {
        ...typography.overline,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: spacing.xxs,
    },
    totalSplitValue: {
        ...typography.button, fontSize: 13,
                color: C.primaryText,
        letterSpacing: -0.2,
    },
    totalSplitDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },

    /* ── Filter title ── */
    filterTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    filterTitle: {
        ...typography.button, fontSize: 12,
                color: C.primary,
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
        marginBottom: spacing.md,
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
        ...typography.button, fontSize: 12,
                letterSpacing: 0.2,
    },
    filterCount: {
        minWidth: 18,
        height: 16,
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

    /* ── List ── */
    listWrap: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },

    /* ── Invoice Card ── */
    invCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        paddingLeft: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
        overflow: 'hidden',
        position: 'relative',
    },
    statusBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    statusIconWrap: {
        width: 46,
        height: 46,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    invInfo: {
        flex: 1,
        gap: spacing.xxs,
    },
    refRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    invRef: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 0.3,
    },
    invDesc: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.2,
        marginTop: spacing.xxs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.xxs,
        flexWrap: 'wrap',
    },
    invDate: {
        ...typography.caption,
        color: C.textMuted,
            },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: C.textMuted,
        marginHorizontal: spacing.xxs,
    },
    emailText: {
        ...typography.button, fontSize: 12,
        color: C.success,
                letterSpacing: 0.2,
    },
    invRight: {
        alignItems: 'flex-end',
        gap: spacing.xs,
        marginLeft: spacing.sm,
    },
    invAmount: {
        ...typography.button,
                color: C.primary,
        letterSpacing: -0.3,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.xs,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    statusText: {
        ...typography.button, fontSize: 12,
                letterSpacing: 0.3,
    },
    openHint: {
        width: 24,
        height: 24,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },

    /* ── Empty Card ── */
    emptyCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
        marginTop: spacing.gutter,
    },
    emptyIconWrap: {
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
    emptyTitle: {
        ...typography.h3, fontSize: 18,
                color: C.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: -0.3,
    },
    emptyText: {
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
        marginBottom: spacing.md,
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
        color: C.primary,
        ...typography.button, fontSize: 12,
                letterSpacing: 0.2,
    },

    /* ── Info Box ── */
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    infoIconWrap: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        ...typography.button, fontSize: 13,
                color: C.info,
        letterSpacing: -0.1,
        marginBottom: spacing.xxs,
    },
    infoText: {
        ...typography.caption,
        color: C.textSec,
    },
})