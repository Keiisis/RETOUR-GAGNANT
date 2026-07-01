'use strict'
import React, { useState, useEffect } from 'react'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Platform, Linking, Pressable, Dimensions,
    LayoutAnimation, UIManager,
} from 'react-native'
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
import { useLang } from '../../contexts/LangContext'

/* ═══════════════════════════════════════════════════════════
   LegalScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
const C = {
    bg: '#F8F9FA',
    surface: 'rgba(255, 255, 255, 0.85)',
    surfaceSolid: '#FFFFFF',
    border: '#E2E8F0',

    primary: '#047857',
    primaryDark: '#022C22',
    accent: '#C9A84C',
    accentDark: '#A68B3C',
    accentLight: '#E2C97E',
    auraGreen: '#10B981',
    error: '#EF4444',
    success: '#10B981',
    info: '#3B82F6',

    textSec: '#64748B',
    textMuted: '#94A3B8',
    placeholder: '#94A3B8',
    primaryText: '#FFFFFF',
}

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
            ['rgba(13, 43, 78, 0.06)', C.primary]
        ),
        borderColor: interpolateColor(
            anim.value, [0, 1],
            ['rgba(13, 43, 78, 0.08)', C.accent]
        ),
    }))

    const numberTextStyle = useAnimatedStyle(() => ({
        color: interpolateColor(anim.value, [0, 1], [C.primary, C.accent]),
    }))

    const pressStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressAnim.value, [0, 1],
            ['rgba(13, 43, 78, 0)', 'rgba(13, 43, 78, 0.03)']
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
                        <Ionicons
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
        backgroundColor: 'rgba(212, 160, 23, 0.04)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 12,
    },
    numberBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    numberText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    heading: {
        flex: 1,
        fontSize: 13.5,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.1,
        lineHeight: 18,
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
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 18,
        paddingTop: 4,
    },
    bodyBorder: {
        width: 3,
        backgroundColor: C.accent,
        borderRadius: 2,
        marginRight: 14,
        marginLeft: 14,
    },
    bodyContent: {
        flex: 1,
    },
    bodyText: {
        fontSize: 12.5,
        color: C.textSec,
        lineHeight: 19,
        fontWeight: '400',
    },
})

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : TOC PILL (Table of Contents)
═══════════════════════════════════════════════════════════ */

