'use strict'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, Pressable,
    Platform, ActivityIndicator, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ArrowLeft, Calendar, Check, Clock, CreditCard, Star, Tag, Users,
    Sparkles, ShieldCheck, Award, ChevronRight, Zap, FileText, Send,
} from 'lucide-react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withDelay,
    withSequence,
    Easing,
    interpolate,
    Extrapolation,
    useAnimatedScrollHandler,
    interpolateColor,
} from 'react-native-reanimated'
import { colors as themeColors, spacing, radius, shadows, typography, fonts, motion, screenColors } from '../../config/theme'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { getServiceMode, MODE_COPY } from '../../lib/service-mode'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const { width: SCREEN_W } = Dimensions.get('window')

/* ═══════════════════════════════════════════════════════════
   CORPORATE PREMIUM 2026 — Palette signature
═══════════════════════════════════════════════════════════ */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

interface PricingOption { label: string; price: string }

/* ═══════════════════════════════════════════════════════════
   ANIMATED SECTION — fade + slide staggered
═══════════════════════════════════════════════════════════ */
const AnimatedSection = ({ children, delay = 0, style }: any) => {
    const o = useSharedValue(0)
    const y = useSharedValue(24)
    useEffect(() => {
        o.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))
        y.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 120 }))
    }, [o, y, delay])
    const s = useAnimatedStyle(() => ({
        opacity: o.value,
        transform: [{ translateY: y.value }],
    }))
    return <Animated.View style={[s, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   INTERACTIVE BUTTON — press feedback premium
═══════════════════════════════════════════════════════════ */
const InteractiveButton = ({ children, onPress, style, disabled, accessibilityLabel }: any) => {
    const scale = useSharedValue(1)
    const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
    return (
        <Animated.View style={[s]}>
            <Pressable
                disabled={disabled}
                onPressIn={() => { scale.value = withSpring(0.97, { damping: 18, stiffness: 320 }) }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }) }}
                onPress={onPress}
                accessibilityLabel={accessibilityLabel}
                style={style}
                accessibilityRole="button"
                hitSlop={6}
            >
                {children}
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   HERO SERVICE — gradient bleu nuit + shimmer or + icône premium
═══════════════════════════════════════════════════════════ */
const ServiceHero = ({ icon, title, subtitle, accent, onBack, t }: any) => {
    const insets = useSafeAreaInsets()
    const shine = useSharedValue(-1)
    const iconScale = useSharedValue(0.6)
    const iconRotate = useSharedValue(-12)
    const badgePulse = useSharedValue(1)

    useEffect(() => {
        shine.value = withTiming(1, { duration: 600 })
        iconScale.value = withSpring(1, { damping: 10, stiffness: 110 })
        iconRotate.value = withSpring(0, { damping: 12, stiffness: 90 })
        badgePulse.value = withTiming(1, { duration: 600 })
    }, [shine, iconScale, iconRotate, badgePulse])

    const shineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(shine.value, [-1, 1], [-SCREEN_W, SCREEN_W]) }],
        opacity: interpolate(shine.value, [-1, 0, 1], [0, 0.7, 0]),
    }))

    const iconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: iconScale.value },
            { rotate: `${iconRotate.value}deg` },
        ],
    }))

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgePulse.value }],
    }))

    return (
        <View style={[hero.wrap, { paddingTop: insets.top + 20 }]}>
            <LinearGradient
                colors={[C.primary, C.primaryLight, C.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />


            {/* Shimmer doré qui balaye */}
            <Animated.View style={[hero.shine, shineStyle]} pointerEvents="none">
                <LinearGradient
                    colors={['transparent', 'rgba(212,160,23,0.35)', 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>

            {/* Back */}
            <InteractiveButton onPress={onBack} accessibilityLabel={t('Retour')} style={hero.backBtn}>
                <View style={hero.backCircle}>
                    <ArrowLeft size={20} color="#FFF" strokeWidth={2.2} />
                </View>
            </InteractiveButton>

            {/* Badge premium */}
            <Animated.View style={[hero.premiumBadge, badgeStyle]}>
                <Sparkles size={11} color={C.gold} fill={C.gold} strokeWidth={0} />
                <Text style={hero.premiumBadgeText}>{t('Service Premium')}</Text>
            </Animated.View>

            {/* Cercle d'icône doré */}
            <Animated.View style={[hero.iconRing, iconStyle]}>
                <LinearGradient
                    colors={[C.gold, C.goldSoft]}
                    style={hero.iconRingGradient}
                >
                    <View style={hero.iconInner}>
                        <Ionicons name={icon || 'briefcase-outline'} size={42} color={C.primary} />
                    </View>
                </LinearGradient>
            </Animated.View>

            {/* Titre + sous-titre */}
            <Text style={hero.title} numberOfLines={2}>{t(title || 'Détails du Service')}</Text>
            {subtitle ? (
                <Text style={hero.subtitle} numberOfLines={2}>{t(subtitle)}</Text>
            ) : null}

            {/* Diviseur doré */}
            <View style={hero.divider}>
                <View style={hero.dividerLine} />
                <Star size={10} color={C.gold} fill={C.gold} strokeWidth={0} />
                <View style={hero.dividerLine} />
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function ServiceDetailsScreen({ route, navigation }: any) {
    const insets = useSafeAreaInsets()
    const {
        serviceId, title, subtitle, desc, fullDescription,
        icon, duration: paramDuration, price: paramPrice, documents: paramDocuments,
        features: paramFeatures,
        pricing_options: paramPricingOptions,
    } = route.params || {}

    const { profile } = useAuth()
    const { t, lang, preloadTexts } = useLang()

    // Comment ce service se commande-t-il ? Avant, le bouton affichait
    // « Payer avec Kkiapay » sur TOUS les services, y compris ceux qui se
    // reservent sur rendez-vous ou s'etablissent sur devis. Voir lib/service-mode.
    const serviceMode = getServiceMode({ slug: serviceId })
    const modeCopy = MODE_COPY[serviceMode]
    const [loading, setLoading] = useState(false)
    const [showKkiapay, setShowKkiapay] = useState(false)

    /* ── Données dynamiques DB ── */
    const [dynamicPrice, setDynamicPrice] = useState<string | null>(null)
    const [dynamicPricingOptions, setDynamicPricingOptions] = useState<PricingOption[] | null>(null)
    const [dynamicFeatures, setDynamicFeatures] = useState<string[] | null>(null)
    const [dynamicDocuments, setDynamicDocuments] = useState<string[] | null>(null)
    const [dynamicDuration, setDynamicDuration] = useState<string | null>(null)

    useEffect(() => {
        if (!serviceId) return
        let cancelled = false
        const fetchServiceDetails = async () => {
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/services/${serviceId}`, { timeoutMs: 8000 })
                if (!res.ok) return
                const json = await res.json().catch(() => ({}))
                const data = json.service
                if (!data || cancelled) return
                if (data.price_display) setDynamicPrice(data.price_display)
                if (Array.isArray(data.pricing_options) && data.pricing_options.length > 0) setDynamicPricingOptions(data.pricing_options)
                if (Array.isArray(data.features) && data.features.length > 0) setDynamicFeatures(data.features)
                if (Array.isArray(data.documents) && data.documents.length > 0) setDynamicDocuments(data.documents)
                if (data.duration) setDynamicDuration(data.duration)
            } catch (e) {
                console.warn('[ServiceDetails] Fetch DB failed, using params fallback:', e)
            }
        }
        fetchServiceDetails()
        return () => { cancelled = true }
    }, [serviceId])

    const price = dynamicPrice ?? paramPrice
    const duration = dynamicDuration ?? paramDuration
    const features: string[] = dynamicFeatures ?? (paramFeatures?.length ? paramFeatures : [
        'Consultation initiale avec nos experts',
        'Analyse complète de votre dossier',
        'Accompagnement administratif personnalisé',
        'Suivi en temps réel via l\'application',
    ])
    const requiredDocs: string[] = dynamicDocuments ?? (paramDocuments?.length ? paramDocuments : [
        'Pièce d\'identité valide (passeport ou CNI)',
        'Justificatif selon le service demandé',
    ])
    const pricingOptions: PricingOption[] = dynamicPricingOptions ?? (paramPricingOptions?.length ? paramPricingOptions : [])

    /* ── Preload des textes pour traduction ── */
    useEffect(() => {
        if (lang === 'fr') return
        const texts: string[] = []
        if (title) texts.push(title)
        if (subtitle) texts.push(subtitle)
        if (fullDescription || desc) texts.push(fullDescription || desc)
        if (duration) texts.push(duration)
        if (price) texts.push(price)
        for (const f of features) if (f) texts.push(f)
        for (const d of requiredDocs) if (d) texts.push(d)
        for (const po of pricingOptions) {
            if (po.label) texts.push(po.label)
            if (po.price) texts.push(po.price)
        }
        texts.push(
            'Service Premium', 'Détails du Service', 'Délai moyen', 'Tarif',
            'Support', 'Dédié', 'Sur devis',
            'Pièces à fournir pour les afro-descendants', 'Ce que nous proposons',
            'Pack VIP Retour Gagnant',
            "Un accompagnement intégral en une seule journée — de l'état civil à la délivrance de votre passeport.",
            'Enrôlement État Civil', "Obtention de votre extrait de naissance certifié conforme auprès des autorités de l'état civil béninois.",
            "Carte d'Identité Personnelle (CIP A)", "Constitution du dossier et enrôlement biométrique pour votre titre d'identité officiel béninois.",
            'Passeport Express Jour-J', "Prise en charge prioritaire de votre demande de passeport biométrique — déposée et traitée le jour même.",
            'Tarification', 'Comment ça marche ?',
            'Commandez le service', 'Déposez vos documents', 'Suivi en temps réel', 'Résultat final',
            'Documents requis', 'Prêt à démarrer ?',
            'Réservez un créneau avec nos experts pour concrétiser votre projet.',
            MODE_COPY.booking.cta, MODE_COPY.appointment.cta, MODE_COPY.form.cta, MODE_COPY.shop.cta,
            MODE_COPY.booking.note, MODE_COPY.appointment.note, MODE_COPY.form.note, MODE_COPY.shop.note,
            'Premier appel de 15 min gratuit',
            'Paiement 100% sécurisé via Mobile Money ou Carte Bancaire.',
            'Non connecté', 'Veuillez vous connecter pour commander ce service.',
            'Garantie', 'Sécurisé', 'Confidentiel',
        )
        preloadTexts(texts)
    }, [lang])

    const featuresTitle = serviceId === 'passeport'
        ? t('Pièces à fournir pour les afro-descendants')
        : t('Ce que nous proposons')

    const initiateCheckout = useCallback(() => {
        if (!profile) {
            toast(t('Non connecté'), t('Veuillez vous connecter pour commander ce service.'))
            return
        }
        // Sur le site public, AUCUNE fiche service ne fait payer directement :
        // toutes proposent un rendez-vous. Seule la Consultation Fa encaisse,
        // via son ecran dedie (FaScreen), et la Nationalite via son formulaire.
        // On enregistre donc la demande, sans widget de paiement.
        createDossierViaApi(null, 0)
    }, [profile, price, serviceMode])

    const createDossierViaApi = async (transactionId: string | null, numericPrice: number) => {
        if (!profile?.id) {
            toast(t('Non connecté'), t('Veuillez vous connecter pour commander ce service.'))
            return
        }
        setLoading(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/dossiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    client_id: profile.id,
                    service_type: serviceId || title,
                    service_id: serviceId || null,
                    payment_tx_id: transactionId,
                    payment_amount: isNaN(numericPrice) ? 0 : numericPrice,
                    payment_currency: 'XOF',
                    notes: `Commande initiée via l'application mobile le ${new Date().toLocaleDateString('fr-FR')}${transactionId ? `\nTransaction: ${transactionId}` : ''}`,
                }),
            })
            const json = await res.json().catch(() => ({}))

            if (json.exists) {
                toast(
                        t('Dossier existant'),
                        t('Vous avez déjà un dossier en cours pour ce service. Consultez la section "Mon Dossier" pour suivre son avancement.'),
                        'warning',
                    )
                    navigation.goBack()
                return
            }

            if (!res.ok) {
                const msg = (json.error as string) || `Erreur ${res.status}`
                if (res.status === 402) {
                    toast(t('Paiement non confirmé'), t('Le paiement n\'a pas pu être vérifié auprès de Kkiapay. Si vous avez bien été débité, contactez le support avec la référence : ') + (transactionId || ''),)
                    return
                }
                throw new Error(msg)
            }

            toast(
                t('Demande enregistrée'),
                t(`Votre dossier pour "{title}" a été créé avec succès.\n\nNotre équipe vous contactera dans les 24 heures pour la suite.`, { title }),
                'success',
            )
            navigation.navigate('Dossier')
        } catch (e: any) {
            const msg = e.message || t('Erreur lors de la création du dossier')
            toast(t('Erreur'), msg)
        } finally {
            setLoading(false)
        }
    }

    const handlePaymentSuccess = async (transactionId: string) => {
        setShowKkiapay(false)
        const numericPrice = price ? parseFloat(price.toString().replace(/[^0-9.-]+/g, '')) : 0
        await createDossierViaApi(transactionId, numericPrice)
    }

    /* ── Scroll handler pour header fade ── */
    const scrollY = useSharedValue(0)
    const onScroll = useAnimatedScrollHandler({
        onScroll: e => { scrollY.value = e.contentOffset.y },
    })

    const stickyHeaderStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.value, [180, 260], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.value, [180, 260], [-12, 0], Extrapolation.CLAMP) }],
    }))

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[C.bg, C.bgDeep, C.bg]}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Sticky header (apparait au scroll) */}
            <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, stickyHeaderStyle]} pointerEvents="box-none">
                <LinearGradient
                    colors={['rgba(255,255,255,0.96)', 'rgba(255,255,255,0.86)']}
                    style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.stickyRow}>
                    <InteractiveButton onPress={() => navigation.goBack()} style={styles.stickyBack}>
                        <ArrowLeft size={20} color={C.primary} strokeWidth={2.2} />
                    </InteractiveButton>
                    <Text style={styles.stickyTitle} numberOfLines={1}>{t(title || 'Détails du Service')}</Text>
                    <View style={styles.stickyBack} />
                </View>
            </Animated.View>

            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* HERO */}
                <ServiceHero
                    icon={icon}
                    title={title}
                    subtitle={subtitle}
                    accent={C.gold}
                    onBack={() => navigation.goBack()}
                    t={t}
                />

                {/* CARTE PRINCIPALE */}
                <View style={styles.cardWrap}>

                    {/* DESCRIPTION */}
                    <AnimatedSection delay={80}>
                        <View style={styles.descCard}>
                            <Text style={styles.desc}>
                                {t(fullDescription || desc || 'Informations concernant ce service et accompagnement personnalisé.')}
                            </Text>
                        </View>
                    </AnimatedSection>

                    {/* INFOS CLÉS — 3 piliers premium */}
                    <AnimatedSection delay={140}>
                        <View style={styles.infoGrid}>
                            <InfoPill
                                icon={<Clock size={18} color={C.gold} strokeWidth={2} />}
                                label={t('Délai moyen')}
                                value={t(duration || '4–8 semaines')}
                            />
                            <InfoPill
                                icon={<Tag size={18} color={C.gold} strokeWidth={2} />}
                                label={t('Tarif')}
                                value={t(price || 'Sur devis')}
                            />
                            <InfoPill
                                icon={<Users size={18} color={C.gold} strokeWidth={2} />}
                                label={t('Support')}
                                value={t('Dédié')}
                            />
                        </View>
                    </AnimatedSection>

                    {/* TRUST ROW — garanties */}
                    <AnimatedSection delay={200}>
                        <View style={styles.trustRow}>
                            <TrustChip icon={<ShieldCheck size={14} color={C.emerald} strokeWidth={2.2} />} label={t('Sécurisé')} />
                            <TrustChip icon={<Award size={14} color={C.gold} strokeWidth={2.2} />} label={t('Garantie')} />
                            <TrustChip icon={<Zap size={14} color={C.primary} strokeWidth={2.2} />} label={t('Confidentiel')} />
                        </View>
                    </AnimatedSection>

                    {/* FEATURES / PIÈCES */}
                    <AnimatedSection delay={260}>
                        <SectionHeader icon={<Check size={16} color={C.gold} strokeWidth={2.4} />} title={featuresTitle} />
                        <View style={styles.featuresList}>
                            {features.map((feature, i) => (
                                <View key={i} style={styles.featureRow}>
                                    <LinearGradient
                                        colors={[C.gold, C.goldSoft]}
                                        style={styles.featureCheck}
                                    >
                                        <Check size={13} color="#FFF" strokeWidth={3} />
                                    </LinearGradient>
                                    <Text style={styles.featureText}>{t(feature)}</Text>
                                </View>
                            ))}
                        </View>
                    </AnimatedSection>

                    {/* PACK VIP (uniquement passeport) */}
                    {serviceId === 'passeport' && (
                        <AnimatedSection delay={320}>
                            <View style={styles.vipCard}>
                                <LinearGradient
                                    colors={[C.primary, C.primaryLight]}
                                    style={StyleSheet.absoluteFillObject}
                                />

                                <View style={styles.vipHeader}>
                                    <LinearGradient
                                        colors={[C.gold, C.goldSoft]}
                                        style={styles.vipBadgeIcon}
                                    >
                                        <Sparkles size={14} color={C.primary} strokeWidth={2.4} />
                                    </LinearGradient>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.vipTitle}>{t('Pack VIP Retour Gagnant')}</Text>
                                        <Text style={styles.vipSubtitle}>
                                            {t("Un accompagnement intégral en une seule journée — de l'état civil à la délivrance de votre passeport.")}
                                        </Text>
                                    </View>
                                </View>

                                {[
                                    { num: '01', title: 'Enrôlement État Civil', desc: "Obtention de votre extrait de naissance certifié conforme auprès des autorités de l'état civil béninois." },
                                    { num: '02', title: "Carte d'Identité Personnelle (CIP A)", desc: "Constitution du dossier et enrôlement biométrique pour votre titre d'identité officiel béninois." },
                                    { num: '03', title: 'Passeport Express Jour-J', desc: "Prise en charge prioritaire de votre demande de passeport biométrique — déposée et traitée le jour même." },
                                ].map((step) => (
                                    <View key={step.num} style={styles.vipStep}>
                                        <Text style={styles.vipStepNum}>{step.num}</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.vipStepTitle}>{t(step.title)}</Text>
                                            <Text style={styles.vipStepDesc}>{t(step.desc)}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </AnimatedSection>
                    )}

                    {/* TARIFICATION */}
                    {pricingOptions.length > 0 && (
                        <AnimatedSection delay={380}>
                            <SectionHeader icon={<Tag size={16} color={C.gold} strokeWidth={2.4} />} title={t('Tarification')} />
                            <View style={styles.pricingList}>
                                {pricingOptions.map((opt, i) => (
                                    <PressableCardLite key={i}>
                                        <View style={styles.pricingCard}>
                                            <View style={styles.pricingAccent} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.pricingLabel}>{t(opt.label)}</Text>
                                            </View>
                                            <LinearGradient
                                                colors={[C.gold, C.goldSoft]}
                                                style={styles.pricingChip}
                                            >
                                                <Text style={styles.pricingPrice}>{t(opt.price)}</Text>
                                            </LinearGradient>
                                        </View>
                                    </PressableCardLite>
                                ))}
                            </View>
                        </AnimatedSection>
                    )}

                    {/* PROCESSUS */}
                    <AnimatedSection delay={440}>
                        <SectionHeader icon={<ChevronRight size={16} color={C.gold} strokeWidth={2.4} />} title={t('Comment ça marche ?')} />
                        <View style={styles.timeline}>
                            <View style={styles.timelineLine} />
                            {[
                                { step: '1', label: t('Commandez le service'), icon: 'cart-outline' as const },
                                { step: '2', label: t('Déposez vos documents'), icon: 'cloud-upload-outline' as const },
                                { step: '3', label: t('Suivi en temps réel'), icon: 'pulse-outline' as const },
                                { step: '4', label: t('Résultat final'), icon: 'ribbon-outline' as const },
                            ].map((item, idx) => (
                                <View key={item.step} style={styles.processRow}>
                                    <LinearGradient
                                        colors={idx === 0 ? [C.gold, C.goldSoft] : [C.primary, C.primaryLight]}
                                        style={styles.processStep}
                                    >
                                        <Text style={styles.processStepNum}>{item.step}</Text>
                                    </LinearGradient>
                                    <View style={styles.processCard}>
                                        <Ionicons name={item.icon} size={18} color={C.primary} />
                                        <Text style={styles.processLabel}>{item.label}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </AnimatedSection>

                    {/* DOCUMENTS REQUIS */}
                    <AnimatedSection delay={500}>
                        <SectionHeader icon={<FileText size={16} color={C.gold} strokeWidth={2.4} />} title={t('Documents requis')} />
                        <View style={styles.docsList}>
                            {requiredDocs.map((doc, i) => (
                                <View key={i} style={styles.docRow}>
                                    <View style={styles.docBullet}>
                                        <Text style={styles.docNum}>{String(i + 1).padStart(2, '0')}</Text>
                                    </View>
                                    <Text style={styles.docText}>{t(doc)}</Text>
                                </View>
                            ))}
                        </View>
                    </AnimatedSection>

                    {/* CTA PRÊT À DÉMARRER */}
                    <AnimatedSection delay={560}>
                        <View style={styles.ctaCard}>
                            <LinearGradient
                                colors={[C.primary, C.primaryLight, C.primary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFillObject}
                            />

                            <View style={styles.ctaHeader}>
                                <LinearGradient colors={[C.gold, C.goldSoft]} style={styles.ctaIcon}>
                                    <Calendar size={18} color={C.primary} strokeWidth={2.4} />
                                </LinearGradient>
                                <Text style={styles.ctaTitle}>{t('Prêt à démarrer ?')}</Text>
                            </View>
                            <Text style={styles.ctaSubtitle}>
                                {t(modeCopy.note)}
                            </Text>

                            <InteractiveButton
                                disabled={loading}
                                onPress={initiateCheckout}
                                accessibilityLabel={t(modeCopy.cta)}
                                style={[styles.payBtn, loading && { opacity: 0.7 }]}
                            >
                                <LinearGradient
                                    colors={[C.gold, C.goldSoft]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.payBtnGradient}
                                >
                                    {loading ? (
                                        <ActivityIndicator color={C.primary} size="small" />
                                    ) : (
                                        <>
                                            {serviceMode === 'booking'
                                                ? <CreditCard size={20} color={C.primary} strokeWidth={2.4} />
                                                : <Send size={20} color={C.primary} strokeWidth={2.4} />}
                                            <Text style={styles.payBtnText}>{t(modeCopy.cta)}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </InteractiveButton>

                            <View style={styles.ctaFreeRow}>
                                <Sparkles size={11} color={C.gold} fill={C.gold} strokeWidth={0} />
                                <Text style={styles.ctaFreeNote}>{t('Premier appel de 15 min gratuit')}</Text>
                            </View>
                        </View>
                    </AnimatedSection>

                    {/* NOTE PAIEMENT */}
                    <AnimatedSection delay={620}>
                        <View style={styles.securityBanner}>
                            <ShieldCheck size={14} color={C.emerald} strokeWidth={2.2} />
                            <Text style={styles.securityText}>
                                {t('Paiement 100% sécurisé via Mobile Money ou Carte Bancaire.')}
                            </Text>
                        </View>
                    </AnimatedSection>
                </View>

                <View style={{ height: 80 }} />
            </Animated.ScrollView>

            <KkiapayModal
                visible={showKkiapay}
                amount={price || 'Sur devis'}
                serviceName={title}
                onClose={() => setShowKkiapay(false)}
                onSuccess={handlePaymentSuccess}
            />
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
═══════════════════════════════════════════════════════════ */
const InfoPill = ({ icon, label, value }: any) => (
    <View style={styles.infoPill}>
        <View style={styles.infoIconWrap}>{icon}</View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
)

const TrustChip = ({ icon, label }: any) => (
    <View style={styles.trustChip}>
        {icon}
        <Text style={styles.trustText}>{label}</Text>
    </View>
)

const SectionHeader = ({ icon, title }: any) => (
    <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionLine} />
    </View>
)

const PressableCardLite = ({ children }: any) => {
    const scale = useSharedValue(1)
    const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
    return (
        <Animated.View style={s}>
            <Pressable
                onPressIn={() => { scale.value = withSpring(0.98, { damping: 18, stiffness: 280 }) }}
                onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }) }}
                accessibilityRole="button"
                hitSlop={6}
            >
                {children}
            </Pressable>
        </Animated.View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES — HERO
═══════════════════════════════════════════════════════════ */
const hero = StyleSheet.create({
    wrap: {
        paddingBottom: 56,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        position: 'relative',
        overflow: 'hidden',
    },
    shine: {
        position: 'absolute', top: 0, bottom: 0,
        width: SCREEN_W * 0.6,
    },
    backBtn: {
        position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: spacing.lg, zIndex: 10,
    },
    backCircle: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center', justifyContent: 'center',
    },
    premiumBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingHorizontal: 14, paddingVertical: 6,
        borderRadius: 999, marginTop: 8,
        borderWidth: 1, borderColor: C.goldGlow,
    },
    premiumBadgeText: {
        fontSize: 12, fontFamily: fonts.bodyBold,
        color: C.primary, letterSpacing: 1.4,
    },
    iconRing: {
        marginTop: 22,
        shadowColor: '#000', shadowOpacity: 0.35,
        shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
        elevation: 12,
    },
    iconRingGradient: {
        width: 96, height: 96, borderRadius: 48,
        padding: 3,
        alignItems: 'center', justifyContent: 'center',
    },
    iconInner: {
        width: '100%', height: '100%', borderRadius: 45,
        backgroundColor: '#FFF',
        alignItems: 'center', justifyContent: 'center',
    },
    title: {
        fontSize: 24, fontFamily: fonts.heading || fonts.bodyBold,
        color: '#FFF', marginTop: 18, textAlign: 'center',
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 13, fontFamily: fonts.bodyMedium,
        color: 'rgba(255,255,255,0.85)', marginTop: 6,
        textAlign: 'center', lineHeight: 18,
        paddingHorizontal: spacing.lg,
    },
    divider: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 16,
    },
    dividerLine: {
        width: 32, height: 1,
        backgroundColor: C.gold,
    },
})

