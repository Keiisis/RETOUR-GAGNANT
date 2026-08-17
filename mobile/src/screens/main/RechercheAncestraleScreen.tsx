/* ═══════════════════════════════════════════════════════════
   Recherche Ancestrale (Services) — méthode MANUELLE.

   N'est plus un RDV : c'est un service PAYANT (250 €), comme Fa / Permis.
   Payer -> Kkiapay (EUR->XOF) -> ouvre un dossier « Recherche Ancestrale »
   (dossier_tracking, source=mobile) visible admin/agent + onglet Service Mobile,
   où l'équipe échange avec le client pour affiner la recherche.

   La version AUTOMATIQUE (proposée après le paiement nationalité quand les
   pièces ancestrales manquent) vit dans AncestralProposalScreen.
═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ArrowLeft, Search, FileText, GitBranch, ShieldCheck, MessageCircle, Lock, Sparkles,
} from 'lucide-react-native'
import { toast } from '../../lib/feedback'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import KkiapayModal from '../../components/KkiapayModal'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

const EUR_TO_XOF = 655.957
const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', XOF: 'FCFA', XAF: 'FCFA' }
function toXof(amount: number, currency: string): number {
    return (currency || 'EUR').toUpperCase() === 'EUR' ? Math.round(amount * EUR_TO_XOF) : Math.round(amount)
}

const INCLUS = [
    { icon: Search, title: 'Recherche en archives', desc: "Investigation dans les registres d'état civil béninois et les archives coloniales." },
    { icon: FileText, title: 'Récupération des actes', desc: 'Copies officielles certifiées de vos aïeux (grands-parents et arrière-grands-parents).' },
    { icon: GitBranch, title: 'Arbre généalogique', desc: 'Construction de votre arbre généalogique certifié, consultable dans l’app.' },
    { icon: ShieldCheck, title: 'Dossier consolidé', desc: 'Des preuves de filiation solides pour renforcer vos démarches.' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RechercheAncestraleScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [loading, setLoading] = useState(false)
    const [showKkiapay, setShowKkiapay] = useState(false)
    // Montant configurable admin (bloc form_settings de la page nationalité).
    const [amountEur, setAmountEur] = useState(250)
    const [currency, setCurrency] = useState('EUR')
    const symbol = CURRENCY_SYMBOL[currency.toUpperCase()] || currency
    const amountXof = toXof(amountEur, currency)

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('page_sections').select('content')
                .eq('page', 'nationalite').eq('section_key', 'form_settings').single()
            const c = (data?.content || {}) as Record<string, unknown>
            if (c.recherche_ancestrale_amount) setAmountEur(Number(c.recherche_ancestrale_amount))
            if (c.recherche_ancestrale_currency) setCurrency(String(c.recherche_ancestrale_currency))
        })().catch(() => { /* repli 250 € */ })
    }, [])

    const onPaid = async (transactionId: string) => {
        setShowKkiapay(false)
        setLoading(true)
        try {
            await fetchWithTimeout(`${API_BASE}/api/mobile/dossiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    service_type: 'Recherche Ancestrale',
                    payment_tx_id: transactionId,
                    payment_amount: amountXof,
                    payment_currency: 'XOF',
                    notes: "Recherche ancestrale souscrite depuis l'onglet Services.",
                }),
            }).catch(() => { /* non bloquant */ })

            toast(t('Recherche lancée'), t('Votre recherche ancestrale est ouverte. Notre équipe vous contactera par messagerie pour affiner les informations.'))
            navigation.navigate('Main', { screen: 'Dossier' })
        } catch {
            toast(t('Erreur'), t('Le paiement a réussi mais une étape a échoué. Notre équipe régularisera votre dossier.'))
            navigation.navigate('Main', { screen: 'Home' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} accessibilityRole="button" accessibilityLabel={t('Retour')} hitSlop={8}>
                    <ArrowLeft size={20} color={C.text} strokeWidth={2} />
                </Pressable>
                <View style={styles.badge}>
                    <Sparkles size={13} color={C.primary} strokeWidth={2.2} />
                    <Text style={styles.badgeText}>{t('Recherche Ancestrale')}</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
                <View style={styles.titleWrap}>
                    <Text style={styles.title}>{t('Retrouvez vos racines')}</Text>
                    <Text style={styles.subtitle}>
                        {t("Nos experts remontent votre lignée dans les archives béninoises pour retrouver les actes de vos ancêtres et bâtir votre arbre généalogique certifié.")}
                    </Text>
                </View>

                <View style={styles.sectionWrap}>
                    <Text style={styles.sectionLabel}>{t('CE QUI EST INCLUS')}</Text>
                    <View style={styles.card}>
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
                        <View style={styles.note}>
                            <MessageCircle size={16} color={C.primary} strokeWidth={2} />
                            <Text style={styles.noteText}>
                                {t('Après paiement, notre équipe échange avec vous par messagerie pour affiner la recherche.')}
                            </Text>
                        </View>
                    </View>
                </View>

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

            <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
                <Pressable
                    style={[styles.payBtn, loading && { opacity: 0.6 }]}
                    onPress={() => setShowKkiapay(true)}
                    disabled={loading}
                    accessibilityRole="button"
                    hitSlop={6}
                >
                    {loading ? (
                        <ActivityIndicator color={C.primaryText} size="small" />
                    ) : (
                        <>
                            <Lock size={17} color={C.primaryText} strokeWidth={2} />
                            <Text style={styles.payBtnText}>{t('Payer {a} {s} et lancer', { a: amountEur, s: symbol })}</Text>
                        </>
                    )}
                </Pressable>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
    badgeText: { ...typography.button, fontSize: 12, color: C.primary },

    titleWrap: { paddingHorizontal: spacing.gutter, marginTop: spacing.sm, marginBottom: spacing.xl },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 30, lineHeight: 36, color: C.text, marginBottom: spacing.sm },
    subtitle: { ...typography.body, color: C.textSec, lineHeight: 22 },

    sectionWrap: { paddingHorizontal: spacing.gutter, marginBottom: spacing.xxl },
    sectionLabel: { ...typography.caption, fontSize: 10, color: C.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.md, marginLeft: 2 },
    card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.card },
    inclRow: { flexDirection: 'row', gap: 14, marginBottom: spacing.lg },
    inclIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    inclTitle: { ...typography.button, fontSize: 13, color: C.text, marginBottom: 3 },
    inclDesc: { ...typography.caption, fontSize: 11, color: C.textSec, lineHeight: 16 },
    note: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: C.border },
    noteText: { flex: 1, ...typography.caption, fontSize: 11, color: C.textSec, fontStyle: 'italic' },

    priceCard: { marginHorizontal: spacing.gutter, marginBottom: spacing.xl, backgroundColor: C.primary, borderTopWidth: 4, borderTopColor: '#FCD116', borderRadius: radius.xxl, padding: spacing.xl, ...shadows.cardRaised },
    priceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
    priceLabel: { ...typography.caption, fontSize: 10, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 },
    priceAmount: { fontFamily: fonts.extrabold, fontSize: 36, color: C.primaryText, letterSpacing: -1 },
    priceSecure: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    priceSecureText: { ...typography.caption, fontSize: 9, color: C.primaryText, letterSpacing: 0.5 },
    priceXof: { ...typography.bodySmall, fontSize: 13, color: 'rgba(255,255,255,0.9)' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: spacing.md },
    payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 16, ...shadows.card },
    payBtnText: { ...typography.button, fontSize: 15, color: C.primaryText },
})
