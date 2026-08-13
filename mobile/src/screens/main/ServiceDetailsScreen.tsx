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
import { LucideIcon } from '../../components/Icon'
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
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { getServiceMode, MODE_COPY } from '../../lib/service-mode'
import { pricingEnabled, showPriceFor } from '../../lib/pricing-visibility'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const { width: SCREEN_W } = Dimensions.get('window')

/* ═══════════════════════════════════════════════════════════
   CORPORATE PREMIUM 2026 : Palette signature
═══════════════════════════════════════════════════════════ */
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

interface PricingOption { label: string; price: string }

/** Contenu éditorial de service, IDENTIQUE au site (voir web lib/content/serviceLanding). */
interface ServiceLanding {
    hero_subtitle?: string
    piliers?: { title: string; desc: string }[]
    intro_eyebrow?: string
    intro_title?: string
    intro_text?: string
    etapes_title?: string
    etapes?: { num: string; title: string; desc: string }[]
    contrast_title?: string
    contrast_accent?: string
    contrast_intro?: string
    solo?: string[]
    avec?: string[]
    features?: string[]
    faq?: { q: string; r: string }[]
    final_title?: string
    final_text?: string
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED SECTION : fade + slide staggered
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
   INTERACTIVE BUTTON : press feedback premium
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

/* Ligne de FAQ repliable (accordéon), identique à l'esprit du site. */
const FaqRow = ({ q, r }: { q: string; r: string }) => {
    const [open, setOpen] = useState(false)
    return (
        <View style={styles.faqItem}>
            <Pressable onPress={() => setOpen(o => !o)} style={styles.faqQRow} accessibilityRole="button" hitSlop={4}>
                <Text style={styles.faqQ}>{q}</Text>
                <ChevronRight size={16} color={C.textMuted} strokeWidth={2.4} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
            </Pressable>
            {open ? <Text style={styles.faqR}>{r}</Text> : null}
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   EN-TETE DE PRESTATION

   Ancienne version : degrade vert plein, shimmer dore balayant en boucle,
   badge « Service Premium » pulsant, anneau dore et diviseur a etoile.
   Rien de tout cela ne disait quoi que ce soit sur la prestation.
   Nouvelle version : le blanc porte la page, le lisere tricolore signe,
   la pastille d'icone situe le service, le titre parle.
═══════════════════════════════════════════════════════════ */
const ServiceHero = ({ icon, title, subtitle, onBack, t }: any) => {
    const insets = useSafeAreaInsets()

    return (
        <View style={[hero.wrap, { paddingTop: insets.top + 8 }]}>
            <View style={hero.flagWrap}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={hero.topRow}>
                <InteractiveButton onPress={onBack} accessibilityLabel={t('Retour')} style={hero.backBtn}>
                    <View style={hero.backCircle}>
                        <ArrowLeft size={20} color={C.textPrimary} strokeWidth={2} />
                    </View>
                </InteractiveButton>
            </View>

            <View style={hero.identity}>
                <View style={hero.iconTile}>
                    <LucideIcon name={icon || 'briefcase-outline'} size={30} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={hero.title}>{t(title || 'Detail de la prestation')}</Text>
                    {subtitle ? (
                        <Text style={hero.subtitle}>{t(subtitle)}</Text>
                    ) : null}
                </View>
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

    // Le site masque les tarifs des fiches (services_show_calculator = false).
    // L'app suit la meme regle : le montant se construit en rendez-vous.
    const [pricingOn, setPricingOn] = useState(false)
    useEffect(() => { pricingEnabled().then(setPricingOn).catch(() => setPricingOn(false)) }, [])
    const showPrice = showPriceFor(serviceId, pricingOn)

    /* ── Données dynamiques DB ── */
    const [dynamicPrice, setDynamicPrice] = useState<string | null>(null)
    const [dynamicPricingOptions, setDynamicPricingOptions] = useState<PricingOption[] | null>(null)
    const [dynamicFeatures, setDynamicFeatures] = useState<string[] | null>(null)
    const [dynamicDocuments, setDynamicDocuments] = useState<string[] | null>(null)
    const [dynamicDuration, setDynamicDuration] = useState<string | null>(null)
    // Contenu éditorial IDENTIQUE au site (piliers, étapes, contraste, FAQ...),
    // servi par /api/service-landing/[slug] (DEFAULT + override admin fusionnés).
    const [landing, setLanding] = useState<ServiceLanding | null>(null)

    useEffect(() => {
        if (!serviceId) return
        let cancelled = false
        fetchWithTimeout(`${API_BASE}/api/service-landing/${serviceId}`, { timeoutMs: 8000 })
            .then(r => (r.ok ? r.json() : null))
            .then(j => { if (!cancelled && j?.content) setLanding(j.content as ServiceLanding) })
            .catch(() => { /* fallback SERVICES_DATA */ })
        return () => { cancelled = true }
    }, [serviceId])

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
    const features: string[] = (landing?.features?.length ? landing.features : dynamicFeatures) ?? (paramFeatures?.length ? paramFeatures : [
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
            "Un accompagnement intégral en une seule journée : de l'état civil à la délivrance de votre passeport.",
            'Enrôlement État Civil', "Obtention de votre extrait de naissance certifié conforme auprès des autorités de l'état civil béninois.",
            "Carte d'Identité Personnelle (CIP A)", "Constitution du dossier et enrôlement biométrique pour votre titre d'identité officiel béninois.",
            'Passeport Express Jour-J', "Prise en charge prioritaire de votre demande de passeport biométrique : déposée et traitée le jour même.",
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

    /* Demande de rendez-vous : meme table que l'ecran RDV et que le site
       (rdv_requests), donc visible par les agents dans leur agenda.
       Avant, ce bouton creait un DOSSIER a 0 franc, ce que l'API refusait :
       le client voyait une erreur alors qu'il demandait juste un entretien. */
    /* On ouvre le formulaire de rendez-vous avec la prestation pre-remplie :
       le client y choisit un creneau REELLEMENT libre (/api/availability).
       Creer la demande ici, sans date ni heure, violait la contrainte
       NOT NULL de rdv_requests : d'ou l'erreur « La demande n'a pas pu etre
       envoyee » au clic sur « Prendre rendez-vous ». */
    const requestAppointment = useCallback(() => {
        if (!profile?.id) {
            toast(t('Non connecté'), t('Veuillez vous connecter pour demander un rendez-vous.'))
            return
        }
        navigation.navigate('Appointments', {
            openRequest: true,
            serviceLabel: title || serviceId || '',
        })
    }, [profile, title, serviceId, navigation, t])

    const initiateCheckout = useCallback(() => {
        if (!profile) {
            toast(t('Non connecté'), t('Veuillez vous connecter pour commander ce service.'))
            return
        }
        // Chaque parcours mene la ou le site public mene.
        if (serviceMode === 'form') { navigation.navigate('NationaliteForm'); return }
        if (serviceMode === 'shop') { navigation.navigate('Boutique'); return }
        if (serviceMode === 'booking') { navigation.navigate('Fa'); return }
        requestAppointment()
    }, [profile, serviceMode, navigation, requestAppointment, t])

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
            {/* Sticky header (apparait au scroll) */}
            <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }, stickyHeaderStyle]} pointerEvents="box-none">
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

                    {/* INFOS CLÉS : 3 piliers premium */}
                    <AnimatedSection delay={140}>
                        <View style={styles.infoGrid}>
                            <InfoPill
                                icon={<Clock size={18} color={C.primary} strokeWidth={2} />}
                                label={t('Délai moyen')}
                                value={t(duration || '4–8 semaines')}
                            />
                            <InfoPill
                                icon={<Tag size={18} color={C.primary} strokeWidth={2} />}
                                label={showPrice ? t('Tarif') : t('Devis')}
                                value={showPrice ? t(price || 'Sur devis') : t('Établi en rendez-vous')}
                            />
                        </View>
                    </AnimatedSection>

                    {/* FEATURES / PIÈCES */}
                    <AnimatedSection delay={260}>
                        <SectionHeader icon={<Check size={16} color={C.primary} strokeWidth={2.4} />} title={featuresTitle} />
                        <View style={styles.featuresList}>
                            {features.map((feature, i) => (
                                <View key={i} style={styles.featureRow}>
                                    <View style={styles.featureCheck}>
                                        <Check size={13} color={C.primaryText} strokeWidth={3} />
                                    </View>
                                    <Text style={styles.featureText}>{t(feature)}</Text>
                                </View>
                            ))}
                        </View>
                    </AnimatedSection>

                    {/* PACK VIP (uniquement passeport) */}
                    {serviceId === 'passeport' && (
                        <AnimatedSection delay={320}>
                            <View style={styles.vipCard}>
                                <View style={styles.vipHeader}>
                                    <View style={styles.vipBadgeIcon}>
                                        <Sparkles size={14} color={C.primaryText} strokeWidth={2.4} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.vipTitle}>{t('Pack VIP Retour Gagnant')}</Text>
                                        <Text style={styles.vipSubtitle}>
                                            {t("Un accompagnement intégral en une seule journée : de l'état civil à la délivrance de votre passeport.")}
                                        </Text>
                                    </View>
                                </View>

                                {[
                                    { num: '01', title: 'Enrôlement État Civil', desc: "Obtention de votre extrait de naissance certifié conforme auprès des autorités de l'état civil béninois." },
                                    { num: '02', title: "Carte d'Identité Personnelle (CIP A)", desc: "Constitution du dossier et enrôlement biométrique pour votre titre d'identité officiel béninois." },
                                    { num: '03', title: 'Passeport Express Jour-J', desc: "Prise en charge prioritaire de votre demande de passeport biométrique : déposée et traitée le jour même." },
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
                    {showPrice && pricingOptions.length > 0 && (
                        <AnimatedSection delay={380}>
                            <SectionHeader icon={<Tag size={16} color={C.primary} strokeWidth={2.4} />} title={t('Tarification')} />
                            <View style={styles.pricingList}>
                                {pricingOptions.map((opt, i) => (
                                    <PressableCardLite key={i}>
                                        <View style={styles.pricingCard}>
                                            <View style={styles.pricingAccent} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.pricingLabel}>{t(opt.label)}</Text>
                                            </View>
                                            <View style={styles.pricingChip}>
                                                <Text style={styles.pricingPrice}>{t(opt.price)}</Text>
                                            </View>
                                        </View>
                                    </PressableCardLite>
                                ))}
                            </View>
                        </AnimatedSection>
                    )}

                    {/* ÉTAPES : les vraies étapes du service (identiques au site).
                        Repli générique uniquement si le contenu éditorial est absent. */}
                    <AnimatedSection delay={440}>
                        <SectionHeader icon={<ChevronRight size={16} color={C.primary} strokeWidth={2.4} />} title={t(landing?.etapes?.length ? (landing.etapes_title || 'Comment ça se passe') : 'Comment ça marche ?')} />
                        <View style={styles.timeline}>
                            <View style={styles.timelineLine} />
                            {(landing?.etapes?.length
                                ? landing.etapes.map((e, idx) => ({ step: e.num, title: e.title, desc: e.desc, idx }))
                                : [
                                    { step: '1', title: 'Commandez le service', desc: '', idx: 0 },
                                    { step: '2', title: 'Déposez vos documents', desc: '', idx: 1 },
                                    { step: '3', title: 'Suivi en temps réel', desc: '', idx: 2 },
                                    { step: '4', title: 'Résultat final', desc: '', idx: 3 },
                                ]
                            ).map((item) => (
                                <View key={`${item.step}-${item.idx}`} style={styles.processRow}>
                                    <View style={[styles.processStep, { backgroundColor: item.idx === 0 ? C.accent : C.primary }]}>
                                        <Text style={[styles.processStepNum, { color: item.idx === 0 ? C.accentDark : C.primaryText }]}>{item.step}</Text>
                                    </View>
                                    <View style={styles.etapeCard}>
                                        <Text style={styles.etapeTitle}>{t(item.title)}</Text>
                                        {item.desc ? <Text style={styles.etapeDesc}>{t(item.desc)}</Text> : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </AnimatedSection>

                    {/* CONTRASTE : seul vs accompagné (identique au site) */}
                    {landing && (landing.solo?.length || landing.avec?.length) ? (
                        <AnimatedSection delay={480}>
                            <SectionHeader icon={<ShieldCheck size={16} color={C.primary} strokeWidth={2.4} />} title={t(landing.contrast_accent ? `${landing.contrast_title || ''} ${landing.contrast_accent}`.trim() : 'Pourquoi être accompagné')} />
                            <View style={styles.contrastWrap}>
                                {landing.solo?.length ? (
                                    <View style={styles.contrastCol}>
                                        <Text style={styles.contrastLabel}>{t('En solo')}</Text>
                                        {landing.solo.map((s, i) => (
                                            <View key={i} style={styles.contrastRow}>
                                                <View style={styles.contrastBad}><Text style={styles.contrastBadX}>×</Text></View>
                                                <Text style={styles.contrastText}>{t(s)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                                {landing.avec?.length ? (
                                    <View style={[styles.contrastCol, styles.contrastColGood]}>
                                        <Text style={[styles.contrastLabel, { color: C.primary }]}>{t('Avec Retour Gagnant')}</Text>
                                        {landing.avec.map((s, i) => (
                                            <View key={i} style={styles.contrastRow}>
                                                <View style={styles.contrastGood}><Check size={11} color={C.primaryText} strokeWidth={3} /></View>
                                                <Text style={[styles.contrastText, { color: C.text }]}>{t(s)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        </AnimatedSection>
                    ) : null}

                    {/* DOCUMENTS REQUIS */}
                    <AnimatedSection delay={500}>
                        <SectionHeader icon={<FileText size={16} color={C.primary} strokeWidth={2.4} />} title={t('Documents requis')} />
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

                    {/* FAQ : questions fréquentes du service (identiques au site) */}
                    {landing?.faq?.length ? (
                        <AnimatedSection delay={540}>
                            <SectionHeader icon={<ShieldCheck size={16} color={C.primary} strokeWidth={2.4} />} title={t('Questions fréquentes')} />
                            <View>
                                {landing.faq.map((f, i) => (
                                    <FaqRow key={i} q={t(f.q)} r={t(f.r)} />
                                ))}
                            </View>
                        </AnimatedSection>
                    ) : null}

                    {/* CTA PRÊT À DÉMARRER */}
                    <AnimatedSection delay={560}>
                        <View style={styles.ctaCard}>
                            {/* Liseré tricolore : même signature que les cartes
                                de l'accueil, il ancre le bloc dans la charte. */}
                            <FlagBar height={4} radiusTop={false} />

                            <View style={styles.ctaBody}>
                                <View style={styles.ctaHeader}>
                                    <View style={styles.ctaIcon}>
                                        <Calendar size={19} color={C.primary} strokeWidth={2.2} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.ctaKicker}>{t('PROCHAINE ÉTAPE')}</Text>
                                        <Text style={styles.ctaTitle}>{t('Prêt à démarrer ?')}</Text>
                                    </View>
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
                                    <View style={styles.payBtnGradient}>
                                        {loading ? (
                                            <ActivityIndicator color={C.primaryText} size="small" />
                                        ) : (
                                            <>
                                                {serviceMode === 'booking'
                                                    ? <CreditCard size={19} color={C.primaryText} strokeWidth={2.2} />
                                                    : <Send size={19} color={C.primaryText} strokeWidth={2.2} />}
                                                <Text style={styles.payBtnText}>{t(modeCopy.cta)}</Text>
                                            </>
                                        )}
                                    </View>
                                </InteractiveButton>

                                <View style={styles.ctaFreeRow}>
                                    <Sparkles size={12} color={C.primary} fill={C.accentDark} strokeWidth={0} />
                                    <Text style={styles.ctaFreeNote}>{t('Premier appel de 15 min gratuit')}</Text>
                                </View>
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
   STYLES : HERO
═══════════════════════════════════════════════════════════ */
const hero = StyleSheet.create({
    wrap: { paddingBottom: spacing.lg, backgroundColor: C.surface },
    flagWrap: {
        marginHorizontal: spacing.lg,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    topRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
    backBtn: { alignSelf: 'flex-start' },
    backCircle: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },
    identity: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
    },
    iconTile: {
        width: 64, height: 64, borderRadius: radius.lg,
        backgroundColor: C.primarySoft,
        alignItems: 'center', justifyContent: 'center',
    },
    title: { ...typography.h1, fontSize: 26, lineHeight: 32, color: C.textPrimary },
    subtitle: { ...typography.bodySmall, color: C.textMuted, marginTop: spacing.xs },
})

/* ═══════════════════════════════════════════════════════════
   STYLES : PAGE
═══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingBottom: spacing.xxl },

    /* Sticky header */
    stickyHeader: {
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingBottom: 12, paddingHorizontal: spacing.lg,
        zIndex: 100,
        /* Fond opaque INDISPENSABLE : l'en-tête est en position absolue et le
           contenu défile dessous. Sans lui, la liste des pièces à fournir se
           superposait au titre du service, les deux textes se chevauchant. */
        backgroundColor: C.surface,
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
        ...shadows.card, shadowOpacity: 0.08,
        shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
        elevation: 4,
    },
    desc: {
        fontSize: 14, lineHeight: 22, color: C.textMuted,
        fontFamily: fonts.body,
        textAlign: 'center',
    },

    /* Infos clés : 3 pills horizontaux */
    infoGrid: {
        flexDirection: 'row', gap: spacing.sm,
    },
    infoPill: {
        flex: 1,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 1, borderColor: C.border,
        ...shadows.card, shadowOpacity: 0.06,
        shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
        elevation: 2,
    },
    infoIconWrap: {
        width: 38, height: 38, borderRadius: radius.xl,
        backgroundColor: C.goldGlow,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    infoLabel: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: C.textSubtle, letterSpacing: 0.8,
        textTransform: 'uppercase', marginBottom: spacing.xs,
    },
    infoValue: {
        fontSize: 12, fontFamily: 'Inter_700Bold',
        color: C.primary, textAlign: 'center',
    },

    /* Trust chips */
    trustRow: {
        flexDirection: 'row', justifyContent: 'center', gap: spacing.sm,
        flexWrap: 'wrap',
    },
    trustChip: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: C.surface,
        paddingHorizontal: 12, paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1, borderColor: C.border,
    },
    trustText: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: C.primary,
    },

    /* Section header */
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionIcon: {
        width: 30, height: 30, borderRadius: radius.xs,
        backgroundColor: C.goldGlow,
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 15, fontFamily: fonts.bodyBold, color: C.primary,
        letterSpacing: 0.2,
    },
    sectionLine: {
        flex: 1, height: 1, backgroundColor: C.border, marginLeft: spacing.xs,
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
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
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
        backgroundColor: C.surfaceSoft,
        borderWidth: 1, borderColor: C.border,
    },
    vipHeader: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        marginBottom: spacing.md,
    },
    vipBadgeIcon: {
        width: 36, height: 36, borderRadius: radius.xs,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    vipTitle: {
        fontSize: 16, fontFamily: fonts.bodyBold,
        color: C.textPrimary, marginBottom: spacing.xs,
    },
    vipSubtitle: {
        fontSize: 12, lineHeight: 17,
        color: C.textMuted,
        fontFamily: 'Inter_400Regular',
    },
    vipStep: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12,
        backgroundColor: C.surface,
        borderRadius: radius.md, padding: 12, marginBottom: spacing.sm,
        borderWidth: 1, borderColor: C.border,
    },
    vipStepNum: {
        fontSize: 24, fontFamily: 'Inter_800ExtraBold',
        color: C.primary, lineHeight: 26, width: 36,
    },
    vipStepTitle: {
        fontSize: 13, fontFamily: 'Inter_700Bold',
        color: C.textPrimary, marginBottom: spacing.xxs,
    },
    vipStepDesc: {
        fontSize: 12, lineHeight: 16,
        color: C.textMuted,
        fontFamily: 'Inter_400Regular',
    },

    /* Pricing */
    pricingList: { gap: 10 },
    pricingCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface,
        borderRadius: radius.md, padding: spacing.md,
        borderWidth: 1, borderColor: C.border,
        overflow: 'hidden',
    },
    pricingAccent: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 4, backgroundColor: C.gold,
    },
    pricingLabel: {
        fontSize: 13, fontFamily: 'Inter_600SemiBold',
        color: C.primary, marginLeft: spacing.sm,
    },
    pricingChip: {
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderRadius: radius.pill, backgroundColor: C.accent,
    },
    pricingPrice: {
        fontSize: 13, fontFamily: fonts.bodyBold, color: C.primary,
    },

    /* Timeline / Processus */
    timeline: { position: 'relative', paddingLeft: 0 },
    timelineLine: {
        position: 'absolute', left: 17, top: 18, bottom: 18,
        width: 2, backgroundColor: C.border,
    },
    processRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginBottom: spacing.sm,
    },
    processStep: {
        width: 40, height: 40, borderRadius: radius.md,
        alignItems: 'center', justifyContent: 'center',
    },
    processStepNum: {
        fontSize: 16, fontFamily: fonts.bodyBold,
    },
    processCard: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: C.surface,
        paddingHorizontal: spacing.md, paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    processLabel: {
        flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold',
        color: C.text,
    },

    /* Étapes réelles (titre + description) */
    etapeCard: {
        flex: 1, backgroundColor: C.surface,
        paddingHorizontal: spacing.md, paddingVertical: 12,
        borderRadius: radius.md, borderWidth: 1, borderColor: C.border,
    },
    etapeTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.2 },
    etapeDesc: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular', color: C.textSec, marginTop: 3 },

    /* Contraste solo vs accompagné */
    contrastWrap: { gap: spacing.sm },
    contrastCol: {
        backgroundColor: C.surfaceAlt, borderRadius: radius.lg, padding: spacing.md,
        borderWidth: 1, borderColor: C.border,
    },
    contrastColGood: { backgroundColor: C.primarySoft, borderColor: 'rgba(0,135,81,0.25)' },
    contrastLabel: {
        fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6,
        textTransform: 'uppercase', color: C.textMuted, marginBottom: spacing.sm,
    },
    contrastRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 8 },
    contrastBad: {
        width: 18, height: 18, borderRadius: 9, backgroundColor: C.dangerSoft,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    contrastBadX: { color: C.danger, fontSize: 12, fontFamily: 'Inter_700Bold', lineHeight: 14 },
    contrastGood: {
        width: 18, height: 18, borderRadius: 9, backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center', marginTop: 1,
    },
    contrastText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', color: C.textSec },

    /* FAQ */
    faqItem: {
        backgroundColor: C.surface, borderRadius: radius.md, borderWidth: 1, borderColor: C.border,
        marginBottom: 8, overflow: 'hidden',
    },
    faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 13 },
    faqQ: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: C.text, letterSpacing: -0.2 },
    faqR: { paddingHorizontal: spacing.md, paddingBottom: 13, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular', color: C.textSec },

    /* Documents */
    docsList: { gap: 10 },
    docRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: C.surface,
        padding: 12, borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    docBullet: {
        width: 32, height: 32, borderRadius: radius.xs,
        backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    docNum: {
        fontSize: 12, fontFamily: 'Inter_800ExtraBold', color: C.primaryText,
    },
    docText: {
        flex: 1, fontSize: 13, lineHeight: 20,
        color: C.text, fontFamily: 'Inter_500Medium',
    },

    /* CTA Card */
    /* ── Bloc « Prêt à démarrer ? » ────────────────────────────
       Refait sur le vocabulaire de l'accueil. Trois défauts corrigés :

       • la carte n'avait AUCUN fond : elle était transparente, et son
         ombre verte à 30 % d'opacité produisait le halo qui la faisait
         flotter au lieu de la poser ;
       • les textes étaient blancs, hérités du thème sombre d'avant la
         charte v2 : sur fond blanc ils étaient invisibles, ne laissant
         voir que l'icône du calendrier et l'étoile, orphelines ;
       • le bouton portait une seconde ombre, dorée, qui doublait le halo.

       Désormais : surface blanche posée, liseré tricolore, ombre teintée
       du gris de texte comme toutes les cartes de l'application. */
    ctaCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xxl,
        borderWidth: 1,
        borderColor: C.line,
        overflow: 'hidden',
        ...shadows.card,
    },
    ctaBody: {
        padding: spacing.lg,
    },
    ctaHeader: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        marginBottom: spacing.md,
    },
    ctaIcon: {
        width: 44, height: 44, borderRadius: radius.md,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center', justifyContent: 'center',
    },
    ctaKicker: {
        ...typography.overline,
        fontSize: 12,
        color: C.primary,
    },
    ctaTitle: {
        fontSize: 19, fontFamily: fonts.bodyBold,
        color: C.text, marginTop: spacing.xxs,
    },
    ctaSubtitle: {
        fontSize: 13, lineHeight: 20,
        color: C.textMuted,
        marginBottom: spacing.lg,
        fontFamily: 'Inter_400Regular',
    },
    payBtn: {
        width: '100%',
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    payBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, height: 54, borderRadius: radius.pill,
        backgroundColor: C.primary,
    },
    payBtnText: {
        fontSize: 15, fontFamily: fonts.bodyBold, color: C.primaryText,
    },
    ctaFreeRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.xs, marginTop: spacing.md,
    },
    ctaFreeNote: {
        fontSize: 12, fontFamily: 'Inter_600SemiBold',
        color: C.textMuted,
    },

    /* Security banner */
    /* Couleurs reprises de la charte : les rgba() codés en dur étaient un
       reste d'avant le design system v2. */
    securityBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        backgroundColor: C.surfaceSoft,
        paddingHorizontal: spacing.md, paddingVertical: 12,
        borderRadius: radius.md,
        borderWidth: 1, borderColor: C.border,
    },
    securityText: {
        fontSize: 12, fontFamily: 'Inter_500Medium',
        color: C.primary, textAlign: 'center',
    },
})
