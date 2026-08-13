import React, { useState } from 'react'
import {
    View, Text, TextInput, Pressable, ScrollView, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Mail, Lock, Eye, EyeOff, User, Phone, Check, Circle, CheckCircle2 } from 'lucide-react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { FlagBar } from '../../components/ui'
import { screenColors, spacing, radius } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const C = screenColors

// Règles de mot de passe fort : IDENTIQUES au web (frontend/app/api/client/register).
// L'inscription passe par l'API serveur qui revalide (obligation systeme).
const PWD_CRITERIA: { id: string; label: string; test: (p: string) => boolean }[] = [
    { id: 'length', label: '12 caractères minimum', test: (p) => p.length >= 12 },
    { id: 'upper', label: '1 lettre majuscule', test: (p) => /[A-Z]/.test(p) },
    { id: 'digits', label: '2 chiffres minimum', test: (p) => (p.match(/\d/g) || []).length >= 2 },
    { id: 'special', label: '1 caractère spécial', test: (p) => !/^[A-Za-z0-9]*$/.test(p) },
]

/**
 * Écran Inscription : rendu fidèle à la maquette Sleek exportée (« Rejoignez-nous. »
 * + grille prénom/nom, email, téléphone, mot de passe, CGU, bouton vert). LOGIQUE
 * préservée : mot de passe fort revérifié serveur, POST /api/client/register,
 * puis navigation vers ConfirmEmail.
 */
