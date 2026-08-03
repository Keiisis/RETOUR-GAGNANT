import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
    Platform, Pressable, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSequence,
} from 'react-native-reanimated'
import type { EmailOtpType } from '@supabase/supabase-js'
import { LucideIcon } from '../../components/Icon'
import { FlagBar } from '../../components/ui'
import { supabase } from '../../config/supabase'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { screenColors as C, typography, spacing, radius, shadows } from '../../config/theme'

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

   Le client reçoit un code par e-mail après son inscription et le saisit
   ici, plutôt que de cliquer un lien qui ouvre le navigateur. À la
   validation, `verifyOtp` confirme le compte ET ouvre la session : l'app
   bascule seule vers l'accueil (voir AuthContext.onAuthStateChange).

   Direction artistique de l'écran d'accueil : blanc, liseré tricolore,
   sur-titre discret, grand titre, cellules de code en surface blanche
   posée, accent vert. Aucune autre couleur.
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
        setLoading(true)
        try {
            /* verifyOtp confirme le compte ET ouvre la session. À la réussite,
               AuthContext capte la session et l'app bascule seule vers
               l'accueil — rien à naviguer ici. On essaie chaque type de jeton
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
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.iconBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('Retour')}
                    hitSlop={8}
                >
                    <LucideIcon name="arrow-back" size={20} color={C.primary} />
                </Pressable>
            </View>

            <View style={styles.body}>
                <View style={styles.iconTile}>
                    <LucideIcon name="mail-outline" size={26} color={C.primary} strokeWidth={2} />
                </View>

                <Text style={styles.overline}>{t('VÉRIFICATION')}</Text>
                <Text style={styles.title}>{t('Confirmez votre compte')}</Text>
                <Text style={styles.subtitle}>
                    {t('Saisissez le code envoyé à')}
                </Text>
                <Text style={styles.email} numberOfLines={1}>{email}</Text>

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

                {loading && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={C.primary} />
                        <Text style={styles.loadingText}>{t('Vérification…')}</Text>
                    </View>
                )}

                <View style={styles.resendRow}>
                    <Text style={styles.resendHint}>{t('Vous n\'avez rien reçu ?')}</Text>
                    <Pressable
                        onPress={renvoyer}
                        disabled={renvoiEnCours || attente > 0}
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Text style={[styles.resendLink, (renvoiEnCours || attente > 0) && styles.resendLinkOff]}>
                            {attente > 0
                                ? `${t('Renvoyer dans')} ${attente}s`
                                : renvoiEnCours ? t('Envoi…') : t('Renvoyer le code')}
                        </Text>
                    </Pressable>
                </View>

                <Text style={styles.spamHint}>
                    {t('Pensez à vérifier vos courriers indésirables.')}
                </Text>
            </View>
        </KeyboardAvoidingView>
    )
}

const CELL = 40

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md },
    iconBtn: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },

    body: { flex: 1, paddingHorizontal: spacing.gutter, alignItems: 'center', paddingTop: spacing.md },

    iconTile: {
        width: 64, height: 64, borderRadius: radius.lg,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    overline: { ...typography.overline, color: C.primary },
    title: { ...typography.h1, color: C.text, textAlign: 'center', marginTop: spacing.xs },
    subtitle: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginTop: spacing.sm },
    email: { ...typography.label, color: C.text, textAlign: 'center', marginTop: spacing.xxs },

    codeRow: { marginTop: spacing.xl, width: '100%', alignItems: 'center' },
    codeRowInner: { flexDirection: 'row', gap: spacing.sm },
    cell: {
        width: CELL, height: CELL + 8, borderRadius: radius.md,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    cellRempli: { borderColor: C.primary, backgroundColor: C.surfaceSoft },
    cellActif: { borderColor: C.primary, ...shadows.card },
    cellErreur: { borderColor: C.danger, backgroundColor: C.dangerSoft },
    cellText: { ...typography.h3, color: C.text },

    hiddenInput: {
        position: 'absolute', opacity: 0, height: 1, width: 1,
    },

    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
    loadingText: { ...typography.bodySmall, color: C.primary },

    resendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxl },
    resendHint: { ...typography.bodySmall, color: C.textMuted },
    resendLink: { ...typography.label, color: C.primary },
    resendLinkOff: { color: C.textMuted },

    spamHint: { ...typography.caption, color: C.textFaint, textAlign: 'center', marginTop: spacing.md },
})
