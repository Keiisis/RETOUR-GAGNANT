/* ═══════════════════════════════════════════════════════════
   TOAST + FEUILLE DE CONFIRMATION — charte v2

   Monté une seule fois, au-dessus du navigateur. Rend deux surfaces :
   — le toast, en haut, sous la barre d'état : passager, non bloquant,
     lisible d'un coup d'œil, il ne vole jamais le focus ;
   — la feuille de confirmation, en bas, à portée du pouce : elle bloque,
     mais seulement pour les actions conséquentes.

   Accessibilité : le toast est annoncé par le lecteur d'écran sans
   déplacer le focus ; la feuille capte le focus et se ferme au geste
   retour d'Android.
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    View, Text, Pressable, StyleSheet, Modal,
    AccessibilityInfo, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS,
} from 'react-native-reanimated'
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react-native'
import { colors, typography, spacing, radius, shadows } from '../config/theme'
import { FlagBar } from './ui'
import {
    registerFeedback, type ToastOptions, type ConfirmOptions,
    type ChooseOptions, type ToastTone,
} from '../lib/feedback'

const TONES: Record<ToastTone, { icon: typeof Info; fg: string; bg: string }> = {
    success: { icon: CheckCircle2, fg: colors.primary, bg: colors.primarySoft },
    danger: { icon: XCircle, fg: colors.danger, bg: colors.dangerSoft },
    warning: { icon: AlertTriangle, fg: colors.accentInk, bg: colors.accentSoft },
    neutral: { icon: Info, fg: colors.textMuted, bg: colors.surfaceMuted },
}

const VISIBLE_MS = 4000

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets()
    const [toastData, setToastData] = useState<ToastOptions | null>(null)
    const [confirmData, setConfirmData] = useState<ConfirmOptions | null>(null)
    const [chooseData, setChooseData] = useState<ChooseOptions | null>(null)
    const [busy, setBusy] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const y = useSharedValue(-160)
    const opacity = useSharedValue(0)

    const clearToast = useCallback(() => setToastData(null), [])

    const hideToast = useCallback(() => {
        if (timer.current) { clearTimeout(timer.current); timer.current = null }
        opacity.value = withTiming(0, { duration: 180 })
        y.value = withTiming(-160, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
            if (done) runOnJS(clearToast)()
        })
    }, [clearToast, opacity, y])

    const showToast = useCallback((o: ToastOptions) => {
        if (timer.current) clearTimeout(timer.current)
        setToastData(o)
        opacity.value = withTiming(1, { duration: 160 })
        y.value = withSpring(0, { damping: 18, stiffness: 160 })
        // Annonce sans déplacer le focus : l'utilisateur n'est pas interrompu.
        AccessibilityInfo.announceForAccessibility?.(
            o.message ? `${o.title}. ${o.message}` : o.title,
        )
        timer.current = setTimeout(hideToast, VISIBLE_MS)
    }, [hideToast, opacity, y])

    useEffect(() => {
        registerFeedback({ toast: showToast, confirm: setConfirmData, choose: setChooseData })
        return () => {
            registerFeedback(null)
            if (timer.current) clearTimeout(timer.current)
        }
    }, [showToast])

    const toastStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: y.value }],
    }))

    const closeConfirm = useCallback(() => { setConfirmData(null); setBusy(false) }, [])

    const runConfirm = useCallback(async () => {
        if (!confirmData || busy) return
        setBusy(true)
        try { await confirmData.onConfirm() } finally { closeConfirm() }
    }, [confirmData, busy, closeConfirm])

    const tone = TONES[toastData?.tone || 'neutral']
    const ToneIcon = tone.icon

    return (
        <>
            {children}

            {/* ── Toast ── */}
            {toastData && (
                <Animated.View
                    pointerEvents="box-none"
                    style={[styles.toastWrap, { top: insets.top + spacing.sm }, toastStyle]}
                >
                    <Pressable
                        onPress={hideToast}
                        accessibilityRole="button"
                        accessibilityLabel="Masquer la notification"
                        style={[styles.toast, shadows.cardRaised]}
                    >
                        <View style={[styles.toastIcon, { backgroundColor: tone.bg }]}>
                            <ToneIcon size={19} color={tone.fg} strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toastTitle} numberOfLines={2}>{toastData.title}</Text>
                            {toastData.message ? (
                                <Text style={styles.toastMessage} numberOfLines={4}>
                                    {toastData.message}
                                </Text>
                            ) : null}
                        </View>
                    </Pressable>
                </Animated.View>
            )}

            {/* ── Sélecteur d'actions ── */}
            <Modal
                visible={!!chooseData}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setChooseData(null)}
            >
                <View style={styles.sheetWrap}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        accessibilityRole="button"
                        accessibilityLabel="Fermer"
                        onPress={() => setChooseData(null)}
                    />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <FlagBar height={5} radiusTop={false} />
                        <View style={styles.sheetBody}>
                            <Text style={styles.sheetTitle}>{chooseData?.title}</Text>
                            {chooseData?.message ? (
                                <Text style={styles.sheetMessage}>{chooseData.message}</Text>
                            ) : null}

                            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                                {chooseData?.options.map((opt, i) => (
                                    <Pressable
                                        key={i}
                                        accessibilityRole="button"
                                        accessibilityLabel={opt.label}
                                        onPress={() => { setChooseData(null); void opt.onPress() }}
                                        style={({ pressed }) => [
                                            styles.choice,
                                            pressed && { backgroundColor: colors.surfaceMuted },
                                        ]}
                                    >
                                        <Text style={[
                                            styles.choiceText,
                                            opt.destructive && { color: colors.danger },
                                        ]}>
                                            {opt.label}
                                        </Text>
                                    </Pressable>
                                ))}
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setChooseData(null)}
                                    style={[styles.btn, styles.btnGhost, { marginTop: spacing.sm }]}
                                >
                                    <Text style={styles.btnGhostText}>
                                        {chooseData?.cancelLabel || 'Annuler'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Feuille de confirmation ── */}
            <Modal
                visible={!!confirmData}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => { confirmData?.onCancel?.(); closeConfirm() }}
            >
                <View style={styles.sheetWrap}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        accessibilityRole="button"
                        accessibilityLabel="Fermer"
                        onPress={() => { confirmData?.onCancel?.(); closeConfirm() }}
                    />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
                        <FlagBar height={5} radiusTop={false} />
                        <View style={styles.sheetBody}>
                            <Text style={styles.sheetTitle}>{confirmData?.title}</Text>
                            {confirmData?.message ? (
                                <Text style={styles.sheetMessage}>{confirmData.message}</Text>
                            ) : null}

                            <View style={styles.sheetActions}>
                                <Pressable
                                    onPress={() => { confirmData?.onCancel?.(); closeConfirm() }}
                                    disabled={busy}
                                    accessibilityRole="button"
                                    style={[styles.btn, styles.btnGhost]}
                                >
                                    <Text style={styles.btnGhostText}>
                                        {confirmData?.cancelLabel || 'Annuler'}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={runConfirm}
                                    disabled={busy}
                                    accessibilityRole="button"
                                    accessibilityState={{ busy }}
                                    style={[
                                        styles.btn,
                                        confirmData?.destructive ? styles.btnDanger : styles.btnPrimary,
                                        busy && { opacity: 0.6 },
                                    ]}
                                >
                                    <Text style={styles.btnPrimaryText}>
                                        {confirmData?.confirmLabel || 'Confirmer'}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    /* ── Toast ── */
    toastWrap: {
        position: 'absolute', left: spacing.gutter, right: spacing.gutter,
        zIndex: 9999, elevation: 9999,
    },
    toast: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        backgroundColor: colors.surface, borderRadius: radius.xl,
        padding: spacing.md,
        borderWidth: 1, borderColor: colors.border,
    },
    toastIcon: {
        width: 38, height: 38, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
    },
    toastTitle: { ...typography.label, fontSize: 15, color: colors.text },
    toastMessage: { ...typography.bodySmall, color: colors.textMuted, marginTop: 2 },

    /* ── Feuille ── */
    sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
        overflow: 'hidden',
    },
    sheetBody: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    sheetTitle: { ...typography.h2, color: colors.text },
    sheetMessage: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
    sheetActions: {
        flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg,
    },
    btn: {
        flex: 1, height: 52, borderRadius: radius.pill,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'transparent',
    },
    btnGhost: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
    btnGhostText: { ...typography.button, color: colors.text },
    btnPrimary: { backgroundColor: colors.primary },
    btnDanger: { backgroundColor: colors.danger },
    btnPrimaryText: { ...typography.button, color: colors.textOnPrimary },
    choice: {
        height: 54, borderRadius: radius.lg,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    choiceText: { ...typography.button, color: colors.text },
})
