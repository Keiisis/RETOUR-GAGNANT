'use strict'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
    RefreshControl, Platform, ActivityIndicator, Modal, Dimensions,
    Pressable,
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
} from 'react-native-reanimated'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { supabase } from '../../config/supabase'
import { authHeaders } from '../../config/api'
import { fetchWithTimeout } from '../../lib/fetch'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'
import { thankYouMessage } from '../../lib/serviceCompletion'
import { FlagBar } from '../../components/ui'

/* ═══════════════════════════════════════════════════════════
   DossierScreen : THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen & EditProfilScreen)
═══════════════════════════════════════════════════════════ */
const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans premium)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const ALLOWED_TYPES = [
    'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const MAX_SIZE_MB = 10

interface DossierDoc {
    id: string; file_name: string; status: string; created_at: string
    file_url?: string; file_type?: string
}
interface Dossier {
    id: string; status: string; progress: number; service_type: string
    notes?: string; created_at: string; documents: DossierDoc[]
}

const STEPS = [
    { label: 'Soumis', key: 'soumis' },
    { label: 'Vérifié', key: 'verifie' },
    { label: 'Traitement', key: 'traitement' },
    { label: 'Validation', key: 'validation' },
    { label: 'Terminé', key: 'termine' },
]
const STATUS_ORDER = ['soumis', 'en_attente', 'verifie', 'en_cours', 'traitement', 'validation', 'termine']
const STATUS_LABEL: Record<string, string> = {
    soumis: 'Dossier soumis', en_attente: 'En attente de documents',
    verifie: 'En cours de vérification', en_cours: 'En cours de traitement',
    traitement: 'En traitement', validation: 'En validation',
    termine: 'Terminé', annule: 'Annulé',
}
const STATUS_COLOR: Record<string, string> = {
    soumis: C.info, en_attente: C.warning, verifie: C.purple,
    en_cours: C.primary, traitement: C.primary, validation: C.accent,
    termine: C.success, annule: C.error,
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION (Stagger d'entrée)
═══════════════════════════════════════════════════════════ */
function AnimatedSection({
    children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: any }) {
    const anim = useSharedValue(0)
    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, {
            duration: 800, easing: Easing.out(Easing.quad),
        }))
    }, [delay])
    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))
    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : SKELETON CARD (cohérent avec le thème)
