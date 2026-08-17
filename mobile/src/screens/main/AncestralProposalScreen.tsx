/* ═══════════════════════════════════════════════════════════
   Proposition Recherche Ancestrale.

   Apparaît UNIQUEMENT après le paiement des frais de nationalité (260 €)
   quand il MANQUE les documents ancestraux (actes des grands-parents /
   arrière-grands-parents). Le client ACCEPTE (paie 250 €) ou DÉCLINE.

   Accepter -> Kkiapay 250 € (converti EUR->XOF) -> :
     1) /api/nationality/recherche-ancestrale : marque la demande
        (recherche_ancestrale_paid=true) + notifie le staff ;
     2) /api/mobile/dossiers : ouvre un dossier « Recherche Ancestrale »
        (dossier_tracking, source=mobile) visible admin/agent + Service Mobile.
   Décliner -> retour à l'accueil (relançable depuis Services).
═══════════════════════════════════════════════════════════ */
import React, { useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    X, Check, AlertTriangle, Search, FileText, GitBranch, ShieldCheck,
    MessageCircle, Lock, ArrowRight,
} from 'lucide-react-native'
import { toast } from '../../lib/feedback'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { FlagBar } from '../../components/ui'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import KkiapayModal from '../../components/KkiapayModal'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* Prix : par défaut 250 € (canonique) mais surchargé par la config admin,
   transmise en paramètre depuis le formulaire nationalité. */
const EUR_TO_XOF = 655.957
const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', XOF: 'FCFA', XAF: 'FCFA' }
function toXof(amount: number, currency: string): number {
    return (currency || 'EUR').toUpperCase() === 'EUR' ? Math.round(amount * EUR_TO_XOF) : Math.round(amount)
}

