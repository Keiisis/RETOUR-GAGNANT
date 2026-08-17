/* ═══════════════════════════════════════════════════════════
   Mes Tickets — billets d'événement du client.

   Un pass acheté depuis l'application ne produisait AUCUN billet : le client
   n'avait rien à présenter à l'entrée. Le serveur émet désormais le billet dès
   que la place est acquise (gratuite, ou paiement vérifié auprès de la
   passerelle), et cet écran le présente.

   ANTI-FRAUDE : le QR porte une signature HMAC vérifiée au scan, le code est
   unique en base, et le premier scan invalide le billet. Un billet déjà scanné
   est affiché comme tel ici aussi — inutile d'espérer le repasser.

   Le billet complet (design fourni par l'équipe + QR injecté) est rendu par le
   serveur : on l'affiche dans une WebView et on peut le partager /
   l'enregistrer hors de l'application.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
    Modal, RefreshControl, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import {
    ChevronLeft, Ticket, QrCode, CheckCircle, Clock, MapPin,
    CalendarDays, X, Share2, Download,
} from 'lucide-react-native'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

interface TicketItem {
    registration_id: string
    event_id: string
    event_title: string
    event_date: string | null
    event_location: string | null
    ticket_type: string
    payment_status: string
    ticket_code: string | null
    is_used: boolean
    used_at: string | null
}

const dateFr = (iso: string | null) => {
    if (!iso) return ''
    try {
        return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    } catch { return '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TicketsScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const [tickets, setTickets] = useState<TicketItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [open, setOpen] = useState<TicketItem | null>(null)

    const charger = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/events/tickets`, {
                headers: { ...(await authHeaders()) },
                timeoutMs: 15000,
            })
            const json = await res.json().catch(() => ({}))
            setTickets(Array.isArray(json.tickets) ? json.tickets : [])
        } catch {
            /* liste vide : l'écran affiche son état vide */
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => { if (profile) charger(); else setLoading(false) }, [profile, charger])

    /* Un billet peut être émis pendant que l'écran est ouvert (paiement
       confirmé depuis l'écran événement) : on rafraîchit au retour. */
    useEffect(() => {
        const unsub = navigation?.addListener?.('focus', charger)
        return () => { if (typeof unsub === 'function') unsub() }
    }, [navigation, charger])

    const partager = async (ti: TicketItem) => {
        if (!ti.ticket_code) return
        const url = `${API_BASE}/api/tickets/${encodeURIComponent(ti.ticket_code)}`
        try {
            await Share.share({
                message: t('Mon billet pour « {e} » : {u}', { e: ti.event_title, u: url }),
                url,
            })
        } catch {
            toast(t('Partage impossible'), t('Réessayez dans un instant.'))
        }
    }

    const renderItem = ({ item }: { item: TicketItem }) => {
        const emis = !!item.ticket_code
        const attente = item.payment_status !== 'paid' && !emis
        return (
            <Pressable
                onPress={() => emis ? setOpen(item) : toast(
                    t('Billet en attente'),
                    t('Votre billet sera émis dès que le paiement sera confirmé.'),
                )}
                style={[styles.card, item.is_used && styles.cardUsed]}
                accessibilityRole="button"
            >
                <View style={styles.cardTop}>
                    <View style={[styles.iconTile, item.is_used && { backgroundColor: C.dangerSoft }]}>
                        {item.is_used
                            ? <CheckCircle size={20} color={C.danger} strokeWidth={2.2} />
                            : emis
                                ? <QrCode size={20} color={C.primary} strokeWidth={2.2} />
                                : <Clock size={20} color={C.textMuted} strokeWidth={2.2} />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.event_title}</Text>
                        <View style={styles.metaRow}>
                            {!!item.event_date && (
                                <View style={styles.metaItem}>
                                    <CalendarDays size={11} color={C.textMuted} />
                                    <Text style={styles.metaText}>{dateFr(item.event_date)}</Text>
                                </View>
                            )}
                            {!!item.event_location && (
                                <View style={styles.metaItem}>
                                    <MapPin size={11} color={C.textMuted} />
                                    <Text style={styles.metaText} numberOfLines={1}>{item.event_location}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={[styles.badge, item.ticket_type === 'vip' && styles.badgeVip]}>
                        <Text style={[styles.badgeText, item.ticket_type === 'vip' && styles.badgeTextVip]}>
                            {item.ticket_type === 'vip' ? 'VIP' : t('Standard')}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardBottom}>
                    {item.is_used ? (
                        <Text style={styles.usedText}>
                            {t('Déjà scanné')}{item.used_at ? ` · ${dateFr(item.used_at)}` : ''}
                        </Text>
                    ) : attente ? (
                        <Text style={styles.pendingText}>{t('En attente de paiement')}</Text>
                    ) : (
                        <Text style={styles.codeText}>{item.ticket_code}</Text>
                    )}
                    {emis && !item.is_used && (
                        <Text style={styles.openHint}>{t('Voir mon billet')}</Text>
                    )}
                </View>
            </Pressable>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Mes Tickets')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>
            ) : (
                <FlatList
                    data={tickets}
                    keyExtractor={i => i.registration_id}
                    renderItem={renderItem}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); charger() }}
                            tintColor={C.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ticket size={34} color={C.textMuted} />
                            <Text style={styles.emptyTitle}>{t('Aucun billet pour le moment')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Réservez votre place pour un événement : votre billet apparaîtra ici, prêt à être présenté à l’entrée.')}
                            </Text>
                            <Pressable onPress={() => navigation.navigate('Main', { screen: 'Events' })} style={styles.emptyBtn} accessibilityRole="button">
                                <Text style={styles.emptyBtnText}>{t('Voir les événements')}</Text>
                            </Pressable>
                        </View>
                    }
                />
            )}

            {/* Billet complet : design fourni par l'équipe, QR injecté par le serveur */}
            <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
                <View style={styles.viewerWrap}>
                    <View style={{ paddingTop: insets.top }}>
                        <FlagBar height={6} radiusTop={false} />
                    </View>
                    <View style={styles.header}>
                        <Pressable onPress={() => setOpen(null)} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Fermer')}>
                            <X size={22} color={C.text} strokeWidth={2.2} />
                        </Pressable>
                        <Text style={styles.headerTitle} numberOfLines={1}>{open?.event_title}</Text>
                        <Pressable onPress={() => open && partager(open)} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                            <Share2 size={19} color={C.text} strokeWidth={2} />
                        </Pressable>
                    </View>

                    {!!open?.ticket_code && (
                        <WebView
                            source={{ uri: `${API_BASE}/api/tickets/${encodeURIComponent(open.ticket_code)}` }}
                            style={{ flex: 1, backgroundColor: C.bg }}
                            startInLoadingState
                            renderLoading={() => (
                                <View style={styles.center}><ActivityIndicator color={C.primary} size="large" /></View>
                            )}
                        />
                    )}

                    <View style={[styles.viewerFooter, { paddingBottom: insets.bottom + 12 }]}>
                        <Pressable onPress={() => open && partager(open)} style={styles.dlBtn} accessibilityRole="button">
                            <Download size={17} color="#FFFFFF" strokeWidth={2} />
                            <Text style={styles.dlBtnText}>{t('Enregistrer / Partager mon billet')}</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    list: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, gap: spacing.md },

    card: { backgroundColor: C.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: C.border, padding: spacing.md, ...shadows.card },
    cardUsed: { opacity: 0.75 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    iconTile: { width: 42, height: 42, borderRadius: radius.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text, lineHeight: 20 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
    metaText: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    badge: { backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    badgeVip: { backgroundColor: '#FEF7DC' },
    badgeText: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 0.5 },
    badgeTextVip: { color: '#8A6D08' },

    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    codeText: { fontFamily: fonts.bold, fontSize: 13, color: C.text, letterSpacing: 0.6 },
    usedText: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.danger },
    pendingText: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.textMuted },
    openHint: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.primary },

    empty: { alignItems: 'center', gap: spacing.sm, paddingTop: 80, paddingHorizontal: spacing.lg },
    emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: C.text, marginTop: spacing.sm },
    emptyText: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
    emptyBtn: { marginTop: spacing.md, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12 },
    emptyBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },

    viewerWrap: { flex: 1, backgroundColor: C.bg },
    viewerFooter: { paddingHorizontal: spacing.gutter, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    dlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    dlBtnText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' },
})
