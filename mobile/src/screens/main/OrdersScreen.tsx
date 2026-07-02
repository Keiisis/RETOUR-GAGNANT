'use strict'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, TextInput, Alert,
    Dimensions, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
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
import { Video, ResizeMode } from 'expo-av'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* ═══════════════════════════════════════════════════════════
   OrdersScreen — THEME "CORPORATE PREMIUM 2026"
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
    warning: '#D97706',

    textSec: '#64748B',
    textMuted: '#94A3B8',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

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
    icon: keyof typeof Ionicons.glyphMap
    color: string
    bgRgba: string
    borderRgba: string
}> = {
    pending: { label: 'En attente', icon: 'time-outline', color: C.textSec, bgRgba: 'rgba(100, 116, 139, 0.08)', borderRgba: 'rgba(100, 116, 139, 0.18)' },
    preparing: { label: 'En préparation', icon: 'cube-outline', color: C.warning, bgRgba: 'rgba(217, 119, 6, 0.10)', borderRgba: 'rgba(217, 119, 6, 0.25)' },
    shipped: { label: 'Expédié', icon: 'paper-plane-outline', color: C.info, bgRgba: 'rgba(59, 130, 196, 0.10)', borderRgba: 'rgba(59, 130, 196, 0.25)' },
    in_transit: { label: 'En transit', icon: 'car-outline', color: C.primary, bgRgba: 'rgba(13, 43, 78, 0.08)', borderRgba: 'rgba(13, 43, 78, 0.18)' },
    delivered: { label: 'Livré', icon: 'checkmark-done', color: C.success, bgRgba: 'rgba(10, 107, 59, 0.10)', borderRgba: 'rgba(10, 107, 59, 0.25)' },
    failed: { label: 'Échec', icon: 'close-circle-outline', color: C.error, bgRgba: 'rgba(163, 34, 0, 0.08)', borderRgba: 'rgba(163, 34, 0, 0.25)' },
    returned: { label: 'Retourné', icon: 'arrow-undo-outline', color: C.error, bgRgba: 'rgba(163, 34, 0, 0.08)', borderRgba: 'rgba(163, 34, 0, 0.25)' },
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
        scale.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, false,
        )
        dotPulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
    }, [])

    const videoStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }))
    const dotStyle = useAnimatedStyle(() => ({
        opacity: interpolate(dotPulse.value, [0, 1], [0.4, 1]),
        transform: [{ scale: interpolate(dotPulse.value, [0, 1], [0.85, 1.15]) }],
    }))

    return (
        <View style={styles.hero}>
            {/* Video animée */}
            <Animated.View style={[StyleSheet.absoluteFillObject, videoStyle]}>
                <Video
                    source={require('../../../assets/images/delivery_video.mp4')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
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
                                <Ionicons name={cfg.icon} size={11} color={cfg.color} />
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
                                <Ionicons name="cube-outline" size={11} color={C.textMuted} />
                                <Text style={styles.orderMetaText}>
                                    {itemsCount} {itemsCount > 1 ? t('articles') : t('article')}
                                </Text>
                            </View>
                            <View style={styles.orderMetaDot} />
                            <View style={styles.orderMetaItem}>
                                <Ionicons name="calendar-outline" size={11} color={C.textMuted} />
                                <Text style={styles.orderMetaText}>{formatDate(order.created_at)}</Text>
                            </View>
                        </View>

                        {/* Tracking code (si présent) */}
                        {order.tracking_code ? (
                            <View style={styles.orderTrackingRow}>
                                <View style={styles.orderTrackingIcon}>
                                    <Ionicons name="paper-plane" size={10} color={C.accent} />
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
                                <Ionicons name="arrow-forward" size={16} color={C.accent} />
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
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)
    const searchFocusAnim = useSharedValue(0)

    useEffect(() => {
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
    }, [])

    useEffect(() => {
        searchFocusAnim.value = withSpring(searchFocused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [searchFocused])

    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))
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
            Alert.alert(t('Code requis'), t('Veuillez entrer un code de suivi.'))
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
                Alert.alert(t('Aucune commande'), t('Aucune commande trouvée avec ce code de suivi.'))
            }
        } catch {
            Alert.alert(t('Erreur'), t('Impossible de rechercher pour le moment.'))
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
                    <Ionicons name="cube" size={12} color={C.accent} />
                    <Text style={styles.navCounterText}>{t('Mes commandes')}</Text>
                </View>

                <Pressable
                    onPress={() => navigation.navigate('Boutique' as any)}
                    style={styles.navBack}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="storefront-outline" size={20} color={C.primary} />
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
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 80 }]}
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
                                    <Ionicons name="bag-outline" size={36} color={C.accent} />
                                </View>
                                <View style={styles.emptyHeroBadge}>
                                    <Ionicons name="sparkles" size={10} color={C.accent} />
                                    <Text style={styles.emptyHeroBadgeText}>{t('DÉCOUVRIR')}</Text>
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
                            >
                                <Ionicons name="storefront" size={16} color={C.accent} style={{ marginRight: 8 }} />
                                <Text style={styles.shopBtnText}>{t('Visiter la boutique')}</Text>
                                <Ionicons name="arrow-forward" size={16} color={C.accent} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.emptyFilterState}>
                            <View style={styles.emptyFilterIcon}>
                                <Ionicons name="filter-outline" size={28} color={C.textSec} />
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
                        <Text style={styles.title}>{t('Vos')}</Text>
                        <Text style={styles.titleHighlight}>{t('commandes.')}</Text>
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
                                <Ionicons name="paper-plane" size={14} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.searchHeaderBadge}>{t('SUIVI RAPIDE')}</Text>
                                <Text style={styles.searchHeaderTitle}>{t('Tracker un colis')}</Text>
                            </View>
                        </View>

                        <View style={styles.searchInputRow}>
                            <Animated.View style={[styles.searchInputWrap, searchInputStyle]}>
                                <Ionicons
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
                            >
                                {searching ? (
                                    <ActivityIndicator color={C.primaryText} size="small" />
                                ) : (
                                    <Ionicons name="search" size={20} color={C.primaryText} />
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
                                color={C.warning}
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
    icon: keyof typeof Ionicons.glyphMap
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
        <Pressable onPress={onPress}>
            <Animated.View style={[styles.filterPill, pillStyle]}>
                <Ionicons
                    name={icon}
                    size={13}
                    color={active ? useColor : C.textSec}
                />
                <Text style={[styles.filterPillText, { color: active ? C.primaryText : C.textSec }]}>
                    {label}
                </Text>
                <View style={[
                    styles.filterPillCount,
                    active && { backgroundColor: 'rgba(212, 160, 23, 0.25)' },
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
    navBack: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
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
        paddingBottom: 30,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 16,
        paddingHorizontal: 24,
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

    /* ── Hero Video ── */
    heroWrap: {
        marginHorizontal: 20,
        marginBottom: 8,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 10,
    },
    hero: {
        height: 200,
        position: 'relative',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.35)',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(13, 43, 78, 0.35)',
    },
    heroOverlayBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        backgroundColor: 'rgba(13, 43, 78, 0.6)',
    },
    heroContent: {
        ...StyleSheet.absoluteFillObject,
        padding: 18,
        justifyContent: 'space-between',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(212, 160, 23, 0.20)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.5)',
    },
    heroBadgeDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: C.accent,
    },
    heroBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.3,
    },
    heroStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        alignSelf: 'flex-start',
    },
    heroStat: {
        alignItems: 'flex-start',
    },
    heroStatValue: {
        fontSize: 32,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: -1,
        lineHeight: 34,
    },
    heroStatLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 1.5,
        marginTop: 2,
    },
    heroStatDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },

    /* ── Search Card ── */
    searchCard: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 22,
        backgroundColor: C.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 3,
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
    },
    searchHeaderIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    searchHeaderBadge: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.3,
        marginBottom: 2,
    },
    searchHeaderTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
    },
    searchInputRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    searchInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        borderWidth: 1.2,
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    searchInputIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: C.primary,
        fontWeight: '600',
        letterSpacing: 0.5,
        paddingVertical: 0,
    },
    searchBtn: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: 'rgba(212, 160, 23, 0.35)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    searchBtnDisabled: {
        backgroundColor: '#CBD5E1',
        borderColor: 'transparent',
    },

    /* ── Filters ── */
    filtersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        paddingHorizontal: 24,
    },
    filtersTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    filtersLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    filterPillsRow: {
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 16,
    },
    filterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.2,
    },
    filterPillText: {
        fontSize: 12.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    filterPillCount: {
        backgroundColor: 'rgba(13, 43, 78, 0.08)',
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 1,
        minWidth: 22,
        alignItems: 'center',
    },
    filterPillCountText: {
        fontSize: 10.5,
        fontWeight: '800',
    },

    /* ── List ── */
    list: {
        paddingHorizontal: 20,
        gap: 12,
    },

    /* ── Order Card ── */
    orderCard: {
        flexDirection: 'row',
        backgroundColor: C.surfaceSolid,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    orderCardBar: {
        width: 4,
    },
    orderCardBody: {
        flex: 1,
        padding: 14,
    },
    orderTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    orderRefBlock: {},
    orderRefLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.3,
        marginBottom: 2,
    },
    orderRef: {
        fontSize: 14,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: 0.5,
    },
    orderStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
    },
    orderStatusText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    orderTitle: {
        fontSize: 14.5,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.2,
        lineHeight: 19,
        marginBottom: 6,
    },
    orderTitleMore: {
        color: C.textSec,
        fontWeight: '500',
    },
    orderMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    orderMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    orderMetaText: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
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
        gap: 8,
        backgroundColor: 'rgba(212, 160, 23, 0.06)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.18)',
        marginBottom: 10,
    },
    orderTrackingIcon: {
        width: 20,
        height: 20,
        borderRadius: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderTrackingText: {
        fontSize: 11.5,
        fontWeight: '800',
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
        fontSize: 11,
        color: C.accentDark,
        fontWeight: '600',
        flex: 1,
    },

    /* ── Order Footer ── */
    orderFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.6)',
    },
    orderAmountLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: C.textMuted,
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    orderAmount: {
        fontSize: 16,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.3,
    },
    orderArrow: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.3)',
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
        textAlign: 'center',
    },

    /* ── Empty State ── */
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
        paddingHorizontal: 28,
        marginHorizontal: 20,
        backgroundColor: C.surface,
        borderRadius: 22,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.05,
        shadowRadius: 14,
        elevation: 3,
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
        marginBottom: 22,
    },
    shopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        paddingHorizontal: 22,
        backgroundColor: C.primary,
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: 'rgba(212, 160, 23, 0.35)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    shopBtnText: {
        color: C.primaryText,
        fontSize: 13.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Empty Filter ── */
    emptyFilterState: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 30,
        marginHorizontal: 20,
        backgroundColor: C.surface,
        borderRadius: 18,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    emptyFilterIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: 'rgba(100, 116, 139, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(100, 116, 139, 0.20)',
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