export default function RegisterScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()

    const [prenom, setPrenom] = useState('')
    const [nom, setNom] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [accepted, setAccepted] = useState(false)

    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)

    const pwdChecks = PWD_CRITERIA.map(c => ({ ...c, ok: c.test(password) }))
    const passwordStrong = pwdChecks.every(c => c.ok)
    const isValid = !!(prenom.trim() && nom.trim() && email.trim() && passwordStrong && accepted)

    const handleRegister = async () => {
        if (!email.trim() || !password.trim() || !prenom.trim() || !nom.trim()) {
            toast(t('Champs requis'), t('Veuillez remplir tous les champs obligatoires.'))
            return
        }
        if (!accepted) {
            toast(t('Conditions requises'), t("Veuillez accepter les conditions d'utilisation."))
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

    const fieldStyle = (name: string) => [styles.field, focused === name && styles.fieldFocused]

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={styles.title}>{t('Rejoignez-nous.')}</Text>
                    <Text style={styles.subtitle}>{t('Commencez votre projet de retour dès aujourd\'hui.')}</Text>
                </Animated.View>

                <Animated.View entering={FadeInDown.duration(500).delay(120)} style={styles.form}>
                    {/* Prénom / Nom */}
                    <View style={styles.row}>
                        <View style={styles.rowItem}>
                            <Text style={styles.label}>{t('Prénom')}</Text>
                            <View style={fieldStyle('prenom')}>
                                <User size={18} color={C.textMuted} strokeWidth={2} />
                                <TextInput
                                    value={prenom} onChangeText={setPrenom}
                                    onFocus={() => setFocused('prenom')} onBlur={() => setFocused(null)}
                                    placeholder="Jean" placeholderTextColor={C.placeholder} style={styles.input}
                                />
                            </View>
                        </View>
                        <View style={styles.rowItem}>
                            <Text style={styles.label}>{t('Nom')}</Text>
                            <View style={fieldStyle('nom')}>
                                <User size={18} color={C.textMuted} strokeWidth={2} />
                                <TextInput
                                    value={nom} onChangeText={setNom}
                                    onFocus={() => setFocused('nom')} onBlur={() => setFocused(null)}
                                    placeholder="Baptiste" placeholderTextColor={C.placeholder} style={styles.input}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Email */}
                    <View>
                        <Text style={styles.label}>{t('Adresse email')}</Text>
                        <View style={fieldStyle('email')}>
                            <Mail size={20} color={C.textMuted} strokeWidth={2} />
                            <TextInput
                                value={email} onChangeText={setEmail}
                                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                                placeholder="jean.b@exemple.com" placeholderTextColor={C.placeholder}
                                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Téléphone */}
                    <View>
                        <Text style={styles.label}>{t('Téléphone (WhatsApp)')}</Text>
                        <View style={fieldStyle('phone')}>
                            <Phone size={20} color={C.textMuted} strokeWidth={2} />
                            <TextInput
                                value={phone} onChangeText={setPhone}
                                onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                                placeholder="+229 01 60 32 21 21" placeholderTextColor={C.placeholder}
                                keyboardType="phone-pad" style={styles.input}
                            />
                        </View>
                    </View>

                    {/* Mot de passe */}
                    <View>
                        <Text style={styles.label}>{t('Mot de passe')}</Text>
                        <View style={fieldStyle('password')}>
                            <Lock size={20} color={C.textMuted} strokeWidth={2} />
                            <TextInput
                                value={password} onChangeText={setPassword}
                                onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                                placeholder="••••••••" placeholderTextColor={C.placeholder}
                                secureTextEntry={!showPassword} autoCapitalize="none" style={styles.input}
                            />
                            <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8} accessibilityLabel={t('Afficher le mot de passe')}>
                                {showPassword ? <EyeOff size={20} color={C.textMuted} /> : <Eye size={20} color={C.textMuted} />}
                            </Pressable>
                        </View>
                        {/* Critères de mot de passe fort */}
                        {password.length > 0 && (
                            <View style={styles.criteria}>
                                {pwdChecks.map(c => (
                                    <View key={c.id} style={styles.criterion}>
                                        {c.ok
                                            ? <CheckCircle2 size={15} color={C.success} />
                                            : <Circle size={15} color={C.placeholder} />}
                                        <Text style={[styles.criterionText, c.ok && { color: C.primary }]}>{t(c.label)}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* CGU */}
                    <Pressable onPress={() => setAccepted(a => !a)} style={styles.cguRow} hitSlop={6}>
                        <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                            {accepted && <Check size={14} color={C.primaryText} strokeWidth={3} />}
                        </View>
                        <Text style={styles.cguText}>
                            {t("J'accepte les")} <Text style={styles.cguLink}>{t("Conditions Générales d'Utilisation")}</Text> {t('et la politique de confidentialité.')}
                        </Text>
                    </Pressable>
                </Animated.View>

                {/* Bouton */}
                <Animated.View entering={FadeInDown.duration(500).delay(240)}>
                    <Pressable
                        onPress={handleRegister}
                        disabled={loading || !isValid}
                        style={({ pressed }) => [styles.submitBtn, pressed && { transform: [{ scale: 0.98 }] }, (loading || !isValid) && { opacity: 0.5 }]}
                        accessibilityRole="button"
                    >
                        {loading ? <ActivityIndicator color={C.primaryText} /> : <Text style={styles.submitText}>{t('Créer mon compte')}</Text>}
                    </Pressable>

                    <View style={styles.loginRow}>
                        <Text style={styles.loginMuted}>{t('Déjà membre ?')}</Text>
                        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={6}>
                            <Text style={styles.loginLink}>{t('Se connecter')}</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingBottom: 48 },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
    backBtn: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
    },
    title: { fontSize: 30, lineHeight: 36, fontFamily: 'Inter_800ExtraBold', color: C.text, letterSpacing: -0.5, marginBottom: 6 },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: C.textSec },

    form: { paddingHorizontal: spacing.lg, gap: spacing.md },
    row: { flexDirection: 'row', gap: spacing.md },
    rowItem: { flex: 1 },
    label: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 1, textTransform: 'uppercase', color: C.textMuted, marginBottom: 8, marginLeft: 4 },
    field: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14,
    },
    fieldFocused: { borderColor: C.primary, backgroundColor: C.surface },
    input: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: C.text, padding: 0 },

    criteria: { marginTop: 10, paddingHorizontal: 4, gap: 5 },
    criterion: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    criterionText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textSec },

    cguRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
    checkbox: {
        width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    checkboxOn: { backgroundColor: C.primary },
    cguText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium', color: C.textSec },
    cguLink: { color: C.primary, fontFamily: 'Inter_700Bold' },

    submitBtn: {
        marginHorizontal: spacing.lg, marginTop: spacing.xl,
        backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    submitText: { color: C.primaryText, fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },
    loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.lg },
    loginMuted: { fontSize: 14, fontFamily: 'Inter_500Medium', color: C.textSec },
    loginLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary },
})
