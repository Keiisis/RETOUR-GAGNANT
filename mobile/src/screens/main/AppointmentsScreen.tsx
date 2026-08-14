'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import { confirm, toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, FlatList, StyleSheet, TouchableOpacity,
    RefreshControl, Platform, ActivityIndicator, Modal,
    TextInput, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// Mappings rdv_requests (partagé avec le site web) ↔ affichage mobile
const APPT_TYPE_TO_RDV: Record<'video' | 'phone' | 'in_person', string> = { video: 'visio', phone: 'telephone', in_person: 'presentiel' }
const RDV_TYPE_TO_APPT: Record<string, 'video' | 'phone' | 'in_person'> = { visio: 'video', telephone: 'phone', presentiel: 'in_person' }
const RDV_STATUT_TO_APPT: Record<string, 'confirmed' | 'pending' | 'cancelled' | 'completed'> = {
    en_attente: 'pending', confirme: 'confirmed', confirmed: 'confirmed', annule: 'cancelled', cancelled: 'cancelled', termine: 'completed', completed: 'completed',
}

/* ═══════════════════════════════════════════════════════════
   AppointmentsScreen : THEME "CORPORATE PREMIUM 2026"
   (Aligné avec Register / Services / Signature / Boutique / About)
═══════════════════════════════════════════════════════════ */

const { width, height } = Dimensions.get('window')

// Palette de l'agence (strictement identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList, 'Appointments'>

/* ── Types ── */
interface AvailabilitySlot { heure: string; restant: number }
interface AvailabilityDay { date: string; ferme?: boolean; motif?: string; slots: AvailabilitySlot[] }

interface Appointment {
    id: string
    scheduled_at: string | null
    type: 'video' | 'phone' | 'in_person'
    status: 'confirmed' | 'pending' | 'cancelled' | 'completed'
    notes?: string
    agent_name?: string
}

const TYPE_CONFIG = {
    video: { icon: 'videocam-outline' as const, label: 'Visioconférence', shortLabel: 'Visio' },
    phone: { icon: 'call-outline' as const, label: 'Appel téléphonique', shortLabel: 'Appel' },
    in_person: { icon: 'location-outline' as const, label: 'En présentiel', shortLabel: 'Présentiel' },
}

