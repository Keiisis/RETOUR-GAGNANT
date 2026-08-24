'use strict'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { telechargerDocument } from '../../lib/documents'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, Linking, Pressable, Dimensions, Modal,
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
import { lireFactures, enregistrerFactures } from '../../lib/db/depots'
import { avecMemoire, cleDuClient, etatMemorise, aEnMemoire } from '../../lib/memoire'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'
import { localeActuelle } from '../../lib/dates'

/* ═══════════════════════════════════════════════════════════
   InvoicesScreen : THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
type Nav = NativeStackNavigationProp<RootStackParamList, 'Invoices'>

/* Un DEVIS et une FACTURE sont le même objet en base (`documents_financiers`,
   colonne `type`) : même numérotation, même PDF, même propriétaire. L'écran les
   affiche dans deux onglets, mais n'en manipule qu'un seul type de données. */
type TypeDoc = 'facture' | 'devis'

interface Invoice {
    id: string
    type?: TypeDoc
    invoice_ref: string
    numero?: string | null
    order_id?: string | null
    dossier_id?: string | null
    customer_name: string
    amount: number
    currency: string
    description: string | null
    status: string
    /** Statut d'origine du panel : « envoye », « signe », « accepte »… */
    raw_status?: string | null
    issued_at: string
    paid_at: string | null
    signed_at?: string | null
    validite?: string | null
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

/* Un devis ne se dit pas « payé » : il est envoyé, signé, accepté ou refusé.
   Afficher « En attente » sur un devis signé serait faux. */
const STATUT_DEVIS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    brouillon: { label: 'Brouillon', color: C.textMuted, bg: C.surfaceAlt, icon: 'document-outline' },
    envoye: { label: 'Reçu', color: C.info, bg: C.surfaceSoft, icon: 'mail-outline' },
    accepte: { label: 'Accepté', color: C.success, bg: C.primarySoft, icon: 'checkmark-circle' },
    signe: { label: 'Signé', color: C.success, bg: C.primarySoft, icon: 'create-outline' },
    refuse: { label: 'Refusé', color: C.error, bg: C.dangerSoft, icon: 'close-circle-outline' },
    expire: { label: 'Expiré', color: C.textMuted, bg: C.surfaceAlt, icon: 'time-outline' },
    paye: { label: 'Réglé', color: C.success, bg: C.primarySoft, icon: 'checkmark-circle' },
}

