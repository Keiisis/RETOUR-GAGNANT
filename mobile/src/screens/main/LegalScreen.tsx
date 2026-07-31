'use strict'
import React, { useState, useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, Linking, Pressable, Dimensions,
    LayoutAnimation, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
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
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   LegalScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

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
   COMPOSANT : CLAUSE ITEM (Accordéon animé)
═══════════════════════════════════════════════════════════ */

function ClauseItem({
    number, heading, text, isOpen, onToggle, isLast,
}: {
    number: string
    heading: string
    text: string
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

    const numberStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            anim.value, [0, 1],
            ['rgba(0, 135, 81, 0.06)', C.primary]
        ),
        borderColor: interpolateColor(
            anim.value, [0, 1],
            ['rgba(0, 135, 81, 0.08)', C.accent]
        ),
    }))

    const numberTextStyle = useAnimatedStyle(() => ({
        color: interpolateColor(anim.value, [0, 1], [C.primary, C.accent]),
    }))

    const pressStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressAnim.value, [0, 1],
            ['rgba(0, 135, 81, 0)', 'rgba(0, 135, 81, 0.03)']
        ),
    }))

    return (
        <View
            style={[
                clauseStyles.item,
                !isLast && clauseStyles.itemBorder,
                isOpen && clauseStyles.itemActive,
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
                <Animated.View style={[clauseStyles.header, pressStyle]}>
                    <Animated.View style={[clauseStyles.numberBadge, numberStyle]}>
                        <Animated.Text style={[clauseStyles.numberText, numberTextStyle]}>
                            {number}
                        </Animated.Text>
                    </Animated.View>

                    <Text style={[clauseStyles.heading, isOpen && clauseStyles.headingActive]} numberOfLines={2}>
                        {heading}
                    </Text>

                    <Animated.View style={[clauseStyles.chevron, chevronStyle]}>
                        <LucideIcon
                            name="chevron-down"
                            size={16}
                            color={isOpen ? C.accent : C.textMuted}
                        />
                    </Animated.View>
                </Animated.View>
            </Pressable>

            {isOpen && (
                <View style={clauseStyles.body}>
                    <View style={clauseStyles.bodyBorder} />
                    <View style={clauseStyles.bodyContent}>
                        <Text style={clauseStyles.bodyText}>{text}</Text>
                    </View>
                </View>
            )}
        </View>
    )
}

const clauseStyles = StyleSheet.create({
    item: {
        overflow: 'hidden',
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    itemActive: {
        backgroundColor: C.accentSoft,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: 12,
    },
    numberBadge: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    numberText: {
        ...typography.button, fontSize: 12,
                letterSpacing: 0.2,
    },
    heading: {
        flex: 1,
        ...typography.button, fontSize: 13.5,
                color: C.primary,
        letterSpacing: -0.1,
    },
    headingActive: {
        color: C.primary,
    },
    chevron: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        flexDirection: 'row',
        paddingLeft: spacing.md,
        paddingRight: spacing.md,
        paddingBottom: spacing.md,
        paddingTop: spacing.xs,
    },
    bodyBorder: {
        width: 3,
        backgroundColor: C.accent,
        borderRadius: 2,
        marginRight: spacing.md,
        marginLeft: spacing.md,
    },
    bodyContent: {
        flex: 1,
    },
    bodyText: {
        ...typography.label, fontSize: 12.5,
        color: C.textSec,
            },
})

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : TOC PILL (Table of Contents)
═══════════════════════════════════════════════════════════ */

function TocPill({
    label, icon, active, onPress,
}: {
    label: string
    icon: string
    active: boolean
    onPress: () => void
}) {
    const anim = useSharedValue(active ? 1 : 0)

    useEffect(() => {
        anim.value = withSpring(active ? 1 : 0, { damping: 18, stiffness: 180 })
    }, [active])

    const pillStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(anim.value, [0, 1], [C.surface, C.primary]),
        borderColor: interpolateColor(anim.value, [0, 1], [C.border, C.primary]),
    }))

    return (
        <Pressable onPress={onPress} style={{ flex: 1 }}
            accessibilityRole="button"
            hitSlop={6}>
            <Animated.View style={[styles.tocPill, pillStyle]}>
                <LucideIcon name={icon} size={15} color={active ? C.accent : C.textSec} />
                <Text style={[
                    styles.tocText,
                    { color: active ? C.primaryText : C.textSec },
                ]} numberOfLines={1}>
                    {label}
                </Text>
            </Animated.View>
        </Pressable>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : LEGAL
═══════════════════════════════════════════════════════════ */

export default function LegalScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const [openId, setOpenId] = useState<string | null>('cgu-0') // Première section ouverte par défaut
    const [activeSection, setActiveSection] = useState<'cgu' | 'privacy'>('cgu')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    const sections = [
        {
            key: 'cgu',
            title: t("Conditions Générales d'Utilisation"),
            shortTitle: t('CGU'),
            icon: 'document-text' as const,
            badge: t('CGU'),
            content: [
                {
                    heading: t('Objet'),
                    text: t('Les présentes Conditions Générales d\'Utilisation (CGU) régissent l\'accès et l\'utilisation de l\'application mobile "Retour Gagnant Bénin" (ci-après "l\'Application"), éditée par RGB SARL, immatriculée au Bénin. L\'utilisation de l\'Application implique l\'acceptation pleine et entière des présentes CGU.'),
                },
                {
                    heading: t('Services proposés'),
                    text: t("L'Application propose des services d'accompagnement administratif et juridique pour les diasporas béninoises, incluant : constitution de dossiers de nationalité, recherche ancestrale, suivi de dossiers en cours, messagerie avec notre équipe d'agents, boutique d'articles culturels et artisanaux, gestion de rendez-vous et événements communautaires."),
                },
                {
                    heading: t('Inscription et compte'),
                    text: t("L'accès aux services nécessite la création d'un compte personnel. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Tout usage frauduleux du compte pourra entraîner sa suspension immédiate."),
                },
                {
                    heading: t('Paiements'),
                    text: t('Les paiements sont traités via la plateforme sécurisée Kkiapay (Mobile Money, cartes bancaires). Les tarifs sont indiqués en FCFA. Toute prestation commandée et payée est soumise aux conditions de remboursement spécifiques à chaque service, détaillées lors de la commande.'),
                },
                {
                    heading: t('Responsabilité'),
                    text: t('RGB SARL s\'engage à fournir ses services avec diligence. Toutefois, l\'Application est fournie "en l\'état". RGB SARL ne saurait être tenue responsable des interruptions techniques, des retards administratifs indépendants de sa volonté, ou de l\'usage fait par l\'utilisateur des informations fournies.'),
                },
                {
                    heading: t('Propriété intellectuelle'),
                    text: t("L'ensemble des contenus de l'Application (textes, images, logos, design) sont la propriété exclusive de RGB SARL et sont protégés par les lois sur la propriété intellectuelle. Toute reproduction non autorisée est strictement interdite."),
                },
                {
                    heading: t('Droit applicable'),
                    text: t('Les présentes CGU sont régies par le droit béninois. En cas de litige, les tribunaux de Cotonou seront seuls compétents, après tentative de résolution amiable.'),
                },
            ],
        },
        {
            key: 'privacy',
            title: t('Politique de Confidentialité'),
            shortTitle: t('Confidentialité'),
            icon: 'shield-checkmark' as const,
            badge: t('RGPD'),
            content: [
                {
                    heading: t('Données collectées'),
                    text: t("Nous collectons les données suivantes : nom, prénom, adresse e-mail, numéro de téléphone, ville et pays de résidence, photo de profil (optionnelle), documents administratifs téléversés dans le cadre de votre dossier, historique de paiements et de commandes, messages échangés avec notre équipe."),
                },
                {
                    heading: t('Finalité du traitement'),
                    text: t("Vos données sont utilisées exclusivement pour : la gestion de votre compte et de vos dossiers, la communication avec notre équipe d'agents, le traitement de vos paiements et commandes, l'envoi de notifications relatives à vos démarches, l'amélioration de nos services."),
                },
                {
                    heading: t('Partage des données'),
                    text: t('Vos données personnelles ne sont jamais vendues à des tiers. Elles peuvent être partagées avec : nos agents internes habilités au traitement de vos dossiers, nos prestataires de paiement agréés dans le cadre strict du traitement des transactions, les autorités béninoises compétentes dans le cadre des démarches administratives que vous avez initiées.'),
                },
                {
                    heading: t('Sécurité'),
                    text: t('Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées : chiffrement des données en transit (TLS/SSL), stockage sécurisé auprès d\'un hébergeur certifié, authentification sécurisée, accès restreint aux données selon le principe du moindre privilège.'),
                },
                {
                    heading: t('Conservation'),
                    text: t("Vos données sont conservées pendant toute la durée de votre utilisation de l'Application, puis pendant une durée de 5 ans après la clôture de votre compte, conformément aux obligations légales en vigueur au Bénin."),
                },
                {
                    heading: t('Vos droits'),
                    text: t("Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous à : contact@retourgagnantbenin.bj. Nous nous engageons à répondre dans un délai de 30 jours."),
                },
                {
                    heading: t('Cookies et traceurs'),
                    text: t("L'Application n'utilise pas de cookies. Des identifiants techniques peuvent être utilisés pour le bon fonctionnement du service (tokens de session, push notification tokens)."),
                },
            ],
        },
    ]

    const currentSection = sections.find(s => s.key === activeSection)!

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
                        <LucideIcon name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <LucideIcon name="shield-checkmark" size={12} color={C.accent} />
                    <Text style={styles.navCounterText}>
                        {t('Officiel')}
                    </Text>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* HEADER TITRE */}
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Cadre légal')}</Text>
                    <Text style={styles.subtitle}>
                        {t("Conditions d'utilisation et politique de confidentialité de Retour Gagnant Bénin.")}
                    </Text>
                </Animated.View>

                {/* ═══ DOCUMENT HERO BADGE ═══ */}
                <AnimatedSection delay={100}>
                    <View style={styles.documentBadge}>
                        <View style={styles.docBadgeIcon}>
                            <LucideIcon name="document-text-outline" size={20} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.docBadgeTitle}>{t('Document officiel')}</Text>
                            <Text style={styles.docBadgeText}>
                                {t('Mai 2026 · Version 1.0 · RGB SARL')}
                            </Text>
                        </View>
                        <View style={styles.docCheckmark}>
                            <LucideIcon name="checkmark" size={14} color={C.success} />
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ TABLE OF CONTENTS ═══ */}
                <AnimatedSection delay={200}>
                    <View style={styles.tocTitleWrap}>
                        <Text style={styles.tocTitle}>{t('NAVIGATION')}</Text>
                        <View style={styles.tocUnderline} />
                    </View>

                    <View style={styles.tocRow}>
                        {sections.map(section => (
                            <TocPill
                                key={section.key}
                                label={section.shortTitle}
                                icon={section.icon}
                                active={activeSection === section.key}
                                onPress={() => {
                                    setActiveSection(section.key as 'cgu' | 'privacy')
                                    setOpenId(`${section.key}-0`) // Ouvre le premier item
                                }}
                            />
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ SECTION ACTIVE ═══ */}
                <AnimatedSection delay={300}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionIconWrap}>
                            <LucideIcon name={currentSection.icon} size={18} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.sectionBadge}>{currentSection.badge}</Text>
                            <Text style={styles.sectionTitle}>{currentSection.title}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionIntro}>
                        {currentSection.key === 'cgu'
                            ? t('Touchez chaque article pour découvrir son contenu détaillé.')
                            : t('Vos données personnelles sont protégées selon les standards internationaux.')}
                    </Text>

                    <View style={styles.clauseCard}>
                        {currentSection.content.map((item, ii) => {
                            const id = `${currentSection.key}-${ii}`
                            const isOpen = openId === id
                            const num = String(ii + 1).padStart(2, '0')
                            return (
                                <ClauseItem
                                    key={ii}
                                    number={num}
                                    heading={item.heading}
                                    text={item.text}
                                    isOpen={isOpen}
                                    onToggle={() => setOpenId(isOpen ? null : id)}
                                    isLast={ii === currentSection.content.length - 1}
                                />
                            )
                        })}
                    </View>
                </AnimatedSection>

                {/* ═══ CARD CONTACT (Bleu massif premium) ═══ */}
                <AnimatedSection delay={400}>
                    <View style={styles.contactCard}>
                        <View style={styles.contactGlow} />

                        <View style={styles.contactBadge}>
                            <LucideIcon name="shield-checkmark" size={11} color={C.accent} />
                            <Text style={styles.contactBadgeText}>{t('VOS DROITS')}</Text>
                        </View>

                        <Text style={styles.contactTitle}>
                            {t('Une question sur vos données ?')}
                        </Text>
                        <Text style={styles.contactText}>
                            {t("Contactez notre équipe pour toute question relative à vos données personnelles ou à nos conditions d'utilisation. Réponse garantie sous 30 jours.")}
                        </Text>

                        <TouchableOpacity
                            style={styles.contactBtn}
                            activeOpacity={0.85}
                            onPress={() => Linking.openURL('mailto:contact@retourgagnantbenin.bj')}
                            accessibilityRole="button"
                            hitSlop={6}
                        >
                            <LucideIcon name="mail" size={16} color={C.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.contactBtnText} numberOfLines={1}>
                                contact@retourgagnantbenin.bj
                            </Text>
                            <LucideIcon name="arrow-forward" size={14} color={C.primary} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>
                </AnimatedSection>


                {/* ═══ FOOTER ═══ */}
                <AnimatedSection delay={600}>
                    <View style={styles.footerWrap}>
                        <View style={styles.footerDivider}>
                            <View style={styles.dividerLine} />
                            <View style={styles.dividerDot} />
                            <View style={styles.dividerLine} />
                        </View>
                        <Text style={styles.footerCompany}>RGB SARL</Text>
                        <Text style={styles.footerLocation}>Cotonou, Bénin</Text>
                        <Text style={styles.footerVersion}>
                            {t('Dernière mise à jour : Mai 2026')}
                        </Text>
                        <Text style={styles.footerRights}>
                            © {new Date().getFullYear()} · {t('Tous droits réservés')}
                        </Text>
                    </View>
                </AnimatedSection>
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
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    navCounterText: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.xl,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.sm,
    },
    title: { ...typography.h1, color: C.text },
    subtitle: {
        ...typography.body,
        color: C.textSec,
        marginTop: spacing.md,
            },

    /* ── Document Badge ── */
    documentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: C.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.gutter,
        ...shadows.card,
    },
    docBadgeIcon: {
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    docBadgeTitle: {
        ...typography.button, fontSize: 13,
                color: C.primary,
        letterSpacing: -0.1,
        marginBottom: spacing.xxs,
    },
    docBadgeText: {
        ...typography.caption,
        color: C.textSec,
            },
    docCheckmark: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },

    /* ── TOC ── */
    tocTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.sm,
        marginTop: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    tocTitle: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1.5,
    },
    tocUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },
    tocRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    tocPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
    },
    tocText: {
        ...typography.button, fontSize: 12.5,
                letterSpacing: 0.2,
    },

    /* ── Section Header ── */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    sectionIconWrap: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    sectionBadge: {
        ...typography.overline,
                color: C.accentDark,
        marginBottom: spacing.xxs,
    },
    sectionTitle: {
        ...typography.h3, fontSize: 18,
                color: C.primary,
        letterSpacing: -0.3,
    },
    sectionIntro: {
        ...typography.label, fontSize: 12.5,
        color: C.textSec,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
        fontStyle: 'italic',
    },

    /* ── Clause Card ── */
    clauseCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.lg,
        ...shadows.card,
    },

    /* ── Contact Card (Bleu massif) ── */
    contactCard: {
        backgroundColor: C.surfaceSoft,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.border,
    },
    contactGlow: { display: 'none' },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    contactBadgeText: {
        ...typography.button, fontSize: 12,
                color: C.accent,
        letterSpacing: 1.2,
    },
    contactTitle: {
        ...typography.h3, fontSize: 19,
                color: C.primaryText,
        letterSpacing: -0.4,
        marginBottom: spacing.sm,
    },
    contactText: {
        ...typography.label, fontSize: 12.5,
        color: C.textMuted,
        marginBottom: spacing.md,
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        backgroundColor: C.accent,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        ...shadows.card,
    },
    contactBtnText: {
        color: C.primary,
        ...typography.button, fontSize: 13,
                letterSpacing: 0.2,
    },

    /* ── Security Grid ── */

    /* ── Footer ── */
    footerWrap: {
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    dividerLine: {
        width: 40,
        height: 1,
        backgroundColor: C.accent,
        opacity: 0.4,
    },
    dividerDot: {
        width: 6,
        height: 6,
        backgroundColor: C.accent,
        transform: [{ rotate: '45deg' }],
    },
    footerCompany: {
        ...typography.button, fontSize: 14,
        color: C.primary,
                letterSpacing: -0.2,
    },
    footerLocation: {
        ...typography.caption,
        color: C.textSec,
                marginTop: spacing.xxs,
    },
    footerVersion: {
        ...typography.caption,
        color: C.textMuted,
                marginTop: spacing.sm,
        letterSpacing: 0.2,
    },
    footerRights: {
        ...typography.caption,
        color: C.textMuted,
                marginTop: spacing.xs,
        letterSpacing: 0.3,
    },
})