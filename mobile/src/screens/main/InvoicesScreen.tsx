'use strict'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, Linking, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
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
    icon: keyof typeof Ionicons.glyphMap
}> = {
    paid: {
        label: 'Payée',
        color: C.success,
        bg: 'rgba(10, 107, 59, 0.10)',
        icon: 'checkmark-circle',
    },
    pending: {
        label: 'En attente',
        color: C.warning,
        bg: 'rgba(212, 160, 23, 0.10)',
        icon: 'time-outline',
    },
    cancelled: {
        label: 'Annulée',
        color: C.error,
        bg: 'rgba(163, 34, 0, 0.08)',
        icon: 'close-circle-outline',
    },
    refunded: {
        label: 'Remboursée',
        color: C.info,
        bg: 'rgba(59, 130, 196, 0.10)',
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
    icon: keyof typeof Ionicons.glyphMap
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
                <Ionicons
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
                        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                    </View>

                    {/* Contenu */}
                    <View style={styles.invInfo}>
                        <View style={styles.refRow}>
                            <Ionicons name="receipt-outline" size={11} color={C.accentDark} />
                            <Text style={styles.invRef}>{invoice.invoice_ref}</Text>
                        </View>

                        <Text style={styles.invDesc} numberOfLines={1}>
                            {t(invoice.description || 'Facture')}
                        </Text>

                        <View style={styles.metaRow}>
                            <Ionicons name="calendar-outline" size={10} color={C.textMuted} />
                            <Text style={styles.invDate}>{formatDate(invoice.issued_at)}</Text>

                            {invoice.sent_to_email && (
                                <>
                                    <View style={styles.metaDot} />
                                    <Ionicons name="mail-outline" size={10} color={C.success} />
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
                            <Ionicons
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
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                {!loading && invoices.length > 0 && (
                    <View style={styles.navCounter}>
                        <Ionicons name="receipt" size={12} color={C.accent} />
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
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
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
                                <Ionicons name="receipt-outline" size={42} color={C.accent} />
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
                                <Ionicons name="filter-outline" size={28} color={C.textMuted} />
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
                                <Ionicons name="arrow-forward" size={13} color={C.accent} />
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
                                            <Ionicons name="wallet-outline" size={11} color={C.accent} />
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
                                                    <Ionicons name="checkmark" size={10} color={C.primary} />
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
                                                <View style={[styles.totalSplitDot, { backgroundColor: 'rgba(212,160,23,0.25)' }]}>
                                                    <Ionicons name="time-outline" size={10} color={C.accent} />
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
                                    <Ionicons name="information-circle" size={18} color={C.info} />
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
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
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
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Loading ── */
    centerState: {
        paddingVertical: 60,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '500',
    },

    /* ── Total Card Hero ── */
    totalCard: {
        backgroundColor: C.primary,
        borderRadius: 22,
        padding: 24,
        marginBottom: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.4)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    totalGlow: {
        position: 'absolute',
        top: -80,
        right: -80,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: C.accent,
    },
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
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.18)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.4)',
        marginBottom: 14,
    },
    totalBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.2,
    },
    totalAmount: {
        fontSize: 36,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: -1,
        lineHeight: 40,
    },
    totalSub: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
        marginTop: 4,
    },
    totalDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 18,
    },
    totalSplit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    totalSplitItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    totalSplitDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(10, 107, 59, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(10, 107, 59, 0.4)',
    },
    totalSplitLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    totalSplitValue: {
        fontSize: 13,
        fontWeight: '800',
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
        marginBottom: 10,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    filterTitle: {
        fontSize: 12,
        fontWeight: '800',
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
        gap: 8,
        paddingRight: 20,
        paddingVertical: 4,
        marginBottom: 18,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1.2,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    filterCount: {
        minWidth: 18,
        height: 16,
        paddingHorizontal: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(13, 43, 78, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterCountActive: {
        backgroundColor: C.accent,
    },
    filterCountText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.textSec,
    },
    filterCountTextActive: {
        color: C.primary,
    },

    /* ── List ── */
    listWrap: {
        gap: 10,
        marginBottom: 18,
    },

    /* ── Invoice Card ── */
    invCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 14,
        paddingLeft: 18,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
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
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    invInfo: {
        flex: 1,
        gap: 3,
    },
    refRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    invRef: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 0.3,
    },
    invDesc: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.2,
        marginTop: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
        flexWrap: 'wrap',
    },
    invDate: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: C.textMuted,
        marginHorizontal: 3,
    },
    emailText: {
        fontSize: 12,
        color: C.success,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    invRight: {
        alignItems: 'flex-end',
        gap: 6,
        marginLeft: 10,
    },
    invAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    openHint: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },

    /* ── Empty Card ── */
    emptyCard: {
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        marginTop: 20,
    },
    emptyIconWrap: {
        width: 88,
        height: 88,
        borderRadius: 24,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1.2,
        borderColor: 'rgba(212, 160, 23, 0.2)',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: C.primary,
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.3,
    },
    emptyText: {
        fontSize: 13,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 22,
        fontWeight: '400',
        paddingHorizontal: 4,
    },
    emptyDecorator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
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
        paddingHorizontal: 20,
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        borderStyle: 'dashed',
        gap: 10,
        marginBottom: 18,
    },
    emptyCatIcon: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: 'rgba(100, 116, 139, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    emptyCatTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
    },
    emptyCatText: {
        fontSize: 12,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 17,
        marginBottom: 10,
        fontWeight: '400',
    },
    emptyCatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.3)',
    },
    emptyCatBtnText: {
        color: C.accentDark,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Info Box ── */
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(59, 130, 196, 0.07)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 196, 0.18)',
    },
    infoIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 196, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: C.info,
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    infoText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 16,
    },
})