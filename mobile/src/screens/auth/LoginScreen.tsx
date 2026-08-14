import React, { useState } from 'react'
import {
    View, Text, TextInput, Pressable, ScrollView, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast, confirm } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { FlagBar } from '../../components/ui'
import { screenColors, spacing, radius } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const C = screenColors

/**
 * Écran Connexion : rendu fidèle à la maquette Sleek (exportée) - liseré
 * tricolore, titre « Bon retour. », champs à icône, bouton vert plein. La
 * LOGIQUE est préservée à l'identique : signIn, gestion du compte non confirmé
 * et renvoi du lien de confirmation.
 */
export default function LoginScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { signIn } = useAuth()
    const { t } = useLang()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const renvoyerConfirmation = async () => {
        if (!email.trim()) {
            toast(t('Email requis'), t('Saisissez votre adresse pour recevoir le lien.'))
            return
        }
        setLoading(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/client/resend-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 15000,
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            })
            const json = await res.json().catch(() => ({}))
            if (res.ok) {
                toast(t('Lien envoyé'), t('Un nouveau lien de confirmation vient de partir vers votre adresse.'), 'success')
            } else {
                toast(t('Envoi impossible'), json.error || t('Réessayez dans quelques minutes.'))
            }
        } catch {
            toast(t('Erreur réseau'), t('Vérifiez votre connexion et réessayez.'))
        } finally {
            setLoading(false)
        }
    }

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast(t('Champs requis'), t('Veuillez remplir tous les champs.'))
            return
        }
        setLoading(true)
        const { error } = await signIn(email.trim(), password)
        setLoading(false)
        if (!error) return

        const msg = (error.message || '').toLowerCase()
        const nonConfirme = msg.includes('confirm') || msg.includes('not confirmed') || msg.includes('email')
        if (nonConfirme) {
            confirm({
                title: t('Compte à activer'),
                message: t("Votre compte existe mais n'est pas encore activé. Vérifiez votre boîte mail (et vos spams) pour le lien de confirmation. Vous renvoyer ce lien ?"),
                confirmLabel: t('Renvoyer le lien'),
                cancelLabel: t('Plus tard'),
                onConfirm: () => { void renvoyerConfirmation() },
            })
            return
        }
        toast(t('Connexion impossible'), t('Email ou mot de passe incorrect.'))
    }

    const fieldStyle = (name: string) => [styles.field, focused === name && styles.fieldFocused]

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* En-tête */}
                <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={styles.title}>{t('Bon retour.')}</Text>
                    <Text style={styles.subtitle}>{t('Connectez-vous pour suivre votre dossier.')}</Text>
                </Animated.View>

                {/* Formulaire */}
                <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
                    <View>
                        <Text style={styles.label}>{t('Adresse email')}</Text>
                        <View style={fieldStyle('email')}>
                            <Mail size={20} color={C.textMuted} strokeWidth={2} />
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                onFocus={() => setFocused('email')}
                                onBlur={() => setFocused(null)}
                                placeholder="nom@exemple.com"
                                placeholderTextColor={C.placeholder}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                style={styles.input}
                            />
                        </View>
                    </View>

                    <View>
                        <Text style={styles.label}>{t('Mot de passe')}</Text>
                        <View style={fieldStyle('password')}>
                            <Lock size={20} color={C.textMuted} strokeWidth={2} />
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocused('password')}
                                onBlur={() => setFocused(null)}
                                placeholder="••••••••"
                                placeholderTextColor={C.placeholder}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                style={styles.input}
                            />
                            <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8} accessibilityLabel={t('Afficher le mot de passe')}>
                                {showPassword ? <EyeOff size={20} color={C.textMuted} /> : <Eye size={20} color={C.textMuted} />}
                            </Pressable>
                        </View>
                        <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink} hitSlop={6}>
                            <Text style={styles.forgotText}>{t('Mot de passe oublié ?')}</Text>
                        </Pressable>
                    </View>
                </Animated.View>

                {/* Bouton */}
                <Animated.View entering={FadeInDown.duration(500).delay(240)}>
                    <Pressable
                        onPress={handleLogin}
                        disabled={loading}
                        style={({ pressed }) => [styles.submitBtn, pressed && { transform: [{ scale: 0.98 }] }, loading && { opacity: 0.7 }]}
                        accessibilityRole="button"
                    >
                        {loading ? <ActivityIndicator color={C.primaryText} /> : <Text style={styles.submitText}>{t('Se connecter')}</Text>}
                    </Pressable>

                    <View style={styles.registerRow}>
                        <Text style={styles.registerMuted}>{t('Pas encore de compte ?')}</Text>
                        <Pressable onPress={() => navigation.navigate('Register')} hitSlop={6}>
                            <Text style={styles.registerLink}>{t("S'inscrire")}</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingBottom: 40 },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
    backBtn: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
    },
    title: { fontSize: 30, lineHeight: 36, fontFamily: 'Inter_800ExtraBold', color: C.text, letterSpacing: -0.5, marginBottom: 6 },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: C.textSec },

    form: { paddingHorizontal: spacing.lg, gap: spacing.md },
    label: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase', color: C.textMuted, marginBottom: 8, marginLeft: 4 },
    field: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14,
    },
    fieldFocused: { borderColor: C.primary, backgroundColor: C.surface },
    input: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text, padding: 0 },
    forgotLink: { alignSelf: 'flex-end', marginTop: 10 },
    forgotText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: C.primary },

    submitBtn: {
        marginHorizontal: spacing.lg, marginTop: spacing.xl,
        backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    submitText: { color: C.primaryText, fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
    registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.lg },
    registerMuted: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSec },
    registerLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
})
