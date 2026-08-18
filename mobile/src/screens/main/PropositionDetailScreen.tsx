/* ═══════════════════════════════════════════════════════════
   Détail d'une proposition — vue NATIVE.

   L'application ouvrait la page du site dans une WebView : en-tête, fil
   d'Ariane, boutons flottants, mise en page pensée pour un grand écran… et
   surtout AUCUN moyen de choisir ses prestations. Le client ne pouvait que
   subir la proposition.

   Ici, chaque prestation est une carte que l'on coche ou décoche, et le total
   se recalcule sous les doigts. C'est le sens même d'une proposition : le
   client compose ce qu'il retient.

   Charte v2 : blanc porteur, tricolore en accent, aucune palette locale.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image,
    ActivityIndicator, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, Share2, Check, MapPin, CalendarDays, Bed, UtensilsCrossed,
    Camera, Car, Sparkles, PenLine, CreditCard, CircleCheck,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

interface Prestation {
    id: string
    type: string | null
    title: string | null
    subtitle: string | null
    description: string | null
    location: string | null
    image_url: string | null
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

/* Familles de prestations : une icône et un libellé pour chacune, afin que le
   client comprenne d'un coup d'œil ce qu'il compose. */
const FAMILLES: Record<string, { l: string; Icone: typeof Bed }> = {
    hotel: { l: 'Hébergement', Icone: Bed },
    restaurant: { l: 'Restauration', Icone: UtensilsCrossed },
    activity: { l: 'Activités', Icone: Camera },
    activite: { l: 'Activités', Icone: Camera },
    transport: { l: 'Transport', Icone: Car },
}
const familleDe = (t: string | null) => FAMILLES[String(t || '').toLowerCase()] || { l: 'Prestations', Icone: Sparkles }

const somme = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0)

const money = (v: number, devise: string | null) =>
    `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} ${devise === 'XOF' || !devise ? 'FCFA' : devise}`