/* ═══════════════════════════════════════════════════════════
   STYLES — PAGE
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingBottom: spacing.xxl },

    /* Sticky header */
    stickyHeader: {
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingBottom: 12, paddingHorizontal: spacing.lg,
        zIndex: 100,
        borderBottomWidth: 1, borderBottomColor: C.border,
    },
    stickyRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    },
    stickyBack: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: C.surfaceWarm,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    stickyTitle: {
        flex: 1, textAlign: 'center',
        fontSize: 14, fontFamily: fonts.bodyBold, color: C.primary,
    },

    /* Carte principale */
    cardWrap: {
        paddingHorizontal: spacing.lg,
        marginTop: -28,
        gap: spacing.lg,
    },

    descCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1, borderColor: C.border,
        shadowColor: C.primary, shadowOpacity: 0.08,
        shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    desc: {
        fontSize: 14, lineHeight: 22, color: C.textMuted,
        fontFamily: fonts.body,
        textAlign: 'center',
    },

    /* Infos clés — 3 pills horizontaux */
    infoGrid: {
        flexDirection: 'row', gap: 10,
    },
    infoPill: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1, borderColor: C.border,
        shadowColor: C.primary, shadowOpacity: 0.06,
        shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    infoIconWrap: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: C.goldGlow,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: C.textSubtle, letterSpacing: 0.8,
        textTransform: 'uppercase', marginBottom: 4,
    },
    infoValue: {
        fontSize: 12, fontFamily: 'Inter_700Bold',
        color: C.primary, textAlign: 'center',
    },

    /* Trust chips */
    trustRow: {
        flexDirection: 'row', justifyContent: 'center', gap: 8,
        flexWrap: 'wrap',
    },
    trustChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: C.surface,
        paddingHorizontal: 12, paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1, borderColor: C.border,
    },
    trustText: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: C.primary,
    },

    /* Section header */
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginBottom: 14,
    },
    sectionIcon: {
        width: 30, height: 30, borderRadius: 8,
        backgroundColor: C.goldGlow,
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 15, fontFamily: fonts.bodyBold, color: C.primary,
        letterSpacing: 0.2,
    },
    sectionLine: {
        flex: 1, height: 1, backgroundColor: C.border, marginLeft: 4,
    },

    /* Features */
    featuresList: { gap: 10 },
    featureRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface,
        padding: 12, borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    featureCheck: {
        width: 28, height: 28, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.gold, shadowOpacity: 0.3,
        shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    featureText: {
        flex: 1, fontSize: 13, lineHeight: 20,
        color: C.text, fontFamily: 'Inter_500Medium',
    },

    /* VIP Card */
    vipCard: {
        borderRadius: radius.xl,
        padding: spacing.lg,
        overflow: 'hidden',
        shadowColor: C.primary, shadowOpacity: 0.25,
        shadowRadius: 18, shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    vipHeader: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        marginBottom: 18,
    },
    vipBadgeIcon: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    vipTitle: {
        fontSize: 16, fontFamily: fonts.bodyBold,
        color: '#FFF', marginBottom: 4,
    },
    vipSubtitle: {
        fontSize: 12, lineHeight: 17,
        color: 'rgba(255,255,255,0.78)',
        fontFamily: 'Inter_400Regular',
    },
    vipStep: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: radius.md, padding: 12, marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(212,160,23,0.25)',
    },
    vipStepNum: {
        fontSize: 24, fontFamily: 'Inter_800ExtraBold',
        color: C.gold, lineHeight: 26, width: 36,
    },
    vipStepTitle: {
        fontSize: 13, fontFamily: 'Inter_700Bold',
        color: '#FFF', marginBottom: 3,
    },
    vipStepDesc: {
        fontSize: 12, lineHeight: 16,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'Inter_400Regular',
    },

    /* Pricing */
    pricingList: { gap: 10 },
    pricingCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface,
        borderRadius: radius.md, padding: 14,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
    },
    pricingAccent: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, backgroundColor: C.gold,
    },
    pricingLabel: {
        fontSize: 13, fontFamily: 'Inter_600SemiBold',
        color: C.primary, marginLeft: 8,
    },
    pricingChip: {
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 8,
    },
    pricingPrice: {
        fontSize: 13, fontFamily: 'Inter_800ExtraBold',
        color: C.primary,
    },

    /* Timeline / Processus */
    timeline: { position: 'relative', paddingLeft: 0 },
    timelineLine: {
        position: 'absolute', left: 17, top: 18, bottom: 18,
        width: 2, backgroundColor: C.border,
    },
    processRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginBottom: 10,
    },
    processStep: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.primary, shadowOpacity: 0.2,
        shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
        elevation: 3,
    },
    processStepNum: {
        fontSize: 14, fontFamily: 'Inter_800ExtraBold', color: '#FFF',
    },
    processCard: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.surface,
        paddingHorizontal: 14, paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    processLabel: {
        flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold',
        color: C.text,
    },

    /* Documents */
    docsList: { gap: 10 },
    docRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface,
        padding: 12, borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    docBullet: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    docNum: {
        fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: C.gold,
    },
    docText: {
        flex: 1, fontSize: 13, lineHeight: 20,
        color: C.text, fontFamily: 'Inter_500Medium',
    },

    /* CTA Card */
    ctaCard: {
        borderRadius: radius.xl,
        padding: spacing.xl,
        overflow: 'hidden',
        alignItems: 'center',
        shadowColor: C.primary, shadowOpacity: 0.3,
        shadowRadius: 22, shadowOffset: { width: 0, height: 12 },
        elevation: 10,
    },
    ctaHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginBottom: 6,
    },
    ctaIcon: {
        width: 38, height: 38, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    ctaTitle: {
        fontSize: 18, fontFamily: fonts.bodyBold,
        color: '#FFF', letterSpacing: 0.3,
    },
    ctaSubtitle: {
        fontSize: 13, lineHeight: 19,
        color: 'rgba(255,255,255,0.82)',
        textAlign: 'center', marginBottom: 20,
        fontFamily: 'Inter_400Regular',
    },
    payBtn: {
        width: '100%',
        borderRadius: radius.lg,
        overflow: 'hidden',
        shadowColor: C.gold, shadowOpacity: 0.45,
        shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    payBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        paddingVertical: 16,
    },
    payBtnText: {
        fontSize: 15, fontFamily: 'Inter_800ExtraBold',
        color: C.primary, letterSpacing: 0.4,
    },
    ctaFreeRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 14,
    },
    ctaFreeNote: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: 'rgba(255,255,255,0.78)',
    },

    /* Security banner */
    securityBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: 'rgba(10,107,59,0.08)',
        paddingHorizontal: 16, paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: 'rgba(10,107,59,0.18)',
    },
    securityText: {
        fontSize: 12, fontFamily: 'Inter_500Medium',
        color: C.emerald, textAlign: 'center',
    },
})
