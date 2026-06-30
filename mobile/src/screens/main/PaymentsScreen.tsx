// src/screens/payments/PaymentsScreen.tsx
'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import {
    View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
    Platform, ActivityIndicator, Alert, Pressable, Dimensions,
    TouchableOpacity, RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'

/* ═══════════════════════════════════════════════════════════
   PaymentsScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen / EditProfilScreen)
═══════════════════════════════════════════════════════════ */
const { width } = Dimensions.get('window')

// Palette de l'agence
const C = {
    bg: '#FFFFFF',
    surface: 'rgba(255, 255, 255, 0.92)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(16, 185, 129, 0.12)',
    primary: '#047857',      // Émeraude Profond
    primaryDark: '#022C22',
    accent: '#C9A84C',       // Or
    accentLight: '#E2C97E',
    auraGreen: '#10B981',    // Émeraude vif
    error: '#EF4444',
    success: '#10B981',
    textSec: '#4A5568',
    textMuted: '#718096',
    placeholder: '#718096',
    primaryText: '#FFFFFF',
}

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */
type CardBrand = 'visa' | 'mastercard' | 'amex'
interface PaymentMethod {
    id: string
    brand: CardBrand
    last4: string
    holder: string
    expMonth: number
    expYear: number
    isDefault: boolean
}
interface Transaction {
    id: string
    title: string
    subtitle: string
    amount: number          // négatif = débit, positif = crédit
    currency: string
    date: string            // ISO
    status: 'completed' | 'pending' | 'failed'
    icon: keyof typeof Ionicons.glyphMap
}

