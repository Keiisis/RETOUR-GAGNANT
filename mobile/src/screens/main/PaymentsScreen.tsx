'use strict'
/* ═══════════════════════════════════════════════════════════
   PAIEMENTS

   Cet écran affichait des données ENTIÈREMENT FICTIVES : deux cartes
   bancaires au nom de « JEAN DUPONT », un solde de -219,48 €, et des
   transactions inventées (« Abonnement Premium », « Module Pro »,
   « Licence annuelle ») — des produits que l'agence ne vend pas.

   Deux corrections de fond :

   1. Les moyens de paiement enregistrés n'existent pas et ne peuvent pas
      exister : RGB encaisse via les widgets Kkiapay et FedaPay, qui ne
      conservent aucune carte côté marchand. On présente donc les canaux
      réellement acceptés, à titre d'information, sans prétendre qu'une
      carte est « enregistrée ».

   2. L'historique vient désormais des deux sources réelles déjà exposées
      à l'app : les commandes (/api/mobile/orders) et les factures
      (/api/mobile/invoices).
═══════════════════════════════════════════════════════════ */

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
    View, Text, ScrollView, StyleSheet, Pressable,
    ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { FlagBar } from '../../components/ui'
import { authHeaders } from '../../config/api'
import { fetchWithTimeout } from '../../lib/fetch'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

const C = screenColors
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* Une ligne d'historique, quelle que soit son origine. */
interface Entry {
    id: string
    title: string
    subtitle: string
    amount: number
    currency: string
    date: string
    paid: boolean
    icon: keyof typeof Ionicons.glyphMap
}

/* Canaux réellement acceptés par l'agence. Aucune carte n'est conservée :
   le paiement se fait dans le widget du prestataire, à chaque règlement. */
const CHANNELS: Array<{
    icon: keyof typeof Ionicons.glyphMap
    label: string
    detail: string
}> = [
    { icon: 'phone-portrait-outline', label: 'Mobile Money', detail: 'MTN, Moov — via Kkiapay' },
    { icon: 'card-outline', label: 'Carte bancaire', detail: 'Visa, Mastercard — via Kkiapay et FedaPay' },
    { icon: 'business-outline', label: 'Virement', detail: 'Sur demande, pour les montants importants' },
]

function AnimatedSection({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
    const anim = useSharedValue(0)
    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }))
    }, [delay])
    const s = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 18 * (1 - anim.value) }],
    }))
    return <Animated.View style={[s, style]}>{children}</Animated.View>
}

