import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from '../lib/feedback'
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    ActivityIndicator, Platform
} from 'react-native'
import { Briefcase, CreditCard, Info, Lock, ShieldCheck, Smartphone, X } from 'lucide-react-native'
import { useKkiapay } from '@kkiapay-org/react-native-sdk'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { usePaymentSettings } from '../contexts/PaymentSettingsContext'
import { colors, spacing, shadows, typography, radius } from '../config/theme'

/* ═══════════════════════════════════════════════════════════
   KkiapayModal : Paiement natif via SDK Kkiapay React Native
   Fonctionne sur Android & iOS (necessite dev build, pas Expo Go)
   Widget integre in-app : plus besoin d'ouvrir le navigateur.
   La cle publique et le mode sandbox/prod sont lus depuis la
   table Supabase `settings` (kkiapay_public_key / kkiapay_sandbox).
═══════════════════════════════════════════════════════════ */

interface KkiapayModalProps {
    visible: boolean
    amount: string
    serviceName: string
    onClose: () => void
    /* Appelé quand le client referme SANS avoir payé. Sans ce retour, l'écran
       appelant restait figé et une éventuelle commande gardait le statut
       « en attente » — le client repartait sans savoir où il en était. */
    onCancel?: () => void
    onSuccess: (transactionId: string) => void
}