const INCLUS = [
    { icon: Search, title: 'Recherche en archives', desc: "Investigation poussée dans les registres d'état civil béninois et archives coloniales." },
    { icon: FileText, title: 'Récupération des actes', desc: 'Obtention des copies officielles certifiées de vos aïeux (grands-parents et arrière-grands-parents).' },
    { icon: GitBranch, title: 'Arbre généalogique', desc: 'Construction de votre arbre généalogique certifié, base juridique de votre nationalité.' },
    { icon: ShieldCheck, title: 'Dossier consolidé', desc: 'Renforcement immédiat de votre demande de nationalité avec des preuves solides.' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AncestralProposalScreen({ navigation, route }: { navigation: any; route?: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()
    const [loading, setLoading] = useState(false)
    const [showKkiapay, setShowKkiapay] = useState(false)

    const ref: string | null = route?.params?.ref || null
    const missing: string[] = Array.isArray(route?.params?.missing) && route.params.missing.length > 0
        ? route.params.missing
        : [
            "Extrait de naissance du père (original ou copie certifiée)",
            'Acte de naissance du grand-père paternel',
            'Justificatifs de filiation des arrière-grands-parents',
        ]
    const amountEur: number = Number(route?.params?.amount) || 250
    const currency: string = String(route?.params?.currency || 'EUR')
    const symbol = CURRENCY_SYMBOL[currency.toUpperCase()] || currency
    const amountXof = toXof(amountEur, currency)

    const goHome = () => navigation.navigate('Main', { screen: 'Home' })

    const onPaid = async (transactionId: string) => {
        setShowKkiapay(false)
        setLoading(true)
        try {
            // 1) Marquer la demande de nationalité + notifier le staff.
            if (ref) {
                await fetchWithTimeout(`${API_BASE}/api/nationality/recherche-ancestrale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    timeoutMs: 20000,
                    body: JSON.stringify({
                        ref,
                        payment_provider: 'kkiapay',
                        payment_tx_id: transactionId,
                        amount: amountEur,
                        amount_xof: amountXof,
                    }),
                }).catch(() => { /* non bloquant : le dossier suit */ })
            }

            // 2) Ouvrir un dossier « Recherche Ancestrale » (dossier_tracking).
            await fetchWithTimeout(`${API_BASE}/api/mobile/dossiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    service_type: 'Recherche Ancestrale',
                    payment_tx_id: transactionId,
                    payment_amount: amountXof,
                    payment_currency: 'XOF',
                    notes: ref
                        ? `Recherche ancestrale souscrite depuis l'app (complément de la demande de nationalité ${ref}).`
                        : "Recherche ancestrale souscrite depuis l'app.",
                }),
            }).catch(() => { /* non bloquant */ })

            toast(t('Recherche lancée'), t('Votre recherche ancestrale est ouverte. Notre équipe vous contactera par messagerie pour affiner les informations.'))
            goHome()
        } catch {
            toast(t('Erreur'), t('Le paiement a réussi mais une étape a échoué. Notre équipe régularisera votre dossier.'))
            goHome()
        } finally {
            setLoading(false)
        }
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* Header : fermer = décliner */}
            <View style={styles.header}>
                <Pressable onPress={goHome} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('Fermer')} hitSlop={8}>
                    <X size={20} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 200 }}
            >
                {/* Bandeau confirmation nationalité */}
                <View style={styles.okBanner}>
                    <View style={styles.okDot}>
                        <Check size={14} color={C.primaryText} strokeWidth={3} />
                    </View>
                    <Text style={styles.okText}>{t('Dossier de nationalité déposé et payé')}</Text>
                </View>

                {/* Titre */}
                <View style={styles.titleWrap}>
                    <Text style={styles.title}>{t('Complétez votre lignée')}</Text>
                    <Text style={styles.subtitle}>
                        {t("Votre demande est en cours, mais il manque des pièces essentielles sur vos ancêtres pour garantir son succès.")}
                    </Text>
                </View>

                {/* Alerte documents manquants */}
                <View style={styles.alertCard}>
                    <View style={styles.alertHead}>
                        <AlertTriangle size={20} color={C.danger} strokeWidth={2} />
                        <Text style={styles.alertTitle}>{t('Documents ancestraux manquants')}</Text>
                    </View>
                    {missing.map((m, i) => (
                        <View key={i} style={styles.alertRow}>
                            <View style={styles.alertBullet} />
                            <Text style={styles.alertItem}>{t(m)}</Text>
                        </View>
                    ))}
                </View>

                {/* La solution */}
                <View style={styles.sectionWrap}>
                    <Text style={styles.sectionLabel}>{t('LA SOLUTION')}</Text>
                    <View style={styles.solutionCard}>
                        <Text style={styles.solutionTitle}>{t('Nous retrouvons vos racines')}</Text>
                        {INCLUS.map(({ icon: Ic, title, desc }) => (
                            <View key={title} style={styles.inclRow}>
                                <View style={styles.inclIcon}>
                                    <Ic size={20} color={C.primary} strokeWidth={2} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inclTitle}>{t(title)}</Text>
                                    <Text style={styles.inclDesc}>{t(desc)}</Text>
                                </View>
                            </View>
                        ))}
                        <View style={styles.solutionNote}>
                            <MessageCircle size={16} color={C.primary} strokeWidth={2} />
                            <Text style={styles.solutionNoteText}>
                                {t('Notre équipe échangera avec vous par messagerie pour affiner la recherche.')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Carte prix */}
                <View style={styles.priceCard}>
                    <View style={styles.priceTop}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.priceLabel}>{t('Forfait recherche ancestrale')}</Text>
                            <Text style={styles.priceAmount}>{amountEur} {symbol}</Text>
                        </View>
                        <View style={styles.priceSecure}>
                            <Lock size={12} color={C.primaryText} strokeWidth={2} />
                            <Text style={styles.priceSecureText}>{t('SÉCURISÉ')}</Text>
                        </View>
                    </View>
                    <Text style={styles.priceXof}>
                        {t('Soit environ {x} FCFA', { x: amountXof.toLocaleString('fr-FR') })}
                    </Text>
                </View>
            </ScrollView>

            {/* Footer sticky : Accepter / Décliner */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
                <Pressable
                    style={[styles.acceptBtn, loading && { opacity: 0.6 }]}
                    onPress={() => setShowKkiapay(true)}
                    disabled={loading}
                    accessibilityRole="button"
                    hitSlop={6}
                >
                    {loading ? (
                        <ActivityIndicator color={C.primaryText} size="small" />
                    ) : (
                        <>
                            <Text style={styles.acceptBtnText}>{t('Accepter et payer {a} {s}', { a: amountEur, s: symbol })}</Text>
                            <ArrowRight size={18} color={C.primaryText} strokeWidth={2.2} />
                        </>
                    )}
                </Pressable>
                <Pressable style={styles.declineBtn} onPress={goHome} disabled={loading} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.declineBtnText}>{t('Non merci, peut-être plus tard')}</Text>
                </Pressable>
                <Text style={styles.footerNote}>
                    {t("Vous pourrez lancer cette recherche à tout moment depuis l'onglet Services.")}
                </Text>
            </View>

            <KkiapayModal
                visible={showKkiapay}
                amount={String(amountXof)}
                serviceName="Recherche Ancestrale"
                onClose={() => setShowKkiapay(false)}
                onSuccess={onPaid}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    closeBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    okBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginHorizontal: spacing.gutter, marginBottom: spacing.xl,
        backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12,
    },
    okDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    okText: { flex: 1, ...typography.caption, fontSize: 10.5, color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: fonts.bold },

    titleWrap: { paddingHorizontal: spacing.gutter, marginBottom: spacing.xl },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 30, lineHeight: 36, color: C.text, marginBottom: spacing.sm },
    subtitle: { ...typography.body, color: C.textSec, lineHeight: 22 },

    alertCard: {
        marginHorizontal: spacing.gutter, marginBottom: spacing.xxl,
        backgroundColor: C.dangerSoft, borderWidth: 1, borderColor: C.danger,
        borderRadius: radius.xxl, padding: spacing.lg,
    },
    alertHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
    alertTitle: { ...typography.button, fontSize: 12, color: C.danger, textTransform: 'uppercase', letterSpacing: 0.6 },
    alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    alertBullet: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.danger },
    alertItem: { flex: 1, ...typography.bodySmall, fontSize: 11.5, color: C.textSec },

    sectionWrap: { paddingHorizontal: spacing.gutter, marginBottom: spacing.xxl },
    sectionLabel: { ...typography.caption, fontSize: 10, color: C.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.md, marginLeft: 2 },
    solutionCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.card },
    solutionTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, color: C.text, marginBottom: spacing.lg },
    inclRow: { flexDirection: 'row', gap: 14, marginBottom: spacing.lg },
    inclIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    inclTitle: { ...typography.button, fontSize: 13, color: C.text, marginBottom: 3 },
    inclDesc: { ...typography.caption, fontSize: 11, color: C.textSec, lineHeight: 16 },
    solutionNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: C.border },
    solutionNoteText: { flex: 1, ...typography.caption, fontSize: 11, color: C.textSec, fontStyle: 'italic' },

    priceCard: {
        marginHorizontal: spacing.gutter, marginBottom: spacing.xl,
        backgroundColor: C.primary, borderTopWidth: 4, borderTopColor: '#FCD116',
        borderRadius: radius.xxl, padding: spacing.xl, ...shadows.cardRaised,
    },
    priceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
    priceLabel: { ...typography.caption, fontSize: 10, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },
    priceAmount: { fontFamily: fonts.extrabold, fontSize: 36, color: C.primaryText, letterSpacing: -1 },
    priceSecure: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    priceSecureText: { ...typography.caption, fontSize: 9, color: C.primaryText, letterSpacing: 0.5 },
    priceXof: { ...typography.bodySmall, fontSize: 13, color: 'rgba(255,255,255,0.9)' },

    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
        paddingHorizontal: spacing.gutter, paddingTop: spacing.md, gap: 10,
    },
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 16, ...shadows.card,
    },
    acceptBtnText: { ...typography.button, fontSize: 15, color: C.primaryText },
    declineBtn: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        borderRadius: radius.lg, paddingVertical: 15,
    },
    declineBtnText: { ...typography.button, fontSize: 14, color: C.textSec },
    footerNote: { ...typography.caption, fontSize: 10.5, color: C.textMuted, textAlign: 'center' },
})