const dateFr = (iso: string | null) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) }
    catch { return null }
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

    const charger = useCallback(async () => {
        setChargement(true); setErreur('')
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}`, {
                headers: { ...(await authHeaders()) },
                timeoutMs: 15000,
            })
            const json = await res.json().catch(() => ({}))
            // Sans le code HTTP, un « Chargement impossible » couvre aussi bien
            // une session expirée qu'une route absente du serveur : on le dit.
            if (!res.ok) throw new Error(json.error || `Chargement impossible (erreur ${res.status}).`)
            setProp(json.proposal)
            const liste: Prestation[] = Array.isArray(json.prestations) ? json.prestations : []
            setPrestations(liste)
            // Tout est retenu au départ : la proposition de l'agent est le point
            // de départ, le client retire ce qu'il ne veut pas.
            setRetenues(new Set(liste.map(p => p.id)))
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [proposalId])

    useEffect(() => { charger() }, [charger])

    const basculer = (id: string) => {
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

    /* Regroupement par famille : on garde l'ordre d'apparition voulu par
       l'agent plutôt que d'imposer un tri alphabétique. */
    const groupes = useMemo(() => {
        const m = new Map<string, Prestation[]>()
        for (const p of prestations) {
            const cle = familleDe(p.type).l
            if (!m.has(cle)) m.set(cle, [])
            m.get(cle)!.push(p)
        }
        return [...m.entries()]
    }, [prestations])

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

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1}>{prop.destination || t('Proposition')}</Text>
                <Pressable onPress={partager} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: 160 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Ouverture */}
                <Animated.View entering={FadeInUp.duration(380)} style={styles.hero}>
                    {!!prop.intro_image && (
                        <Image source={{ uri: prop.intro_image }} style={styles.heroImg} resizeMode="cover" />
                    )}
                    <View style={styles.badge}>
                        <Sparkles size={13} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.badgeText}>{t('Votre proposition')}</Text>
                    </View>
                    <Text style={styles.h1}>{prop.intro_title || prop.destination || t('Votre séjour')}</Text>

                    <View style={styles.metaRow}>
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
                    </View>

                    {!!prop.intro_text && <Text style={styles.intro}>{prop.intro_text}</Text>}
                </Animated.View>

                {/* Prestations : le cœur de l'écran */}
                {prestations.length === 0 ? (
                    <View style={styles.vide}>
                        <Text style={styles.videText}>
                            {t('Cette proposition ne détaille pas encore de prestations. Contactez votre conseiller pour la compléter.')}
                        </Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.consigne}>
                            <Text style={styles.consigneText}>
                                {t('Tout est retenu par défaut. Décochez ce que vous ne souhaitez pas : le total se met à jour.')}
                            </Text>
                        </View>

                        {groupes.map(([famille, liste]) => {
                            const { Icone } = familleDe(liste[0]?.type || null)
                            return (
                                <View key={famille} style={styles.groupe}>
                                    <View style={styles.groupeTitre}>
                                        <Icone size={15} color={C.primary} strokeWidth={2.2} />
                                        <Text style={styles.groupeText}>{t(famille)}</Text>
                                        <Text style={styles.groupeCompte}>{liste.length}</Text>
                                    </View>

                                    {liste.map(p => {
                                        const on = retenues.has(p.id)
                                        const prix = somme(p.selling_price)
                                        return (
                                            <Pressable
                                                key={p.id}
                                                onPress={() => basculer(p.id)}
                                                style={[styles.carte, on && styles.carteOn]}
                                                accessibilityRole="checkbox"
                                                accessibilityState={{ checked: on }}
                                            >
                                                {!!p.image_url && (
                                                    <Image source={{ uri: p.image_url }} style={styles.carteImg} resizeMode="cover" />
                                                )}
                                                <View style={styles.carteCorps}>
                                                    <View style={styles.carteHaut}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.carteTitre} numberOfLines={2}>{p.title || t('Prestation')}</Text>
                                                            {!!p.subtitle && <Text style={styles.carteSous} numberOfLines={1}>{p.subtitle}</Text>}
                                                            {!!p.location && (
                                                                <View style={styles.carteLieu}>
                                                                    <MapPin size={10} color={C.textMuted} />
                                                                    <Text style={styles.carteLieuText} numberOfLines={1}>{p.location}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <View style={[styles.case, on && styles.caseOn]}>
                                                            {on && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                                                        </View>
                                                    </View>

                                                    {!!p.description && (
                                                        <Text style={styles.carteDesc} numberOfLines={3}>{p.description}</Text>
                                                    )}

                                                    {!!p.highlights?.length && (
                                                        <View style={styles.puces}>
                                                            {p.highlights.slice(0, 4).map((h, i) => (
                                                                <View key={i} style={styles.puce}>
                                                                    <Text style={styles.puceText} numberOfLines={1}>{h}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}

                                                    <View style={styles.cartePrix}>
                                                        <Text style={[styles.prix, !on && styles.prixOff]}>
                                                            {prix > 0 ? money(prix, prop.currency) : t('Inclus')}
                                                        </Text>
                                                        <Text style={[styles.etat, on && styles.etatOn]}>
                                                            {on ? t('Retenu') : t('Écarté')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </Pressable>
                                        )
                                    })}
                                </View>
                            )
                        })}
                    </>
                )}
            </ScrollView>

            {/* Total vivant + action */}
            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.barreHaut}>
                    <View>
                        <Text style={styles.barreLabel}>
                            {retenues.size} {retenues.size > 1 ? t('prestations retenues') : t('prestation retenue')}
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
                            onPress={() => navigation.navigate('SignatureDevis', { proposalId: prop.id, secretKey: prop.secret_key, selection: [...retenues] })}
                            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.97 }] }]}
                            accessibilityRole="button"
                        >
                            <PenLine size={16} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaText}>{t('Signer le devis')}</Text>
                        </Pressable>
                    )}
                </View>
                <Text style={styles.barreNote}>
                    {t('Votre sélection est enregistrée avec votre signature.')}
                </Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    scroll: { paddingBottom: 160 },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    hero: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.lg },
    heroImg: { width: '100%', height: 180, borderRadius: radius.xl, marginBottom: spacing.md },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.sm },
    badgeText: { ...typography.button, fontSize: 11.5, color: C.primary },
    h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, color: C.text },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: C.textSec },
    intro: { ...typography.body, color: C.textSec, lineHeight: 22, marginTop: spacing.md },

    consigne: { marginHorizontal: spacing.gutter, backgroundColor: C.primarySoft, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
    consigneText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: '#00643C' },

    groupe: { paddingHorizontal: spacing.gutter, marginBottom: spacing.xl },
    groupeTitre: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
    groupeText: { flex: 1, fontFamily: fonts.bold, fontSize: 11, color: C.primary, textTransform: 'uppercase', letterSpacing: 1.4 },
    groupeCompte: { fontFamily: fonts.bold, fontSize: 11, color: C.textMuted },

    carte: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border, borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.md, ...shadows.card },
    carteOn: { borderColor: C.primary },
    carteImg: { width: '100%', height: 140 },
    carteCorps: { padding: spacing.md },
    carteHaut: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    carteTitre: { fontFamily: fonts.bold, fontSize: 15.5, color: C.text, lineHeight: 20 },
    carteSous: { fontFamily: fonts.body, fontSize: 12.5, color: C.textSec, marginTop: 2 },
    carteLieu: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    carteLieuText: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    carteDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: C.textSec, marginTop: spacing.sm },

    case: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    caseOn: { backgroundColor: C.primary, borderColor: C.primary },

    puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    puce: { backgroundColor: C.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    puceText: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.textSec },

    cartePrix: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    prix: { fontFamily: fonts.extrabold, fontSize: 16, color: '#00643C' },
    prixOff: { color: C.textMuted, textDecorationLine: 'line-through' },
    etat: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: C.textMuted },
    etatOn: { color: C.primary },

    vide: { marginHorizontal: spacing.gutter, backgroundColor: C.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg },
    videText: { ...typography.bodySmall, color: C.textSec, textAlign: 'center', lineHeight: 19 },

    barre: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
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
