/* ═══════════════════════════════════════════════════════════
   Recherche Ancestrale (Services) — méthode MANUELLE.

   Service PAYANT (montant configurable en admin, repli 250 €), comme Fa/Permis.
   Payer -> Kkiapay (EUR->XOF) -> ouvre un dossier « Recherche Ancestrale »
   (dossier_tracking, source=mobile) visible admin/agent + onglet Service Mobile,
   où l'équipe échange avec le client pour affiner la recherche.

   PRÉSENTATION : même patron éditorial que PermisScreen / FaScreen
   (hero + bandeau de confiance + bande verte de piliers + notre métier +
   étapes + contraste solo/avec + FAQ + barre d'action collante). Auparavant
   cet écran avait une mise en page propre à lui, en rupture avec les autres
   écrans de service.

   La version AUTOMATIQUE (proposée après le paiement nationalité quand les
   pièces ancestrales manquent) vit dans AncestralProposalScreen.
═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
    Share, LayoutAnimation, UIManager, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, Share2, Search, FileText, GitBranch, ShieldCheck, Lock,
    Sparkles, Check, CheckCircle, X, XCircle, ChevronDown, Clock, Users,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { toast } from '../../lib/feedback'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import KkiapayModal from '../../components/KkiapayModal'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

const EUR_TO_XOF = 655.957
const CURRENCY_SYMBOL: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', XOF: 'FCFA', XAF: 'FCFA' }
function toXof(amount: number, currency: string): number {
    return (currency || 'EUR').toUpperCase() === 'EUR' ? Math.round(amount * EUR_TO_XOF) : Math.round(amount)
}

const PILIERS = [
    { icon: Search, title: 'Archives béninoises', desc: "Registres d'état civil et archives coloniales explorés sur place." },
    { icon: FileText, title: 'Actes authentiques', desc: 'Copies officielles certifiées de vos aïeux.' },
    { icon: GitBranch, title: 'Arbre certifié', desc: 'Votre lignée reconstituée et consultable dans l’app.' },
]

const ETAPES = [
    { num: '1', title: 'Vous réglez le forfait', desc: 'Paiement sécurisé Mobile Money ou carte. Votre dossier de recherche est ouvert immédiatement.' },
    { num: '2', title: 'Entretien par messagerie', desc: 'Notre équipe recueille tout ce que vous savez : noms, villages, dates approximatives, souvenirs de famille.' },
    { num: '3', title: 'Investigation sur le terrain', desc: 'Nos chercheurs se déplacent dans les mairies, archives et communautés concernées.' },
    { num: '4', title: 'Remise de votre dossier', desc: 'Actes récupérés, arbre généalogique certifié et preuves de filiation consolidées.' },
]

const SOLO = [
    'Des archives non numérisées, consultables uniquement sur place',
    'Des registres dispersés entre mairies, paroisses et archives nationales',
    'Aucun interlocuteur identifié depuis l’étranger',
    'Des mois perdus sans garantie de résultat',
]

const AVEC = [
    'Des chercheurs présents physiquement au Bénin',
    'L’accès aux registres d’état civil et aux archives coloniales',
    'Des actes officiels certifiés, recevables dans vos démarches',
    'Un arbre généalogique consolidé et un suivi par messagerie',
]

const FAQ = [
    { q: 'Que se passe-t-il si mes ancêtres restent introuvables ?', a: "Nous vous remettons l'intégralité des pistes explorées et des documents collectés, et notre équipe vous oriente vers les recours restants (témoignages communautaires, registres paroissiaux). La recherche est un travail d'investigation : nous nous engageons sur les moyens déployés." },
    { q: 'Combien de temps dure la recherche ?', a: 'Comptez généralement de quelques semaines à quelques mois selon la précision des informations de départ et l’état des archives concernées. Vous êtes tenu informé à chaque étape par messagerie.' },
    { q: 'Quelles informations dois-je fournir ?', a: "Tout ce que vous savez : noms et prénoms des aïeux, village ou région d'origine, dates approximatives, métiers, récits de famille. Même partielles, ces informations orientent nos recherches." },
    { q: 'Ce dossier sert-il pour la nationalité béninoise ?', a: "Oui. Les actes d'ascendance récupérés viennent renforcer un dossier de reconnaissance de nationalité, en apportant les preuves de filiation généralement manquantes." },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RechercheAncestraleScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [loading, setLoading] = useState(false)
    const [showKkiapay, setShowKkiapay] = useState(false)
    const [openFaq, setOpenFaq] = useState<number | null>(0)
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

    const onShare = useCallback(() => {
        Share.share({ message: t('Retrouvez vos ancêtres béninois avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/recherche-ancestrale') }).catch(() => { })
    }, [t])

    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Recherche Ancestrale')}</Text>
                <Pressable onPress={onShare} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                    <View style={styles.badge}>
                        <Sparkles size={14} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.badgeText}>{t('Racines & Généalogie')}</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('Retrouvez vos racines')}</Text>
                    <Text style={styles.heroSub}>
                        {t("Nos chercheurs remontent votre lignée dans les archives béninoises pour retrouver les actes de vos ancêtres et bâtir votre arbre généalogique certifié.")}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {[{ icon: CheckCircle, label: 'Actes officiels' }, { icon: Users, label: 'Chercheurs sur place' }, { icon: ShieldCheck, label: 'Arbre certifié' }].map(({ icon: Ic, label }) => (
                            <View key={label} style={styles.chip}>
                                <Ic size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.chipText}>{t(label)}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Bandeau de confiance */}
                <View style={styles.trustStrip}>
                    {['Archives nationales', 'Suivi par messagerie', 'À distance'].map((tr, i) => (
                        <React.Fragment key={tr}>
                            {i > 0 && <Text style={styles.trustDot}>•</Text>}
                            <Text style={styles.trustText}>{t(tr)}</Text>
                        </React.Fragment>
                    ))}
                </View>

                {/* Bande verte : piliers */}
                <View style={styles.pilierBand}>
                    {PILIERS.map(({ icon: Ic, title, desc }) => (
                        <View key={title} style={styles.pilier}>
                            <View style={styles.pilierIcon}><Ic size={22} color="#FFFFFF" strokeWidth={2} /></View>
                            <Text style={styles.pilierTitle}>{t(title)}</Text>
                            <Text style={styles.pilierDesc}>{t(desc)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.body}>
                    {/* Notre métier */}
                    <Text style={styles.eyebrow}>{t('Notre métier')}</Text>
                    <Text style={styles.h2}>{t('Une enquête menée sur place, pas une base de données')}</Text>
                    <Text style={styles.para}>
                        {t("Au Bénin, l'essentiel des registres n'est pas numérisé : retrouver un aïeul suppose de se déplacer dans les mairies, les archives nationales et les communautés d'origine. C'est ce travail de terrain que nous menons pour vous, jusqu'à obtenir des actes recevables.")}
                    </Text>

                    {/* Étapes */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Les étapes')}</Text>
                    <View style={styles.timeline}>
                        <View style={styles.timelineLine} />
                        {ETAPES.map((e, i) => (
                            <View key={e.num} style={styles.step}>
                                <View style={[styles.stepDot, i === 0 ? styles.stepDotFirst : styles.stepDotGreen]}>
                                    <Text style={styles.stepNum}>{e.num}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.stepTitle}>{t(e.title)}</Text>
                                    <Text style={styles.stepDesc}>{t(e.desc)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contraste solo / avec */}
                    <View style={styles.soloCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.soloBadge}><X size={16} color={C.error} strokeWidth={2.5} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.error }]}>{t('En solo')}</Text>
                        </View>
                        {SOLO.map((s, i) => (
                            <View key={i} style={styles.contrastItem}>
                                <XCircle size={14} color={C.error} style={{ marginTop: 2, opacity: 0.6 }} />
                                <Text style={styles.soloText}>{t(s)}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.avecCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.avecBadge}><Check size={16} color="#fff" strokeWidth={3} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.primary }]}>{t('Avec Retour Gagnant')}</Text>
                        </View>
                        {AVEC.map((s, i) => (
                            <View key={i} style={styles.contrastItem}>
                                <CheckCircle size={14} color={C.primary} style={{ marginTop: 2 }} />
                                <Text style={styles.avecText}>{t(s)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Ce que comprend le forfait */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Le forfait')}</Text>
                    <View style={styles.priceCard}>
                        <View style={styles.priceTop}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.priceLabel}>{t('Forfait recherche ancestrale')}</Text>
                                <Text style={styles.priceAmount}>{amountEur} {symbol}</Text>
                                <Text style={styles.priceXof}>{t('Soit environ')} {amountXof.toLocaleString('fr-FR')} FCFA</Text>
                            </View>
                            <View style={styles.priceSecure}>
                                <Lock size={12} color="#FFFFFF" strokeWidth={2} />
                                <Text style={styles.priceSecureText}>{t('SÉCURISÉ')}</Text>
                            </View>
                        </View>
                        <View style={styles.priceSep} />
                        {['Recherche en archives et sur le terrain', 'Récupération des actes de vos aïeux', 'Arbre généalogique certifié', 'Suivi par messagerie jusqu’à la remise'].map(item => (
                            <View key={item} style={styles.priceItem}>
                                <Check size={14} color="#FFFFFF" strokeWidth={3} />
                                <Text style={styles.priceItemText}>{t(item)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Délai */}
                    <View style={styles.delayRow}>
                        <Clock size={14} color={C.textMuted} strokeWidth={2} />
                        <Text style={styles.delayText}>{t('Durée moyenne : de quelques semaines à quelques mois selon les archives.')}</Text>
                    </View>

                    {/* FAQ */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Questions fréquentes')}</Text>
                    <View style={{ gap: spacing.sm }}>
                        {FAQ.map((f, i) => {
                            const open = openFaq === i
                            return (
                                <Pressable key={i} onPress={() => toggleFaq(i)} style={styles.faqCard} accessibilityRole="button">
                                    <View style={styles.faqHead}>
                                        <Text style={styles.faqQ}>{t(f.q)}</Text>
                                        <ChevronDown
                                            size={18}
                                            color={C.textMuted}
                                            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
                                        />
                                    </View>
                                    {open && <Text style={styles.faqA}>{t(f.a)}</Text>}
                                </Pressable>
                            )
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Barre d'action collante */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View>
                    <Text style={styles.stickyLabel}>{t('Forfait')}</Text>
                    <Text style={styles.stickyValue}>{amountEur} {symbol}</Text>
                </View>
                <Pressable
                    onPress={() => setShowKkiapay(true)}
                    disabled={loading}
                    style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }, loading && { opacity: 0.6 }]}
                    accessibilityRole="button"
                >
                    {loading
                        ? <ActivityIndicator color="#FFFFFF" />
                        : (
                            <>
                                <Lock size={16} color="#FFFFFF" strokeWidth={2} />
                                <Text style={styles.stickyBtnText}>{t('Payer et lancer')}</Text>
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
    scroll: { paddingBottom: 140 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    /* Hero */
    hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.xl },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { ...typography.button, fontSize: 12, color: C.primary },
    heroTitle: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, color: C.text, marginBottom: spacing.sm },
    heroSub: { ...typography.body, color: C.textSec, lineHeight: 22 },
    chipsRow: { gap: 8, paddingTop: spacing.md, paddingRight: spacing.gutter },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
    chipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.text },

    /* Bandeau de confiance */
    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, backgroundColor: C.surfaceAlt, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
    trustText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 },
    trustDot: { color: C.textMuted, fontSize: 11 },

    /* Bande verte : piliers */
    pilierBand: { backgroundColor: C.primary, paddingVertical: spacing.xl, paddingHorizontal: spacing.gutter, gap: spacing.xl },
    pilier: { gap: 6 },
    pilierIcon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    pilierTitle: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
    pilierDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.9)' },

    /* Corps */
    body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl },
    eyebrow: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.sm },
    h2: { fontFamily: fonts.extrabold, fontSize: 21, lineHeight: 28, color: C.text, marginBottom: spacing.md },
    para: { ...typography.body, color: C.textSec, lineHeight: 22 },

    /* Étapes */
    timeline: { position: 'relative', gap: spacing.xl, paddingLeft: 4 },
    timelineLine: { position: 'absolute', left: 19, top: 12, bottom: 12, width: 2, backgroundColor: C.border },
    step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    stepDotFirst: { backgroundColor: C.primary, borderColor: C.primary },
    stepDotGreen: { backgroundColor: C.surface, borderColor: C.primary },
    stepNum: { fontFamily: fonts.extrabold, fontSize: 13, color: C.primary },
    stepTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text, marginBottom: 3 },
    stepDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.textSec },

    /* Contraste */
    soloCard: { backgroundColor: C.dangerSoft, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xxl, gap: spacing.sm },
    avecCard: { backgroundColor: C.primarySoft, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
    soloBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    avecBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    contrastCardTitle: { fontFamily: fonts.extrabold, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6 },
    contrastItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    soloText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.text },
    avecText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.text },

    /* Carte prix */
    priceCard: { backgroundColor: C.primary, borderRadius: radius.xl, padding: spacing.lg, borderTopWidth: 4, borderTopColor: '#FCD116', gap: spacing.sm, ...shadows.card },
    priceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    priceLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1 },
    priceAmount: { fontFamily: fonts.extrabold, fontSize: 34, color: '#FFFFFF', marginTop: 2 },
    priceXof: { fontFamily: fonts.body, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    priceSecure: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    priceSecureText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#FFFFFF', letterSpacing: 1 },
    priceSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 },
    priceItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    priceItemText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: '#FFFFFF' },

    delayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: spacing.md },
    delayText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: C.textMuted },

    /* FAQ */
    faqCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    faqQ: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.text, lineHeight: 19 },
    faqA: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, marginTop: spacing.sm },

    /* Barre collante */
    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    stickyLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickyValue: { fontFamily: fonts.extrabold, fontSize: 20, color: '#00643C', marginTop: 1 },
    stickyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 14 },
    stickyBtnText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' },
})
