import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, ActivityIndicator, Pressable, TouchableOpacity, Dimensions, Image
} from 'react-native'
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
import { screenColors } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   LoginScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width, height } = Dimensions.get('window')

// Image locale
const LOGO_IMG = require('../../../assets/adaptive-icon.png')

// Palette de l'agence (0% noir, 100% premium)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

export default function LoginScreen({ navigation }: any) {
    const { signIn } = useAuth()
    const { t } = useLang()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)
    const formAnim = useSharedValue(0)
    const btnAnim = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        formAnim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement lent et luxueux en fond
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


    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast(t('Champs requis'), t('Veuillez remplir tous les champs.'))
            return
        }
        setLoading(true)
        const { error } = await signIn(email.trim(), password)
        setLoading(false)
        if (error) {
            toast(t('Erreur'), t('Email ou mot de passe incorrect.'))
        }
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>


            <ScrollView 
                contentContainerStyle={styles.scroll} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
            >

                {/* HEADER (Logo & Titres) */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>

                    {/* LOGO LIBRE ET MAJESTUEUX */}
                    <View style={styles.logoContainer}>
                        <Image
                            source={LOGO_IMG}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>

                    <Text style={styles.brandTitle}>
                        <Text style={{ color: C.primary }}>RETOUR </Text>
                        <Text style={{ color: C.accent }}>GAGNANT</Text>
                    </Text>
                    <Text style={styles.brandSub}>BÉNIN</Text>

                    <Text style={styles.subtitle}>{t('Connectez-vous à votre espace personnel.')}</Text>
                </Animated.View>

                {/* FORMULAIRE */}
                <Animated.View style={[styles.formContainer, styleForm]}>
                    <Field
                        icon="mail-outline"
                        placeholder={t("Adresse e-mail")}
                        value={email}
                        onChangeText={setEmail}
                        focused={focused === 'email'}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <Field
                        icon="lock-closed-outline"
                        placeholder={t("Mot de passe")}
                        value={password}
                        onChangeText={setPassword}
                        focused={focused === 'password'}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                        secureTextEntry={!showPassword}
                        rightSlot={
                            <TouchableOpacity activeOpacity={0.5} onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} style={styles.eyeBtn}
                                accessibilityRole="button"
                                accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={focused === 'password' ? C.primary : C.placeholder} />
                            </TouchableOpacity>
                        }
                    />

                    {/* LIEN MOT DE PASSE OUBLIÉ */}
                    <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}
                        accessibilityRole="button"
                        hitSlop={6}>
                        <Text style={styles.forgotText}>{t('Mot de passe oublié ?')}</Text>
                    </Pressable>
                </Animated.View>

                {/* BOUTON & REGISTER LINK */}
                <Animated.View style={[styles.bottomContainer, styleBtn]}>
                    <InteractiveButton title={t('Se connecter')} onPress={handleLogin} disabled={!email || !password || loading} loading={loading} />

                    <Pressable onPress={() => navigation.navigate('Register')} style={styles.registerLink}
                        accessibilityRole="button"
                        hitSlop={6}>
                        <Text style={styles.registerText}>{t('Nouveau ici ?')} <Text style={styles.registerBold}>{t('Créer un compte')}</Text></Text>
                    </Pressable>
                </Animated.View>

            </ScrollView>
        </KeyboardAvoidingView>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FIELD
═══════════════════════════════════════════════════════════ */
function Field({ icon, placeholder, value, onChangeText, focused, onFocus, onBlur, keyboardType, autoCapitalize, secureTextEntry, rightSlot }: any) {
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
                autoCapitalize={autoCapitalize || 'none'}
                autoCorrect={false}
                secureTextEntry={secureTextEntry}
                selectionColor={C.accent}
            />
            {rightSlot}
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : BOUTON INTERACTIF
   Utilise TouchableOpacity directement pour garantir la
   réactivité sur Android (Animated.View + Pressable = bug)
═══════════════════════════════════════════════════════════ */
function InteractiveButton({ title, onPress, disabled, loading }: any) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            disabled={disabled}
            style={[styles.btn, disabled && styles.btnDisabled]}
            accessibilityRole="button"
            hitSlop={6}
        >
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
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

    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingTop: Platform.OS === 'ios' ? 70 : 50,
        paddingBottom: 80,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },

    /* ── Logo grand format, sans contraintes ── */
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    logoImage: {
        width: 320,    // Doublé pour impact visuel
        height: 320,
        // On laisse le PNG respirer sans fond ni bordure
    },

    brandTitle: {
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: 2,
    },
    brandSub: {
        fontSize: 16,
        fontWeight: '600',
        color: C.success, // Vert Agence
        letterSpacing: 6,
        marginTop: 2,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 16,
        textAlign: 'center',
    },
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
        paddingVertical: 0,
    },
    eyeBtn: {
        padding: 8,
        zIndex: 10,
    },
    forgotLink: {
        alignSelf: 'flex-end',
        marginTop: -4,
        paddingVertical: 8,
    },
    forgotText: {
        color: C.accent, // Or agence
        fontSize: 14,
        fontWeight: '600',
    },
    bottomContainer: {
        marginTop: 32,
    },
    btn: {
        height: 60,
        backgroundColor: C.primary, // Bleu massif
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
        color: '#F5F5F5',
    },
    registerLink: {
        marginTop: 24,
        alignItems: 'center',
        padding: 12,
    },
    registerText: {
        color: C.textSec,
        fontSize: 14,
        fontWeight: '500',
    },
    registerBold: {
        color: C.primary,
        fontWeight: '700',
    },
})