/* ═══════════════════════════════════════════════════════════
   Prêtres Fa & Racines — Annuaire + réservation de consultation
   Consomme /api/fa-priests (annuaire) + /api/services/fa-checkout
   (commande serveur) + Kkiapay (paiement natif) + /api/checkout/verify.
   Design : Nexus Emerald (mode clair), tricolore Bénin en touches.
   ─── ui-ux-pro-max / design-taste : anti-slop, tactile, hiérarchie claire ───
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image, FlatList,
    ActivityIndicator, TextInput, Platform, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
    ArrowLeft, Star, MapPin, Video, Users, Check, X, Award,
    Languages, ShieldCheck, Sparkles, ChevronRight, Quote,
} from 'lucide-react-native'
import { colors as C, spacing, radius, shadows, fonts, typography } from '../../config/theme'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FaScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [priests, setPriests] = useState<Priest[]>([])
    /* Distingue « aucun prêtre publié » de « la requête a échoué » :
       le même message pour deux causes opposées empêchait de savoir
       s'il fallait saisir des données ou corriger un accès. */
    const [erreurAnnuaire, setErreurAnnuaire] = useState<string | null>(null)
    const [prices, setPrices] = useState<{ presentiel?: string; visio?: string }>({})
    const [loading, setLoading] = useState(true)

    const [detail, setDetail] = useState<Priest | null>(null)

    // Réservation
    const [booking, setBooking] = useState<Priest | null>(null)
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

                    /* Deux sources, dans cet ordre :

                       1. `pricing_options` — le detail par mode, quand l'admin l'a
                          renseigne. La recherche est LARGE : les libelles varient
                          d'une saisie a l'autre (« Presentiel », « En presentiel »,
                          « Sur place », « Visio », « Visioconference », « A
                          distance »). Un `includes('presentiel')` strict ne
                          trouvait rien des que le libelle differait.

                       2. `price_display` — la ligne unique affichee par la liste
                          des services, du type « Presentiel 350 € · Visio 380 € ».
                          C'est CE champ que l'ecran des services lit, et c'est
                          pour cela que la liste affichait des prix la ou cet ecran
                          n'affichait rien : il interrogeait une autre colonne.

                       Sans l'un ni l'autre, on n'invente rien : les cartes restent
                       sans montant plutot que d'annoncer un prix faux. */
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
                        // « Présentiel 350 € · Visio 380 € » → on isole chaque montant.
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
            setBooking(null)
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
                toast(t('Consultation réservée'), t('Votre paiement est confirmé. Notre équipe vous contactera pour fixer le rendez-vous. Une facture vous a été envoyée par email.'))
            } else {
                toast(t('Paiement reçu'), t('Le paiement a été reçu mais la confirmation a échoué. Référence : ') + txId)
            }
        } catch {
            toast(t('Paiement reçu'), t('Confirmation réseau échouée. Référence : ') + txId)
        } finally {
            setPendingOrder(null)
        }
    }, [pendingOrder, t])

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.header}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    accessibilityRole="button"
                    accessibilityLabel={t('Retour')}
                    hitSlop={12}
                    style={styles.back}
                >
                    <ArrowLeft size={20} color={C.textPrimary} />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.hTitle}>{t('Prêtres Fa & Racines')}</Text>
                    <Text style={styles.hSub}>{t('Consultez un maître du Fa pour renouer avec vos ancêtres')}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
            ) : (
                <FlatList
                    data={priests}
                    keyExtractor={p => p.id}
                    contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24 }}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        <View style={styles.intro}>
                            <View style={styles.introIcon}><Sparkles size={18} color={C.primary} /></View>
                            <Text style={styles.introText}>
                                {t('Le Fa est la sagesse divinatoire du Bénin. Nos prêtres accompagnent votre quête de racines avec respect et discrétion.')}
                            </Text>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>{erreurAnnuaire
                                ? `${t('Annuaire momentanément inaccessible.')} (${erreurAnnuaire})`
                                : t('Nos prêtres ne sont pas encore présentés ici. Vous pouvez réserver dès maintenant : notre équipe vous met en relation avec un Bokonon reconnu.')}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <PriestCard priest={item} t={t} onOpen={() => setDetail(item)} onBook={() => openBooking(item)} />
                    )}
                    ListFooterComponent={
                        /* Ce bouton ne s'affichait QUE si l'annuaire contenait au
                           moins un prêtre. L'annuaire étant vide, l'écran devenait
                           un cul-de-sac : plus aucun moyen de réserver.

                           Or le site ne liste aucun prêtre : il propose
                           directement le choix du mode, le prix et le paiement.
                           La réservation ne doit donc jamais dépendre de
                           l'annuaire — celui-ci n'est qu'un confort quand des
                           prêtres sont publiés. */
                        <Pressable style={styles.anyBtn} onPress={() => openBooking(null)}
                            accessibilityRole="button"
                            hitSlop={6}>
                            <Text style={styles.anyBtnText}>
                                {priests.length > 0
                                    ? t('Réserver sans choisir de prêtre')
                                    : t('Réserver ma consultation')}
                            </Text>
                            <ChevronRight size={16} color={C.primary} />
                        </Pressable>
                    }
                />
            )}

            {/* DÉTAIL PRÊTRE */}
            <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setDetail(null)}
                        accessibilityRole="button"
                        hitSlop={6} />
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

                                <Pressable style={styles.cta} onPress={() => { const p = detail; setDetail(null); openBooking(p) }}
                                    accessibilityRole="button"
                                    hitSlop={6}>
                                    <Text style={styles.ctaText}>{t('Réserver une consultation')}</Text>
                                </Pressable>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* RÉSERVATION */}
            <Modal visible={booking !== null} animationType="slide" transparent onRequestClose={() => setBooking(null)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setBooking(null)}
                        accessibilityRole="button"
                        hitSlop={6} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.sheetHandle} />
                            <Text style={styles.bookTitle}>{t('Réserver une consultation')}</Text>
                            {!!booking && <Text style={styles.bookPriest}>{t('Avec')} {booking.prenom} {booking.nom}</Text>}

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

                            <Pressable style={styles.clauseRow} onPress={() => setClause(c => !c)}
                                accessibilityRole="button"
                                hitSlop={6}>
                                <View style={[styles.checkbox, clause && styles.checkboxOn]}>
                                    {clause && <Check size={13} color="#fff" />}
                                </View>
                                <Text style={styles.clauseText}>
                                    {t("J'accepte la clause de mise en relation : Retour Gagnant facilite le contact avec le prêtre et n'est pas responsable du contenu spirituel de la consultation.")}
                                </Text>
                            </Pressable>

                            <Pressable style={[styles.cta, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submitBooking}
                                accessibilityRole="button"
                                hitSlop={6}>
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.ctaText}>{t('Réserver et payer')}</Text>}
                            </Pressable>
                            <Text style={styles.secure}>{t('Paiement sécurisé — Mobile Money / Carte')}</Text>
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

