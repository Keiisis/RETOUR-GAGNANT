/* ═══════════════════════════════════════════════════════════
   Permis de Conduire Béninois - réservation mobile (fidèle maquette Sleek).
   Editorial (hero, piliers, métier, étapes, contraste) + 3 étapes interactives :
   1. catégorie (prix serveur, /api/permis-types) · 2. auto-école (/api/driving-
   schools, facultatif) · 3. coordonnées → /api/services/permis-checkout →
   Kkiapay natif → /api/checkout/verify. Charte blanche + tricolore. Aucun prix
   codé en dur.
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image,
    ActivityIndicator, TextInput, Share, LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, Share2, Car, Clock, MapPin, Check, IdCard, ShieldCheck,
    CheckCircle, Layers, RefreshCw, Users, FileCheck, X, XCircle, CheckCircle2,
    Wand2, ChevronRight, Plus, User, Mail, Phone, ArrowRight,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, shadows, fonts, typography } from '../../config/theme'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import KkiapayModal from '../../components/KkiapayModal'
import { fetchWithTimeout } from '../../lib/fetch'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const PLAYFAIR = fonts.extrabold

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface PermisType {
    id: string
    category: string
    label: string
    description: string | null
    age_min: number | null
    price_eur: number | null
    duration: string | null
}
interface School {
    id: string
    nom: string
    ville: string | null
    description: string | null
    photo_url: string | null
    price_eur: number | null
    duration: string | null
}

const cleanLabel = (l: string) => l.replace(/\s*\([^)]*\)\s*$/, '')

const PILIERS = [
    { icon: Car, title: 'Mobilité totale', desc: 'Conduisez librement sur tout le territoire national.' },
    { icon: RefreshCw, title: 'Échange simple', desc: 'Convertissez votre permis étranger en titre béninois.' },
    { icon: Users, title: 'Accès écoles', desc: 'Partenariats avec les meilleures auto-écoles.' },
    { icon: FileCheck, title: 'ANATT Direct', desc: 'Liaison administrative directe et sécurisée.' },
]
const ETAPES = [
    { num: '01', title: 'Audit du dossier', desc: "Vérification de la validité de vos pièces actuelles et éligibilité à l'échange." },
    { num: '02', title: 'Dépôt ANATT', desc: "Transmission sécurisée de votre demande à l'Agence Nationale des Transports Terrestres." },
    { num: '03', title: 'Suivi & Retrait', desc: 'Récupération de votre titre définitif et envoi sécurisé à votre adresse.' },
]
const SOLO = ["Files d'attente interminables à l'ANATT", 'Risque de faux documents via intermédiaires', 'Processus administratif opaque']
const AVEC = ['Dossier géré 100% à distance', "Garantie d'authenticité de l'ANATT", 'Suivi en temps réel de votre titre']
const FAQ = [
    { q: 'Puis-je échanger un permis français ?', r: "Oui, sous conditions. Nous vérifions l'éligibilité de votre permis étranger à l'échange lors de l'audit de votre dossier." },
    { q: 'Quels sont les délais réels ?', r: "Ils dépendent de la catégorie et de l'ANATT, en général de 2 à 4 semaines une fois votre dossier complet." },
    { q: 'Le permis est-il biométrique ?', r: "Oui, il s'agit du titre officiel béninois délivré par l'ANATT." },
    { q: 'Comment se passe le paiement ?', r: 'Le paiement est 100% sécurisé via Kkiapay (Mobile Money ou carte). Un reçu vous est envoyé par email dès confirmation.' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PermisScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [types, setTypes] = useState<PermisType[]>([])
    const [typeId, setTypeId] = useState('')
    const [schools, setSchools] = useState<School[]>([])
    const [schoolId, setSchoolId] = useState('')
    const [form, setForm] = useState({ name: '', email: '', phone: '' })
    const [focused, setFocused] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [openFaq, setOpenFaq] = useState<number | null>(null)

    const [showPay, setShowPay] = useState(false)
    const [pendingOrder, setPendingOrder] = useState<string | null>(null)
    const [payAmount, setPayAmount] = useState('')

    const scrollRef = useRef<ScrollView>(null)
    const [catY, setCatY] = useState(0)

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const [tRes, sRes] = await Promise.all([
                    fetchWithTimeout(`${API_BASE}/api/permis-types`, { timeoutMs: 12000 }),
                    fetchWithTimeout(`${API_BASE}/api/driving-schools`, { timeoutMs: 12000 }),
                ])
                const tJson = await tRes.json().catch(() => ({}))
                const sJson = await sRes.json().catch(() => ({}))
                if (!alive) return
                setTypes(Array.isArray(tJson.types) ? tJson.types : [])
                setSchools(Array.isArray(sJson.schools) ? sJson.schools : [])
            } catch { /* repli : listes vides gérées à l'affichage */ }
            finally { if (alive) setLoading(false) }
        })()
        return () => { alive = false }
    }, [])

    useEffect(() => {
        setForm({
            name: profile ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() : '',
            email: profile?.email || '',
            phone: profile?.phone || '',
        })
    }, [profile])

    const selected = types.find(x => x.id === typeId) || null
    const priceReady = !!(selected && typeof selected.price_eur === 'number' && selected.price_eur > 0)
    const minPrice = types.reduce((m, ty) => (ty.price_eur && ty.price_eur > 0 ? Math.min(m, ty.price_eur) : m), Infinity)

    const submitBooking = useCallback(async () => {
        if (!typeId) { toast(t('Catégorie requise'), t('Choisissez une catégorie de permis.')); return }
        if (!form.name.trim() || !form.phone.trim()) {
            toast(t('Champs requis'), t('Votre nom et votre téléphone sont nécessaires.')); return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            toast(t('Email invalide'), t('Veuillez saisir un email valide.')); return
        }
        setSubmitting(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/services/permis-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 20000,
                body: JSON.stringify({
                    permis_type_id: typeId,
                    school_id: schoolId || undefined,
                    customer_name: form.name.trim(),
                    customer_email: form.email.trim().toLowerCase(),
                    customer_phone: form.phone.trim(),
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
            setShowPay(true)
        } catch {
            toast(t('Erreur réseau'), t('Vérifiez votre connexion et réessayez.'))
        } finally {
            setSubmitting(false)
        }
    }, [typeId, schoolId, form, t])

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
                toast(t('Inscription confirmée'), t('Paiement confirmé. Notre équipe vous contacte sous 24 h pour lancer votre dossier de permis et planifier votre formation. Reçu envoyé par email.'))
            } else {
                toast(t('Paiement reçu'), t('Le paiement a été reçu mais la confirmation a échoué. Référence : ') + txId)
            }
        } catch {
            toast(t('Paiement reçu'), t('Confirmation réseau échouée. Référence : ') + txId)
        } finally {
            setPendingOrder(null)
        }
    }, [pendingOrder, t])

    const field = (name: string) => [styles.field, focused === name && styles.fieldFocused]
    const onShare = () => Share.share({ message: t('Permis de conduire béninois via Retour Gagnant : https://www.retourgagnantbenin.bj/services/permis-conduire') }).catch(() => {})
    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }
    const scrollToCategories = () => scrollRef.current?.scrollTo({ y: Math.max(0, catY - 16), animated: true })

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Permis de Conduire')}</Text>
                <Pressable onPress={onShare} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Hero */}
                <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                    <View style={styles.badge}><IdCard size={14} color={C.primary} strokeWidth={2.2} /><Text style={styles.badgeText}>{t('Transport & Mobilité')}</Text></View>
                    <Text style={styles.heroTitle}>{t('Permis de Conduire Béninois')}</Text>
                    <Text style={styles.heroSub}>{t("Échangez votre permis étranger ou obtenez un nouveau titre officiel via nos auto-écoles partenaires agréées par l'ANATT.")}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                        {[{ icon: CheckCircle, label: 'Officiel' }, { icon: Layers, label: 'Toutes catégories' }, { icon: ShieldCheck, label: 'Agréé ANATT' }].map(({ icon: Ic, label }) => (
                            <View key={label} style={styles.chip}><Ic size={14} color={C.primary} strokeWidth={2.2} /><Text style={styles.chipText}>{t(label)}</Text></View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Trust strip */}
                <View style={styles.trustStrip}>
                    {['Délai rapide', 'Sécurisé ANATT', 'À distance'].map((tr, i) => (
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

                <View style={styles.body}>
                    {/* Notre métier */}
                    <Text style={styles.eyebrow}>{t('Notre métier')}</Text>
                    <Text style={styles.h2}>{t("L'échange ou l'obtention, sans files d'attente")}</Text>
                    <Text style={styles.para}>{t("Le cabinet Retour Gagnant gère l'intégralité de votre dossier de conduite. Que vous soyez en phase d'installation ou simplement de passage, nous facilitons vos démarches auprès de l'ANATT pour vous garantir un titre authentique et légal.")}</Text>

                    {/* Étapes */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Les étapes')}</Text>
                    <View style={styles.timeline}>
                        <View style={styles.timelineLine} />
                        {ETAPES.map((e, i) => (
                            <View key={e.num} style={styles.step}>
                                <View style={[styles.stepDot, i === 0 ? styles.stepDotGold : styles.stepDotGreen]}>
                                    <Text style={[styles.stepNum, i === 0 ? { color: C.accentInk } : { color: C.primary }]}>{e.num}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.stepTitle}>{t(e.title)}</Text>
                                    <Text style={styles.stepDesc}>{t(e.desc)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contraste */}
                    <View style={styles.soloCard}>
                        <View style={styles.contrastRow}><View style={styles.soloBadge}><X size={16} color={C.danger} strokeWidth={2.5} /></View><Text style={[styles.contrastCardTitle, { color: C.danger }]}>{t('En solo')}</Text></View>
                        {SOLO.map((s, i) => <View key={i} style={styles.contrastItem}><XCircle size={14} color={C.danger} style={{ marginTop: 2, opacity: 0.6 }} /><Text style={styles.soloText}>{t(s)}</Text></View>)}
                    </View>
                    <View style={styles.avecCard}>
                        <View style={styles.contrastRow}><View style={styles.avecBadge}><Check size={16} color="#fff" strokeWidth={3} /></View><Text style={[styles.contrastCardTitle, { color: C.primary }]}>{t('Avec Retour Gagnant')}</Text></View>
                        {AVEC.map((s, i) => <View key={i} style={styles.contrastItem}><CheckCircle size={14} color={C.primary} style={{ marginTop: 2 }} /><Text style={styles.avecText}>{t(s)}</Text></View>)}
                    </View>

                    {/* 1. Catégorie */}
                    <View onLayout={e => setCatY(e.nativeEvent.layout.y)} style={styles.stepHeaderRow}>
                        <Text style={styles.sectionTitle}>{t('1. Choisir ma catégorie')}</Text>
                        <Text style={styles.stepBadge}>{t('Étape 1/3')}</Text>
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}><ActivityIndicator color={C.primary} size="large" /></View>
                    ) : types.length === 0 ? (
                        <View style={styles.warnBox}><IdCard size={22} color={C.accentInk} /><Text style={styles.warnText}>{t('Les catégories de permis seront bientôt disponibles. Contactez-nous pour lancer votre permis dès maintenant.')}</Text></View>
                    ) : (
                        <View style={{ gap: spacing.md }}>
                            {types.map(ty => {
                                const active = typeId === ty.id
                                const pEur = typeof ty.price_eur === 'number' && ty.price_eur > 0 ? ty.price_eur : null
                                return (
                                    <Pressable key={ty.id} onPress={() => setTypeId(ty.id)} style={[styles.catCard, active && styles.catCardActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                                        <View style={styles.catTop}>
                                            <View style={styles.catLeft}>
                                                <View style={[styles.catBadge, active && styles.catBadgeActive]}>
                                                    <Text style={[styles.catBadgeText, active && { color: C.primaryText }]}>{ty.category}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.catName}>{cleanLabel(ty.label)}</Text>
                                                    {!!ty.age_min && <Text style={styles.catSub}>{t('Âge min.')} {ty.age_min} {t('ans')}</Text>}
                                                </View>
                                            </View>
                                            {active && <CheckCircle2 size={24} color={C.primary} />}
                                        </View>
                                        {!!ty.description && <Text style={styles.catDesc} numberOfLines={2}>{ty.description}</Text>}
                                        <View style={styles.catFooter}>
                                            {!!ty.duration && (
                                                <View style={styles.catDuration}><Clock size={12} color={C.textMuted} /><Text style={styles.catDurationText}>{ty.duration}</Text></View>
                                            )}
                                            <Text style={styles.catPrice}>{pEur ? `${pEur} €` : t('Tarif à confirmer')}</Text>
                                        </View>
                                    </Pressable>
                                )
                            })}
                        </View>
                    )}

                    {/* 2. Auto-école */}
                    {schools.length > 0 && (
                        <>
                            <View style={[styles.stepHeaderRow, { marginTop: spacing.xxl }]}>
                                <Text style={styles.sectionTitle}>{t('2. Choisir mon auto-école')}</Text>
                                <Text style={styles.stepBadge}>{t('Optionnel')}</Text>
                            </View>
                            <Pressable onPress={() => setSchoolId('')} style={[styles.rgbCard, schoolId === '' && styles.rgbCardActive]} accessibilityRole="button">
                                <View style={styles.rgbIcon}><Wand2 size={22} color={C.primary} /></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.schoolName}>{t('Laisser RGB choisir pour moi')}</Text>
                                    <Text style={styles.schoolSub}>{t("Sélection de l'école la plus rapide par nos experts")}</Text>
                                </View>
                                {schoolId === '' && <CheckCircle2 size={20} color={C.primary} />}
                            </Pressable>
                            <Text style={styles.orLabel}>{t('Ou sélectionner manuellement :')}</Text>
                            {schools.map(sc => {
                                const on = schoolId === sc.id
                                return (
                                    <Pressable key={sc.id} onPress={() => setSchoolId(sc.id)} style={[styles.schoolRow, on && styles.schoolRowActive]} accessibilityRole="button">
                                        <View style={styles.schoolImgWrap}>
                                            {sc.photo_url ? <Image source={{ uri: sc.photo_url }} style={styles.schoolImg} /> : <Car size={18} color={C.primary} />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.schoolName} numberOfLines={1}>{sc.nom}</Text>
                                            {!!sc.ville && <View style={styles.schoolCityRow}><MapPin size={11} color={C.textMuted} /><Text style={styles.schoolSub} numberOfLines={1}>{sc.ville}</Text></View>}
                                        </View>
                                        {on ? <CheckCircle2 size={20} color={C.primary} /> : <ChevronRight size={18} color={C.textMuted} />}
                                    </Pressable>
                                )
                            })}
                        </>
                    )}

                    {/* 3. Coordonnées */}
                    <View style={[styles.stepHeaderRow, { marginTop: spacing.xxl }]}>
                        <Text style={styles.sectionTitle}>{t('3. Vos coordonnées')}</Text>
                        <Text style={styles.stepBadge}>{t('Étape 3/3')}</Text>
                    </View>
                    <Text style={styles.inputLabel}>{t('Nom complet')}</Text>
                    <View style={field('name')}>
                        <User size={18} color={C.textMuted} strokeWidth={2} />
                        <TextInput value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} onFocus={() => setFocused('name')} onBlur={() => setFocused(null)} placeholder={t('Nom complet')} placeholderTextColor={C.placeholder} style={styles.input} />
                    </View>
                    <Text style={styles.inputLabel}>{t('Email')}</Text>
                    <View style={field('email')}>
                        <Mail size={18} color={C.textMuted} strokeWidth={2} />
                        <TextInput value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} placeholder="nom@exemple.com" placeholderTextColor={C.placeholder} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                    </View>
                    <Text style={styles.inputLabel}>{t('Téléphone')}</Text>
                    <View style={field('phone')}>
                        <Phone size={18} color={C.textMuted} strokeWidth={2} />
                        <TextInput value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} placeholder="+229 …" placeholderTextColor={C.placeholder} keyboardType="phone-pad" style={styles.input} />
                    </View>

                    {/* FAQ */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Questions fréquentes')}</Text>
                    {FAQ.map((f, i) => {
                        const open = openFaq === i
                        return (
                            <Pressable key={i} onPress={() => toggleFaq(i)} style={styles.faqCard} accessibilityRole="button">
                                <View style={styles.faqHead}>
                                    <Text style={styles.faqQ}>{t(f.q)}</Text>
                                    <Plus size={18} color={C.primary} style={{ transform: [{ rotate: open ? '45deg' : '0deg' }] }} />
                                </View>
                                {open && <Text style={styles.faqA}>{t(f.r)}</Text>}
                            </Pressable>
                        )
                    })}

                    {/* CTA final */}
                    <View style={styles.finalSection}>
                        <Text style={styles.finalTitle}>{t('Prenez la route en toute légalité.')}</Text>
                        <Text style={styles.finalText}>{t('Votre dossier sera traité par nos experts dès validation du paiement.')}</Text>
                        <Pressable onPress={submitBooking} disabled={submitting || !typeId || !priceReady} style={({ pressed }) => [styles.finalBtn, pressed && { transform: [{ scale: 0.98 }] }, (submitting || !typeId || !priceReady) && { opacity: 0.5 }]} accessibilityRole="button">
                            {submitting ? <ActivityIndicator color={C.primaryText} /> : <><Text style={styles.finalBtnText}>{t('Réserver et payer')}</Text><ArrowRight size={19} color={C.primaryText} /></>}
                        </Pressable>
                        <Text style={styles.finalNote}>{t('Paiement 100% sécurisé via Kkiapay')}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Barre collante récap */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View>
                    <Text style={styles.stickyLabel}>
                        {selected ? `${t('Récapitulatif')} (${selected.category})` : t('À partir de')}
                    </Text>
                    <Text style={styles.stickyValue}>
                        {priceReady ? `${selected!.price_eur} €` : (isFinite(minPrice) ? `${minPrice} €` : t('Sur devis'))}
                    </Text>
                </View>
                {typeId ? (
                    <Pressable onPress={submitBooking} disabled={submitting} style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }, submitting && { opacity: 0.6 }]} accessibilityRole="button">
                        {submitting ? <ActivityIndicator color={C.primaryText} /> : <Text style={styles.stickyBtnText}>{t('Payer')}</Text>}
                    </Pressable>
                ) : (
                    <Pressable onPress={scrollToCategories} style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button">
                        <Text style={styles.stickyBtnText}>{t('Choisir')}</Text>
                    </Pressable>
                )}
            </View>

            <KkiapayModal
                visible={showPay}
                amount={payAmount}
                serviceName={t('Permis de Conduire Béninois')}
                onClose={() => setShowPay(false)}
                onSuccess={onPaid}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface },
    headerTitle: { fontSize: 12, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

    scroll: { paddingBottom: 130 },

    hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, marginBottom: spacing.lg },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    heroTitle: { fontFamily: PLAYFAIR, fontSize: 30, lineHeight: 36, color: C.text, marginBottom: spacing.sm },
    heroSub: { ...typography.body, color: C.textMuted, marginBottom: spacing.md, lineHeight: 23 },
    chipsRow: { gap: spacing.sm, paddingVertical: 2 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadows.card },
    chipText: { fontSize: 11, fontFamily: fonts.bold, color: C.text },

    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: spacing.gutter, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginBottom: spacing.xl, flexWrap: 'wrap' },
    trustText: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    trustDot: { color: C.accent, fontSize: 12 },

    pilierBand: { backgroundColor: C.primary, borderRadius: radius.xxl, marginHorizontal: spacing.md, paddingVertical: 28, paddingHorizontal: spacing.gutter, marginBottom: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', ...shadows.cardRaised },
    pilier: { width: '50%', paddingRight: spacing.md, marginBottom: spacing.lg },
    pilierIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    pilierTitle: { color: '#FFFFFF', fontFamily: fonts.bold, fontSize: 14 },
    pilierDesc: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, marginTop: 4 },

    body: { paddingHorizontal: spacing.gutter },
    eyebrow: { fontSize: 10, fontFamily: fonts.extrabold, color: C.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: spacing.sm },
    h2: { fontFamily: PLAYFAIR, fontSize: 22, lineHeight: 28, color: C.text, marginBottom: spacing.md },
    para: { ...typography.body, color: C.textMuted, lineHeight: 23 },

    timeline: { position: 'relative', marginTop: spacing.md, marginBottom: spacing.xxl },
    timelineLine: { position: 'absolute', left: 19, top: 6, bottom: 6, width: 2, backgroundColor: C.border },
    step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
    stepDot: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 2, ...shadows.card },
    stepDotGold: { borderColor: C.accent },
    stepDotGreen: { borderColor: C.primary },
    stepNum: { fontSize: 14, fontFamily: fonts.extrabold },
    stepTitle: { fontSize: 15, fontFamily: fonts.bold, color: C.text, marginBottom: 3, marginTop: 4 },
    stepDesc: { fontSize: 12.5, lineHeight: 19, color: C.textMuted },

    soloCard: { backgroundColor: C.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.dangerSoft, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
    avecCard: { backgroundColor: C.primarySoft, borderRadius: radius.xxl, borderWidth: 1, borderColor: C.primary, padding: spacing.lg, marginBottom: spacing.xxl, ...shadows.card },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
    soloBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center' },
    avecBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    contrastCardTitle: { fontSize: 14, fontFamily: fonts.bold },
    contrastItem: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    soloText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.textMuted },
    avecText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.text, fontFamily: fonts.semibold },

    /* Steps interactifs */
    stepHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: C.text },
    stepBadge: { fontSize: 9, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },

    loadingBox: { paddingVertical: 40, alignItems: 'center' },
    warnBox: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: C.accentSoft, borderRadius: radius.lg, padding: spacing.md },
    warnText: { flex: 1, ...typography.bodySmall, color: C.accentInk },

    catCard: { backgroundColor: C.surface, borderWidth: 2, borderColor: C.border, borderRadius: radius.xxl, padding: spacing.md },
    catCardActive: { borderColor: C.primary, ...shadows.card },
    catTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    catLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
    catBadge: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    catBadgeActive: { backgroundColor: C.primary },
    catBadgeText: { fontSize: 18, fontFamily: fonts.extrabold, color: C.textSec },
    catName: { fontSize: 15, fontFamily: fonts.bold, color: C.text },
    catSub: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
    catDesc: { fontSize: 12, lineHeight: 18, color: C.textMuted, marginBottom: spacing.md },
    catFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: C.border },
    catDuration: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    catDurationText: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted },
    catPrice: { fontSize: 16, fontFamily: fonts.extrabold, color: '#00643C' },

    rgbCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.xxl, padding: spacing.md, marginBottom: spacing.md },
    rgbCardActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
    rgbIcon: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    orLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.md },
    schoolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.sm },
    schoolRowActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
    schoolImgWrap: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    schoolImg: { width: '100%', height: '100%' },
    schoolName: { fontSize: 14, fontFamily: fonts.bold, color: C.text },
    schoolSub: { fontSize: 11, color: C.textMuted },
    schoolCityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },

    inputLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm, marginLeft: 4 },
    field: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14, marginBottom: spacing.md },
    fieldFocused: { borderColor: C.primary, backgroundColor: C.surface },
    input: { flex: 1, ...typography.body, color: C.text, padding: 0 },

    faqCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    faqQ: { flex: 1, fontSize: 13.5, fontFamily: fonts.bold, color: C.text },
    faqA: { fontSize: 13, lineHeight: 20, color: C.textMuted, marginTop: spacing.sm },

    finalSection: { alignItems: 'center', marginTop: spacing.xxl },
    finalTitle: { fontFamily: PLAYFAIR, fontSize: 24, lineHeight: 30, color: C.text, textAlign: 'center', marginBottom: spacing.sm },
    finalText: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md },
    finalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', backgroundColor: C.primary, borderRadius: radius.xl, paddingVertical: 18, ...shadows.cardRaised },
    finalBtnText: { fontSize: 16, fontFamily: fonts.bold, color: C.primaryText },
    finalNote: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.lg },

    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    stickyLabel: { fontSize: 10, fontFamily: fonts.bold, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickyValue: { fontSize: 20, fontFamily: fonts.extrabold, color: '#00643C', marginTop: 1 },
    stickyBtn: { minWidth: 96, alignItems: 'center', backgroundColor: C.primary, borderRadius: radius.lg, paddingHorizontal: 28, paddingVertical: 14, ...shadows.card },
    stickyBtnText: { fontSize: 15, fontFamily: fonts.bold, color: C.primaryText },
})