═══════════════════════════════════════════════════════════ */
function SkeletonShimmer({ height = 80 }: { height?: number }) {
    const shimmer = useSharedValue(0)
    useEffect(() => {
        shimmer.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
            ), -1, false,
        )
    }, [])
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(shimmer.value, [0, 1], [0.5, 0.9]),
    }))
    return (
        <Animated.View
            style={[{
                height,
                borderRadius: radius.lg,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                marginBottom: spacing.sm,
            }, style]}
        />
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : DOSSIER
═══════════════════════════════════════════════════════════ */
export default function DossierScreen({ navigation }: any) {
    const { profile } = useAuth()
    const { t } = useLang()
    const insets = useSafeAreaInsets()
    const [dossiers, setDossiers] = useState<Dossier[]>([])
    const [selected, setSelected] = useState<Dossier | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [uploadTargetDossier, setUploadTargetDossier] = useState<Dossier | null>(null)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    /* ═══ DATA : Fetch + Realtime (LOGIQUE INCHANGÉE) ═══ */
    const fetchDossiers = useCallback(async () => {
        if (!profile) { setLoading(false); return }
        try {
            const text = await fetchWithTimeout(
                `${API_BASE}/api/mobile/dossiers`,
                { timeoutMs: 10000, headers: { ...(await authHeaders()) } },
            ).then(r => r.text())
            let json: { dossiers?: Dossier[] } = {}
            try { json = JSON.parse(text) } catch { /* ignore */ }
            const list = json.dossiers || []
            setDossiers(list)
            if (list.length > 0 && !selected) setSelected(list[0])
            else if (selected) {
                const updated = list.find(d => d.id === selected.id)
                if (updated) setSelected(updated)
            }
        } catch { /* silent */ } finally { setLoading(false) }
    }, [profile])

    useEffect(() => { fetchDossiers() }, [fetchDossiers])

    /* La callback est lue via une ref : sans cela, `fetchDossiers` (recréé à
       chaque changement de `profile`) figurait dans les dépendances et faisait
       défaire/refaire l'abonnement à tout bout de champ. */
    const fetchRef = useRef(fetchDossiers)
    useEffect(() => { fetchRef.current = fetchDossiers }, [fetchDossiers])

    useEffect(() => {
        if (!profile?.id) return

        // Nom de canal UNIQUE par abonnement. supabase.channel(nom) renvoie
        // l'instance EXISTANTE quand le nom est déjà pris : avec un nom fixe
        // (« dossiers-realtime »), un simple re-rendu — ou un rechargement à
        // chaud — rappelait .on() sur un canal DÉJÀ souscrit, ce que le client
        // refuse : « cannot add postgres_changes callbacks after subscribe() ».
        // L'écran plantait alors au rendu. Le retrait du canal est de plus
        // asynchrone, donc l'ancien pouvait encore vivre à la resouscription.
        const topic = `dossiers-${profile.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const channel = supabase
            .channel(topic)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'dossier_tracking',
                filter: `client_id=eq.${profile.id}`,
            }, () => { fetchRef.current() })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [profile?.id])

    const onRefresh = async () => {
        setRefreshing(true); await fetchDossiers(); setRefreshing(false)
    }

    const progressFromStatus = (status: string) => {
        const idx = STATUS_ORDER.indexOf(status)
        if (idx < 0) return 0
        return Math.round((idx / (STATUS_ORDER.length - 1)) * 100)
    }

    /* ═══ UPLOAD : Logique inchangée ═══ */
    const uploadFile = async (uri: string, fileName: string, mimeType: string) => {
        const target = uploadTargetDossier || selected
        if (!target || !profile) {
            toast(t('Erreur'), t('Veuillez d\'abord sélectionner un dossier.')); return
        }
        setUploading(true); setShowUploadModal(false)
        try {
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            })
            const arrayBuffer = decode(base64)
            const safeName = fileName.replace(/[^a-zA-Z0-9._\-\u00C0-\u017E]/g, '_')
            const filePath = `${profile.id}/${target.id}/${Date.now()}_${safeName}`
            const { error: uploadError } = await supabase.storage
                .from('dossier-documents')
                .upload(filePath, arrayBuffer, { contentType: mimeType, upsert: false })
            if (uploadError) throw uploadError
            const { data: signedData } = await supabase.storage
                .from('dossier-documents')
                .createSignedUrl(filePath, 60 * 60)
            const secureUrl = signedData?.signedUrl || filePath
            const { error: dbErr } = await supabase.from('dossier_documents').insert({
                dossier_id: target.id, client_id: profile.id,
                file_name: safeName, file_url: secureUrl, file_type: mimeType, status: 'pending',
            })
            if (dbErr) {
                await supabase.from('documents').insert({
                    dossier_id: target.id, client_id: profile.id,
                    file_name: safeName, file_url: secureUrl, file_type: mimeType, status: 'pending',
                })
            }
            toast(t('Document envoyé'), t('Notre équipe le vérifiera sous 24-48h.'))
            await fetchDossiers()
        } catch (e: unknown) {
            toast(t('Erreur'), e instanceof Error ? e.message : t('Erreur lors de l\'envoi'))
        } finally { setUploading(false) }
    }

    const handlePickDocument = async () => {
        setShowUploadModal(false)
        const result = await DocumentPicker.getDocumentAsync({
            type: ALLOWED_TYPES, copyToCacheDirectory: true,
        })
        if (result.canceled || !result.assets?.[0]) return
        const asset = result.assets[0]
        if (asset.size && asset.size > MAX_SIZE_MB * 1024 * 1024) {
            toast(t('Fichier trop volumineux'), t('Maximum {size} Mo.').replace('{size}', MAX_SIZE_MB.toString())); return
        }
        await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream')
    }

    const handlePickImage = async () => {
        setShowUploadModal(false)
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
            toast(t('Permission refusée'), t('Accès à la galerie requis.')); return
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], quality: 0.85,
        })
        if (result.canceled || !result.assets[0]) return
        const asset = result.assets[0]
        await uploadFile(asset.uri, `photo_${Date.now()}.jpg`, asset.mimeType || 'image/jpeg')
    }

    const handleScanDocument = async () => {
        setShowUploadModal(false)
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
            toast(t('Permission refusée'), t('Accès caméra requis.')); return
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false, quality: 0.85,
        })
        if (result.canceled || !result.assets[0]) return
        await uploadFile(result.assets[0].uri, `scan_${Date.now()}.jpg`, 'image/jpeg')
    }

    const docStatusInfo = (s: string) => {
        if (s === 'approved') return { icon: 'checkmark-circle' as const, color: C.success, label: t('Validé') }
        if (s === 'rejected') return { icon: 'close-circle' as const, color: C.error, label: t('Refusé') }
        return { icon: 'time-outline' as const, color: C.primary, label: t('En attente') }
    }

    const fileIcon = (type?: string): string => {
        if (!type) return 'document-outline'
        if (type.includes('pdf')) return 'document-text-outline'
        if (type.includes('image')) return 'image-outline'
        return 'document-outline'
    }

    /* ═══════════════════════════════════════════════════════════
       RENDER
    ═══════════════════════════════════════════════════════════ */
    return (
        <View style={styles.container}>

            {/* ═══ LISERÉ TRICOLORE ═══ */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* ═══ EN-TÊTE ═══ */}
            <View style={styles.navBar}>
                {navigation?.canGoBack?.() ? (
                    <Pressable
                        onPress={() => navigation.goBack()}
                        accessibilityRole="button"
                        accessibilityLabel={t('Retour')}
                        hitSlop={8}
                        style={styles.iconContainer}
                    >
                        <LucideIcon name="arrow-back" size={20} color={C.text} />
                    </Pressable>
                ) : null}

                <Text style={styles.navTitle} numberOfLines={1}>{t('Mon dossier')}</Text>

                <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={uploading || dossiers.length === 0}
                    onPress={() => { setUploadTargetDossier(null); setShowUploadModal(true) }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Ajouter une pièce')}
                    style={[
                        styles.uploadHeaderBtn,
                        (uploading || dossiers.length === 0) && styles.uploadHeaderBtnDisabled,
                    ]}
                    hitSlop={6}
                >
                    {uploading ? (
                        <ActivityIndicator color={C.primary} size="small" />
                    ) : (
                        <>
                            <LucideIcon name="add" size={17} color={C.primary} />
                            <Text style={styles.uploadHeaderBtnText}>{t('Ajouter')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={C.primary}
                        colors={[C.primary]}
                    />
                }
            >
                {/* Le titre est porté par l'en-tête ; on ne garde ici que
                    la ligne d'état, seule information non redondante. */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.subtitle}>
                        {loading
                            ? t('Récupération de vos dossiers en cours…')
                            : dossiers.length === 0
                                ? t('Aucun dossier pour le moment. Commandez un service pour commencer.')
                                : `${dossiers.length} ${t('dossier')}${dossiers.length > 1 ? 's' : ''} ${t('en cours de traitement par nos équipes.')}`}
                    </Text>
                </Animated.View>

                {/* ═══ LOADING SKELETON ═══ */}
                {loading ? (
                    <View style={{ gap: 12 }}>
                        <SkeletonShimmer height={260} />
                        <SkeletonShimmer height={80} />
                        <SkeletonShimmer height={80} />
                    </View>
                ) : dossiers.length === 0 ? (
                    /* ═══ EMPTY STATE PREMIUM ═══ */
                    <AnimatedSection delay={150}>
                        <View style={styles.emptyCard}>
                            <View style={styles.emptyIconWrap}>
                                <LucideIcon name="folder-open-outline" size={36} color={C.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>{t('Aucun dossier en cours')}</Text>
                            <Text style={styles.emptyText}>
                                {t('Commandez un service depuis l\'onglet Services pour créer votre premier dossier et démarrer votre accompagnement.')}
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => navigation?.navigate?.('Services')}
                                style={styles.emptyBtn}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.emptyBtnText}>{t('Découvrir les services')}</Text>
                                <LucideIcon name="arrow-forward" size={16} color={C.primaryText} />
                            </TouchableOpacity>
                        </View>
                    </AnimatedSection>
                ) : (
                    <>
                        {/* ═══ SÉLECTEUR DE DOSSIER (si plusieurs) ═══ */}
                        {dossiers.length > 1 && (
                            <AnimatedSection delay={100}>
                                <View style={styles.tabsHeader}>
                                    <LucideIcon name="layers-outline" size={14} color={C.textSec} />
                                    <Text style={styles.tabsHeaderText}>
                                        {t('Sélectionnez un dossier')}
                                    </Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.tabsContent}
                                >
                                    {dossiers.map((d) => {
                                        const isActive = selected?.id === d.id
                                        const dotColor = STATUS_COLOR[d.status] || C.primary
                                        return (
                                            <TouchableOpacity
                                                key={d.id}
                                                activeOpacity={0.85}
                                                onPress={() => setSelected(d)}
                                                style={[styles.tab, isActive && styles.tabActive]}
                                                accessibilityRole="button"
                                                hitSlop={6}
                                            >
                                                <View style={[
                                                    styles.tabDot,
                                                    { backgroundColor: dotColor },
                                                    isActive && styles.tabDotActive,
                                                ]} />
                                                <Text
                                                    style={[styles.tabText, isActive && styles.tabTextActive]}
                                                    numberOfLines={1}
                                                >
                                                    {d.service_type}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </ScrollView>
                            </AnimatedSection>
                        )}

                        {selected && (() => {
                            const progress = selected.progress > 0
                                ? selected.progress
                                : progressFromStatus(selected.status)
                            const color = STATUS_COLOR[selected.status] || C.primary
                            const stepIdx = STEPS.findIndex(s => s.key === selected.status)
                            // Dossier terminé : la dernière étape est FAITE (pas « en cours »).
                            const isTermine = selected.status === 'termine'

                            return (
                                <>
                                    {/* ═══ CARTE DOSSIER : timeline verticale ═══ */}
                                    <AnimatedSection delay={150}>
                                        <View style={styles.progressCard}>
                                            <FlagBar height={5} radiusTop={false} />

                                            {/* Visuel d'en-tête + statut en incrustation */}
                                            <View style={styles.heroWrap}>
                                                <Image
                                                    source={require('../../../assets/images/dossier-hero.webp')}
                                                    style={styles.heroImage}
                                                    resizeMode="cover"
                                                    accessible={false}
                                                />
                                                <View style={[styles.statusPill, styles.statusPillOnHero, { backgroundColor: color }]}>
                                                    <Text style={styles.statusPillText}>
                                                        {t(STATUS_LABEL[selected.status] || selected.status)}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.progressBody}>
                                                <View style={styles.statusHeadRow}>
                                                    <Text style={styles.progressStepHint}>
                                                        {t('Avancement du dossier')}
                                                    </Text>
                                                    <Text style={styles.percentInline}>{progress}%</Text>
                                                </View>

                                                <Text style={styles.progressService}>
                                                    {selected.service_type}
                                                </Text>

                                                <Text style={styles.dossierRef}>
                                                    {t('Numéro de dossier')} : #RG-{String(selected.id).slice(0, 8).toUpperCase()}
                                                </Text>

                                                <View style={styles.progressBg}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            { width: `${progress}%` as any, backgroundColor: color },
                                                        ]}
                                                    />
                                                </View>

                                                {/* Timeline verticale des étapes réelles */}
                                                <View style={styles.timeline}>
                                                    {STEPS.map((step, i) => {
                                                        const done = stepIdx > i || (isTermine && i === stepIdx)
                                                        const current = stepIdx === i && !isTermine
                                                        const last = i === STEPS.length - 1
                                                        return (
                                                            <View key={step.key} style={styles.tlRow}>
                                                                <View style={styles.tlGutter}>
                                                                    <View style={[
                                                                        styles.tlDot,
                                                                        done && styles.tlDotDone,
                                                                        current && styles.tlDotCurrent,
                                                                    ]}>
                                                                        {done && (
                                                                            <LucideIcon name="checkmark" size={13} color={C.primaryText} />
                                                                        )}
                                                                        {current && <View style={styles.tlDotPulse} />}
                                                                    </View>
                                                                    {!last && (
                                                                        <View style={[
                                                                            styles.tlLine,
                                                                            done && { backgroundColor: C.primary },
                                                                        ]} />
                                                                    )}
                                                                </View>

                                                                <View style={styles.tlContent}>
                                                                    <Text style={[
                                                                        styles.tlLabel,
                                                                        (done || current) && { color: C.text },
                                                                        current && { color: C.primary },
                                                                    ]}>
                                                                        {t(step.label)}
                                                                    </Text>
                                                                    <Text style={styles.tlSub}>
                                                                        {done
                                                                            ? t('Étape terminée')
                                                                            : current
                                                                                ? t('En cours')
                                                                                : t('À venir')}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        )
                                                    })}
                                                </View>

                                                {/* Dossier terminé : message de remerciement */}
                                                {isTermine && (
                                                    <View style={styles.completionBanner}>
                                                        <View style={styles.completionIcon}>
                                                            <LucideIcon name="checkmark-circle" size={22} color={C.primaryText} />
                                                        </View>
                                                        <Text style={styles.completionText}>
                                                            {t(thankYouMessage(selected.service_type))}
                                                        </Text>
                                                    </View>
                                                )}

                                                <Text style={styles.progressDate}>
                                                    {t('Ouvert le')}{' '}
                                                    {new Date(selected.created_at).toLocaleDateString('fr-FR', {
                                                        day: '2-digit', month: 'long', year: 'numeric',
                                                    })}
                                                </Text>

                                                {/* Note de l'équipe */}
                                                {selected.notes ? (
                                                    <View style={styles.notesRow}>
                                                        <LucideIcon name="chatbubble-ellipses-outline" size={16} color={C.primary} />
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.notesLabel}>
                                                                {t('Note de l\'équipe')}
                                                            </Text>
                                                            <Text style={styles.notesText}>{selected.notes}</Text>
                                                        </View>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </AnimatedSection>

                                    {/* ═══ SECTION DOCUMENTS ═══ */}
                                    <AnimatedSection delay={250}>
                                        <View style={styles.docsCard}>
                                            <View style={styles.cardHeader}>
                                                <View style={styles.cardHeaderBadge}>
                                                    <LucideIcon name="document-text-outline" size={15} color={C.primary} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.cardTitle}>{t('Documents')}</Text>
                                                    <Text style={styles.cardSubtitle}>
                                                        {selected.documents.length} {t('fichier')}{selected.documents.length !== 1 ? 's' : ''} {t('joint')}{selected.documents.length !== 1 ? 's' : ''}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    activeOpacity={0.8}
                                                    disabled={uploading}
                                                    onPress={() => setShowUploadModal(true)}
                                                    style={styles.addDocBtn}
                                                    accessibilityRole="button"
                                                    hitSlop={6}
                                                    accessibilityLabel={t('Ajouter')}
                                                >
                                                    {uploading ? (
                                                        <ActivityIndicator color={C.primary} size="small" />
                                                    ) : (
                                                        <LucideIcon name="add" size={20} color={C.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            </View>

                                            {uploading && (
                                                <View style={styles.uploadingBanner}>
                                                    <ActivityIndicator color={C.primary} size="small" />
                                                    <Text style={styles.uploadingText}>
                                                        {t('Envoi sécurisé en cours…')}
                                                    </Text>
                                                </View>
                                            )}

                                            {selected.documents.length > 0 ? (
                                                <View style={{ gap: 10 }}>
                                                    {selected.documents.map((doc) => {
                                                        const st = docStatusInfo(doc.status)
                                                        return (
                                                            <View key={doc.id} style={styles.docCard}>
                                                                <View style={styles.docIconWrap}>
                                                                    <LucideIcon
                                                                        name={fileIcon(doc.file_type)}
                                                                        size={20}
                                                                        color={C.primary}
                                                                    />
                                                                </View>
                                                                <View style={styles.docInfo}>
                                                                    <Text style={styles.docName} numberOfLines={1}>
                                                                        {doc.file_name}
                                                                    </Text>
                                                                    <Text style={styles.docDate}>
                                                                        {new Date(doc.created_at).toLocaleDateString('fr-FR', {
                                                                            day: '2-digit', month: 'short', year: 'numeric',
                                                                        })}
                                                                    </Text>
                                                                </View>
                                                                <View style={[
                                                                    styles.docStatusBadge,
                                                                    { backgroundColor: st.color + '15', borderColor: st.color + '30' },
                                                                ]}>
                                                                    <LucideIcon name={st.icon} size={12} color={st.color} />
                                                                    <Text style={[styles.docStatusLabel, { color: st.color }]}>
                                                                        {st.label}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        )
                                                    })}
                                                </View>
                                            ) : (
                                                <View style={styles.noDocsCard}>
                                                    <View style={styles.noDocsIconWrap}>
                                                        <LucideIcon name="cloud-upload-outline" size={32} color={C.primary} />
                                                    </View>
                                                    <Text style={styles.noDocsTitle}>
                                                        {t('Aucun document envoyé')}
                                                    </Text>
                                                    <Text style={styles.noDocsText}>
                                                        {t('Ajoutez vos pièces justificatives pour faire avancer votre dossier.')}
                                                    </Text>
                                                    <TouchableOpacity
                                                        activeOpacity={0.85}
                                                        onPress={() => setShowUploadModal(true)}
                                                        style={styles.uploadNowBtn}
                                                        accessibilityRole="button"
                                                        hitSlop={6}
                                                    >
                                                        <LucideIcon name="add" size={16} color={C.primaryText} />
                                                        <Text style={styles.uploadNowText}>
                                                            {t('Ajouter un document')}
                                                        </Text>
                                                        <LucideIcon name="arrow-forward" size={14} color={C.primaryText} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </AnimatedSection>

                                    {/* ═══ TIP CARD : Sécurité ═══ */}
                                    <AnimatedSection delay={350}>
                                        <View style={styles.tipCard}>
                                            <View style={styles.tipIconWrap}>
                                                <LucideIcon name="shield-checkmark-outline" size={16} color={C.primary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.tipTitle}>
                                                    {t('Confidentialité garantie')}
                                                </Text>
                                                <Text style={styles.tipText}>
                                                    {t('Vos documents sont chiffrés, stockés via URL signée temporaire (1h) et vérifiés sous 24-48h par notre équipe.')}
                                                </Text>
                                            </View>
                                        </View>
                                    </AnimatedSection>
                                </>
                            )
                        })()}
                    </>
                )}
            </ScrollView>

            {/* ═══════════════════════════════════════════════════════════
                MODAL UPLOAD : Bottom sheet Corporate Premium
            ═══════════════════════════════════════════════════════════ */}
            <Modal
                visible={showUploadModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowUploadModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowUploadModal(false)}
                    accessibilityRole="button"
                    hitSlop={6}
                >
                    <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconWrap}>
                                <LucideIcon name="cloud-upload-outline" size={20} color={C.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>{t('Ajouter un document')}</Text>
                                <Text style={styles.modalSub}>
                                    {t('PDF, Word ou image : Max {size} Mo').replace('{size}', MAX_SIZE_MB.toString())}
                                </Text>
                            </View>
                        </View>

                        {/* Sélecteur de dossier cible */}
                        {dossiers.length > 0 && (
                            <View style={styles.dossierSelector}>
                                <Text style={styles.dossierSelectorLabel}>
                                    {t('Dossier concerné')}
                                </Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{ marginTop: 10 }}
                                    contentContainerStyle={{ gap: 8 }}
                                >
                                    {dossiers.map((d) => {
                                        const isTarget = (uploadTargetDossier?.id || selected?.id) === d.id
                                        return (
                                            <TouchableOpacity
                                                key={d.id}
                                                activeOpacity={0.85}
                                                onPress={() => setUploadTargetDossier(d)}
                                                style={[
                                                    styles.dossierChip,
                                                    isTarget && styles.dossierChipActive,
                                                ]}
                                                accessibilityRole="button"
                                                hitSlop={6}
                                            >
                                                <LucideIcon
                                                    name="folder-outline"
                                                    size={13}
                                                    color={isTarget ? C.accent : C.textSec}
                                                />
                                                <Text
                                                    style={[
                                                        styles.dossierChipText,
                                                        isTarget && styles.dossierChipTextActive,
                                                    ]}
                                                    numberOfLines={1}
                                                >
                                                    {d.service_type}
                                                </Text>
                                                {isTarget && (
                                                    <LucideIcon name="checkmark-circle" size={14} color={C.primary} />
                                                )}
                                            </TouchableOpacity>
                                        )
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {/* Options d'upload */}
                        <View style={{ gap: 10 }}>
                            {[
                                {
                                    icon: 'document-text-outline' as const,
                                    accent: C.info,
                                    label: t('Choisir un fichier'),
                                    sub: t('PDF, Word ou image depuis vos fichiers'),
                                    action: handlePickDocument,
                                },
                                {
                                    icon: 'images-outline' as const,
                                    accent: C.purple,
                                    label: t('Photo depuis la galerie'),
                                    sub: t('Sélectionner une image existante'),
                                    action: handlePickImage,
                                },
                                {
                                    icon: 'camera-outline' as const,
                                    accent: C.primary,
                                    label: t('Scanner un document'),
                                    sub: t('Prendre une photo avec la caméra'),
                                    action: handleScanDocument,
                                },
                            ].map((opt, i) => (
                                <TouchableOpacity
                                    key={i}
                                    activeOpacity={0.85}
                                    onPress={opt.action}
                                    style={styles.modalOption}
                                    accessibilityRole="button"
                                    hitSlop={6}
                                >
                                    <View style={[
                                        styles.modalOptionIcon,
                                        { backgroundColor: opt.accent + '15', borderColor: opt.accent + '30' },
                                    ]}>
                                        <LucideIcon name={opt.icon} size={20} color={opt.accent} />
                                    </View>
                                    <View style={styles.modalOptionText}>
                                        <Text style={styles.modalOptionLabel}>{opt.label}</Text>
                                        <Text style={styles.modalOptionSub}>{opt.sub}</Text>
                                    </View>
                                    <LucideIcon name="chevron-forward" size={16} color={C.textMuted} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Sécurité info */}
                        <View style={styles.modalSecurityRow}>
                            <LucideIcon name="lock-closed" size={11} color={C.textSec} />
                            <Text style={styles.modalSecurityText}>
                                {t('Transfert chiffré · URL signée 1h')}
                            </Text>
                        </View>

                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setShowUploadModal(false)}
                            style={styles.modalCancel}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <Text style={styles.modalCancelText}>{t('Annuler')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    /* ── Liseré + en-tête ── */
    topFlag: {
        marginHorizontal: spacing.gutter,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    iconContainer: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        justifyContent: 'center', alignItems: 'center',
    },
    navTitle: { ...typography.h2, color: C.text, flex: 1 },
    uploadHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.primarySoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    uploadHeaderBtnDisabled: { opacity: 0.45 },
    uploadHeaderBtnText: { ...typography.label, color: C.primary },

    scroll: { paddingHorizontal: spacing.gutter, paddingBottom: 20 },

    /* ── Header ── */
    headerContainer: { marginTop: spacing.sm, marginBottom: spacing.lg, paddingHorizontal: 4 },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
    },

    /* ── Tabs sélecteur ── */
    tabsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    tabsHeaderText: {
        ...typography.overline,
        color: C.textSec,
    },
    tabsContent: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: 8 },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        maxWidth: 200,
    },
    tabActive: {
        borderColor: C.primary,
        backgroundColor: C.surfaceSolid,
        ...shadows.card,
    },
    tabDot: { width: 7, height: 7, borderRadius: 3.5 },
    tabDotActive: { transform: [{ scale: 1.2 }] },
    tabText: {
        ...typography.label,
        fontSize: 12,
        color: C.textSec,
    },
    tabTextActive: {
        ...typography.label,
        fontSize: 12,
        color: C.primary,
    },

    /* ── Progress Card ── */
    progressCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        marginBottom: spacing.md,
        overflow: 'hidden',
        ...shadows.cardRaised,
    },
    progressBody: { padding: spacing.lg },

    /* ── Statut ── */
    statusHeadRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: spacing.md,
    },
    heroWrap: { position: 'relative' },
    heroImage: { width: '100%', height: 168, backgroundColor: C.surfaceAlt },
    statusPill: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.pill, alignSelf: 'flex-start',
    },
    statusPillOnHero: {
        position: 'absolute', left: spacing.md, bottom: spacing.md,
    },
    progressStepHint: { ...typography.overline, fontSize: 12, color: C.textMuted },
    statusPillText: {
        ...typography.label, fontSize: 12,
        color: C.primaryText, textTransform: 'uppercase', letterSpacing: 0.8,
    },
    percentInline: { ...typography.h3, color: C.primary },
    dossierRef: { ...typography.bodySmall, color: C.textMuted, marginBottom: spacing.md },

    /* ── Timeline verticale ── */
    timeline: { marginTop: spacing.lg },
    tlRow: { flexDirection: 'row', gap: spacing.md },
    tlGutter: { alignItems: 'center', width: 26 },
    tlDot: {
        width: 26, height: 26, borderRadius: 13,
        borderWidth: 2, borderColor: C.border,
        backgroundColor: C.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    tlDotDone: { backgroundColor: C.primary, borderColor: C.primary },
    tlDotCurrent: { borderColor: C.primary, backgroundColor: C.surface },
    tlDotPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
    tlLine: { flex: 1, width: 2, backgroundColor: C.border, minHeight: 22 },
    tlContent: { flex: 1, paddingBottom: spacing.lg },
    tlLabel: { ...typography.label, fontSize: 15, color: C.textMuted },
    tlSub: { ...typography.caption, color: C.textMuted, marginTop: 2 },
    progressService: { ...typography.h2, color: C.text, marginBottom: spacing.xs },
    progressDate: { ...typography.caption, color: C.textMuted, marginTop: spacing.sm },
    completionBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.primarySoft,
        borderWidth: 1, borderColor: C.primary,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginTop: spacing.lg,
    },
    completionIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    completionText: { flex: 1, ...typography.bodySmall, fontSize: 13, color: C.primaryDark, lineHeight: 19, fontFamily: fonts.bodyBold },

    /* ── Progress Bar ── */
    progressBg: {
        height: 8, backgroundColor: C.surfaceAlt,
        borderRadius: radius.pill, overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radius.pill },

    /* ── Stepper ── */

    /* ── Notes ── */
    notesRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    notesIconWrap: {
        width: 30,
        height: 30,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    notesLabel: {
        ...typography.overline,
        color: C.primary,
        marginBottom: spacing.xxs,
    },
    notesText: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Documents Card ── */
    docsCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    cardHeaderBadge: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    cardTitle: {
        ...typography.h3,
        fontSize: 15,
        color: C.primary,
    },
    cardSubtitle: {
        ...typography.caption,
        color: C.textMuted,
        marginTop: spacing.xxs,
    },
    addDocBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    uploadingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.accentSoft,
        borderRadius: radius.sm,
        padding: spacing.sm,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadingText: {
        ...typography.label,
        fontSize: 12,
        color: C.primary,
    },

    /* ── Doc Cards ── */
    docCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surfaceSolid,
        borderRadius: radius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: C.border,
    },
    docIconWrap: {
        width: 42, height: 42, borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
        marginRight: spacing.sm,
    },
    docInfo: { flex: 1 },
    docName: {
        ...typography.label,
        color: C.primary,
    },
    docDate: {
        ...typography.caption,
        color: C.textMuted,
        marginTop: spacing.xxs,
    },
    docStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
    },
    docStatusLabel: {
        ...typography.label,
        fontSize: 12,
    },

    /* ── No Docs State ── */
    noDocsCard: {
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    noDocsIconWrap: {
        width: 64, height: 64, borderRadius: radius.xl,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    noDocsTitle: {
        ...typography.h3,
        color: C.primary,
    },
    noDocsText: {
        ...typography.bodySmall,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    uploadNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.primary,
        borderRadius: radius.md,
        paddingHorizontal: spacing.gutter,
        paddingVertical: spacing.sm,
        ...shadows.card,
    },
    uploadNowText: {
        ...typography.button,
        fontSize: 14,
        color: C.primaryText,
    },

    /* ── Tip Card ── */
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: C.accentSoft,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    tipIconWrap: {
        width: 32, height: 32, borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    tipTitle: {
        ...typography.label,
        color: C.primary,
        marginBottom: spacing.xxs,
    },
    tipText: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Empty State (aucun dossier) ── */
    emptyCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xxl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
        overflow: 'hidden',
        position: 'relative',
    },
    emptyIconWrap: {
        width: 88, height: 88, borderRadius: radius.xxl,
        backgroundColor: C.surfaceSolid,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
        ...shadows.card,
    },
    emptyTitle: {
        ...typography.h2,
        color: C.primary,
        marginBottom: spacing.sm,
    },
    emptyText: {
        ...typography.bodySmall,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.gutter,
        paddingHorizontal: spacing.sm,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.primary,
        borderRadius: radius.md,
        paddingHorizontal: spacing.gutter,
        paddingVertical: spacing.md,
        ...shadows.card,
    },
    emptyBtnText: {
        ...typography.button,
        color: C.primaryText,
    },

    /* ═══ MODAL ═══ */
    modalOverlay: {
        flex: 1,
        backgroundColor: C.overlay,
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: C.surfaceSolid,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        padding: spacing.gutter,
        // paddingBottom fourni au montage depuis insets.bottom
        ...shadows.floating,
        shadowOffset: { width: 0, height: -10 },
    },
    modalHandle: {
        width: 44, height: 5, borderRadius: 3,
        backgroundColor: C.border,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.gutter,
    },
    modalIconWrap: {
        width: 44, height: 44, borderRadius: radius.md,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    modalTitle: {
        ...typography.h3,
        color: C.primary,
    },
    modalSub: {
        ...typography.caption,
        color: C.textSec,
        marginTop: spacing.xxs,
    },
    dossierSelector: {
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    dossierSelectorLabel: {
        ...typography.overline,
        color: C.textSec,
    },
    dossierChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
        maxWidth: 200,
    },
    dossierChipActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.primary,
    },
    dossierChipText: {
        ...typography.label,
        fontSize: 12,
        color: C.textSec,
        maxWidth: 130,
    },
    dossierChipTextActive: {
        ...typography.label,
        fontSize: 12,
        color: C.primary,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
        backgroundColor: C.surface,
    },
    modalOptionIcon: {
        width: 46, height: 46, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
    },
    modalOptionText: { flex: 1 },
    modalOptionLabel: {
        ...typography.label,
        color: C.primary,
    },
    modalOptionSub: {
        ...typography.caption,
        color: C.textSec,
        marginTop: spacing.xxs,
    },
    modalSecurityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginTop: spacing.md,
        marginBottom: spacing.xs,
    },
    modalSecurityText: {
        ...typography.caption,
        color: C.textSec,
    },
    modalCancel: {
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        alignItems: 'center',
        backgroundColor: C.surfaceAlt,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    modalCancelText: {
        ...typography.button,
        color: C.textSec,
    },
})
