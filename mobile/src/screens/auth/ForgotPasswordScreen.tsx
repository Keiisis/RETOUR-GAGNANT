import React, { useState, useEffect } from 'react'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, ActivityIndicator, Alert,
    Pressable, Dimensions, Image, TouchableOpacity
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
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
import { useLang } from '../../contexts/LangContext'

/* ═══════════════════════════════════════════════════════════
   ForgotPasswordScreen — THEME "CORPORATE PREMIUM 2026"
   Cohérent avec LoginScreen & RegisterScreen
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Image locale
const LOGO_IMG = require('../../../assets/adaptive-icon.png')

// Palette de l'agence (identique Login/Register)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',
    accent: '#C9A84C',
    auraGreen: '#10B981',
    error: '#EF4444',

    textSec: '#64748B',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

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

    /* ── Auras lentes ── */
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        formAnim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

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
    const styleForm = useAnimatedStyle(() => ({
        opacity: formAnim.value,
        transform: [{ translateY: 40 * (1 - formAnim.value) }],
    }))
    const styleBtn = useAnimatedStyle(() => ({
        opacity: btnAnim.value,
        transform: [{ translateY: 50 * (1 - btnAnim.value) }],
    }))

    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

    const handleReset = async () => {
        if (!email.trim()) {
            Alert.alert(t('Champs requis'), t('Veuillez entrer votre adresse email.'))
            return
        }

        setLoading(true)
        const { error } = await resetPassword(email.trim())
        setLoading(false)

        if (error) {
            Alert.alert(t('Erreur'), error.message)
        } else {
            Alert.alert(
                t('Email envoyé'),
                t('Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.'),
                [{ text: t('OK'), onPress: () => navigation.navigate('Login') }]
            )
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

            {/* BACKGROUND PREMIUM : Auras diffuses */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
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
                        <Ionicons name="key-outline" size={28} color={C.accent} />
                    </View>

                    <Text style={styles.title}>{t('Mot de passe')}</Text>
                    <Text style={styles.titleHighlight}>{t('oublié ?')}</Text>
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

                    <Pressable onPress={() => navigation.navigate('Login')} style={styles.backLink}>
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
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.01, 0.08]),
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.01]) }]
    }))

    const iconColor = focused ? C.accent : C.placeholder

    return (
        <Animated.View style={[styles.fieldContainer, rStyle]}>
            <Ionicons name={icon} size={20} color={iconColor} style={styles.fieldIcon} />
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
                selectionColor={C.accent}
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
        <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.btn, disabled && styles.btnDisabled]}>
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{title}</Text>
                    {!disabled && <Ionicons name="send-outline" size={18} color={C.accent} style={{ marginLeft: 8 }} />}
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

    /* ── Auras discrètes ── */
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
        bottom: -50,
        left: -150,
        backgroundColor: C.auraGreen,
    },

    /* ── Nav Bar ── */
    navBar: {
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
        backgroundColor: 'rgba(212, 160, 23, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
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
        borderWidth: 1.2,
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
        fontWeight: '500',
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
    backLink: {
        marginTop: 24,
        alignItems: 'center',
        padding: 12,
    },
    backText: {
        color: C.textSec,
        fontSize: 14,
        fontWeight: '500',
    },
    backBold: {
        color: C.primary,
        fontWeight: '700',
    },

    /* ── Footer ── */
    footerContainer: {
        marginTop: 48,
        alignItems: 'center',
    },
    footer: {
        fontSize: 11,
        color: C.placeholder,
        letterSpacing: 1,
    },
})