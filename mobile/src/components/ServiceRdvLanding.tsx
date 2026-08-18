/* ═══════════════════════════════════════════════════════════
   ServiceRdvLanding - gabarit d'écran de service SANS paiement (RDV / devis).
   Même présentation que la maquette Sleek « Création d'Entreprise » :
   hero éditorial + bande verte de piliers + mission + timeline 01/02/03 +
   contraste Solo vs RGB + prestations + réassurance + FAQ accordéon + CTA +
   barre collante. Paramétré par `content` → réutilisé par Business,
   Investissement, Guide Culturel (et tout futur service par devis).
   Actions réelles : Prendre rendez-vous (Appointments) + Nous contacter
   (onglet Messages). Charte v2, aucun prix.
═══════════════════════════════════════════════════════════ */

import React, { useState, useRef } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Share,
    LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { type LucideIcon, ChevronLeft, Share2, AlertTriangle, X, Check, CheckCircle, ChevronDown, Calendar } from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, shadows, typography, fonts } from '../config/theme'
import { FlagBar } from './ui'
import { useLang } from '../contexts/LangContext'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

export interface RdvLandingContent {
    serviceLabel: string
    /** Écran dédié à ouvrir au lieu de la simple demande de rendez-vous.
        Le Guide Culturel s'en sert : préparer un séjour suppose de recueillir
        l'itinéraire souhaité, pas seulement une date. */
    primaryScreen?: string
    shareMessage: string
    heroIcon: LucideIcon
    badge: string
    title: string
    subtitle: string
    chips: { icon: LucideIcon; label: string }[]
    trust: string[]
    piliers: { icon: LucideIcon; title: string; desc: string }[]
    missionEyebrow: string
    missionTitle: string
    missionText: string
    etapesEyebrow: string
    etapes: { num: string; title: string; desc: string }[]
    contrastEyebrow: string
    contrastPre: string
    contrastAccent: string
    contrastPost?: string
    contrastSub: string
    soloTitle: string
    solo: string[]
    avecTitle: string
    avec: string[]
    prestaEyebrow: string
    prestaTitle: string
    presta: string[]
    prestaNote: string
    /** Optionnel : « Détail des services » en cartes riches (icône + titre + desc)
        au lieu de la simple checklist. Ex. Autres Services. */
    prestaCards?: { icon: LucideIcon; title: string; desc: string }[]
    reassurance: { icon: LucideIcon; title: string; desc: string }[]
    faqEyebrow: string
    faq: { q: string; r: string }[]
    finalTitle: string
    finalText: string
    finalNote: string
    primaryCtaLabel: string
    stickyLabel: string
    stickyValue: string
    stickyBtnLabel: string
    /** Optionnel : bloc « Choisir mon format » (ex. Langues & Racines). */
    formatSelector?: {
        eyebrow: string
        title: string
        formatLabel: string
        formats: { icon: LucideIcon; label: string }[]
        languesLabel: string
        langues: string[]
        niveauLabel: string
        niveaux: string[]
        note: string
    }
    /** Si vrai, le bouton de la barre collante scrolle vers le sélecteur au lieu du RDV. */
    stickyScrollToSelector?: boolean
    /** Si vrai, l'action principale = « Nous contacter » (RDV en secondaire). Ex. Autres Services. */
    primaryContact?: boolean
}

