'use strict'
import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, ActivityIndicator, Modal,
    Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import KkiapayModal from '../../components/KkiapayModal'
import { ttcFromHt } from '../../lib/tax'
import type { AppEvent } from './EventsScreen'
import { screenColors, typography } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   EventDetailScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })
}
function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function formatPrice(price: number, currency: string, t: any) {
    if (price === 0) return t('Gratuit')
    return `${price.toLocaleString('fr-FR')} ${currency}`
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
   COMPOSANT : TICKET CARD (Animée, radio premium)
═══════════════════════════════════════════════════════════ */

interface TicketCardProps {
    type: 'standard' | 'vip'
    selected: boolean
    onSelect: () => void
    label: string
    description: string
    price: string
    isFree?: boolean
    isVip?: boolean
    perks?: string[]
}

function TicketCard({
    type, selected, onSelect, label, description, price, isFree, isVip, perks,
}: TicketCardProps) {
    const anim = useSharedValue(selected ? 1 : 0)

    useEffect(() => {
        anim.value = withSpring(selected ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [selected])

    const wrapStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(anim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: interpolateColor(
            anim.value,
            [0, 1],
            ['rgba(255,255,255,0.85)', 'rgba(252, 209, 22, 0.06)']
        ),
        transform: [{ scale: interpolate(anim.value, [0, 1], [1, 1.01]) }],
    }))

    const radioStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(anim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: interpolateColor(anim.value, [0, 1], [C.surfaceSolid, C.accent]),
    }))

    const innerStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ scale: anim.value }],
    }))

    return (
        <Pressable onPress={onSelect}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[ticketStyles.card, wrapStyle]}>
                {/* Bandeau VIP doré */}
                {isVip && (
                    <View style={ticketStyles.vipBanner}>
                        <LucideIcon name="star" size={9} color={C.primary} />
                        <Text style={ticketStyles.vipBannerText}>RECOMMANDÉ</Text>
                    </View>
                )}

                <View style={ticketStyles.cardInner}>
                    {/* Radio personnalisé */}
                    <Animated.View style={[ticketStyles.radio, radioStyle]}>
                        <Animated.View style={[ticketStyles.radioInner, innerStyle]}>
                            <LucideIcon name="checkmark" size={10} color={C.primary} />
                        </Animated.View>
                    </Animated.View>

                    <View style={ticketStyles.info}>
                        <View style={ticketStyles.titleRow}>
                            <Text style={ticketStyles.name}>{label}</Text>
                            {isVip && (
                                <View style={ticketStyles.vipMiniBadge}>
                                    <LucideIcon name="star" size={8} color={C.accent} />
                                    <Text style={ticketStyles.vipMiniText}>VIP</Text>
                                </View>
                            )}
                        </View>
                        <Text style={ticketStyles.desc} numberOfLines={2}>{description}</Text>

                        {/* Perks list */}
                        {perks && perks.length > 0 && (
                            <View style={ticketStyles.perks}>
                                {perks.map((perk, i) => (
                                    <View key={i} style={ticketStyles.perkRow}>
                                        <LucideIcon name="checkmark-circle" size={11} color={C.success} />
                                        <Text style={ticketStyles.perkText}>{perk}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    <View style={ticketStyles.priceWrap}>
                        <Text style={[
                            ticketStyles.price,
                            isFree && { color: C.success },
                            selected && !isFree && { color: C.primary },
                        ]}>
                            {price}
                        </Text>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    )
}

const ticketStyles = StyleSheet.create({
    card: {
        borderRadius: 16,
        borderWidth: 1.5,
        marginBottom: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    vipBanner: {
        position: 'absolute',
        top: 10,
        right: -28,
        transform: [{ rotate: '32deg' }],
        backgroundColor: C.accent,
        paddingHorizontal: 30,
        paddingVertical: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        zIndex: 2,
    },
    vipBannerText: {
        color: C.primary,
        ...typography.button, fontSize: 12,
        letterSpacing: 0.6,
    },
    cardInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
    },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: '100%',
        height: '100%',
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        ...typography.button, fontSize: 14,
        color: C.primary,
        letterSpacing: -0.2,
    },
    vipMiniBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(0, 135, 81, 0.08)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    vipMiniText: {
        ...typography.button, fontSize: 12,
        color: C.accentDark,
    },
    desc: {
        ...typography.caption,
        color: C.textSec,
    },
    perks: {
        marginTop: 8,
        gap: 4,
    },
    perkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    perkText: {
        ...typography.caption,
        color: C.textSec,
    },
    priceWrap: {
        alignItems: 'flex-end',
    },
    price: {
        ...typography.h3, fontSize: 16,
        color: C.primary,
        letterSpacing: -0.3,
    },
})

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : EVENT DETAIL
═══════════════════════════════════════════════════════════ */

export default function EventDetailScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets()
    const { event } = route.params as { event: AppEvent }
    const { profile } = useAuth()
    const { t } = useLang()

    const [loading, setLoading] = useState(false)
    const [selectedTicket, setSelectedTicket] = useState<'standard' | 'vip'>('standard')
    const [showModal, setShowModal] = useState(false)
    const [registration, setRegistration] = useState(event.my_registration || null)
    const [showKkiapay, setShowKkiapay] = useState(false)
    const [pendingRegistration, setPendingRegistration] = useState<{ id: string; amount: number } | null>(null)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const datePulse = useSharedValue(0)
    const sheetAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })


        datePulse.value = withTiming(1, { duration: 600 })
    }, [])

    useEffect(() => {
        sheetAnim.value = withSpring(showModal ? 1 : 0, { damping: 20, stiffness: 180 })
    }, [showModal])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const dateGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(datePulse.value, [0, 1], [0.15, 0.45]),
        transform: [{ scale: interpolate(datePulse.value, [0, 1], [1, 1.15]) }],
    }))

    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
        transform: [{ translateY: interpolate(sheetAnim.value, [0, 1], [400, 0]) }],
    }))

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
    }))

    const isFree = event.price_standard === 0
    const hasVip = (event.price_vip ?? 0) > 0
    const isRegistered = !!registration

    const selectedPrice = selectedTicket === 'vip' ? (event.price_vip || 0) : event.price_standard
    // TVA « en sus » : prix billet HORS TAXE ; le client paie le TTC (HT × 1,18).
    const selectedPriceTtc = ttcFromHt(selectedPrice)
    const isFreeTicket = selectedPrice === 0

    const handleRegister = async () => {
        if (!profile) {
            toast(t('Non connecté'), t('Veuillez vous connecter pour vous inscrire.'))
            return
        }
        setLoading(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 15000,
                body: JSON.stringify({
                    event_id: event.id,
                    client_id: profile.id,
                    ticket_type: selectedTicket,
                    quantity: 1,
                }),
            })
            const text = await res.text()
            let json: Record<string, unknown> = {}
            try { json = JSON.parse(text) } catch { throw new Error(`Erreur serveur (${res.status})`) }

            if (!res.ok && res.status !== 200) {
                throw new Error((json.error as string) || `Erreur ${res.status}`)
            }

            const reg = (json.registration as { id: string; status: string; ticket_type: string; payment_status?: string }) ||
                (json.exists ? { ...(json.registration as object || {}), status: 'confirmed' } : null)

            setRegistration(reg)
            setShowModal(false)

            if (json.exists) {
                toast(t('Déjà inscrit'), t('Vous êtes déjà inscrit à cet événement.'), 'warning')
                return
            }

            if (isFreeTicket) {
                toast(
                    t('Inscription confirmée'),
                    t('Votre place est réservée pour "{eventTitle}".\n\nUn email de confirmation vous sera envoyé.').replace('{eventTitle}', event.title),
                    'success',
                )
                return
            }

            if (reg?.id) {
                setPendingRegistration({ id: reg.id, amount: (json.amount as number) ?? selectedPriceTtc })
                setShowKkiapay(true)
            }
        } catch (e: unknown) {
            toast(t('Erreur'), e instanceof Error ? e.message : t('Impossible de s\'inscrire'))
        } finally {
            setLoading(false)
        }
    }

    const handlePaymentSuccess = async (txId: string) => {
        setShowKkiapay(false)
        if (!pendingRegistration) return
        setLoading(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/events`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 15000,
                body: JSON.stringify({
                    registration_id: pendingRegistration.id,
                    transaction_id: txId,
                }),
            })
            const data = await res.json().catch(() => ({}))

            if (!res.ok || !data.ok) {
                toast(t('Paiement reçu — confirmation manuelle requise'), t('Votre paiement a été reçu (réf : {tx}) mais la confirmation automatique a échoué. Notre équipe vérifiera votre billet sous 24h.').replace('{tx}', txId))
                return
            }

            setRegistration({ id: pendingRegistration.id, status: 'confirmed', ticket_type: selectedTicket })
            setPendingRegistration(null)

            toast(
                t('Paiement confirmé'),
                t('Votre place pour "{eventTitle}" est réservée. Un email de confirmation vous sera envoyé.').replace('{eventTitle}', event.title),
                'success',
            )
        } catch (e: unknown) {
            toast(t('Erreur'), t('Paiement reçu (réf : {tx}) mais confirmation impossible. Contactez le support.').replace('{tx}', txId))
        } finally {
            setLoading(false)
        }
    }

    const metaInfos = [
        {
            icon: 'calendar-outline' as const,
            label: t('Date'),
            value: formatDateLong(event.start_date),
        },
        {
            icon: 'time-outline' as const,
            label: t('Heure'),
            value: `${formatTime(event.start_date)}${event.end_date ? ` → ${formatTime(event.end_date)}` : ''}`,
        },
        {
            icon: 'location-outline' as const,
            label: t('Lieu'),
            value: event.address || event.location || '—',
        },
        {
            icon: 'people-outline' as const,
            label: t('Capacité'),
            value: event.max_capacity ? `${event.max_capacity} ${t('places')}` : t('Non limité'),
        },
    ]

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

                <View style={{ flex: 1 }} />

                {event.is_featured && (
                    <View style={styles.featuredNavBadge}>
                        <LucideIcon name="star" size={11} color={C.accent} />
                        <Text style={styles.featuredNavText}>{t('À la une')}</Text>
                    </View>
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* ═══ HERO : DATE + CATÉGORIE ═══ */}
                <Animated.View style={[styles.heroContainer, styleHeader]}>
                    {/* Halo doré derrière la date */}
                    <Animated.View style={[styles.dateGlow, dateGlowStyle]} />

                    {/* Carte date massive */}
                    <View style={styles.dateCard}>
                        <Text style={styles.dateDay}>
                            {new Date(event.start_date).getDate()}
                        </Text>
                        <View style={styles.dateDivider} />
                        <Text style={styles.dateMonth}>
                            {new Date(event.start_date).toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase().replace('.', '')}
                        </Text>
                        <Text style={styles.dateYear}>
                            {new Date(event.start_date).getFullYear()}
                        </Text>
                    </View>

                    {/* Catégorie + inscrit */}
                    <View style={styles.heroBadges}>
                        {event.category && (
                            <View style={styles.catBadge}>
                                <View style={styles.catDot} />
                                <Text style={styles.catText}>{event.category.toUpperCase()}</Text>
                            </View>
                        )}
                        {isRegistered && (
                            <View style={styles.registeredBadge}>
                                <LucideIcon name="checkmark-circle" size={12} color={C.success} />
                                <Text style={styles.registeredText}>{t('Inscrit')}</Text>
                            </View>
                        )}
                    </View>

                    {/* Titre */}
                    <Text style={styles.title}>{event.title}</Text>

                    {event.short_description && (
                        <Text style={styles.subtitle}>{event.short_description}</Text>
                    )}
                </Animated.View>

                {/* ═══ MÉTA INFOS (4 cards en grille) ═══ */}
                <AnimatedSection delay={150}>
                    <View style={styles.metaGrid}>
                        {metaInfos.map((item, i) => (
                            <View key={i} style={styles.metaCard}>
                                <View style={styles.metaIconWrap}>
                                    <LucideIcon name={item.icon} size={16} color={C.accent} />
                                </View>
                                <Text style={styles.metaLabel}>{item.label}</Text>
                                <Text style={styles.metaValue} numberOfLines={2}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ DESCRIPTION ═══ */}
                <AnimatedSection delay={250}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="information-circle-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t("À propos de l'événement")}</Text>
                        </View>

                        <Text style={styles.description}>
                            {event.description || event.short_description || t('Rejoignez-nous pour cet événement exceptionnel organisé par Retour Gagnant Bénin.')}
                        </Text>
                    </View>
                </AnimatedSection>

                {/* ═══ TARIFS & BILLETS ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="ticket-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Tarifs & Billets')}</Text>
                            {isFree && (
                                <View style={styles.freeBadge}>
                                    <Text style={styles.freeBadgeText}>{t('GRATUIT')}</Text>
                                </View>
                            )}
                        </View>

                        <TicketCard
                            type="standard"
                            selected={selectedTicket === 'standard'}
                            onSelect={() => setSelectedTicket('standard')}
                            label={t('Billet Standard')}
                            description={t("Accès à l'événement, networking")}
                            price={formatPrice(ttcFromHt(event.price_standard), event.currency, t)}
                            isFree={isFree}
                            perks={[
                                t('Accès à toutes les conférences'),
                                t('Pause-café et networking'),
                            ]}
                        />

                        {hasVip && (
                            <TicketCard
                                type="vip"
                                selected={selectedTicket === 'vip'}
                                onSelect={() => setSelectedTicket('vip')}
                                label={t('Billet VIP')}
                                description={t('Accès prioritaire, places réservées, cocktail')}
                                price={formatPrice(ttcFromHt(event.price_vip || 0), event.currency, t)}
                                isVip
                                perks={[
                                    t('Accès prioritaire à toutes les sessions'),
                                    t('Places réservées au premier rang'),
                                    t('Cocktail VIP & networking exclusif'),
                                    t('Goodies premium offerts'),
                                ]}
                            />
                        )}
                    </View>
                </AnimatedSection>

                {/* ═══ NOTE INFO ═══ */}
                <AnimatedSection delay={450}>
                    <View style={styles.infoBox}>
                        <View style={styles.infoIconWrap}>
                            <LucideIcon name="shield-checkmark" size={16} color={C.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoTitle}>{t('Inscription sécurisée')}</Text>
                            <Text style={styles.infoText}>
                                {t('Vos données sont protégées · Paiement sécurisé via Kkiapay')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                <View style={{ height: 130 }} />
            </ScrollView>

            {/* ═══ CTA FIXE ═══ */}
            <View style={styles.bottomBar}>
                {isRegistered ? (
                    <View style={styles.registeredBtn}>
                        <View style={styles.registeredIconWrap}>
                            <LucideIcon name="checkmark-circle" size={22} color={C.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.registeredBtnLabel}>{t('Vous êtes inscrit')}</Text>
                            <Text style={styles.registeredBtnSub}>{t('Confirmation envoyée par email')}</Text>
                        </View>
                    </View>
                ) : (
                    <>
                        <View style={styles.bottomBarPrice}>
                            <Text style={styles.bottomBarLabel}>
                                {selectedTicket === 'vip' ? t('Billet VIP') : t('Billet Standard')}
                            </Text>
                            <Text style={styles.bottomBarValue}>
                                {formatPrice(selectedPriceTtc, event.currency, t)}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.btn, loading && styles.btnDisabled]}
                            activeOpacity={0.85}
                            onPress={() => setShowModal(true)}
                            disabled={loading}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            {loading ? (
                                <ActivityIndicator color={C.primaryText} size="small" />
                            ) : (
                                <>
                                    <LucideIcon name="ticket" size={18} color={C.accent} style={{ marginRight: 8 }} />
                                    <Text style={styles.btnText}>{t("S'inscrire")}</Text>
                                    <LucideIcon name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* ═══ MODAL CONFIRMATION ═══ */}
            {showModal && (
                <Modal
                    visible={showModal}
                    transparent
                    animationType="none"
                    onRequestClose={() => setShowModal(false)}
                >
                    <View style={styles.modalOverlayContainer}>
                        <Animated.View style={[styles.modalBg, overlayStyle]}>
                            <Pressable
                                style={StyleSheet.absoluteFill}
                                onPress={() => setShowModal(false)}
                                accessibilityRole="button"
                                hitSlop={6}
                            />
                        </Animated.View>

                        <Animated.View style={[styles.sheet, sheetStyle, { paddingBottom: insets.bottom + 20 }]}>
                            <View style={styles.sheetHandle} />

                            <View style={styles.sheetHeader}>
                                <View>
                                    <Text style={styles.sheetSubtitle}>{t('Confirmation')}</Text>
                                    <Text style={styles.sheetTitle}>{t('Confirmer votre inscription')}</Text>
                                </View>
                                <Pressable
                                    onPress={() => setShowModal(false)}
                                    style={styles.sheetCloseBtn}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                    accessibilityLabel={t('Fermer')}
                                >
                                    <LucideIcon name="close" size={20} color={C.primary} />
                                </Pressable>
                            </View>

                            <Text style={styles.sheetEvent} numberOfLines={2}>
                                {event.title}
                            </Text>

                            {/* Récap inscription */}
                            <View style={styles.recap}>
                                <View style={styles.recapRow}>
                                    <View style={styles.recapIconWrap}>
                                        <LucideIcon name="ticket-outline" size={14} color={C.primary} />
                                    </View>
                                    <Text style={styles.recapLabel}>{t('Type de billet')}</Text>
                                    <View style={styles.recapBadge}>
                                        <Text style={styles.recapBadgeText}>
                                            {selectedTicket.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.recapDivider} />

                                <View style={styles.recapRow}>
                                    <View style={styles.recapIconWrap}>
                                        <LucideIcon name="calendar-outline" size={14} color={C.primary} />
                                    </View>
                                    <Text style={styles.recapLabel}>{t('Date')}</Text>
                                    <Text style={styles.recapValue} numberOfLines={1}>
                                        {new Date(event.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </Text>
                                </View>

                                <View style={styles.recapDivider} />

                                <View style={styles.recapRow}>
                                    <View style={styles.recapIconWrap}>
                                        <LucideIcon name="cash-outline" size={14} color={C.primary} />
                                    </View>
                                    <Text style={styles.recapLabel}>{t('Montant')}</Text>
                                    <Text style={[
                                        styles.recapPrice,
                                        isFreeTicket && { color: C.success },
                                    ]}>
                                        {formatPrice(selectedPriceTtc, event.currency, t)}
                                    </Text>
                                </View>
                            </View>

                            {!isFreeTicket && (
                                <View style={styles.payNotice}>
                                    <LucideIcon name="information-circle" size={16} color={C.info} />
                                    <Text style={styles.payNoticeText}>
                                        {t('Le paiement sécurisé sera lancé immédiatement après confirmation.')}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.confirmBtn, loading && styles.btnDisabled]}
                                onPress={handleRegister}
                                disabled={loading}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                {loading ? (
                                    <ActivityIndicator color={C.primaryText} size="small" />
                                ) : (
                                    <>
                                        <LucideIcon
                                            name={isFreeTicket ? 'checkmark-circle' : 'card-outline'}
                                            size={18}
                                            color={C.accent}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text style={styles.confirmBtnText}>
                                            {isFreeTicket ? t("Confirmer l'inscription") : t('Confirmer et payer')}
                                        </Text>
                                        <LucideIcon name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>

                            <Pressable
                                style={styles.cancelBtn}
                                onPress={() => setShowModal(false)}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.cancelText}>{t('Annuler')}</Text>
                            </Pressable>
                        </Animated.View>
                    </View>
                </Modal>
            )}

            {/* Paiement Kkiapay */}
            <KkiapayModal
                visible={showKkiapay}
                amount={String(pendingRegistration?.amount || selectedPrice)}
                serviceName={`${event.title} — ${selectedTicket === 'vip' ? 'VIP' : 'Standard'}`}
                onClose={() => setShowKkiapay(false)}
                onSuccess={handlePaymentSuccess}
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
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 10,
        zIndex: 10,
    },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featuredNavBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.12)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    featuredNavText: {
        ...typography.button, fontSize: 12,
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },

    /* ── Hero ── */
    heroContainer: {
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 28,
        position: 'relative',
    },
    dateGlow: { display: 'none' },
    dateCard: {
        backgroundColor: C.primary,
        borderRadius: 22,
        padding: 20,
        alignItems: 'center',
        minWidth: 110,
        borderWidth: 1.5,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 18,
        elevation: 10,
        marginBottom: 20,
    },
    dateDay: {
        ...typography.h1, fontSize: 56,
        color: C.primaryText,
        letterSpacing: -2,
    },
    dateDivider: {
        width: 50,
        height: 1.5,
        backgroundColor: C.accent,
        marginVertical: 6,
        opacity: 0.6,
    },
    dateMonth: {
        ...typography.button, fontSize: 13,
        color: C.accent,
        letterSpacing: 3,
    },
    dateYear: {
        ...typography.caption,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
        letterSpacing: 1,
    },
    heroBadges: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    catBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.surface,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    catDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.accent,
    },
    catText: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1,
    },
    registeredBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0, 135, 81, 0.12)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    registeredText: {
        ...typography.button, fontSize: 12,
        color: C.success,
        letterSpacing: 0.5,
    },
    title: {
        ...typography.h1, fontSize: 26,
        color: C.primary,
        letterSpacing: -0.5,
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    subtitle: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
        marginTop: 10,
        textAlign: 'center',
        paddingHorizontal: 16,
    },

    /* ── Meta Grid (2x2) ── */
    metaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 18,
    },
    metaCard: {
        flex: 1,
        minWidth: '47%',
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    metaIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    metaLabel: {
        ...typography.overline,
        color: C.textMuted,
        marginBottom: 3,
    },
    metaValue: {
        ...typography.label, fontSize: 12.5,
        color: C.primary,
        letterSpacing: -0.1,
    },

    /* ── Card générique ── */
    card: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 18,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    cardHeaderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        ...typography.button, fontSize: 14,
        color: C.primary,
        letterSpacing: -0.1,
        flex: 1,
    },
    freeBadge: {
        backgroundColor: 'rgba(0, 135, 81, 0.12)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    freeBadgeText: {
        ...typography.button, fontSize: 12,
        color: C.success,
        letterSpacing: 0.5,
    },
    description: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
    },

    /* ── Info Box ── */
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(0, 135, 81, 0.07)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.18)',
    },
    infoIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0, 135, 81, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoTitle: {
        ...typography.button, fontSize: 13,
        color: C.success,
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    infoText: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Bottom Bar ── */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 34 : 18,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderTopWidth: 1,
        borderTopColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 10,
    },
    bottomBarPrice: {
        flex: 0.85,
    },
    bottomBarLabel: {
        ...typography.overline,
        color: C.textSec,
        marginBottom: 2,
    },
    bottomBarValue: {
        ...typography.h3, fontSize: 18,
        color: C.primary,
        letterSpacing: -0.4,
    },
    btn: {
        flex: 1.15,
        flexDirection: 'row',
        height: 56,
        backgroundColor: C.primary,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    btnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
    },
    btnText: {
        color: C.primaryText,
        ...typography.button,
        letterSpacing: 0.2,
    },

    /* ── Inscrit (état) ── */
    registeredBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height: 60,
        backgroundColor: 'rgba(0, 135, 81, 0.10)',
        borderRadius: 14,
        paddingHorizontal: 18,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    registeredIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0, 135, 81, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    registeredBtnLabel: {
        ...typography.button, fontSize: 14,
        color: C.success,
        letterSpacing: -0.1,
    },
    registeredBtnSub: {
        ...typography.caption,
        color: C.textSec,
        marginTop: 2,
    },

    /* ═══ MODAL ═══ */
    modalOverlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBg: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 135, 81, 0.55)',
    },
    sheet: {
        backgroundColor: C.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        // paddingBottom fourni au montage depuis insets.bottom
        shadowColor: C.primary,
        shadowOpacity: 0.3,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: -15 },
        elevation: 20,
        borderTopWidth: 1,
        borderColor: C.border,
    },
    sheetHandle: {
        width: 44,
        height: 4,
        backgroundColor: C.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    sheetSubtitle: {
        ...typography.overline,
        color: C.accentDark,
        marginBottom: 4,
    },
    sheetTitle: {
        ...typography.h2,
        color: C.primary,
        letterSpacing: -0.4,
    },
    sheetCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetEvent: {
        ...typography.label,
        color: C.textSec,
        marginBottom: 18,
    },

    /* ── Recap ── */
    recap: {
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 14,
    },
    recapRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    recapIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.08)',
    },
    recapLabel: {
        flex: 1,
        ...typography.label, fontSize: 12.5,
        color: C.textSec,
        letterSpacing: 0.2,
    },
    recapValue: {
        ...typography.button, fontSize: 13,
        color: C.primary,
        letterSpacing: -0.1,
    },
    recapBadge: {
        backgroundColor: C.primary,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    recapBadgeText: {
        ...typography.button, fontSize: 12,
        color: C.accent,
        letterSpacing: 1,
    },
    recapPrice: {
        ...typography.h3, fontSize: 16,
        color: C.primary,
        letterSpacing: -0.3,
    },
    recapDivider: {
        height: 1,
        backgroundColor: C.border,
        marginVertical: 10,
    },

    /* ── Pay Notice ── */
    payNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(0, 100, 60, 0.08)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 100, 60, 0.2)',
        marginBottom: 16,
    },
    payNoticeText: {
        flex: 1,
        ...typography.caption,
        color: C.info,
    },

    /* ── Confirm button ── */
    confirmBtn: {
        height: 60,
        backgroundColor: C.primary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 10,
    },
    confirmBtnText: {
        color: C.primaryText,
        ...typography.button,
        letterSpacing: 0.2,
    },
    cancelBtn: {
        height: 50,
        backgroundColor: C.surface,
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        color: C.textSec,
        ...typography.button, fontSize: 14
    },
})