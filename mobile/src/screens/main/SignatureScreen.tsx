'use strict'
import React, { useEffect, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity, Platform,
    ActivityIndicator, Alert, ScrollView, Image, Pressable,
    Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'

/* ═══════════════════════════════════════════════════════════
   SignatureScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec RegisterScreen.tsx & ServicesScreen.tsx)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',      // Bleu Profond (Agence)
    accent: '#C9A84C',       // Or (Agence)
    accentDark: '#A68B3C',
    auraGreen: '#10B981',    // Vert (Agence)
    error: '#EF4444',        // Rouge (Agence)
    success: '#10B981',      // Vert succès = vert agence

    textSec: '#64748B',
    textMuted: '#94A3B8',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

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

    /* ── Animation Corporate : Auras très subtiles et lentes ── */
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante (stagger identique à RegisterScreen)
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        card1Anim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        card2Anim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(450, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement très lent en fond (effet papier glacé)
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

    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

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
            Alert.alert(t('Signature trop courte'), t('Dessinez une signature plus complète.'))
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
                Alert.alert(t('Erreur'), data.error || t('Impossible d\'enregistrer la signature.'))
                return
            }
            setSavedSig(data.signature)
            setEditing(false)
            Alert.alert(t('Signature enregistrée'), t('Votre signature est désormais associée à votre compte.'))
        } catch {
            Alert.alert(t('Erreur'), t('Impossible d\'enregistrer la signature.'))
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
        Alert.alert(
            t('Supprimer la signature'),
            t('Voulez-vous vraiment supprimer votre signature enregistrée ?'),
            [
                { text: t('Annuler'), style: 'cancel' },
                {
                    text: t('Supprimer'), style: 'destructive', onPress: async () => {
                        if (!profile) return
                        try {
                            const res = await fetchWithTimeout(
                                `${API_BASE}/api/mobile/signature`,
                                { method: 'DELETE', timeoutMs: 8000, headers: { ...(await authHeaders()) } }
                            )
                            if (res.ok) {
                                setSavedSig(null)
                                setEditing(true)
                            }
                        } catch { /* ignore */ }
                    },
                },
            ]
        )
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
            {/* 🎨 BACKGROUND PREMIUM : Auras diffuses aux couleurs de l'agence */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
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
                        <Text style={styles.title}>{t('Votre')}</Text>
                        <Text style={styles.titleHighlight}>{t('signature.')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Utilisée pour signer factures, devis et documents officiels.')}
                        </Text>
                    </Animated.View>

                    {/* CARD : Signature actuelle */}
                    <Animated.View style={[styles.savedCard, styleCard1]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="checkmark-circle" size={16} color={C.success} />
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
                            <Ionicons name="time-outline" size={12} color={C.textMuted} />
                            <Text style={styles.savedDate}>
                                {t('Mise à jour')} : {new Date(savedSig.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* CARD : Préférence */}
                    <Animated.View style={[styles.prefCard, styleCard2]}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="settings-outline" size={15} color={C.primary} />
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

                        <Pressable onPress={handleDelete} style={styles.deleteLink}>
                            <Ionicons name="trash-outline" size={15} color={C.error} />
                            <Text style={styles.deleteText}>{t('Supprimer la signature')}</Text>
                        </Pressable>
                    </Animated.View>
                </ScrollView>
            ) : (
                /* ═══ MODE ÉDITION ═══ */
                <View style={styles.editorContainer}>
                    {/* HEADER TITRE */}
                    <Animated.View style={[styles.headerContainer, styleHeader, { marginBottom: 24 }]}>
                        <Text style={styles.title}>{t('Dessinez')}</Text>
                        <Text style={styles.titleHighlight}>{t('votre signature.')}</Text>
                        <Text style={styles.subtitle}>
                            {t('Tracez votre paraphe dans le cadre ci-dessous, comme sur un document papier.')}
                        </Text>
                    </Animated.View>

                    {/* CANVAS */}
                    <Animated.View style={[styles.canvasWrap, styleCard1]}>
                        <View style={styles.canvasGuideTop}>
                            <Ionicons name="create-outline" size={14} color={C.accent} />
                            <Text style={styles.canvasGuideText}>{t('Zone de signature')}</Text>
                        </View>

                        <View style={styles.canvas}>
                            <SignatureScreenLib
                                ref={sigRef}
                                onOK={handleOK}
                                onEmpty={() => Alert.alert(t('Vide'), t('Veuillez dessiner votre signature.'))}
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
                        >
                            <Ionicons name="refresh-outline" size={16} color={C.textSec} />
                            <Text style={styles.btnSecondaryText}>{t('Effacer')}</Text>
                        </TouchableOpacity>

                        {savedSig && (
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setEditing(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.btnSecondaryText}>{t('Annuler')}</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => sigRef.current?.readSignature()}
                            disabled={saving}
                            activeOpacity={0.8}
                            style={[styles.btn, saving && styles.btnDisabled, { flex: 1 }]}
                        >
                            {saving ? (
                                <ActivityIndicator color={C.primaryText} size="small" />
                            ) : (
                                <>
                                    <Text style={styles.btnText}>{t('Enregistrer')}</Text>
                                    <Ionicons name="checkmark" size={18} color={C.accent} style={{ marginLeft: 8 }} />
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
        backgroundColor: active ? 'rgba(212, 160, 23, 0.06)' : 'transparent',
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
        <Pressable onPress={onPress}>
            <Animated.View style={[styles.prefRow, rowStyle, !isLast && styles.prefRowBorder]}>
                <Animated.View style={[styles.radio, radioStyle]}>
                    <Animated.View style={[styles.radioInner, innerStyle]} />
                </Animated.View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.prefLabel, active && { color: C.primary, fontWeight: '700' }]}>
                        {label}
                    </Text>
                    <Text style={styles.prefDescription}>{description}</Text>
                </View>
                {active && (
                    <Ionicons name="checkmark-circle" size={18} color={C.accent} />
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
    icon?: keyof typeof Ionicons.glyphMap
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
            style={[styles.btn, disabled && styles.btnDisabled]}
        >
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    {icon && <Ionicons name={icon} size={18} color={C.accent} style={{ marginRight: 8 }} />}
                    <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{title}</Text>
                    {!disabled && <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />}
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

    /* ── Auras extrêmement discrètes (Corporate) ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05,
    },
    aura1: {
        top: -100,
        right: -100,
        backgroundColor: C.primary,
    },
    aura2: {
        bottom: 50,
        left: -100,
        backgroundColor: C.auraGreen,
    },

    /* ── Nav Bar ── */
    navBar: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
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

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: 28,
        paddingBottom: 60,
    },

    /* ── Header (identique RegisterScreen) ── */
    headerContainer: {
        marginTop: 15,
        marginBottom: 32,
    },
    title: {
        fontSize: 38,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.5,
    },
    titleHighlight: {
        fontSize: 38,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.5,
        marginTop: -4,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Card Header partagé ── */
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
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.1,
        flex: 1,
    },

    /* ── Card : Signature enregistrée ── */
    savedCard: {
        backgroundColor: C.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 18,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    sigPreviewWrap: {
        backgroundColor: C.surfaceSolid,
        borderRadius: 12,
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
        backgroundColor: 'rgba(10, 107, 59, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sigWatermarkText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.success,
    },
    savedFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        justifyContent: 'flex-end',
    },
    savedDate: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
    },

    /* ── Card : Préférences ── */
    prefCard: {
        backgroundColor: C.surface,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 18,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 10,
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
        fontSize: 14,
        color: C.primary,
        fontWeight: '500',
        marginBottom: 2,
    },
    prefDescription: {
        fontSize: 11.5,
        color: C.textSec,
        fontWeight: '400',
        lineHeight: 15,
    },

    /* ── Bottom container & buttons ── */
    bottomContainer: {
        marginTop: 16,
        gap: 16,
    },
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
        paddingHorizontal: 20,
    },
    btnDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
        elevation: 0,
    },
    btnText: {
        color: C.primaryText,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    btnTextDisabled: {
        color: '#F1F5F9',
    },
    btnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: C.surface,
        paddingHorizontal: 16,
        height: 60,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    btnSecondaryText: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '600',
    },

    /* ── Lien supprimer ── */
    deleteLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        marginTop: 4,
    },
    deleteText: {
        color: C.error,
        fontSize: 14,
        fontWeight: '600',
    },

    /* ── Mode édition ── */
    editorContainer: {
        flex: 1,
        paddingHorizontal: 28,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    },
    canvasWrap: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        overflow: 'hidden',
        marginBottom: 18,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    canvasGuideTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: 'rgba(212, 160, 23, 0.04)',
    },
    canvasGuideText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
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
        gap: 10,
    },
})