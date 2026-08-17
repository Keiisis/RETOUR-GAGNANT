/* ═══════════════════════════════════════════════════════════
   Prêtres Fa & Racines : Annuaire + réservation de consultation.
   Consomme /api/fa-priests (annuaire) + /api/services/fa-checkout
   (commande serveur) + Kkiapay (paiement natif) + /api/checkout/verify.
   Rendu fidèle à la maquette Sleek exportée (hero editorial, bande verte,
   annuaire, FAQ, CTA, barre collante) ; LOGIQUE inchangée.
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image, FlatList,
    ActivityIndicator, TextInput, Platform, Modal, Share, LayoutAnimation, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, Share2, Star, MapPin, Video, Users, Check, Award,
    Languages, ShieldCheck, Sparkles, ChevronDown, Quote,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { colors as C, spacing, radius, shadows, fonts, typography } from '../../config/theme'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface Review { author_name: string; rating: number; comment: string | null; created_at: string }
interface Priest {
    id: string
    nom: string
    prenom: string
    titre?: string | null
    localisation?: string | null
    bio?: string | null
    photo_url?: string | null
    prestations?: string[] | null
    gallery?: string[] | null
    certifications?: string[] | null
    langues?: string[] | null
    experience_ans?: number | null
    rating_avg: number
    rating_count: number
    reviews: Review[]
}
interface PricingOption { label: string; price: string }
type Mode = 'presentiel' | 'visio'

const PLAYFAIR = fonts.extrabold

const PILIERS = [
    { icon: Award, title: 'Authenticité', desc: 'Rites et procédés transmis depuis des millénaires.' },
    { icon: Users, title: 'Prêtres vérifiés', desc: 'Sélectionnés pour leur éthique et leur savoir.' },
    { icon: MapPin, title: 'Format flexible', desc: 'À Cotonou ou en visioconférence sécurisée.' },
    { icon: ShieldCheck, title: 'Respect total', desc: 'Bienveillance envers votre parcours personnel.' },
]

const FAQ = [
    { q: 'Comment se déroule la séance ?', r: 'Vous échangez avec le prêtre, qui procède à la consultation du Fa, interprète les signes et vous transmet des conseils clairs, avec respect et discrétion.' },
    { q: 'Puis-je consulter à distance ?', r: 'Oui, via une visioconférence sécurisée. Le prêtre utilise les mêmes outils sacrés et la connexion spirituelle reste identique à une séance physique.' },
    { q: 'Le paiement est-il sécurisé ?', r: 'Oui. Le paiement se fait par Mobile Money ou carte, de façon 100% sécurisée. Un reçu vous est envoyé par email dès confirmation.' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FaScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [priests, setPriests] = useState<Priest[]>([])
    const [erreurAnnuaire, setErreurAnnuaire] = useState<string | null>(null)
    const [prices, setPrices] = useState<{ presentiel?: string; visio?: string }>({})
    const [loading, setLoading] = useState(true)
    const [detail, setDetail] = useState<Priest | null>(null)
    const [openFaq, setOpenFaq] = useState<number | null>(1)

    // Réservation
    // `booking` = prêtre choisi (null = « pas encore choisi », choix dans la feuille).
    // `bookingOpen` PILOTE l'ouverture : la feuille se basait avant sur
    // `booking !== null`, donc « Réserver ma consultation » (sans prêtre présélectionné)
    // n'ouvrait jamais rien. Les deux notions sont désormais séparées.
    const [booking, setBooking] = useState<Priest | null>(null)
    const [bookingOpen, setBookingOpen] = useState(false)
    const [mode, setMode] = useState<Mode>('presentiel')
    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [clause, setClause] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Paiement
    const [payAmount, setPayAmount] = useState('')
    const [pendingOrder, setPendingOrder] = useState<string | null>(null)
    const [showPay, setShowPay] = useState(false)

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const [pRes, sRes] = await Promise.all([
                    fetchWithTimeout(`${API_BASE}/api/fa-priests`, { timeoutMs: 15000 }),
                    fetchWithTimeout(`${API_BASE}/api/services/consultation-fa-racines`, { timeoutMs: 15000 }).catch(() => null),
                ])
                if (!pRes.ok) {
                    if (alive) setErreurAnnuaire(`HTTP ${pRes.status}`)
                } else {
                    const pData = await pRes.json().catch(() => ({ priests: [] }))
                    if (alive) {
                        setPriests(Array.isArray(pData.priests) ? pData.priests : [])
                        setErreurAnnuaire(null)
                    }
                }
                if (sRes) {
                    const sData = await sRes.json().catch(() => ({}))
                    const svc = sData?.service || sData || {}
                    const opts: PricingOption[] = svc.pricing_options || []
                    const chercher = (mots: string[]) => {
                        const trouve = opts.find(o => {
                            const l = (o.label || '').toLowerCase()
                            return mots.some(m => l.includes(m))
                        })
                        return trouve?.price
                    }
                    let presentiel = chercher(['présentiel', 'presentiel', 'sur place', 'in-person', 'in person'])
                    let visio = chercher(['visio', 'distance', 'video', 'vidéo', 'ligne'])
                    if (!presentiel || !visio) {
                        const ligne: string = svc.price_display || svc.price || ''
                        const parts = ligne.split(/[·|,;]/)
                        for (const part of parts) {
                            const bas = part.toLowerCase()
                            const montant = part.replace(/^[^0-9]*/, '').trim()
                            if (!montant) continue
                            if (!presentiel && /présentiel|presentiel|sur place|in-person|in person/.test(bas)) presentiel = montant
                            if (!visio && /visio|distance|video|vidéo|ligne/.test(bas)) visio = montant
                        }
                    }
                    if (alive) setPrices({ presentiel, visio })
                }
            } catch (e) {
                if (alive) setErreurAnnuaire(e instanceof Error ? e.message : 'réseau')
            }
            if (alive) setLoading(false)
        })()
        return () => { alive = false }
    }, [])

    const openBooking = useCallback((p: Priest | null) => {
        setBooking(p)
        setBookingOpen(true)
        setMode('presentiel')
        setClause(false)
        setForm({
            name: profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : '',
            email: profile?.email || '',
            phone: profile?.phone || '',
        })
    }, [profile])

    const submitBooking = useCallback(async () => {
        if (!form.name.trim() || !form.phone.trim()) {
            toast(t('Champs requis'), t('Votre nom et votre téléphone sont nécessaires.'))
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            toast(t('Email invalide'), t('Veuillez saisir un email valide.'))
            return
        }
        if (!clause) {
            toast(t('Clause requise'), t('Vous devez accepter la clause de mise en relation.'))
            return
        }
        setSubmitting(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/services/fa-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 20000,
                body: JSON.stringify({
                    mode,
                    priest_id: booking?.id || null,
                    customer_name: form.name.trim(),
                    customer_email: form.email.trim().toLowerCase(),
                    customer_phone: form.phone.trim(),
                    clause_accepted: true,
                    payment_method: 'kkiapay',
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                toast(t('Réservation impossible'), data.error || t('Réessayez dans un instant.'))
                return
            }
            setPendingOrder(String(data.order_id))
            setPayAmount(`${data.amount_xof} FCFA`)
            setBookingOpen(false)
            setShowPay(true)
        } catch {
            toast(t('Erreur réseau'), t('Vérifiez votre connexion et réessayez.'))
        } finally {
            setSubmitting(false)
        }
    }, [form, mode, clause, booking, t])

    const onPaid = useCallback(async (txId: string) => {
        setShowPay(false)
        if (!pendingOrder) return
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/checkout/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 20000,
                body: JSON.stringify({ order_id: pendingOrder, transaction_id: txId }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.success) {
                // Ouvre un dossier « Consultation Fa » (dossier_tracking, source=mobile) :
                // c'est ce qui rend la demande visible côté agent et admin (onglet
                // Service Mobile) avec le prêtre nommément demandé.
                const priestNote = booking
                    ? `Prêtre demandé : ${booking.prenom} ${booking.nom}${booking.localisation ? ` (${booking.localisation})` : ''}.`
                    : 'Aucun prêtre présélectionné : à orienter par l’équipe.'
                await fetchWithTimeout(`${API_BASE}/api/mobile/dossiers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                    timeoutMs: 20000,
                    body: JSON.stringify({
                        service_type: 'Consultation Fa',
                        payment_tx_id: txId,
                        notes: `Consultation ${mode === 'presentiel' ? 'en présentiel' : 'en visio'}. ${priestNote}`,
                    }),
                }).catch(() => { /* non bloquant : le paiement est déjà confirmé */ })

                toast(t('Consultation réservée'), t('Votre paiement est confirmé. Notre équipe vous contactera pour fixer le rendez-vous. Une facture vous a été envoyée par email.'))
            } else {
                toast(t('Paiement reçu'), t('Le paiement a été reçu mais la confirmation a échoué. Référence : ') + txId)
            }
        } catch {
            toast(t('Paiement reçu'), t('Confirmation réseau échouée. Référence : ') + txId)
        } finally {
            setPendingOrder(null)
        }
    }, [pendingOrder, booking, mode, t])

    const fromPrice = prices.presentiel || prices.visio || ''

    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }
    const onShare = () => Share.share({ message: t('Consultez un prêtre du Fa avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/consultation-fa-racines') }).catch(() => {})

    const ListHeader = (
        <View>
            {/* Hero */}
            <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                <View style={styles.badge}>
                    <Sparkles size={14} color={C.primary} strokeWidth={2.2} />
                    <Text style={styles.badgeText}>{t('Consultation du Fa & Racines')}</Text>
                </View>
                <Text style={styles.heroTitle}>{t('La sagesse ancestrale pour éclairer votre retour')}</Text>
                <Text style={styles.heroSub}>{t("Le Fa est bien plus qu'une géomancie : c'est une boussole spirituelle. Consultez des prêtres certifiés pour reconnecter avec votre lignée et vos racines.")}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {[
                        { icon: ShieldCheck, label: 'Prêtres certifiés' },
                        { icon: Video, label: 'Présentiel ou visio' },
                        { icon: Sparkles, label: 'Consultation authentique' },
                    ].map(({ icon: Ic, label }) => (
                        <View key={label} style={styles.heroChip}>
                            <Ic size={14} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.heroChipText}>{t(label)}</Text>
                        </View>
                    ))}
                </ScrollView>
            </Animated.View>

            {/* Trust strip */}
            <View style={styles.trustStrip}>
                {['Premier échange gratuit', 'Confidentialité', 'Respect & méthode'].map((tr, i) => (
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

            {/* Notre métier */}
            <View style={styles.metierSection}>
                <Text style={styles.eyebrow}>{t('Notre métier')}</Text>
                <Text style={styles.metierTitle}>{t("Faciliter le dialogue avec l'invisible")}</Text>
                <Text style={styles.metierText}>{t("Retour Gagnant Bénin n'est pas un cabinet de voyance. Nous sommes un pont entre la diaspora et les gardiens du temple. Nous sélectionnons des prêtres dont la crédibilité est reconnue au Bénin, pour une consultation pure de tout artifice commercial.")}</Text>
            </View>

            {/* Annuaire */}
            <Text style={styles.annuaireTitle}>{t("L'Annuaire des Prêtres")}</Text>
        </View>
    )

    const ListFooter = (
        <View>
            {/* FAQ */}
            <View style={styles.faqSection}>
                <Text style={styles.annuaireTitle}>{t('Questions fréquentes')}</Text>
                {FAQ.map((f, i) => {
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
            <View style={styles.finalSection}>
                <Text style={styles.finalTitle}>{t('Prêt à consulter le Fa ?')}</Text>
                <Text style={styles.finalText}>{t('Reconnectez avec votre histoire et obtenez des réponses claires sur votre avenir.')}</Text>
                <Pressable style={({ pressed }) => [styles.finalBtn, pressed && { transform: [{ scale: 0.98 }] }]} onPress={() => openBooking(null)} accessibilityRole="button">
                    <Text style={styles.finalBtnText}>{t('Réserver ma consultation')}</Text>
                </Pressable>
            </View>
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
                    <ChevronLeft size={24} color={C.textPrimary} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Consultation Fa')}</Text>
                <Pressable onPress={onShare} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.textPrimary} strokeWidth={2} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
            ) : (
                <FlatList
                    data={priests}
                    keyExtractor={p => p.id}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={ListHeader}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>{erreurAnnuaire
                                ? `${t('Annuaire momentanément inaccessible.')} (${erreurAnnuaire})`
                                : t("Nos prêtres ne sont pas encore présentés ici. Vous pouvez réserver dès maintenant : notre équipe vous met en relation avec un Bokonon reconnu.")}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={{ paddingHorizontal: spacing.lg }}>
                            <PriestCard priest={item} t={t} onOpen={() => setDetail(item)} />
                        </View>
                    )}
                    ListFooterComponent={ListFooter}
                />
            )}

            {/* Barre collante */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View>
                    <Text style={styles.stickyLabel}>{fromPrice ? t('À partir de') : t('Consultation')}</Text>
                    <Text style={styles.stickyValue}>{fromPrice || t('Sur réservation')}</Text>
                </View>
                <Pressable onPress={() => openBooking(null)} style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button">
                    <Text style={styles.stickyBtnText}>{t('Réserver')}</Text>
                </Pressable>
            </View>

            {/* DÉTAIL PRÊTRE */}
            <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setDetail(null)} accessibilityRole="button" hitSlop={6} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        {detail && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.sheetHandle} />
                                <View style={styles.detailHead}>
                                    <PriestAvatar uri={detail.photo_url} size={72} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailName}>{detail.prenom} {detail.nom}</Text>
                                        {!!detail.titre && <Text style={styles.detailTitre}>{detail.titre}</Text>}
                                        <RatingRow avg={detail.rating_avg} count={detail.rating_count} t={t} />
                                    </View>
                                </View>

                                <View style={styles.metaRow}>
                                    {!!detail.localisation && <Meta icon={<MapPin size={13} color={C.textMuted} />} text={detail.localisation} />}
                                    {!!detail.experience_ans && <Meta icon={<Award size={13} color={C.textMuted} />} text={`${detail.experience_ans} ${t('ans')}`} />}
                                    {!!(detail.langues && detail.langues.length) && <Meta icon={<Languages size={13} color={C.textMuted} />} text={detail.langues.join(', ')} />}
                                </View>

                                {!!detail.bio && <Text style={styles.bio}>{detail.bio}</Text>}

                                {!!(detail.prestations && detail.prestations.length) && (
                                    <Section title={t('Prestations')}>
                                        <View style={styles.chipWrap}>
                                            {detail.prestations.map((p, i) => (
                                                <View key={i} style={styles.chip}><Text style={styles.chipText}>{p}</Text></View>
                                            ))}
                                        </View>
                                    </Section>
                                )}

                                {!!(detail.certifications && detail.certifications.length) && (
                                    <Section title={t('Certifications')}>
                                        {detail.certifications.map((c, i) => (
                                            <View key={i} style={styles.certRow}>
                                                <ShieldCheck size={14} color={C.primary} />
                                                <Text style={styles.certText}>{c}</Text>
                                            </View>
                                        ))}
                                    </Section>
                                )}

                                {!!(detail.reviews && detail.reviews.length) && (
                                    <Section title={t('Avis')}>
                                        {detail.reviews.slice(0, 6).map((r, i) => (
                                            <View key={i} style={styles.review}>
                                                <Quote size={14} color={C.primary} style={{ marginBottom: 4 }} />
                                                {!!r.comment && <Text style={styles.reviewText}>{r.comment}</Text>}
                                                <View style={styles.reviewFoot}>
                                                    <Text style={styles.reviewAuthor}>{r.author_name}</Text>
                                                    <Stars value={r.rating} size={12} />
                                                </View>
                                            </View>
                                        ))}
                                    </Section>
                                )}

                                <Pressable style={styles.cta} onPress={() => { const p = detail; setDetail(null); openBooking(p) }} accessibilityRole="button" hitSlop={6}>
                                    <Text style={styles.ctaText}>{t('Réserver une consultation')}</Text>
                                </Pressable>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* RÉSERVATION */}
            <Modal visible={bookingOpen} animationType="slide" transparent onRequestClose={() => setBookingOpen(false)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setBookingOpen(false)} accessibilityRole="button" hitSlop={6} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.sheetHandle} />
                            <Text style={styles.bookTitle}>{t('Réserver une consultation')}</Text>
                            {!!booking && <Text style={styles.bookPriest}>{t('Avec')} {booking.prenom} {booking.nom}</Text>}

                            {/* CHOIX DU PRÊTRE — le client sélectionne qui il veut consulter.
                                Le prêtre retenu part dans priest_id : l'agent et l'admin
                                voient donc nommément la demande côté panel. */}
                            {priests.length > 0 && (
                                <>
                                    <Text style={styles.label}>{t('Choisissez votre prêtre Fa')}</Text>
                                    <View style={styles.priestPickRow}>
                                        {priests.map(p => {
                                            const on = booking?.id === p.id
                                            return (
                                                <Pressable
                                                    key={p.id}
                                                    onPress={() => setBooking(on ? null : p)}
                                                    style={[styles.priestPick, on && styles.priestPickOn]}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: on }}
                                                    hitSlop={4}
                                                >
                                                    <Text style={[styles.priestPickName, on && styles.priestPickNameOn]} numberOfLines={1}>
                                                        {p.prenom} {p.nom}
                                                    </Text>
                                                    {!!p.localisation && (
                                                        <Text style={[styles.priestPickLoc, on && styles.priestPickLocOn]} numberOfLines={1}>
                                                            {p.localisation}
                                                        </Text>
                                                    )}
                                                </Pressable>
                                            )
                                        })}
                                    </View>
                                    <Text style={styles.priestPickHint}>
                                        {booking
                                            ? t('Votre demande sera transmise nommément à ce prêtre.')
                                            : t('Aucun prêtre sélectionné : notre équipe vous orientera vers le prêtre le plus adapté.')}
                                    </Text>
                                </>
                            )}

                            <Text style={styles.label}>{t('Formule')}</Text>
                            <View style={styles.modeRow}>
                                <ModeCard active={mode === 'presentiel'} onPress={() => setMode('presentiel')}
                                    icon={<Users size={18} color={mode === 'presentiel' ? '#fff' : C.primary} />}
                                    label={t('Présentiel')} price={prices.presentiel} />
                                <ModeCard active={mode === 'visio'} onPress={() => setMode('visio')}
                                    icon={<Video size={18} color={mode === 'visio' ? '#fff' : C.primary} />}
                                    label={t('Visio')} price={prices.visio} />
                            </View>

                            <Text style={styles.label}>{t('Vos coordonnées')}</Text>
                            <TextInput style={styles.input} placeholder={t('Nom complet')} placeholderTextColor={C.textMuted}
                                value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
                            <TextInput style={styles.input} placeholder={t('Email')} placeholderTextColor={C.textMuted}
                                keyboardType="email-address" autoCapitalize="none"
                                value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} />
                            <TextInput style={styles.input} placeholder={t('Téléphone')} placeholderTextColor={C.textMuted}
                                keyboardType="phone-pad"
                                value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} />

                            <Pressable style={styles.clauseRow} onPress={() => setClause(c => !c)} accessibilityRole="button" hitSlop={6}>
                                <View style={[styles.checkbox, clause && styles.checkboxOn]}>
                                    {clause && <Check size={13} color="#fff" />}
                                </View>
                                <Text style={styles.clauseText}>
                                    {t("J'accepte la clause de mise en relation : Retour Gagnant facilite le contact avec le prêtre et n'est pas responsable du contenu spirituel de la consultation.")}
                                </Text>
                            </Pressable>

                            <Pressable style={[styles.cta, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submitBooking} accessibilityRole="button" hitSlop={6}>
                                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('Réserver et payer')}</Text>}
                            </Pressable>
                            <Text style={styles.secure}>{t('Paiement sécurisé : Mobile Money / Carte')}</Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <KkiapayModal
                visible={showPay}
                amount={payAmount}
                serviceName={t('Consultation Fa & Racines')}
                onClose={() => setShowPay(false)}
                onSuccess={onPaid}
            />
        </View>
    )
}

/* ── Sous-composants ─────────────────────────────────────── */

function PriestAvatar({ uri, size = 56, square = false }: { uri?: string | null; size?: number; square?: boolean }) {
    const br = square ? radius.xxl : size / 2
    if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: br, backgroundColor: C.surfaceWarm }} />
    return (
        <View style={{ width: size, height: size, borderRadius: br, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={size * 0.4} color={C.primary} />
        </View>
    )
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
    return (
        <View style={{ flexDirection: 'row', gap: 1 }}>
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={size} color={C.primary} fill={i <= Math.round(value) ? C.gold : 'transparent'} />
            ))}
        </View>
    )
}

function RatingRow({ avg, count, t }: { avg: number; count: number; t: (s: string) => string }) {
    if (!count) return <Text style={styles.noRating}>{t('Nouveau')}</Text>
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Stars value={avg} size={13} />
            <Text style={styles.ratingText}>{avg.toFixed(1)} · {count} {t('avis')}</Text>
        </View>
    )
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
    return <View style={styles.meta}>{icon}<Text style={styles.metaText}>{text}</Text></View>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={{ marginTop: spacing.lg }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    )
}

function ModeCard({ active, onPress, icon, label, price }: { active: boolean; onPress: () => void; icon: React.ReactNode; label: string; price?: string }) {
    return (
        <Pressable style={[styles.modeCard, active && styles.modeCardActive]} onPress={onPress} accessibilityRole="button" hitSlop={6}>
            <View style={[styles.modeIcon, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>{icon}</View>
            <Text style={[styles.modeLabel, active && { color: '#fff' }]}>{label}</Text>
            {!!price && <Text style={[styles.modePrice, active && { color: 'rgba(255,255,255,0.9)' }]}>{price}</Text>}
        </Pressable>
    )
}

const PriestCard = React.memo(function PriestCard(
    { priest, t, onOpen }: { priest: Priest; t: (s: string) => string; onOpen: () => void },
) {
    const chips = useMemo(() => [
        ...(priest.langues || []).slice(0, 2),
        priest.experience_ans ? `${priest.experience_ans} ${t('ans exp.')}` : null,
    ].filter(Boolean) as string[], [priest.langues, priest.experience_ans, t])

    return (
        <Pressable style={styles.card} onPress={onOpen} accessibilityRole="button" hitSlop={4}>
            <View style={styles.cardTop}>
                <View>
                    <PriestAvatar uri={priest.photo_url} size={92} square />
                    <View style={styles.cardCheck}><Check size={13} color="#fff" strokeWidth={3} /></View>
                </View>
                <View style={{ flex: 1 }}>
                    <View style={styles.cardRatingRow}>
                        <Star size={14} color={C.gold} fill={C.gold} />
                        <Text style={styles.cardRatingVal}>{priest.rating_count ? priest.rating_avg.toFixed(1) : t('Nouveau')}</Text>
                        {priest.rating_count ? <Text style={styles.cardRatingCount}>({priest.rating_count} {t('avis')})</Text> : null}
                    </View>
                    <Text style={styles.cardName}>{priest.prenom} {priest.nom}</Text>
                    {!!priest.titre && <Text style={styles.cardTitre} numberOfLines={1}>{priest.titre}</Text>}
                    {!!priest.localisation && (
                        <View style={styles.cardLoc}><MapPin size={12} color={C.textMuted} /><Text style={styles.cardLocText}>{priest.localisation}</Text></View>
                    )}
                </View>
            </View>
            {chips.length > 0 && (
                <View style={styles.cardChips}>
                    {chips.map((c, i) => <View key={i} style={styles.chipSm}><Text style={styles.chipSmText}>{c}</Text></View>)}
                </View>
            )}
            {!!priest.bio && <Text style={styles.cardBio} numberOfLines={2}>{priest.bio}</Text>}
            <Pressable style={styles.cardBtn} onPress={onOpen} accessibilityRole="button" hitSlop={6}>
                <Text style={styles.cardBtnText}>{t('Voir le profil complet')}</Text>
            </Pressable>
        </Pressable>
    )
})

/* ── Styles ──────────────────────────────────────────────── */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    headerTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

    /* Hero */
    hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.lg },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    heroTitle: { fontFamily: PLAYFAIR, fontSize: 30, lineHeight: 36, color: C.textPrimary, marginBottom: spacing.sm },
    heroSub: { ...typography.body, color: C.textMuted, marginBottom: spacing.md, lineHeight: 23 },
    chipsRow: { gap: spacing.sm, paddingVertical: 2 },
    heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadows.sm },
    heroChipText: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.textPrimary },

    /* Trust strip */
    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginBottom: spacing.xl, flexWrap: 'wrap' },
    trustText: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    trustDot: { color: C.gold, fontSize: 12 },

    /* Bande verte */
    pilierBand: { backgroundColor: C.primary, borderRadius: radius.xxl, marginHorizontal: spacing.md, paddingVertical: 28, paddingHorizontal: spacing.lg, marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', ...shadows.md },
    pilier: { width: '50%', paddingRight: spacing.md, marginBottom: spacing.lg },
    pilierIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    pilierTitle: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 14 },
    pilierDesc: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, marginTop: 4 },

    /* Notre métier */
    metierSection: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    metierTitle: { fontFamily: PLAYFAIR, fontSize: 22, lineHeight: 28, color: C.textPrimary, marginBottom: spacing.md },
    metierText: { ...typography.body, color: C.textMuted, lineHeight: 23 },

    annuaireTitle: { fontFamily: fonts.heading, fontSize: 19, color: C.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },

    empty: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, alignItems: 'center' },
    emptyText: { fontFamily: fonts.body, color: C.textMuted, textAlign: 'center' },

    /* Priest card */
    card: { backgroundColor: C.surface, borderRadius: radius.xxl, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: C.border, ...shadows.md },
    cardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    cardCheck: { position: 'absolute', bottom: -6, right: -6, width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.surface },
    cardRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    cardRatingVal: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.textPrimary },
    cardRatingCount: { fontFamily: fonts.body, fontSize: 10, color: C.textMuted },
    cardName: { fontFamily: fonts.bodyBold, fontSize: 18, color: C.textPrimary },
    cardTitre: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.primary, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
    cardLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    cardLocText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.textMuted },
    cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
    cardBio: { fontFamily: fonts.body, fontSize: 12.5, color: C.textMuted, lineHeight: 19, marginBottom: spacing.md },
    cardBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.primary, borderRadius: radius.lg, paddingVertical: 13 },
    cardBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.primary },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    chip: { backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.primaryDark },
    chipSm: { backgroundColor: C.surfaceWarm, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
    chipSmText: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },

    ratingText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.textSecondary },
    noRating: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.primary, marginTop: 3 },

    /* FAQ */
    faqSection: { marginTop: spacing.md, marginBottom: spacing.lg },
    faqCard: { marginHorizontal: spacing.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    faqQ: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: C.textPrimary },
    faqA: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textMuted, marginTop: spacing.sm },

    /* CTA final */
    finalSection: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center' },
    finalTitle: { fontFamily: PLAYFAIR, fontSize: 24, color: C.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
    finalText: { ...typography.body, color: C.textMuted, textAlign: 'center', marginBottom: spacing.lg },
    finalBtn: { width: '100%', backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', ...shadows.md },
    finalBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },

    /* Sticky bar */
    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.lg, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    stickyLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickyValue: { fontFamily: fonts.heading, fontSize: 17, color: C.primaryDark, marginTop: 1 },
    stickyBtn: { backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 13, ...shadows.sm },
    stickyBtnText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },

    // Sheets
    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: '90%' },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: spacing.md },

    detailHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    detailName: { fontFamily: fonts.heading, fontSize: 20, color: C.textPrimary },
    detailTitre: { fontFamily: fonts.body, fontSize: 13, color: C.textMuted, marginTop: 1 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: spacing.md },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontFamily: fonts.body, fontSize: 12.5, color: C.textMuted },
    bio: { fontFamily: fonts.body, fontSize: 14, color: C.textSecondary, lineHeight: 22, marginTop: spacing.md },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.textPrimary, marginBottom: spacing.sm },
    certRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    certText: { fontFamily: fonts.body, fontSize: 13, color: C.textSecondary, flex: 1 },
    review: { backgroundColor: C.surfaceWarm, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: C.border },
    reviewText: { fontFamily: fonts.body, fontSize: 13, color: C.textSecondary, lineHeight: 20, fontStyle: 'italic' },
    reviewFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    reviewAuthor: { fontFamily: fonts.bodySemibold, fontSize: 12.5, color: C.textPrimary },

    cta: { backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm },
    ctaText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },

    bookTitle: { fontFamily: fonts.heading, fontSize: 20, color: C.textPrimary },
    bookPriest: { fontFamily: fonts.body, fontSize: 13.5, color: C.textMuted, marginTop: 2, marginBottom: spacing.md },
    label: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: C.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
    /* Sélecteur de prêtre (feuille de réservation) */
    priestPickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    priestPick: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, maxWidth: '100%' },
    priestPickOn: { backgroundColor: C.primary, borderColor: C.primary },
    priestPickName: { fontFamily: fonts.bodyBold, fontSize: 13, color: C.textPrimary },
    priestPickNameOn: { color: '#FFFFFF' },
    priestPickLoc: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, marginTop: 2 },
    priestPickLocOn: { color: '#FFFFFF', opacity: 0.85 },
    priestPickHint: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted, marginTop: spacing.sm, lineHeight: 16 },

    modeRow: { flexDirection: 'row', gap: 12 },
    modeCard: { flex: 1, backgroundColor: C.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: C.border },
    modeCardActive: { backgroundColor: C.primary, borderColor: C.primary },
    modeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    modeLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.textPrimary },
    modePrice: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: C.primary, marginTop: 2 },

    input: { backgroundColor: C.surfaceWarm, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontFamily: fonts.body, fontSize: 14.5, color: C.textPrimary, borderWidth: 1, borderColor: C.border, marginBottom: spacing.sm },

    clauseRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md, alignItems: 'flex-start' },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: C.borderPrimary, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
    clauseText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: C.textMuted, lineHeight: 18 },
    secure: { fontFamily: fonts.body, fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: spacing.sm },
})
