/* ═══════════════════════════════════════════════════════════
   Proposition — deck de slides NATIF.

   La proposition s'ouvrait dans une WebView : mise en page pour grand écran,
   aucune sélection possible. Puis, en natif, une simple liste : correcte mais
   sans souffle, alors qu'un séjour se VEND par l'image.

   Ici chaque prestation occupe l'écran entier et se balaye du doigt :
   · la photo respire en continu (lent panoramique — le regard traverse le lieu
     au lieu de le regarder fixe) ;
   · elle glisse à contre-sens du doigt pendant le balayage (parallaxe) : la
     profondeur naît du décalage entre le fond et le texte ;
   · le texte se pose en cascade à l'arrivée de la slide ;
   · un appui retient ou écarte la prestation, avec retour haptique, et le
     total change immédiatement en bas.

   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, Image, Dimensions,
    ActivityIndicator, Share, ScrollView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
    ChevronLeft, Share2, Check, MapPin, CalendarDays, Bed, UtensilsCrossed,
    Camera, Car, Sparkles, PenLine, CreditCard, CircleCheck, ChevronRight,
} from 'lucide-react-native'
import Animated, {
    FadeInDown, FadeIn, Easing, Extrapolation, interpolate,
    useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
    withRepeat, withTiming, runOnJS,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const { width: L } = Dimensions.get('window')

interface Prestation {
    id: string
    type: string | null
    title: string | null
    subtitle: string | null
    description: string | null
    location: string | null
    image_url: string | null
    images?: string[]
    selling_price: number | null
    original_price: number | null
    highlights: string[] | null
}

interface Proposition {
    id: string
    secret_key: string
    destination: string | null
    start_date: string | null
    end_date: string | null
    total_amount: number | null
    currency: string | null
    status: string | null
    signed_at: string | null
    intro_title: string | null
    intro_text: string | null
    intro_image: string | null
}

const FAMILLES: Record<string, { l: string; Icone: typeof Bed }> = {
    hotel: { l: 'Hébergement', Icone: Bed },
    hebergement: { l: 'Hébergement', Icone: Bed },
    restaurant: { l: 'Restauration', Icone: UtensilsCrossed },
    activity: { l: 'Activité', Icone: Camera },
    activite: { l: 'Activité', Icone: Camera },
    transport: { l: 'Transport', Icone: Car },
}
const familleDe = (t: string | null) => FAMILLES[String(t || '').toLowerCase()] || { l: 'Expérience', Icone: Sparkles }

const somme = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0)

const money = (v: number, devise: string | null) =>
    `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} ${devise === 'XOF' || !devise ? 'FCFA' : devise}`

const dateFr = (iso: string | null) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) }
    catch { return null }
}

/* ── Une slide ────────────────────────────────────────────────
   `scrollX` est partagé par toutes les slides : chacune calcule sa propre
   position relative et en déduit sa parallaxe. Tout se passe sur le fil
   d'animation — le doigt ne dépend jamais du fil JS. */
