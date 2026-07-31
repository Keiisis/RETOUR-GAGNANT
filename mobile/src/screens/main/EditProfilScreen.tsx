'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform,
    ActivityIndicator, Pressable, Dimensions,
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
    interpolateColor,
} from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   EditProfilScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

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
    icon: string
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
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.primary]),
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
                    <LucideIcon name="checkmark-circle" size={13} color={C.success} style={{ marginLeft: 4 }} />
                )}
            </View>

            <Animated.View style={[fieldStyles.inputWrap, wrapStyle]}>
                <LucideIcon name={icon} size={18} color={iconColor} style={fieldStyles.icon} />
                <TextInput
                    style={fieldStyles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={C.placeholder}
                    keyboardType={keyboardType}
                    autoCapitalize={keyboardType === 'default' ? 'words' : 'none'}
                    autoCorrect={false}
                    selectionColor={C.primary}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
                {hasValue && (
                    <Pressable
                        onPress={() => onChange('')}
                        style={fieldStyles.clearBtn}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Effacer le champ"
                    >
                        <LucideIcon name="close-circle" size={18} color={C.textMuted} />
                    </Pressable>
                )}
            </Animated.View>

            {helper && (
                <Text style={fieldStyles.helper}>
                    <LucideIcon name="information-circle-outline" size={11} color={C.textMuted} /> {helper}
                </Text>
            )}
        </View>
    )
})

const fieldStyles = StyleSheet.create({
    field: {
        marginBottom: spacing.md,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    label: {
        ...typography.overline,
                color: C.textSec,
    },
    required: {
        color: C.error,
        ...typography.button, fontSize: 14,
    },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        minHeight: 54,
        ...shadows.card,
    },
    icon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        color: C.primary,
        ...typography.body, fontSize: 14.5,
                paddingVertical: 0,
    },
    clearBtn: {
        padding: spacing.xxs,
        marginLeft: spacing.xs,
    },
    helper: {
        ...typography.caption,
        color: C.textMuted,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
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
    const avatarPulse = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })


        // Halo doré pulsant autour de l'avatar
        avatarPulse.value = withTiming(1, { duration: 600 })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

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
            toast(t('Champs requis'), t('Le prénom et le nom sont obligatoires.'))
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
            toast(t('Erreur'), error.message)
        } else {
            toast(t('Succès'), t('Profil mis à jour avec succès.'), 'success')
            navigation.goBack()
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

                {/* Indicateur "modifié" */}
                {hasChanges && (
                    <View style={styles.changesBadge}>
                        <View style={styles.changesBadgeDot} />
                        <Text style={styles.changesBadgeText}>{t('Modifications')}</Text>
                    </View>
                )}
            </View>

            <ScrollView
                /* La barre d'action est en position absolue au-dessus du
                   contenu : sans cette réserve, les derniers champs passaient
                   dessous et devenaient illisibles. */
                contentContainerStyle={[styles.scroll, { paddingBottom: 110 + insets.bottom }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Modifier mon profil')}</Text>
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
                            <LucideIcon name="mail-outline" size={18} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.emailLabel}>{t('Adresse email')}</Text>
                            <Text style={styles.emailValue} numberOfLines={1}>
                                {profile?.email || '—'}
                            </Text>
                        </View>
                        <View style={styles.lockedBadge}>
                            <LucideIcon name="lock-closed" size={11} color={C.textSec} />
                            <Text style={styles.lockedText}>{t('Verrouillé')}</Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ FORMULAIRE ═══ */}
                <AnimatedSection delay={350}>
                    <View style={styles.formCard}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderBadge}>
                                <LucideIcon name="person-outline" size={15} color={C.primary} />
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
                            <LucideIcon name="bulb-outline" size={16} color={C.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tipTitle}>{t('Bon à savoir')}</Text>
                            <Text style={styles.tipText}>
                                {t("Vos informations sont chiffrées et confidentielles. Elles ne sont jamais partagées sans votre consentement.")}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>
            </ScrollView>

            {/* ═══ CTA FIXE EN BAS ═══
                Marge basse issue de `insets` : sous Android 15+ l'application
                dessine sous la barre de navigation système, et une constante
                laissait les boutons dessous. */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.cancelBtn}
                    activeOpacity={0.8}
                    disabled={loading}
                    accessibilityRole="button"
                    hitSlop={6}
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
                    accessibilityRole="button"
                    hitSlop={6}
                >
                    {loading ? (
                        <ActivityIndicator color={C.primaryText} size="small" />
                    ) : (
                        <>
                            <LucideIcon
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
                                <LucideIcon name="arrow-forward" size={18} color={C.primary} style={{ marginLeft: 8 }} />
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    changesBadge: {
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
    changesBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.accent,
    },
    changesBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.primary,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.gutter,
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

    /* ── Identity Card (Avatar + Complétion) ── */
    identityCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
        position: 'relative',
        overflow: 'hidden',
    },
    avatarHalo: { display: 'none' },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: radius.xl,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    avatarText: {
        ...typography.h1, fontSize: 32,
                color: C.primaryText,
        letterSpacing: 1,
    },
    identityName: {
        ...typography.h3, fontSize: 18,
                color: C.primary,
        letterSpacing: -0.3,
        marginBottom: spacing.xxs,
    },
    identityEmail: {
        ...typography.caption,
        color: C.textSec,
                marginBottom: spacing.md,
    },

    /* ── Completion bar ── */
    completionWrap: {
        width: '100%',
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    completionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    completionLabel: {
        ...typography.overline,
                color: C.textSec,
    },
    completionPercent: {
        ...typography.button, fontSize: 14,
                color: C.primary,
        letterSpacing: -0.2,
    },
    completionBar: {
        height: 6,
        backgroundColor: C.border,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    completionFill: {
        height: '100%',
        backgroundColor: C.primary,
        borderRadius: 3,
    },
    completionHint: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Email Card (verrouillé) ── */
    emailCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.surfaceAlt,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    emailIconWrap: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    emailLabel: {
        ...typography.overline,
                color: C.textSec,
        marginBottom: spacing.xxs,
    },
    emailValue: {
        ...typography.bodySmall, fontSize: 13.5,
                color: C.primary,
        letterSpacing: -0.1,
    },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.surface,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    lockedText: {
        ...typography.button, fontSize: 12,
                color: C.textSec,
        letterSpacing: 0.3,
    },

    /* ── Form Card ── */
    formCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.gutter,
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
    row: {
        flexDirection: 'row',
    },

    /* ── Tip Card ── */
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: C.accentSoft,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
    },
    tipIconWrap: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    tipTitle: {
        ...typography.button, fontSize: 12.5,
                color: C.primary,
        marginBottom: spacing.xxs,
        letterSpacing: 0.2,
    },
    tipText: {
        ...typography.caption,
        color: C.textSec,
    },

    /* ── Bottom Bar ── */
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.md,
        // paddingBottom fourni au montage depuis insets.bottom : voir l'usage.
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderTopWidth: 1,
        borderTopColor: C.border,
        ...shadows.card,
    },
    cancelBtn: {
        flex: 0.5,
        height: 56,
        backgroundColor: C.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: C.textSec,
        ...typography.button, fontSize: 14,
                letterSpacing: 0.2,
    },
    saveBtn: {
        flex: 1,
        flexDirection: 'row',
        height: 56,
        backgroundColor: C.primary,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
    },
    saveBtnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
    },
    saveBtnText: {
        color: C.primaryText,
        ...typography.button,
                letterSpacing: 0.2,
    },
    saveBtnTextDisabled: {
        color: C.surfaceAlt,
    },
})