function configStatut(doc: Invoice) {
    if (doc.type === 'devis') {
        const brut = String(doc.raw_status || '').toLowerCase()
        return STATUT_DEVIS[brut]
            || (doc.signed_at ? STATUT_DEVIS.signe : STATUT_DEVIS.envoye)
    }
    return STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending
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

    const cfg = configStatut(invoice)
    const estDevis = invoice.type === 'devis'
    const isPaid = !estDevis && invoice.status === 'paid'

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
                            <LucideIcon
                                name={estDevis ? 'document-text-outline' : 'receipt-outline'}
                                size={11}
                                color={C.primary}
                            />
                            <Text style={styles.invRef}>{invoice.invoice_ref}</Text>
                        </View>

                        <Text style={styles.invDesc} numberOfLines={1}>
                            {t(invoice.description || (estDevis ? 'Devis' : 'Facture'))}
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
                                color={C.primary}
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
    /* Peinture au PREMIER rendu. La base SQLite etait bien lue, mais APRES un
       `await` : l'ecran commencait donc toujours par un rond qui tourne. MMKV
       est synchrone, la liste est donc deja la avant la premiere image ; SQLite
       reste la reserve durable et interrogeable. */
    /* Une seule reserve pour les deux onglets : devis et factures sont le meme
       document en base. La cle a change (`documents-affichage`) parce que
       l'ancienne ne contenait que des factures — et venait d'une table vide. */
    const cleDocs = cleDuClient(profile?.id, 'documents-affichage')
    const [docs, setDocs] = useState<Invoice[]>(() => etatMemorise<Invoice[]>(cleDocs, []))
    const [loading, setLoading] = useState(() => !aEnMemoire(cleDocs))
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all')
    const [onglet, setOnglet] = useState<TypeDoc>('facture')

    /* Les deux piles, tirees de la meme liste. */
    const factures = useMemo(() => docs.filter(d => d.type !== 'devis'), [docs])
    const devis = useMemo(() => docs.filter(d => d.type === 'devis'), [docs])
    const invoices = onglet === 'devis' ? devis : factures
    const estOngletDevis = onglet === 'devis'

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

        // Repli : la reserve SQLite, si la memoire rapide etait vide.
        if (!aEnMemoire(cleDocs)) {
            try {
                const locales = await lireFactures<Invoice>(profile.id)
                if (locales.length > 0) { setDocs(locales); setLoading(false) }
            } catch { /* confort seulement */ }
        }

        await avecMemoire<Invoice[]>(
            cleDocs,
            async () => {
                const res = await fetchWithTimeout(
                    `${API_BASE}/api/mobile/invoices`,
                    { timeoutMs: 10000, headers: { ...(await authHeaders()) } },
                )
                const data = await res.json().catch(() => ({}))
                /* La route sert les deux natures. Le `type` est pose ici pour
                   les documents anciens qui ne le portent pas : sans lui, un
                   devis atterrirait dans l'onglet des factures. */
                const f: Invoice[] = (data.invoices || []).map((d: Invoice) => ({ ...d, type: d.type || 'facture' }))
                const dv: Invoice[] = (data.devis || []).map((d: Invoice) => ({ ...d, type: 'devis' as const }))
                return [...f, ...dv]
            },
            (liste, depuisCache) => {
                setDocs(liste)
                setLoading(false)
                // La reserve durable n'est reecrite que sur du frais.
                if (!depuisCache) {
                    void enregistrerFactures(profile.id, liste as unknown as Array<Record<string, unknown>>)
                }
            },
        )
        setLoading(false)
    }, [profile, cleDocs])

    useEffect(() => { fetchInvoices() }, [fetchInvoices])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchInvoices()
        setRefreshing(false)
    }

    const formatPrice = (n: number, c: string) => {
        if (c === 'XOF' || c === 'XAF') return `${n.toLocaleString(localeActuelle())} FCFA`
        if (c === 'EUR') return `${n.toLocaleString(localeActuelle())} €`
        return `${n} ${c}`
    }

    const formatDate = (iso: string) => new Date(iso).toLocaleDateString(localeActuelle(), {
        day: '2-digit', month: 'short', year: 'numeric',
    })

    /* La facture s'ouvre DANS l'application, en fiche native. Auparavant on
       envoyait le client dans son navigateur, sur une page web où il n'était
       même pas connecté. */
    const [ouverte, setOuverte] = useState<Invoice | null>(null)
    const [telechargement, setTelechargement] = useState(false)

    const openInvoice = (inv: Invoice) => setOuverte(inv)

    /* Téléchargement : un VRAI PDF, produit par le générateur officiel de
       l'agence, remis au système (« Enregistrer », « Envoyer »). */
    const telecharger = async (inv: Invoice) => {
        const devisCi = inv.type === 'devis'
        setTelechargement(true)
        try {
            const r = await telechargerDocument(
                `${API_BASE}/api/mobile/invoices/${inv.id}/pdf`,
                `${devisCi ? 'Devis' : 'Facture'}-${inv.invoice_ref || inv.id}`,
            )
            if (!r.ok) {
                toast(t('Téléchargement impossible'), r.erreur || t('Réessayez dans un instant.'))
            } else if (!r.partage) {
                toast(
                    devisCi ? t('Devis enregistré') : t('Facture enregistrée'),
                    t('Le document est sur votre téléphone.'),
                )
            }
        } finally { setTelechargement(false) }
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

    /* Les filtres « Payées / En attente » n'ont de sens que pour des factures :
       un devis n'a pas d'echeance de paiement, il a un cycle de signature. */
    const filteredInvoices = useMemo(() => {
        if (estOngletDevis || filter === 'all') return invoices
        return invoices.filter(inv => inv.status === filter)
    }, [invoices, filter, estOngletDevis])

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
                        <LucideIcon name={estOngletDevis ? 'document-text' : 'receipt'} size={12} color={C.primary} />
                        <Text style={styles.navCounterText}>
                            {invoices.length}{' '}
                            {estOngletDevis
                                ? (invoices.length > 1 ? t('devis') : t('devis'))
                                : (invoices.length > 1 ? t('factures') : t('facture'))}
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
                                <LucideIcon
                                    name={estOngletDevis ? 'document-text-outline' : 'receipt-outline'}
                                    size={42}
                                    color={C.primary}
                                />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {estOngletDevis ? t('Aucun devis') : t('Aucune facture')}
                            </Text>
                            <Text style={styles.emptyText}>
                                {estOngletDevis
                                    ? t('Les devis établis par l’agence apparaîtront ici dès leur envoi.')
                                    : t('Vos factures apparaîtront ici après chaque commande ou prestation payée.')}
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
                                <LucideIcon name="arrow-forward" size={13} color={C.primary} />
                            </Pressable>
                        </View>
                    )
                }
                ListHeaderComponent={
                    <>
                        {/* HEADER TITRE + ONGLETS */}
                        <Animated.View style={[styles.headerContainer, styleHeader]}>
                            <Text style={styles.title}>{t('Mes documents')}</Text>
                            <Text style={styles.subtitle}>
                                {estOngletDevis
                                    ? t('Les devis reçus de l’agence, à consulter et à télécharger.')
                                    : t('Historique complet de votre facturation Retour Gagnant.')}
                            </Text>

                            {/* Deux natures de document, deux onglets : un devis
                                n'est pas une facture, et les mélanger dans une
                                seule liste rendait le total illisible. */}
                            <View style={styles.tabsWrap}>
                                {([['devis', 'Devis', devis.length], ['facture', 'Factures', factures.length]] as const).map(([cle, label, n]) => {
                                    const actif = onglet === cle
                                    return (
                                        <Pressable
                                            key={cle}
                                            onPress={() => { setOnglet(cle); setFilter('all') }}
                                            style={[styles.tabBtn, actif && styles.tabBtnActive]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: actif }}
                                        >
                                            <Text style={[styles.tabText, actif && styles.tabTextActive]}>
                                                {t(label)}{n > 0 ? ` (${n})` : ''}
                                            </Text>
                                        </Pressable>
                                    )
                                })}
                            </View>
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
                                            <LucideIcon name="wallet-outline" size={11} color={C.primary} />
                                            <Text style={styles.totalBadgeText}>
                                                {estOngletDevis ? t('TOTAL PROPOSÉ') : t('TOTAL FACTURÉ')}
                                            </Text>
                                        </View>

                                        <Text style={styles.totalAmount}>
                                            {formatPrice(stats.total, stats.currency)}
                                        </Text>

                                        <Text style={styles.totalSub}>
                                            {invoices.length}{' '}
                                            {estOngletDevis
                                                ? (invoices.length > 1 ? t('devis reçus') : t('devis reçu'))
                                                : (invoices.length > 1 ? t('factures émises') : t('facture émise'))}
                                        </Text>

                                        {/* Le partage payé / en attente ne concerne que des factures :
                                            un devis n'est pas une créance. */}
                                        {!estOngletDevis && <View style={styles.totalDivider} />}

                                        {!estOngletDevis && (
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
                                                    <LucideIcon name="time-outline" size={10} color={C.primary} />
                                                </View>
                                                <View>
                                                    <Text style={styles.totalSplitLabel}>{t('En attente')}</Text>
                                                    <Text style={styles.totalSplitValue}>
                                                        {formatPrice(stats.pending, stats.currency)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        )}
                                    </View>
                                </AnimatedSection>

                                {/* ═══ FILTRES STATUT (factures seulement) ═══ */}
                                {!estOngletDevis && (
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
                                )}
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
                                        {estOngletDevis
                                            ? t('Touchez un devis pour le consulter, le télécharger en PDF ou le partager.')
                                            : t('Touchez une facture pour la consulter, la télécharger en PDF ou la partager par email.')}
                                    </Text>
                                </View>
                            </View>
                        </AnimatedSection>
                    ) : null
                }
            />

            {/* ── Fiche de facture, en natif ──────────────────────────
                Le client voit son document dans l'application : émetteur,
                lignes, total, statut. Le PDF officiel reste à un geste. */}
            <Modal visible={!!ouverte} animationType="slide" onRequestClose={() => setOuverte(null)}>
                {!!ouverte && (
                    <View style={styles.container}>
                        <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                        <View style={ficheStyles.entete}>
                            <Pressable onPress={() => setOuverte(null)} style={ficheStyles.rond} hitSlop={10}
                                accessibilityRole="button" accessibilityLabel={t('Fermer')}>
                                <LucideIcon name="close-outline" size={20} color={C.text} />
                            </Pressable>
                            <Text style={ficheStyles.enteteTitre}>
                                {ouverte.type === 'devis' ? t('Devis') : t('Facture')}
                            </Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <ScrollView contentContainerStyle={ficheStyles.corps} showsVerticalScrollIndicator={false}>
                            <Text style={ficheStyles.ref}>{ouverte.invoice_ref || ouverte.id}</Text>
                            <Text style={ficheStyles.montant}>
                                {formatPrice(ouverte.amount, ouverte.currency)}
                            </Text>
                            {(() => {
                                const cfg = configStatut(ouverte)
                                const acquis = ouverte.type === 'devis'
                                    ? !!ouverte.signed_at || String(ouverte.raw_status) === 'accepte'
                                    : !!ouverte.paid_at || ouverte.status === 'paid'
                                return (
                                    <View style={[ficheStyles.statut, acquis && ficheStyles.statutPaye]}>
                                        <Text style={[ficheStyles.statutText, acquis && ficheStyles.statutTextPaye]}>
                                            {ouverte.type === 'devis'
                                                ? t(cfg.label)
                                                : (acquis ? t('Payée') : t('En attente de règlement'))}
                                        </Text>
                                    </View>
                                )
                            })()}

                            <View style={ficheStyles.carte}>
                                {(ouverte.type === 'devis'
                                    ? [
                                        [t('Établi le'), formatDate(ouverte.issued_at)],
                                        [t('Signé le'), ouverte.signed_at ? formatDate(ouverte.signed_at) : '—'],
                                        [t('Validité'), ouverte.validite || '—'],
                                        [t('Client'), ouverte.customer_name || '—'],
                                        [t('Objet'), ouverte.description || '—'],
                                    ]
                                    : [
                                        [t('Émise le'), formatDate(ouverte.issued_at)],
                                        [t('Réglée le'), ouverte.paid_at ? formatDate(ouverte.paid_at) : '—'],
                                        [t('Client'), ouverte.customer_name || '—'],
                                        [t('Objet'), ouverte.description || '—'],
                                    ]
                                ).map(([k, v]) => (
                                    <View key={k} style={ficheStyles.ligne}>
                                        <Text style={ficheStyles.ligneLabel}>{k}</Text>
                                        <Text style={ficheStyles.ligneValeur} numberOfLines={2}>{v}</Text>
                                    </View>
                                ))}
                            </View>

                            <Text style={ficheStyles.note}>
                                {ouverte.type === 'devis'
                                    ? t('Ce devis engage l’agence sur le prix indiqué pendant sa durée de validité.')
                                    : t('Le document officiel porte l’en-tête de l’agence et vaut justificatif comptable.')}
                            </Text>
                        </ScrollView>

                        <View style={[ficheStyles.bas, { paddingBottom: insets.bottom + 16 }]}>
                            <Pressable
                                onPress={() => telecharger(ouverte)}
                                disabled={telechargement}
                                style={({ pressed }) => [
                                    ficheStyles.cta,
                                    telechargement && { opacity: 0.5 },
                                    pressed && !telechargement && { transform: [{ scale: 0.98 }] },
                                ]}
                                accessibilityRole="button"
                            >
                                {telechargement ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <>
                                        <LucideIcon name="download-outline" size={17} color="#FFFFFF" />
                                        <Text style={ficheStyles.ctaText}>{t('Télécharger le PDF')}</Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    )
}

const ficheStyles = StyleSheet.create({
    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    enteteTitre: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    rond: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    corps: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24, alignItems: 'center' },
    ref: { fontFamily: fonts.bold, fontSize: 12, color: C.textMuted, letterSpacing: 0.6 },
    montant: { fontFamily: fonts.extrabold, fontSize: 30, color: '#00643C', marginTop: 8 },
    statut: { marginTop: 12, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.surfaceAlt },
    statutPaye: { backgroundColor: C.primarySoft },
    statutText: { fontFamily: fonts.bold, fontSize: 11, color: C.textSec, letterSpacing: 0.6, textTransform: 'uppercase' },
    statutTextPaye: { color: C.primary },

    carte: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginTop: 22 },
    ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    ligneLabel: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    ligneValeur: { flex: 1, textAlign: 'right', fontFamily: fonts.bodySemibold, fontSize: 12.5, color: C.text },
    note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: C.textMuted, textAlign: 'center', marginTop: 18 },

    bas: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    ctaText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#FFFFFF' },
})

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

    /* ── Onglets segmentés (Devis / Factures) — même pilule que
       l'écran des événements, pour un seul geste appris. ── */
    tabsWrap: {
        flexDirection: 'row',
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.lg,
        padding: 4,
        marginTop: spacing.lg,
        gap: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
    },
    tabBtnActive: {
        backgroundColor: C.surface,
        ...shadows.card,
    },
    tabText: {
        ...typography.button,
        fontSize: 13,
        color: C.textSec,
    },
    tabTextActive: { color: C.primary },

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
                color: C.primary,
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
        color: C.primaryText,
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