export default function KkiapayModal({ visible, amount, serviceName, onClose, onSuccess, onCancel }: KkiapayModalProps) {
    const [loading, setLoading] = useState(false)
    const { profile } = useAuth()
    const { t } = useLang()
    // Settings preloaded at app start : no Supabase round-trip when modal opens
    const { kkiapayPublicKey: kkiapayKey, kkiapaySandbox: sandbox } = usePaymentSettings()
    const {
        openKkiapayWidget, addSuccessListener, addFailedListener,
        addKkiapayCloseListener, addPaymentAbortedListener,
    } = useKkiapay()

    // Refs sur les callbacks pour eviter le ré-enregistrement des listeners
    // a chaque render. Le SDK ne fournit pas de removeListener officiel, donc
    // on enregistre UNE SEULE FOIS au mount + on lit toujours la version a
    // jour des callbacks via la ref (pas de stale closure non plus).
    const onSuccessRef = useRef(onSuccess)
    const onCloseRef = useRef(onClose)
    const onCancelRef = useRef(onCancel)
    // Un paiement a-t-il abouti pendant cette ouverture ? Sert à distinguer
    // « fermeture après succès » de « fermeture par abandon ».
    const abouti = useRef(false)
    const ouvert = useRef(false)
    useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
    useEffect(() => { onCloseRef.current = onClose }, [onClose])
    useEffect(() => { onCancelRef.current = onCancel }, [onCancel])

    /* On masque D'ABORD, on agit ENSUITE.
       Naviguer pendant que le SDK démonte sa WebView et que notre Modal se
       ferme faisait redémarrer l'application (crash natif Android). Le délai
       laisse l'animation de fermeture se terminer avant tout changement
       d'écran. */
    const terminer = useCallback((suite?: () => void) => {
        ouvert.current = false
        onCloseRef.current()
        if (suite) setTimeout(suite, 350)
    }, [])

    // ── Écoute du SDK : succès, échec, ET fermeture ──────────────
    useEffect(() => {
        addSuccessListener((data: any) => {
            abouti.current = true
            const transactionId = data?.transactionId || data?.transaction_id || `KK-${Date.now()}`
            terminer(() => onSuccessRef.current(String(transactionId)))
        })

        addFailedListener(() => {
            abouti.current = true
            toast(t('Paiement échoué'), t("Le paiement n'a pas pu être finalisé. Veuillez réessayer."), 'danger')
            terminer()
        })

        /* Le client a refermé la fenêtre du widget. Le SDK nous le dit — encore
           fallait-il l'écouter. Deux événements couvrent les deux façons de
           sortir : la croix du widget, et l'abandon en cours de paiement. */
        const abandon = () => {
            if (abouti.current) return
            toast(t('Paiement annulé'), t('Rien n’a été débité. Vous pouvez reprendre quand vous voulez.'))
            terminer(() => onCancelRef.current?.())
        }
        addKkiapayCloseListener(abandon)
        addPaymentAbortedListener(abandon)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    /* Fermeture demandée par le client (croix, geste, bouton retour).
       Si aucun paiement n'a abouti alors que le widget avait été ouvert, c'est
       un abandon : on le DIT, et on rend la main à l'écran appelant pour qu'il
       annule ce qui doit l'être (commande en attente, notamment). */
    const fermer = useCallback(() => {
        const abandon = ouvert.current && !abouti.current
        if (abandon) {
            toast(t('Paiement annulé'), t('Rien n’a été débité. Vous pouvez reprendre quand vous voulez.'))
            terminer(() => onCancelRef.current?.())
            return
        }
        terminer()
    }, [t, terminer])

    // À chaque réouverture, on repart d'une ardoise propre.
    useEffect(() => {
        if (visible) { abouti.current = false; ouvert.current = false }
    }, [visible])

    // ── Extrait le montant numérique depuis un texte comme "À partir de 150 000 FCFA" ──
    const getNumericAmount = (): number => {
        const matches = amount.match(/\d+([\s]?\d+)*/g)
        if (matches && matches.length > 0) {
            return parseInt(matches[0].replace(/\s/g, ''), 10)
        }
        return 1000
    }

    const numericAmount = getNumericAmount()
    const formattedAmount = numericAmount.toLocaleString('fr-FR') + ' FCFA'

    // ── Ouvrir le widget Kkiapay natif ──
    const handlePayNow = useCallback(() => {
        if (!kkiapayKey) {
            toast(t('Configuration manquante'), t("La clé de paiement Kkiapay n'est pas configurée."))
            return
        }

        setLoading(true)
        ouvert.current = true

        try {
            openKkiapayWidget({
                amount: numericAmount,
                api_key: kkiapayKey,
                sandbox, // Lit settings.kkiapay_sandbox (default: false / prod)
                email: profile?.email || '',
                phone: profile?.phone || '',
                reason: serviceName || t('Paiement de service'),
            })
        } catch (e) {
            console.error('Erreur ouverture widget Kkiapay:', e)
            toast(t('Erreur'), t("Impossible d'ouvrir le paiement. Veuillez réessayer."))
        } finally {
            setLoading(false)
        }
    }, [kkiapayKey, numericAmount, profile, sandbox, serviceName, openKkiapayWidget, t])

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={fermer}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.kkiapayBadge}>
                                <Text style={styles.kkiapayText}>KKIAPAY</Text>
                            </View>
                            <View style={styles.securedRow}>
                                <ShieldCheck size={11} color={colors.primary} strokeWidth={2} />
                                <Text style={styles.securedLabel}>{t('Paiement sécurisé in-app')}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={fermer} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityRole="button"
                            accessibilityLabel="Fermer le paiement">
                            <X size={24} color={colors.textSecondary} strokeWidth={1.75} />
                        </TouchableOpacity>
                    </View>

                    {/* Service info */}
                    <View style={styles.serviceBox}>
                        <Briefcase size={20} color={colors.primary} strokeWidth={1.75} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.serviceLabel}>{t('Service')}</Text>
                            <Text style={styles.serviceName} numberOfLines={2}>{serviceName}</Text>
                        </View>
                    </View>

                    {/* Montant */}
                    <View style={styles.amountCard}>
                        <Text style={styles.amountLabel}>{t('Montant à payer')}</Text>
                        <Text style={styles.amountValue}>{formattedAmount}</Text>
                    </View>

                    {/* Moyens de paiement */}
                    <Text style={styles.sectionTitle}>{t('Moyens de paiement acceptés')}</Text>
                    <View style={styles.methodsRow}>
                        <View style={styles.methodChip}>
                            <Smartphone size={16} color="#008751" strokeWidth={1.75} />
                            <Text style={styles.methodText}>MTN MoMo</Text>
                        </View>
                        <View style={styles.methodChip}>
                            <Smartphone size={16} color="#00643C" strokeWidth={1.75} />
                            <Text style={styles.methodText}>Moov Money</Text>
                        </View>
                        <View style={styles.methodChip}>
                            <CreditCard size={16} color="#00643C" strokeWidth={1.75} />
                            <Text style={styles.methodText}>Visa / MC</Text>
                        </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                        style={[styles.payBtn, loading && { opacity: 0.6 }]}
                        onPress={handlePayNow}
                        disabled={loading || !kkiapayKey}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <>
                                <Lock size={18} color="#FFF" strokeWidth={1.75} />
                                <Text style={styles.payBtnText}>{t('Payer')} {formattedAmount}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Footer info */}
                    <View style={styles.footerNote}>
                        <Info size={13} color={colors.textMuted} strokeWidth={1.75} />
                        <Text style={styles.footerText}>
                            {t("Le widget de paiement Kkiapay s'ouvrira directement dans l'application. Android & iOS supportés.")}
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 44 : 28,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderBottomWidth: 0,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    headerLeft: { gap: 6 },
    kkiapayBadge: {
        backgroundColor: colors.primaryMuted,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        alignSelf: 'flex-start',
    },
    kkiapayText: {
        fontSize: 13,
        fontFamily: 'Outfit_700Bold',
        color: colors.primary,
        letterSpacing: 1.2,
    },
    securedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    securedLabel: {
        fontSize: 12,
        fontFamily: 'Outfit_500Medium',
        color: colors.primary,
    },
    closeBtn: { padding: 4 },

    /* Service */
    serviceBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.surfaceWarm,
        padding: 14,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: 16,
    },
    serviceLabel: {
        fontSize: 12,
        fontFamily: 'Outfit_600SemiBold',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    serviceName: {
        ...typography.label,
        color: colors.textPrimary,
        marginTop: 2,
    },

    /* Amount */
    amountCard: {
        backgroundColor: colors.headerBg,
        padding: 20,
        borderRadius: radius.lg,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        ...shadows.glow,
    },
    amountLabel: {
        fontSize: 12,
        fontFamily: 'Outfit_600SemiBold',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    amountValue: {
        fontSize: 28,
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        color: colors.primary,
        marginTop: 4,
    },

    /* Methods */
    sectionTitle: {
        ...typography.caption,
        color: colors.textSecondary,
        fontFamily: 'Outfit_600SemiBold',
        marginBottom: 10,
    },
    methodsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    methodChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        backgroundColor: colors.surfaceWarm,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    methodText: {
        fontSize: 12,
        fontFamily: 'Outfit_600SemiBold',
        color: colors.textPrimary,
    },

    /* CTA */
    payBtn: {
        backgroundColor: colors.primary,
        borderRadius: radius.md,
        paddingVertical: 17,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        ...shadows.glow,
    },
    payBtnText: {
        ...typography.button,
        color: '#FFF',
        fontSize: 16,
    },

    /* Footer */
    footerNote: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 16,
    },
    footerText: {
        fontSize: 12,
        fontFamily: 'Outfit_400Regular',
        color: colors.textMuted,
        flex: 1,
    },
})
