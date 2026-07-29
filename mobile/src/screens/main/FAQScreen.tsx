'use strict'
import React, { useState, useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, TextInput, Pressable, Dimensions, LayoutAnimation,
    UIManager, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   FAQScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'FAQ'>

/* ── Données FAQ ── */
const FAQ_DATA = [
    {
        category: 'Nationalité béninoise',
        icon: 'ribbon-outline' as const,
        items: [
            {
                q: 'Qui peut bénéficier de la nationalité béninoise ?',
                a: "Toute personne d'origine béninoise ou descendant d'Africains réduits en esclavage (diaspora africaine) peut bénéficier des dispositions de la loi sur la nationalité béninoise. Un dossier complet comprenant des pièces d'état civil et des preuves de liens avec le Bénin est requis.",
            },
            {
                q: 'Quels documents sont nécessaires pour la nationalité ?',
                a: "Les documents principaux incluent : acte de naissance, passeport en cours de validité, casier judiciaire, photos d'identité, preuves de lien avec le Bénin (arbre généalogique, témoignages…). Notre équipe vous guidera selon votre situation.",
            },
            {
                q: 'Combien de temps prend la procédure ?',
                a: 'La procédure dure généralement entre 6 et 18 mois selon la complexité du dossier et les délais administratifs. Retour Gagnant accompagne chaque étape pour optimiser ce délai.',
            },
        ],
    },
    {
        category: 'Passeport béninois',
        icon: 'document-outline' as const,
        items: [
            {
                q: "Puis-je obtenir un passeport béninois depuis l'étranger ?",
                a: "Oui, il est possible d'initier la démarche depuis l'étranger via notre service. Nous coordonnons avec les consulats et ambassades du Bénin pour faciliter votre demande.",
            },
            {
                q: 'Quelle est la durée de validité du passeport béninois ?',
                a: 'Le passeport béninois est valide 5 ans et peut être renouvelé. Un passeport biométrique vous sera délivré, conforme aux normes internationales.',
            },
        ],
    },
    {
        category: 'Recherches ancestrales',
        icon: 'people-outline' as const,
        items: [
            {
                q: 'Que comprend le service de recherche ancestrale ?',
                a: "Ce service inclut une recherche généalogique approfondie dans les archives béninoises, la reconstruction de votre arbre familial, l'identification de votre région et village d'origine, et un rapport complet documenté.",
            },
            {
                q: 'Est-il possible de retrouver sa famille au Bénin ?',
                a: 'Oui, dans de nombreux cas, nos experts locaux peuvent identifier et entrer en contact avec des membres de votre famille restés au Bénin. Un accompagnement sur le terrain est disponible.',
            },
        ],
    },
    {
        category: 'Paiements & Tarifs',
        icon: 'card-outline' as const,
        items: [
            {
                q: 'Quels modes de paiement acceptez-vous ?',
                a: 'Nous acceptons les paiements via Kkiapay (Mobile Money MTN, Moov, cartes bancaires). Les paiements sont sécurisés et un reçu vous est systématiquement envoyé par email.',
            },
            {
                q: 'Comment sont calculés les frais de service ?',
                a: 'Les frais varient selon le service demandé et la complexité du dossier. Un devis détaillé vous est fourni lors de la consultation initiale, sans engagement.',
            },
        ],
    },
    {
        category: 'Application & Support',
        icon: 'phone-portrait-outline' as const,
        items: [
            {
                q: "Comment suivre l'avancement de mon dossier ?",
                a: 'Dans la section "Mon Dossier" de l\'application, vous pouvez suivre en temps réel la progression de votre dossier, consulter vos documents, et recevoir des notifications à chaque mise à jour.',
            },
            {
                q: 'Comment contacter le support ?',
                a: "Notre équipe est disponible via la messagerie intégrée de l'application, par email à contact@retourgagnantbenin.bj, ou par téléphone/WhatsApp. Des rendez-vous peuvent être planifiés depuis l'onglet \"Rendez-vous\".",
            },
        ],
    },
]

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION
═══════════════════════════════════════════════════════════ */

function AnimatedSection({
    children, delay = 0, style,
}: {
    children: React.ReactNode
    delay?: number
    style?: any
}) {
    const anim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, {
            duration: 800,
            easing: Easing.out(Easing.quad),
        }))
    }, [delay])

    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))

    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FAQ ITEM (Accordéon animé)
═══════════════════════════════════════════════════════════ */