function PriestAvatar({ uri, size = 56 }: { uri?: string | null; size?: number }) {
    if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceWarm }} />
    return (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
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
    return (
        <View style={styles.meta}>{icon}<Text style={styles.metaText}>{text}</Text></View>
    )
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
        <Pressable style={[styles.modeCard, active && styles.modeCardActive]} onPress={onPress}
            accessibilityRole="button"
            hitSlop={6}>
            <View style={[styles.modeIcon, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>{icon}</View>
            <Text style={[styles.modeLabel, active && { color: '#fff' }]}>{label}</Text>
            {!!price && <Text style={[styles.modePrice, active && { color: 'rgba(255,255,255,0.9)' }]}>{price}</Text>}
        </Pressable>
    )
}

const PriestCard = React.memo(function PriestCard(
    { priest, t, onOpen, onBook }: { priest: Priest; t: (s: string) => string; onOpen: () => void; onBook: () => void },
) {
    const first = useMemo(() => (priest.prestations || []).slice(0, 3), [priest.prestations])
    return (
        <Pressable style={styles.card} onPress={onOpen}
            accessibilityRole="button"
            hitSlop={6}>
            <View style={styles.cardTop}>
                <PriestAvatar uri={priest.photo_url} size={64} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{priest.prenom} {priest.nom}</Text>
                    {!!priest.titre && <Text style={styles.cardTitre} numberOfLines={1}>{priest.titre}</Text>}
                    <RatingRow avg={priest.rating_avg} count={priest.rating_count} t={t} />
                </View>
            </View>
            {!!priest.localisation && (
                <View style={styles.cardLoc}><MapPin size={12} color={C.textMuted} /><Text style={styles.cardLocText}>{priest.localisation}</Text></View>
            )}
            {first.length > 0 && (
                <View style={styles.chipWrap}>
                    {first.map((p, i) => <View key={i} style={styles.chipSm}><Text style={styles.chipSmText}>{p}</Text></View>)}
                </View>
            )}
            <Pressable style={styles.cardBtn} onPress={onBook}
                accessibilityRole="button"
                hitSlop={6}>
                <Text style={styles.cardBtnText}>{t('Réserver')}</Text>
                <ChevronRight size={15} color="#fff" />
            </Pressable>
        </Pressable>
    )
})

/* ── Styles ──────────────────────────────────────────────── */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topFlag: { marginHorizontal: spacing.lg, borderRadius: radius.pill, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    back: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    hTitle: { ...typography.h2, color: C.textPrimary },
    hSub: { ...typography.bodySmall, color: C.textMuted, marginTop: 2 },

    intro: { flexDirection: 'row', gap: 12, backgroundColor: C.surfaceWarm, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: C.borderGold },
    introIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.goldMuted, alignItems: 'center', justifyContent: 'center' },
    introText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: C.textSecondary, lineHeight: 19 },

    empty: { padding: spacing.xl, alignItems: 'center' },
    emptyText: { fontFamily: fonts.body, color: C.textMuted, textAlign: 'center' },

    card: { backgroundColor: C.surface, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: C.border, ...shadows.sm },
    cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    cardName: { fontFamily: fonts.bodyBold, fontSize: 16, color: C.textPrimary },
    cardTitre: { fontFamily: fonts.body, fontSize: 12.5, color: C.textMuted, marginTop: 1 },
    cardLoc: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
    cardLocText: { fontFamily: fonts.body, fontSize: 12, color: C.textMuted },
    cardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 10, marginTop: spacing.md },
    cardBtnText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: '#fff' },

    anyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, marginTop: 4 },
    anyBtnText: { fontFamily: fonts.bodySemibold, fontSize: 13.5, color: C.primary },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    chip: { backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.primaryDark },
    chipSm: { backgroundColor: C.surfaceWarm, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
    chipSmText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.textSecondary },

    ratingText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.textSecondary },
    noRating: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.primary, marginTop: 3 },

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
