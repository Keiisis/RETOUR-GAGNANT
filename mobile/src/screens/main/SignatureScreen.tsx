'use strict'
import React, { useEffect, useRef, useState } from 'react'
import { confirm, toast } from '../../lib/feedback'
import {
    View, Text, StyleSheet, TouchableOpacity, Platform,
    ActivityIndicator, ScrollView, Image, Pressable,
    Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
import SignatureScreenLib, { SignatureViewRef } from 'react-native-signature-canvas'
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
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   SignatureScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen.tsx & ServicesScreen.tsx)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Signature'>

type AutoSign = 'ask' | 'auto' | 'never'

interface ServerSignature {
    id: string
    signature_data: string
    auto_sign: AutoSign
    updated_at: string
}

const AUTO_SIGN_LABELS: Record<AutoSign, string> = {
    ask: 'Me demander à chaque fois',
    auto: 'Apposer automatiquement',
    never: "Ne pas signer automatiquement",
}

const AUTO_SIGN_DESC: Record<AutoSign, string> = {
    ask: 'Confirmation requise pour chaque document.',
    auto: 'Vos documents seront signés sans confirmation.',
    never: 'Vous devrez signer manuellement à chaque fois.',
}

export default function SignatureScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()
    const sigRef = useRef<SignatureViewRef>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)
    const [savedSig, setSavedSig] = useState<ServerSignature | null>(null)
    const [autoSign, setAutoSign] = useState<AutoSign>('ask')

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)
    const card1Anim = useSharedValue(0)
    const card2Anim = useSharedValue(0)
    const btnAnim = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante (stagger identique à RegisterScreen)
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        card1Anim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        card2Anim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(450, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement très lent en fond (effet papier glacé)
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const styleCard1 = useAnimatedStyle(() => ({
        opacity: card1Anim.value,
        transform: [{ translateY: 40 * (1 - card1Anim.value) }],
    }))
    const styleCard2 = useAnimatedStyle(() => ({
        opacity: card2Anim.value,
        transform: [{ translateY: 40 * (1 - card2Anim.value) }],
    }))
    const styleBtn = useAnimatedStyle(() => ({
        opacity: btnAnim.value,
        transform: [{ translateY: 50 * (1 - btnAnim.value) }],
    }))


    /* ── Charger la signature existante ── */
    useEffect(() => {
        const load = async () => {
            if (!profile) { setLoading(false); return }
            try {
                const res = await fetchWithTimeout(
                    `${API_BASE}/api/mobile/signature`,
                    { timeoutMs: 8000, headers: { ...(await authHeaders()) } }
                )
                const data = await res.json().catch(() => ({}))
                if (data.signature) {
                    setSavedSig(data.signature)
                    setAutoSign(data.signature.auto_sign || 'ask')
                }
            } catch { /* ignore */ } finally {
                setLoading(false)
            }
        }
        load()
    }, [profile])

    /* ── Sauvegarder la signature ── */
    const handleOK = async (signature: string) => {
        if (!profile) return
        if (!signature || signature.length < 200) {
            toast(t('Signature trop courte'), t('Dessinez une signature plus complète.'))
            return
        }
        setSaving(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/signature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 12000,
                body: JSON.stringify({
                    signature_data: signature,
                    auto_sign: autoSign,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.signature) {
                toast(t('Erreur'), data.error || t('Impossible d\'enregistrer la signature.'))
                return
            }
            setSavedSig(data.signature)
            setEditing(false)
            toast(t('Signature enregistrée'), t('Votre signature est désormais associée à votre compte.'))
        } catch {
            toast(t('Erreur'), t('Impossible d\'enregistrer la signature.'))
        } finally {
            setSaving(false)
        }
    }

    const handleClear = () => sigRef.current?.clearSignature()

    /* ── Mettre à jour la préférence auto_sign ── */
    const updateAutoSign = async (next: AutoSign) => {
        if (!profile || !savedSig) {
            setAutoSign(next)
            return
        }
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/signature`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 8000,
                body: JSON.stringify({ auto_sign: next }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.signature) {
                setSavedSig(data.signature)
                setAutoSign(next)
            }
        } catch { /* ignore */ }
    }

    /* ── Supprimer ── */
    const handleDelete = () => {
        confirm({
            title: t('Supprimer la signature'),
            message: t('Voulez-vous vraiment supprimer votre signature enregistrée ?'),
            confirmLabel: t('Supprimer'),
            cancelLabel: t('Annuler'),
            destructive: true,
            onConfirm: async () => {
                if (!profile) return
                try {
                    const res = await fetchWithTimeout(
                        `${API_BASE}/api/mobile/signature`,
                        { method: 'DELETE', timeoutMs: 8000, headers: { ...(await authHeaders()) } }
                    )
                    if (res.ok) {
                        setSavedSig(null)
                        setEditing(true)
                        toast(t('Signature supprimée'), undefined, 'success')
                    }
                } catch { /* ignore */ }
            },
        })
    }

    /* ── Webview style (canvas signature) ── */
    const webStyle = `
        .m-signature-pad { box-shadow: none; border: none; }
        .m-signature-pad--body { border: none; }
        .m-signature-pad--footer { display: none; }
        body, html { width: 100%; height: 100%; margin: 0; padding: 0; background: #FFFFFF; }
    `

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
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={C.primary} size="large" />
                </View>
            ) : !editing && savedSig ? (
                /* ═══ MODE AFFICHAGE ═══ */
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={true}
                >
                    {/* HEADER TITRE */}
                    <Animated.View style={[styles.headerContainer, styleHeader]}>
                        <Text style={styles.title}>{t('Mes documents')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Utilisée pour signer factures, devis et documents officiels.')}
                        </Text>
                    </Animated.View>

                    {/* CARD : Signature actuelle */}
                    <Animated.View style={[styles.savedCard, styleCard1]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="checkmark-circle" size={16} color={C.success} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Signature enregistrée')}</Text>
                        </View>

                        <View style={styles.sigPreviewWrap}>
                            <Image
                                source={{ uri: savedSig.signature_data }}
                                style={styles.sigPreview}
                                resizeMode="contain"
                            />
                            {/* Filigrane subtil */}
                            <View style={styles.sigWatermark}>
                                <Text style={styles.sigWatermarkText}>✓</Text>
                            </View>
                        </View>

                        <View style={styles.savedFooter}>
                            <LucideIcon name="time-outline" size={12} color={C.textMuted} />
                            <Text style={styles.savedDate}>
                                {t('Mise à jour')} : {new Date(savedSig.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* CARD : Préférence */}
                    <Animated.View style={[styles.prefCard, styleCard2]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="settings-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Comportement par défaut')}</Text>
                        </View>

                        {(Object.keys(AUTO_SIGN_LABELS) as AutoSign[]).map((opt, idx) => (
                            <PrefOption
                                key={opt}
                                active={autoSign === opt}
                                label={t(AUTO_SIGN_LABELS[opt])}
                                description={t(AUTO_SIGN_DESC[opt])}
                                onPress={() => updateAutoSign(opt)}
                                isLast={idx === 2}
                            />
                        ))}
                    </Animated.View>

                    {/* BOUTONS */}
                    <Animated.View style={[styles.bottomContainer, styleBtn]}>
                        <InteractiveButton
                            title={t('Modifier la signature')}
                            onPress={() => setEditing(true)}
                            icon="create-outline"
                        />

                        <Pressable onPress={handleDelete} style={styles.deleteLink}
                            accessibilityRole="button"
                            hitSlop={6}>
                            <LucideIcon name="trash-outline" size={15} color={C.error} />
                            <Text style={styles.deleteText}>{t('Supprimer la signature')}</Text>
                        </Pressable>
                    </Animated.View>
                </ScrollView>
            ) : (
                /* ═══ MODE ÉDITION ═══ */
                <View style={[styles.editorContainer, { paddingBottom: insets.bottom + 16 }]}>
                    {/* HEADER TITRE */}
                    <Animated.View style={[styles.headerContainer, styleHeader, { marginBottom: 24 }]}>
                        <Text style={styles.title}>{t('Dessinez votre signature')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Tracez votre paraphe dans le cadre ci-dessous, comme sur un document papier.')}
                        </Text>
                    </Animated.View>

                    {/* CANVAS */}
                    <Animated.View style={[styles.canvasWrap, styleCard1]}>
                        <View style={styles.canvasGuideTop}>
                            <LucideIcon name="create-outline" size={14} color={C.accent} />
                            <Text style={styles.canvasGuideText}>{t('Zone de signature')}</Text>
                        </View>

                        <View style={styles.canvas}>
                            <SignatureScreenLib
                                ref={sigRef}
                                onOK={handleOK}
                                onEmpty={() => toast(t('Vide'), t('Veuillez dessiner votre signature.'))}
                                descriptionText=""
                                webStyle={webStyle}
                                penColor={C.primary}
                                backgroundColor="#FFFFFF"
                                autoClear={false}
                                imageType="image/png"
                            />
                        </View>

                        {/* Ligne pointillée style "ligne de signature" */}
                        <View style={styles.canvasBaseline} />
                    </Animated.View>

                    {/* ACTIONS */}
                    <Animated.View style={[styles.editorActions, styleBtn]}>
                        <TouchableOpacity
                            style={styles.btnSecondary}
                            onPress={handleClear}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <LucideIcon name="refresh-outline" size={16} color={C.textSec} />
                            <Text style={styles.btnSecondaryText}>{t('Effacer')}</Text>
                        </TouchableOpacity>

                        {savedSig && (
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setEditing(false)}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.btnSecondaryText}>{t('Annuler')}</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => sigRef.current?.readSignature()}
                            disabled={saving}
                            activeOpacity={0.8}
                            style={[styles.btn, saving && styles.btnDisabled, { flex: 1 }]}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            {saving ? (
                                <ActivityIndicator color={C.primaryText} size="small" />
                            ) : (
                                <>
                                    <Text style={styles.btnText}>{t('Enregistrer')}</Text>
                                    <LucideIcon name="checkmark" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : OPTION DE PRÉFÉRENCE (Radio premium)
═══════════════════════════════════════════════════════════ */

function PrefOption({
    active, label, description, onPress, isLast,
}: {
    active: boolean
    label: string
    description: string
    onPress: () => void
    isLast: boolean
}) {
    const anim = useSharedValue(active ? 1 : 0)

    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [active])

    const rowStyle = useAnimatedStyle(() => ({
        backgroundColor: active ? 'rgba(252, 209, 22, 0.06)' : 'transparent',
    }))

    const radioStyle = useAnimatedStyle(() => ({
        borderColor: active ? C.accent : C.border,
        transform: [{ scale: interpolate(anim.value, [0, 1], [1, 1.05]) }],
    }))

    const innerStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ scale: anim.value }],
    }))

    return (
        <Pressable onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.prefRow, rowStyle, !isLast && styles.prefRowBorder]}>
                <Animated.View style={[styles.radio, radioStyle]}>
                    <Animated.View style={[styles.radioInner, innerStyle]} />
                </Animated.View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.prefLabel, active && { color: C.primary, fontFamily: fonts.bold }]}>
                        {label}
                    </Text>
                    <Text style={styles.prefDescription}>{description}</Text>
                </View>
                {active && (
                    <LucideIcon name="checkmark-circle" size={18} color={C.accent} />
                )}
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : BOUTON INTERACTIF (Bleu agence massif)
═══════════════════════════════════════════════════════════ */

function InteractiveButton({
    title, onPress, disabled, loading, icon,
}: {
    title: string
    onPress: () => void
    disabled?: boolean
    loading?: boolean
    icon?: string
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            style={[styles.btn, disabled && styles.btnDisabled]}
            accessibilityRole="button"
            hitSlop={6}
        >
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    {icon && <LucideIcon name={icon} size={18} color={C.accent} style={{ marginRight: 8 }} />}
                    <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{title}</Text>
                    {!disabled && <LucideIcon name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />}
                </>
            )}
        </TouchableOpacity>
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
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: 28,
        paddingBottom: 60,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
            },

    /* ── Card Header partagé ── */
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    cardHeaderBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.1,
        flex: 1,
    },

    /* ── Card : Signature enregistrée ── */
    savedCard: {
        backgroundColor: C.surface,
        padding: spacing.gutter,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    sigPreviewWrap: {
        backgroundColor: C.surfaceSolid,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: C.border,
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    sigPreview: {
        width: '100%',
        height: 140,
    },
    sigWatermark: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sigWatermarkText: {
        ...typography.button, fontSize: 12,
                color: C.success,
    },
    savedFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 12,
        justifyContent: 'flex-end',
    },
    savedDate: {
        ...typography.caption,
        color: C.textMuted,
            },

    /* ── Card : Préférences ── */
    prefCard: {
        backgroundColor: C.surface,
        padding: spacing.gutter,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.xs,
    },
    prefRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: C.accent,
    },
    prefLabel: {
        ...typography.bodySmall,
        color: C.primary,
                marginBottom: spacing.xxs,
    },
    prefDescription: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Bottom container & buttons ── */
    bottomContainer: {
        marginTop: spacing.md,
        gap: spacing.md,
    },
    btn: {
        height: 60,
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
        paddingHorizontal: spacing.gutter,
    },
    btnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
    },
    btnText: {
        color: C.primaryText,
        ...typography.h3, fontSize: 16,
                letterSpacing: 0.2,
    },
    btnTextDisabled: {
        color: C.surfaceAlt,
    },
    btnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: C.surface,
        paddingHorizontal: spacing.md,
        height: 60,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
    },
    btnSecondaryText: {
        ...typography.label,
        color: C.textSec,
            },

    /* ── Lien supprimer ── */
    deleteLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        marginTop: spacing.xs,
    },
    deleteText: {
        color: C.error,
        ...typography.bodySmall,
            },

    /* ── Mode édition ── */
    editorContainer: {
        flex: 1,
        paddingHorizontal: 28,
        // paddingBottom fourni au montage depuis insets.bottom
    },
    canvasWrap: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
        marginBottom: spacing.md,
        ...shadows.card,
    },
    canvasGuideTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: C.accentSoft,
    },
    canvasGuideText: {
        ...typography.overline,
                color: C.accentDark,
    },
    canvas: {
        flex: 1,
        backgroundColor: C.surfaceSolid,
    },
    canvasBaseline: {
        position: 'absolute',
        left: 40,
        right: 40,
        bottom: 50,
        height: 1,
        borderBottomWidth: 1,
        borderStyle: 'dashed',
        borderColor: C.border,
    },
    editorActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
})