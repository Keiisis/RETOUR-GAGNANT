import React, { useState, useEffect } from 'react'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, ActivityIndicator, Alert,
    Pressable, Dimensions, TouchableOpacity
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
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'

/* ═══════════════════════════════════════════════════════════
   RegisterScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width, height } = Dimensions.get('window')

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// Règles de mot de passe fort — IDENTIQUES au web (frontend/app/api/client/register).
// L'inscription passe par l'API serveur qui revalide (obligation systeme).
const PWD_CRITERIA: { id: string; label: string; test: (p: string) => boolean }[] = [
    { id: 'length',  label: '12 caractères minimum', test: (p) => p.length >= 12 },
    { id: 'upper',   label: '1 lettre majuscule',    test: (p) => /[A-Z]/.test(p) },
    { id: 'digits',  label: '2 chiffres minimum',    test: (p) => (p.match(/\d/g) || []).length >= 2 },
    { id: 'special', label: '1 caractère spécial',   test: (p) => !/^[A-Za-z0-9]*$/.test(p) },
]

// Palette de l'agence (0% noir, 100% premium)
const C = {
    bg: '#F8F9FA',           // Blanc cassé très pur
    surface: 'rgba(255, 255, 255, 0.85)', // Verre translucide
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',       // Gris perle pour les bordures

    primary: '#047857',      // Bleu Profond (Agence) - Textes & Boutons
    accent: '#C9A84C',       // Or (Agence) - Highlights & Focus
    auraGreen: '#10B981',    // Vert (Agence) - Aura subtile fond
    error: '#EF4444',        // Rouge (Agence) - Erreurs

    textSec: '#64748B',      // Gris ardoise (textes secondaires)
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',  // Texte sur fond primaire
}

export default function RegisterScreen({ navigation }: any) {
    const { t } = useLang()

    const [prenom, setPrenom] = useState('')
    const [nom, setNom] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')

    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const pwdChecks = PWD_CRITERIA.map(c => ({ ...c, ok: c.test(password) }))
    const passwordStrong = pwdChecks.every(c => c.ok)

    /* ── Animations d'entrée (Stagger) ── */
    const headerAnim = useSharedValue(0)
    const formAnim = useSharedValue(0)
    const btnAnim = useSharedValue(0)

    /* ── Animation Corporate : Auras très subtiles et lentes ── */
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    useEffect(() => {
        // Apparition élégante
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        formAnim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement très lent et imperceptible pour donner vie au fond (effet texture)
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

    const handleRegister = async () => {
        if (!email.trim() || !password.trim() || !prenom.trim() || !nom.trim()) {
            Alert.alert(t('Champs requis'), t('Veuillez remplir tous les champs obligatoires.'))
            return
        }
        // Mot de passe fort obligatoire (revérifié côté serveur par l'API)
        if (!passwordStrong) {
            const missing = pwdChecks.filter(c => !c.ok).map(c => t(c.label)).join(', ')
            Alert.alert(t('Mot de passe trop faible'), `${t('Il manque')} : ${missing}.`)
            return
        }
        setLoading(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/client/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 20000,
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                    nom: nom.trim(),
                    prenom: prenom.trim(),
                    phone: phone.trim(),
                }),
            })
            const json = await res.json().catch(() => ({}))
            setLoading(false)
            if (!res.ok) {
                Alert.alert(t('Erreur'), json.error || t('Inscription impossible. Réessayez.'))
                return
            }
            Alert.alert(t('Bienvenue'), t('Veuillez vérifier votre email pour activer votre compte.'), [{ text: t('Continuer'), onPress: () => navigation.navigate('Login') }])
        } catch {
            setLoading(false)
            Alert.alert(t('Erreur'), t('Erreur de connexion. Réessayez.'))
        }
    }

    const isValid = prenom.trim() && nom.trim() && email.trim() && passwordStrong

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

            {/* 🎨 BACKGROUND PREMIUM : Auras diffuses aux couleurs de l'agence (très basse opacité) */}
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

            <ScrollView 
                contentContainerStyle={styles.scroll} 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                bounces={false}
                alwaysBounceVertical={false}
                overScrollMode="never"
            >

                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Prêt à')}</Text>
                    <Text style={styles.titleHighlight}>{t('vous lancer.')}</Text>
                    <Text style={styles.subtitle}>{t('Créez votre profil professionnel et rejoignez notre écosystème.')}</Text>
                </Animated.View>

                {/* FORMULAIRE */}
                <Animated.View style={[styles.formContainer, styleForm]}>
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Field icon="person-outline" placeholder={t('Prénom')} value={prenom} onChangeText={setPrenom} focused={focused === 'prenom'} onFocus={() => setFocused('prenom')} onBlur={() => setFocused(null)} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Field icon="person-outline" placeholder={t('Nom')} value={nom} onChangeText={setNom} focused={focused === 'nom'} onFocus={() => setFocused('nom')} onBlur={() => setFocused(null)} />
                        </View>
                    </View>

                    <Field icon="mail-outline" placeholder={t('Adresse e-mail')} value={email} onChangeText={setEmail} focused={focused === 'email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} keyboardType="email-address" autoCapitalize="none" />

                    <Field icon="call-outline" placeholder={t('Téléphone (Optionnel)')} value={phone} onChangeText={setPhone} focused={focused === 'phone'} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} keyboardType="phone-pad" />

                    <Field
                        icon="lock-closed-outline"
                        placeholder={t('Mot de passe sécurisé')}
                        value={password}
                        onChangeText={setPassword}
                        focused={focused === 'password'}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                        secureTextEntry={!showPassword}
                        rightSlot={
                            <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={15} style={[styles.eyeBtn, { zIndex: 10 }]}>
                                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={focused ? C.primary : C.placeholder} />
                            </TouchableOpacity>
                        }
                    />

                    {/* Critères de mot de passe fort */}
                    {password.length > 0 && (
                        <View style={{ marginTop: 8, paddingHorizontal: 4, gap: 4 }}>
                            {pwdChecks.map(c => (
                                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons
                                        name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={15}
                                        color={c.ok ? C.auraGreen : C.placeholder}
                                    />
                                    <Text style={{ fontSize: 12, color: c.ok ? C.primary : C.textSec }}>{t(c.label)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </Animated.View>

                {/* BOUTON & LOGIN LINK */}
                <Animated.View style={[styles.bottomContainer, styleBtn]}>
                    <InteractiveButton title={t('Créer mon compte')} onPress={handleRegister} disabled={!isValid || loading} loading={loading} />

                    <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
                        <Text style={styles.loginText}>{t('Déjà membre ?')} <Text style={styles.loginBold}>{t('Se connecter')}</Text></Text>
                    </Pressable>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FIELD (Minimaliste, bordure Or au focus)
═══════════════════════════════════════════════════════════ */
function Field({ icon, placeholder, value, onChangeText, focused, onFocus, onBlur, keyboardType, autoCapitalize, secureTextEntry, rightSlot }: any) {
    const focusAnim = useSharedValue(0)

    useEffect(() => {
        focusAnim.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [focused])

    const rStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.accent]), // Passe au Or
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.01, 0.08]), // Ombre subtile
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.01]) }]
    }))

    const iconColor = focused ? C.accent : C.placeholder // Icône devient Or

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
   COMPOSANT : BOUTON INTERACTIF (Bleu agence massif & luxe)
