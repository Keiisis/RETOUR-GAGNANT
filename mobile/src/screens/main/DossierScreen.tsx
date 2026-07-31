'use strict'
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
    RefreshControl, Platform, ActivityIndicator, Modal, Dimensions,
    Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
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
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'
import { FlagBar } from '../../components/ui'

/* ═══════════════════════════════════════════════════════════
   DossierScreen — THEME "CORPORATE PREMIUM 2026"
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
                borderRadius: 16,
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.border,
                marginBottom: 12,
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

    useEffect(() => {
        if (!profile?.id) return
        const channel = supabase
            .channel('dossiers-realtime')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'dossiers',
                filter: `client_id=eq.${profile.id}`,
            }, () => { fetchDossiers() })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [profile?.id, fetchDossiers])

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
            toast(t('Document envoyé'), t('Notre équipe le vérifiera sous 24–48h.'))
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
        return { icon: 'time-outline' as const, color: C.warning, label: t('En attente') }
    }

    const fileIcon = (type?: string): keyof typeof Ionicons.glyphMap => {
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
                        <Ionicons name="arrow-back" size={20} color={C.text} />
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
                            <Ionicons name="add" size={17} color={C.primary} />
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
                                <Ionicons name="folder-open-outline" size={36} color={C.accent} />
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
                                <Ionicons name="arrow-forward" size={16} color={C.accent} />
                            </TouchableOpacity>
                        </View>
                    </AnimatedSection>
                ) : (
                    <>
                        {/* ═══ SÉLECTEUR DE DOSSIER (si plusieurs) ═══ */}
                        {dossiers.length > 1 && (
                            <AnimatedSection delay={100}>
                                <View style={styles.tabsHeader}>
                                    <Ionicons name="layers-outline" size={14} color={C.textSec} />
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

                            return (
                                <>
                                    {/* ═══ CARTE DOSSIER — timeline verticale ═══ */}
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
                                                        const done = stepIdx > i
                                                        const current = stepIdx === i
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
                                                                            <Ionicons name="checkmark" size={13} color={C.primaryText} />
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

                                                <Text style={styles.progressDate}>
                                                    {t('Ouvert le')}{' '}
                                                    {new Date(selected.created_at).toLocaleDateString('fr-FR', {
                                                        day: '2-digit', month: 'long', year: 'numeric',
                                                    })}
                                                </Text>

                                                {/* Note de l'équipe */}
                                                {selected.notes ? (
                                                    <View style={styles.notesRow}>
                                                        <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.primary} />
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
                                                    <Ionicons name="document-text-outline" size={15} color={C.primary} />
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
                                                        <ActivityIndicator color={C.accent} size="small" />
                                                    ) : (
                                                        <Ionicons name="add" size={20} color={C.accent} />
                                                    )}
                                                </TouchableOpacity>
                                            </View>

                                            {uploading && (
                                                <View style={styles.uploadingBanner}>
                                                    <ActivityIndicator color={C.accent} size="small" />
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
                                                                    <Ionicons
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
                                                                    <Ionicons name={st.icon} size={12} color={st.color} />
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
                                                        <Ionicons name="cloud-upload-outline" size={32} color={C.accent} />
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
                                                        <Ionicons name="add" size={16} color={C.accent} />
                                                        <Text style={styles.uploadNowText}>
                                                            {t('Ajouter un document')}
                                                        </Text>
                                                        <Ionicons name="arrow-forward" size={14} color={C.accent} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </AnimatedSection>

                                    {/* ═══ TIP CARD : Sécurité ═══ */}
                                    <AnimatedSection delay={350}>
                                        <View style={styles.tipCard}>
                                            <View style={styles.tipIconWrap}>
                                                <Ionicons name="shield-checkmark-outline" size={16} color={C.accent} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.tipTitle}>
                                                    {t('Confidentialité garantie')}
                                                </Text>
                                                <Text style={styles.tipText}>
                                                    {t('Vos documents sont chiffrés, stockés via URL signée temporaire (1h) et vérifiés sous 24–48h par notre équipe.')}
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
                                <Ionicons name="cloud-upload-outline" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>{t('Ajouter un document')}</Text>
                                <Text style={styles.modalSub}>
                                    {t('PDF, Word ou image — Max {size} Mo').replace('{size}', MAX_SIZE_MB.toString())}
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
                                                <Ionicons
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
                                                    <Ionicons name="checkmark-circle" size={14} color={C.accent} />
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
                                        <Ionicons name={opt.icon} size={20} color={opt.accent} />
                                    </View>
                                    <View style={styles.modalOptionText}>
                                        <Text style={styles.modalOptionLabel}>{opt.label}</Text>
                                        <Text style={styles.modalOptionSub}>{opt.sub}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Sécurité info */}
                        <View style={styles.modalSecurityRow}>
                            <Ionicons name="lock-closed" size={11} color={C.textSec} />
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
        marginHorizontal: 20,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
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
        paddingVertical: 9,
    },
    uploadHeaderBtnDisabled: { opacity: 0.45 },
    uploadHeaderBtnText: { ...typography.label, color: C.primary },

    scroll: { paddingHorizontal: 20, paddingBottom: 20 },

    /* ── Header ── */
    headerContainer: { marginTop: 8, marginBottom: 24, paddingHorizontal: 4 },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Tabs sélecteur ── */
    tabsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    tabsHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    tabsContent: { gap: 8, paddingBottom: 16, paddingRight: 8 },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.2,
        borderColor: C.border,
        backgroundColor: C.surface,
        maxWidth: 200,
    },
    tabActive: {
        borderColor: C.accent,
        backgroundColor: C.surfaceSolid,
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
    },
    tabDot: { width: 7, height: 7, borderRadius: 3.5 },
    tabDotActive: { transform: [{ scale: 1.2 }] },
    tabText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: C.textSec,
    },
    tabTextActive: {
        color: C.primary,
        fontWeight: '800',
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
        paddingHorizontal: spacing.md, paddingVertical: 7,
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
        gap: 10,
        marginTop: 18,
        paddingTop: 18,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    notesIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    notesText: {
        fontSize: 12.5,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 18,
    },

    /* ── Documents Card ── */
    docsCard: {
        backgroundColor: C.surface,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 16,
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
        marginBottom: 14,
    },
    cardHeaderBadge: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
    },
    cardSubtitle: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 1,
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
        gap: 10,
        backgroundColor: C.accentSoft,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadingText: {
        fontSize: 12,
        color: C.accentDark,
        fontWeight: '700',
    },

    /* ── Doc Cards ── */
    docCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.surfaceSolid,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border,
    },
    docIconWrap: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.1)',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    docInfo: { flex: 1 },
    docName: {
        fontSize: 13,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.1,
    },
    docDate: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 2,
    },
    docStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    docStatusLabel: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },

    /* ── No Docs State ── */
    noDocsCard: {
        alignItems: 'center',
        padding: 24,
        gap: 10,
    },
    noDocsIconWrap: {
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: C.accentSoft,
        borderWidth: 1.5,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
    },
    noDocsTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
    },
    noDocsText: {
        fontSize: 12.5,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 18,
        fontWeight: '500',
        marginBottom: 6,
    },
    uploadNowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.primary,
        borderRadius: 14,
        paddingHorizontal: 20,
        paddingVertical: 12,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 5,
    },
    uploadNowText: {
        color: C.primaryText,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Tip Card ── */
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: C.accentSoft,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    tipIconWrap: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.15)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    tipTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.accentDark,
        marginBottom: 3,
        letterSpacing: 0.2,
    },
    tipText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 16,
    },

    /* ── Empty State (aucun dossier) ── */
    emptyCard: {
        backgroundColor: C.surface,
        borderRadius: 22,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
        overflow: 'hidden',
        position: 'relative',
    },
    emptyIconWrap: {
        width: 88, height: 88, borderRadius: 28,
        backgroundColor: C.surfaceSolid,
        borderWidth: 1.5,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 13,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 19,
        fontWeight: '500',
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.primary,
        borderRadius: 14,
        paddingHorizontal: 22,
        paddingVertical: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    emptyBtnText: {
        color: C.primaryText,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ═══ MODAL ═══ */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 135, 81, 0.5)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: C.surfaceSolid,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 22,
        // paddingBottom fourni au montage depuis insets.bottom
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 20,
    },
    modalHandle: {
        width: 44, height: 5, borderRadius: 3,
        backgroundColor: C.border,
        alignSelf: 'center',
        marginBottom: 18,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    modalIconWrap: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
    },
    modalSub: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        marginTop: 2,
    },
    dossierSelector: {
        marginBottom: 18,
        paddingBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    dossierSelectorLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    dossierChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1.2,
        borderColor: C.border,
        backgroundColor: C.surface,
        maxWidth: 200,
    },
    dossierChipActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.accent,
    },
    dossierChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: C.textSec,
        maxWidth: 130,
    },
    dossierChipTextActive: {
        color: C.primary,
        fontWeight: '800',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        backgroundColor: C.surface,
    },
    modalOptionIcon: {
        width: 46, height: 46, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
    },
    modalOptionText: { flex: 1 },
    modalOptionLabel: {
        fontSize: 13.5,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
    },
    modalOptionSub: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        marginTop: 2,
    },
    modalSecurityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
        marginBottom: 4,
    },
    modalSecurityText: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    modalCancel: {
        marginTop: 10,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: 'rgba(138, 138, 138, 0.08)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
    },
    modalCancelText: {
        color: C.textSec,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
})
