'use strict'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, TextInput, Dimensions, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { LucideIcon } from '../../components/Icon'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    withSpring,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { useVideoPlayer, VideoView } from 'expo-video'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* ═══════════════════════════════════════════════════════════
   OrdersScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec tous les écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'Orders'>

export interface OrderListItem {
    id: string
    amount: number
    currency: string
    payment_status: string
    transaction_id: string | null
    cart_items: Array<{ title: string; quantity: number }> | null
    product_title: string | null
    source: string | null
    tracking_code: string | null
    tracking_carrier: string | null
    shipping_status: string | null
    shipped_at: string | null
    delivered_at: string | null
    created_at: string
}

const SHIPPING_CONFIG: Record<string, {
    label: string
    icon: string
    color: string
    bgRgba: string
    borderRgba: string
}> = {
    pending: { label: 'En attente', icon: 'time-outline', color: C.textSec, bgRgba: C.surfaceAlt, borderRgba: C.border },
    preparing: { label: 'En préparation', icon: 'cube-outline', color: C.primary, bgRgba: C.accentSoft, borderRgba: C.border },
    shipped: { label: 'Expédié', icon: 'paper-plane-outline', color: C.info, bgRgba: C.surfaceSoft, borderRgba: C.border },
    in_transit: { label: 'En transit', icon: 'car-outline', color: C.primary, bgRgba: C.surfaceSoft, borderRgba: C.border },
    delivered: { label: 'Livré', icon: 'checkmark-done', color: C.success, bgRgba: C.surfaceSoft, borderRgba: C.border },
    failed: { label: 'Échec', icon: 'close-circle-outline', color: C.error, bgRgba: C.dangerSoft, borderRgba: C.danger },
    returned: { label: 'Retourné', icon: 'arrow-undo-outline', color: C.error, bgRgba: C.dangerSoft, borderRgba: C.danger },
}

type FilterKey = 'all' | 'active' | 'delivered'

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
   COMPOSANT : HERO VIDÉO PREMIUM
