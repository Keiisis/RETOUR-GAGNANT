/* ═══════════════════════════════════════════════════════════
   Proposition de séjour — portage natif de l'export Sleek (4 vues).

   La proposition s'ouvrait dans une WebView : mise en page pour grand écran,
   aucune sélection possible. Elle se lit désormais en trois temps :

   · OUVERTURE — la couverture : photo panoramique, durée réelle du séjour,
     référence du dossier, mot du conseiller, repères chiffrés.
   · DECK — une prestation par écran, balayable. La photo respire en continu
     (panoramique lent) et glisse à contre-sens du doigt (parallaxe) : la
     profondeur naît de ce décalage. Le texte se pose en cascade à l'arrivée.
     Un appui garde ou retire, avec retour haptique ; le total suit.
   · RÉCAPITULATIF — l'étape finale : ce qui est retenu, ce qui a été retiré,
     l'économie réalisée, puis la signature.
   Et l'état VIDE quand le conseiller n'a pas encore composé le séjour.

   Fidélité à l'export : structure, tailles, graisses, rayons repris tels
   quels. Les blocs que la base ne peut pas nourrir (portrait et nom du
   conseiller, nombre de voyageurs, prix à la nuit, échéancier d'acompte) ne
   sont pas inventés : ils cèdent la place à ce qui est vrai.

   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, Image, Dimensions, Modal, TextInput,
    ActivityIndicator, Share, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
    ChevronLeft, Share2, Check, MapPin, CalendarDays, Bed, UtensilsCrossed,
    Camera, Car, MapPinned, PenLine, CreditCard, CircleCheck, ArrowRight,
    ArrowLeft, ShieldCheck, Clock4, Plus, Minus, Compass, MessageCircle, Lock, Download,
    Users, Send, X, Bot,
} from 'lucide-react-native'
import Animated, {
    FadeInDown, FadeIn, Easing, Extrapolation, interpolate,
    useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
    withRepeat, withTiming, runOnJS,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { avecMemoire } from '../../lib/memoire'
import { telechargerDocument } from '../../lib/documents'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const { width: L } = Dimensions.get('window')
const VERT_PROFOND = '#00643C'
const VERT_LISERE = 'rgba(0,135,81,0.15)'

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
    intro_images?: string[]
    nb_voyageurs?: number | null
    conseiller?: Conseiller | null
}

interface Conseiller {
    id: number
    nom: string
    role: string
    avatar_url: string | null
}

interface MessageIA {
    id?: string
    role: 'user' | 'assistant'
    content: string
}

const FAMILLES: Record<string, { l: string; Icone: typeof Bed }> = {
    hotel: { l: 'Hébergement', Icone: Bed },
    hebergement: { l: 'Hébergement', Icone: Bed },
    restaurant: { l: 'Restauration', Icone: UtensilsCrossed },
    activity: { l: 'Activité', Icone: Camera },
    activite: { l: 'Activité', Icone: Camera },
    transport: { l: 'Transport', Icone: Car },
}
const familleDe = (t: string | null) => FAMILLES[String(t || '').toLowerCase()] || { l: 'Expérience', Icone: MapPinned }

const somme = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0)

const money = (v: number, devise: string | null) =>
    `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} ${devise === 'XOF' || !devise ? 'FCFA' : devise}`

const dateFr = (iso: string | null, avecAnnee = false) => {
    if (!iso) return null
    try {
        return new Date(iso).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', ...(avecAnnee ? { year: 'numeric' } : {}),
        })
    } catch { return null }
}

/** Durée réelle du séjour, déduite des dates. Rien ne s'affiche sans elles. */
const dureeSejour = (debut: string | null, fin: string | null) => {
    if (!debut || !fin) return null
    const d = new Date(debut).getTime(), f = new Date(fin).getTime()
    if (Number.isNaN(d) || Number.isNaN(f) || f < d) return null
    const nuits = Math.round((f - d) / 86400000)
    if (nuits <= 0) return null
    return { jours: nuits + 1, nuits }
}

/* ── Une slide du deck ───────────────────────────────────────
   `scrollX` est partagé : chaque slide calcule sa position relative et en
   déduit sa parallaxe. Tout vit sur le fil d'animation — le doigt ne dépend
   jamais du fil JS. */
