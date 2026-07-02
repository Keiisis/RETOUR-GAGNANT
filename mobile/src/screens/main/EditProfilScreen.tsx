'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, Pressable, Dimensions,
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
    interpolateColor,
} from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'

/* ═══════════════════════════════════════════════════════════
   EditProfilScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',      // Bleu Profond
    primaryDark: '#022C22',
    accent: '#C9A84C',       // Or
    accentDark: '#A68B3C',
    accentLight: '#E2C97E',
    auraGreen: '#10B981',    // Vert
    error: '#EF4444',        // Rouge
    success: '#10B981',

    textSec: '#64748B',
    textMuted: '#94A3B8',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'EditProfil'>

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION (Stagger d'entrée)
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
   COMPOSANT : FIELD (Externe au composant principal — FIX bug focus)
═══════════════════════════════════════════════════════════ */

interface FieldProps {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder: string
    icon: keyof typeof Ionicons.glyphMap
    keyboardType?: 'default' | 'phone-pad' | 'email-address'
    required?: boolean
    helper?: string
}

const Field = React.memo(function Field({
    label, value, onChange, placeholder, icon, keyboardType = 'default',
    required = false, helper,
}: FieldProps) {
    const [focused, setFocused] = useState(false)
    const focusAnim = useSharedValue(0)

    useEffect(() => {
        focusAnim.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [focused])

    const wrapStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.02, 0.08]),
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.005]) }],
    }))

    const iconColor = focused ? C.accent : C.placeholder
    const hasValue = value.trim().length > 0

    return (
        <View style={fieldStyles.field}>
            <View style={fieldStyles.labelRow}>
                <Text style={fieldStyles.label}>{label}</Text>
                {required && <Text style={fieldStyles.required}>•</Text>}
                {hasValue && !required && (
                    <Ionicons name="checkmark-circle" size={13} color={C.success} style={{ marginLeft: 4 }} />
                )}
            </View>

            <Animated.View style={[fieldStyles.inputWrap, wrapStyle]}>
                <Ionicons name={icon} size={18} color={iconColor} style={fieldStyles.icon} />
                <TextInput
                    style={fieldStyles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={C.placeholder}
                    keyboardType={keyboardType}
                    autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
                    autoCorrect={false}
                    selectionColor={C.accent}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
                {hasValue && (
                    <Pressable
                        onPress={() => onChange('')}
                        style={fieldStyles.clearBtn}
                        hitSlop={10}
                    >
                        <Ionicons name="close-circle" size={18} color={C.textMuted} />
                    </Pressable>
                )}
            </Animated.View>

            {helper && (
                <Text style={fieldStyles.helper}>
                    <Ionicons name="information-circle-outline" size={11} color={C.textMuted} /> {helper}
                </Text>
            )}
        </View>
    )
})

