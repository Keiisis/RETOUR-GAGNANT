'use strict'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform,
    ActivityIndicator, Dimensions, Pressable, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withRepeat,
    withSequence, withDelay, withSpring, interpolate, Easing,
} from 'react-native-reanimated'
import { ArrowLeft, Lock, LogOut, ShieldCheck, KeyRound, Sparkles, Eye, EyeOff, Check, X, Fingerprint } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Security'>

const { width: SCREEN_W } = Dimensions.get('window')

/* ──────────────────────────────────────────────
   PALETTE — Corporate Premium 2026
   ────────────────────────────────────────────── */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

/* ──────────────────────────────────────────────
   ANIMATED SECTION — fade-in staggered
   ────────────────────────────────────────────── */
function AnimatedSection({ delay = 0, children, style }: any) {
    const v = useSharedValue(0)
    useEffect(() => {
        v.value = withDelay(delay, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }))
    }, [])
    const animated = useAnimatedStyle(() => ({
        opacity: v.value,
        transform: [{ translateY: interpolate(v.value, [0, 1], [16, 0]) }],
    }))
    return <Animated.View style={[animated, style]}>{children}</Animated.View>
}

/* ──────────────────────────────────────────────
   INTERACTIVE BUTTON — press scale
   ────────────────────────────────────────────── */
function InteractiveButton({ onPress, disabled, style, children }: any) {
    const s = useSharedValue(1)
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            onPressIn={() => { s.value = withSpring(0.97, { damping: 14 }) }}
            onPressOut={() => { s.value = withSpring(1, { damping: 14 }) }}
            accessibilityRole="button"
            hitSlop={6}
        >
            <Animated.View style={[animated, style]}>{children}</Animated.View>
        </Pressable>
    )
}

/* ──────────────────────────────────────────────
   HERO — bouclier animé doré
   ────────────────────────────────────────────── */
function SecurityHero({ score, t }: { score: number; t: (s: string) => string }) {
    const shine = useSharedValue(0)
    const pulse = useSharedValue(0)
    useEffect(() => {
        shine.value = withTiming(1, { duration: 600 })
        pulse.value = withTiming(1, { duration: 600 })
    }, [])

    const shineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(shine.value, [0, 1], [-SCREEN_W, SCREEN_W]) }],
        opacity: interpolate(shine.value, [0, 0.5, 1], [0, 0.4, 0]),
    }))
    const ringStyle = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.15]) }],
        opacity: interpolate(pulse.value, [0, 1], [0.45, 0]),
    }))

    const level = score === 0 ? t('Définir') : score <= 1 ? t('Faible') : score === 2 ? t('Correct') : score === 3 ? t('Robuste') : t('Excellent')
    const levelColor = score === 0 ? C.accent : score <= 1 ? C.danger : score === 2 ? C.warning : score === 3 ? C.successMid : C.success

    return (
        <View style={hero.wrap}>
            <View style={hero.gradient}>

                {/* chip top */}
                <View style={hero.topRow}>
                    <View style={hero.chip}>
                        <Sparkles size={11} color={C.accent} strokeWidth={2} />
                        <Text style={hero.chipText}>{t('PROTECTION PREMIUM')}</Text>
                    </View>
                    <View style={[hero.levelChip, { borderColor: levelColor + '60' }]}>
                        <View style={[hero.levelDot, { backgroundColor: levelColor }]} />
                        <Text style={[hero.levelText, { color: levelColor }]}>{level}</Text>
                    </View>
                </View>

                {/* shield avec halo */}
                <View style={hero.shieldWrap}>
                    <Animated.View style={[hero.shieldRing, ringStyle]} />
                    <View style={hero.shieldInner}>
                        <ShieldCheck size={44} color={C.accent} strokeWidth={1.6} />
                    </View>
                </View>

                <Text style={hero.title}>{t('Centre de sécurité')}</Text>
                <Text style={hero.subtitle}>
                    {t('Votre compte est protégé par un chiffrement de niveau bancaire')}
                </Text>

                {/* footer stats */}
                <View style={hero.statsRow}>
                    <View style={hero.statCol}>
                        <Fingerprint size={14} color={C.accentSoft} strokeWidth={1.8} />
                        <Text style={hero.statLabel}>{t('Auth.')}</Text>
                        <Text style={hero.statValue}>{t('Active')}</Text>
                    </View>
                    <View style={hero.statDivider} />
                    <View style={hero.statCol}>
                        <KeyRound size={14} color={C.accentSoft} strokeWidth={1.8} />
                        <Text style={hero.statLabel}>{t('Mot de passe')}</Text>
                        <Text style={hero.statValue}>{level}</Text>
                    </View>
                    <View style={hero.statDivider} />
                    <View style={hero.statCol}>
                        <Lock size={14} color={C.accentSoft} strokeWidth={1.8} />
                        <Text style={hero.statLabel}>{t('Chiffrement')}</Text>
                        <Text style={hero.statValue}>AES-256</Text>
                    </View>
                </View>
            </View>
        </View>
    )
}