═══════════════════════════════════════════════════════════ */
function InteractiveButton({ title, onPress, disabled, loading }: any) {
    return (
        <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.btn, disabled && styles.btnDisabled]}>
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

    /* ── Auras extrêmement discrètes (Corporate) ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05, // À peine perceptible, donne un aspect "papier glacé"
    },
    aura1: {
        top: -100,
        right: -100,
        backgroundColor: C.primary, // Bleu agence
    },
    aura2: {
        bottom: 50,
        left: -100,
        backgroundColor: C.auraGreen, // Vert agence
    },

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
    scroll: {
        paddingHorizontal: 28,
        paddingBottom: 80,
    },
    headerContainer: {
        marginTop: 15,
        marginBottom: 40,
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
        color: C.accent, // Or agence
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
    formContainer: {
        gap: 16,
    },
    row: {
        flexDirection: 'row',
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 60,
        borderWidth: 1.2,
        borderRadius: 16, // Moins "rondouillard", plus sérieux
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
        padding: 4,
    },
    bottomContainer: {
        marginTop: 48,
    },
    btn: {
        height: 60,
        backgroundColor: C.primary, // Bleu massif
        borderRadius: 16, // Cohérent avec les inputs
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
    loginLink: {
        marginTop: 24,
        alignItems: 'center',
        padding: 12,
    },
    loginText: {
        color: C.textSec,
        fontSize: 14,
        fontWeight: '500',
    },
    loginBold: {
        color: C.primary,
        fontWeight: '700',
    },
})