function Slide({
    p, index, total, scrollX, retenu, onToggle, devise, hauteur, suivant, t,
}: {
    p: Prestation
    index: number
    total: number
    scrollX: SharedValue<number>
    retenu: boolean
    onToggle: () => void
    devise: string | null
    hauteur: number
    suivant: string | null
    t: (s: string, v?: Record<string, string | number>) => string
}) {
    const { l: famille, Icone } = familleDe(p.type)
    const prix = somme(p.selling_price)
    const barre = somme(p.original_price)
    const remise = barre > prix && prix > 0 ? Math.round(((barre - prix) / barre) * 100) : 0
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
        const d = scrollX.value - index * L
        const parallaxe = interpolate(d, [-L, 0, L], [L * 0.3, 0, -L * 0.3], Extrapolation.CLAMP)
        const derive = interpolate(pano.value, [0, 1], [-14, 14])
        const zoom = interpolate(pano.value, [0, 1], [1.08, 1.17])
        return { transform: [{ translateX: parallaxe + derive }, { scale: zoom }] }
    })

    /* Le contenu s'efface quand la slide quitte l'écran : l'œil sait laquelle
       est active sans qu'on le lui dise. */
    const styleCorps = useAnimatedStyle(() => {
        const d = Math.abs(scrollX.value - index * L)
        return {
            opacity: interpolate(d, [0, L * 0.7], [1, 0], Extrapolation.CLAMP),
            transform: [{ translateY: interpolate(d, [0, L], [0, 30], Extrapolation.CLAMP) }],
        }
    })

    return (
        <View style={{ width: L, height: hauteur }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.slideScroll}>
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

                    <Animated.View entering={FadeIn.delay(100)} style={styles.pastilleFamille}>
                        <Icone size={14} color={C.primary} strokeWidth={2.4} />
                        <Text style={styles.pastilleText}>{t(famille)}</Text>
                    </Animated.View>

                    {/* Garder / retirer : la décision se prend devant l'image. */}
                    <Pressable
                        onPress={onToggle}
                        style={({ pressed }) => [
                            styles.garder, retenu ? styles.garderOn : styles.garderOff,
                            pressed && { transform: [{ scale: 0.9 }] },
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: retenu }}
                        hitSlop={8}
                    >
                        {retenu
                            ? <Check size={16} color="#FFFFFF" strokeWidth={2.6} />
                            : <Plus size={16} color={C.primary} strokeWidth={2.6} />}
                        <Text style={[styles.garderText, retenu && { color: '#FFFFFF' }]}>
                            {retenu ? t('Conservé') : t('Rajouter')}
                        </Text>
                    </Pressable>

                    {photos.length > 1 && (
                        <View style={styles.vignettes}>
                            {photos.slice(0, 3).map((u, i) => (
                                <Pressable key={u + i} onPress={() => setPhoto(i)} hitSlop={6}>
                                    <View style={[styles.vignette, i === photo && styles.vignetteOn]}>
                                        <Image source={{ uri: u }} style={styles.vignetteImg} resizeMode="cover" />
                                    </View>
                                </Pressable>
                            ))}
                            {photos.length > 3 && (
                                <View style={styles.vignettePlus}>
                                    <Text style={styles.vignettePlusText}>+{photos.length - 3}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {remise > 0 && (
                        <View style={styles.badgeRemise}>
                            <Text style={styles.badgeRemiseText}>-{remise} %</Text>
                        </View>
                    )}
                </View>

                <Animated.View style={[styles.corps, styleCorps]}>
                    <View style={styles.ligneTitre}>
                        <View style={{ flex: 1 }}>
                            <Animated.Text entering={FadeInDown.delay(60).duration(420)} style={styles.overline}>
                                {t('Prestation {i} sur {n}', { i: index + 1, n: total })}
                            </Animated.Text>
                            <Animated.Text entering={FadeInDown.delay(120).duration(420)} style={styles.titre}>
                                {p.title || t('Prestation')}
                            </Animated.Text>
                            {!!p.location && (
                                <Animated.View entering={FadeInDown.delay(190).duration(420)} style={styles.lieu}>
                                    <MapPin size={14} color={C.primary} strokeWidth={2.2} />
                                    <Text style={styles.lieuText} numberOfLines={2}>{p.location}</Text>
                                </Animated.View>
                            )}
                        </View>
                        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.blocPrix}>
                            <Text style={[styles.prix, !retenu && styles.prixOff]}>
                                {prix > 0 ? money(prix, devise) : t('Compris')}
                            </Text>
                            {barre > prix && prix > 0 && (
                                <Text style={styles.prixBarre}>{money(barre, devise)}</Text>
                            )}
                        </Animated.View>
                    </View>

                    {!!p.subtitle && (
                        <Animated.Text entering={FadeInDown.delay(230).duration(420)} style={styles.sousTitre}>
                            {p.subtitle}
                        </Animated.Text>
                    )}

                    {!!p.description && (
                        <Animated.Text entering={FadeInDown.delay(280).duration(420)} style={styles.desc}>
                            {p.description}
                        </Animated.Text>
                    )}

                    {!!p.highlights?.length && (
                        <View style={styles.puces}>
                            {p.highlights.slice(0, 6).map((h, i) => (
                                <Animated.View key={h + i} entering={FadeInDown.delay(330 + i * 70).duration(380)} style={styles.puce}>
                                    <Check size={13} color={C.primary} strokeWidth={2.6} />
                                    <Text style={styles.puceText}>{h}</Text>
                                </Animated.View>
                            ))}
                        </View>
                    )}

                    <View style={styles.indice}>
                        <View style={styles.indiceCote}>
                            <ArrowLeft size={12} color={C.textMuted} />
                            <Text style={styles.indiceText}>{t('Glisser pour naviguer')}</Text>
                        </View>
                        {!!suivant && (
                            <View style={styles.indiceCote}>
                                <Text style={styles.indiceText} numberOfLines={1}>
                                    {t('Suivant : {s}', { s: suivant })}
                                </Text>
                                <ArrowRight size={12} color={C.textMuted} />
                            </View>
                        )}
                    </View>
                </Animated.View>
            </ScrollView>
        </View>
    )
}

/* -- Conseiller IA -------------------------------------------
   Le mot d'accueil avait un auteur mais pas de voix. Ici le client
   l'interroge sur SA proposition : le serveur donne à l'assistant les
   prestations réelles, il ne peut donc pas inventer un tarif. */
function ConseillerIA({
    visible, onClose, proposalId, conseiller, t,
}: {
    visible: boolean
    onClose: () => void
    proposalId: string
    conseiller: Conseiller | null
    t: (s: string, v?: Record<string, string | number>) => string
}) {
    const insets = useSafeAreaInsets()
    const [messages, setMessages] = useState<MessageIA[]>([])
    const [question, setQuestion] = useState('')
    const [envoi, setEnvoi] = useState(false)
    const [charge, setCharge] = useState(false)

    const nom = conseiller?.nom || t('Assistant Retour Gagnant')

    useEffect(() => {
        if (!visible || charge) return
        setCharge(true)
        const lire = async () => {
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}/assistant`, {
                    headers: { ...(await authHeaders()) }, timeoutMs: 12000,
                })
                const json = await res.json().catch(() => ({}))
                if (Array.isArray(json.messages)) setMessages(json.messages)
            } catch { /* le fil s'ouvre vide, ce n'est pas bloquant */ }
        }
        lire()
    }, [visible, charge, proposalId])

    const demander = async () => {
        const q = question.trim()
        if (!q || envoi) return
        setQuestion('')
        setMessages(m => [...m, { role: 'user', content: q }])
        setEnvoi(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}/assistant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 30000,
                body: JSON.stringify({ question: q }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.reponse) throw new Error(json.error || t('Réponse indisponible.'))
            setMessages(m => [...m, { role: 'assistant', content: String(json.reponse) }])
        } catch (e) {
            toast(t('Assistant indisponible'), e instanceof Error ? e.message : t('Réessayez dans un instant.'))
        } finally { setEnvoi(false) }
    }

    const SUGGESTIONS = [
        'Que comprend exactement ce séjour ?',
        'Puis-je modifier les dates ?',
        'Comment se règle le devis ?',
    ]

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.entete}>
                    <Pressable onPress={onClose} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Fermer')}>
                        <X size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={styles.deckOverline}>{conseiller?.role || t('Conseiller séjour')}</Text>
                        <Text style={styles.deckFamille} numberOfLines={1}>{nom}</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.filScroll} showsVerticalScrollIndicator={false}>
                        {messages.length === 0 && (
                            <View style={styles.filVide}>
                                <View style={styles.motTuile}>
                                    <Bot size={20} color={C.primary} strokeWidth={2.2} />
                                </View>
                                <Text style={styles.filVideTitre}>{t('Une question sur votre séjour ?')}</Text>
                                <Text style={styles.filVideTexte}>
                                    {t('Je connais chaque prestation de votre proposition : prix, lieux, ce qui est compris.')}
                                </Text>
                                <View style={styles.suggestions}>
                                    {SUGGESTIONS.map(sg => (
                                        <Pressable key={sg} onPress={() => setQuestion(t(sg))} style={styles.suggestion} accessibilityRole="button">
                                            <Text style={styles.suggestionText}>{t(sg)}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {messages.map((m, i) => (
                            <Animated.View
                                key={m.id || `${m.role}-${i}`}
                                entering={FadeInDown.duration(320)}
                                style={[styles.bulle, m.role === 'user' ? styles.bulleMoi : styles.bulleIA]}
                            >
                                <Text style={[styles.bulleText, m.role === 'user' && { color: '#FFFFFF' }]}>
                                    {m.content}
                                </Text>
                            </Animated.View>
                        ))}

                        {envoi && (
                            <View style={[styles.bulle, styles.bulleIA]}>
                                <ActivityIndicator color={C.primary} size="small" />
                            </View>
                        )}
                    </ScrollView>

                    <View style={[styles.saisie, { paddingBottom: insets.bottom + 10 }]}>
                        <TextInput
                            value={question}
                            onChangeText={setQuestion}
                            placeholder={t('Écrire à {n}…', { n: nom })}
                            placeholderTextColor={C.textMuted}
                            style={styles.champ}
                            multiline
                            maxLength={600}
                        />
                        <Pressable
                            onPress={demander}
                            disabled={!question.trim() || envoi}
                            style={({ pressed }) => [
                                styles.envoyer,
                                (!question.trim() || envoi) && { opacity: 0.4 },
                                pressed && { transform: [{ scale: 0.94 }] },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={t('Envoyer')}
                        >
                            <Send size={18} color="#FFFFFF" strokeWidth={2.2} />
                        </Pressable>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}

type Vue = 'ouverture' | 'deck' | 'recap'

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
    const [vue, setVue] = useState<Vue>('ouverture')
    const [conseillerOuvert, setConseillerOuvert] = useState(false)
    const [couverture, setCouverture] = useState(0)

    const scrollX = useSharedValue(0)
    // Dernier rang notifié au fil JS : sans ce garde-fou, chaque image de
    // défilement déclencherait un rendu React et le balayage saccaderait.
    const dernierRang = useSharedValue(0)

    const charger = useCallback(async () => {
        setErreur('')
        /* La proposition deja consultee se rouvre instantanement. Fraicheur
           zero : elle porte des PRIX, le reseau est donc toujours interroge et
           le contenu remplace des qu'il repond. */
        const r = await avecMemoire<{ proposal: Proposition; prestations: Prestation[] }>(
            `proposition:${proposalId}`,
            async () => {
                const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}`, {
                    headers: { ...(await authHeaders()) },
                    timeoutMs: 15000,
                })
                const json = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(json.error || `Chargement impossible (erreur ${res.status}).`)
                return {
                    proposal: json.proposal,
                    prestations: Array.isArray(json.prestations) ? json.prestations : [],
                }
            },
            (v) => {
                setProp(v.proposal)
                setPrestations(v.prestations)
                // Tout est retenu au départ : la proposition du conseiller est le
                // point de départ, le client retire ce qu'il ne veut pas.
                setRetenues(new Set(v.prestations.map(p => p.id)))
                setChargement(false)
            },
            { fraicheurMs: 0 },
        )
        if (!r.ok && r.erreur) setErreur(r.erreur)
        setChargement(false)
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

    const gardees = useMemo(() => prestations.filter(p => retenues.has(p.id)), [prestations, retenues])
    const ecartees = useMemo(() => prestations.filter(p => !retenues.has(p.id)), [prestations, retenues])
    const total = useMemo(() => gardees.reduce((s, p) => s + somme(p.selling_price), 0), [gardees])
    const economie = useMemo(() => ecartees.reduce((s, p) => s + somme(p.selling_price), 0), [ecartees])

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

    /* Le devis PDF, tel que le client l'a composé : on transmet les
       prestations RETENUES, sinon le document facturerait ce qu'il a écarté. */
    const [devisEnCours, setDevisEnCours] = useState(false)
    const telechargerDevis = async () => {
        if (!prop || devisEnCours) return
        setDevisEnCours(true)
        try {
            const choisies = [...retenues].join(',')
            const r = await telechargerDocument(
                `${API_BASE}/api/proposals/${prop.id}/devis?selection=${encodeURIComponent(choisies)}`,
                `Devis-${(prop.destination || 'sejour').replace(/\s+/g, '-')}`,
            )
            if (!r.ok) {
                toast(t('Téléchargement impossible'), r.erreur || t('Réessayez dans un instant.'))
            } else if (!r.partage) {
                toast(t('Devis enregistré'), t('Le document est sur votre téléphone.'))
            }
        } finally { setDevisEnCours(false) }
    }

    const signer = () => {
        if (!prop) return
        navigation.navigate('SignatureDevis', {
            proposalId: prop.id, secretKey: prop.secret_key, selection: [...retenues],
        })
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

    const duree = dureeSejour(prop.start_date, prop.end_date)
    const periode = [dateFr(prop.start_date), dateFr(prop.end_date, true)].filter(Boolean).join(' – ')
    const signee = !!prop.signed_at
    const reglee = prop.status === 'paid'
    const familles = new Set(prestations.map(p => familleDe(p.type).l)).size
    const budgetInitial = prestations.reduce((s, p) => s + somme(p.selling_price), 0) || somme(prop.total_amount)
    const titreSejour = prop.intro_title || prop.destination || t('Votre séjour')
    const voyageurs = Math.max(1, Number(prop.nb_voyageurs) || 1)
    const conseiller = prop.conseiller || null
    // Galerie de l'ouverture : les visuels que l'agent a téléversés depuis le
    // concepteur de Smart Slides, pas seulement la vignette de couverture.
    const photosIntro = (prop.intro_images?.length ? prop.intro_images : prop.intro_image ? [prop.intro_image] : [])
    const photoIntro = photosIntro[Math.min(couverture, photosIntro.length - 1)] || null

    /* ══ VIDE — le conseiller n'a pas encore composé le séjour ══ */
    if (prestations.length === 0) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.entete}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={styles.enteteDiscret}>{t('Proposition de voyage')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.vide}>
                    <Animated.View entering={FadeIn.duration(500)} style={styles.videTuile}>
                        <Compass size={36} color={C.primary} strokeWidth={1.8} />
                    </Animated.View>

                    <Animated.Text entering={FadeInDown.delay(120).duration(450)} style={styles.videOverline}>
                        {t('Itinéraire en préparation')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(180).duration(450)} style={styles.videTitre}>
                        {t('Aucune prestation détaillée')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(240).duration(450)} style={styles.videTexte}>
                        {t('Votre conseiller affine actuellement la sélection de vos hébergements, guides et expériences au Bénin.')}
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(310).duration(450)} style={styles.videCarte}>
                        <View style={styles.videCarteEntete}>
                            <View style={styles.motTuile}>
                                <MapPinned size={18} color={C.primary} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.motTitre}>{titreSejour}</Text>
                                <Text style={styles.motSous}>
                                    {periode || t('Dates à confirmer avec votre conseiller')}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.videCarteTexte}>
                            {t('Vous recevrez une notification dès la publication du devis, directement dans cette application.')}
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(380).duration(450)} style={styles.videActions}>
                        <Pressable
                            onPress={() => navigation.navigate('Main', { screen: 'Messages' })}
                            style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                            accessibilityRole="button"
                        >
                            <MessageCircle size={16} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaLargeText}>{t('Contacter mon conseiller')}</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => navigation.goBack()}
                            style={({ pressed }) => [styles.ctaSecondaire, pressed && { transform: [{ scale: 0.98 }] }]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaSecondaireText}>{t('Retour')}</Text>
                        </Pressable>
                    </Animated.View>
                </View>

                <View style={[styles.piedSignature, { paddingBottom: insets.bottom + 12 }]}>
                    <Text style={styles.piedSignatureText}>
                        {t('Agence Retour Gagnant Bénin · Accompagnement diaspora')}
                    </Text>
                </View>
            </View>
        )
    }

    /* ══ OUVERTURE ══ */
    if (vue === 'ouverture') {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.entete}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <View style={styles.piluleEntete}>
                        <View style={styles.pointVert} />
                        <Text style={styles.piluleEnteteText}>{t('Votre proposition')}</Text>
                    </View>
                    <Pressable onPress={partager} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                        <Share2 size={18} color={C.text} strokeWidth={2} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
                    {!!photoIntro && (
                        <Animated.View entering={FadeIn.duration(600)} style={styles.introCadre}>
                            <Image source={{ uri: photoIntro }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            {!!duree && (
                                <View style={styles.introPastille}>
                                    <MapPinned size={14} color={C.primary} strokeWidth={2.2} />
                                    <Text style={styles.introPastilleText}>
                                        {t('Séjour {j} jours / {n} nuits', { j: duree.jours, n: duree.nuits })}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.introRef}>
                                <Text style={styles.introRefText}>
                                    {t('Réf : RG-{r}', { r: prop.id.slice(0, 8).toUpperCase() })}
                                </Text>
                            </View>

                            {photosIntro.length > 1 && (
                                <View style={styles.vignettes}>
                                    {photosIntro.slice(0, 4).map((u, i) => (
                                        <Pressable key={u + i} onPress={() => setCouverture(i)} hitSlop={6}>
                                            <View style={[styles.vignette, i === couverture && styles.vignetteOn]}>
                                                <Image source={{ uri: u }} style={styles.vignetteImg} resizeMode="cover" />
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    <Animated.Text entering={FadeInDown.delay(120).duration(500)} style={styles.introOverline}>
                        {t('Séjour sur-mesure diaspora')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(180).duration(500)} style={styles.h1}>
                        {titreSejour}
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.chips}>
                        {!!prop.destination && (
                            <View style={styles.chip}>
                                <MapPin size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.chipText}>{prop.destination}</Text>
                            </View>
                        )}
                        {!!periode && (
                            <View style={styles.chip}>
                                <CalendarDays size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.chipText}>{periode}</Text>
                            </View>
                        )}
                        <View style={styles.chip}>
                            <Users size={14} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.chipText}>
                                {voyageurs > 1 ? t('{n} voyageurs', { n: voyageurs }) : t('1 voyageur')}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Mot du conseiller — portrait et nom ne sont pas en base :
                        on ne les invente pas, le texte porte seul. */}
                    <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.carteMot}>
                        <View style={styles.motEntete}>
                            {conseiller?.avatar_url ? (
                                <Image source={{ uri: conseiller.avatar_url }} style={styles.motAvatar} resizeMode="cover" />
                            ) : (
                                <View style={styles.motTuile}>
                                    <Bot size={18} color={C.primary} strokeWidth={2.2} />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.motTitre}>{conseiller?.nom || t('Assistant Retour Gagnant')}</Text>
                                <Text style={styles.motSous}>
                                    {conseiller?.role || t('Conseiller séjour diaspora')}
                                </Text>
                            </View>
                            <View style={styles.motPastille}>
                                <View style={styles.pointVert} />
                                <Text style={styles.motPastilleText}>{t('En ligne')}</Text>
                            </View>
                        </View>

                        {!!prop.intro_text && <Text style={styles.motTexte}>« {prop.intro_text} »</Text>}

                        <Pressable
                            onPress={() => setConseillerOuvert(true)}
                            style={({ pressed }) => [styles.motAction, pressed && { transform: [{ scale: 0.98 }] }]}
                            accessibilityRole="button"
                        >
                            <MessageCircle size={15} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.motActionText}>{t('Poser une question sur ce séjour')}</Text>
                        </Pressable>

                        <View style={styles.motPied}>
                            <View style={styles.motPiedCote}>
                                <ShieldCheck size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.motPiedText}>{t('Tarifs négociés')}</Text>
                            </View>
                            <View style={styles.motPiedCote}>
                                <Clock4 size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.motPiedText}>{t('Modifiable jusqu’à signature')}</Text>
                            </View>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.reperes}>
                        <View style={styles.repere}>
                            <Text style={styles.repereChiffre}>{prestations.length}</Text>
                            <Text style={styles.repereLabel}>{t('Prestations')}</Text>
                        </View>
                        <View style={styles.repere}>
                            <Text style={styles.repereChiffre}>{familles}</Text>
                            <Text style={styles.repereLabel}>{t('Catégories')}</Text>
                        </View>
                        <View style={styles.repere}>
                            <Text style={styles.repereChiffre}>100%</Text>
                            <Text style={styles.repereLabel}>{t('Modulable')}</Text>
                        </View>
                    </Animated.View>
                </ScrollView>

                <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                    <View style={styles.barreHaut}>
                        <View>
                            <Text style={styles.barreLabel}>{t('Budget estimatif initial')}</Text>
                            <Text style={styles.barreTotalPetit}>{money(budgetInitial, prop.currency)}</Text>
                        </View>
                        <View style={styles.pilulePetite}>
                            <Text style={styles.pilulePetiteText}>
                                {t('{k}/{n} incluses', { k: retenues.size, n: prestations.length })}
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={() => setVue('deck')}
                        style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <Text style={styles.ctaLargeText}>
                            {t('Découvrir les {n} prestations', { n: prestations.length })}
                        </Text>
                        <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </Pressable>
                </View>

                <ConseillerIA
                    visible={conseillerOuvert}
                    onClose={() => setConseillerOuvert(false)}
                    proposalId={prop.id}
                    conseiller={conseiller}
                    t={t}
                />
            </View>
        )
    }

    /* ══ RÉCAPITULATIF ══ */
    if (vue === 'recap') {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.entete}>
                    <Pressable onPress={() => setVue('deck')} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour au deck')}>
                        <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.deckOverline}>{t('Étape finale')}</Text>
                        <Text style={styles.deckFamille}>{t('Récapitulatif & signature')}</Text>
                    </View>
                    <Pressable onPress={partager} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                        <Share2 size={18} color={C.textSec} strokeWidth={2} />
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.recapScroll} showsVerticalScrollIndicator={false}>
                    <Animated.Text entering={FadeInDown.duration(420)} style={styles.introOverline}>
                        {t('Votre devis ajusté')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(70).duration(420)} style={styles.recapTitre}>
                        {titreSejour}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(140).duration(420)} style={styles.recapIntro}>
                        {t('Vérifiez les prestations retenues avant de signer votre devis.')}
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(200).duration(420)} style={styles.recapCarte}>
                        <View style={styles.recapCarteEntete}>
                            <Text style={styles.recapCarteTitre}>
                                {t('Prestations sélectionnées ({k}/{n})', { k: gardees.length, n: prestations.length })}
                            </Text>
                            <Pressable onPress={() => setVue('deck')} hitSlop={8} accessibilityRole="button">
                                <Text style={styles.recapAjustable}>{t('Ajustable')}</Text>
                            </Pressable>
                        </View>

                        {gardees.map((p, i) => (
                            <View key={p.id} style={[styles.recapLigne, i > 0 && styles.recapLigneSep]}>
                                <View style={styles.recapPastilleOn}>
                                    <Check size={16} color={C.primary} strokeWidth={2.6} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.recapNom} numberOfLines={2}>{p.title || t('Prestation')}</Text>
                                    <Text style={styles.recapMeta} numberOfLines={1}>
                                        {[t(familleDe(p.type).l), p.location].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                <Text style={styles.recapPrix}>
                                    {somme(p.selling_price) > 0 ? money(somme(p.selling_price), prop.currency) : t('Compris')}
                                </Text>
                            </View>
                        ))}

                        {/* Ce qui a été retiré reste visible : le client doit
                            pouvoir vérifier ce qu'il ne paiera pas. */}
                        {ecartees.map(p => (
                            <Pressable
                                key={p.id}
                                onPress={() => basculer(p.id)}
                                style={[styles.recapLigne, styles.recapLigneSep, styles.recapLigneOff]}
                                accessibilityRole="button"
                                accessibilityLabel={t('Rajouter cette prestation')}
                            >
                                <View style={styles.recapPastilleOff}>
                                    <Minus size={14} color={C.textMuted} strokeWidth={2.4} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.recapNomOff} numberOfLines={2}>{p.title || t('Prestation')}</Text>
                                    <Text style={styles.recapMeta}>{t('Prestation décochée · toucher pour rajouter')}</Text>
                                </View>
                                <Text style={styles.recapPrixOff}>
                                    {somme(p.selling_price) > 0 ? money(somme(p.selling_price), prop.currency) : '—'}
                                </Text>
                            </Pressable>
                        ))}
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(280).duration(420)} style={styles.recapBloc}>
                        <View style={styles.recapBlocLigne}>
                            <Text style={styles.recapBlocLabel}>{t('Total des prestations retenues')}</Text>
                            <Text style={styles.recapBlocFort}>{money(total, prop.currency)}</Text>
                        </View>
                        {economie > 0 && (
                            <View style={styles.recapBlocLigne}>
                                <Text style={styles.recapBlocLabelDoux}>{t('Prestations retirées')}</Text>
                                <Text style={styles.recapBlocDoux}>− {money(economie, prop.currency)}</Text>
                            </View>
                        )}
                        <View style={styles.recapBlocPied}>
                            <View style={styles.motPiedCote}>
                                <ShieldCheck size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.motPiedText}>{t('Règlement en une fois')}</Text>
                            </View>
                            <View style={styles.motPiedCote}>
                                <Lock size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.motPiedText}>{t('Devis certifié RGB')}</Text>
                            </View>
                        </View>
                    </Animated.View>
                </ScrollView>

                <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                    <View style={styles.barreHaut}>
                        <View>
                            <Text style={styles.barreLabel}>{t('Total final devis')}</Text>
                            <Text style={styles.barreTotal}>{money(total, prop.currency)}</Text>
                        </View>
                        {economie > 0 && (
                            <View style={styles.pilulePetite}>
                                <Text style={styles.pilulePetiteText}>
                                    {t('Économie de {m}', { m: money(economie, prop.currency) })}
                                </Text>
                            </View>
                        )}
                    </View>
                    {reglee ? (
                        <View style={styles.regleeLarge}>
                            <CircleCheck size={16} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.regleeText}>{t('Proposition réglée. Merci !')}</Text>
                        </View>
                    ) : signee ? (
                        <Pressable
                            onPress={() => navigation.navigate('DevisPaiement', { secretKey: prop.secret_key, proposalId: prop.id, selection: [...retenues] })}
                            style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                            accessibilityRole="button"
                        >
                            <CreditCard size={18} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaLargeText}>{t('Régler mon séjour')}</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={signer}
                            style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                            accessibilityRole="button"
                        >
                            <PenLine size={18} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaLargeText}>{t('Signer le devis en ligne')}</Text>
                        </Pressable>
                    )}
                    <Pressable
                        onPress={telechargerDevis}
                        disabled={devisEnCours}
                        style={({ pressed }) => [styles.ctaVide, devisEnCours && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        {devisEnCours
                            ? <ActivityIndicator color={C.primary} size="small" />
                            : <Download size={16} color={C.text} strokeWidth={2.2} />}
                        <Text style={styles.ctaVideText}>
                            {devisEnCours ? t('Préparation du devis…') : t('Télécharger le devis (PDF)')}
                        </Text>
                    </Pressable>

                    <Pressable onPress={() => setConseillerOuvert(true)} style={styles.lienConseiller} accessibilityRole="button">
                        <MessageCircle size={14} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.lienConseillerText}>
                            {t('Une question avant de signer ?')}
                        </Text>
                    </Pressable>
                </View>

                <ConseillerIA
                    visible={conseillerOuvert}
                    onClose={() => setConseillerOuvert(false)}
                    proposalId={prop.id}
                    conseiller={conseiller}
                    t={t}
                />
            </View>
        )
    }

    /* ══ DECK ══ */
    const courante = prestations[rang]
    const hauteurDeck = Dimensions.get('window').height - insets.top - insets.bottom - 232

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.enteteDeck}>
                <View style={styles.enteteDeckHaut}>
                    <Pressable onPress={() => setVue('ouverture')} style={styles.rondPetit} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={18} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={styles.deckOverline}>
                            {t('Prestation {i} sur {n}', { i: Math.min(rang + 1, prestations.length), n: prestations.length })}
                        </Text>
                        <Text style={styles.deckFamille}>
                            {courante ? t(familleDe(courante.type).l) : t('Proposition')}
                        </Text>
                    </View>
                    <Pressable onPress={partager} style={styles.rondPetit} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                        <Share2 size={17} color={C.textSec} strokeWidth={2} />
                    </Pressable>
                </View>
                <View style={styles.rythme}>
                    {prestations.map((p, i) => (
                        <View key={p.id} style={[styles.segment, i === rang && styles.segmentOn]} />
                    ))}
                </View>
            </View>

            <Animated.ScrollView
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
                        total={prestations.length}
                        scrollX={scrollX}
                        retenu={retenues.has(p.id)}
                        onToggle={() => basculer(p.id)}
                        devise={prop.currency}
                        hauteur={hauteurDeck}
                        suivant={prestations[i + 1]?.title || null}
                        t={t}
                    />
                ))}
            </Animated.ScrollView>

            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.barreHaut}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.barreLigne}>
                            <Text style={styles.barreLabel}>{t('Total sélectionné')}</Text>
                            <View style={styles.pointVert} />
                            <Text style={styles.barreCompte}>
                                {t('{k} sur {n} gardées', { k: retenues.size, n: prestations.length })}
                            </Text>
                        </View>
                        <Text style={styles.barreTotal}>{money(total, prop.currency)}</Text>
                    </View>
                    <Pressable
                        onPress={() => setVue('recap')}
                        style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
                        accessibilityRole="button"
                    >
                        <Text style={styles.ctaText}>{t('Valider le choix')}</Text>
                        <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                    </Pressable>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },

    /* En-têtes */
    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    enteteDiscret: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' },
    rond: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', ...shadows.card },
    rondPetit: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', ...shadows.card },
    piluleEntete: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: VERT_LISERE, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
    piluleEnteteText: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    pointVert: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },

    enteteDeck: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
    enteteDeckHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    deckOverline: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    deckFamille: { fontFamily: fonts.extrabold, fontSize: 12, color: C.text, marginTop: 2 },
    rythme: { flexDirection: 'row', gap: 6 },
    segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.border },
    segmentOn: { backgroundColor: C.primary },

    /* Ouverture */
    introScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
    introCadre: { width: '100%', aspectRatio: 4 / 3, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt, marginBottom: 16 },
    introPastille: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 6, ...shadows.card },
    introPastilleText: { fontFamily: fonts.bold, fontSize: 11, color: C.text },
    introRef: { position: 'absolute', bottom: 16, right: 16, backgroundColor: '#FFFFFF', borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 4, ...shadows.card },
    introRefText: { fontFamily: fonts.bold, fontSize: 11, color: VERT_PROFOND },
    introOverline: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
    h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, color: C.text, marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    chipText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.textSec },

    carteMot: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 20, gap: 12, marginTop: 20, ...shadows.card },
    motEntete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    motTuile: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    motTitre: { fontFamily: fonts.bold, fontSize: 14, color: C.text },
    motSous: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, marginTop: 3 },
    motTexte: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: C.textSec, fontStyle: 'italic', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
    motPied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    motPiedCote: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    motPiedText: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted },
    lienConseiller: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 4 },
    lienConseillerText: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.primary },
    motAvatar: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: VERT_LISERE },
    motPastille: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    motPastilleText: { fontFamily: fonts.bold, fontSize: 9.5, color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
    motAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: VERT_LISERE, borderRadius: radius.pill, paddingVertical: 12 },
    motActionText: { fontFamily: fonts.bold, fontSize: 12.5, color: C.primary },

    /* Conversation avec le conseiller */
    filScroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 10 },
    filVide: { alignItems: 'center', gap: 8, paddingTop: 40, paddingHorizontal: 12 },
    filVideTitre: { fontFamily: fonts.extrabold, fontSize: 17, color: C.text, textAlign: 'center', marginTop: 8 },
    filVideTexte: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, textAlign: 'center' },
    suggestions: { gap: 8, marginTop: 16, width: '100%' },
    suggestion: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
    suggestionText: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: C.textSec },
    bulle: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
    bulleMoi: { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 6 },
    bulleIA: { alignSelf: 'flex-start', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 6 },
    bulleText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.text },
    saisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
    champ: { flex: 1, maxHeight: 120, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.body, fontSize: 13.5, color: C.text },
    envoyer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

    reperes: { flexDirection: 'row', gap: 10, marginTop: 20 },
    repere: { flex: 1, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    repereChiffre: { fontFamily: fonts.extrabold, fontSize: 18, color: VERT_PROFOND },
    repereLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },

    /* Slide */
    slideScroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    cadrePhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt },
    pastilleFamille: { position: 'absolute', top: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 6, ...shadows.card },
    pastilleText: { fontFamily: fonts.bold, fontSize: 10, color: C.text, letterSpacing: 1.4, textTransform: 'uppercase' },
    garder: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, ...shadows.card },
    garderOn: { backgroundColor: C.primary, borderColor: C.primary },
    garderOff: { backgroundColor: '#FFFFFF', borderColor: C.border },
    garderText: { fontFamily: fonts.bold, fontSize: 11, color: C.primary },
    vignettes: { position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 4, ...shadows.card },
    vignette: { width: 32, height: 32, borderRadius: 8, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent' },
    vignetteOn: { borderColor: C.primary },
    vignetteImg: { width: '100%', height: '100%' },
    vignettePlus: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    vignettePlusText: { fontFamily: fonts.bold, fontSize: 10, color: C.textSec },
    badgeRemise: { position: 'absolute', bottom: 14, right: 14, backgroundColor: '#FFFFFF', borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 4, ...shadows.card },
    badgeRemiseText: { fontFamily: fonts.bold, fontSize: 11, color: VERT_PROFOND },

    corps: { paddingTop: 16, gap: 10 },
    ligneTitre: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    overline: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    titre: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 26, color: C.text, marginTop: 2 },
    lieu: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    lieuText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: C.textSec },
    blocPrix: { alignItems: 'flex-end' },
    prix: { fontFamily: fonts.extrabold, fontSize: 18, color: VERT_PROFOND },
    prixOff: { color: C.textMuted, textDecorationLine: 'line-through' },
    prixBarre: { fontFamily: fonts.body, fontSize: 10.5, color: C.textMuted, textDecorationLine: 'line-through', marginTop: 2 },
    sousTitre: { fontFamily: fonts.bodySemibold, fontSize: 13, color: C.textSec },
    desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: C.textSec },
    puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    puce: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
    puceText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.textSec },
    indice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
    indiceCote: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    indiceText: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted },

    /* Récapitulatif */
    recapScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
    recapTitre: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 27, color: C.text, marginTop: 6 },
    recapIntro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, marginTop: 6 },
    recapCarte: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 24, padding: 20, marginTop: 20, ...shadows.card },
    recapCarteEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12, marginBottom: 4 },
    recapCarteTitre: { flex: 1, fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    recapAjustable: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.textMuted },
    recapLigne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    recapLigneSep: { borderTopWidth: 1, borderTopColor: C.border },
    recapLigneOff: { opacity: 0.55 },
    recapPastilleOn: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    recapPastilleOff: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    recapNom: { fontFamily: fonts.bold, fontSize: 13, color: C.text, lineHeight: 18 },
    recapNomOff: { fontFamily: fonts.bodySemibold, fontSize: 13, color: C.textMuted, textDecorationLine: 'line-through', lineHeight: 18 },
    recapMeta: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, marginTop: 3 },
    recapPrix: { fontFamily: fonts.extrabold, fontSize: 13, color: VERT_PROFOND },
    recapPrixOff: { fontFamily: fonts.bodySemibold, fontSize: 13, color: C.textMuted, textDecorationLine: 'line-through' },

    recapBloc: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, gap: 12, marginTop: 16 },
    recapBlocLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    recapBlocLabel: { fontFamily: fonts.bold, fontSize: 12, color: C.text },
    recapBlocLabelDoux: { fontFamily: fonts.body, fontSize: 12, color: C.textSec },
    recapBlocFort: { fontFamily: fonts.extrabold, fontSize: 13, color: VERT_PROFOND },
    recapBlocDoux: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.textSec },
    recapBlocPied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: C.borderStrong, paddingTop: 10 },

    /* Vide */
    vide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 8 },
    videTuile: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: VERT_LISERE, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    videOverline: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    videTitre: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: C.text, textAlign: 'center', marginTop: 4 },
    videTexte: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: C.textSec, textAlign: 'center', maxWidth: 300, marginTop: 4 },
    videCarte: { width: '100%', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, gap: 12, marginTop: 20 },
    videCarteEntete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    videCarteTexte: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: C.textSec },
    videActions: { width: '100%', gap: 10, marginTop: 20 },
    ctaSecondaire: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingVertical: 14 },
    ctaSecondaireText: { fontFamily: fonts.bold, fontSize: 13, color: C.textSec },
    piedSignature: { paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
    piedSignatureText: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, textAlign: 'center' },

    /* Barre de total */
    barre: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 14, gap: 12, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 30, elevation: 14 },
    barreHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    barreLigne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barreLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' },
    barreCompte: { fontFamily: fonts.bold, fontSize: 11, color: C.primary },
    barreTotal: { fontFamily: fonts.extrabold, fontSize: 22, color: VERT_PROFOND, marginTop: 4 },
    barreTotalPetit: { fontFamily: fonts.extrabold, fontSize: 20, color: VERT_PROFOND, marginTop: 2 },
    pilulePetite: { backgroundColor: C.primarySoft, borderWidth: 1, borderColor: VERT_LISERE, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
    pilulePetiteText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.primary },
    ctaVide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: radius.pill, paddingVertical: 14 },
    ctaVideText: { fontFamily: fonts.bold, fontSize: 13, color: C.text },
    ctaLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16 },
    ctaLargeText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
    cta: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 14 },
    ctaText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
    regleeLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingVertical: 15 },
    regleeText: { fontFamily: fonts.bold, fontSize: 13.5, color: C.primary },

    erreur: { fontFamily: fonts.body, fontSize: 14, color: C.textMuted, textAlign: 'center' },
    btnRetour: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 13 },
    btnRetourText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
})
