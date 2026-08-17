/* ═══════════════════════════════════════════════════════════
   Logement (Acheter ou Louer) - catalogue + mise en relation.
   Service SANS paiement : RGB accompagne, les prospects sont transmis au
   partenaire SIMAU. Miroir du web /services/logement :
   /api/logements (catalogue) + /api/logements/lead (capture prospect).
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image,
    ActivityIndicator, TextInput, Modal, Platform, Share,
    LayoutAnimation, UIManager,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, MapPin, Ruler, Home, Check, X, Send, ShieldCheck,
    Share2, ChevronDown, CheckCircle, XCircle, Users, KeyRound, FileText,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, shadows, typography, fonts } from '../../config/theme'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

interface Logement {
    id: string
    nom: string
    type: string | null
    ville: string | null
    site: string | null
    surface_m2: number | null
    prix_comptant: number | null
    devise: string | null
    mensualite: number | null
    programme: string | null
    images: string[] | null
}

const fmt = (n: number | null, devise: string | null) => {
    if (!n || n <= 0) return null
    const cur = (devise || 'XOF') === 'XOF' ? 'FCFA' : (devise || '')
    return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} ${cur}`.trim()
}

const FORMULES = ['Comptant', 'Mensualité', 'À définir'] as const

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true)
}

/* Contenu éditorial : même patron que PermisScreen / FaScreen. */
const PILIERS = [
    { icon: Home, title: 'Programme national', desc: 'Accès aux logements sociaux et résidences du programme béninois.' },
    { icon: FileText, title: 'Dossier composé', desc: 'Nous montons votre dossier de candidature de bout en bout.' },
    { icon: KeyRound, title: 'Partenaire agréé', desc: 'Mise en relation directe avec notre partenaire logement.' },
]

const ETAPES = [
    { num: '1', title: 'Vous décrivez votre projet', desc: 'Type de bien, ville, budget et formule souhaitée : comptant ou mensualité.' },
    { num: '2', title: 'Nous qualifions votre dossier', desc: 'Vérification de votre éligibilité et constitution des pièces attendues.' },
    { num: '3', title: 'Mise en relation', desc: 'Votre dossier est transmis à notre partenaire agréé, qui vous présente les biens disponibles.' },
    { num: '4', title: 'Accompagnement jusqu’aux clés', desc: 'Suivi des démarches, du dossier de réservation à la remise du logement.' },
]

const SOLO = [
    'Des programmes annoncés sans interlocuteur joignable depuis l’étranger',
    'Des dossiers refusés pour une pièce manquante',
    'Aucun moyen de vérifier la réalité d’une offre à distance',
    'Le risque d’intermédiaires non agréés',
]

const AVEC = [
    'Un catalogue de biens réellement disponibles',
    'Un dossier de candidature composé et vérifié',
    'La mise en relation avec un partenaire agréé',
    'Un suivi jusqu’à la remise des clés',
]