export default function PaymentsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [tab, setTab] = useState<'history' | 'channels'>('history')
    const [entries, setEntries] = useState<Entry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const formatPrice = (n: number, c: string) => {
        if (c === 'XOF' || c === 'XAF') return `${Math.round(n).toLocaleString('fr-FR')} FCFA`
        if (c === 'EUR') return `${n.toLocaleString('fr-FR')} €`
        return `${n} ${c}`
    }
    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

    /* ── Historique réel : commandes + factures ── */
    const fetchEntries = useCallback(async () => {
        if (!profile) { setLoading(false); return }
        try {
            const headers = { ...(await authHeaders()) }
            const [ordersRes, invoicesRes] = await Promise.all([
                fetchWithTimeout(`${API_BASE}/api/mobile/orders`, { timeoutMs: 10000, headers })
                    .then(r => r.json()).catch(() => ({})),
                fetchWithTimeout(`${API_BASE}/api/mobile/invoices`, { timeoutMs: 10000, headers })
                    .then(r => r.json()).catch(() => ({})),
            ])

            const fromOrders: Entry[] = (ordersRes?.orders || []).map((o: any) => ({
                id: `o_${o.id}`,
                title: o.product_title || t('Commande boutique'),
                subtitle: `${t('Commande')} · ${String(o.payment_method || '').toUpperCase() || t('En ligne')}`,
                amount: Number(o.amount) || 0,
                currency: o.currency || 'XOF',
                date: o.created_at,
                paid: o.payment_status === 'completed' || o.payment_status === 'paid',
                icon: 'bag-handle-outline',
            }))

            const fromInvoices: Entry[] = (invoicesRes?.invoices || []).map((f: any) => ({
                id: `f_${f.id}`,
                title: f.description || `${t('Facture')} ${f.invoice_ref || ''}`.trim(),
                subtitle: `${t('Facture')} ${f.invoice_ref || ''}`.trim(),
                amount: Number(f.amount) || 0,
                currency: f.currency || 'XOF',
                date: f.paid_at || f.issued_at,
                paid: f.status === 'paid' || !!f.paid_at,
                icon: 'receipt-outline',
            }))

            const all = [...fromOrders, ...fromInvoices]
                .filter(e => !!e.date)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setEntries(all)
        } catch { /* silencieux : l'état vide suffit */ } finally { setLoading(false) }
    }, [profile, t])

    useEffect(() => { fetchEntries() }, [fetchEntries])

    const onRefresh = async () => { setRefreshing(true); await fetchEntries(); setRefreshing(false) }

    /* Total réglé, calculé sur les seules lignes effectivement payées. */
    const totals = useMemo(() => {
        const paid = entries.filter(e => e.paid)
        const currency = paid[0]?.currency || 'XOF'
        const sum = paid
            .filter(e => e.currency === currency)
            .reduce((acc, e) => acc + e.amount, 0)
        return { sum, currency, count: paid.length }
    }, [entries])

    return (
        <View style={styles.container}>
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={t('Retour')}
                    hitSlop={8}
                    style={styles.iconContainer}
                >
                    <Ionicons name="arrow-back" size={20} color={C.text} />
                </Pressable>
                <Text style={styles.navTitle}>{t('Mes paiements')}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                }
            >
                <Text style={styles.subtitle}>
                    {t('Historique de vos règlements et moyens de paiement acceptés.')}
                </Text>

                {/* ── Total réglé ── */}
                <AnimatedSection delay={60}>
                    <View style={styles.summaryCard}>
                        <FlagBar height={5} radiusTop={false} />
                        <View style={styles.summaryBody}>
                            <Text style={styles.summaryLabel}>{t('TOTAL RÉGLÉ')}</Text>
                            <Text style={styles.summaryValue}>
                                {formatPrice(totals.sum, totals.currency)}
                            </Text>
                            <Text style={styles.summaryHint}>
                                {totals.count} {totals.count > 1 ? t('règlements') : t('règlement')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ── Onglets ── */}
                <View style={styles.tabs}>
                    {(['history', 'channels'] as const).map((k) => (
                        <Pressable
                            key={k}
                            onPress={() => setTab(k)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: tab === k }}
                            style={[styles.tab, tab === k && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                                {k === 'history' ? t('Historique') : t('Moyens acceptés')}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {tab === 'history' ? (
                    loading ? (
                        <View style={styles.center}><ActivityIndicator color={C.primary} /></View>
                    ) : entries.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIcon}>
                                <Ionicons name="receipt-outline" size={30} color={C.accentDark} />
                            </View>
                            <Text style={styles.emptyTitle}>{t('Aucun règlement')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Vos paiements apparaîtront ici après chaque commande ou prestation réglée.')}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.listCard}>
                            {entries.map((e, i) => (
                                <View
                                    key={e.id}
                                    style={[styles.row, i < entries.length - 1 && styles.rowBorder]}
                                >
                                    <View style={styles.rowIcon}>
                                        <Ionicons name={e.icon} size={19} color={C.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowTitle} numberOfLines={1}>{e.title}</Text>
                                        <Text style={styles.rowSub} numberOfLines={1}>
                                            {e.subtitle} · {formatDate(e.date)}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.rowAmount}>
                                            {formatPrice(e.amount, e.currency)}
                                        </Text>
                                        <View style={[
                                            styles.badge,
                                            { backgroundColor: e.paid ? C.surfaceSoft : C.accentSoft },
                                        ]}>
                                            <Text style={[
                                                styles.badgeText,
                                                { color: e.paid ? C.primary : C.accentDark },
                                            ]}>
                                                {e.paid ? t('Réglé') : t('En attente')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )
                ) : (
                    <>
                        <View style={styles.listCard}>
                            {CHANNELS.map((c, i) => (
                                <View
                                    key={c.label}
                                    style={[styles.row, i < CHANNELS.length - 1 && styles.rowBorder]}
                                >
                                    <View style={styles.rowIcon}>
                                        <Ionicons name={c.icon} size={19} color={C.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowTitle}>{t(c.label)}</Text>
                                        <Text style={styles.rowSub}>{t(c.detail)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Aucune carte n'est conservée : on le dit explicitement
                            plutôt que d'afficher de fausses cartes enregistrées. */}
                        <View style={styles.noticeCard}>
                            <Ionicons name="lock-closed-outline" size={17} color={C.primary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.noticeTitle}>{t('Aucune carte enregistrée')}</Text>
                                <Text style={styles.noticeText}>
                                    {t('Vos coordonnées bancaires ne sont jamais stockées. Le règlement se fait à chaque fois dans la fenêtre sécurisée de notre prestataire.')}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            onPress={() => Linking.openURL('tel:+2290160322121').catch(() => { })}
                            accessibilityRole="button"
                            accessibilityLabel={t('Appeler l\'agence')}
                            style={styles.helpBtn}
                        >
                            <Ionicons name="call-outline" size={18} color={C.primaryText} />
                            <Text style={styles.helpBtnText}>{t('Une question sur un paiement ?')}</Text>
                        </Pressable>
                    </>
                )}
            </ScrollView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },

    navBar: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md,
    },
    iconContainer: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    navTitle: { ...typography.h1, color: C.text, flex: 1 },

    scroll: { paddingHorizontal: 20 },
    subtitle: { ...typography.body, color: C.textMuted, marginBottom: spacing.lg },

    /* ── Total ── */
    summaryCard: {
        backgroundColor: C.surface, borderRadius: radius.xl,
        overflow: 'hidden', marginBottom: spacing.lg, ...shadows.cardRaised,
    },
    summaryBody: { padding: spacing.lg },
    summaryLabel: { ...typography.overline, fontSize: 11, color: C.textMuted },
    summaryValue: { ...typography.h1, color: C.text, marginTop: spacing.xs },
    summaryHint: { ...typography.bodySmall, color: C.textMuted, marginTop: spacing.xs },

    /* ── Onglets ── */
    tabs: {
        flexDirection: 'row', backgroundColor: C.surfaceAlt,
        borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg,
    },
    tab: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    tabActive: { backgroundColor: C.surface, ...shadows.card },
    tabText: { ...typography.label, color: C.textMuted },
    tabTextActive: { color: C.primary },

    /* ── Listes ── */
    listCard: {
        backgroundColor: C.surface, borderRadius: radius.xl,
        overflow: 'hidden', ...shadows.card,
    },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    rowIcon: {
        width: 42, height: 42, borderRadius: radius.lg,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    rowTitle: { ...typography.label, fontSize: 15, color: C.text },
    rowSub: { ...typography.caption, color: C.textMuted, marginTop: 2 },
    rowAmount: { ...typography.label, fontSize: 15, color: C.text },
    badge: {
        paddingHorizontal: spacing.sm, paddingVertical: 3,
        borderRadius: radius.pill, marginTop: 4,
    },
    badgeText: { ...typography.caption, fontSize: 11 },

    /* ── État vide ── */
    center: { paddingVertical: 48, alignItems: 'center' },
    emptyCard: {
        backgroundColor: C.surface, borderRadius: radius.xl,
        padding: spacing.xl, alignItems: 'center', ...shadows.card,
    },
    emptyIcon: {
        width: 68, height: 68, borderRadius: radius.xl,
        backgroundColor: C.accentSoft,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    },
    emptyTitle: { ...typography.h3, color: C.primary },
    emptyText: {
        ...typography.bodySmall, color: C.textMuted,
        textAlign: 'center', marginTop: spacing.sm,
    },

    /* ── Mention et aide ── */
    noticeCard: {
        flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
        backgroundColor: C.surfaceSoft, borderRadius: radius.xl,
        padding: spacing.md, marginTop: spacing.md,
    },
    noticeTitle: { ...typography.label, color: C.primary },
    noticeText: { ...typography.caption, color: C.textMuted, marginTop: 2 },
    helpBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, height: 52, borderRadius: radius.pill,
        backgroundColor: C.primary, marginTop: spacing.lg,
    },
    helpBtnText: { ...typography.button, color: C.primaryText },
})