const STATUS_CONFIG = {
    confirmed: { label: 'Confirmé', color: C.success, bg: C.surfaceSoft, dot: C.success },
    pending: { label: 'En attente', color: C.primary, bg: C.accentSoft, dot: C.accent },
    cancelled: { label: 'Annulé', color: C.error, bg: C.dangerSoft, dot: C.error },
    completed: { label: 'Terminé', color: C.textSec, bg: C.surfaceAlt, dot: C.textSec },
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
   COMPOSANT : APPOINTMENT CARD
═══════════════════════════════════════════════════════════ */

function AppointmentCard({
    appt, index, onCancel, t, formatDateShort,
}: {
    appt: Appointment
    index: number
    onCancel: (id: string) => void
    t: (s: string) => string
    formatDateShort: (iso: string | null) => { day: string; month: string }
}) {
    const enterAnim = useSharedValue(0)

    useEffect(() => {
        enterAnim.value = withDelay(
            index * 70,
            withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
        )
    }, [index])

    const enterStyle = useAnimatedStyle(() => ({
        opacity: enterAnim.value,
        transform: [{ translateY: 25 * (1 - enterAnim.value) }],
    }))

    const tc = TYPE_CONFIG[appt.type] || TYPE_CONFIG.phone
    const sc = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending
    const canCancel = appt.status === 'confirmed' || appt.status === 'pending'
    const { day, month } = formatDateShort(appt.scheduled_at)

    return (
        <Animated.View style={enterStyle}>
            <View style={styles.rdvCard}>
                {/* Colonne date */}
                <View style={styles.rdvDateCol}>
                    <Text style={styles.rdvDay}>{day}</Text>
                    <Text style={styles.rdvMonth}>{month}</Text>
                </View>

                <View style={styles.rdvDivider} />

                {/* Infos */}
                <View style={styles.rdvInfo}>
                    <View style={styles.rdvTypeRow}>
                        <LucideIcon name={tc.icon} size={13} color={C.primary} />
                        <Text style={styles.rdvType}>{t(tc.label)}</Text>
                    </View>

                    <View style={styles.rdvMeta}>
                        <LucideIcon name="time-outline" size={11} color={C.textMuted} />
                        <Text style={styles.rdvMetaText}>30 min</Text>
                        {appt.agent_name && (
                            <>
                                <Text style={styles.rdvMetaDot}>·</Text>
                                <Text style={styles.rdvMetaText} numberOfLines={1}>
                                    {appt.agent_name}
                                </Text>
                            </>
                        )}
                    </View>

                    <View style={[styles.rdvStatus, { backgroundColor: sc.bg }]}>
                        <View style={[styles.rdvStatusDot, { backgroundColor: sc.dot }]} />
                        <Text style={[styles.rdvStatusText, { color: sc.color }]}>
                            {t(sc.label)}
                        </Text>
                    </View>
                </View>

                {/* Action annuler */}
                {canCancel && (
                    <Pressable
                        onPress={() => onCancel(appt.id)}
                        style={styles.cancelBtn}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('Annuler ce rendez-vous')}
                    >
                        <LucideIcon name="close-circle-outline" size={22} color={C.error} />
                    </Pressable>
                )}
            </View>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : APPOINTMENTS
═══════════════════════════════════════════════════════════ */

export default function AppointmentsScreen({ navigation, route }: { navigation: Nav; route?: any }) {
    /* Arrivee depuis une fiche service : on ouvre le formulaire et on
       pre-remplit l'objet avec le nom de la prestation. */
    const openRequest = route?.params?.openRequest
    const serviceLabel = route?.params?.serviceLabel
    const { profile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

    /* ── Form état ── */
    const [formType, setFormType] = useState<'video' | 'phone' | 'in_person'>('video')
    const [formNotes, setFormNotes] = useState('')
    const [notesFocused, setNotesFocused] = useState(false)

    /* Creneaux REELS. La table rdv_requests impose date et heure NOT NULL :
       l'ancien formulaire envoyait null, donc toute demande echouait avec
       « La demande n'a pas pu etre envoyee ». On lit desormais les
       disponibilites calculees par /api/availability, la meme source que le
       site public : le client ne peut choisir qu'un creneau reellement libre. */
    const [days, setDays] = useState<AvailabilityDay[]>([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [formDate, setFormDate] = useState<string | null>(null)
    const [formHeure, setFormHeure] = useState<string | null>(null)

    const openDays = days.filter(d => !d.ferme && (d.slots?.length || 0) > 0)
    const selectedDay = openDays.find(d => d.date === formDate) || null

    useEffect(() => {
        if (!showModal || days.length > 0) return
        let alive = true
        setSlotsLoading(true)
        fetchWithTimeout(`${API_BASE}/api/availability?days=21`, { timeoutMs: 10000 })
            .then(r => r.json())
            .then((json) => {
                if (!alive) return
                const list: AvailabilityDay[] = Array.isArray(json?.jours) ? json.jours : []
                setDays(list)
                const first = list.find(d => !d.ferme && (d.slots?.length || 0) > 0)
                if (first) { setFormDate(first.date); setFormHeure(first.slots[0].heure) }
            })
            .catch(() => { if (alive) setDays([]) })
            .finally(() => { if (alive) setSlotsLoading(false) })
        return () => { alive = false }
    }, [showModal, days.length])

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const tabIndicator = useSharedValue(0)

    /* ── Modal sheet animation ── */
    const sheetAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

    }, [])

    useEffect(() => {
        tabIndicator.value = withSpring(tab === 'upcoming' ? 0 : 1, { damping: 18, stiffness: 180 })
    }, [tab])

    useEffect(() => {
        sheetAnim.value = withSpring(showModal ? 1 : 0, { damping: 20, stiffness: 180 })
    }, [showModal])

    useEffect(() => {
        if (!openRequest) return
        setShowModal(true)
        if (serviceLabel) setFormNotes(`Demande concernant : ${serviceLabel}.
`)
    }, [openRequest, serviceLabel])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(tabIndicator.value, [0, 1], [0, 1]) * (((width - 40 - 8) / 2)) }],
    }))

    const sheetStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
        transform: [{ translateY: interpolate(sheetAnim.value, [0, 1], [400, 0]) }],
    }))

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: sheetAnim.value,
    }))

    const fetchAppointments = useCallback(async () => {
        if (!profile) return
        try {
            // Source unifiée avec le site web : rdv_requests (vus par les agents)
            const { data } = await supabase
                .from('rdv_requests')
                .select('id, date, heure, type, motif, notes, statut, created_at')
                .or(`client_id.eq.${profile.id},client_email.eq.${profile.email}`)
                .order('created_at', { ascending: false })
                .limit(30)

            const mapped: Appointment[] = (data || []).map((r: Record<string, unknown>) => {
                const date = r.date as string | null
                const heure = (r.heure as string | null) || '09:00'
                const rawNotes = String(r.notes || '')
                const msg = rawNotes.includes('Message:') ? rawNotes.split('Message:')[1].trim() : rawNotes
                return {
                    id: String(r.id),
                    scheduled_at: date ? `${date}T${heure.length === 5 ? heure : '09:00'}:00` : null,
                    type: RDV_TYPE_TO_APPT[String(r.type)] || 'phone',
                    status: RDV_STATUT_TO_APPT[String(r.statut)] || 'pending',
                    notes: msg || String(r.motif || ''),
                }
            })
            setAppointments(mapped)
        } catch { /* ignore */ } finally { setLoading(false) }
    }, [profile])

    useEffect(() => { fetchAppointments() }, [fetchAppointments])

    const onRefresh = async () => {
        setRefreshing(true)
        await fetchAppointments()
        setRefreshing(false)
    }

    const now = new Date()
    const upcoming = appointments.filter(a =>
        (!a.scheduled_at || new Date(a.scheduled_at) >= now) &&
        a.status !== 'cancelled' && a.status !== 'completed'
    )
    const past = appointments.filter(a =>
        (a.scheduled_at && new Date(a.scheduled_at) < now) ||
        a.status === 'cancelled' || a.status === 'completed'
    )
    const displayed = tab === 'upcoming' ? upcoming : past

    /* ── Demander un RDV ── */
    const handleRequestAppointment = async () => {
        if (!formDate || !formHeure) {
            toast(t('Créneau requis'), t('Choisissez une date et une heure disponibles.'))
            return
        }
        if (!formNotes.trim()) {
            toast(t('Champ requis'), t("Décrivez brièvement l'objet de votre rendez-vous."))
            return
        }

        setSubmitting(true)
        try {
            // ── Anti-doublon : on ne commande pas deux fois le même service. ──
            // Si un dossier ACTIF existe déjà pour ce service, on n'ouvre ni RDV
            // ni nouveau dossier : le client interagit via la messagerie.
            if (serviceLabel) {
                const { data: existingDossier } = await supabase.from('dossiers')
                    .select('id')
                    .eq('client_id', profile!.id)
                    .eq('service_type', serviceLabel)
                    .in('status', ['soumis', 'en_attente', 'verifie', 'en_cours', 'traitement', 'validation'])
                    .limit(1)
                    .maybeSingle()
                if (existingDossier) {
                    setSubmitting(false)
                    confirm({
                        title: t('Dossier déjà ouvert'),
                        message: t('Vous avez déjà un dossier en cours pour ce service. Pour toute question ou mise à jour, contactez votre conseiller par message.'),
                        confirmLabel: t('Envoyer un message'),
                        cancelLabel: t('Fermer'),
                        onConfirm: () => { setShowModal(false); (navigation as any).navigate('Main', { screen: 'Messages' }) },
                    })
                    return
                }
            }

            const rdvType = APPT_TYPE_TO_RDV[formType]
            const clientName = `${profile!.prenom || ''} ${profile!.nom || ''}`.trim() || (profile!.email || '')

            // 1. Écriture dans rdv_requests (table partagée, vue par les agents dans l'agenda)
            const { data: inserted, error } = await supabase.from('rdv_requests').insert({
                client_id: profile!.id,
                client_email: profile!.email,
                date: formDate,
                heure: formHeure,
                type: rdvType,
                motif: 'Consultation',
                notes: formNotes.trim(),
                statut: 'en_attente',
            }).select('id').single()

            if (error) throw error

            // 1.5 Ouvrir un DOSSIER « soumis » associé au service.
            //     Logique métier : une prise de rendez-vous POUR UN SERVICE
            //     (Passeport, Business…) ouvre un dossier suivi dans « Mon Dossier »,
            //     dont le statut évolue ensuite quand l'agent/admin le déplace.
            //     Sans service (RDV générique via l'accueil), on n'ouvre pas de dossier.
            //     L'API dédoublonne par service_type : pas de dossier en double.
            if (serviceLabel) {
                try {
                    await fetchWithTimeout(`${API_BASE}/api/mobile/dossiers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                        timeoutMs: 15000,
                        body: JSON.stringify({
                            service_type: serviceLabel,
                            notes: `Dossier ouvert suite à une prise de rendez-vous le ${new Date().toLocaleDateString('fr-FR')} (${formDate} à ${formHeure}).\n${formNotes.trim()}`,
                        }),
                    })
                } catch { /* non bloquant : le RDV reste enregistré même si l'ouverture du dossier échoue */ }
            }

            // 2. Notification staff (email admin/agent) : même chemin que le panel web
            fetchWithTimeout(`${API_BASE}/api/rdv/confirm-client`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 12000,
                body: JSON.stringify({
                    rdvId: inserted?.id,
                    clientName,
                    clientEmail: profile!.email,
                    service: 'Consultation',
                    date: formDate,
                    heure: formHeure,
                    type: rdvType,
                }),
            }).catch(() => { /* non bloquant */ })

            // 3. Notification locale au client (informative)
            await supabase.from('notifications').insert({
                user_id: profile!.id,
                title: 'Demande de RDV envoyée',
                body: 'Notre équipe vous contactera sous 24h pour confirmer votre rendez-vous.',
                type: 'appointment',
                is_read: false,
                created_at: new Date().toISOString(),
            })

            setShowModal(false)
            setFormNotes('')
            toast(
                t('Demande envoyée'),
                serviceLabel
                    ? t('Votre dossier est ouvert (statut : soumis) et visible dans « Mon Dossier ». Notre équipe vous contactera sous 24h pour votre rendez-vous.')
                    : t("Notre équipe vous contactera sous 24h pour confirmer la date et l'heure de votre rendez-vous."),
            )
            await fetchAppointments()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('Erreur')
            toast(t('Erreur'), msg)
        } finally {
            setSubmitting(false)
        }
    }

    /* ── Annuler un RDV ── */
    const handleCancel = (id: string) => {
        confirm({
            title: t('Annuler le rendez-vous'),
            message: t('Êtes-vous sûr de vouloir annuler ce rendez-vous ?'),
            confirmLabel: t('Oui, annuler'),
            cancelLabel: t('Non'),
            destructive: true,
            onConfirm: async () => {
                const { error } = await supabase.from('rdv_requests').update({ statut: 'annule' }).eq('id', id)
                if (error) {
                    toast(t('Erreur'), t("L'annulation a échoué. Réessayez."))
                    return
                }
                setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a))
                toast(t('Rendez-vous annulé'), undefined, 'success')
            },
        })
    }

    const formatDateTime = (iso: string | null) => {
        if (!iso) return t('Date à confirmer')
        const d = new Date(iso)
        return d.toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDateShort = (iso: string | null) => {
        if (!iso) return { day: '-', month: '' }
        const d = new Date(iso)
        return {
            day: d.toLocaleDateString('fr-FR', { day: '2-digit' }),
            month: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase(),
        }
    }

    const nextRdv = upcoming[0]

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

                <Pressable onPress={() => setShowModal(true)} style={styles.navAddBtn}
                    accessibilityRole="button"
                    hitSlop={6}>
                    <LucideIcon name="add" size={18} color={C.primaryText} />
                    <Text style={styles.navAddText}>{t('Demander')}</Text>
                </Pressable>
            </View>

            <FlatList
                data={loading ? [] : displayed}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => (
                    <View style={styles.rdvList}>
                        <AppointmentCard
                            appt={item}
                            index={index}
                            onCancel={handleCancel}
                            t={t}
                            formatDateShort={formatDateShort}
                        />
                    </View>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
                }
                ListEmptyComponent={
                    loading ? (
                        <View style={styles.centerState}>
                            <ActivityIndicator color={C.primary} size="large" />
                            <Text style={styles.loadingText}>{t('Chargement de vos rendez-vous...')}</Text>
                        </View>
                    ) : (
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconWrap}>
                                <LucideIcon name="calendar-outline" size={36} color={C.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {tab === 'upcoming'
                                    ? t('Aucun rendez-vous à venir')
                                    : t('Aucun rendez-vous passé')}
                            </Text>
                            <Text style={styles.emptyText}>
                                {tab === 'upcoming'
                                    ? t('Demandez un rendez-vous avec notre équipe pour discuter de votre dossier.')
                                    : t("L'historique de vos rendez-vous apparaîtra ici.")}
                            </Text>
                            {tab === 'upcoming' && (
                                <TouchableOpacity
                                    style={styles.emptyBtn}
                                    onPress={() => { Haptics.selectionAsync(); setShowModal(true) }}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <LucideIcon name="calendar" size={16} color={C.primary} style={{ marginRight: 8 }} />
                                    <Text style={styles.emptyBtnText}>{t('Prendre rendez-vous')}</Text>
                                    <LucideIcon name="arrow-forward" size={16} color={C.primary} style={{ marginLeft: 8 }} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )
                }
                ListHeaderComponent={
                    <>
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Mes rendez-vous')}</Text>
                    <Text style={styles.subtitle}>
                        {upcoming.length > 0
                            ? `${upcoming.length} ${upcoming.length > 1 ? t('rendez-vous à venir avec votre équipe.') : t('rendez-vous à venir avec votre équipe.')}`
                            : t('Échangez avec votre équipe dédiée à tout moment.')}
                    </Text>
                </Animated.View>

                {/* ═══ PROCHAIN RDV HIGHLIGHT (Card Bleu massif corporate) ═══ */}
                {nextRdv && (
                    <AnimatedSection delay={150}>
                        <View style={styles.nextRdvCard}>
                            {/* Halo doré en arrière-plan */}
                            <View style={styles.nextRdvGlow} />

                            <View style={styles.nextRdvBadge}>
                                <View style={styles.nextRdvBadgeDot} />
                                <Text style={styles.nextRdvBadgeText}>
                                    {t('PROCHAIN RENDEZ-VOUS')}
                                </Text>
                            </View>

                            <Text style={styles.nextRdvTitle}>
                                {t(TYPE_CONFIG[nextRdv.type]?.label || 'Rendez-vous')}
                            </Text>

                            <View style={styles.nextRdvDivider} />

                            <View style={styles.nextRdvRow}>
                                <View style={styles.nextRdvIconWrap}>
                                    <LucideIcon name="calendar-outline" size={14} color={C.primary} />
                                </View>
                                <Text style={styles.nextRdvDate}>
                                    {formatDateTime(nextRdv.scheduled_at)}
                                </Text>
                            </View>

                            {nextRdv.agent_name && (
                                <View style={styles.nextRdvRow}>
                                    <View style={styles.nextRdvIconWrap}>
                                        <LucideIcon name="person-outline" size={14} color={C.primary} />
                                    </View>
                                    <Text style={styles.nextRdvDate}>
                                        {t('Avec')} {nextRdv.agent_name}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.nextRdvRow}>
                                <View style={styles.nextRdvIconWrap}>
                                    <LucideIcon
                                        name={TYPE_CONFIG[nextRdv.type]?.icon || 'call-outline'}
                                        size={14}
                                        color={C.primary}
                                    />
                                </View>
                                <Text style={styles.nextRdvDate}>
                                    {t(TYPE_CONFIG[nextRdv.type]?.label)} · 30 min
                                </Text>
                            </View>
                        </View>
                    </AnimatedSection>
                )}

                {/* ═══ TABS ═══ */}
                <AnimatedSection delay={250}>
                    <View style={styles.tabsWrap}>
                        <Animated.View style={[styles.tabIndicator, indicatorStyle]} />
                        {(['upcoming', 'past'] as const).map((tabKey, i) => (
                            <Pressable
                                key={tabKey}
                                style={styles.tab}
                                onPress={() => setTab(tabKey)}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={[styles.tabText, tab === tabKey && styles.tabTextActive]}>
                                    {tabKey === 'upcoming' ? t('À venir') : t('Passés')}
                                </Text>
                                <View style={[styles.tabBadge, tab === tabKey && styles.tabBadgeActive]}>
                                    <Text style={[styles.tabBadgeText, tab === tabKey && styles.tabBadgeTextActive]}>
                                        {tabKey === 'upcoming' ? upcoming.length : past.length}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </AnimatedSection>
                    </>
                }
            />

            {/* ═══ MODAL DEMANDE DE RDV ═══ */}
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

                        <Animated.View style={[styles.modalSheet, sheetStyle, { paddingBottom: insets.bottom + 20 }]}>
                            <View style={styles.modalHandle} />

                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={styles.modalSubtitle}>{t('Nouvelle demande')}</Text>
                                    <Text style={styles.modalTitle}>{t('Demander un rendez-vous')}</Text>
                                </View>
                                <Pressable onPress={() => setShowModal(false)} style={styles.modalCloseBtn}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                    accessibilityLabel={t('Fermer')}>
                                    <LucideIcon name="close" size={20} color={C.primary} />
                                </Pressable>
                            </View>

                            <Text style={styles.modalSub}>
                                {t('Notre équipe vous confirmera la date sous 24 heures.')}
                            </Text>

                            {/* Type de RDV */}
                            <Text style={styles.modalLabel}>{t('Type de rendez-vous')}</Text>
                            <View style={styles.typeRow}>
                                {(Object.entries(TYPE_CONFIG) as [keyof typeof TYPE_CONFIG, typeof TYPE_CONFIG[keyof typeof TYPE_CONFIG]][]).map(([key, cfg]) => {
                                    const active = formType === key
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[styles.typeBtn, active && styles.typeBtnActive]}
                                            onPress={() => setFormType(key)}
                                            activeOpacity={0.8}
                                            accessibilityRole="button"
                                            hitSlop={6}
                                        >
                                            <View style={[styles.typeIconWrap, active && styles.typeIconWrapActive]}>
                                                <LucideIcon
                                                    name={cfg.icon}
                                                    size={18}
                                                    color={active ? C.accent : C.textSec}
                                                />
                                            </View>
                                            <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]}>
                                                {t(cfg.shortLabel)}
                                            </Text>
                                            {active && (
                                                <View style={styles.typeCheckBadge}>
                                                    <LucideIcon name="checkmark" size={10} color={C.primaryText} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>

                            {/* Créneau : jours réellement ouverts */}
                            <View style={styles.labelRow}>
                                <Text style={styles.modalLabel}>{t('Date souhaitée')}</Text>
                                <Text style={styles.required}>{t('Requis')}</Text>
                            </View>

                            {slotsLoading ? (
                                <View style={styles.slotsLoading}>
                                    <ActivityIndicator size="small" color={C.primary} />
                                </View>
                            ) : openDays.length === 0 ? (
                                <Text style={styles.slotsEmpty}>
                                    {t('Aucun créneau ouvert sur les 3 prochaines semaines. Contactez-nous par téléphone.')}
                                </Text>
                            ) : (
                                <>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.dayRow}
                                    >
                                        {openDays.map((d) => {
                                            const active = formDate === d.date
                                            const dt = new Date(`${d.date}T12:00:00`)
                                            return (
                                                <Pressable
                                                    key={d.date}
                                                    onPress={() => { setFormDate(d.date); setFormHeure(d.slots[0]?.heure || null) }}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: active }}
                                                    style={[styles.dayChip, active && styles.dayChipActive]}
                                                >
                                                    <Text style={[styles.dayChipWeek, active && styles.dayChipTextActive]}>
                                                        {dt.toLocaleDateString('fr-FR', { weekday: 'short' })}
                                                    </Text>
                                                    <Text style={[styles.dayChipNum, active && styles.dayChipTextActive]}>
                                                        {dt.getDate()}
                                                    </Text>
                                                    <Text style={[styles.dayChipMonth, active && styles.dayChipTextActive]}>
                                                        {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                                                    </Text>
                                                </Pressable>
                                            )
                                        })}
                                    </ScrollView>

                                    <Text style={styles.modalLabel}>{t('Heure')}</Text>
                                    <View style={styles.slotGrid}>
                                        {(selectedDay?.slots || []).map((sl) => {
                                            const active = formHeure === sl.heure
                                            return (
                                                <Pressable
                                                    key={sl.heure}
                                                    onPress={() => setFormHeure(sl.heure)}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: active }}
                                                    style={[styles.slotChip, active && styles.slotChipActive]}
                                                >
                                                    <Text style={[styles.slotChipText, active && styles.slotChipTextActive]}>
                                                        {sl.heure}
                                                    </Text>
                                                </Pressable>
                                            )
                                        })}
                                    </View>
                                </>
                            )}

                            {/* Notes */}
                            <View style={styles.labelRow}>
                                <Text style={styles.modalLabel}>{t('Objet et disponibilités')}</Text>
                                <Text style={styles.required}>{t('Requis')}</Text>
                            </View>

                            <View style={[styles.notesWrap, notesFocused && styles.notesWrapFocused]}>
                                <TextInput
                                    style={styles.notesInput}
                                    value={formNotes}
                                    onChangeText={setFormNotes}
                                    onFocus={() => setNotesFocused(true)}
                                    onBlur={() => setNotesFocused(false)}
                                    placeholder={t("Ex : Suivi de mon dossier nationalité, disponible lundi et mercredi matin…")}
                                    placeholderTextColor={C.placeholder}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                                onPress={handleRequestAppointment}
                                disabled={submitting}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                {submitting ? (
                                    <ActivityIndicator color={C.primaryText} size="small" />
                                ) : (
                                    <>
                                        <LucideIcon name="paper-plane-outline" size={18} color={C.primary} style={{ marginRight: 8 }} />
                                        <Text style={styles.submitBtnText}>{t('Envoyer la demande')}</Text>
                                        <LucideIcon name="arrow-forward" size={18} color={C.primary} style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Modal>
            )}
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
    navAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        height: 40,
        paddingHorizontal: spacing.md,
        borderRadius: radius.xl,
        backgroundColor: C.primary,
        ...shadows.card,
    },
    navAddText: {
        color: C.primaryText,
        ...typography.button, fontSize: 13,
                letterSpacing: 0.2,
    },

    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: 40,
    },

    /* ── Header (identique RegisterScreen) ── */
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

    /* ── Next RDV Card (Bleu massif corporate) ── */
    nextRdvCard: {
        backgroundColor: C.primary,
        borderRadius: radius.xl,
        padding: spacing.gutter,
        marginBottom: spacing.lg,
        overflow: 'hidden',
        ...shadows.card,
    },
    nextRdvGlow: { display: 'none' },
    nextRdvBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    nextRdvBadgeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.accent,
    },
    nextRdvBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.primaryText,
        letterSpacing: 1.2,
    },
    nextRdvTitle: {
        ...typography.h2,
                color: C.primaryText,
        letterSpacing: -0.3,
        marginBottom: 12,
    },
    nextRdvDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginBottom: spacing.md,
    },
    nextRdvRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    nextRdvIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    nextRdvDate: {
        ...typography.label,
        color: 'rgba(255,255,255,0.85)',
                flex: 1,
    },

    /* ── Tabs ── */
    tabsWrap: {
        flexDirection: 'row',
        backgroundColor: C.surface,
        borderRadius: radius.md,
        padding: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.gutter,
        position: 'relative',
    },
    tabIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        width: '50%',
        backgroundColor: C.primary,
        borderRadius: radius.xs,
        marginLeft: -4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        zIndex: 1,
    },
    tabText: {
        ...typography.label,
                color: C.textSec,
        letterSpacing: 0.2,
    },
    tabTextActive: {
        color: C.primaryText,
        fontFamily: fonts.bold,
    },
    tabBadge: {
        minWidth: 22,
        height: 18,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.xs,
        backgroundColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabBadgeActive: {
        backgroundColor: C.accent,
    },
    tabBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
    },
    tabBadgeTextActive: {
        color: C.primaryText,
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

    /* ── Empty Card ── */
    emptyCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    emptyIconWrap: {
        width: 72,
        height: 72,
        borderRadius: radius.xl,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h3,
                color: C.primary,
        marginBottom: spacing.sm,
        letterSpacing: -0.3,
        textAlign: 'center',
    },
    emptyText: {
        ...typography.label,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.gutter,
            },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.primary,
        height: 50,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        ...shadows.card,
    },
    emptyBtnText: {
        color: C.primaryText,
        ...typography.button, fontSize: 14,
                letterSpacing: 0.2,
    },

    /* ── RDV List ── */
    rdvList: {
        gap: spacing.sm,
    },
    rdvCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    rdvDateCol: {
        width: 52,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    rdvDay: {
        ...typography.h3, fontSize: 18,
                color: C.primary,
        letterSpacing: -0.5,
    },
    rdvMonth: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 1,
        marginTop: spacing.xxs,
    },
    rdvDivider: {
        width: 1,
        height: 50,
        backgroundColor: C.border,
        marginHorizontal: 12,
    },
    rdvInfo: {
        flex: 1,
        gap: spacing.xs,
    },
    rdvTypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rdvType: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.2,
    },
    rdvMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rdvMetaText: {
        ...typography.caption,
        color: C.textSec,
                flexShrink: 1,
    },
    rdvMetaDot: {
        fontSize: 12,
        color: C.textMuted,
    },
    rdvStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.xs,
        marginTop: spacing.xxs,
    },
    rdvStatusDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    rdvStatusText: {
        ...typography.button, fontSize: 12,
                letterSpacing: 0.3,
    },
    cancelBtn: {
        marginLeft: spacing.sm,
        padding: spacing.xs,
    },

    /* ═══ MODAL ═══ */
    modalOverlayContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBg: {
        ...StyleSheet.absoluteFill,
        backgroundColor: C.surfaceSoft,
    },
    modalSheet: {
        backgroundColor: C.bg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: spacing.lg,
        paddingTop: 12,
        // paddingBottom fourni au montage depuis insets.bottom
        ...shadows.card,
        shadowOffset: { width: 0, height: -15 },
        elevation: 20,
        borderTopWidth: 1,
        borderColor: C.border,
    },
    modalHandle: {
        width: 44,
        height: 4,
        backgroundColor: C.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    modalSubtitle: {
        ...typography.overline,
                color: C.primary,
        marginBottom: spacing.xs,
    },
    slotsLoading: { paddingVertical: spacing.lg, alignItems: 'center' },
    slotsEmpty: { ...typography.bodySmall, color: C.textMuted, paddingVertical: spacing.md },
    dayRow: { gap: spacing.sm, paddingBottom: spacing.md },
    dayChip: {
        width: 62, paddingVertical: spacing.sm, borderRadius: radius.lg,
        alignItems: 'center', backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
    },
    dayChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    dayChipWeek: { ...typography.caption, fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
    dayChipNum: { ...typography.h3, color: C.text },
    dayChipMonth: { ...typography.caption, fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
    dayChipTextActive: { color: C.primaryText },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
    slotChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill,
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    },
    slotChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    slotChipText: { ...typography.label, color: C.text },
    slotChipTextActive: { color: C.primaryText },

    modalTitle: {
        ...typography.h2,
                color: C.primary,
        letterSpacing: -0.4,
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalSub: {
        fontSize: 13,
        color: C.textSec,
        marginBottom: spacing.gutter,
        lineHeight: 18,
    },
    modalLabel: {
        ...typography.overline,
                color: C.primary,
        marginBottom: spacing.sm,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    required: {
        ...typography.button, fontSize: 12,
                color: C.error,
        letterSpacing: 0.5,
    },

    /* Types de RDV */
    typeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.gutter,
    },
    typeBtn: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        position: 'relative',
    },
    typeBtnActive: {
        borderColor: C.primary,
        backgroundColor: C.accentSoft,
    },
    typeIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    typeIconWrapActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.border,
    },
    typeBtnText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    typeBtnTextActive: {
        color: C.primary,
    },
    typeCheckBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Notes */
    notesWrap: {
        backgroundColor: C.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.lg,
        padding: spacing.md,
        minHeight: 110,
    },
    notesWrapFocused: {
        borderColor: C.primary,
        backgroundColor: C.surfaceSolid,
    },
    notesInput: {
        ...typography.bodySmall,
        color: C.primary,
        minHeight: 80,
    },

    /* Submit button */
    submitBtn: {
        height: 60,
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
    submitBtnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
    },
    submitBtnText: {
        color: C.primaryText,
        ...typography.h3, fontSize: 16,
                letterSpacing: 0.2,
    },
})