function FaqItem({
    question, answer, isOpen, onToggle, isLast,
}: {
    question: string
    answer: string
    isOpen: boolean
    onToggle: () => void
    isLast: boolean
}) {
    const anim = useSharedValue(isOpen ? 1 : 0)
    const pressAnim = useSharedValue(0)

    useEffect(() => {
        anim.value = withSpring(isOpen ? 1 : 0, { damping: 18, stiffness: 180 })
    }, [isOpen])

    const chevronStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${interpolate(anim.value, [0, 1], [0, 180])}deg` }],
    }))

    const iconBgStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            anim.value, [0, 1],
            ['rgba(0, 135, 81, 0.06)', 'rgba(252, 209, 22, 0.15)']
        ),
        borderColor: interpolateColor(
            anim.value, [0, 1],
            ['rgba(0, 135, 81, 0.08)', 'rgba(252, 209, 22, 0.35)']
        ),
    }))

    const pressStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressAnim.value, [0, 1],
            ['rgba(0, 135, 81, 0)', 'rgba(0, 135, 81, 0.03)']
        ),
    }))

    return (
        <Animated.View
            style={[
                faqStyles.item,
                !isLast && faqStyles.itemBorder,
                isOpen && faqStyles.itemActive,
            ]}
        >
            <Pressable
                onPress={() => {
                    LayoutAnimation.configureNext({
                        duration: 350,
                        update: { type: 'spring', springDamping: 0.8 },
                        create: { type: 'easeInEaseOut', property: 'opacity' },
                    })
                    onToggle()
                }}
                onPressIn={() => { pressAnim.value = withSpring(1) }}
                onPressOut={() => { pressAnim.value = withSpring(0) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                <Animated.View style={[faqStyles.question, pressStyle]}>
                    <Animated.View style={[faqStyles.qIconWrap, iconBgStyle]}>
                        <Ionicons
                            name="help-circle-outline"
                            size={16}
                            color={isOpen ? C.accent : C.primary}
                        />
                    </Animated.View>

                    <Text style={[faqStyles.qText, isOpen && faqStyles.qTextActive]} numberOfLines={3}>
                        {question}
                    </Text>

                    <Animated.View style={[faqStyles.chevron, chevronStyle]}>
                        <Ionicons
                            name="chevron-down"
                            size={16}
                            color={isOpen ? C.accent : C.textMuted}
                        />
                    </Animated.View>
                </Animated.View>
            </Pressable>

            {isOpen && (
                <View style={faqStyles.answer}>
                    <View style={faqStyles.answerBorder} />
                    <View style={faqStyles.answerContent}>
                        <Text style={faqStyles.aText}>{answer}</Text>
                    </View>
                </View>
            )}
        </Animated.View>
    )
}

const faqStyles = StyleSheet.create({
    item: {
        overflow: 'hidden',
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    itemActive: {
        backgroundColor: 'rgba(252, 209, 22, 0.04)',
    },
    question: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
    },
    qIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    qText: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.1,
        lineHeight: 19,
    },
    qTextActive: {
        color: C.primary,
    },
    chevron: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    answer: {
        flexDirection: 'row',
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 18,
        paddingTop: 4,
    },
    answerBorder: {
        width: 3,
        backgroundColor: C.accent,
        borderRadius: 2,
        marginRight: 14,
        marginLeft: 14,
    },
    answerContent: {
        flex: 1,
    },
    aText: {
        fontSize: 13,
        color: C.textSec,
        lineHeight: 20,
        fontWeight: '400',
    },
})

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : QUICK TOPIC PILL
═══════════════════════════════════════════════════════════ */

function QuickTopicPill({
    label, icon, active, onPress, count,
}: {
    label: string
    icon: keyof typeof Ionicons.glyphMap
    active: boolean
    onPress: () => void
    count: number
}) {
    const anim = useSharedValue(active ? 1 : 0)

    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 180 })
    }, [active])

    const pillStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            anim.value, [0, 1],
            [C.surface, C.primary]
        ),
        borderColor: interpolateColor(
            anim.value, [0, 1],
            [C.border, C.primary]
        ),
    }))

    const iconColor = active ? C.accent : C.textSec
    const textColor = active ? C.primaryText : C.textSec

    return (
        <Pressable onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.topicPill, pillStyle]}>
                <Ionicons name={icon} size={13} color={iconColor} />
                <Text style={[styles.topicText, { color: textColor }]}>
                    {label}
                </Text>
                <View style={[styles.topicCount, active && styles.topicCountActive]}>
                    <Text style={[styles.topicCountText, active && styles.topicCountTextActive]}>
                        {count}
                    </Text>
                </View>
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : FAQ
═══════════════════════════════════════════════════════════ */

export default function FAQScreen() {
    const insets = useSafeAreaInsets()
    const navigation = useNavigation<Nav>()
    const { t } = useLang()
    const [openId, setOpenId] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [searchFocused, setSearchFocused] = useState(false)
    const [activeTopic, setActiveTopic] = useState<string>('Tous')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const searchFocusAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

    }, [])

    useEffect(() => {
        searchFocusAnim.value = withSpring(searchFocused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [searchFocused])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const searchBarStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(searchFocusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: searchFocused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(searchFocusAnim.value, [0, 1], [0.04, 0.10]),
    }))

    /* ── Filtrage des FAQ ── */
    const filteredCategories = FAQ_DATA
        .filter(cat => activeTopic === 'Tous' || cat.category === activeTopic)
        .map(cat => ({
            ...cat,
            items: cat.items.filter(item =>
                !search.trim() ||
                t(item.q).toLowerCase().includes(search.toLowerCase()) ||
                t(item.a).toLowerCase().includes(search.toLowerCase())
            ),
        }))
        .filter(cat => cat.items.length > 0)

    const totalQuestions = FAQ_DATA.reduce((sum, cat) => sum + cat.items.length, 0)
    const filteredCount = filteredCategories.reduce((sum, cat) => sum + cat.items.length, 0)

    const topics = [
        { key: 'Tous', icon: 'apps-outline' as const, count: totalQuestions },
        ...FAQ_DATA.map(cat => ({
            key: cat.category,
            icon: cat.icon,
            count: cat.items.length,
        })),
    ]

    return (
        <View style={styles.container}>

            {/* NAV BAR */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                {/* Badge total questions */}
                <View style={styles.navCounter}>
                    <Ionicons name="help-circle" size={12} color={C.accent} />
                    <Text style={styles.navCounterText}>
                        {totalQuestions} {t('questions')}
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t("Centre d'aide")}</Text>
                    <Text style={styles.subtitle}>
                        {t('Trouvez rapidement les réponses à vos questions.')}
                    </Text>
                </Animated.View>

                {/* ═══ BARRE DE RECHERCHE PREMIUM ═══ */}
                <AnimatedSection delay={100}>
                    <Animated.View style={[styles.searchBar, searchBarStyle]}>
                        <Ionicons
                            name="search"
                            size={18}
                            color={searchFocused ? C.accent : C.placeholder}
                        />
                        <TextInput
                            style={styles.searchInput}
                            value={search}
                            onChangeText={setSearch}
                            onFocus={() => setSearchFocused(true)}
                            onBlur={() => setSearchFocused(false)}
                            placeholder={t('Rechercher une question…')}
                            placeholderTextColor={C.placeholder}
                            autoCapitalize="none"
                            returnKeyType="search"
                            selectionColor={C.accent}
                        />
                        {search.length > 0 && (
                            <Pressable
                                onPress={() => setSearch('')}
                                hitSlop={10}
                                style={styles.clearBtn}
                                accessibilityRole="button"
                                accessibilityLabel={t('Effacer')}
                            >
                                <Ionicons name="close-circle" size={18} color={C.textMuted} />
                            </Pressable>
                        )}
                    </Animated.View>
                </AnimatedSection>

                {/* ═══ FILTRES PAR CATÉGORIE ═══ */}
                <AnimatedSection delay={200}>
                    <View style={styles.filterTitleWrap}>
                        <Text style={styles.filterTitle}>{t('FILTRER PAR THÈME')}</Text>
                        <View style={styles.filterUnderline} />
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.topicsContent}
                    >
                        {topics.map(topic => (
                            <QuickTopicPill
                                key={topic.key}
                                label={t(topic.key)}
                                icon={topic.icon}
                                count={topic.count}
                                active={activeTopic === topic.key}
                                onPress={() => setActiveTopic(topic.key)}
                            />
                        ))}
                    </ScrollView>
                </AnimatedSection>

                {/* ═══ RÉSULTATS COUNT ═══ */}
                {(search.length > 0 || activeTopic !== 'Tous') && (
                    <AnimatedSection delay={250}>
                        <View style={styles.resultsCount}>
                            <Ionicons name="filter" size={12} color={C.accentDark} />
                            <Text style={styles.resultsCountText}>
                                {filteredCount} {filteredCount > 1 ? t('résultats') : t('résultat')}
                                {search.length > 0 && (
                                    <Text style={styles.resultsCountQuery}>
                                        {' '}{t('pour')} "{search}"
                                    </Text>
                                )}
                            </Text>
                        </View>
                    </AnimatedSection>
                )}

                {/* ═══ RÉSULTATS ═══ */}
                {filteredCategories.length === 0 ? (
                    <AnimatedSection delay={300}>
                        <View style={styles.noResult}>
                            <View style={styles.noResultIconWrap}>
                                <Ionicons name="search" size={32} color={C.accent} />
                            </View>
                            <Text style={styles.noResultTitle}>{t('Aucun résultat')}</Text>
                            <Text style={styles.noResultText}>
                                {t("Essayez avec d'autres mots-clés ou explorez les catégories.")}
                            </Text>
                            <View style={styles.noResultActions}>
                                {search.length > 0 && (
                                    <Pressable
                                        onPress={() => setSearch('')}
                                        style={styles.noResultBtn}
                                        accessibilityRole="button"
                                        hitSlop={6}
                                    >
                                        <Ionicons name="close-circle-outline" size={14} color={C.accentDark} />
                                        <Text style={styles.noResultBtnText}>
                                            {t('Effacer la recherche')}
                                        </Text>
                                    </Pressable>
                                )}
                                {activeTopic !== 'Tous' && (
                                    <Pressable
                                        onPress={() => setActiveTopic('Tous')}
                                        style={styles.noResultBtn}
                                        accessibilityRole="button"
                                        hitSlop={6}
                                    >
                                        <Ionicons name="apps-outline" size={14} color={C.accentDark} />
                                        <Text style={styles.noResultBtnText}>
                                            {t('Voir tout')}
                                        </Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    </AnimatedSection>
                ) : (
                    filteredCategories.map((cat, ci) => (
                        <AnimatedSection key={cat.category} delay={300 + ci * 80}>
                            {/* En-tête catégorie */}
                            <View style={styles.catHeader}>
                                <View style={styles.catIconWrap}>
                                    <Ionicons name={cat.icon} size={16} color={C.accent} />
                                </View>
                                <Text style={styles.catTitle}>{t(cat.category)}</Text>
                                <View style={styles.catCount}>
                                    <Text style={styles.catCountText}>{cat.items.length}</Text>
                                </View>
                            </View>

                            {/* Items */}
                            <View style={styles.catCard}>
                                {cat.items.map((item, ii) => {
                                    const id = `${cat.category}-${ii}`
                                    const isOpen = openId === id
                                    return (
                                        <FaqItem
                                            key={ii}
                                            question={t(item.q)}
                                            answer={t(item.a)}
                                            isOpen={isOpen}
                                            onToggle={() => setOpenId(isOpen ? null : id)}
                                            isLast={ii === cat.items.length - 1}
                                        />
                                    )
                                })}
                            </View>
                        </AnimatedSection>
                    ))
                )}

                {/* ═══ CARD CONTACT SUPPORT ═══ */}
                <AnimatedSection delay={500}>
                    <Pressable
                        onPress={() => {
                            // Navigation vers Appointments ou chat support
                            navigation.navigate('Appointments' as never)
                        }}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        <View style={styles.contactCard}>
                            {/* Halo doré */}
                            <View style={styles.contactGlow} />

                            <View style={styles.contactIconWrap}>
                                <Ionicons name="chatbubble-ellipses" size={22} color={C.accent} />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.contactBadge}>{t('SUPPORT DÉDIÉ')}</Text>
                                <Text style={styles.contactTitle}>
                                    {t("Pas trouvé votre réponse ?")}
                                </Text>
                                <Text style={styles.contactText}>
                                    {t('Notre équipe vous répond sous 24h.')}
                                </Text>
                            </View>

                            <View style={styles.contactArrow}>
                                <Ionicons name="arrow-forward" size={16} color={C.accent} />
                            </View>
                        </View>
                    </Pressable>
                </AnimatedSection>

                {/* ═══ AUTRES CANAUX DE SUPPORT ═══ */}
                <AnimatedSection delay={600}>
                    <View style={styles.channelsTitleWrap}>
                        <Text style={styles.channelsTitle}>{t('AUTRES CANAUX')}</Text>
                        <View style={styles.channelsUnderline} />
                    </View>

                    <View style={styles.channels}>
                        <Pressable style={styles.channelCard} onPress={() => Linking.openURL('mailto:contact@retourgagnantbenin.bj')}
                            accessibilityRole="button"
                            hitSlop={6}>
                            <View style={styles.channelIconWrap}>
                                <Ionicons name="mail-outline" size={18} color={C.primary} />
                            </View>
                            <Text style={styles.channelLabel}>{t('Email')}</Text>
                            <Text style={styles.channelValue} numberOfLines={1}>
                                contact@retourgagnantbenin.bj
                            </Text>
                        </Pressable>

                        <Pressable style={styles.channelCard} onPress={() => Linking.openURL('https://wa.me/2290160322121')}
                            accessibilityRole="button"
                            hitSlop={6}>
                            <View style={styles.channelIconWrap}>
                                <Ionicons name="logo-whatsapp" size={18} color={C.success} />
                            </View>
                            <Text style={styles.channelLabel}>WhatsApp</Text>
                            <Text style={styles.channelValue}>
                                +229 01 60 32 21 21
                            </Text>
                        </Pressable>

                        <Pressable style={styles.channelCard} onPress={() => Linking.openURL('tel:+2290160322121')}
                            accessibilityRole="button"
                            hitSlop={6}>
                            <View style={styles.channelIconWrap}>
                                <Ionicons name="call-outline" size={18} color={C.info} />
                            </View>
                            <Text style={styles.channelLabel}>{t('Téléphone')}</Text>
                            <Text style={styles.channelValue}>
                                +229 01 60 32 21 21
                            </Text>
                        </Pressable>
                    </View>
                </AnimatedSection>

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    navCounterText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Search Bar ── */
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 16,
        borderWidth: 1.5,
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 20,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: C.primary,
        fontWeight: '500',
    },
    clearBtn: {
        padding: 2,
    },

    /* ── Filter title ── */
    filterTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    filterTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    filterUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },

    /* ── Topics ── */
    topicsContent: {
        gap: 8,
        paddingRight: 20,
        paddingVertical: 4,
        marginBottom: 18,
    },
    topicPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1.2,
    },
    topicText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    topicCount: {
        minWidth: 18,
        height: 16,
        paddingHorizontal: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 135, 81, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topicCountActive: {
        backgroundColor: C.accent,
    },
    topicCountText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.textSec,
    },
    topicCountTextActive: {
        color: C.primary,
    },

    /* ── Results count ── */
    resultsCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.08)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 16,
        alignSelf: 'flex-start',
    },
    resultsCountText: {
        fontSize: 12,
        color: C.accentDark,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    resultsCountQuery: {
        fontWeight: '500',
        color: C.textSec,
    },

    /* ── No result ── */
    noResult: {
        backgroundColor: C.surface,
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        borderStyle: 'dashed',
        gap: 10,
        marginTop: 12,
    },
    noResultIconWrap: {
        width: 76,
        height: 76,
        borderRadius: 22,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1.2,
        borderColor: C.border,
    },
    noResultTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
    },
    noResultText: {
        fontSize: 13,
        color: C.textSec,
        textAlign: 'center',
        lineHeight: 18,
        fontWeight: '400',
        marginBottom: 8,
    },
    noResultActions: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    noResultBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.border,
    },
    noResultBtnText: {
        color: C.accentDark,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Catégorie ── */
    catHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        marginTop: 14,
        paddingHorizontal: 4,
    },
    catIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    catTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
    },
    catCount: {
        minWidth: 22,
        height: 18,
        paddingHorizontal: 6,
        borderRadius: 9,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    catCountText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primary,
    },
    catCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 8,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },

    /* ── Contact Card ── */
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginTop: spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
    },
    contactGlow: { display: 'none' },
    contactIconWrap: {
        width: 50,
        height: 50,
        borderRadius: 16,
        backgroundColor: 'rgba(252, 209, 22, 0.15)',
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    contactTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: -0.2,
    },
    contactText: {
        fontSize: 12,
        color: C.textMuted,
        marginTop: 3,
        fontWeight: '500',
    },
    contactArrow: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(252, 209, 22, 0.15)',
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* ── Autres canaux ── */
    channelsTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 28,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    channelsTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
    },
    channelsUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    channels: {
        flexDirection: 'row',
        gap: 10,
    },
    channelCard: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    channelIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.08)',
    },
    channelLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: 0.2,
        marginBottom: 3,
    },
    channelValue: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
})