export default function ServiceRdvLanding({ navigation, content: k }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    navigation: any
    content: RdvLandingContent
}) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    const scrollRef = useRef<ScrollView>(null)
    const fs = k.formatSelector
    const [fmtIdx, setFmtIdx] = useState(0)
    const [langueIdx, setLangueIdx] = useState(0)
    const [niveauIdx, setNiveauIdx] = useState(0)
    const [bodyY, setBodyY] = useState(0)
    const [selY, setSelY] = useState(0)

    const goRdv = () => {
        let label = k.serviceLabel
        if (fs) {
            const fmt = fs.formats[fmtIdx]?.label || ''
            const lg = fs.langues[langueIdx] || ''
            const nv = fs.niveaux[niveauIdx] || ''
            label = `${k.serviceLabel} (${fmt}, ${lg}, niveau ${nv})`
        }
        if (k.primaryScreen) { navigation.navigate(k.primaryScreen); return }
        navigation.navigate('Appointments', { openRequest: true, serviceLabel: label })
    }
    const scrollToSelector = () =>
        scrollRef.current?.scrollTo({ y: Math.max(0, bodyY + selY - 16), animated: true })

    // « Messages » est un onglet imbriqué (route 'Main') : on le cible via les tabs.
    const goContact = () => navigation.navigate('Main', { screen: 'Messages' })
    const onShare = () => Share.share({ message: k.shareMessage }).catch(() => {})

    // Autres Services : l'action principale est « Nous contacter ».
    const primaryAction = k.primaryContact ? goContact : goRdv
    const secondaryAction = k.primaryContact ? goRdv : goContact
    const secondaryLabel = k.primaryContact ? 'Prendre rendez-vous' : 'Nous contacter'
    const stickyAction = k.primaryContact ? goContact : (k.stickyScrollToSelector ? scrollToSelector : goRdv)

    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }

    const HeroIcon = k.heroIcon

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Pressable onPress={onShare} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                    <View style={styles.heroIcon}><HeroIcon size={30} color={C.primary} strokeWidth={2} /></View>
                    <View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{t(k.badge)}</Text></View>
                    <Text style={styles.heroTitle}>{t(k.title)}</Text>
                    <Text style={styles.heroSub}>{t(k.subtitle)}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {k.chips.map(({ icon: Icon, label }) => (
                            <View key={label} style={styles.chip}>
                                <Icon size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.chipText}>{t(label)}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Trust strip */}
                <View style={styles.trustStrip}>
                    {k.trust.map((tr, i) => (
                        <React.Fragment key={tr}>
                            {i > 0 && <Text style={styles.trustDot}>•</Text>}
                            <Text style={styles.trustText}>{t(tr)}</Text>
                        </React.Fragment>
                    ))}
                </View>

                {/* Bande verte piliers */}
                <View style={styles.pilierBand}>
                    {k.piliers.map(({ icon: Icon, title, desc }) => (
                        <View key={title} style={styles.pilier}>
                            <Icon size={24} color={C.primaryText} strokeWidth={2} />
                            <Text style={styles.pilierTitle}>{t(title)}</Text>
                            <Text style={styles.pilierDesc}>{t(desc)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.body} onLayout={e => setBodyY(e.nativeEvent.layout.y)}>
                    {/* Mission */}
                    <View style={styles.section}>
                        <Text style={styles.eyebrow}>{t(k.missionEyebrow)}</Text>
                        <Text style={styles.h2}>{t(k.missionTitle)}</Text>
                        <Text style={styles.para}>{t(k.missionText)}</Text>
                    </View>

                    {/* Timeline */}
                    <View style={styles.section}>
                        <Text style={styles.eyebrow}>{t(k.etapesEyebrow)}</Text>
                        <View style={styles.timeline}>
                            <View style={styles.timelineLine} />
                            {k.etapes.map((e, i) => (
                                <View key={e.num} style={styles.step}>
                                    <View style={[styles.stepDot, i === 0 ? styles.stepDotGold : styles.stepDotGreen]}>
                                        <Text style={[styles.stepNum, i === 0 && styles.stepNumGold]}>{e.num}</Text>
                                    </View>
                                    <View style={styles.stepBody}>
                                        <Text style={styles.stepTitle}>{t(e.title)}</Text>
                                        <Text style={styles.stepDesc}>{t(e.desc)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Contraste */}
                    <View style={styles.section}>
                        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                            <Text style={styles.eyebrowCenter}>{t(k.contrastEyebrow)}</Text>
                            <Text style={styles.contrastTitle}>
                                {t(k.contrastPre)}
                                <Text style={{ color: C.danger }}> {t(k.contrastAccent)}</Text>
                                {k.contrastPost ? t(k.contrastPost) : ''}
                            </Text>
                            <Text style={styles.contrastSub}>{t(k.contrastSub)}</Text>
                        </View>

                        <View style={styles.soloCard}>
                            <View style={styles.contrastHead}>
                                <AlertTriangle size={20} color={C.danger} />
                                <Text style={[styles.contrastHeadText, { color: C.danger }]}>{t(k.soloTitle)}</Text>
                            </View>
                            {k.solo.map((s, i) => (
                                <View key={i} style={styles.contrastItem}>
                                    <X size={14} color={C.danger} strokeWidth={2.5} style={{ marginTop: 2 }} />
                                    <Text style={styles.soloText}>{t(s)}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.avecCard}>
                            <View style={styles.contrastHead}>
                                <CheckCircle size={20} color={C.primary} />
                                <Text style={[styles.contrastHeadText, { color: C.primary }]}>{t(k.avecTitle)}</Text>
                            </View>
                            {k.avec.map((s, i) => (
                                <View key={i} style={styles.contrastItem}>
                                    <Check size={14} color={C.primary} strokeWidth={3} style={{ marginTop: 2 }} />
                                    <Text style={styles.avecText}>{t(s)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Choisir mon format (optionnel) */}
                    {fs && (
                        <View style={styles.selectorCard} onLayout={e => setSelY(e.nativeEvent.layout.y)}>
                            <Text style={styles.eyebrow}>{t(fs.eyebrow)}</Text>
                            <Text style={styles.selectorTitle}>{t(fs.title)}</Text>

                            <Text style={styles.selectorLabel}>{t(fs.formatLabel)}</Text>
                            <View style={styles.fmtRow}>
                                {fs.formats.map((f, i) => {
                                    const active = fmtIdx === i
                                    const Ic = f.icon
                                    return (
                                        <Pressable key={f.label} onPress={() => setFmtIdx(i)} style={[styles.fmtCard, active && styles.fmtCardActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                                            <Ic size={24} color={active ? C.primary : C.textMuted} strokeWidth={2} />
                                            <Text style={[styles.fmtText, active && { color: C.primary }]}>{t(f.label)}</Text>
                                        </Pressable>
                                    )
                                })}
                            </View>

                            <Text style={styles.selectorLabel}>{t(fs.languesLabel)}</Text>
                            <View style={styles.pillWrap}>
                                {fs.langues.map((lg, i) => {
                                    const a = langueIdx === i
                                    return (
                                        <Pressable key={lg} onPress={() => setLangueIdx(i)} style={[styles.pill, a && styles.pillActive]} accessibilityRole="button" accessibilityState={{ selected: a }}>
                                            <Text style={[styles.pillText, a && styles.pillTextActive]}>{t(lg)}</Text>
                                        </Pressable>
                                    )
                                })}
                            </View>

                            <Text style={styles.selectorLabel}>{t(fs.niveauLabel)}</Text>
                            <View style={styles.pillWrap}>
                                {fs.niveaux.map((nv, i) => {
                                    const a = niveauIdx === i
                                    return (
                                        <Pressable key={nv} onPress={() => setNiveauIdx(i)} style={[styles.pill, a && styles.pillActive]} accessibilityRole="button" accessibilityState={{ selected: a }}>
                                            <Text style={[styles.pillText, a && styles.pillTextActive]}>{t(nv)}</Text>
                                        </Pressable>
                                    )
                                })}
                            </View>

                            <Text style={styles.selectorNote}>{t(fs.note)}</Text>
                        </View>
                    )}

                    {/* Prestations */}
                    <View style={styles.section}>
                        <Text style={styles.eyebrow}>{t(k.prestaEyebrow)}</Text>
                        <Text style={styles.h2}>{t(k.prestaTitle)}</Text>
                        {k.prestaCards ? (
                            <>
                                {k.prestaCards.map(({ icon: Icon, title, desc }) => (
                                    <View key={title} style={styles.detailCard}>
                                        <View style={styles.detailIcon}><Icon size={22} color={C.primary} strokeWidth={2} /></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.detailTitle}>{t(title)}</Text>
                                            <Text style={styles.detailDesc}>{t(desc)}</Text>
                                        </View>
                                    </View>
                                ))}
                                {!!k.prestaNote && (
                                    <View style={styles.detailNoteBox}>
                                        <Text style={styles.detailNoteText}>{t(k.prestaNote)}</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.prestaCard}>
                                {k.presta.map((p, i) => (
                                    <View key={i} style={styles.prestaRow}>
                                        <View style={styles.prestaCheck}><Check size={16} color={C.primary} strokeWidth={2.5} /></View>
                                        <Text style={styles.prestaText}>{t(p)}</Text>
                                    </View>
                                ))}
                                {!!k.prestaNote && <Text style={styles.prestaNote}>{t(k.prestaNote)}</Text>}
                            </View>
                        )}
                    </View>

                    {/* Réassurance */}
                    <View style={styles.reassureRow}>
                        {k.reassurance.map(({ icon: Icon, title, desc }) => (
                            <View key={title} style={styles.reassure}>
                                <View style={styles.reassureIcon}><Icon size={20} color={C.primary} strokeWidth={2} /></View>
                                <Text style={styles.reassureTitle}>{t(title)}</Text>
                                <Text style={styles.reassureDesc}>{t(desc)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* FAQ */}
                    <View style={styles.section}>
                        <Text style={styles.eyebrow}>{t(k.faqEyebrow)}</Text>
                        {k.faq.map((f, i) => {
                            const open = openFaq === i
                            return (
                                <Pressable key={i} onPress={() => toggleFaq(i)} style={styles.faqCard} accessibilityRole="button">
                                    <View style={styles.faqHead}>
                                        <Text style={styles.faqQ}>{t(f.q)}</Text>
                                        <ChevronDown size={18} color={C.textMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                                    </View>
                                    {open && <Text style={styles.faqA}>{t(f.r)}</Text>}
                                </Pressable>
                            )
                        })}
                    </View>

                    {/* CTA final */}
                    <View style={styles.finalCard}>
                        <Text style={styles.finalTitle}>{t(k.finalTitle)}</Text>
                        <Text style={styles.finalText}>{t(k.finalText)}</Text>
                        <Pressable onPress={primaryAction} style={({ pressed }) => [styles.finalBtn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
                            <Text style={styles.finalBtnText}>{t(k.primaryCtaLabel)}</Text>
                            {!k.primaryContact && <Calendar size={19} color={C.primaryText} />}
                        </Pressable>
                        <Pressable onPress={secondaryAction} style={({ pressed }) => [styles.finalBtnGhost, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
                            <Text style={styles.finalBtnGhostText}>{t(secondaryLabel)}</Text>
                        </Pressable>
                        <Text style={styles.finalNote}>{t(k.finalNote)}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Barre collante : conseil & devis, jamais de prix */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View>
                    <Text style={styles.stickyLabel}>{t(k.stickyLabel)}</Text>
                    <Text style={styles.stickyValue}>{t(k.stickyValue)}</Text>
                </View>
                <Pressable onPress={stickyAction} style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button">
                    <Text style={styles.stickyBtnText}>{t(k.stickyBtnLabel)}</Text>
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', ...shadows.card },

    scroll: { paddingBottom: 120 },

    hero: { paddingHorizontal: spacing.gutter, marginBottom: spacing.lg },
    heroIcon: { width: 56, height: 56, borderRadius: radius.xl, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    heroBadge: { alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, marginBottom: spacing.sm },
    heroBadgeText: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
    heroTitle: { ...typography.h1, color: C.text, lineHeight: 36 },
    heroSub: { ...typography.body, color: C.textMuted, marginTop: spacing.sm, marginBottom: spacing.md },
    chipsRow: { gap: spacing.sm, paddingVertical: 2 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontSize: 11, fontFamily: fonts.bold, color: C.text },

    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.gutter, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginBottom: spacing.lg, flexWrap: 'wrap' },
    trustText: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    trustDot: { color: C.accent, fontSize: 12 },

    pilierBand: { backgroundColor: C.primary, borderRadius: radius.xxl, marginHorizontal: spacing.md, paddingVertical: 28, paddingHorizontal: spacing.gutter, marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', ...shadows.cardRaised },
    pilier: { width: '50%', paddingRight: spacing.md, marginBottom: spacing.lg },
    pilierTitle: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bold, letterSpacing: 1, textTransform: 'uppercase', marginTop: 8 },
    pilierDesc: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, marginTop: 4 },

    body: { paddingHorizontal: spacing.gutter },
    section: { marginBottom: spacing.xxl },
    eyebrow: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    eyebrowCenter: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm, textAlign: 'center' },
    h2: { ...typography.h2, color: C.text, marginBottom: spacing.md },
    para: { ...typography.body, color: C.textMuted, lineHeight: 23 },

    timeline: { position: 'relative', paddingTop: spacing.xs },
    timelineLine: { position: 'absolute', left: 15, top: 6, bottom: 6, width: 2, backgroundColor: C.border },
    step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
    stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', ...shadows.card },
    stepDotGold: { backgroundColor: C.accent },
    stepDotGreen: { backgroundColor: C.primary },
    stepNum: { fontSize: 13, fontFamily: fonts.extrabold, color: '#FFFFFF' },
    stepNumGold: { color: '#FFFFFF' },
    stepBody: { flex: 1, paddingTop: 3 },
    stepTitle: { fontSize: 15, fontFamily: fonts.bold, color: C.text, marginBottom: 2 },
    stepDesc: { fontSize: 13, lineHeight: 19, color: C.textMuted },

    contrastTitle: { ...typography.h2, color: C.text, textAlign: 'center', lineHeight: 30 },
    contrastSub: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginTop: spacing.sm },
    soloCard: { backgroundColor: C.surfaceAlt, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.border, padding: spacing.lg, marginBottom: spacing.md },
    avecCard: { backgroundColor: C.primarySoft, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.primary, padding: spacing.lg, ...shadows.card },
    contrastHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
    contrastHeadText: { fontSize: 14, fontFamily: fonts.bold },
    contrastItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    soloText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.textMuted },
    avecText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.text, fontFamily: fonts.bold },

    prestaCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xxl, padding: spacing.lg, ...shadows.card },
    prestaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    prestaCheck: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    prestaText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold, color: C.text },
    prestaNote: { fontSize: 11, fontStyle: 'italic', color: C.textMuted, marginTop: spacing.sm },

    /* Détail des services (cartes riches) */
    detailCard: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.sm, ...shadows.card },
    detailIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    detailTitle: { fontSize: 15, fontFamily: fonts.bold, color: C.text, marginBottom: 3 },
    detailDesc: { fontSize: 12, lineHeight: 18, color: C.textMuted },
    detailNoteBox: { borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: radius.xl, backgroundColor: C.surfaceAlt, padding: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
    detailNoteText: { fontSize: 12, fontFamily: fonts.medium, color: C.textMuted, textAlign: 'center' },

    /* Choisir mon format */
    selectorCard: { backgroundColor: C.surfaceAlt, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.border, padding: spacing.lg, marginBottom: spacing.xxl },
    selectorTitle: { ...typography.h2, fontSize: 20, color: C.text, marginBottom: spacing.lg },
    selectorLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md },
    fmtRow: { flexDirection: 'row', gap: spacing.sm },
    fmtCard: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: radius.lg, paddingVertical: spacing.md },
    fmtCardActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
    fmtText: { fontSize: 12, fontFamily: fonts.bold, color: C.textMuted },
    pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pill: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    pillActive: { borderColor: C.primary, backgroundColor: C.primary },
    pillText: { fontSize: 12, fontFamily: fonts.bold, color: C.textSec },
    pillTextActive: { color: C.primaryText },
    selectorNote: { fontSize: 11, fontStyle: 'italic', color: C.textMuted, textAlign: 'center', marginTop: spacing.lg },

    reassureRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
    reassure: { flex: 1, alignItems: 'center' },
    reassureIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    reassureTitle: { fontSize: 10, fontFamily: fonts.bold, color: C.text, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 3 },
    reassureDesc: { fontSize: 9, color: C.textMuted, textAlign: 'center', lineHeight: 13 },

    faqCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    faqQ: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: C.text },
    faqA: { fontSize: 13, lineHeight: 20, color: C.textMuted, marginTop: spacing.sm },

    finalCard: { backgroundColor: C.surfaceAlt, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xl },
    finalTitle: { ...typography.h2, fontSize: 20, color: C.text, marginBottom: spacing.sm, textAlign: 'center' },
    finalText: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
    finalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 16, ...shadows.card },
    finalBtnText: { ...typography.button, fontSize: 16, color: C.primaryText },
    finalBtnGhost: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
    finalBtnGhostText: { ...typography.button, fontSize: 16, color: C.text },
    finalNote: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.lg, textAlign: 'center' },

    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.04, shadowRadius: 32, elevation: 12 },
    stickyLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickyValue: { fontSize: 17, fontFamily: fonts.extrabold, color: '#00643C', marginTop: 1 },
    stickyBtn: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 13, ...shadows.card },
    stickyBtnText: { ...typography.button, fontSize: 14, color: C.primaryText },
})