const fieldStyles = StyleSheet.create({
    field: {
        marginBottom: 16,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 8,
    },
    label: {
        fontSize: 11.5,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    required: {
        color: C.error,
        fontSize: 14,
        fontWeight: '800',
        lineHeight: 14,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1.2,
        paddingHorizontal: 14,
        minHeight: 54,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
        elevation: 1,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: C.primary,
        fontSize: 14.5,
        fontWeight: '500',
        paddingVertical: 0,
    },
    clearBtn: {
        padding: 2,
        marginLeft: 6,
    },
    helper: {
        fontSize: 10.5,
        color: C.textMuted,
        marginTop: 6,
        marginLeft: 4,
        fontWeight: '500',
    },
})

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : EDIT PROFIL
═══════════════════════════════════════════════════════════ */

export default function EditProfilScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const { profile, updateProfile } = useAuth()
    const { t } = useLang()

    const [prenom, setPrenom] = useState(profile?.prenom || '')
    const [nom, setNom] = useState(profile?.nom || '')
    const [phone, setPhone] = useState(profile?.phone || '')
    const [ville, setVille] = useState(profile?.ville || '')
    const [loading, setLoading] = useState(false)

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)
    const avatarPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

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

        // Halo doré pulsant autour de l'avatar
        avatarPulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
            ), -1, false
        )
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

    const avatarHaloStyle = useAnimatedStyle(() => ({
        opacity: interpolate(avatarPulse.value, [0, 1], [0.18, 0.42]),
        transform: [{ scale: interpolate(avatarPulse.value, [0, 1], [1, 1.12]) }],
    }))

    /* ── Détection des modifications ── */
    const hasChanges =
        prenom !== (profile?.prenom || '') ||
        nom !== (profile?.nom || '') ||
        phone !== (profile?.phone || '') ||
        ville !== (profile?.ville || '')

    /* ── Calcul de la complétion du profil ── */
    const completionFields = [prenom, nom, phone, ville]
    const filled = completionFields.filter(f => f.trim()).length
    const completionPercent = Math.round((filled / completionFields.length) * 100)

    const handleSave = async () => {
        if (!prenom.trim() || !nom.trim()) {
            Alert.alert(t('Champs requis'), t('Le prénom et le nom sont obligatoires.'))
            return
        }
        setLoading(true)
        const { error } = await updateProfile({
            prenom: prenom.trim(),
            nom: nom.trim(),
            phone: phone.trim() || undefined,
            ville: ville.trim() || undefined,
        })
        setLoading(false)

        if (error) {
            Alert.alert(t('Erreur'), error.message)
        } else {
            Alert.alert(t('Succès'), t('Profil mis à jour avec succès.'), [
                { text: 'OK', onPress: () => navigation.goBack() },
            ])
        }
    }

    // Initiales pour l'avatar
    const initials = (
        (prenom.trim().charAt(0) || profile?.prenom?.charAt(0) || '?') +
        (nom.trim().charAt(0) || profile?.nom?.charAt(0) || '')
    ).toUpperCase()

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {/* 🎨 BACKGROUND PREMIUM : Auras */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                {/* Indicateur "modifié" */}
                {hasChanges && (
                    <View style={styles.changesBadge}>
                        <View style={styles.changesBadgeDot} />
                        <Text style={styles.changesBadgeText}>{t('Modifications')}</Text>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Votre')}</Text>
                    <Text style={styles.titleHighlight}>{t('profil.')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Tenez vos informations à jour pour un accompagnement optimal.')}
                    </Text>
                </Animated.View>

                {/* ═══ AVATAR + IDENTITÉ + COMPLÉTION ═══ */}
                <AnimatedSection delay={150}>
                    <View style={styles.identityCard}>
                        {/* Halo doré pulsant */}
                        <Animated.View style={[styles.avatarHalo, avatarHaloStyle]} />

                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>

                        <Text style={styles.identityName} numberOfLines={1}>
                            {prenom || nom ? `${prenom} ${nom}`.trim() : t('Votre nom')}
                        </Text>
                        <Text style={styles.identityEmail} numberOfLines={1}>
                            {profile?.email || '—'}
                        </Text>

                        {/* Barre de complétion */}
                        <View style={styles.completionWrap}>
                            <View style={styles.completionHeader}>
                                <Text style={styles.completionLabel}>
                                    {t('Profil complété')}
                                </Text>
                                <Text style={styles.completionPercent}>
                                    {completionPercent}%
                                </Text>
                            </View>
                            <View style={styles.completionBar}>
                                <Animated.View
                                    style={[
                                        styles.completionFill,
                                        { width: `${completionPercent}%` },
                                    ]}
                                />
                            </View>
                            <Text style={styles.completionHint}>
                                {completionPercent === 100
                                    ? t('Excellent ! Votre profil est complet.')
                                    : t('Complétez votre profil pour un meilleur accompagnement.')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ EMAIL VERROUILLÉ ═══ */}
                <AnimatedSection delay={250}>
                    <View style={styles.emailCard}>
                        <View style={styles.emailIconWrap}>
                            <Ionicons name="mail-outline" size={18} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.emailLabel}>{t('Adresse email')}</Text>
                            <Text style={styles.emailValue} numberOfLines={1}>
                                {profile?.email || '—'}
                            </Text>
                        </View>
                        <View style={styles.lockedBadge}>
                            <Ionicons name="lock-closed" size={11} color={C.textSec} />
                            <Text style={styles.lockedText}>{t('Verrouillé')}</Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ FORMULAIRE ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.formCard}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <Ionicons name="person-outline" size={15} color={C.primary} />
                            </View>
                            <Text style={styles.cardTitle}>{t('Informations personnelles')}</Text>
                        </View>

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Field
                                    label={t('Prénom')}
                                    value={prenom}
                                    onChange={setPrenom}
                                    placeholder={t('Jean')}
                                    icon="person-outline"
                                    required
                                />
                            </View>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Field
                                    label={t('Nom')}
                                    value={nom}
                                    onChange={setNom}
                                    placeholder={t('Dupont')}
                                    icon="person-outline"
                                    required
                                />
                            </View>
                        </View>

                        <Field
                            label={t('Téléphone')}
                            value={phone}
                            onChange={setPhone}
                            placeholder="+229 97 00 00 00"
                            icon="call-outline"
                            keyboardType="phone-pad"
                            helper={t('Format international recommandé')}
                        />

                        <Field
                            label={t('Ville de résidence')}
                            value={ville}
                            onChange={setVille}
                            placeholder={t('Paris, Montréal, Lagos...')}
                            icon="location-outline"
                            helper={t('Ville où vous résidez actuellement')}
                        />
                    </View>
                </AnimatedSection>

                {/* ═══ TIPS / INFO BOX ═══ */}
                <AnimatedSection delay={450}>
                    <View style={styles.tipCard}>
                        <View style={styles.tipIconWrap}>
                            <Ionicons name="bulb-outline" size={16} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tipTitle}>{t('Bon à savoir')}</Text>
                            <Text style={styles.tipText}>
                                {t("Vos informations sont chiffrées et confidentielles. Elles ne sont jamais partagées sans votre consentement.")}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* ═══ CTA FIXE EN BAS ═══ */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.cancelBtn}
                    activeOpacity={0.8}
                    disabled={loading}
                >
                    <Text style={styles.cancelBtnText}>{t('Annuler')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.saveBtn,
                        (loading || !hasChanges) && styles.saveBtnDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={loading || !hasChanges}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={C.primaryText} size="small" />
                    ) : (
                        <>
                            <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color={hasChanges ? C.accent : C.textMuted}
                                style={{ marginRight: 8 }}
                            />
                            <Text
                                style={[
                                    styles.saveBtnText,
                                    !hasChanges && styles.saveBtnTextDisabled,
                                ]}
                            >
                                {t('Enregistrer')}
                            </Text>
                            {hasChanges && (
                                <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                            )}
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
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

    /* ── Auras Corporate ── */
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    changesBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.3)',
    },
    changesBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.accent,
    },
    changesBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
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

    /* ── Identity Card (Avatar + Complétion) ── */
    identityCard: {
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 16,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    avatarHalo: {
        position: 'absolute',
        top: 12,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: C.accent,
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: 22,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.4)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1,
    },
    identityName: {
        fontSize: 18,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
        marginBottom: 3,
    },
    identityEmail: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        marginBottom: 18,
    },

    /* ── Completion bar ── */
    completionWrap: {
        width: '100%',
        backgroundColor: 'rgba(13, 43, 78, 0.04)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.06)',
    },
    completionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    completionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    completionPercent: {
        fontSize: 14,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.2,
    },
    completionBar: {
        height: 6,
        backgroundColor: C.border,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 10,
    },
    completionFill: {
        height: '100%',
        backgroundColor: C.accent,
        borderRadius: 3,
    },
    completionHint: {
        fontSize: 11,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 15,
    },

    /* ── Email Card (verrouillé) ── */
    emailCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(100, 116, 139, 0.06)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(100, 116, 139, 0.15)',
        marginBottom: 18,
    },
    emailIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.08)',
    },
    emailLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    emailValue: {
        fontSize: 13.5,
        fontWeight: '600',
        color: C.primary,
        letterSpacing: -0.1,
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: C.surface,
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    lockedText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.3,
    },

    /* ── Form Card ── */
    formCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 20,
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
        marginBottom: 18,
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
    row: {
        flexDirection: 'row',
    },

    /* ── Tip Card ── */
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: 'rgba(212, 160, 23, 0.06)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.18)',
    },
    tipIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 160, 23, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    tipTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.accentDark,
        marginBottom: 3,
        letterSpacing: 0.2,
    },
    tipText: {
        fontSize: 11.5,
        color: C.textSec,
        fontWeight: '500',
        lineHeight: 16,
    },

    /* ── Bottom Bar ── */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
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
    cancelBtn: {
        flex: 0.5,
        height: 56,
        backgroundColor: C.surface,
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: C.textSec,
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    saveBtn: {
        flex: 1,
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
    saveBtnDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveBtnText: {
        color: C.primaryText,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    saveBtnTextDisabled: {
        color: '#F1F5F9',
    },
})