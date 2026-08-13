import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, Pressable, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSequence, FadeInDown,
} from 'react-native-reanimated'
import type { EmailOtpType } from '@supabase/supabase-js'
import { FlagBar } from '../../components/ui'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { screenColors as C, spacing, radius } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* Longueur du code envoyé par Supabase. La configuration de ce projet émet
   8 chiffres (vérifié en conditions réelles). Une seule constante : si la
   configuration Supabase change un jour, il suffit d'ajuster ici. */
const CODE_LEN = 8

/* Le code d'inscription vient d'un lien `signup`, celui de renvoi d'un lien
   `magiclink` : deux natures de jeton pour le même écran. On tente chaque
   type dans l'ordre ; le premier qui ouvre une session confirme le compte.
   Un type qui ne correspond pas renvoie une erreur SANS consommer le jeton,
   donc l'essai suivant reste valide. */
const OTP_TYPES: EmailOtpType[] = ['signup', 'magiclink', 'email']

/* ═══════════════════════════════════════════════════════════
   CONFIRMATION DU COMPTE PAR CODE

   Rendu fidèle à la maquette Sleek exportée (« Vérification » centré,
   grille de cellules, renvoi avec compte à rebours, bouton « Vérifier »).
   LOGIQUE préservée : verifyOtp confirme le compte ET ouvre la session ;
   l'app bascule seule vers l'accueil (AuthContext.onAuthStateChange). Le
   code réel fait CODE_LEN chiffres (8), pas 6 comme dans la maquette
   statique — la réalité fonctionnelle prime.
═══════════════════════════════════════════════════════════ */
export default function ConfirmEmailScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const email: string = route?.params?.email || ''

    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [erreur, setErreur] = useState(false)
    const [renvoiEnCours, setRenvoiEnCours] = useState(false)
    const input = useRef<TextInput>(null)

    /* Compte à rebours avant de pouvoir renvoyer un code, pour ne pas
       marteler l'envoi d'e-mails. */
    const [attente, setAttente] = useState(0)
    useEffect(() => {
        if (attente <= 0) return
        const id = setInterval(() => setAttente(s => s - 1), 1000)
        return () => clearInterval(id)
    }, [attente])

    /* Le champ réel est invisible : il pilote les cellules affichées. On
       ouvre le clavier dès l'arrivée. */
    useEffect(() => {
        const id = setTimeout(() => input.current?.focus(), 350)
        return () => clearTimeout(id)
    }, [])

    const secousse = useSharedValue(0)
    const styleSecousse = useAnimatedStyle(() => ({
        transform: [{ translateX: secousse.value }],
    }))

    const onChange = (v: string) => {
        const propre = v.replace(/[^0-9]/g, '').slice(0, CODE_LEN)
        setCode(propre)
        setErreur(false)
        if (propre.length === CODE_LEN) verifier(propre)
    }

    const verifier = async (valeur: string) => {
        if (loading) return
        if (valeur.length < CODE_LEN) {
            toast(t('Code incomplet'), t('Saisissez les {n} chiffres du code.').replace('{n}', String(CODE_LEN)))
            return
        }
        setLoading(true)
        try {
            /* verifyOtp confirme le compte ET ouvre la session. À la réussite,
               AuthContext capte la session et l'app bascule seule vers
               l'accueil : rien à naviguer ici. On essaie chaque type de jeton
               (voir OTP_TYPES) car inscription et renvoi n'émettent pas le
               même. */
            for (const type of OTP_TYPES) {
                const { data, error } = await supabase.auth.verifyOtp({
                    email, token: valeur, type,
                })
                if (!error && data?.session) return // succès : bascule automatique
            }
            echouer()
        } catch {
            echouer()
        } finally {
            setLoading(false)
        }
    }

    const echouer = () => {
        setErreur(true)
        setCode('')
        // Secousse horizontale des cellules pour signaler l'erreur.
        secousse.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withTiming(10, { duration: 50 }),
            withTiming(-6, { duration: 50 }),
            withTiming(0, { duration: 50 }),
        )
        toast(t('Code incorrect'), t('Vérifiez le code reçu par e-mail et réessayez.'))
        setTimeout(() => input.current?.focus(), 100)
    }

    const renvoyer = async () => {
        if (renvoiEnCours || attente > 0 || !email) return
        setRenvoiEnCours(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/client/resend-confirmation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 15000,
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            })
            const json = await res.json().catch(() => ({}))
            if (res.ok) {
                toast(t('Code renvoyé'), t('Un nouveau code vient de partir vers votre adresse.'), 'success')
                setAttente(45)
            } else {
                toast(t('Envoi impossible'), json.error || t('Réessayez dans un instant.'))
            }
        } catch {
            toast(t('Erreur réseau'), t('Vérifiez votre connexion et réessayez.'))
        } finally {
            setRenvoiEnCours(false)
        }
    }

    const cellules = useMemo(() => Array.from({ length: CODE_LEN }), [])

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('Retour')}
                    hitSlop={8}
                >
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
            </View>

            <View style={styles.body}>
                <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
                    <Text style={styles.title}>{t('Vérification')}</Text>
                    <Text style={styles.subtitle}>
                        {t('Nous avons envoyé un code à {n} chiffres à votre adresse email.').replace('{n}', String(CODE_LEN))}
                    </Text>
                    {!!email && <Text style={styles.email} numberOfLines={1}>{email}</Text>}
                </Animated.View>

                {/* Cellules du code. Un seul champ invisible les pilote. */}
                <Pressable onPress={() => input.current?.focus()} style={styles.codeRow}>
                    <Animated.View style={[styles.codeRowInner, styleSecousse]}>
                        {cellules.map((_, i) => {
                            const rempli = i < code.length
                            const actif = i === code.length
                            return (
                                <View
                                    key={i}
                                    style={[
                                        styles.cell,
                                        rempli && styles.cellRempli,
                                        actif && styles.cellActif,
                                        erreur && styles.cellErreur,
                                    ]}
                                >
                                    <Text style={styles.cellText}>{code[i] || ''}</Text>
                                </View>
                            )
                        })}
                    </Animated.View>
                </Pressable>

                <TextInput
                    ref={input}
                    value={code}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                    maxLength={CODE_LEN}
                    style={styles.hiddenInput}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    caretHidden
                    editable={!loading}
                />

                {/* Renvoi avec compte à rebours */}
                <Pressable
                    onPress={renvoyer}
                    disabled={renvoiEnCours || attente > 0}
                    accessibilityRole="button"
                    hitSlop={8}
                    style={styles.resendBtn}
                >
                    <Text style={[styles.resendLink, (renvoiEnCours || attente > 0) && styles.resendLinkOff]}>
                        {attente > 0
                            ? `${t('Renvoyer le code')} (${attente}s)`
                            : renvoiEnCours ? t('Envoi…') : t('Renvoyer le code')}
                    </Text>
                </Pressable>

                {/* Bouton Vérifier (l'auto-soumission au 8e chiffre reste active) */}
                <Pressable
                    onPress={() => verifier(code)}
                    disabled={loading || code.length < CODE_LEN}
                    style={({ pressed }) => [
                        styles.submitBtn,
                        pressed && { transform: [{ scale: 0.98 }] },
                        (loading || code.length < CODE_LEN) && { opacity: 0.5 },
                    ]}
                    accessibilityRole="button"
                >
                    {loading ? <ActivityIndicator color={C.primaryText} /> : <Text style={styles.submitText}>{t('Vérifier')}</Text>}
                </Pressable>

                <Text style={styles.spamHint}>
                    {t('Pensez à vérifier vos courriers indésirables.')}
                </Text>
            </View>
        </KeyboardAvoidingView>
    )
}