/* ═══════════════════════════════════════════════════════════
   MOCK DATA (remplacer par fetch API)
═══════════════════════════════════════════════════════════ */
const MOCK_METHODS: PaymentMethod[] = [
    { id: 'pm_1', brand: 'visa', last4: '4242', holder: 'JEAN DUPONT', expMonth: 12, expYear: 2027, isDefault: true },
    { id: 'pm_2', brand: 'mastercard', last4: '8819', holder: 'JEAN DUPONT', expMonth: 8, expYear: 2026, isDefault: false },
]
const MOCK_TX: Transaction[] = [
    { id: 't1', title: 'Abonnement Premium', subtitle: 'Renouvellement mensuel', amount: -29.99, currency: '€', date: '2026-05-20', status: 'completed', icon: 'star-outline' },
    { id: 't2', title: 'Remboursement', subtitle: 'Commande #A1042', amount: 14.50, currency: '€', date: '2026-05-12', status: 'completed', icon: 'arrow-undo-outline' },
    { id: 't3', title: 'Achat Module Pro', subtitle: 'Licence annuelle', amount: -199.00, currency: '€', date: '2026-04-28', status: 'pending', icon: 'cube-outline' },
    { id: 't4', title: 'Frais de service', subtitle: 'Avril 2026', amount: -4.99, currency: '€', date: '2026-04-01', status: 'failed', icon: 'alert-circle-outline' },
]

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION (Stagger d'entrée)
═══════════════════════════════════════════════════════════ */
function AnimatedSection({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
    const anim = useSharedValue(0)
    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
    }, [delay])
    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))
    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   ECRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function PaymentsScreen({ navigation }: any) {
    const { user } = useAuth() as any
    const { t } = useLang()

    const [methods, setMethods] = useState<PaymentMethod[]>(MOCK_METHODS)
    const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TX)
    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [tab, setTab] = useState<'methods' | 'history'>('methods')

    /* ── Auras corporate (fond) ── */
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)
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
    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

    /* ── Actions ── */
    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        // TODO: refetch API
        setTimeout(() => setRefreshing(false), 900)
    }, [])

    const setDefault = (id: string) => {
        setMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })))
    }

    const removeMethod = (id: string) => {
        Alert.alert(
            t('Supprimer cette carte ?'),
            t('Cette action est définitive.'),
            [
                { text: t('Annuler'), style: 'cancel' },
                {
                    text: t('Supprimer'), style: 'destructive',
                    onPress: () => setMethods(prev => prev.filter(m => m.id !== id)),
                },
            ]
        )
    }

    const addMethod = () => {
        navigation?.navigate?.('AddPaymentMethod')
    }

    /* ── Calculs ── */
    const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0)
    const defaultMethod = methods.find(m => m.isDefault) || methods[0]

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            {/* 🎨 Auras premium */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={styles.navBar}>
                <Pressable onPress={() => navigation?.goBack?.()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>
                <Text style={styles.navTitle}>{t('Paiements')}</Text>
                <Pressable onPress={addMethod} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="add" size={24} color={C.primary} />
                    </View>
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                bounces
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                }
            >
                {/* HEADER TITRE */}
                <AnimatedSection delay={0}>
                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>{t('Votre')}</Text>
                        <Text style={styles.titleHighlight}>{t('portefeuille.')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Gérez vos moyens de paiement et suivez vos transactions en toute sécurité.')}
                        </Text>
                    </View>
                </AnimatedSection>

                {/* HERO CARD : Carte principale */}
                <AnimatedSection delay={120}>
                    <HeroCard method={defaultMethod} balance={balance} t={t} />
                </AnimatedSection>

                {/* TABS */}
                <AnimatedSection delay={220} style={{ marginTop: 28 }}>
                    <View style={styles.tabsContainer}>
                        <TabButton label={t('Moyens de paiement')} active={tab === 'methods'} onPress={() => setTab('methods')} />
                        <TabButton label={t('Historique')} active={tab === 'history'} onPress={() => setTab('history')} />
                    </View>
                </AnimatedSection>

                {/* CONTENU */}
                {tab === 'methods' ? (
                    <AnimatedSection delay={300} style={styles.section}>
                        {methods.length === 0 ? (
                            <EmptyState
                                icon="card-outline"
                                title={t('Aucune carte enregistrée')}
                                subtitle={t('Ajoutez votre première carte pour commencer.')}
                            />
                        ) : (
                            methods.map((m, i) => (
                                <MethodRow
                                    key={m.id}
                                    method={m}
                                    onSetDefault={() => setDefault(m.id)}
                                    onRemove={() => removeMethod(m.id)}
                                    t={t}
                                    delay={i * 80}
                                />
                            ))
                        )}

                        <InteractiveButton
                            title={t('Ajouter un moyen de paiement')}
                            icon="add-circle-outline"
                            onPress={addMethod}
                            loading={loading}
                        />
                    </AnimatedSection>
                ) : (
                    <AnimatedSection delay={300} style={styles.section}>
                        {transactions.length === 0 ? (
                            <EmptyState
                                icon="receipt-outline"
                                title={t('Aucune transaction')}
                                subtitle={t('Vos opérations apparaîtront ici.')}
                            />
                        ) : (
                            transactions.map((tx, i) => (
                                <TransactionRow key={tx.id} tx={tx} t={t} delay={i * 60} />
                            ))
                        )}
                    </AnimatedSection>
                )}

                {/* SECURITE */}
                <AnimatedSection delay={400} style={{ marginTop: 32 }}>
                    <View style={styles.securityBox}>
                        <View style={styles.securityIconWrap}>
                            <Ionicons name="shield-checkmark" size={20} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.securityTitle}>{t('Paiements sécurisés')}</Text>
                            <Text style={styles.securitySub}>
                                {t('Chiffrement bout-en-bout · PCI DSS · 3D Secure')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : HERO CARD (Carte de crédit premium)
═══════════════════════════════════════════════════════════ */
function HeroCard({ method, balance, t }: { method?: PaymentMethod; balance: number; t: (s: string) => string }) {
    const shine = useSharedValue(0)
    useEffect(() => {
        shine.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
    }, [])
    const shineStyle = useAnimatedStyle(() => ({
        opacity: interpolate(shine.value, [0, 1], [0.05, 0.18]),
        transform: [{ translateX: interpolate(shine.value, [0, 1], [-width * 0.3, width * 0.3]) }],
    }))

    return (
        <View style={styles.heroCard}>
            {/* Halo Or animé */}
            <Animated.View style={[styles.heroShine, shineStyle]} />

            <View style={styles.heroTop}>
                <View>
                    <Text style={styles.heroLabel}>{t('Solde net')}</Text>
                    <Text style={styles.heroBalance}>
                        {balance < 0 ? '-' : ''}{Math.abs(balance).toFixed(2)} €
                    </Text>
                </View>
                <View style={styles.heroBrandWrap}>
                    <Ionicons name="diamond-outline" size={18} color={C.accent} />
                    <Text style={styles.heroBrandText}>PREMIUM</Text>
                </View>
            </View>

            <View style={styles.heroChip}>
                <View style={styles.heroChipInner} />
            </View>

            <View style={styles.heroBottom}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.heroNumber}>
                        •••• •••• •••• {method?.last4 ?? '0000'}
                    </Text>
                    <View style={styles.heroMetaRow}>
                        <View>
                            <Text style={styles.heroMetaLabel}>{t('Titulaire')}</Text>
                            <Text style={styles.heroMetaValue}>{method?.holder ?? '—'}</Text>
                        </View>
                        <View style={{ marginLeft: 24 }}>
                            <Text style={styles.heroMetaLabel}>{t('Expire')}</Text>
                            <Text style={styles.heroMetaValue}>
                                {method ? `${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}` : '—/—'}
                            </Text>
                        </View>
                    </View>
                </View>
                <BrandLogo brand={method?.brand} />
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : BRAND LOGO
═══════════════════════════════════════════════════════════ */
function BrandLogo({ brand }: { brand?: CardBrand }) {
    if (brand === 'visa') return <Text style={[styles.brandText, { fontStyle: 'italic' }]}>VISA</Text>
    if (brand === 'mastercard') return (
        <View style={styles.mcWrap}>
            <View style={[styles.mcDot, { backgroundColor: '#EB001B', marginRight: -8 }]} />
            <View style={[styles.mcDot, { backgroundColor: '#F79E1B', opacity: 0.9 }]} />
        </View>
    )
    if (brand === 'amex') return <Text style={styles.brandText}>AMEX</Text>
    return <Ionicons name="card" size={28} color={C.accentLight} />
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : TAB BUTTON
═══════════════════════════════════════════════════════════ */
function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const anim = useSharedValue(active ? 1 : 0)
    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 180 })
    }, [active])
    const rStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(anim.value, [0, 1], ['transparent', C.surfaceSolid]),
        shadowOpacity: interpolate(anim.value, [0, 1], [0, 0.08]),
    }))
    const textStyle = useAnimatedStyle(() => ({
        color: interpolateColor(anim.value, [0, 1], [C.textSec, C.primary]),
    }))
    return (
        <Pressable onPress={onPress} style={{ flex: 1 }}>
            <Animated.View style={[styles.tabBtn, rStyle]}>
                <Animated.Text style={[styles.tabText, textStyle]}>{label}</Animated.Text>
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : METHOD ROW
═══════════════════════════════════════════════════════════ */
function MethodRow({
    method, onSetDefault, onRemove, t, delay,
}: {
    method: PaymentMethod
    onSetDefault: () => void
    onRemove: () => void
    t: (s: string) => string
    delay: number
}) {
    return (
        <AnimatedSection delay={delay}>
            <View style={styles.methodRow}>
                <View style={styles.methodBrand}>
                    <BrandLogo brand={method.brand} />
                </View>

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.methodTitle}>
                            {method.brand.toUpperCase()} •••• {method.last4}
                        </Text>
                        {method.isDefault && (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>{t('Par défaut')}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.methodSub}>
                        {t('Expire')} {String(method.expMonth).padStart(2, '0')}/{String(method.expYear).slice(-2)} · {method.holder}
                    </Text>
                </View>

                <View style={styles.methodActions}>
                    {!method.isDefault && (
                        <TouchableOpacity onPress={onSetDefault} hitSlop={10} style={styles.methodAction}>
                            <Ionicons name="star-outline" size={18} color={C.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.methodAction}>
                        <Ionicons name="trash-outline" size={18} color={C.error} />
                    </TouchableOpacity>
                </View>
            </View>
        </AnimatedSection>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : TRANSACTION ROW
═══════════════════════════════════════════════════════════ */
function TransactionRow({ tx, t, delay }: { tx: Transaction; t: (s: string) => string; delay: number }) {
    const isCredit = tx.amount > 0
    const statusColor =
        tx.status === 'completed' ? C.success :
            tx.status === 'pending' ? C.accent : C.error

    return (
        <AnimatedSection delay={delay}>
            <View style={styles.txRow}>
                <View style={[styles.txIconWrap, { backgroundColor: isCredit ? '#E8F3EE' : '#F1F5F9' }]}>
                    <Ionicons name={tx.icon} size={20} color={isCredit ? C.success : C.primary} />
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{tx.title}</Text>
                    <Text style={styles.txSub}>{tx.subtitle} · {formatDate(tx.date)}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: isCredit ? C.success : C.primary }]}>
                        {isCredit ? '+' : '-'}{Math.abs(tx.amount).toFixed(2)} {tx.currency}
                    </Text>
                    <View style={[styles.txStatusDot, { backgroundColor: statusColor }]}>
                        <Text style={styles.txStatusText}>
                            {tx.status === 'completed' ? t('Validée') : tx.status === 'pending' ? t('En cours') : t('Échouée')}
                        </Text>
                    </View>
                </View>
            </View>
        </AnimatedSection>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : EMPTY STATE
═══════════════════════════════════════════════════════════ */
function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }) {
    return (
        <View style={styles.empty}>
            <View style={styles.emptyIcon}>
                <Ionicons name={icon} size={28} color={C.accent} />
            </View>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptySub}>{subtitle}</Text>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : BOUTON INTERACTIF (identique RegisterScreen)
═══════════════════════════════════════════════════════════ */
function InteractiveButton({ title, onPress, disabled, loading, icon }: any) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.85}
            style={[styles.btn, (disabled || loading) && styles.btnDisabled, { marginTop: 20 }]}
        >
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    {icon && <Ionicons name={icon} size={18} color={C.accent} style={{ marginRight: 8 }} />}
                    <Text style={styles.btnText}>{title}</Text>
                    <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                </>
            )}
        </TouchableOpacity>
    )
}

