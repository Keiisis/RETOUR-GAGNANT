import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, ScrollView, ActivityIndicator, Pressable, Dimensions, TouchableOpacity
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
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

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
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

export default function RegisterScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
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

    useEffect(() => {
        // Apparition élégante
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
        formAnim.value = withDelay(150, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))
        btnAnim.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }))

        // Mouvement très lent et imperceptible pour donner vie au fond (effet texture)
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


    const handleRegister = async () => {
        if (!email.trim() || !password.trim() || !prenom.trim() || !nom.trim()) {
            toast(t('Champs requis'), t('Veuillez remplir tous les champs obligatoires.'))
            return
        }
        // Mot de passe fort obligatoire (revérifié côté serveur par l'API)
        if (!passwordStrong) {
            const missing = pwdChecks.filter(c => !c.ok).map(c => t(c.label)).join(', ')
            toast(t('Mot de passe trop faible'), `${t('Il manque')} : ${missing}.`)
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
                toast(t('Erreur'), json.error || t('Inscription impossible. Réessayez.'))
                return
            }
            toast(t('Bienvenue'), t('Un code de confirmation vient de partir vers votre e-mail.'), 'success')
            navigation.navigate('ConfirmEmail', { email: email.trim().toLowerCase() })
        } catch {
            setLoading(false)
            toast(t('Erreur'), t('Erreur de connexion. Réessayez.'))
        }
    }

    const isValid = prenom.trim() && nom.trim() && email.trim() && passwordStrong

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

                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Creer mon compte')}</Text>
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
                            <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={15} style={[styles.eyeBtn, { zIndex: 10 }]}
                                accessibilityRole="button"
                                accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                                <LucideIcon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={focused ? C.primary : C.placeholder} />
                            </TouchableOpacity>
                        }
                    />

                    {/* Critères de mot de passe fort */}
                    {password.length > 0 && (
                        <View style={{ marginTop: 8, paddingHorizontal: 4, gap: 4 }}>
                            {pwdChecks.map(c => (
                                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <LucideIcon
                                        name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={15}
                                        color={c.ok ? C.success : C.placeholder}
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

                    <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink}
                        accessibilityRole="button"
                        hitSlop={6}>
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
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.primary]), // Passe au Or
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.01, 0.08]), // Ombre subtile
        transform: [{ scale: interpolate(focusAnim.value, [0, 1], [1, 1.01]) }]
    }))

    const iconColor = focused ? C.accent : C.placeholder // Icône devient Or

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
                autoCapitalize={autoCapitalize || 'none'}
                autoCorrect={false}
                secureTextEntry={secureTextEntry}
                selectionColor={C.primary}
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
        <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} style={[styles.btn, disabled && styles.btnDisabled]}
            accessibilityRole="button"
            hitSlop={6}>
            {loading ? (
                <ActivityIndicator color={C.primaryText} size="small" />
            ) : (
                <>
                    <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{title}</Text>
                    {!disabled && <LucideIcon name="arrow-forward" size={18} color={C.primary} style={{ marginLeft: 8 }} />}
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

    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    scroll: {
        paddingHorizontal: 28,
        paddingBottom: 80,
    },
    headerContainer: {
        marginTop: 15,
        marginBottom: 40,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontFamily: fonts.regular,
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
        borderWidth: 1,
        borderRadius: radius.lg, // Moins "rondouillard", plus sérieux
        paddingHorizontal: 16,
        ...shadows.card,
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
        borderRadius: radius.lg, // Cohérent avec les inputs
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
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
        color: C.surfaceAlt,
    },
    loginLink: {
        marginTop: 24,
        alignItems: 'center',
        padding: 12,
    },
    loginText: {
        color: C.textSec,
        fontSize: 14,
        fontFamily: fonts.medium,
    },
    loginBold: {
        color: C.primary,
        fontFamily: fonts.bold,
    },
})