function Slide({
    p, index, scrollX, retenu, onToggle, devise, hauteur, t,
}: {
    p: Prestation
    index: number
    scrollX: SharedValue<number>
    retenu: boolean
    onToggle: () => void
    devise: string | null
    hauteur: number
    t: (s: string, v?: Record<string, string | number>) => string
}) {
    const { l: famille, Icone } = familleDe(p.type)
    const prix = somme(p.selling_price)
    const photos = (p.images?.length ? p.images : p.image_url ? [p.image_url] : []).slice(0, 6)
    const [photo, setPhoto] = useState(0)

    /* Panoramique continu : la photo dérive lentement d'un bord à l'autre.
       C'est ce mouvement qui donne l'impression de traverser le lieu. */
    const pano = useSharedValue(0)
    useEffect(() => {
        pano.value = withRepeat(
            withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.quad) }),
            -1, true,
        )
    }, [pano])

    const styleImage = useAnimatedStyle(() => {
        const d = scrollX.value - index * L                     // décalage de la slide
        const parallaxe = interpolate(d, [-L, 0, L], [L * 0.32, 0, -L * 0.32], Extrapolation.CLAMP)
        const derive = interpolate(pano.value, [0, 1], [-16, 16])
        const zoom = interpolate(pano.value, [0, 1], [1.08, 1.18])
        return { transform: [{ translateX: parallaxe + derive }, { scale: zoom }] }
    })

    /* Le contenu s'efface légèrement quand la slide quitte l'écran : l'œil
       sait ainsi laquelle est « active » sans qu'on le lui dise. */
    const styleCorps = useAnimatedStyle(() => {
        const d = scrollX.value - index * L
        return {
            opacity: interpolate(Math.abs(d), [0, L * 0.75], [1, 0], Extrapolation.CLAMP),
            transform: [{ translateY: interpolate(Math.abs(d), [0, L], [0, 34], Extrapolation.CLAMP) }],
        }
    })

    return (
        <View style={{ width: L, height: hauteur }}>
            <View style={styles.cadrePhoto}>
                {photos.length > 0 ? (
                    <Animated.Image
                        source={{ uri: photos[photo] }}
                        style={[StyleSheet.absoluteFill, styleImage]}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.surfaceAlt }]} />
                )}

                {/* Famille + rang, posés sur la photo */}
                <Animated.View entering={FadeIn.delay(120)} style={styles.pastilleFamille}>
                    <Icone size={13} color={C.primary} strokeWidth={2.4} />
                    <Text style={styles.pastilleText}>{t(famille)}</Text>
                </Animated.View>

                {/* Retenir / écarter : la décision se prend devant l'image. */}
                <Pressable
                    onPress={onToggle}
                    style={[styles.case, retenu && styles.caseOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: retenu }}
                    accessibilityLabel={retenu ? t('Écarter cette prestation') : t('Retenir cette prestation')}
                    hitSlop={10}
                >
                    <Check size={19} color={retenu ? '#FFFFFF' : C.textMuted} strokeWidth={3} />
                </Pressable>

                {/* Galerie du slide : plusieurs vues d'un même lieu. */}
                {photos.length > 1 && (
                    <View style={styles.vignettes}>
                        {photos.map((u, i) => (
                            <Pressable key={u + i} onPress={() => setPhoto(i)} hitSlop={6}>
                                <View style={[styles.vignette, i === photo && styles.vignetteOn]}>
                                    <Image source={{ uri: u }} style={styles.vignetteImg} resizeMode="cover" />
                                </View>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>

            <Animated.View style={[styles.corps, styleCorps]}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.md }}>
                    <Animated.Text entering={FadeInDown.delay(60).duration(420)} style={styles.titre}>
                        {p.title || t('Prestation')}
                    </Animated.Text>

                    {!!p.subtitle && (
                        <Animated.Text entering={FadeInDown.delay(130).duration(420)} style={styles.sousTitre}>
                            {p.subtitle}
                        </Animated.Text>
                    )}

                    {!!p.location && (
                        <Animated.View entering={FadeInDown.delay(190).duration(420)} style={styles.lieu}>
                            <MapPin size={12} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.lieuText}>{p.location}</Text>
                        </Animated.View>
                    )}

                    {!!p.description && (
                        <Animated.Text entering={FadeInDown.delay(250).duration(420)} style={styles.desc}>
                            {p.description}
                        </Animated.Text>
                    )}

                    {!!p.highlights?.length && (
                        <View style={styles.puces}>
                            {p.highlights.slice(0, 5).map((h, i) => (
                                <Animated.View key={h + i} entering={FadeInDown.delay(320 + i * 70).duration(380)} style={styles.puce}>
                                    <Text style={styles.puceText}>{h}</Text>
                                </Animated.View>
                            ))}
                        </View>
                    )}
                </ScrollView>

                <View style={styles.piedSlide}>
                    <Text style={[styles.prix, !retenu && styles.prixOff]}>
                        {prix > 0 ? money(prix, devise) : t('Compris dans le séjour')}
                    </Text>
                    <Pressable onPress={onToggle} hitSlop={8} accessibilityRole="button">
                        <Text style={[styles.etat, retenu && styles.etatOn]}>
                            {retenu ? t('Retenu') : t('Écarté')}
                        </Text>
                    </Pressable>
                </View>
            </Animated.View>
        </View>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PropositionDetailScreen({ navigation, route }: { navigation: any; route: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const proposalId: string = route?.params?.proposalId

    const [prop, setProp] = useState<Proposition | null>(null)
    const [prestations, setPrestations] = useState<Prestation[]>([])
    const [retenues, setRetenues] = useState<Set<string>>(new Set())
    const [chargement, setChargement] = useState(true)
    const [erreur, setErreur] = useState('')
    const [rang, setRang] = useState(0)
    const [intro, setIntro] = useState(true)

    const scrollX = useSharedValue(0)
    // Dernier rang notifié au fil JS : sans ce garde-fou, chaque image de
    // défilement déclencherait un rendu React et le balayage saccaderait.
    const dernierRang = useSharedValue(0)
    const listeRef = useRef<Animated.ScrollView>(null)

    const charger = useCallback(async () => {
        setChargement(true); setErreur('')
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}`, {
                headers: { ...(await authHeaders()) },
                timeoutMs: 15000,
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || `Chargement impossible (erreur ${res.status}).`)
            setProp(json.proposal)
            const liste: Prestation[] = Array.isArray(json.prestations) ? json.prestations : []
            setPrestations(liste)
            // Tout est retenu au départ : la proposition du conseiller est le
            // point de départ, le client retire ce qu'il ne veut pas.
            setRetenues(new Set(liste.map(p => p.id)))
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [proposalId])

    useEffect(() => { charger() }, [charger])

    const basculer = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
        setRetenues(prev => {
            const s = new Set(prev)
            if (s.has(id)) s.delete(id); else s.add(id)
            return s
        })
    }

    const total = useMemo(
        () => prestations.filter(p => retenues.has(p.id)).reduce((s, p) => s + somme(p.selling_price), 0),
        [prestations, retenues],
    )

    const surScroll = useAnimatedScrollHandler({
        onScroll: e => {
            scrollX.value = e.contentOffset.x
            const i = Math.round(e.contentOffset.x / L)
            if (i !== dernierRang.value) {
                dernierRang.value = i
                runOnJS(setRang)(i)
            }
        },
    })

    const partager = async () => {
        if (!prop) return
        try {
            await Share.share({
                message: t('Ma proposition Retour Gagnant : {u}', { u: `${API_BASE}/p/${prop.secret_key}` }),
                url: `${API_BASE}/p/${prop.secret_key}`,
            })
        } catch { toast(t('Partage impossible'), t('Réessayez dans un instant.')) }
    }

    if (chargement) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            </View>
        )
    }

    if (erreur || !prop) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.centre}>
                    <Text style={styles.erreur}>{erreur || t('Proposition introuvable.')}</Text>
                    <Pressable onPress={() => navigation.goBack()} style={styles.btnRetour} accessibilityRole="button">
                        <Text style={styles.btnRetourText}>{t('Retour')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    const periode = [dateFr(prop.start_date), dateFr(prop.end_date)].filter(Boolean).join(' → ')
    const signee = !!prop.signed_at
    const reglee = prop.status === 'paid'
    const hauteurDeck = Dimensions.get('window').height - insets.top - insets.bottom - 214

    /* ── Ouverture : le séjour se présente avant de se détailler ── */
    if (intro) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.header}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <View style={{ flex: 1 }} />
                    <Pressable onPress={partager} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                        <Share2 size={19} color={C.text} strokeWidth={2} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.intro} showsVerticalScrollIndicator={false}>
                    {!!prop.intro_image && (
                        <Animated.Image
                            entering={FadeIn.duration(600)}
                            source={{ uri: prop.intro_image }}
                            style={styles.introImg}
                            resizeMode="cover"
                        />
                    )}
                    <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.badge}>
                        <Sparkles size={13} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.badgeText}>{t('Votre proposition')}</Text>
                    </Animated.View>
                    <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.h1}>
                        {prop.intro_title || prop.destination || t('Votre séjour')}
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(280).duration(500)} style={styles.metaRow}>
                        {!!prop.destination && (
                            <View style={styles.meta}>
                                <MapPin size={12} color={C.primary} />
                                <Text style={styles.metaText}>{prop.destination}</Text>
                            </View>
                        )}
                        {!!periode && (
                            <View style={styles.meta}>
                                <CalendarDays size={12} color={C.primary} />
                                <Text style={styles.metaText}>{periode}</Text>
                            </View>
                        )}
                    </Animated.View>

                    {!!prop.intro_text && (
                        <Animated.Text entering={FadeInDown.delay(360).duration(500)} style={styles.introTexte}>
                            {prop.intro_text}
                        </Animated.Text>
                    )}

                    <Animated.View entering={FadeInDown.delay(440).duration(500)}>
                        <Pressable
                            onPress={() => setIntro(false)}
                            style={({ pressed }) => [styles.ctaIntro, pressed && { transform: [{ scale: 0.97 }] }]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaIntroText}>
                                {prestations.length > 0
                                    ? t('Découvrir les {n} prestations', { n: prestations.length })
                                    : t('Ouvrir la proposition')}
                            </Text>
                            <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.4} />
                        </Pressable>
                    </Animated.View>
                </ScrollView>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable onPress={() => setIntro(true)} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1}>{prop.destination || t('Proposition')}</Text>
                <Pressable onPress={partager} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            {/* Avancement : une barre par slide, celle en cours en vert. */}
            <View style={styles.rythme}>
                {prestations.map((p, i) => (
                    <View key={p.id} style={[styles.segment, i === rang && styles.segmentOn]} />
                ))}
            </View>

            {prestations.length === 0 ? (
                <View style={styles.centre}>
                    <Text style={styles.erreur}>
                        {t('Cette proposition ne détaille pas encore de prestations.')}
                    </Text>
                </View>
            ) : (
                <Animated.ScrollView
                    ref={listeRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={surScroll}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                >
                    {prestations.map((p, i) => (
                        <Slide
                            key={p.id}
                            p={p}
                            index={i}
                            scrollX={scrollX}
                            retenu={retenues.has(p.id)}
                            onToggle={() => basculer(p.id)}
                            devise={prop.currency}
                            hauteur={hauteurDeck}
                            t={t}
                        />
                    ))}
                </Animated.ScrollView>
            )}

            {/* Total vivant + action */}
            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.barreHaut}>
                    <View>
                        <Text style={styles.barreLabel}>
                            {retenues.size}/{prestations.length} {t('retenues')}
                        </Text>
                        <Text style={styles.barreTotal}>{money(total, prop.currency)}</Text>
                    </View>
                    {reglee ? (
                        <View style={styles.regleeTag}>
                            <CircleCheck size={15} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.regleeText}>{t('Réglée')}</Text>
                        </View>
                    ) : signee ? (
                        <Pressable
                            onPress={() => navigation.navigate('DevisPaiement', { secretKey: prop.secret_key })}
                            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
                            accessibilityRole="button"
                        >
                            <CreditCard size={16} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaText}>{t('Régler')}</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={() => navigation.navigate('SignatureDevis', {
                                proposalId: prop.id, secretKey: prop.secret_key, selection: [...retenues],
                            })}
                            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
                            accessibilityRole="button"
                        >
                            <PenLine size={16} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaText}>{t('Signer le devis')}</Text>
                        </Pressable>
                    )}
                </View>
                <Text style={styles.barreNote}>
                    {t('Balayez pour parcourir · votre sélection est enregistrée avec votre signature.')}
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    rythme: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.gutter, paddingBottom: spacing.sm },
    segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.border },
    segmentOn: { backgroundColor: C.primary },

    /* Ouverture */
    intro: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
    introImg: { width: '100%', height: 210, borderRadius: radius.xl, marginBottom: spacing.lg },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.sm },
    badgeText: { ...typography.button, fontSize: 11.5, color: C.primary },
    h1: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, color: C.text },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: C.textSec },
    introTexte: { ...typography.body, color: C.textSec, lineHeight: 23, marginTop: spacing.md },
    ctaIntro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, marginTop: spacing.xl },
    ctaIntroText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },

    /* Slide */
    cadrePhoto: { height: '52%', marginHorizontal: spacing.gutter, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: C.surfaceAlt },
    pastilleFamille: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, ...shadows.card },
    pastilleText: { fontFamily: fonts.bold, fontSize: 10.5, color: C.primary, textTransform: 'uppercase', letterSpacing: 1 },
    case: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: radius.pill, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadows.card },
    caseOn: { backgroundColor: C.primary },
    vignettes: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', gap: 6 },
    vignette: { width: 34, height: 34, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF' },
    vignetteOn: { borderColor: C.primary },
    vignetteImg: { width: '100%', height: '100%' },

    corps: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.lg },
    titre: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, color: C.text },
    sousTitre: { fontFamily: fonts.body, fontSize: 14, color: C.textSec, marginTop: 4 },
    lieu: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
    lieuText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: C.textSec },
    desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: C.textSec, marginTop: spacing.md },
    puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.md },
    puce: { backgroundColor: C.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
    puceText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: C.textSec },

    piedSlide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    prix: { fontFamily: fonts.extrabold, fontSize: 18, color: '#00643C' },
    prixOff: { color: C.textMuted, textDecorationLine: 'line-through' },
    etat: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.textMuted },
    etatOn: { color: C.primary },

    /* Barre de total */
    barre: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    barreHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    barreLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    barreTotal: { fontFamily: fonts.extrabold, fontSize: 22, color: '#00643C', marginTop: 1 },
    barreNote: { fontFamily: fonts.body, fontSize: 10.5, color: C.textMuted, marginTop: 8, textAlign: 'center' },
    cta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 14 },
    ctaText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' },
    regleeTag: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12 },
    regleeText: { fontFamily: fonts.bold, fontSize: 13.5, color: C.primary },

    erreur: { ...typography.body, color: C.textMuted, textAlign: 'center' },
    btnRetour: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 13 },
    btnRetourText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
})