const FAQ = [
    { q: 'Dois-je payer quelque chose sur l’application ?', a: "Non. Cet écran ne comporte aucun paiement : nous recueillons votre projet, composons votre dossier et vous mettons en relation avec notre partenaire logement agréé. Notre rémunération porte sur l'accompagnement du dossier, jamais sur la vente du bien." },
    { q: 'Puis-je acheter depuis l’étranger ?', a: "Oui, c'est précisément notre métier : l'essentiel de nos clients réside hors du Bénin. Toutes les démarches préparatoires se font à distance, et nous vous représentons sur place quand c'est nécessaire." },
    { q: 'Quelle est la différence entre comptant et mensualité ?', a: "Le comptant règle le bien en une fois. La formule en mensualité (location-accession) permet d'échelonner : vous occupez le logement en versant des mensualités qui construisent votre acquisition." },
    { q: 'Que se passe-t-il après ma demande ?', a: 'Notre équipe vous recontacte par email ou WhatsApp pour préciser votre projet, puis transmet votre dossier qualifié au partenaire. Vous restez informé à chaque étape.' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function LogementScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [logements, setLogements] = useState<Logement[]>([])
    const [loading, setLoading] = useState(true)

    const [showForm, setShowForm] = useState(false)
    const [target, setTarget] = useState<Logement | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [focused, setFocused] = useState<string | null>(null)
    const [form, setForm] = useState({
        prenom: '', nom: '', email: '', telephone: '', pays_residence: '', message: '',
    })
    const [diaspora, setDiaspora] = useState(true)
    const [formule, setFormule] = useState<(typeof FORMULES)[number]>('À définir')
    const [openFaq, setOpenFaq] = useState<number | null>(0)

    const onShare = useCallback(() => {
        Share.share({ message: t('Acheter ou louer au Bénin avec Retour Gagnant : https://www.retourgagnantbenin.bj/services/logement') }).catch(() => { })
    }, [t])

    const toggleFaq = (i: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'))
        setOpenFaq(prev => (prev === i ? null : i))
    }

    useEffect(() => {
        let alive = true
        ;(async () => {
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/logements`, { timeoutMs: 12000 })
                const json = await res.json().catch(() => ({}))
                if (alive) setLogements(Array.isArray(json.logements) ? json.logements : [])
            } catch { /* repli : liste vide */ }
            finally { if (alive) setLoading(false) }
        })()
        return () => { alive = false }
    }, [])

    const openForm = useCallback((l: Logement | null) => {
        setTarget(l)
        setForm({
            prenom: profile?.prenom || '',
            nom: profile?.nom || '',
            email: profile?.email || '',
            telephone: profile?.phone || '',
            pays_residence: '',
            message: l ? `Je suis intéressé(e) par : ${l.nom}.` : '',
        })
        setFormule('À définir')
        setDiaspora(true)
        setShowForm(true)
    }, [profile])

    const submitLead = useCallback(async () => {
        if (!form.nom.trim()) { toast(t('Nom requis'), t('Veuillez indiquer votre nom.')); return }
        if (!form.email.trim() && !form.telephone.trim()) {
            toast(t('Contact requis'), t('Indiquez un email ou un téléphone pour être recontacté.')); return
        }
        setSubmitting(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/logements/lead`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 20000,
                body: JSON.stringify({
                    logement_id: target?.id || undefined,
                    logement_nom: target?.nom || undefined,
                    programme: target?.programme || undefined,
                    nom: form.nom.trim(),
                    prenom: form.prenom.trim() || undefined,
                    email: form.email.trim().toLowerCase() || undefined,
                    telephone: form.telephone.trim() || undefined,
                    pays_residence: form.pays_residence.trim() || undefined,
                    diaspora,
                    formule_souhaitee: formule,
                    message: form.message.trim() || undefined,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                toast(t('Envoi impossible'), data.error || t('Réessayez dans un instant.'))
                return
            }
            setShowForm(false)
            toast(t('Demande envoyée'), t('Merci ! Notre équipe et notre partenaire vous recontactent rapidement pour votre projet de logement.'))
        } catch {
            toast(t('Erreur réseau'), t('Vérifiez votre connexion et réessayez.'))
        } finally {
            setSubmitting(false)
        }
    }, [form, target, diaspora, formule, t])

    const field = (name: string) => [styles.field, focused === name && styles.fieldFocused]

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Logement')}</Text>
                <Pressable onPress={onShare} style={styles.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                    <Share2 size={19} color={C.text} strokeWidth={2} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]} showsVerticalScrollIndicator={false}>
                {/* Hero éditorial */}
                <Animated.View entering={FadeInUp.duration(420)} style={styles.hero}>
                    <View style={styles.heroBadge}>
                        <Home size={14} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.heroBadgeText}>{t('Immobilier & Installation')}</Text>
                    </View>
                    <Text style={styles.title}>{t('Acheter ou Louer au Bénin')}</Text>
                    <Text style={styles.subtitle}>{t('Accédez au programme national de logements. Nous composons votre dossier et vous mettons en relation avec notre partenaire agréé. Aucun paiement ici.')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.heroChipsRow}>
                        {[{ icon: CheckCircle, label: 'Sans paiement' }, { icon: Users, label: 'Spécial diaspora' }, { icon: ShieldCheck, label: 'Partenaire agréé' }].map(({ icon: Ic, label }) => (
                            <View key={label} style={styles.heroChip}>
                                <Ic size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.heroChipText}>{t(label)}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </Animated.View>

                {/* Bandeau de confiance */}
                <View style={styles.trustStrip}>
                    {['Programme national', 'Dossier composé', 'À distance'].map((tr, i) => (
                        <React.Fragment key={tr}>
                            {i > 0 && <Text style={styles.trustDot}>•</Text>}
                            <Text style={styles.trustText}>{t(tr)}</Text>
                        </React.Fragment>
                    ))}
                </View>

                {/* Bande verte : piliers */}
                <View style={styles.pilierBand}>
                    {PILIERS.map(({ icon: Ic, title, desc }) => (
                        <View key={title} style={styles.pilier}>
                            <View style={styles.pilierIcon}><Ic size={22} color="#FFFFFF" strokeWidth={2} /></View>
                            <Text style={styles.pilierTitle}>{t(title)}</Text>
                            <Text style={styles.pilierDesc}>{t(desc)}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.body}>
                    {/* Notre métier */}
                    <Text style={styles.eyebrow}>{t('Notre métier')}</Text>
                    <Text style={styles.h2}>{t('Un logement au Bénin, piloté depuis l’étranger')}</Text>
                    <Text style={styles.para}>{t("Retour Gagnant ne vend pas de bien : nous composons votre dossier, vérifions votre éligibilité et vous mettons en relation avec notre partenaire logement agréé. Vous gardez la main sur votre projet, sans dépendre d'intermédiaires sur place.")}</Text>

                    {/* Étapes */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Les étapes')}</Text>
                    <View style={styles.timeline}>
                        <View style={styles.timelineLine} />
                        {ETAPES.map((e, i) => (
                            <View key={e.num} style={styles.step}>
                                <View style={[styles.stepDot, i === 0 ? styles.stepDotFirst : styles.stepDotGreen]}>
                                    <Text style={styles.stepNum}>{e.num}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.stepTitle}>{t(e.title)}</Text>
                                    <Text style={styles.stepDesc}>{t(e.desc)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contraste solo / avec */}
                    <View style={styles.soloCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.soloBadge}><X size={16} color={C.danger} strokeWidth={2.5} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.danger }]}>{t('En solo')}</Text>
                        </View>
                        {SOLO.map((s, i) => (
                            <View key={i} style={styles.contrastItem}>
                                <XCircle size={14} color={C.danger} style={{ marginTop: 2, opacity: 0.6 }} />
                                <Text style={styles.contrastText}>{t(s)}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.avecCard}>
                        <View style={styles.contrastRow}>
                            <View style={styles.avecBadge}><Check size={16} color="#fff" strokeWidth={3} /></View>
                            <Text style={[styles.contrastCardTitle, { color: C.primary }]}>{t('Avec Retour Gagnant')}</Text>
                        </View>
                        {AVEC.map((s, i) => (
                            <View key={i} style={styles.contrastItem}>
                                <CheckCircle size={14} color={C.primary} style={{ marginTop: 2 }} />
                                <Text style={styles.contrastText}>{t(s)}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.sectionLabel, { marginTop: spacing.xxl }]}>{t('Logements disponibles')}</Text>

                {loading ? (
                    <View style={styles.loadingBox}><ActivityIndicator color={C.primary} size="large" /></View>
                ) : logements.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Home size={26} color={C.textMuted} />
                        <Text style={styles.emptyText}>{t('Le catalogue arrive bientôt. Laissez vos coordonnées, nous vous présentons les biens correspondant à votre projet.')}</Text>
                    </View>
                ) : (
                    logements.map(l => {
                        const comptant = fmt(l.prix_comptant, l.devise)
                        const mens = fmt(l.mensualite, l.devise)
                        return (
                            <Pressable key={l.id} onPress={() => openForm(l)} style={styles.card} accessibilityRole="button">
                                <View style={styles.cardImgWrap}>
                                    {l.images && l.images[0]
                                        ? <Image source={{ uri: l.images[0] }} style={styles.cardImg} />
                                        : <View style={styles.cardImgFallback}><Home size={28} color={C.primary} /></View>}
                                    {!!l.type && <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{l.type}</Text></View>}
                                </View>
                                <View style={styles.cardBody}>
                                    <Text style={styles.cardName} numberOfLines={1}>{l.nom}</Text>
                                    <View style={styles.cardMeta}>
                                        <MapPin size={12} color={C.danger} />
                                        <Text style={styles.cardMetaText} numberOfLines={1}>
                                            {[l.ville, l.site].filter(Boolean).join(' · ')}
                                            {l.surface_m2 ? `  ·  ${l.surface_m2} m²` : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.cardPrices}>
                                        {comptant && (
                                            <View>
                                                <Text style={styles.priceLabel}>{t('Comptant')}</Text>
                                                <Text style={styles.priceValue}>{comptant}</Text>
                                            </View>
                                        )}
                                        {mens && (
                                            <View>
                                                <Text style={styles.priceLabel}>{t('Mensualité')}</Text>
                                                <Text style={styles.priceValue}>{mens}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.cardCta}>
                                        <Text style={styles.cardCtaText}>{t('Je suis intéressé(e)')}</Text>
                                        <Send size={13} color={C.primary} />
                                    </View>
                                </View>
                            </Pressable>
                        )
                    })
                )}

                    <View style={styles.secureRow}>
                        <ShieldCheck size={13} color={C.textMuted} />
                        <Text style={styles.secure}>{t('Vos coordonnées sont transmises à notre partenaire logement agréé.')}</Text>
                    </View>

                    {/* FAQ */}
                    <Text style={[styles.eyebrow, { marginTop: spacing.xxl }]}>{t('Questions fréquentes')}</Text>
                    <View style={{ gap: spacing.sm }}>
                        {FAQ.map((f, i) => {
                            const open = openFaq === i
                            return (
                                <Pressable key={i} onPress={() => toggleFaq(i)} style={styles.faqCard} accessibilityRole="button">
                                    <View style={styles.faqHead}>
                                        <Text style={styles.faqQ}>{t(f.q)}</Text>
                                        <ChevronDown size={18} color={C.textMuted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                                    </View>
                                    {open && <Text style={styles.faqA}>{t(f.a)}</Text>}
                                </Pressable>
                            )
                        })}
                    </View>
                </View>
            </ScrollView>

            {/* Barre d'action collante */}
            <View style={[styles.stickyBar, { paddingBottom: insets.bottom + 12 }]}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.stickyLabel}>{t('Mise en relation')}</Text>
                    <Text style={styles.stickyValue}>{t('Sans paiement')}</Text>
                </View>
                <Pressable
                    onPress={() => openForm(null)}
                    style={({ pressed }) => [styles.stickyBtn, pressed && { transform: [{ scale: 0.96 }] }]}
                    accessibilityRole="button"
                >
                    <Send size={16} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.stickyBtnText}>{t('Être recontacté')}</Text>
                </Pressable>
            </View>

            {/* ── Formulaire de mise en relation ── */}
            <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowForm(false)} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.sheetHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sheetOverline}>{t('Mise en relation')}</Text>
                                <Text style={styles.sheetTitle} numberOfLines={1}>
                                    {target ? target.nom : t('Mon projet de logement')}
                                </Text>
                            </View>
                            <Pressable onPress={() => setShowForm(false)} style={styles.closeBtn} hitSlop={8}>
                                <X size={20} color={C.text} />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.row2}>
                                <View style={[field('prenom'), styles.rowItem]}>
                                    <TextInput value={form.prenom} onChangeText={v => setForm(p => ({ ...p, prenom: v }))}
                                        onFocus={() => setFocused('prenom')} onBlur={() => setFocused(null)}
                                        placeholder={t('Prénom')} placeholderTextColor={C.placeholder} style={styles.input} />
                                </View>
                                <View style={[field('nom'), styles.rowItem]}>
                                    <TextInput value={form.nom} onChangeText={v => setForm(p => ({ ...p, nom: v }))}
                                        onFocus={() => setFocused('nom')} onBlur={() => setFocused(null)}
                                        placeholder={t('Nom')} placeholderTextColor={C.placeholder} style={styles.input} />
                                </View>
                            </View>
                            <View style={field('email')}>
                                <TextInput value={form.email} onChangeText={v => setForm(p => ({ ...p, email: v }))}
                                    onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                                    placeholder={t('Email')} placeholderTextColor={C.placeholder}
                                    keyboardType="email-address" autoCapitalize="none" style={styles.input} />
                            </View>
                            <View style={field('tel')}>
                                <TextInput value={form.telephone} onChangeText={v => setForm(p => ({ ...p, telephone: v }))}
                                    onFocus={() => setFocused('tel')} onBlur={() => setFocused(null)}
                                    placeholder={t('Téléphone (WhatsApp)')} placeholderTextColor={C.placeholder}
                                    keyboardType="phone-pad" style={styles.input} />
                            </View>
                            <View style={field('pays')}>
                                <TextInput value={form.pays_residence} onChangeText={v => setForm(p => ({ ...p, pays_residence: v }))}
                                    onFocus={() => setFocused('pays')} onBlur={() => setFocused(null)}
                                    placeholder={t('Pays de résidence')} placeholderTextColor={C.placeholder} style={styles.input} />
                            </View>

                            <Text style={styles.miniLabel}>{t('Formule souhaitée')}</Text>
                            <View style={styles.chipsRow}>
                                {FORMULES.map(f => (
                                    <Pressable key={f} onPress={() => setFormule(f)} style={[styles.chip, formule === f && styles.chipActive]}>
                                        <Text style={[styles.chipText, formule === f && styles.chipTextActive]}>{t(f)}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Pressable onPress={() => setDiaspora(d => !d)} style={styles.checkRow} hitSlop={6}>
                                <View style={[styles.checkbox, diaspora && styles.checkboxOn]}>
                                    {diaspora && <Check size={14} color={C.primaryText} strokeWidth={3} />}
                                </View>
                                <Text style={styles.checkText}>{t('Je fais partie de la diaspora')}</Text>
                            </Pressable>

                            <View style={[field('msg'), styles.msgField]}>
                                <TextInput value={form.message} onChangeText={v => setForm(p => ({ ...p, message: v }))}
                                    onFocus={() => setFocused('msg')} onBlur={() => setFocused(null)}
                                    placeholder={t('Votre message (facultatif)')} placeholderTextColor={C.placeholder}
                                    multiline numberOfLines={4} textAlignVertical="top" style={[styles.input, { minHeight: 80 }]} />
                            </View>

                            <Pressable onPress={submitLead} disabled={submitting}
                                style={({ pressed }) => [styles.submitBtn, pressed && { transform: [{ scale: 0.98 }] }, submitting && { opacity: 0.6 }]}
                                accessibilityRole="button">
                                {submitting ? <ActivityIndicator color={C.primaryText} /> : (
                                    <><Send size={17} color={C.primaryText} /><Text style={styles.submitText}>{t('Envoyer ma demande')}</Text></>
                                )}
                            </Pressable>
                            <Text style={styles.secureCenter}>{t('Aucun paiement. Mise en relation avec notre partenaire agréé.')}</Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    backBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h3, color: C.text },

    /* Le padding horizontal vit désormais sur `hero` et `body` : le scroll doit
       rester pleine largeur pour que la bande verte des piliers aille bord à bord. */
    scroll: { paddingBottom: 140 },
    body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl },

    /* Hero éditorial */
    hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.xl },
    heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    heroBadgeText: { ...typography.button, fontSize: 12, color: C.primary },
    heroChipsRow: { gap: 8, paddingTop: spacing.md, paddingRight: spacing.gutter },
    heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
    heroChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.text },
    title: { ...typography.h1, color: C.text },
    subtitle: { ...typography.body, color: C.textMuted, marginTop: spacing.sm },

    /* Bandeau de confiance */
    trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: spacing.md, backgroundColor: C.surfaceAlt, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
    trustText: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 },
    trustDot: { color: C.textMuted, fontSize: 11 },

    /* Bande verte : piliers */
    pilierBand: { backgroundColor: C.primary, paddingVertical: spacing.xl, paddingHorizontal: spacing.gutter, gap: spacing.xl },
    pilier: { gap: 6 },
    pilierIcon: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    pilierTitle: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
    pilierDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.9)' },

    /* Sections éditoriales */
    eyebrow: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.sm },
    h2: { fontFamily: fonts.extrabold, fontSize: 21, lineHeight: 28, color: C.text, marginBottom: spacing.md },
    para: { ...typography.body, color: C.textSec, lineHeight: 22 },

    /* Étapes */
    timeline: { position: 'relative', gap: spacing.xl, paddingLeft: 4 },
    timelineLine: { position: 'absolute', left: 19, top: 12, bottom: 12, width: 2, backgroundColor: C.border },
    step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    stepDotFirst: { backgroundColor: C.primary, borderColor: C.primary },
    stepDotGreen: { backgroundColor: C.surface, borderColor: C.primary },
    stepNum: { fontFamily: fonts.extrabold, fontSize: 13, color: C.primary },
    stepTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text, marginBottom: 3 },
    stepDesc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.textSec },

    /* Contraste */
    soloCard: { backgroundColor: C.dangerSoft, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xxl, gap: spacing.sm },
    avecCard: { backgroundColor: C.primarySoft, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.md, gap: spacing.sm },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 4 },
    soloBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    avecBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    contrastCardTitle: { fontFamily: fonts.extrabold, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.6 },
    contrastItem: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    contrastText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.text },

    /* FAQ */
    faqCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, padding: spacing.md },
    faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    faqQ: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.text, lineHeight: 19 },
    faqA: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, marginTop: spacing.sm },

    /* Barre collante */
    stickyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.md, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.06, shadowRadius: 32, elevation: 14 },
    stickyLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    stickyValue: { fontFamily: fonts.extrabold, fontSize: 17, color: '#00643C', marginTop: 1 },
    stickyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 14 },
    stickyBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },

    contactCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 16, ...shadows.card, marginBottom: spacing.lg },
    contactCtaText: { ...typography.button, fontSize: 15, color: C.primaryText },

    sectionLabel: { ...typography.overline, color: C.primary, marginBottom: spacing.md, letterSpacing: 1.2 },

    loadingBox: { paddingVertical: 50, alignItems: 'center' },
    emptyBox: { alignItems: 'center', gap: spacing.sm, backgroundColor: C.surfaceAlt, borderRadius: radius.lg, padding: spacing.lg },
    emptyText: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center' },

    card: { backgroundColor: C.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: spacing.md, ...shadows.card },
    cardImgWrap: { height: 160, backgroundColor: C.surfaceAlt, position: 'relative' },
    cardImg: { width: '100%', height: '100%' },
    cardImgFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primarySoft },
    typeBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    typeBadgeText: { ...typography.caption, fontSize: 11, color: C.text, fontWeight: '800' },
    cardBody: { padding: spacing.md },
    cardName: { ...typography.h3, fontSize: 17, color: C.text },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cardMetaText: { flex: 1, ...typography.caption, color: C.textMuted },
    cardPrices: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
    priceLabel: { ...typography.caption, fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    priceValue: { ...typography.button, fontSize: 15, color: C.primary, marginTop: 1 },
    cardCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, paddingVertical: 12, borderRadius: radius.md, backgroundColor: C.primarySoft },
    cardCtaText: { ...typography.button, fontSize: 13, color: C.primary },

    secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
    secure: { ...typography.caption, color: C.textMuted, flexShrink: 1, textAlign: 'center' },

    /* Modal */
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(60,60,60,0.45)' },
    sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: 12, maxHeight: '90%' } as any,
    sheetHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: spacing.md },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    sheetOverline: { ...typography.overline, color: C.primary },
    sheetTitle: { ...typography.h2, color: C.text, marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    row2: { flexDirection: 'row', gap: spacing.sm },
    rowItem: { flex: 1 },
    field: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 14, marginBottom: spacing.sm },
    fieldFocused: { borderColor: C.primary, backgroundColor: C.surface },
    input: { ...typography.body, color: C.text, padding: 0 },
    msgField: { marginTop: spacing.xs },

    miniLabel: { ...typography.overline, color: C.primary, marginTop: spacing.sm, marginBottom: spacing.sm },
    chipsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
    chipActive: { borderColor: C.primary, backgroundColor: C.primarySoft },
    chipText: { ...typography.label, fontSize: 13, color: C.textSec },
    chipTextActive: { color: C.primary },

    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: spacing.sm },
    checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: C.primary },
    checkText: { ...typography.label, color: C.textSec },

    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: C.primary, borderRadius: radius.lg, paddingVertical: 17, marginTop: spacing.md, ...shadows.card },
    submitText: { ...typography.button, fontSize: 16, color: C.primaryText },
    secureCenter: { ...typography.caption, color: C.textMuted, textAlign: 'center', marginTop: spacing.sm },
})