═══════════════════════════════════════════════════════════ */
function DeliveryHero({ ordersCount, activeCount }: { ordersCount: number; activeCount: number }) {
    const scale = useSharedValue(1)
    const dotPulse = useSharedValue(0)

    useEffect(() => {
        scale.value = withTiming(1, { duration: 600 })
        dotPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const videoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }))
    const dotStyle = useAnimatedStyle(() => ({
        opacity: interpolate(dotPulse.value, [0, 1], [0.4, 1]),
        transform: [{ scale: interpolate(dotPulse.value, [0, 1], [0.85, 1.15]) }],
    }))

    /* expo-av a été RETIRÉ du SDK 56 ; expo-video est son remplaçant.
       Lecture en boucle et muette, portée par le lecteur au lieu des
       anciennes propriétés du composant. */
    const player = useVideoPlayer(
        require('../../../assets/images/delivery_video.mp4'),
        (p) => { p.loop = true; p.muted = true; p.play() },
    )

    return (
        <View style={styles.hero}>
            {/* Video animée */}
            <Animated.View style={[StyleSheet.absoluteFill, videoStyle]}>
                <VideoView
                    player={player}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    nativeControls={false}
                    accessible={false}
                />
            </Animated.View>

            {/* Overlay gradient sombre → fond app */}
            <View style={styles.heroOverlay} />
            <View style={styles.heroOverlayBottom} />

            {/* Contenu hero */}
            <View style={styles.heroContent}>
                {/* Badge LIVE en haut */}
                <View style={styles.heroBadge}>
                    <Animated.View style={[styles.heroBadgeDot, dotStyle]} />
                    <Text style={styles.heroBadgeText}>{ordersCount > 0 ? `${ordersCount} COMMANDE${ordersCount > 1 ? 'S' : ''}` : 'AUCUNE COMMANDE'}</Text>
                </View>

                {/* Stats overlay */}
                {ordersCount > 0 && (
                    <View style={styles.heroStats}>
                        <View style={styles.heroStat}>
                            <Text style={styles.heroStatValue}>{ordersCount}</Text>
                            <Text style={styles.heroStatLabel}>TOTAL</Text>
                        </View>
                        <View style={styles.heroStatDivider} />
                        <View style={styles.heroStat}>
                            <Text style={[styles.heroStatValue, { color: C.accent }]}>{activeCount}</Text>
                            <Text style={styles.heroStatLabel}>EN COURS</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ORDER CARD PREMIUM
═══════════════════════════════════════════════════════════ */
function OrderCard({
    order, onPress, formatPrice, formatDate, t, delay,
}: {
    order: OrderListItem
    onPress: () => void
    formatPrice: (n: number, c: string) => string
    formatDate: (iso: string) => string
    t: (k: string, p?: any) => string
    delay: number
}) {
    const cfg = SHIPPING_CONFIG[order.shipping_status || 'pending']
    const entryAnim = useSharedValue(0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        entryAnim.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }))
    }, [delay])

    const entryStyle = useAnimatedStyle(() => ({
        opacity: entryAnim.value,
        transform: [{ translateY: 20 * (1 - entryAnim.value) }],
    }))

    const pressStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pressAnim.value, [0, 1], [1, 0.98]) }],
    }))

    const itemsCount = order.cart_items?.reduce((s, i) => s + (i.quantity || 0), 0) || 1
    const firstTitle = order.cart_items?.[0]?.title || order.product_title || t('Commande')
    const moreCount = (order.cart_items?.length || 1) - 1
    const shortRef = order.id.slice(0, 8).toUpperCase()

    return (
        <Animated.View style={entryStyle}>
            <Pressable
                onPress={onPress}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <Animated.View style={[styles.orderCard, pressStyle]}>
                    {/* Bordure colorée gauche */}
                    <View style={[styles.orderCardBar, { backgroundColor: cfg.color }]} />

                    <View style={styles.orderCardBody}>
                        {/* Top row : Réf + Date + Status */}
                        <View style={styles.orderTopRow}>
                            <View style={styles.orderRefBlock}>
                                <Text style={styles.orderRefLabel}>{t('COMMANDE')}</Text>
                                <Text style={styles.orderRef}>#{shortRef}</Text>
                            </View>
                            <View style={[styles.orderStatusPill, { backgroundColor: cfg.bgRgba, borderColor: cfg.borderRgba }]}>
                                <LucideIcon name={cfg.icon} size={11} color={cfg.color} />
                                <Text style={[styles.orderStatusText, { color: cfg.color }]}>
                                    {t(cfg.label)}
                                </Text>
                            </View>
                        </View>

                        {/* Title */}
                        <Text style={styles.orderTitle} numberOfLines={2}>
                            {firstTitle}
                            {moreCount > 0 && (
                                <Text style={styles.orderTitleMore}>
                                    {' '}{t('+ {n} autre(s)', { n: moreCount })}
                                </Text>
                            )}
                        </Text>

                        {/* Meta line */}
                        <View style={styles.orderMetaRow}>
                            <View style={styles.orderMetaItem}>
                                <LucideIcon name="cube-outline" size={11} color={C.textMuted} />
                                <Text style={styles.orderMetaText}>
                                    {itemsCount} {itemsCount > 1 ? t('articles') : t('article')}
                                </Text>
                            </View>
                            <View style={styles.orderMetaDot} />
                            <View style={styles.orderMetaItem}>
                                <LucideIcon name="calendar-outline" size={11} color={C.textMuted} />
                                <Text style={styles.orderMetaText}>{formatDate(order.created_at)}</Text>
                            </View>
                        </View>

                        {/* Tracking code (si présent) */}
                        {order.tracking_code ? (
                            <View style={styles.orderTrackingRow}>
                                <View style={styles.orderTrackingIcon}>
                                    <LucideIcon name="paper-plane" size={10} color={C.accent} />
                                </View>
                                <Text style={styles.orderTrackingText} numberOfLines={1}>
                                    {order.tracking_code}
                                </Text>
                                {order.tracking_carrier && (
                                    <>
                                        <View style={styles.orderTrackingSep} />
                                        <Text style={styles.orderTrackingCarrier} numberOfLines={1}>
                                            {order.tracking_carrier}
                                        </Text>
                                    </>
                                )}
                            </View>
                        ) : null}

                        {/* Footer : Amount + chevron */}
                        <View style={styles.orderFooter}>
                            <View>
                                <Text style={styles.orderAmountLabel}>{t('MONTANT')}</Text>
                                <Text style={styles.orderAmount}>{formatPrice(order.amount, order.currency)}</Text>
                            </View>
                            <View style={styles.orderArrow}>
                                <LucideIcon name="arrow-forward" size={16} color={C.accent} />
                            </View>
                        </View>
                    </View>
                </Animated.View>
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function OrdersScreen({ navigation }: { navigation: Nav }) {
    const { profile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [orders, setOrders] = useState<OrderListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [searchCode, setSearchCode] = useState('')
    const [searching, setSearching] = useState(false)
    const [searchFocused, setSearchFocused] = useState(false)
    const [filter, setFilter] = useState<FilterKey>('all')

    /* ── Animations Corporate ── */
    const searchFocusAnim = useSharedValue(0)

    useEffect(() => {
    }, [])

    useEffect(() => {
        searchFocusAnim.value = withSpring(searchFocused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [searchFocused])

    const searchInputStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(searchFocusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: searchFocused ? C.surfaceSolid : C.surface,
    }))

    const fetchOrders = useCallback(async () => {
        if (!profile) { setLoading(false); return }
        try {
            const res = await fetchWithTimeout(
                `${API_BASE}/api/mobile/orders`,
                { timeoutMs: 10000, headers: { ...(await authHeaders()) } }
            )
            const data = await res.json().catch(() => ({}))
            setOrders(data.orders || [])
        } catch {
            setOrders([])
        } finally {
            setLoading(false)
        }
    }, [profile])

    useEffect(() => { fetchOrders() }, [fetchOrders])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchOrders()
        setRefreshing(false)
    }

    const handleTrackingSearch = async () => {
        const code = searchCode.trim().toUpperCase()
        if (!code) {
            toast(t('Code requis'), t('Veuillez entrer un code de suivi.'))
            return
        }
        setSearching(true)
        try {
            const res = await fetchWithTimeout(
                `${API_BASE}/api/mobile/orders?tracking=${encodeURIComponent(code)}`,
                { timeoutMs: 10000 }
            )
            const data = await res.json().catch(() => ({}))
            if (data.found && data.order) {
                setSearchCode('')
                navigation.navigate('OrderDetail', { orderId: data.order.id, trackingCode: code })
            } else {
                toast(t('Aucune commande'), t('Aucune commande trouvée avec ce code de suivi.'))
            }
        } catch {
            toast(t('Erreur'), t('Impossible de rechercher pour le moment.'))
        } finally {
            setSearching(false)
        }
    }

    const formatPrice = (n: number, c: string) => {
        if (c === 'XOF' || c === 'XAF') return `${n.toLocaleString('fr-FR')} FCFA`
        if (c === 'EUR') return `${n.toLocaleString('fr-FR')} €`
        return `${n} ${c}`
    }

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
    })

    /* ── Filtres dérivés ── */
    const activeStatuses = ['pending', 'preparing', 'shipped', 'in_transit']
    const activeCount = orders.filter(o => activeStatuses.includes(o.shipping_status || 'pending')).length
    const deliveredCount = orders.filter(o => o.shipping_status === 'delivered').length

    const filteredOrders = useMemo(() => {
        if (filter === 'active') return orders.filter(o => activeStatuses.includes(o.shipping_status || 'pending'))
        if (filter === 'delivered') return orders.filter(o => o.shipping_status === 'delivered')
        return orders
    }, [filter, orders])

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
                    <LucideIcon name="cube" size={12} color={C.accent} />
                    <Text style={styles.navCounterText}>{t('Mes commandes')}</Text>
                </View>

                <Pressable
                    onPress={() => navigation.navigate('Boutique' as any)}
                    style={styles.navBack}
                    accessibilityRole="button"
                    accessibilityLabel={t('Ouvrir la boutique')}
                    hitSlop={6}
                >
                    <View style={styles.iconContainer}>
                        <LucideIcon name="storefront-outline" size={20} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            <FlatList
                data={loading ? [] : filteredOrders}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => (
                    <OrderCard
                        order={item}
                        onPress={() => { Haptics.selectionAsync(); navigation.navigate('OrderDetail', { orderId: item.id }) }}
                        formatPrice={formatPrice}
                        formatDate={formatDate}
                        t={t}
                        delay={Math.min(index, 8) * 45}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
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
                            <Text style={styles.loadingText}>{t('Récupération de vos commandes…')}</Text>
                        </View>
                    ) : orders.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyHero}>
                                <View style={styles.emptyHeroGlow} />
                                <View style={styles.emptyIconWrap}>
                                    <LucideIcon name="bag-outline" size={36} color={C.accent} />
                                </View>
                            </View>
                            <Text style={styles.emptyTitle}>{t('Aucune commande')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Vos commandes apparaîtront ici. Découvrez notre boutique culturelle et artisanale.')}
                            </Text>
                            <TouchableOpacity
                                style={styles.shopBtn}
                                onPress={() => navigation.navigate('Boutique' as any)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <LucideIcon name="storefront" size={16} color={C.accent} style={{ marginRight: 8 }} />
                                <Text style={styles.shopBtnText}>{t('Visiter la boutique')}</Text>
                                <LucideIcon name="arrow-forward" size={16} color={C.accent} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyFilterState}>
                            <View style={styles.emptyFilterIcon}>
                                <LucideIcon name="filter-outline" size={28} color={C.textSec} />
                            </View>
                            <Text style={styles.emptyFilterTitle}>{t('Aucun résultat')}</Text>
                            <Text style={styles.emptyFilterText}>
                                {t("Aucune commande ne correspond à ce filtre.")}
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    orders.length > 0 ? (
                        <View style={styles.footerInfo}>
                            <View style={styles.footerDivider}>
                                <View style={styles.dividerLine} />
                                <View style={styles.dividerDot} />
                                <View style={styles.dividerLine} />
                            </View>
                            <Text style={styles.footerText}>
                                {t('Tirez vers le bas pour rafraîchir.')}
                            </Text>
                        </View>
                    ) : null
                }
                ListHeaderComponent={
                    <>
                {/* HEADER TITRE */}
                <AnimatedSection delay={0}>
                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>{t('Mes commandes')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Suivez vos colis en temps réel et consultez votre historique.')}
                        </Text>
                    </View>
                </AnimatedSection>

                {/* ═══ HERO VIDÉO PREMIUM ═══ */}
                <AnimatedSection delay={100}>
                    <View style={styles.heroWrap}>
                        <DeliveryHero ordersCount={orders.length} activeCount={activeCount} />
                    </View>
                </AnimatedSection>

                {/* ═══ TRACKING SEARCH CARD ═══ */}
                <AnimatedSection delay={200}>
                    <View style={styles.searchCard}>
                        <View style={styles.searchHeader}>
                            <View style={styles.searchHeaderIcon}>
                                <LucideIcon name="paper-plane" size={14} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.searchHeaderBadge}>{t('SUIVI RAPIDE')}</Text>
                                <Text style={styles.searchHeaderTitle}>{t('Tracker un colis')}</Text>
                            </View>
                        </View>

                        <View style={styles.searchInputRow}>
                            <Animated.View style={[styles.searchInputWrap, searchInputStyle]}>
                                <LucideIcon
                                    name="barcode-outline"
                                    size={18}
                                    color={searchFocused ? C.accent : C.placeholder}
                                    style={styles.searchInputIcon}
                                />
                                <TextInput
                                    style={styles.searchInput}
                                    value={searchCode}
                                    onChangeText={setSearchCode}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                    placeholder={t('Code de suivi (ex: RGB12345)')}
                                    placeholderTextColor={C.placeholder}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    selectionColor={C.accent}
                                />
                            </Animated.View>
                            <TouchableOpacity
                                style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
                                onPress={handleTrackingSearch}
                                disabled={searching}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                hitSlop={6}
                                accessibilityLabel={t('Rechercher')}
                            >
                                {searching ? (
                                    <ActivityIndicator color={C.primaryText} size="small" />
                                ) : (
                                    <LucideIcon name="search" size={20} color={C.primaryText} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ FILTRES PAR STATUT ═══ */}
                {orders.length > 0 && (
                    <AnimatedSection delay={300}>
                        <View style={styles.filtersHeader}>
                            <Text style={styles.filtersTitle}>{t('HISTORIQUE')}</Text>
                            <View style={styles.filtersLine} />
                        </View>

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterPillsRow}
                        >
                            <FilterPill
                                label={t('Toutes')}
                                count={orders.length}
                                icon="list"
                                active={filter === 'all'}
                                onPress={() => setFilter('all')}
                            />
                            <FilterPill
                                label={t('En cours')}
                                count={activeCount}
                                icon="time-outline"
                                active={filter === 'active'}
                                onPress={() => setFilter('active')}
                                color={C.primary}
                            />
                            <FilterPill
                                label={t('Livrées')}
                                count={deliveredCount}
                                icon="checkmark-done"
                                active={filter === 'delivered'}
                                onPress={() => setFilter('delivered')}
                                color={C.success}
                            />
                        </ScrollView>
                    </AnimatedSection>
                )}

                    </>
                }
            />
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FILTER PILL
═══════════════════════════════════════════════════════════ */
function FilterPill({
    label, count, icon, active, onPress, color,
}: {
    label: string
    count: number
    icon: string
    active: boolean
    onPress: () => void
    color?: string
}) {
    const anim = useSharedValue(active ? 1 : 0)
    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [active])

    const pillStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(anim.value, [0, 1], [C.surface, C.primary]),
        borderColor: interpolateColor(anim.value, [0, 1], [C.border, C.primary]),
    }))

    const useColor = color || C.accent

    return (
        <Pressable onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.filterPill, pillStyle]}>
                <LucideIcon
                    name={icon}
                    size={13}
                    color={active ? useColor : C.textSec}
                />
                <Text style={[styles.filterPillText, { color: active ? C.primaryText : C.textSec }]}>
                    {label}
                </Text>
                <View style={[
                    styles.filterPillCount,
                    active && { backgroundColor: C.accentSoft },
                ]}>
                    <Text style={[
                        styles.filterPillCountText,
                        { color: active ? useColor : C.primary },
                    ]}>
                        {count}
                    </Text>
                </View>
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
    navBack: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
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

    /* ── Scroll ── */
    scroll: {
        paddingBottom: spacing.xl,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.bodySmall,
        color: C.textSec,
        marginTop: 12,
            },

    /* ── Hero Video ── */
    heroWrap: {
        marginHorizontal: spacing.gutter,
        marginBottom: spacing.sm,
        borderRadius: radius.xxl,
        overflow: 'hidden',
        ...shadows.card,
    },
    hero: {
        height: 200,
        position: 'relative',
        borderRadius: radius.xxl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
    },
    heroOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: C.surfaceAlt,
    },
    heroOverlayBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 130,
        backgroundColor: C.surfaceAlt,
    },
    heroContent: {
        ...StyleSheet.absoluteFill,
        padding: spacing.md,
        justifyContent: 'space-between',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    heroBadgeDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: C.accent,
    },
    heroBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.accent,
        letterSpacing: 1.3,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        alignSelf: 'flex-start',
    },
    heroStat: {
        alignItems: 'flex-start',
    },
    heroStatValue: {
        ...typography.h1, fontSize: 32,
                color: C.primaryText,
        letterSpacing: -1,
    },
    heroStatLabel: {
        ...typography.button, fontSize: 12,
                color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 1.5,
        marginTop: spacing.xxs,
    },
    heroStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    /* ── Search Card ── */
    searchCard: {
        marginHorizontal: spacing.gutter,
        marginTop: spacing.md,
        marginBottom: spacing.gutter,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.md,
    },
    searchHeaderIcon: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    searchHeaderBadge: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1.3,
        marginBottom: spacing.xxs,
    },
    searchHeaderTitle: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.2,
    },
    searchInputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'center',
    },
    searchInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
    },
    searchInputIcon: {
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        ...typography.bodySmall,
        color: C.primary,
                letterSpacing: 0.5,
        paddingVertical: 0,
    },
    searchBtn: {
        width: 50,
        height: 50,
        borderRadius: radius.md,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    searchBtnDisabled: {
        backgroundColor: C.borderStrong,
        borderColor: 'transparent',
    },

    /* ── Filters ── */
    filtersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        paddingHorizontal: spacing.lg,
    },
    filtersTitle: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1.5,
    },
    filtersLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    filterPillsRow: {
        paddingHorizontal: spacing.gutter,
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
    },
    filterPillText: {
        ...typography.button, fontSize: 12.5,
                letterSpacing: 0.2,
    },
    filterPillCount: {
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        minWidth: 22,
        alignItems: 'center',
    },
    filterPillCountText: {
        ...typography.button, fontSize: 12,
            },

    /* ── List ── */
    list: {
        paddingHorizontal: spacing.gutter,
        gap: 12,
    },

    /* ── Order Card ── */
    orderCard: {
        flexDirection: 'row',
        backgroundColor: C.surfaceSolid,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    orderCardBar: {
        width: 4,
    },
    orderCardBody: {
        flex: 1,
        padding: spacing.md,
    },
    orderTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    orderRefBlock: {},
    orderRefLabel: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1.3,
        marginBottom: spacing.xxs,
    },
    orderRef: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: 0.5,
    },
    orderStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    orderStatusText: {
        ...typography.button, fontSize: 12,
                letterSpacing: 0.3,
    },
    orderTitle: {
        ...typography.button, fontSize: 14.5,
                color: C.primary,
        letterSpacing: -0.2,
        marginBottom: spacing.xs,
    },
    orderTitleMore: {
        color: C.textSec,
        fontFamily: fonts.medium,
    },
    orderMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    orderMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    orderMetaText: {
        ...typography.caption,
        color: C.textMuted,
            },
    orderMetaDot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: C.border,
    },

    /* ── Tracking ligne ── */
    orderTrackingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.accentSoft,
        borderRadius: radius.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.sm,
    },
    orderTrackingIcon: {
        width: 20,
        height: 20,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderTrackingText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 0.5,
    },
    orderTrackingSep: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: C.accentLight,
    },
    orderTrackingCarrier: {
        ...typography.caption,
        color: C.primary,
                flex: 1,
    },

    /* ── Order Footer ── */
    orderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    orderAmountLabel: {
        ...typography.button, fontSize: 12,
                color: C.textMuted,
        letterSpacing: 1.2,
        marginBottom: spacing.xxs,
    },
    orderAmount: {
        ...typography.h3, fontSize: 16,
                color: C.accent,
        letterSpacing: -0.3,
    },
    orderArrow: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
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
        borderWidth: 1,
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
                textAlign: 'center',
    },

    /* ── Empty State ── */
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: 28,
        marginHorizontal: spacing.gutter,
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
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
        borderWidth: 1,
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
                marginBottom: spacing.gutter,
    },
    shopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        paddingHorizontal: spacing.gutter,
        backgroundColor: C.primary,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    shopBtnText: {
        color: C.primaryText,
        ...typography.button, fontSize: 13.5,
                letterSpacing: 0.2,
    },

    /* ── Empty Filter ── */
    emptyFilterState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: spacing.xl,
        marginHorizontal: spacing.gutter,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
    },
    emptyFilterIcon: {
        width: 60,
        height: 60,
        borderRadius: radius.xl,
        backgroundColor: C.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
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