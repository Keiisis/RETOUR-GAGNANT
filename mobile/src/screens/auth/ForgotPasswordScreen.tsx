import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, ActivityIndicator, Pressable, Dimensions, Image, TouchableOpacity
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    Easing,
    interpolateColor,
    interpolate,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   ForgotPasswordScreen — THEME "CORPORATE PREMIUM 2026"
   Cohérent avec LoginScreen & RegisterScreen
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Image locale
const LOGO_IMG = require('../../../assets/adaptive-icon.png')

// Palette de l'agence (identique Login/Register)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

export default function ForgotPasswordScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { resetPassword } = useAuth()
    const { t } = useLang()

    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [focused, setFocused] = useState(false)

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)
    const formAnim = useSharedValue(0)
    const btnAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        formAnim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const styleForm = useAnimatedStyle(() => ({
        opacity: formAnim.value,
        transform: [{ translateY: 40 * (1 - formAnim.value) }],
    }))
    const styleBtn = useAnimatedStyle(() => ({
        opacity: btnAnim.value,
        transform: [{ translateY: 50 * (1 - btnAnim.value) }],
    }))


    const handleReset = async () => {
        if (!email.trim()) {
            toast(t('Champs requis'), t('Veuillez entrer votre adresse email.'))
            return
        }

        setLoading(true)
        const { error } = await resetPassword(email.trim())
        setLoading(false)

        if (error) {
            toast(t('Erreur'), error.message)
        } else {
            toast(t('Email envoyé'), t('Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.'), 'success')
            navigation.navigate('Login')
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>


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

            <ScrollView 
                contentContainerStyle={styles.scroll} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
            >

                {/* HEADER */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    {/* Logo */}
                    <View style={styles.logoContainer}>
                        <Image source={LOGO_IMG} style={styles.logoImage} resizeMode="contain" />
                    </View>

                    {/* Icône clé dans un cercle */}
                    <View style={styles.keyIconWrap}>
                        <LucideIcon name="key-outline" size={28} color={C.primary} />
                    </View>

                    <Text style={styles.title}>{t('Mot de passe oublié ?')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Entrez votre adresse email et nous vous enverrons un lien de réinitialisation sécurisé.')}
                    </Text>
                </Animated.View>

                {/* FORMULAIRE */}
                <Animated.View style={[styles.formContainer, styleForm]}>
                    <Field
                        icon="mail-outline"
                        placeholder={t('Adresse e-mail')}
                        value={email}
                        onChangeText={setEmail}
                        focused={focused}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onSubmitEditing={handleReset}
                    />
                </Animated.View>

                {/* BOUTON & RETOUR */}
                <Animated.View style={[styles.bottomContainer, styleBtn]}>
                    <InteractiveButton
                        title={t('Envoyer le lien')}
                        onPress={handleReset}
                        disabled={!email.trim() || loading}
                        loading={loading}
                    />

                    <Pressable onPress={() => navigation.navigate('Login')} style={styles.backLink}
                        accessibilityRole="button"
                        hitSlop={6}>
                        <Text style={styles.backText}>
                            {t('Retour à')} <Text style={styles.backBold}>{t('la connexion')}</Text>
                        </Text>
                    </Pressable>
                </Animated.View>

                {/* Footer signature */}
                <View style={styles.footerContainer}>
                    <Text style={styles.footer}>{t('Retour Gagnant Bénin')} — v1.0</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FIELD (identique Login/Register)
═══════════════════════════════════════════════════════════ */
function Field({ icon, placeholder, value, onChangeText, focused, onFocus, onBlur, keyboardType, autoCapitalize, secureTextEntry, rightSlot, onSubmitEditing }: any) {
    const focusAnim = useSharedValue(0)

    useEffect(() => {
        focusAnim.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [focused])

    const rStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.primary]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.01, 0.08]),
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.01]) }]
    }))

    const iconColor = focused ? C.accent : C.placeholder

    return (
        <Animated.View style={[styles.fieldContainer, rStyle]}>
            <LucideIcon name={icon} size={20} color={iconColor} style={styles.fieldIcon} />
            <TextInput
                style={styles.fieldInput}
                placeholder={placeholder}
                placeholderTextColor={C.placeholder}
                value={value}
                onChangeText={onChangeText}
                onFocus={onFocus}
                onBlur={onBlur}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                secureTextEntry={secureTextEntry}
                selectionColor={C.primary}
                returnKeyType="send"
                onSubmitEditing={onSubmitEditing}
            />
            {rightSlot}
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : BOUTON INTERACTIF (identique Login/Register)
═══════════════════════════════════════════════════════════ */
function InteractiveButton({ title, onPress, disabled, loading }: any) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.btn, disabled && styles.btnDisabled]}
            accessibilityRole="button"
            hitSlop={6}>
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{title}</Text>
                    {!disabled && <LucideIcon name="send-outline" size={18} color={C.primary} style={{ marginLeft: 8 }} />}
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    /* ── Scroll & Header ── */
    scroll: {
        paddingHorizontal: 28,
        paddingBottom: 80,
    },
    headerContainer: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    logoImage: {
        width: 160,
        height: 160,
    },
    keyIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(252, 209, 22, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontFamily: fonts.regular,
        textAlign: 'center',
        paddingHorizontal: 10,
    },

    /* ── Formulaire ── */
    formContainer: {
        gap: 16,
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 16,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 2,
    },
    fieldIcon: {
        marginRight: 12,
    },
    fieldInput: {
        flex: 1,
        color: C.primary,
        fontSize: 15,
        fontFamily: fonts.medium,
        height: '100%',
    },

    /* ── Bottom ── */
    bottomContainer: {
        marginTop: 32,
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
    },
    btnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
    },
    btnText: {
        color: C.primaryText,
        fontSize: 16,
        fontFamily: fonts.bold,
        letterSpacing: 0.2,
    },
    btnTextDisabled: {
        color: '#F5F5F5',
    },
    backLink: {
        marginTop: 24,
        alignItems: 'center',
        padding: 12,
    },
    backText: {
        color: C.textSec,
        fontSize: 14,
        fontFamily: fonts.medium,
    },
    backBold: {
        color: C.primary,
        fontFamily: fonts.bold,
    },

    /* ── Footer ── */
    footerContainer: {
        marginTop: 48,
        alignItems: 'center',
    },
    footer: {
        fontSize: 12,
        color: C.placeholder,
        letterSpacing: 1,
    },
})