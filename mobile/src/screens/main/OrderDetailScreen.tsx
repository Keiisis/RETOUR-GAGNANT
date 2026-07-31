'use strict'
import React, { useEffect, useState } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, ActivityIndicator, Linking,
    Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import * as Clipboard from 'expo-clipboard'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* ═══════════════════════════════════════════════════════════
   OrderDetailScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec tous les écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>
type Route = RouteProp<RootStackParamList, 'OrderDetail'>

interface OrderDetail {
    id: string
    customer_name: string
    customer_email: string | null
    customer_phone: string
    amount: number
    currency: string
    payment_method: string
    payment_status: string
    transaction_id: string | null
    cart_items: Array<{ title: string; quantity: number; unit_price: number }> | null
    product_title: string | null
    shipping_address: string | null
    shipping_city: string | null
    shipping_postal: string | null
    shipping_country: string | null
    shipping_notes: string | null
    tracking_code: string | null
    tracking_carrier: string | null
    tracking_url: string | null
    shipping_status: string | null
    shipped_at: string | null
    delivered_at: string | null
    created_at: string
}

interface TrackingEvent {
    id: number
    status: string
    label: string
    description: string | null
    location: string | null
    created_at: string
}

const SHIPPING_CONFIG: Record<string, {
    label: string
    icon: string
    color: string
    bgRgba: string
    borderRgba: string
}> = {
    pending: { label: 'En attente', icon: 'time-outline', color: C.textSec, bgRgba: 'rgba(138, 138, 138, 0.08)', borderRgba: 'rgba(138, 138, 138, 0.20)' },
    preparing: { label: 'En préparation', icon: 'cube-outline', color: C.warning, bgRgba: 'rgba(217, 119, 6, 0.10)', borderRgba: 'rgba(217, 119, 6, 0.25)' },
    shipped: { label: 'Expédié', icon: 'paper-plane-outline', color: C.info, bgRgba: 'rgba(0, 100, 60, 0.10)', borderRgba: 'rgba(0, 100, 60, 0.25)' },
    in_transit: { label: 'En transit', icon: 'car-outline', color: C.primary, bgRgba: 'rgba(0, 135, 81, 0.08)', borderRgba: 'rgba(0, 135, 81, 0.20)' },
    delivered: { label: 'Livré', icon: 'checkmark-done', color: C.success, bgRgba: 'rgba(0, 135, 81, 0.10)', borderRgba: 'rgba(0, 135, 81, 0.25)' },
    failed: { label: 'Échec', icon: 'close-circle-outline', color: C.error, bgRgba: 'rgba(232, 17, 45, 0.08)', borderRgba: 'rgba(232, 17, 45, 0.25)' },
    returned: { label: 'Retourné', icon: 'arrow-undo-outline', color: C.error, bgRgba: 'rgba(232, 17, 45, 0.08)', borderRgba: 'rgba(232, 17, 45, 0.25)' },
}

