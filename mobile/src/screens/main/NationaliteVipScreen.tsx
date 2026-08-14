/* ═══════════════════════════════════════════════════════════
   Nationalité Béninoise VIP - landing du service phare (RDV/formulaire).
   Fidèle à la maquette Sleek : hero editorial, bande verte, engagement +
   timeline, contraste, MINI-QUIZ d'éligibilité (indicatif, rien enregistré),
   pièces à fournir, réassurance, FAQ, DOUBLE CTA. Aucun paiement ici : le
   client « Commence sa demande » (formulaire) ou « Réserve un créneau » (RDV).
═══════════════════════════════════════════════════════════ */

import React, { useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Share,
    LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, Share2, Star, CheckCircle2, Eye, Zap, Crown, UserCheck, Globe,
    Clock, X, Check, XCircle, CheckCircle, FileText, Shield, User, Lock, Plus, Calendar,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, shadows, typography, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

const PLAYFAIR = fonts.extrabold

const CHIPS = [
    { icon: CheckCircle2, label: 'De A à Z' },
    { icon: Eye, label: 'Suivi transparent' },
    { icon: Zap, label: 'Réponse 48 h' },
]
const PILIERS = [
    { icon: Crown, title: 'Accompagnement VIP', desc: 'Prise en charge totale de votre dossier administratif.' },
    { icon: UserCheck, title: 'Suivi personnalisé', desc: 'Un interlocuteur unique pour toutes vos questions.' },
    { icon: Globe, title: 'Diaspora focus', desc: "Procédure optimisée pour les résidents à l'étranger." },
    { icon: Clock, title: 'Réponse 48 h', desc: "Traitement prioritaire de vos demandes d'information." },
]
const ETAPES = [
    { num: '01', title: 'Constitution du dossier', desc: 'Collecte et vérification de toutes les pièces justificatives requises.' },
    { num: '02', title: 'Suivi personnalisé', desc: "Dépôt officiel et suivi hebdomadaire de l'avancement auprès des autorités." },
    { num: '03', title: 'Remise des documents', desc: 'Réception de votre certificat de nationalité et envoi sécurisé à votre domicile.' },
]
const SOLO = [
    'Délais incertains et absence de suivi',
    'Risque élevé de rejet pour pièce manquante',
    'Voyages coûteux et répétés au Bénin',
    "Stress lié à l'opacité administrative",
]
const AVEC = [
    'Dossier vérifié et validé avant dépôt',
    'Interlocuteur unique au quotidien',
    'Gestion 100% à distance sécurisée',
    'Accompagnement jusqu\'à la remise des documents',
]
const PIECES = [
    "Certificat d'afro-descendance",
    "Extrait d'acte de naissance du demandeur",
    'Copie du passeport actuel',
    "Extrait d'acte de naissance des parents",
    'Actes des grands-parents',
    'Casier judiciaire de résidence',
]
const REASSURANCE = [
    { icon: Shield, label: 'Sans engagement' },
    { icon: User, label: 'Conseiller dédié' },
    { icon: Lock, label: 'Confidentialité' },
]
const FAQ = [
    { q: "Quels sont les délais d'obtention ?", r: 'Les délais dépendent de votre dossier et de l\'administration. Nous vous donnons une estimation réaliste dès l\'analyse de votre situation.' },
    { q: 'Dois-je me déplacer au Bénin ?', r: 'Non. Nous accompagnons la diaspora à distance : la constitution du dossier et le suivi se font sans que vous ayez à vous déplacer.' },
    { q: "Le certificat d'afro-descendance est-il obligatoire ?", r: "C'est une pièce clé du dossier. Si vous ne l'avez pas encore, nous vous indiquons comment l'obtenir et quelles preuves alternatives sont acceptées." },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function NationaliteVipScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [q1, setQ1] = useState<boolean | null>(null)
    const [q2, setQ2] = useState<boolean | null>(null)
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    const goForm = () => navigation.navigate('NationaliteForm')
    const goRdv = () => navigation.navigate('Appointments', { openRequest: true, serviceLabel: 'Nationalité VIP' })
    const onShare = () => Share.share({ message: t('Nationalité béninoise : accompagnement VIP par Retour Gagnant : https://www.retourgagnantbenin.bj/services/nationalite-vip') }).catch(() => {})
    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }

    const orientation = (() => {
        if (q1 === null || q2 === null) return t('Répondez aux deux questions pour une première orientation.')
        if (q1 === false) return t('La nationalité par afro-descendance concerne la diaspora afro-descendante. Contactez-nous pour évaluer votre situation précise.')
        if (q1 && q2) return t("D'après vos premières réponses, vous semblez éligible. Nous vous recommandons de commencer votre demande en ligne pour une étude détaillée.")
        return t('Un lien avec le Bénin peut se documenter de plusieurs façons. Prenez rendez-vous : nous vous aidons à réunir les preuves.')
    })()

    const YesNo = ({ value, onYes, onNo }: { value: boolean | null; onYes: () => void; onNo: () => void }) => (
        <View style={styles.yesNoRow}>
            <Pressable onPress={onYes} style={[styles.yesNoBtn, value === true && styles.yesNoActive]} accessibilityRole="button">
                <Text style={[styles.yesNoText, value === true && styles.yesNoTextActive]}>{t('Oui')}</Text>
            </Pressable>
            <Pressable onPress={onNo} style={[styles.yesNoBtn, value === false && styles.yesNoActiveNo]} accessibilityRole="button">
                <Text style={[styles.yesNoText, value === false && styles.yesNoTextActive]}>{t('Non')}</Text>
            </Pressable>
        </View>
    )

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
                <Text style={styles.headerTitle}>{t('Nationalité VIP')}</Text>
                <Pressable onPress={onShare} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                    <View style={styles.badge}>
                        <Star size={14} color={C.primary} strokeWidth={2.2} fill={C.primary} />
                        <Text style={styles.badgeText}>{t('Service phare : Nationalité béninoise')}</Text>
                    </View>
                    <Text style={styles.heroTitle}>{t('Nationalité Béninoise : Accompagnement VIP')}</Text>
                    <Text style={styles.heroSub}>{t('Un service exclusif dédié à la diaspora afro-descendante pour sécuriser votre lien juridique avec la terre de vos ancêtres.')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {CHIPS.map(({ icon: Ic, label }) => (
                            <View key={label} style={styles.chip}><Ic size={16} color={C.primary} strokeWidth={2.2} /><Text style={styles.chipText}>{t(label)}</Text></View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Trust strip */}
                <View style={styles.trustStrip}>
                    {['Premier échange gratuit', 'Conseiller dédié', 'Confidentialité'].map((tr, i) => (
                        <React.Fragment key={tr}>
                            {i > 0 && <Text style={styles.trustDot}>•</Text>}
                            <Text style={styles.trustText}>{t(tr)}</Text>
                        </React.Fragment>
                    ))}
                </View>

                {/* Bande verte piliers */}
                <View style={styles.pilierBand}>
                    {PILIERS.map(({ icon: Ic, title, desc }) => (
                        <View key={title} style={styles.pilier}>
                            <View style={styles.pilierIcon}><Ic size={22} color={"#FFFFFF"} strokeWidth={2} /></View>
                            <Text style={styles.pilierTitle}>{t(title)}</Text>
                            <Text style={styles.pilierDesc}>{t(desc)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.body}>
                    {/* Engagement + timeline */}
                    <Text style={styles.eyebrow}>{t('Notre engagement')}</Text>
                    <Text style={styles.h2}>{t('Sécuriser votre héritage, un dossier à la fois')}</Text>
                    <Text style={styles.para}>{t("L'obtention de la nationalité béninoise pour la diaspora est une procédure précieuse mais complexe. Nous agissons comme votre mandataire de confiance, assurant la liaison entre vos documents et les institutions compétentes, pour un résultat sans stress.")}</Text>

                    <View style={styles.timeline}>
                        <View style={styles.timelineLine} />
                        {ETAPES.map((e, i) => (
                            <View key={e.num} style={styles.step}>
                                <View style={[styles.stepDot, i === 0 ? styles.stepDotGold : styles.stepDotGreen]}>
                                    <Text style={[styles.stepNum, i === 0 ? { color: C.accentInk } : { color: C.primary }]}>{e.num}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.stepTitle}>{t(e.title)}</Text>
                                    <Text style={styles.stepDesc}>{t(e.desc)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contraste */}
                    <View style={styles.contrastHead}>
                        <Text style={styles.contrastTitle}>{t('Une procédure exigeante')}</Text>
                        <Text style={styles.contrastSub}>{t('Un dossier qui ne pardonne pas ')}<Text style={styles.contrastAccent}>{t("l'à-peu-près")}</Text>.</Text>
                    </View>
                    <View style={styles.soloCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.soloBadge}><X size={16} color={C.danger} strokeWidth={2.5} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.danger }]}>{t('En solo')}</Text>
                        </View>
                        {SOLO.map((s, i) => (
                            <View key={i} style={styles.contrastItem}><XCircle size={14} color={C.danger} style={{ marginTop: 2, opacity: 0.6 }} /><Text style={styles.soloText}>{t(s)}</Text></View>
                        ))}
                    </View>
                    <View style={styles.avecCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.avecBadge}><Check size={16} color="#fff" strokeWidth={3} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.primary }]}>{t('Avec Retour Gagnant')}</Text>
                        </View>
                        {AVEC.map((s, i) => (
                            <View key={i} style={styles.contrastItem}><CheckCircle size={14} color={C.primary} style={{ marginTop: 2 }} /><Text style={styles.avecText}>{t(s)}</Text></View>
                        ))}
                    </View>

                    {/* Quiz éligibilité */}
                    <View style={styles.quizCard}>
                        <Text style={styles.quizEyebrow}>{t('Auto-évaluation')}</Text>
                        <Text style={styles.quizTitle}>{t('Suis-je concerné(e) ?')}</Text>
                        <Text style={styles.quizQ}>{t('1. Êtes-vous afro-descendant(e) de la diaspora ?')}</Text>
                        <YesNo value={q1} onYes={() => setQ1(true)} onNo={() => setQ1(false)} />
                        <Text style={[styles.quizQ, { marginTop: spacing.lg }]}>{t('2. Pouvez-vous documenter un lien avec le Bénin ?')}</Text>
                        <YesNo value={q2} onYes={() => setQ2(true)} onNo={() => setQ2(false)} />
                        <View style={styles.orientationBox}>
                            <Text style={styles.orientationText}><Text style={styles.orientationLabel}>{t('Orientation : ')}</Text>{orientation}</Text>
                        </View>
                    </View>

                    {/* Pièces à fournir */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('On sait exactement quoi réunir')}</Text>
                    <Text style={styles.h2}>{t('Pièces à fournir')}</Text>
                    <View style={{ gap: spacing.sm }}>
                        {PIECES.map((p, i) => (
                            <View key={i} style={styles.pieceRow}>
                                <View style={styles.pieceIcon}><FileText size={14} color={C.primary} /></View>
                                <Text style={styles.pieceText}>{t(p)}</Text>
                            </View>
                        ))}
                    </View>
                    <Text style={styles.pieceNote}>{t('Cette liste est indicative et peut varier selon votre situation personnelle.')}</Text>

                    {/* Réassurance */}
                    <View style={styles.reassureRow}>
                        {REASSURANCE.map(({ icon: Ic, label }) => (
                            <View key={label} style={styles.reassure}>
                                <View style={styles.reassureIcon}><Ic size={20} color={C.primary} strokeWidth={2} /></View>
                                <Text style={styles.reassureLabel}>{t(label)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* FAQ */}
                    <Text style={styles.eyebrow}>{t('Questions fréquentes')}</Text>
                    {FAQ.map((f, i) => {
                        const open = openFaq === i
                        return (
                            <Pressable key={i} onPress={() => toggleFaq(i)} style={styles.faqCard} accessibilityRole="button">
                                <View style={styles.faqHead}>
                                    <Text style={styles.faqQ}>{t(f.q)}</Text>
                                    <Plus size={18} color={C.primary} style={{ transform: [{ rotate: open ? '45deg' : '0deg' }] }} />
                                </View>
                                {open && <Text style={styles.faqA}>{t(f.r)}</Text>}
                            </Pressable>
                        )
                    })}

                    {/* CTA final */}
                    <View style={styles.finalSection}>
                        <Text style={styles.finalTitle}>{t('Renouez officiellement avec votre terre.')}</Text>
                        <Text style={styles.finalText}>{t("Commencez votre dossier aujourd'hui pour obtenir une réponse sous 48 h.")}</Text>
                        <Pressable onPress={goForm} style={({ pressed }) => [styles.finalBtn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
                            <Text style={styles.finalBtnText}>{t('Commencer ma demande')}</Text>
                        </Pressable>
                        <Pressable onPress={goRdv} style={({ pressed }) => [styles.finalBtnGhost, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
                            <Text style={styles.finalBtnGhostText}>{t('Réserver un créneau')}</Text>
                        </Pressable>
                        <Text style={styles.finalNote}>{t('Premier appel 15 min gratuit')}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Barre collante */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View>
                    <Text style={styles.stickyLabel}>{t('Réponse sous 48 h')}</Text>
                    <Text style={styles.stickySub}>{t('Sans engagement')}</Text>
                </View>
                <Pressable onPress={goForm} style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button">
                    <Calendar size={16} color={C.primaryText} />
                    <Text style={styles.stickyBtnText}>{t('Commencer')}</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
    headerTitle: { fontSize: 12, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

    scroll: { paddingBottom: 120 },

    hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, marginBottom: spacing.lg },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    heroTitle: { fontFamily: PLAYFAIR, fontSize: 32, lineHeight: 38, color: C.text, marginBottom: spacing.sm },
    heroSub: { ...typography.body, color: C.textMuted, marginBottom: spacing.md, lineHeight: 24 },
    chipsRow: { gap: spacing.sm, paddingVertical: 2 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadows.card },
    chipText: { fontSize: 11, fontFamily: fonts.bold, color: C.text },

    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.gutter, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginBottom: spacing.xl, flexWrap: 'wrap' },
    trustText: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    trustDot: { color: C.accent, fontSize: 12 },

    pilierBand: { backgroundColor: C.primary, borderRadius: radius.xxl, marginHorizontal: spacing.md, paddingVertical: 28, paddingHorizontal: spacing.gutter, marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', ...shadows.cardRaised },
    pilier: { width: '50%', paddingRight: spacing.md, marginBottom: spacing.lg },
    pilierIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    pilierTitle: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14 },
    pilierDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 11, lineHeight: 16, marginTop: 4 },

    body: { paddingHorizontal: spacing.gutter },
    eyebrow: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    h2: { fontFamily: PLAYFAIR, fontSize: 22, lineHeight: 28, color: C.text, marginBottom: spacing.md },
    para: { ...typography.body, color: C.textMuted, lineHeight: 23 },

    timeline: { position: 'relative', marginTop: spacing.xl, marginBottom: spacing.xxl },
    timelineLine: { position: 'absolute', left: 19, top: 6, bottom: 6, width: 2, backgroundColor: C.border },
    step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
    stepDot: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 2, ...shadows.card },
    stepDotGold: { borderColor: C.accent },
    stepDotGreen: { borderColor: C.primary },
    stepNum: { fontSize: 14, fontFamily: fonts.extrabold },
    stepTitle: { fontSize: 15, fontFamily: fonts.bold, color: C.text, marginBottom: 3, marginTop: 4 },
    stepDesc: { fontSize: 12.5, lineHeight: 19, color: C.textMuted },

    contrastHead: { alignItems: 'center', marginBottom: spacing.lg },
    contrastTitle: { fontFamily: PLAYFAIR, fontSize: 22, color: C.text, textAlign: 'center', marginBottom: spacing.sm },
    contrastSub: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center' },
    contrastAccent: { fontFamily: fonts.bold, color: C.text },
    soloCard: { backgroundColor: C.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.dangerSoft, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
    avecCard: { backgroundColor: C.primarySoft, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.primary, padding: spacing.lg, marginBottom: spacing.xxl, ...shadows.card },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
    soloBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
    avecBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    contrastCardTitle: { fontSize: 14, fontFamily: fonts.bold },
    contrastItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    soloText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.textMuted },
    avecText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.text, fontFamily: fonts.semibold },

    /* Quiz */
    quizCard: { backgroundColor: C.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.accentSoft, padding: spacing.lg, ...shadows.card },
    quizEyebrow: { fontSize: 10, fontFamily: fonts.extrabold, color: C.accentInk, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    quizTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: C.text, marginBottom: spacing.lg },
    quizQ: { fontSize: 14, fontFamily: fonts.semibold, color: C.text, marginBottom: spacing.md, lineHeight: 20 },
    yesNoRow: { flexDirection: 'row', gap: spacing.sm },
    yesNoBtn: { flex: 1, paddingVertical: 13, borderRadius: radius.lg, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
    yesNoActive: { borderColor: C.primary, backgroundColor: C.primary },
    yesNoActiveNo: { borderColor: C.danger, backgroundColor: C.danger },
    yesNoText: { fontSize: 14, fontFamily: fonts.bold, color: C.textMuted },
    yesNoTextActive: { color: '#fff' },
    orientationBox: { marginTop: spacing.lg, backgroundColor: C.surfaceAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: C.border, padding: spacing.md },
    orientationText: { fontSize: 12.5, lineHeight: 19, color: C.textMuted },
    orientationLabel: { fontFamily: fonts.bold, color: C.text },

    /* Pièces */
    pieceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md, ...shadows.card },
    pieceIcon: { width: 26, height: 26, borderRadius: radius.sm, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    pieceText: { flex: 1, fontSize: 12.5, fontFamily: fonts.semibold, color: C.text },
    pieceNote: { fontSize: 10, fontStyle: 'italic', color: C.textMuted, textAlign: 'center', marginTop: spacing.md, marginBottom: spacing.xxl },

    /* Réassurance */
    reassureRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: C.border },
    reassure: { flex: 1, alignItems: 'center', gap: spacing.sm },
    reassureIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    reassureLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.text, letterSpacing: 0.3, textTransform: 'uppercase', textAlign: 'center' },

    /* FAQ */
    faqCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    faqQ: { flex: 1, fontSize: 13.5, fontFamily: fonts.bold, color: C.text, lineHeight: 19 },
    faqA: { fontSize: 13, lineHeight: 20, color: C.textMuted, marginTop: spacing.sm },

    /* CTA final */
    finalSection: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.lg },
    finalTitle: { fontFamily: PLAYFAIR, fontSize: 26, lineHeight: 32, color: C.text, textAlign: 'center', marginBottom: spacing.sm },
    finalText: { ...typography.body, color: C.textMuted, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md },
    finalBtn: { width: '100%', backgroundColor: C.primary, borderRadius: radius.xl, paddingVertical: 18, alignItems: 'center', ...shadows.cardRaised },
    finalBtnText: { fontSize: 16, fontFamily: fonts.bold, color: C.primaryText },
    finalBtnGhost: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xl, paddingVertical: 18, alignItems: 'center', marginTop: spacing.sm },
    finalBtnGhostText: { fontSize: 16, fontFamily: fonts.bold, color: C.text },
    finalNote: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.lg },

    /* Sticky */
    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    stickyLabel: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickySub: { fontSize: 9, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 1 },
    stickyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: radius.lg, paddingHorizontal: 24, paddingVertical: 13, ...shadows.card },
    stickyBtnText: { fontSize: 14, fontFamily: fonts.bold, color: C.primaryText },
})