/* ═══════════════════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════════════════ */
function formatDate(iso: string) {
    try {
        const d = new Date(iso)
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
        return iso
    }
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    /* ── Auras ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05,
    },
    aura1: { top: -100, right: -100, backgroundColor: C.primary },
    aura2: { bottom: 50, left: -100, backgroundColor: C.auraGreen },

    /* ── Nav ── */
    navBar: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
    },
    navBack: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    navTitle: { fontSize: 16, fontWeight: '700', color: C.primary, letterSpacing: 0.3 },
    iconContainer: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        justifyContent: 'center', alignItems: 'center',
    },

    scroll: { paddingHorizontal: 24, paddingBottom: 80 },

    /* ── Header ── */
    headerContainer: { marginTop: 8, marginBottom: 28 },
    title: { fontSize: 36, fontWeight: '700', color: C.primary, letterSpacing: -0.5 },
    titleHighlight: { fontSize: 36, fontWeight: '800', color: C.accent, letterSpacing: -0.5, marginTop: -4 },
    subtitle: { fontSize: 15, color: C.textSec, marginTop: 12, lineHeight: 22 },

    /* ── HERO CARD ── */
    heroCard: {
        height: 210,
        borderRadius: 24,
        backgroundColor: C.primary,
        padding: 22,
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
        elevation: 12,
    },
    heroShine: {
        position: 'absolute',
        top: -40, bottom: -40,
        width: 140,
        backgroundColor: C.accent,
        transform: [{ rotate: '18deg' }],
    },
    heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroLabel: { color: C.accentLight, fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
    heroBalance: { color: C.primaryText, fontSize: 30, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
    heroBrandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.35)',
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 12,
    },
    heroBrandText: { color: C.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    heroChip: {
        width: 38, height: 28,
        backgroundColor: C.accentLight,
        borderRadius: 6,
        marginTop: 14,
        padding: 4,
    },
    heroChipInner: {
        flex: 1,
        backgroundColor: C.accent,
        borderRadius: 3,
        opacity: 0.7,
    },
    heroBottom: {
        position: 'absolute',
        bottom: 22, left: 22, right: 22,
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    heroNumber: { color: C.primaryText, fontSize: 17, fontWeight: '600', letterSpacing: 2 },
    heroMetaRow: { flexDirection: 'row', marginTop: 10 },
    heroMetaLabel: { color: C.accentLight, fontSize: 9, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
    heroMetaValue: { color: C.primaryText, fontSize: 12, fontWeight: '600', marginTop: 2 },

    brandText: { color: C.primaryText, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
    mcWrap: { flexDirection: 'row', alignItems: 'center' },
    mcDot: { width: 22, height: 22, borderRadius: 11 },

    /* ── Tabs ── */
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#EEF1F5',
        borderRadius: 14,
        padding: 4,
    },
    tabBtn: {
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 0,
    },
    tabText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

    section: { marginTop: 18, gap: 12 },

    /* ── Method row ── */
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surfaceSolid,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 16,
        padding: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 1,
    },
    methodBrand: {
        width: 48, height: 36,
        borderRadius: 8,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    methodTitle: { fontSize: 14, fontWeight: '700', color: C.primary, letterSpacing: 0.3 },
    methodSub: { fontSize: 12, color: C.textSec, marginTop: 2 },
    methodActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    methodAction: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: C.bg,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.border,
    },
    defaultBadge: {
        marginLeft: 8,
        backgroundColor: 'rgba(212, 160, 23, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.35)',
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 8,
    },
    defaultBadgeText: { color: C.accent, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

    /* ── Transaction ── */
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surfaceSolid,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 16,
        padding: 14,
    },
    txIconWrap: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    txTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
    txSub: { fontSize: 12, color: C.textSec, marginTop: 2 },
    txAmount: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
    txStatusDot: {
        marginTop: 4,
        paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 8,
    },
    txStatusText: { color: C.primaryText, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },

    /* ── Empty ── */
    empty: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: C.border,
        borderStyle: 'dashed',
    },
    emptyIcon: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: 'rgba(212, 160, 23, 0.12)',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: C.primary },
    emptySub: { fontSize: 13, color: C.textSec, marginTop: 4, textAlign: 'center' },

    /* ── Bouton ── */
    btn: {
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
    },
    btnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
    btnText: { color: C.primaryText, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

    /* ── Security ── */
    securityBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 16,
        padding: 14,
    },
    securityIconWrap: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(212, 160, 23, 0.12)',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    securityTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
    securitySub: { fontSize: 12, color: C.textSec, marginTop: 2 },
})