const STAGES = ['preparing', 'shipped', 'in_transit', 'delivered']
const STAGE_LABELS: Record<string, string> = {
    preparing: 'Préparation',
    shipped: 'Expédition',
    in_transit: 'Transit',
    delivered: 'Livré',
}
const STAGE_ICONS: Record<string, string> = {
    preparing: 'cube',
    shipped: 'paper-plane',
    in_transit: 'car',
    delivered: 'checkmark-done',
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
   COMPOSANT : STEPPER LIVRAISON PREMIUM
═══════════════════════════════════════════════════════════ */
function ShippingStepper({ currentIdx, statusColor }: { currentIdx: number; statusColor: string }) {
    const progress = useSharedValue(0)

    useEffect(() => {
        const target = currentIdx >= 0 ? currentIdx / (STAGES.length - 1) : 0
        progress.value = withDelay(400, withSpring(target, { damping: 18, stiffness: 90 }))
    }, [currentIdx])

    const fillStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }))

    return (
        <View style={styles.stepperWrap}>
            {/* Track + Fill */}
            <View style={styles.stepperTrack}>
                <Animated.View
                    style={[
                        styles.stepperFill,
                        { backgroundColor: statusColor },
                        fillStyle,
                    ]}
                />
            </View>

            {/* Dots avec icônes */}
            <View style={styles.stepperDotsRow}>
                {STAGES.map((stage, i) => {
                    const isDone = i < currentIdx
                    const isActive = i === currentIdx
                    const isPending = i > currentIdx
                    return (
                        <View key={stage} style={styles.stepperDotItem}>
                            <View
                                style={[
                                    styles.stepperDot,
                                    isDone && { backgroundColor: statusColor, borderColor: statusColor },
                                    isActive && {
                                        backgroundColor: C.surfaceSolid,
                                        borderColor: statusColor,
                                        borderWidth: 2.5,
                                        transform: [{ scale: 1.12 }],
                                    },
                                ]}
                            >
                                {isDone ? (
                                    <LucideIcon name="checkmark" size={12} color={C.primaryText} />
                                ) : (
                                    <LucideIcon
                                        name={STAGE_ICONS[stage]}
                                        size={11}
                                        color={isActive ? statusColor : C.textMuted}
                                    />
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.stepperDotLabel,
                                    (isDone || isActive) && { color: statusColor, fontFamily: fonts.extrabold },
                                ]}
                                numberOfLines={1}
                            >
                                {STAGE_LABELS[stage]}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function OrderDetailScreen({ navigation, route }: { navigation: Nav; route: Route }) {
    const insets = useSafeAreaInsets()
    const { orderId } = route.params
    const { t } = useLang()
    const { profile } = useAuth()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [events, setEvents] = useState<TrackingEvent[]>([])
    const [loading, setLoading] = useState(true)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const truckPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        truckPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const truckPulseStyle = useAnimatedStyle(() => ({
        opacity: interpolate(truckPulse.value, [0, 1], [0.4, 1]),
        transform: [{ scale: interpolate(truckPulse.value, [0, 1], [0.95, 1.05]) }],
    }))

    useEffect(() => {
        const fetchOrder = async () => {
            // client_id requis par le WAF (vérif de propriété anti-IDOR côté serveur)
            if (!profile?.id) { setLoading(false); return }
            try {
                const res = await fetchWithTimeout(
                    `${API_BASE}/api/mobile/orders?order_id=${orderId}`,
                    { timeoutMs: 10000, headers: { ...(await authHeaders()) } }
                )
                const data = await res.json().catch(() => ({}))
                if (data.order) {
                    setOrder(data.order)
                    setEvents(data.events || [])
                }
            } finally {
                setLoading(false)
            }
        }
        fetchOrder()
    }, [orderId, profile?.id])

    const formatPrice = (n: number, c: string) => {
        if (c === 'XOF' || c === 'XAF') return `${n.toLocaleString('fr-FR')} FCFA`
        if (c === 'EUR') return `${n.toLocaleString('fr-FR')} €`
        return `${n} ${c}`
    }

    const formatDateTime = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const copyTracking = async () => {
        if (!order?.tracking_code) return
        await Clipboard.setStringAsync(order.tracking_code)
        toast(t('Copié'), t('Le code de suivi a été copié.'))
    }

    const openCarrierUrl = () => {
        if (order?.tracking_url) {
            Linking.openURL(order.tracking_url).catch(() => { })
        }
    }

    const callCustomer = () => {
        if (order?.customer_phone) {
            Linking.openURL(`tel:${order.customer_phone}`).catch(() => { })
        }
    }

    /* ── État LOADING ── */
    if (loading) {
        return (
            <View style={styles.container}>
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
                </View>
                <View style={styles.loadingState}>
                    <View style={styles.loadingIconWrap}>
                        <ActivityIndicator color={C.primary} size="large" />
                    </View>
                    <Text style={styles.loadingTitle}>{t('Chargement')}</Text>
                    <Text style={styles.loadingText}>{t('Récupération des détails de la commande…')}</Text>
                </View>
            </View>
        )
    }

    /* ── État ERROR ── */
    if (!order) {
        return (
            <View style={styles.container}>
                <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.navBack}
                        accessibilityRole="button"
                        hitSlop={6}
                        accessibilityLabel={t('Retour')}>
                        <View style={styles.iconContainer}>
                            <LucideIcon name="arrow-back" size={22} color={C.primary} />
                        </View>
                    </Pressable>
                </View>
                <View style={styles.errorState}>
                    <View style={styles.errorHero}>
                        <View style={styles.errorIconWrap}>
                            <LucideIcon name="alert-circle-outline" size={36} color={C.error} />
                        </View>
                    </View>
                    <Text style={styles.errorTitle}>{t('Commande introuvable')}</Text>
                    <Text style={styles.errorText}>
                        {t('Cette commande n\'existe pas ou vous n\'avez pas accès à ses détails.')}
                    </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBtn} activeOpacity={0.85}
                        accessibilityRole="button"
                        hitSlop={6}>
                        <Text style={styles.errorBtnText}>{t('Retour')}</Text>
                        <LucideIcon name="arrow-forward" size={16} color={C.accent} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </View>
        )
    }

    const status = order.shipping_status || 'pending'
    const cfg = SHIPPING_CONFIG[status] || SHIPPING_CONFIG.pending
    const currentStageIdx = STAGES.indexOf(status)
    const shortRef = order.id.slice(0, 8).toUpperCase()

    return (
        <View style={styles.container}>

            {/* NAV BAR */}
            <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}>
                    <View style={styles.iconContainer}>
                        <LucideIcon name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={[styles.navCounter, { backgroundColor: cfg.bgRgba, borderColor: cfg.borderRgba }]}>
                    <Animated.View style={truckPulseStyle}>
                        <LucideIcon name={cfg.icon} size={12} color={cfg.color} />
                    </Animated.View>
                    <Text style={[styles.navCounterText, { color: cfg.color }]}>
                        {t(cfg.label)}
                    </Text>
                </View>

                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Commande')} #{shortRef}</Text>
                    <Text style={styles.subtitle}>
                        {t('Commandé le')} {formatDateTime(order.created_at)}
                    </Text>
                </Animated.View>

                {/* ═══ STATUS HERO CARD ═══ */}
                <AnimatedSection delay={100}>
                    <View style={[styles.statusCard, { borderColor: cfg.borderRgba }]}>
                        <View style={[styles.statusIconWrap, { backgroundColor: cfg.bgRgba, borderColor: cfg.borderRgba }]}>
                            <LucideIcon name={cfg.icon} size={28} color={cfg.color} />
                        </View>

                        <Text style={[styles.statusBadge, { color: cfg.color }]}>
                            {t(cfg.label).toUpperCase()}
                        </Text>
                        <Text style={styles.statusMainText}>
                            {order.delivered_at
                                ? t('Votre colis a été livré')
                                : order.shipped_at
                                    ? t('Votre colis est en route')
                                    : status === 'preparing'
                                        ? t('Votre commande est en préparation')
                                        : t('En attente de traitement')
                            }
                        </Text>
                        <Text style={styles.statusSubText}>
                            {order.delivered_at
                                ? `${t('Livré le')} ${formatDateTime(order.delivered_at)}`
                                : order.shipped_at
                                    ? `${t('Expédié le')} ${formatDateTime(order.shipped_at)}`
                                    : t('Mise à jour bientôt disponible')
                            }
                        </Text>

                        {/* Stepper */}
                        {currentStageIdx >= 0 && (
                            <ShippingStepper currentIdx={currentStageIdx} statusColor={cfg.color} />
                        )}
                    </View>
                </AnimatedSection>

                {/* ═══ TRACKING CODE CARD ═══ */}
                {order.tracking_code ? (
                    <AnimatedSection delay={200}>
                        <View style={styles.trackingCard}>
                            <View style={styles.trackingGlow} />

                            <View style={styles.trackingBadge}>
                                <LucideIcon name="paper-plane" size={11} color={C.accent} />
                                <Text style={styles.trackingBadgeText}>{t('SUIVI COLIS')}</Text>
                            </View>

                            <Text style={styles.trackingLabel}>{t('Code de tracking')}</Text>
                            <Text style={styles.trackingCode}>{order.tracking_code}</Text>

                            {order.tracking_carrier && (
                                <View style={styles.trackingCarrierRow}>
                                    <LucideIcon name="business-outline" size={12} color={C.accentLight} />
                                    <Text style={styles.trackingCarrierText}>{order.tracking_carrier}</Text>
                                </View>
                            )}

                            <View style={styles.trackingActions}>
                                <TouchableOpacity onPress={copyTracking} style={styles.trackingBtn} activeOpacity={0.85}
                                    accessibilityRole="button"
                                    hitSlop={6}>
                                    <LucideIcon name="copy-outline" size={14} color={C.primary} />
                                    <Text style={styles.trackingBtnText}>{t('Copier')}</Text>
                                </TouchableOpacity>
                                {order.tracking_url ? (
                                    <TouchableOpacity onPress={openCarrierUrl} style={styles.trackingBtnPrimary} activeOpacity={0.85}
                                        accessibilityRole="button"
                                        hitSlop={6}>
                                        <LucideIcon name="open-outline" size={14} color={C.accent} />
                                        <Text style={styles.trackingBtnPrimaryText}>{t('Suivre en ligne')}</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>
                    </AnimatedSection>
                ) : null}

                {/* ═══ ARTICLES ═══ */}
                <AnimatedSection delay={300}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIcon}>
                            <LucideIcon name="receipt" size={16} color={C.accent} />
                        </View>
                        <Text style={styles.sectionTitle}>{t('Articles commandés')}</Text>
                        <View style={styles.sectionCount}>
                            <Text style={styles.sectionCountText}>{order.cart_items?.length || 0}</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        {(order.cart_items || []).map((item, i, arr) => (
                            <View
                                key={i}
                                style={[
                                    styles.itemRow,
                                    i < arr.length - 1 && styles.itemRowBorder,
                                ]}
                            >
                                <View style={styles.itemQty}>
                                    <Text style={styles.itemQtyText}>×{item.quantity}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName} numberOfLines={2}>
                                        {t(item.title)}
                                    </Text>
                                    <Text style={styles.itemUnitPrice}>
                                        {formatPrice(item.unit_price || 0, order.currency)} / {t('unité')}
                                    </Text>
                                </View>
                                <Text style={styles.itemPrice}>
                                    {formatPrice((item.unit_price || 0) * (item.quantity || 1), order.currency)}
                                </Text>
                            </View>
                        ))}

                        {/* Total massif */}
                        <View style={styles.totalSection}>
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>{t('Total payé')}</Text>
                                <Text style={styles.totalValue}>{formatPrice(order.amount, order.currency)}</Text>
                            </View>
                            {order.transaction_id ? (
                                <View style={styles.txRefRow}>
                                    <LucideIcon name="finger-print" size={11} color={C.textMuted} />
                                    <Text style={styles.txRef}>
                                        {t('Réf')} : {order.transaction_id.slice(0, 18)}…
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ ADRESSE LIVRAISON ═══ */}
                {order.shipping_address ? (
                    <AnimatedSection delay={400}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIcon}>
                                <LucideIcon name="location" size={16} color={C.accent} />
                            </View>
                            <Text style={styles.sectionTitle}>{t('Adresse de livraison')}</Text>
                        </View>

                        <View style={styles.card}>
                            {/* Destinataire */}
                            <View style={styles.shipBlock}>
                                <View style={styles.shipIconWrap}>
                                    <LucideIcon name="person" size={14} color={C.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.shipLabel}>{t('DESTINATAIRE')}</Text>
                                    <Text style={styles.shipValue}>{order.customer_name}</Text>
                                </View>
                            </View>

                            <View style={styles.shipDivider} />

                            {/* Téléphone (avec call) */}
                            <TouchableOpacity onPress={callCustomer} activeOpacity={0.7}
                                accessibilityRole="button"
                                hitSlop={6}>
                                <View style={styles.shipBlock}>
                                    <View style={styles.shipIconWrap}>
                                        <LucideIcon name="call" size={14} color={C.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.shipLabel}>{t('TÉLÉPHONE')}</Text>
                                        <Text style={styles.shipValue}>{order.customer_phone}</Text>
                                    </View>
                                    <LucideIcon name="chevron-forward" size={14} color={C.textMuted} />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.shipDivider} />

                            {/* Adresse */}
                            <View style={styles.shipBlock}>
                                <View style={styles.shipIconWrap}>
                                    <LucideIcon name="map" size={14} color={C.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.shipLabel}>{t('ADRESSE')}</Text>
                                    <Text style={styles.shipValue}>{order.shipping_address}</Text>
                                    <Text style={styles.shipValueSub}>
                                        {[order.shipping_city, order.shipping_postal, order.shipping_country].filter(Boolean).join(', ')}
                                    </Text>
                                </View>
                            </View>

                            {order.shipping_notes ? (
                                <>
                                    <View style={styles.shipDivider} />
                                    <View style={styles.shipNoteBox}>
                                        <LucideIcon name="document-text-outline" size={12} color={C.textSec} />
                                        <Text style={styles.shipNote}>{order.shipping_notes}</Text>
                                    </View>
                                </>
                            ) : null}
                        </View>
                    </AnimatedSection>
                ) : null}

                {/* ═══ HISTORIQUE / TIMELINE ═══ */}
                {events.length > 0 && (
                    <AnimatedSection delay={500}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.sectionIcon}>
                                <LucideIcon name="time" size={16} color={C.accent} />
                            </View>
                            <Text style={styles.sectionTitle}>{t('Historique du colis')}</Text>
                            <View style={styles.sectionCount}>
                                <Text style={styles.sectionCountText}>{events.length}</Text>
                            </View>
                        </View>

                        <View style={styles.card}>
                            {events.map((ev, i) => {
                                const evCfg = SHIPPING_CONFIG[ev.status] || SHIPPING_CONFIG.pending
                                const isLatest = i === 0
                                return (
                                    <View key={ev.id} style={styles.evRow}>
                                        {/* Colonne dot + line */}
                                        <View style={styles.evLineCol}>
                                            <View style={[
                                                styles.evDot,
                                                {
                                                    backgroundColor: evCfg.bgRgba,
                                                    borderColor: evCfg.borderRgba,
                                                },
                                                isLatest && {
                                                    backgroundColor: evCfg.color,
                                                    borderColor: C.accent,
                                                    borderWidth: 2,
                                                },
                                            ]}>
                                                <LucideIcon
                                                    name={evCfg.icon}
                                                    size={11}
                                                    color={isLatest ? C.primaryText : evCfg.color}
                                                />
                                            </View>
                                            {i < events.length - 1 && <View style={styles.evConnector} />}
                                        </View>

                                        {/* Contenu */}
                                        <View style={styles.evContent}>
                                            <View style={styles.evHeaderRow}>
                                                <Text style={[styles.evLabel, isLatest && styles.evLabelLatest]}>
                                                    {t(ev.label)}
                                                </Text>
                                                {isLatest && (
                                                    <View style={styles.evLatestBadge}>
                                                        <Text style={styles.evLatestBadgeText}>{t('DERNIER')}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {ev.description ? (
                                                <Text style={styles.evDesc}>{t(ev.description)}</Text>
                                            ) : null}
                                            {ev.location ? (
                                                <View style={styles.evLocationRow}>
                                                    <LucideIcon name="location-outline" size={11} color={C.textMuted} />
                                                    <Text style={styles.evLocation}>{ev.location}</Text>
                                                </View>
                                            ) : null}
                                            <Text style={styles.evTime}>{formatDateTime(ev.created_at)}</Text>
                                        </View>
                                    </View>
                                )
                            })}
                        </View>
                    </AnimatedSection>
                )}

                {/* ═══ FOOTER ═══ */}
                <AnimatedSection delay={600}>
                    <View style={styles.footerInfo}>
                        <View style={styles.footerDivider}>
                            <View style={styles.dividerLine} />
                            <View style={styles.dividerDot} />
                            <View style={styles.dividerLine} />
                        </View>
                        <Text style={styles.footerText}>
                            {t('Une question sur votre commande ? Contactez notre support.')}
                        </Text>
                    </View>
                </AnimatedSection>
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: { width: 44, height: 44, justifyContent: 'center' },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
    },
    navCounterText: {
        ...typography.button, fontSize: 12,
        letterSpacing: 0.3,
    },

    /* ── Loading ── */
    loadingState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingHorizontal: 30,
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
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
    },
    loadingTitle: {
        ...typography.h3, fontSize: 16,
        color: C.primary,
        letterSpacing: -0.2,
        marginTop: 6,
    },
    loadingText: {
        ...typography.label,
        color: C.textSec,
        textAlign: 'center',
    },

    /* ── Error ── */
    errorState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingHorizontal: 30,
    },
    errorHero: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    errorIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 28,
        backgroundColor: 'rgba(232, 17, 45, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(232, 17, 45, 0.25)',
    },
    errorTitle: {
        ...typography.h2, fontSize: 20,
        color: C.primary,
        letterSpacing: -0.3,
        textAlign: 'center',
        marginTop: 8,
    },
    errorText: {
        ...typography.label,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: 16,
    },
    errorBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        paddingHorizontal: 30,
        backgroundColor: C.primary,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    errorBtnText: {
        color: C.primaryText,
        ...typography.button, fontSize: 14,
        letterSpacing: 0.2,
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
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.label,
        color: C.textSec,
        marginTop: 10,
    },

    /* ── Status Card (Hero) ── */
    statusCard: {
        backgroundColor: C.surface,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        alignItems: 'center',
        marginBottom: 22,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    statusIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 14,
    },
    statusBadge: {
        ...typography.button, fontSize: 12,
        letterSpacing: 1.8,
        marginBottom: 8,
    },
    statusMainText: {
        ...typography.h3,
        color: C.primary,
        letterSpacing: -0.3,
        textAlign: 'center',
        marginBottom: 4,
    },
    statusSubText: {
        ...typography.caption,
        color: C.textSec,
        textAlign: 'center',
    },

    /* ── Stepper ── */
    stepperWrap: {
        width: '100%',
        marginTop: 22,
        paddingTop: 10,
    },
    stepperTrack: {
        position: 'absolute',
        top: 21,
        left: '12%',
        right: '12%',
        height: 3,
        backgroundColor: C.border,
        borderRadius: 2,
    },
    stepperFill: {
        height: '100%',
        borderRadius: 2,
    },
    stepperDotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    stepperDotItem: {
        alignItems: 'center',
        flex: 1,
    },
    stepperDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: C.surfaceSolid,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    stepperDotLabel: {
        ...typography.caption,
        color: C.textMuted,
        letterSpacing: 0.2,
        textAlign: 'center',
    },

    /* ── Tracking Card (bleu massif) ── */
    trackingCard: {
        backgroundColor: C.primary,
        borderRadius: 22,
        padding: 20,
        marginBottom: 22,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 8,
        position: 'relative',
    },
    trackingGlow: { display: 'none' },
    trackingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(252, 209, 22, 0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 14,
    },
    trackingBadgeText: {
        ...typography.button, fontSize: 12,
        color: C.accent,
        letterSpacing: 1.3,
    },
    trackingLabel: {
        ...typography.overline,
        color: 'rgba(255, 255, 255, 0.65)',
        marginBottom: 4,
    },
    trackingCode: {
        ...typography.h2,
        color: C.primaryText,
        letterSpacing: 2,
        marginBottom: 6,
    },
    trackingCarrierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 16,
    },
    trackingCarrierText: {
        ...typography.caption,
        color: C.accentLight,
    },
    trackingActions: {
        flexDirection: 'row',
        gap: 8,
    },
    trackingBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: C.surfaceSolid,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    trackingBtnText: {
        ...typography.button, fontSize: 12.5,
        color: C.primary,
        letterSpacing: 0.2,
    },
    trackingBtnPrimary: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.18)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    trackingBtnPrimaryText: {
        ...typography.button, fontSize: 12.5,
        color: C.accent,
        letterSpacing: 0.2,
    },

    /* ── Section Header ── */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    sectionIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    sectionTitle: {
        flex: 1,
        ...typography.button, fontSize: 14,
        color: C.primary,
        letterSpacing: -0.2,
    },
    sectionCount: {
        backgroundColor: C.primary,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 22,
        alignItems: 'center',
    },
    sectionCountText: {
        ...typography.button, fontSize: 12,
        color: C.accent,
        letterSpacing: 0.3,
    },

    /* ── Generic Card ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 20,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },

    /* ── Articles ── */
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    itemRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.6)',
    },
    itemQty: {
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.12)',
    },
    itemQtyText: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 0.2,
    },
    itemName: {
        ...typography.button, fontSize: 13,
        color: C.primary,
        letterSpacing: -0.1,
    },
    itemUnitPrice: {
        ...typography.caption,
        color: C.textMuted,
        marginTop: 2,
    },
    itemPrice: {
        ...typography.button, fontSize: 13.5,
        color: C.primary,
        letterSpacing: -0.2,
    },
    totalSection: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: C.border,
        borderStyle: 'dashed',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        ...typography.overline, fontSize: 13,
        color: C.textSec,
    },
    totalValue: {
        ...typography.h2,
        color: C.accent,
        letterSpacing: -0.5,
    },
    txRefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 8,
        justifyContent: 'flex-end',
    },
    txRef: {
        ...typography.caption,
        color: C.textMuted,
        letterSpacing: 0.2,
    },

    /* ── Shipping ── */
    shipBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
    },
    shipIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 11,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    shipLabel: {
        ...typography.button, fontSize: 12,
        color: C.accentDark,
        letterSpacing: 1.2,
        marginBottom: 3,
    },
    shipValue: {
        ...typography.button, fontSize: 13,
        color: C.primary,
        letterSpacing: -0.1,
    },
    shipValueSub: {
        ...typography.caption,
        color: C.textSec,
        marginTop: 2,
    },
    shipDivider: {
        height: 1,
        backgroundColor: 'rgba(226, 232, 240, 0.6)',
        marginVertical: 12,
    },
    shipNoteBox: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(252, 209, 22, 0.06)',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    shipNote: {
        flex: 1,
        ...typography.caption,
        color: C.textSec,
        fontStyle: 'italic',
    },

    /* ── Events Timeline ── */
    evRow: {
        flexDirection: 'row',
        gap: 12,
    },
    evLineCol: {
        alignItems: 'center',
        width: 28,
    },
    evDot: {
        width: 28,
        height: 28,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    evConnector: {
        width: 2,
        flex: 1,
        backgroundColor: C.border,
        marginVertical: 4,
        minHeight: 16,
    },
    evContent: {
        flex: 1,
        paddingBottom: 18,
    },
    evHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    evLabel: {
        ...typography.button, fontSize: 13,
        color: C.textSec,
        letterSpacing: -0.1,
    },
    evLabelLatest: {
        color: C.primary,
        fontFamily: fonts.extrabold,
    },
    evLatestBadge: {
        backgroundColor: 'rgba(252, 209, 22, 0.15)',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: C.border,
    },
    evLatestBadgeText: {
        ...typography.button, fontSize: 12,
        color: C.accentDark,
        letterSpacing: 0.8,
    },
    evDesc: {
        ...typography.caption,
        color: C.textSec,
        marginBottom: 4,
    },
    evLocationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    evLocation: {
        ...typography.caption,
        color: C.textMuted,
    },
    evTime: {
        ...typography.caption,
        color: C.textMuted,
        letterSpacing: 0.2,
        marginTop: 2,
    },

    /* ── Footer ── */
    footerInfo: {
        alignItems: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
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
        ...typography.caption,
        color: C.textMuted,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
})