function TocPill({
    label, icon, active, onPress,
}: {
    label: string
    icon: keyof typeof Ionicons.glyphMap
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
        <Pressable onPress={onPress} style={{ flex: 1 }}>
            <Animated.View style={[styles.tocPill, pillStyle]}>
                <Ionicons name={icon} size={15} color={active ? C.accent : C.textSec} />
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
    const { t } = useLang()
    const [openId, setOpenId] = useState<string | null>('cgu-0') // Première section ouverte par défaut
    const [activeSection, setActiveSection] = useState<'cgu' | 'privacy'>('cgu')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)
    const aura1Y = useSharedValue(0)
    const aura2X = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })

        aura1Y.value = withRepeat(
            withSequence(
                withTiming(25, { duration: 6000, easing: Easing.inOut(Easing.quad) }),
                withTiming(-10, { duration: 6000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
        aura2X.value = withRepeat(
            withSequence(
                withTiming(-30, { duration: 7000, easing: Easing.inOut(Easing.quad) }),
                withTiming(15, { duration: 7000, easing: Easing.inOut(Easing.quad) })
            ), -1, true
        )
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))
    const aura1Style = useAnimatedStyle(() => ({ transform: [{ translateY: aura1Y.value }] }))
    const aura2Style = useAnimatedStyle(() => ({ transform: [{ translateX: aura2X.value }] }))

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
            {/* 🎨 BACKGROUND PREMIUM : Auras */}
            <Animated.View style={[styles.aura, styles.aura1, aura1Style]} />
            <Animated.View style={[styles.aura, styles.aura2, aura2Style]} />

            {/* NAV BAR */}
            <View style={styles.navBar}>
                <Pressable onPress={() => navigation.goBack()} style={styles.navBack}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <Ionicons name="shield-checkmark" size={12} color={C.accent} />
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
                    <Text style={styles.title}>{t('Cadre')}</Text>
                    <Text style={styles.titleHighlight}>{t('légal.')}</Text>
                    <Text style={styles.subtitle}>
                        {t("Conditions d'utilisation et politique de confidentialité de Retour Gagnant Bénin.")}
                    </Text>
                </Animated.View>

                {/* ═══ DOCUMENT HERO BADGE ═══ */}
                <AnimatedSection delay={100}>
                    <View style={styles.documentBadge}>
                        <View style={styles.docBadgeIcon}>
                            <Ionicons name="document-text-outline" size={20} color={C.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.docBadgeTitle}>{t('Document officiel')}</Text>
                            <Text style={styles.docBadgeText}>
                                {t('Mai 2026 · Version 1.0 · RGB SARL')}
                            </Text>
                        </View>
                        <View style={styles.docCheckmark}>
                            <Ionicons name="checkmark" size={14} color={C.success} />
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
                            <Ionicons name={currentSection.icon} size={18} color={C.accent} />
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
                            <Ionicons name="shield-checkmark" size={11} color={C.accent} />
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
                        >
                            <Ionicons name="mail" size={16} color={C.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.contactBtnText} numberOfLines={1}>
                                contact@retourgagnantbenin.bj
                            </Text>
                            <Ionicons name="arrow-forward" size={14} color={C.primary} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </View>
                </AnimatedSection>

                {/* ═══ INFO SÉCURITÉ ═══ */}
                <AnimatedSection delay={500}>
                    <View style={styles.securityGrid}>
                        <View style={styles.securityCard}>
                            <View style={styles.securityIconWrap}>
                                <Ionicons name="lock-closed" size={16} color={C.success} />
                            </View>
                            <Text style={styles.securityLabel}>{t('CHIFFREMENT')}</Text>
                            <Text style={styles.securityValue}>TLS/SSL 256-bit</Text>
                        </View>

                        <View style={styles.securityCard}>
                            <View style={styles.securityIconWrap}>
                                <Ionicons name="server-outline" size={16} color={C.info} />
                            </View>
                            <Text style={styles.securityLabel}>{t('HÉBERGEMENT')}</Text>
                            <Text style={styles.securityValue}>{t('Certifié UE')}</Text>
                        </View>

                        <View style={styles.securityCard}>
                            <View style={styles.securityIconWrap}>
                                <Ionicons name="key-outline" size={16} color={C.accent} />
                            </View>
                            <Text style={styles.securityLabel}>{t('AUTH')}</Text>
                            <Text style={styles.securityValue}>{t('Tokens chiffrés')}</Text>
                        </View>
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

    /* ── Auras Corporate ── */
    aura: {
        position: 'absolute',
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width,
        opacity: 0.05,
    },
    aura1: {
        top: -100,
        right: -100,
        backgroundColor: C.primary,
    },
    aura2: {
        bottom: 50,
        left: -100,
        backgroundColor: C.auraGreen,
    },

    /* ── Nav Bar ── */
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 10,
        zIndex: 10,
    },
    navBack: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    navCounterText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    scroll: {
        paddingHorizontal: 20,
        paddingBottom: 30,
    },

    /* ── Header ── */
    headerContainer: {
        marginTop: 8,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 38,
        fontWeight: '700',
        color: C.primary,
        letterSpacing: -0.5,
    },
    titleHighlight: {
        fontSize: 38,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: -0.5,
        marginTop: -4,
    },
    subtitle: {
        fontSize: 15,
        color: C.textSec,
        marginTop: 14,
        lineHeight: 22,
        fontWeight: '400',
    },

    /* ── Document Badge ── */
    documentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 20,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    docBadgeIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    docBadgeTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.1,
        marginBottom: 3,
    },
    docBadgeText: {
        fontSize: 11.5,
        color: C.textSec,
        fontWeight: '500',
    },
    docCheckmark: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(10, 107, 59, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(10, 107, 59, 0.3)',
    },

    /* ── TOC ── */
    tocTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    tocTitle: {
        fontSize: 11,
        fontWeight: '800',
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
        gap: 8,
        marginBottom: 24,
    },
    tocPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.2,
    },
    tocText: {
        fontSize: 12.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Section Header ── */
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    sectionIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 160, 23, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.25)',
    },
    sectionBadge: {
        fontSize: 10,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
        lineHeight: 22,
    },
    sectionIntro: {
        fontSize: 12.5,
        color: C.textSec,
        fontWeight: '400',
        lineHeight: 18,
        marginBottom: 14,
        paddingHorizontal: 4,
        fontStyle: 'italic',
    },

    /* ── Clause Card ── */
    clauseCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 24,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },

    /* ── Contact Card (Bleu massif) ── */
    contactCard: {
        backgroundColor: C.primary,
        borderRadius: 22,
        padding: 22,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 160, 23, 0.35)',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        position: 'relative',
    },
    contactGlow: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: C.accent,
        opacity: 0.15,
    },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 160, 23, 0.18)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(212, 160, 23, 0.4)',
        marginBottom: 14,
    },
    contactBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.2,
    },
    contactTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: -0.4,
        marginBottom: 8,
        lineHeight: 24,
    },
    contactText: {
        fontSize: 12.5,
        color: 'rgba(255, 255, 255, 0.75)',
        fontWeight: '400',
        lineHeight: 18,
        marginBottom: 18,
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        backgroundColor: C.accent,
        borderRadius: 14,
        paddingHorizontal: 18,
        shadowColor: C.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    contactBtnText: {
        color: C.primary,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.2,
    },

    /* ── Security Grid ── */
    securityGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 28,
    },
    securityCard: {
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
    securityIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(13, 43, 78, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(13, 43, 78, 0.08)',
    },
    securityLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1,
        marginBottom: 3,
    },
    securityValue: {
        fontSize: 11,
        color: C.primary,
        fontWeight: '700',
        letterSpacing: 0.2,
        textAlign: 'center',
    },

    /* ── Footer ── */
    footerWrap: {
        alignItems: 'center',
        marginTop: 10,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
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
        fontSize: 14,
        color: C.primary,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    footerLocation: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '600',
        marginTop: 3,
    },
    footerVersion: {
        fontSize: 11,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 10,
        letterSpacing: 0.2,
    },
    footerRights: {
        fontSize: 10.5,
        color: C.textMuted,
        fontWeight: '500',
        marginTop: 4,
        letterSpacing: 0.3,
    },
})