/* ═══════════════════════════════════════════════════════════
   Signer un devis depuis l'application.

   Trois cas, tranchés par ce que le client a DÉJÀ décidé dans « Ma signature » :
     · auto_sign = 'auto'  → on signe sans rien demander, il a tranché une fois
                             pour toutes. L'écran ne fait que confirmer.
     · auto_sign = 'ask'   → sa signature enregistrée lui est proposée ; il peut
                             la réutiliser ou en tracer une autre.
     · auto_sign = 'never' → tracé exigé à chaque fois. Jamais d'automatisme.
     · aucune signature    → tracé, avec la possibilité de la mémoriser.

   Le tracé s'appuie sur react-native-signature-canvas, déjà utilisé par l'écran
   « Ma signature » : une seule technique de capture dans l'application.

   La décision reste SERVEUR : /api/mobile/proposals/[id]/sign revérifie
   l'appartenance de la proposition et refuse une seconde signature.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SignatureCanvas, { SignatureViewRef } from 'react-native-signature-canvas'
import {
    ChevronLeft, PenLine, CircleCheck, Eraser, ShieldCheck, CreditCard, Check,
} from 'lucide-react-native'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type AutoSign = 'ask' | 'auto' | 'never'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SignatureDevisScreen({ navigation, route }: { navigation: any; route: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()

    const proposalId: string = route?.params?.proposalId
    const secretKey: string | undefined = route?.params?.secretKey

    const [chargement, setChargement] = useState(true)
    const [envoi, setEnvoi] = useState(false)
    const [signee, setSignee] = useState(false)
    const [automatique, setAutomatique] = useState(false)

    const [signatureEnregistree, setSignatureEnregistree] = useState<string | null>(null)
    const [autoSign, setAutoSign] = useState<AutoSign>('ask')
    const [modeTrace, setModeTrace] = useState(false)
    const [memoriser, setMemoriser] = useState(true)

    const canvasRef = useRef<SignatureViewRef>(null)

    /* Envoi au serveur. `trace` vide = on demande l'application de la signature
       déjà enregistrée (le serveur n'accepte cela que si auto_sign = 'auto'). */
    const signer = useCallback(async (trace?: string) => {
        setEnvoi(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    signature_data: trace || undefined,
                    memoriser: trace ? memoriser : undefined,
                    auto_sign: trace && memoriser ? autoSign : undefined,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || 'Signature impossible.')
            setAutomatique(!!json.automatique)
            setSignee(true)
        } catch (e) {
            toast(t('Signature impossible'), e instanceof Error ? e.message : t('Réessayez dans un instant.'))
        } finally {
            setEnvoi(false)
        }
    }, [proposalId, memoriser, autoSign, t])

    /* Au montage : on lit ce que le client a déjà décidé. Si c'est « auto »,
       on signe immédiatement — lui redemander serait contredire son réglage. */
    useEffect(() => {
        let vivant = true
        ;(async () => {
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/mobile/signature`, {
                    headers: { ...(await authHeaders()) },
                    timeoutMs: 15000,
                })
                const json = await res.json().catch(() => ({}))
                const sig = json?.signature
                if (!vivant) return

                const data = sig?.signature_data || null
                const mode: AutoSign = (sig?.auto_sign as AutoSign) || 'ask'
                setSignatureEnregistree(data)
                setAutoSign(mode)

                if (data && mode === 'auto') {
                    setChargement(false)
                    await signer()      // aucun geste demandé : c'est le sens du réglage
                    return
                }
                // Sans signature mémorisée, on ouvre directement le tracé.
                if (!data) setModeTrace(true)
            } catch {
                if (vivant) setModeTrace(true)
            } finally {
                if (vivant) setChargement(false)
            }
        })()
        return () => { vivant = false }
    }, [signer])

    /* ── Confirmation ── */
    if (signee) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.finWrap}>
                    <View style={styles.finIcon}><CircleCheck size={38} color={C.primary} strokeWidth={2} /></View>
                    <Text style={styles.finTitre}>{t('Devis signé')}</Text>
                    <Text style={styles.finTexte}>
                        {automatique
                            ? t('Votre signature enregistrée a été appliquée automatiquement, comme vous l’aviez demandé.')
                            : t('Votre signature a bien été apposée sur le devis. Une copie reste consultable dans vos propositions.')}
                    </Text>

                    <Pressable
                        onPress={() => navigation.replace('DevisPaiement', { secretKey })}
                        style={styles.finBtn} accessibilityRole="button"
                    >
                        <CreditCard size={17} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.finBtnText}>{t('Procéder au règlement')}</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.goBack()} style={styles.finLien} accessibilityRole="button">
                        <Text style={styles.finLienText}>{t('Plus tard')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Signer le devis')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {chargement ? (
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.badge}>
                        <PenLine size={13} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.badgeText}>{t('Signature électronique')}</Text>
                    </View>
                    <Text style={styles.h1}>
                        {modeTrace ? t('Tracez votre signature') : t('Signer avec votre signature')}
                    </Text>
                    <Text style={styles.intro}>
                        {modeTrace
                            ? t('Signez dans le cadre, comme sur papier. Vous pourrez la conserver pour vos prochains devis.')
                            : t('Vous avez déjà enregistré une signature. Utilisez-la, ou tracez-en une nouvelle pour ce devis.')}
                    </Text>

                    {/* Signature déjà enregistrée */}
                    {!modeTrace && !!signatureEnregistree && (
                        <>
                            <View style={styles.apercuWrap}>
                                <Text style={styles.apercuLabel}>{t('VOTRE SIGNATURE')}</Text>
                                <Image
                                    source={{ uri: signatureEnregistree }}
                                    style={styles.apercu}
                                    resizeMode="contain"
                                />
                                <View style={styles.ligneBase} />
                            </View>

                            <Pressable
                                onPress={() => signer(signatureEnregistree)}
                                disabled={envoi}
                                style={({ pressed }) => [styles.btnPrincipal, pressed && { transform: [{ scale: 0.98 }] }, envoi && { opacity: 0.6 }]}
                                accessibilityRole="button"
                            >
                                {envoi ? <ActivityIndicator color="#FFFFFF" /> : (
                                    <>
                                        <Check size={17} color="#FFFFFF" strokeWidth={2.6} />
                                        <Text style={styles.btnPrincipalText}>{t('Signer avec cette signature')}</Text>
                                    </>
                                )}
                            </Pressable>

                            <Pressable onPress={() => setModeTrace(true)} style={styles.btnSecondaire} accessibilityRole="button">
                                <PenLine size={15} color={C.primary} strokeWidth={2} />
                                <Text style={styles.btnSecondaireText}>{t('Tracer une nouvelle signature')}</Text>
                            </Pressable>
                        </>
                    )}

                    {/* Tracé */}
                    {modeTrace && (
                        <>
                            <View style={styles.canvasWrap}>
                                <Text style={styles.apercuLabel}>{t('ZONE DE SIGNATURE')}</Text>
                                <View style={styles.canvas}>
                                    <SignatureCanvas
                                        ref={canvasRef}
                                        onOK={(sig: string) => signer(sig)}
                                        onEmpty={() => toast(t('Signature vide'), t('Tracez votre signature avant de valider.'))}
                                        descriptionText=""
                                        clearText=""
                                        confirmText=""
                                        webStyle={`
                                            .m-signature-pad { box-shadow: none; border: none; margin: 0; }
                                            .m-signature-pad--body { border: none; }
                                            .m-signature-pad--footer { display: none; }
                                            body, html { background: #FFFFFF; margin: 0; padding: 0; }
                                        `}
                                        backgroundColor="#FFFFFF"
                                        penColor="#17201C"
                                        imageType="image/png"
                                    />
                                </View>
                                <View style={styles.ligneBase} />
                            </View>

                            <Pressable
                                onPress={() => setMemoriser(m => !m)}
                                style={styles.caseLigne} accessibilityRole="button" hitSlop={6}
                            >
                                <View style={[styles.case, memoriser && styles.caseOn]}>
                                    {memoriser && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                                </View>
                                <Text style={styles.caseText}>
                                    {t('Mémoriser ma signature pour mes prochains devis')}
                                </Text>
                            </Pressable>

                            <View style={styles.actions}>
                                <Pressable
                                    onPress={() => canvasRef.current?.clearSignature()}
                                    style={styles.btnEffacer} accessibilityRole="button"
                                >
                                    <Eraser size={16} color={C.textSec} strokeWidth={2} />
                                    <Text style={styles.btnEffacerText}>{t('Effacer')}</Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => canvasRef.current?.readSignature()}
                                    disabled={envoi}
                                    style={({ pressed }) => [styles.btnValider, pressed && { transform: [{ scale: 0.98 }] }, envoi && { opacity: 0.6 }]}
                                    accessibilityRole="button"
                                >
                                    {envoi ? <ActivityIndicator color="#FFFFFF" /> : (
                                        <Text style={styles.btnPrincipalText}>{t('Valider ma signature')}</Text>
                                    )}
                                </Pressable>
                            </View>
                        </>
                    )}

                    {/* Portée juridique : dite simplement, sans jargon */}
                    <View style={styles.mention}>
                        <ShieldCheck size={15} color={C.primary} strokeWidth={2} />
                        <Text style={styles.mentionText}>
                            {t('Votre signature vaut acceptation du devis et de son montant. Elle est horodatée et conservée avec la proposition.')}
                        </Text>
                    </View>
                </ScrollView>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { ...typography.button, fontSize: 11.5, color: C.primary },
    h1: { fontFamily: fonts.extrabold, fontSize: 25, lineHeight: 31, color: C.text, marginBottom: spacing.sm },
    intro: { ...typography.body, color: C.textSec, lineHeight: 21, marginBottom: spacing.xl },

    apercuWrap: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xl, padding: spacing.lg, ...shadows.card },
    apercuLabel: { fontFamily: fonts.bold, fontSize: 9.5, color: C.textMuted, letterSpacing: 1.6, marginBottom: spacing.sm },
    apercu: { width: '100%', height: 120 },
    ligneBase: { height: 1, backgroundColor: C.border, marginTop: 6 },

    canvasWrap: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xl, padding: spacing.md, ...shadows.card },
    canvas: { height: 230, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#FFFFFF' },

    caseLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
    case: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    caseOn: { backgroundColor: C.primary, borderColor: C.primary },
    caseText: { flex: 1, ...typography.bodySmall, fontSize: 13, color: C.text, lineHeight: 18 },

    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    btnEffacer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 15 },
    btnEffacerText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.textSec },
    btnValider: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },

    btnPrincipal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, marginTop: spacing.lg },
    btnPrincipalText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' },
    btnSecondaire: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14 },
    btnSecondaireText: { fontFamily: fonts.bodyBold, fontSize: 13, color: C.primary },

    mention: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: spacing.xl, backgroundColor: C.surfaceAlt, borderRadius: radius.lg, padding: spacing.md },
    mentionText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: C.textSec },

    finWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
    finIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    finTitre: { fontFamily: fonts.extrabold, fontSize: 24, color: C.text, textAlign: 'center' },
    finTexte: { ...typography.body, color: C.textSec, textAlign: 'center', lineHeight: 22 },
    finBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 15 },
    finBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
    finLien: { paddingVertical: 10 },
    finLienText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.textMuted },
})