const CELL = 42

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    backBtn: {
        width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },

    body: { flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', paddingTop: spacing.xl },
    header: { alignItems: 'center', marginBottom: spacing.xxl },
    title: { fontSize: 30, lineHeight: 36, fontFamily: 'Inter_800ExtraBold', color: C.text, letterSpacing: -0.5, textAlign: 'center' },
    subtitle: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', color: C.textSec, textAlign: 'center', marginTop: 10, paddingHorizontal: spacing.md },
    email: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, textAlign: 'center', marginTop: 6 },

    codeRow: { width: '100%', alignItems: 'center' },
    codeRowInner: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
    cell: {
        width: CELL, height: CELL + 12, borderRadius: radius.md,
        backgroundColor: C.surfaceAlt,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    cellRempli: { borderColor: C.primary, backgroundColor: C.surface },
    cellActif: { borderColor: C.primary },
    cellErreur: { borderColor: C.danger, backgroundColor: C.dangerSoft },
    cellText: { fontSize: 20, fontFamily: 'Inter_800ExtraBold', color: C.text },

    hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },

    resendBtn: { marginTop: spacing.xxl, paddingVertical: 8 },
    resendLink: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.primary, textAlign: 'center' },
    resendLinkOff: { color: C.textMuted },

    submitBtn: {
        width: '100%', marginTop: spacing.xl,
        backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#008751', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
    },
    submitText: { color: C.primaryText, fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.2 },

    spamHint: { fontSize: 12, fontFamily: 'Inter_500Medium', color: C.textMuted, textAlign: 'center', marginTop: spacing.lg },
})