/* ──────────────────────────────────────────────
   PASSWORD FIELD — premium
   ────────────────────────────────────────────── */
function PasswordField({
    label, value, onChange, show, onToggle, placeholder, focused, setFocused, field,
}: any) {
    const isFocus = focused === field
    const scale = useSharedValue(1)
    useEffect(() => { scale.value = withSpring(isFocus ? 1.01 : 1, { damping: 14 }) }, [isFocus])
    const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

    return (
        <View style={field2.group}>
            <Text style={field2.label}>{label}</Text>
            <Animated.View style={[
                field2.wrapper,
                isFocus && field2.wrapperFocus,
                animated,
            ]}>
                <View style={[field2.iconBox, isFocus && field2.iconBoxFocus]}>
                    <Lock size={16} color={isFocus ? C.accent : C.textMuted} strokeWidth={2} />
                </View>
                <TextInput
                    style={field2.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={C.textMuted}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    onFocus={() => setFocused(field)}
                    onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                    onPress={onToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={field2.eyeBtn}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                    {show
                        ? <EyeOff size={18} color={C.textSecond} strokeWidth={1.8} />
                        : <Eye size={18} color={C.textSecond} strokeWidth={1.8} />}
                </TouchableOpacity>
            </Animated.View>
        </View>
    )
}

/* ──────────────────────────────────────────────
   MAIN SCREEN
   ────────────────────────────────────────────── */
export default function SecurityScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const { t } = useLang()
    const [loading, setLoading] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // ── 2FA (double authentification) ──
    const [twofaEnabled, setTwofaEnabled] = useState(false)
    const [twofaLoading, setTwofaLoading] = useState(true)
    const [twofaStep, setTwofaStep] = useState<'idle' | 'enroll' | 'disable'>('idle')
    const [twofaQr, setTwofaQr] = useState('')
    const [twofaSecret, setTwofaSecret] = useState('')
    const [twofaCode, setTwofaCode] = useState('')
    const [twofaBusy, setTwofaBusy] = useState(false)

    const getToken = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token || ''
    }, [])

    useEffect(() => {
        (async () => {
            try {
                const token = await getToken()
                if (!token) { setTwofaLoading(false); return }
                const res = await fetch(`${API_BASE}/api/client/2fa/status`, { headers: { Authorization: `Bearer ${token}` } })
                const json = await res.json().catch(() => ({}))
                setTwofaEnabled(!!json?.enabled)
            } catch { /* ignore */ } finally { setTwofaLoading(false) }
        })()
    }, [getToken])

    const startEnroll2fa = useCallback(async () => {
        setTwofaBusy(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_BASE}/api/client/2fa/setup`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
            const json = await res.json()
            if (!res.ok) { toast(t('Erreur'), json.error || t('Erreur')); return }
            setTwofaQr(json.qrCode); setTwofaSecret(json.secret); setTwofaCode(''); setTwofaStep('enroll')
        } catch { toast(t('Erreur'), t('Erreur de connexion')) } finally { setTwofaBusy(false) }
    }, [getToken, t])

    const confirmEnroll2fa = useCallback(async () => {
        if (!/^\d{6}$/.test(twofaCode)) { toast(t('Code requis'), t('Entrez le code à 6 chiffres.')); return }
        setTwofaBusy(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_BASE}/api/client/2fa/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code: twofaCode, action: 'setup' }),
            })
            const json = await res.json()
            if (!res.ok) { toast(t('Erreur'), json.error || t('Code incorrect')); return }
            setTwofaEnabled(true); setTwofaStep('idle'); setTwofaQr(''); setTwofaSecret(''); setTwofaCode('')
            toast(t('2FA activée'), t('La double authentification est maintenant active sur votre compte.'))
        } catch { toast(t('Erreur'), t('Erreur de connexion')) } finally { setTwofaBusy(false) }
    }, [twofaCode, getToken, t])

    const disable2fa = useCallback(async () => {
        if (!/^\d{6}$/.test(twofaCode)) { toast(t('Code requis'), t('Entrez le code à 6 chiffres pour confirmer.')); return }
        setTwofaBusy(true)
        try {
            const token = await getToken()
            const res = await fetch(`${API_BASE}/api/client/2fa/disable`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code: twofaCode }),
            })
            const json = await res.json()
            if (!res.ok) { toast(t('Erreur'), json.error || t('Code incorrect')); return }
            setTwofaEnabled(false); setTwofaStep('idle'); setTwofaCode('')
            toast(t('2FA désactivée'), t('La double authentification a été retirée de votre compte.'))
        } catch { toast(t('Erreur'), t('Erreur de connexion')) } finally { setTwofaBusy(false) }
    }, [twofaCode, getToken, t])

    // Politique forte (identique au web/inscription) : 12+ car., majuscule, 2 chiffres, spécial
    const isPasswordStrong = (p: string) =>
        p.length >= 12 && /[A-Z]/.test(p) && (p.match(/\d/g) || []).length >= 2 && /[^A-Za-z0-9]/.test(p)

    const strength = useMemo(() => {
        const p = newPassword
        if (p.length === 0) return { level: 0, label: '', color: 'transparent' }
        let score = 0
        if (p.length >= 12) score++
        if (/[A-Z]/.test(p)) score++
        if ((p.match(/\d/g) || []).length >= 2) score++
        if (/[^A-Za-z0-9]/.test(p)) score++
        if (score <= 1) return { level: 1, label: t('Faible'), color: C.danger }
        if (score === 2) return { level: 2, label: t('Moyen'), color: C.warning }
        if (score === 3) return { level: 3, label: t('Bon'), color: C.successMid }
        return { level: 4, label: t('Fort'), color: C.success }
    }, [newPassword, t])

    const handleSave = useCallback(async () => {
        if (!newPassword.trim()) {
            toast(t('Champ requis'), t('Veuillez saisir un nouveau mot de passe.'))
            return
        }
        if (!isPasswordStrong(newPassword)) {
            toast(t('Mot de passe trop faible'), t('Requis : 12 caractères minimum, 1 majuscule, 2 chiffres et 1 caractère spécial.'))
            return
        }
        if (newPassword !== confirmPassword) {
            toast(t('Mots de passe différents'), t('La confirmation ne correspond pas au nouveau mot de passe.'))
            return
        }
        setLoading(true)
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        setLoading(false)
        if (error) {
            toast(t('Erreur'), error.message)
        } else {
            toast(t('Mot de passe modifié'), t('Votre mot de passe a été mis à jour avec succès.'), 'success')
            navigation.goBack()
        }
    }, [newPassword, confirmPassword, navigation, t])

    const rules = [
        { rule: newPassword.length >= 12, text: t('Au moins 12 caractères') },
        { rule: /[A-Z]/.test(newPassword), text: t('Une majuscule') },
        { rule: (newPassword.match(/\d/g) || []).length >= 2, text: t('Deux chiffres') },
        { rule: /[^A-Za-z0-9]/.test(newPassword), text: t('Un caractère spécial') },
    ]

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={StyleSheet.absoluteFillObject}>
            </View>

            {/* Header custom */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <InteractiveButton
                    onPress={() => navigation.goBack()}
                    style={styles.headerBtn}
                >
                    <ArrowLeft size={20} color={C.primary} strokeWidth={2} />
                </InteractiveButton>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('Sécurité')}</Text>
                    <Text style={styles.headerSub}>{t('Gérez votre protection')}</Text>
                </View>
                <View style={styles.headerBtnGhost} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* HERO */}
                <AnimatedSection delay={0}>
                    <SecurityHero score={strength.level} t={t} />
                </AnimatedSection>

                {/* INFO BANNER */}
                <AnimatedSection delay={120}>
                    <View style={styles.infoBanner}>
                        <View style={styles.infoIconBox}>
                            <ShieldCheck size={18} color={C.accent} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoTitle}>{t('Conseil de sécurité')}</Text>
                            <Text style={styles.infoText}>
                                {t('Choisissez un mot de passe fort : au moins 8 caractères, avec majuscules, chiffres et symboles.')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* PASSWORD CARD */}
                <AnimatedSection delay={220}>
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardHeaderIcon}>
                                <KeyRound size={16} color={C.primary} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{t('Nouveau mot de passe')}</Text>
                                <Text style={styles.cardSub}>{t('Définissez vos nouvelles clés d’accès')}</Text>
                            </View>
                        </View>

                        <View style={styles.cardBody}>
                            <PasswordField
                                label={t('Nouveau mot de passe')}
                                value={newPassword}
                                onChange={setNewPassword}
                                show={showNew}
                                onToggle={() => setShowNew(v => !v)}
                                field="new"
                                placeholder={t('Min. 8 caractères')}
                                focused={focused}
                                setFocused={setFocused}
                            />

                            {newPassword.length > 0 && (
                                <View style={styles.strengthWrap}>
                                    <View style={styles.strengthBars}>
                                        {[1, 2, 3, 4].map(i => (
                                            <View
                                                key={i}
                                                style={[
                                                    styles.strengthBar,
                                                    { backgroundColor: i <= strength.level ? strength.color : C.border },
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                                        {strength.label}
                                    </Text>
                                </View>
                            )}

                            <View style={styles.rulesGrid}>
                                {rules.map(({ rule, text }) => (
                                    <View key={text} style={[styles.ruleChip, rule && styles.ruleChipDone]}>
                                        <View style={[styles.ruleDot, rule && styles.ruleDotDone]}>
                                            {rule
                                                ? <Check size={10} color={C.textPrimary} strokeWidth={3} />
                                                : <View style={styles.ruleDotEmpty} />}
                                        </View>
                                        <Text style={[styles.ruleText, rule && styles.ruleTextDone]}>{text}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.divider} />

                            <PasswordField
                                label={t('Confirmer le mot de passe')}
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                show={showConfirm}
                                onToggle={() => setShowConfirm(v => !v)}
                                field="confirm"
                                placeholder={t('Répétez le mot de passe')}
                                focused={focused}
                                setFocused={setFocused}
                            />

                            {confirmPassword.length > 0 && (
                                <View style={[
                                    styles.matchBanner,
                                    {
                                        backgroundColor: (newPassword === confirmPassword ? C.success : C.danger) + '12',
                                        borderColor: (newPassword === confirmPassword ? C.success : C.danger) + '30'
                                    },
                                ]}>
                                    {newPassword === confirmPassword
                                        ? <Check size={14} color={C.success} strokeWidth={2.5} />
                                        : <X size={14} color={C.danger} strokeWidth={2.5} />}
                                    <Text style={[
                                        styles.matchText,
                                        { color: newPassword === confirmPassword ? C.success : C.danger },
                                    ]}>
                                        {newPassword === confirmPassword
                                            ? t('Les mots de passe correspondent')
                                            : t('Les mots de passe ne correspondent pas')}
                                    </Text>
                                </View>
                            )}

                            <InteractiveButton
                                onPress={handleSave}
                                disabled={loading}
                                style={{ marginTop: 8 }}
                            >
                                <View style={[
                                    styles.saveBtn,
                                    { backgroundColor: loading ? C.textMuted : C.primary },
                                ]}>
                                    {loading ? (
                                        <ActivityIndicator color={C.primaryText} size="small" />
                                    ) : (
                                        <>
                                            <View style={styles.saveBtnIcon}>
                                                <ShieldCheck size={16} color={C.primaryText} strokeWidth={2} />
                                            </View>
                                            <Text style={styles.saveBtnText}>
                                                {t('Mettre à jour le mot de passe')}
                                            </Text>
                                        </>
                                    )}
                                </View>
                            </InteractiveButton>
                        </View>
                    </View>
                </AnimatedSection>

                {/* 2FA CARD */}
                <AnimatedSection delay={300}>
                    <View style={styles.twofaCard}>
                        <View style={styles.twofaHead}>
                            <View style={styles.twofaIconBox}>
                                <ShieldCheck size={18} color={C.primary} strokeWidth={2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{t('Double authentification (2FA)')}</Text>
                                <Text style={styles.twofaStatus}>
                                    {twofaLoading ? t('Vérification…') : twofaEnabled ? t('Activée') : t('Désactivée')}
                                </Text>
                            </View>
                        </View>

                        <Text style={styles.twofaDesc}>
                            {t('Ajoutez un code à usage unique (Google Authenticator, Authy…) en plus de votre mot de passe.')}
                        </Text>

                        {!twofaLoading && !twofaEnabled && twofaStep === 'idle' && (
                            <TouchableOpacity onPress={startEnroll2fa} disabled={twofaBusy} style={styles.twofaPrimaryBtn}
                                accessibilityRole="button"
                                hitSlop={6}>
                                {twofaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.twofaPrimaryText}>{t('Activer la 2FA')}</Text>}
                            </TouchableOpacity>
                        )}

                        {!twofaEnabled && twofaStep === 'enroll' && (
                            <View style={{ gap: 12 }}>
                                {!!twofaQr && (
                                    <View style={styles.twofaQrWrap}>
                                        <Image source={{ uri: twofaQr }} style={styles.twofaQr} />
                                    </View>
                                )}
                                <Text style={styles.twofaHint}>{t('1. Scannez le QR code, ou saisissez la clé :')}</Text>
                                <Text selectable style={styles.twofaSecret}>{twofaSecret}</Text>
                                <Text style={styles.twofaHint}>{t('2. Entrez le code à 6 chiffres généré :')}</Text>
                                <TextInput value={twofaCode} onChangeText={v => setTwofaCode(v.replace(/\D/g, '').slice(0, 6))}
                                    keyboardType="number-pad" placeholder="123456" placeholderTextColor={C.textMuted}
                                    style={styles.twofaInput} maxLength={6} />
                                <TouchableOpacity onPress={confirmEnroll2fa} disabled={twofaBusy} style={styles.twofaPrimaryBtn}
                                    accessibilityRole="button"
                                    hitSlop={6}>
                                    {twofaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.twofaPrimaryText}>{t('Confirmer')}</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        {twofaEnabled && twofaStep === 'idle' && (
                            <TouchableOpacity onPress={() => { setTwofaStep('disable'); setTwofaCode('') }} style={styles.twofaGhostBtn}
                                accessibilityRole="button"
                                hitSlop={6}>
                                <Text style={styles.twofaGhostText}>{t('Désactiver la 2FA')}</Text>
                            </TouchableOpacity>
                        )}

                        {twofaEnabled && twofaStep === 'disable' && (
                            <View style={{ gap: 10 }}>
                                <Text style={styles.twofaHint}>{t('Entrez un code pour confirmer la désactivation :')}</Text>
                                <TextInput value={twofaCode} onChangeText={v => setTwofaCode(v.replace(/\D/g, '').slice(0, 6))}
                                    keyboardType="number-pad" placeholder="123456" placeholderTextColor={C.textMuted}
                                    style={styles.twofaInput} maxLength={6} />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity onPress={disable2fa} disabled={twofaBusy} style={[styles.twofaDangerBtn, { flex: 1 }]}
                                        accessibilityRole="button"
                                        hitSlop={6}>
                                        {twofaBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.twofaPrimaryText}>{t('Désactiver')}</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setTwofaStep('idle'); setTwofaCode('') }} style={styles.twofaCancelBtn}
                                        accessibilityRole="button"
                                        hitSlop={6}>
                                        <Text style={styles.twofaGhostText}>{t('Annuler')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </AnimatedSection>

                {/* SESSION CARD */}
                <AnimatedSection delay={340}>
                    <View style={styles.sessionCard}>
                        <View style={styles.sessionIconBox}>
                            <LogOut size={20} color={C.danger} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sessionTitle}>{t('Déconnexion sécurisée')}</Text>
                            <Text style={styles.sessionText}>
                                {t('Si vous suspectez une activité non autorisée, déconnectez-vous immédiatement de votre compte.')}
                            </Text>
                        </View>
                    </View>
                </AnimatedSection>

                {/* TRUST FOOTER */}
                <AnimatedSection delay={460}>
                    <View style={styles.trustFooter}>
                        <Lock size={12} color={C.textMuted} strokeWidth={2} />
                        <Text style={styles.trustText}>
                            {t('Chiffrement de bout en bout · Conformité RGPD · ISO 27001')}
                        </Text>
                    </View>
                </AnimatedSection>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

/* ──────────────────────────────────────────────
   STYLES
   ────────────────────────────────────────────── */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12, gap: 12,
    },
    headerBtn: {
        width: 42, height: 42, borderRadius: 14,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerBtnGhost: { width: 42, height: 42 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '700', color: C.primary, letterSpacing: 0.3 },
    headerSub: { fontSize: 12, color: C.textMuted, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },

    scroll: { padding: 20, paddingBottom: 60, gap: 18 },

    /* INFO BANNER */
    infoBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: C.surface,
        borderRadius: 18,
        borderWidth: 1, borderColor: C.border,
        padding: 16,
        shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    },
    infoIconBox: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: C.accent + '15',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.accent + '30',
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 3, letterSpacing: 0.2 },
    infoText: { fontSize: 12, color: C.textSecond, lineHeight: 18 },

    /* MAIN CARD */
    card: {
        backgroundColor: C.surface,
        borderRadius: 22,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
        shadowColor: C.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08, shadowRadius: 20, elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: C.border,
        backgroundColor: C.surfaceAlt,
    },
    cardHeaderIcon: {
        width: 36, height: 36, borderRadius: 12,
        backgroundColor: C.primary + '10',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.primary + '20',
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: C.primary, letterSpacing: 0.2 },

    /* 2FA */
    twofaCard: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 18, gap: 12 },
    twofaHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    twofaIconBox: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(4,120,87,0.10)', alignItems: 'center', justifyContent: 'center' },
    twofaStatus: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    twofaDesc: { fontSize: 13, color: '#505050', lineHeight: 19 },
    twofaHint: { fontSize: 12.5, color: C.textMuted },
    twofaSecret: { fontSize: 13, color: '#3C3C3C', fontWeight: '700', backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, letterSpacing: 1 },
    twofaQrWrap: { alignSelf: 'center', backgroundColor: '#fff', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: C.border },
    twofaQr: { width: 168, height: 168 },
    twofaInput: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 12, textAlign: 'center', fontSize: 18, letterSpacing: 6, color: '#3C3C3C', backgroundColor: '#FFFFFF' },
    twofaPrimaryBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    twofaPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    twofaGhostBtn: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    twofaGhostText: { color: C.danger, fontWeight: '700', fontSize: 13.5 },
    twofaDangerBtn: { backgroundColor: C.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
    twofaCancelBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
    cardSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
    cardBody: { padding: 20 },

    /* STRENGTH */
    strengthWrap: {
        flexDirection: 'row', alignItems: 'center',
        gap: 12, marginTop: 4, marginBottom: 14,
    },
    strengthBars: { flexDirection: 'row', gap: 5, flex: 1 },
    strengthBar: { flex: 1, height: 5, borderRadius: 3 },
    strengthLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', minWidth: 56, textAlign: 'right' },

    /* RULES */
    rulesGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 6,
        marginBottom: 18,
    },
    ruleChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 10, paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: C.surfaceAlt,
        borderWidth: 1, borderColor: C.border,
    },
    ruleChipDone: {
        backgroundColor: C.success + '10',
        borderColor: C.success + '35',
    },
    ruleDot: {
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    ruleDotDone: { backgroundColor: C.success },
    ruleDotEmpty: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.textMuted },
    ruleText: { fontSize: 12, fontWeight: '600', color: C.textMuted, letterSpacing: 0.2 },
    ruleTextDone: { color: C.success },

    divider: { height: 1, backgroundColor: C.border, marginBottom: 18 },

    /* MATCH BANNER */
    matchBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 12, borderWidth: 1,
        marginTop: -4, marginBottom: 14,
    },
    matchText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },

    /* SAVE BTN */
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 10, paddingVertical: 16, borderRadius: 14,
        shadowColor: C.primary, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
    },
    saveBtnIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { ...typography.button, color: C.primaryText },

    /* SESSION CARD */
    sessionCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 14,
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1, borderColor: C.danger + '20',
        borderLeftWidth: 4, borderLeftColor: C.danger,
        shadowColor: C.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    },
    sessionIconBox: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: C.danger + '12',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.danger + '25',
    },
    sessionTitle: { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 4, letterSpacing: 0.2 },
    sessionText: { fontSize: 12, color: C.textSecond, lineHeight: 19 },

    /* TRUST FOOTER */
    trustFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14,
    },
    trustText: { fontSize: 12, color: C.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '600' },
})

/* HERO styles */
const hero = StyleSheet.create({
    wrap: {
        borderRadius: 26, overflow: 'hidden',
        shadowColor: C.primaryDeep, shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.28, shadowRadius: 22, elevation: 10,
    },
    gradient: {
        borderRadius: radius.xl,
        padding: spacing.lg,
        backgroundColor: C.surfaceSoft,
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden',
    },
    shine: { display: 'none' },
    watermark: {
        position: 'absolute', right: -40, bottom: -40, opacity: 0.6,
    },
    topRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(252,209,22,0.15)',
        borderWidth: 1, borderColor: 'rgba(252,209,22,0.35)',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    },
    chipText: { fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: 1.2 },
    levelChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
    },
    levelDot: { width: 6, height: 6, borderRadius: 3 },
    levelText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },

    shieldWrap: {
        alignItems: 'center', justifyContent: 'center',
        marginTop: 22, marginBottom: 14, height: 92,
    },
    shieldRing: {
        position: 'absolute',
        width: 92, height: 92, borderRadius: 46,
        borderWidth: 2, borderColor: C.accent + '60',
    },
    shieldInner: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: 'rgba(252,209,22,0.10)',
        borderWidth: 1.5, borderColor: 'rgba(252,209,22,0.4)',
        alignItems: 'center', justifyContent: 'center',
    },

    title: {
        fontSize: 22, fontWeight: '700', color: C.textPrimary,
        textAlign: 'center', letterSpacing: 0.4,
    },
    subtitle: {
        fontSize: 12, color: C.textMuted,
        textAlign: 'center', marginTop: 6, lineHeight: 18,
        paddingHorizontal: 12,
    },

    statsRow: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: 22, paddingTop: 18,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)',
    },
    statCol: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.10)' },
    statLabel: { fontSize: 12, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600' },
    statValue: { fontSize: 12, color: C.textPrimary, fontWeight: '700', letterSpacing: 0.3 },
})

/* FIELD styles */
const field2 = StyleSheet.create({
    group: { marginBottom: 14 },
    label: {
        fontSize: 12, fontWeight: '700', color: C.primary,
        marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase',
    },
    wrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.surfaceAlt,
        borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
        paddingLeft: 8, paddingRight: 12, minHeight: 54,
    },
    wrapperFocus: {
        borderColor: C.accent,
        backgroundColor: '#FFF',
        shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15, shadowRadius: 10, elevation: 3,
    },
    iconBox: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        marginRight: 10,
    },
    iconBoxFocus: {
        backgroundColor: C.accent + '12',
        borderColor: C.accent + '40',
    },
    input: {
        flex: 1, fontSize: 15, color: C.textPrimary,
        fontWeight: '500', letterSpacing: 0.2,
    },
    eyeBtn: { padding: 6 },
})
