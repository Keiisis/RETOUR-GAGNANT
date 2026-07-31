'use strict'
import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
    Switch, Pressable, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useAuth } from '../../contexts/AuthContext'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import { supabase } from '../../config/supabase'
import { fetchWithTimeout } from '../../lib/fetch'
import KkiapayModal from '../../components/KkiapayModal'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* ═══════════════════════════════════════════════════════════
   NationaliteFormScreen — THEME "CORPORATE PREMIUM 2026"
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (cohérente avec Register, Legal & Messages)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

// Document slots
const DEFAULT_DOC_SLOTS = [
    { key: 'identite', label: "Pièce d'identité en cours de validité", required: true, multi: false },
    { key: 'domicile', label: "Justificatif de domicile", required: true, multi: false },
    { key: 'profession', label: "Preuve de profession", required: true, multi: false },
    { key: 'afro_descendance', label: "Preuve d'afro descendance (ADN, archives, généalogie…)", required: true, multi: true },
    { key: 'casier', label: "Casier judiciaire", required: true, multi: false },
    { key: 'photo', label: "Photo d'identité récente", required: true, multi: false },
    { key: 'naissance_pere', label: "Extrait de naissance du père", required: false, multi: false, ancestral: true },
    { key: 'naissance_mere', label: "Extrait de naissance de la mère", required: false, multi: false, ancestral: true },
    { key: 'livret_parents', label: "Livret de famille des parents", required: false, multi: false },
    { key: 'agp_paternel', label: "Acte de naissance — AG paternel", required: false, multi: false, ancestral: true },
    { key: 'agm_paternelle', label: "Acte de naissance — AGM paternelle", required: false, multi: false, ancestral: true },
    { key: 'agp_maternel', label: "Acte de naissance — AG maternel", required: false, multi: false, ancestral: true },
    { key: 'agm_maternelle', label: "Acte de naissance — AGM maternelle", required: false, multi: false, ancestral: true },
    { key: 'autres', label: "Autres documents", required: false, multi: true },
]

const STEPS_META = [
    { key: 'law', label: 'Loi', icon: 'shield-checkmark' as const },
    { key: 'heritage', label: 'Racines', icon: 'git-branch' as const },
    { key: 'identity', label: 'Identité', icon: 'person' as const },
    { key: 'link', label: 'Lien', icon: 'people' as const },
    { key: 'proofs', label: 'Preuves', icon: 'document-attach' as const },
    { key: 'recap', label: 'Sceau', icon: 'ribbon' as const },
]

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION
═══════════════════════════════════════════════════════════ */
function AnimatedSection({ children, delay = 0, style }: any) {
    const anim = useSharedValue(0)
    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }))
    }, [delay])
    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 25 * (1 - anim.value) }],
    }))
    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : STEPPER PREMIUM
═══════════════════════════════════════════════════════════ */
function PremiumStepper({ current, total }: { current: number; total: number }) {
    const progress = useSharedValue(0)
    useEffect(() => {
        progress.value = withSpring(current / (total - 1), { damping: 18, stiffness: 90 })
    }, [current])

    const fillStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }))

    return (
        <View style={styles.stepperWrap}>
            <View style={styles.stepperHeader}>
                <View style={styles.stepperBadge}>
                    <Ionicons name={STEPS_META[current].icon} size={11} color={C.accent} />
                    <Text style={styles.stepperBadgeText}>
                        {`CHAPITRE ${current + 1} / ${total}`}
                    </Text>
                </View>
                <Text style={styles.stepperLabel}>{STEPS_META[current].label}</Text>
            </View>

            <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, fillStyle]} />
            </View>

            <View style={styles.stepDotsRow}>
                {STEPS_META.map((s, i) => {
                    const isDone = i < current
                    const isActive = i === current
                    return (
                        <View
                            key={s.key}
                            style={[
                                styles.stepDot,
                                isDone && styles.stepDotDone,
                                isActive && styles.stepDotActive,
                            ]}
                        >
                            {isDone ? (
                                <Ionicons name="checkmark" size={10} color={C.primaryText} />
                            ) : (
                                <Text style={[
                                    styles.stepDotText,
                                    isActive && styles.stepDotTextActive,
                                ]}>{i + 1}</Text>
                            )}
                        </View>
                    )
                })}
            </View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : FIELD (input premium avec focus or)
═══════════════════════════════════════════════════════════ */
function Field({ label, icon, value, onChangeText, placeholder, textArea, required, keyboardType, ...rest }: any) {
    const [focused, setFocused] = useState(false)
    const focusAnim = useSharedValue(0)

    useEffect(() => {
        focusAnim.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 150 })
    }, [focused])

    const rStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.accent]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.02, 0.08]),
    }))

    return (
        <View style={styles.fieldWrap}>
            {label && (
                <Text style={styles.fieldLabel}>
                    {label}
                    {required && <Text style={{ color: C.accent }}> *</Text>}
                </Text>
            )}
            <Animated.View style={[styles.fieldContainer, textArea && styles.fieldContainerTextArea, rStyle]}>
                {icon && !textArea && (
                    <Ionicons
                        name={icon}
                        size={18}
                        color={focused ? C.accent : C.placeholder}
                        style={styles.fieldIcon}
                    />
                )}
                <TextInput
                    style={[styles.fieldInput, textArea && styles.fieldInputTextArea]}
                    placeholder={placeholder}
                    placeholderTextColor={C.placeholder}
                    value={value}
                    onChangeText={onChangeText}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    selectionColor={C.accent}
                    multiline={textArea}
                    keyboardType={keyboardType}
                    {...rest}
                />
            </Animated.View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : SWITCH ROW PREMIUM
═══════════════════════════════════════════════════════════ */
function SwitchRow({ label, value, onValueChange, icon, highlight }: any) {
    return (
        <View style={[styles.switchRow, highlight && styles.switchRowHighlight]}>
            {icon && (
                <View style={styles.switchIconWrap}>
                    <Ionicons name={icon} size={16} color={C.accent} />
                </View>
            )}
            <Text style={[styles.switchLabel, { flex: 1 }]}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: '#E4E4E4', true: C.accent }}
                thumbColor={C.surfaceSolid}
                ios_backgroundColor="#E4E4E4"
            />
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function NationaliteFormScreen({ navigation }: any) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const [currentStep, setCurrentStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [showKkiapay, setShowKkiapay] = useState(false)
    const [savedRef, setSavedRef] = useState<string | null>(null)

    const [lawAccepted, setLawAccepted] = useState(false)
    const [formAmount, setFormAmount] = useState(150000)
    const [formCurrency, setFormCurrency] = useState('XOF')

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
    }, [])

    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))

    /* ── Settings ── */
    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('page_sections')
                .select('content')
                .eq('page', 'nationalite')
                .eq('section_key', 'form_settings')
                .single()
            if (data?.content) {
                const c = data.content as Record<string, unknown>
                if (c.amount) setFormAmount(Number(c.amount))
                if (c.currency) setFormCurrency(String(c.currency))
            }
        }
        fetchSettings()
    }, [])

    /* ── Form data ── */
    const [formData, setFormData] = useState({
        knows_about_law: false,
        is_afro_descendant: true,
        afro_descendant_description: '',
        ancestor1_nom: '', ancestor1_prenom: '', ancestor1_date_naissance: '',
        ancestor1_lien_parente: '', ancestor1_vivant: true, ancestor1_nationalite: '',
        ancestor1_pays_residence: '', ancestor1_autres_infos: '',
        ancestor2_nom: '', ancestor2_prenom: '', ancestor2_date_naissance: '',
        ancestor2_lien_parente: '', ancestor2_vivant: true, ancestor2_nationalite: '',
        ancestor2_pays_residence: '', ancestor2_autres_infos: '',
        nom: profile?.nom || '',
        prenom: profile?.prenom || '',
        genre: '',
        date_naissance: '',
        pays_naissance: '',
        ville_naissance: '',
        nationalite: '',
        pays_residence: profile?.pays || '',
        adresse_residence: '',
        telephone: profile?.phone || '',
        email: profile?.email || '',
        profession: '',
        demande_depuis_benin: false,
        situation_matrimoniale: '',
        nombre_enfants: 0,
        type_document_identite: '',
        numero_document: '',
        date_expiration_document: '',
        pays_delivrance: '',
        lieu_delivrance: '',
        autorite_delivrance: '',
        pere_nom: '', pere_prenom: '', pere_date_naissance: '',
        mere_nom: '', mere_prenom: '', mere_date_naissance: '',
        motivation_lettre: '',
        consentement_rgpd: false,
    })

    const [rawDocs, setRawDocs] = useState<{ key: string; file: any; name: string }[]>([])

    const updateField = (field: keyof typeof formData, value: any) =>
        setFormData(prev => ({ ...prev, [field]: value }))

    const handleFilePick = async (slotKey: string, multi: boolean) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: multi })
            if (!result.canceled && result.assets) {
                const newDocs = result.assets.map(asset => ({ key: slotKey, file: asset, name: asset.name }))
                setRawDocs(prev => {
                    const filtered = multi ? prev : prev.filter(d => d.key !== slotKey)
                    return [...filtered, ...newDocs]
                })
            }
        } catch {
            toast(t('Erreur'), t('Impossible de sélectionner le fichier.'))
        }
    }

    const removeFile = (index: number) => setRawDocs(prev => prev.filter((_, i) => i !== index))

    const validateStep = () => {
        switch (currentStep) {
            case 0:
                if (!lawAccepted) {
                    toast(t('Attention'), t("L'accord de la Loi N° 2024-31 est requis."))
                    return false
                }
                break
            case 1:
                if (!formData.afro_descendant_description.trim() || !formData.ancestor1_nom.trim() || !formData.ancestor1_lien_parente.trim()) {
                    toast(t('Attention'), t('Veuillez décrire votre ascendance et remplir les infos de votre ancêtre.'))
                    return false
                }
                break
            case 2:
                if (!formData.nom.trim() || !formData.prenom.trim() || !formData.email.trim() ||
                    !formData.genre || !formData.date_naissance || !formData.pays_residence.trim() ||
                    !formData.nationalite.trim()) {
                    toast(t('Attention'), t('Champs personnels incomplets.'))
                    return false
                }
                break
            case 3:
                if (!formData.type_document_identite.trim() || !formData.consentement_rgpd) {
                    toast(t('Attention'), t('Type de document et consentement RGPD requis.'))
                    return false
                }
                break
            case 4: {
                const uploadedKeys = rawDocs.map(d => d.key)
                const strictRequired = DEFAULT_DOC_SLOTS.filter(s => s.required)
                for (const slot of strictRequired) {
                    if (!uploadedKeys.includes(slot.key)) {
                        toast(t('Attention'), t('Le document "{label}" est manquant.', { label: slot.label }))
                        return false
                    }
                }
                break
            }
        }
        return true
    }

    const nextStep = () => {
        if (!validateStep()) return
        if (currentStep === 5) setShowKkiapay(true)
        else setCurrentStep(prev => prev + 1)
    }
    const prevStep = () => setCurrentStep(prev => Math.max(0, prev - 1))

    /* ── Soumission après paiement ── */
    const handlePaymentSuccess = async (transactionId: string) => {
        setShowKkiapay(false)
        setLoading(true)

        try {
            // Dépôt en 2 voies : 1) SERVEUR (service role, ≤ 4,4 Mo) — fiable, ne
            // dépend ni des policies RLS ni du réseau direct vers Storage ;
            // 2) repli anon direct (gros fichiers / échec serveur). Le motif
            // d'échec est joint au marqueur (visible côté admin).
            const uploadedUrls: string[] = []
            const folder = `nat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            for (let i = 0; i < rawDocs.length; i++) {
                const doc = rawDocs[i]
                const ext = doc.name.split('.').pop() || 'bin'
                let done = false
                let reason = ''

                // 1) Voie serveur (multipart) — la plus fiable.
                try {
                    const fd = new FormData()
                    // React Native : fichier référencé par son uri.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    fd.append('file', { uri: doc.file.uri, name: doc.name, type: doc.file.mimeType || 'application/octet-stream' } as any)
                    fd.append('key', doc.key)
                    fd.append('ext', ext)
                    const r = await fetch(`${API_BASE}/api/nationality/upload-file`, { method: 'POST', body: fd })
                    const j = await r.json().catch(() => ({}))
                    if (r.ok && j.path) { uploadedUrls.push(`${doc.key}: ${j.path}`); done = true }
                    else reason = j?.error || `serveur ${r.status}`
                } catch (e) {
                    reason = e instanceof Error ? e.message : 'réseau serveur'
                }

                // 2) Repli anon direct (gros fichier ou échec serveur).
                if (!done) {
                    try {
                        const base64 = await FileSystem.readAsStringAsync(doc.file.uri, { encoding: FileSystem.EncodingType.Base64 })
                        const filename = `${folder}/${doc.key}_${i}.${ext}`
                        const { data, error } = await supabase.storage
                            .from('nationality_documents')
                            .upload(filename, decode(base64), { contentType: doc.file.mimeType || 'application/octet-stream', upsert: false })
                        if (data && !error) { uploadedUrls.push(`${doc.key}: ${filename}`); done = true }
                        else if (error) reason = error.message || reason
                    } catch (e) {
                        reason = e instanceof Error ? e.message : reason
                    }
                }

                if (!done) {
                    console.warn('[Nationalité] Upload échoué pour', doc.name, reason)
                    uploadedUrls.push(`${doc.key}: ${doc.name} (upload échoué — ${(reason || 'inconnu').slice(0, 100)})`)
                }
            }

            const cleanedForm: Record<string, unknown> = { ...formData }
            const dateFields = [
                'date_naissance', 'ancestor1_date_naissance', 'ancestor2_date_naissance',
                'pere_date_naissance', 'mere_date_naissance', 'date_expiration_document',
            ]
            dateFields.forEach(key => { if (!cleanedForm[key]) cleanedForm[key] = null })

            const res = await fetchWithTimeout(`${API_BASE}/api/nationality`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 30000,
                body: JSON.stringify({
                    ...cleanedForm,
                    documents: uploadedUrls,
                    documents_uploaded: uploadedUrls,
                    payment_method: 'kkiapay',
                    payment_ref: transactionId,
                    payment_status: 'payé',
                    amount: formAmount,
                    currency: formCurrency,
                    last_step_completed: 6,
                    source: 'mobile',
                }),
            })

            const result = await res.json().catch(() => ({}))
            if (!res.ok || !result.success) throw new Error(result.error || `Erreur serveur (${res.status})`)

            setSavedRef(result.reference || null)
            setCurrentStep(6)
        } catch (e: any) {
            console.error('[Nationalité] Submit failed:', e)
            toast(t('Erreur enregistrement'), t('Le paiement a été reçu (réf : {tx}) mais la soumission du dossier a échoué : {err}. Contactez le support.', {
                    tx: transactionId,
                    err: e?.message || 'inconnue',
                }))
        } finally {
            setLoading(false)
        }
    }

    /* ═══════════════════════════════════════════════════════
       RENDU DES ÉTAPES
    ═══════════════════════════════════════════════════════ */

    const renderStepContent = () => {
        switch (currentStep) {
            /* ─── STEP 0 : LOI ─── */
            case 0:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.heroCard}>
                            <View style={styles.heroIconWrap}>
                                <View style={styles.heroIconGlow} />
                                <Ionicons name="shield-checkmark" size={32} color={C.accent} />
                            </View>
                            <Text style={styles.heroBadge}>{t('CADRE JURIDIQUE OFFICIEL')}</Text>
                            <Text style={styles.heroTitle}>{t('Loi N° 2024-31')}</Text>
                            <Text style={styles.heroSubtitle}>
                                {t('Portant reconnaissance de la nationalité béninoise aux afro-descendants.')}
                            </Text>

                            <View style={styles.quoteBox}>
                                <View style={styles.quoteBar} />
                                <View style={{ flex: 1 }}>
                                    <Ionicons name="library" size={16} color={C.accent} style={{ marginBottom: 8 }} />
                                    <Text style={styles.quoteText}>
                                        {t('"La reconnaissance est un acte de mémoire et de justice pour les descendants des Africains déportés lors de la traite négrière."')}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <AnimatedSection delay={200}>
                            <SwitchRow
                                icon="checkmark-done"
                                label={t("Je reconnais avoir lu et compris l'esprit de cette loi.")}
                                value={lawAccepted}
                                onValueChange={(v: boolean) => { setLawAccepted(v); updateField('knows_about_law', v) }}
                                highlight
                            />
                        </AnimatedSection>
                    </AnimatedSection>
                )

            /* ─── STEP 1 : RACINES ─── */
            case 1:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.stepHeader}>
                            <View style={styles.stepHeaderIcon}>
                                <Ionicons name="git-branch" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 02')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Vos racines')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>{t('Renseignez vos racines et vos ancêtres.')}</Text>

                        <AnimatedSection delay={100}>
                            <Field
                                label={t("Comment êtes-vous afro-descendant(e) ?")}
                                required
                                placeholder={t('Décrivez votre histoire familiale…')}
                                value={formData.afro_descendant_description}
                                onChangeText={(v: string) => updateField('afro_descendant_description', v)}
                                textArea
                            />
                        </AnimatedSection>

                        {[1, 2].map((n, i) => (
                            <AnimatedSection key={n} delay={200 + i * 120}>
                                <View style={styles.subCard}>
                                    <View style={styles.subCardHeader}>
                                        <View style={styles.subCardNumber}>
                                            <Text style={styles.subCardNumberText}>{String(n).padStart(2, '0')}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.subCardTitle}>
                                                {n === 1 ? t('Premier ancêtre') : t('Second ancêtre')}
                                            </Text>
                                            <Text style={styles.subCardTag}>
                                                {n === 1 ? t('REQUIS') : t('OPTIONNEL')}
                                            </Text>
                                        </View>
                                    </View>

                                    <Field icon="person-outline" label={t('Nom')} required={n === 1}
                                        value={(formData as any)[`ancestor${n}_nom`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_nom` as any, v)} />
                                    <Field icon="person-outline" label={t('Prénom')}
                                        value={(formData as any)[`ancestor${n}_prenom`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_prenom` as any, v)} />
                                    <Field icon="calendar-outline" label={t('Date de naissance')} placeholder="JJ/MM/AAAA"
                                        value={(formData as any)[`ancestor${n}_date_naissance`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_date_naissance` as any, v)} />
                                    <Field icon="link-outline" label={t('Lien de parenté')} required={n === 1} placeholder={t('Ex: Grand-père')}
                                        value={(formData as any)[`ancestor${n}_lien_parente`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_lien_parente` as any, v)} />
                                    <Field icon="flag-outline" label={t('Nationalité')}
                                        value={(formData as any)[`ancestor${n}_nationalite`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_nationalite` as any, v)} />
                                    <Field icon="earth-outline" label={t('Pays de résidence')}
                                        value={(formData as any)[`ancestor${n}_pays_residence`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_pays_residence` as any, v)} />
                                    <Field label={t('Autres informations')} textArea
                                        value={(formData as any)[`ancestor${n}_autres_infos`]}
                                        onChangeText={(v: string) => updateField(`ancestor${n}_autres_infos` as any, v)} />

                                    <SwitchRow
                                        icon="heart-outline"
                                        label={t('Toujours vivant(e) ?')}
                                        value={(formData as any)[`ancestor${n}_vivant`]}
                                        onValueChange={(v: boolean) => updateField(`ancestor${n}_vivant` as any, v)}
                                    />
                                </View>
                            </AnimatedSection>
                        ))}
                    </AnimatedSection>
                )

            /* ─── STEP 2 : IDENTITÉ ─── */
            case 2:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.stepHeader}>
                            <View style={styles.stepHeaderIcon}>
                                <Ionicons name="person" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 03')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Votre identité')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>{t('Renseignez vos informations personnelles complètes.')}</Text>

                        <Field icon="person-outline" label={t('Nom')} required value={formData.nom} onChangeText={(v: string) => updateField('nom', v)} />
                        <Field icon="person-outline" label={t('Prénom')} required value={formData.prenom} onChangeText={(v: string) => updateField('prenom', v)} />
                        <Field icon="mail-outline" label={t('Email')} required value={formData.email} onChangeText={(v: string) => updateField('email', v)} keyboardType="email-address" />
                        <Field icon="male-female-outline" label={t('Genre')} required placeholder={t('Masculin, Féminin…')} value={formData.genre} onChangeText={(v: string) => updateField('genre', v)} />
                        <Field icon="calendar-outline" label={t('Date de naissance')} required placeholder="JJ/MM/AAAA" value={formData.date_naissance} onChangeText={(v: string) => updateField('date_naissance', v)} />
                        <Field icon="earth-outline" label={t('Pays de naissance')} value={formData.pays_naissance} onChangeText={(v: string) => updateField('pays_naissance', v)} />
                        <Field icon="location-outline" label={t('Ville de naissance')} value={formData.ville_naissance} onChangeText={(v: string) => updateField('ville_naissance', v)} />
                        <Field icon="flag-outline" label={t('Nationalité actuelle')} required value={formData.nationalite} onChangeText={(v: string) => updateField('nationalite', v)} />
                        <Field icon="home-outline" label={t('Pays de résidence')} required value={formData.pays_residence} onChangeText={(v: string) => updateField('pays_residence', v)} />
                        <Field label={t('Adresse de résidence')} textArea value={formData.adresse_residence} onChangeText={(v: string) => updateField('adresse_residence', v)} />
                        <Field icon="call-outline" label={t('Téléphone')} value={formData.telephone} onChangeText={(v: string) => updateField('telephone', v)} keyboardType="phone-pad" />
                        <Field icon="briefcase-outline" label={t('Profession')} value={formData.profession} onChangeText={(v: string) => updateField('profession', v)} />
                        <Field icon="heart-outline" label={t('Situation matrimoniale')} placeholder={t('Célibataire, Marié(e)…')} value={formData.situation_matrimoniale} onChangeText={(v: string) => updateField('situation_matrimoniale', v)} />
                        <Field icon="people-outline" label={t("Nombre d'enfants")} value={String(formData.nombre_enfants)} onChangeText={(v: string) => updateField('nombre_enfants', parseInt(v, 10) || 0)} keyboardType="phone-pad" />

                        <SwitchRow
                            icon="airplane-outline"
                            label={t('Demande depuis le Bénin ?')}
                            value={formData.demande_depuis_benin}
                            onValueChange={(v: boolean) => updateField('demande_depuis_benin', v)}
                        />
                    </AnimatedSection>
                )

            /* ─── STEP 3 : LIEN ─── */
            case 3:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.stepHeader}>
                            <View style={styles.stepHeaderIcon}>
                                <Ionicons name="people" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 04')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Document & filiation')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>{t("Pièce d'identité et informations sur vos parents.")}</Text>

                        <Field icon="card-outline" label={t("Type de document d'identité")} required placeholder={t('Passeport, CNI…')}
                            value={formData.type_document_identite} onChangeText={(v: string) => updateField('type_document_identite', v)} />
                        <Field icon="barcode-outline" label={t('Numéro du document')} value={formData.numero_document} onChangeText={(v: string) => updateField('numero_document', v)} />
                        <Field icon="calendar-outline" label={t("Date d'expiration")} placeholder="JJ/MM/AAAA" value={formData.date_expiration_document} onChangeText={(v: string) => updateField('date_expiration_document', v)} />
                        <Field icon="earth-outline" label={t('Pays de délivrance')} value={formData.pays_delivrance} onChangeText={(v: string) => updateField('pays_delivrance', v)} />
                        <Field icon="location-outline" label={t('Lieu de délivrance')} value={formData.lieu_delivrance} onChangeText={(v: string) => updateField('lieu_delivrance', v)} />
                        <Field icon="business-outline" label={t('Autorité de délivrance')} value={formData.autorite_delivrance} onChangeText={(v: string) => updateField('autorite_delivrance', v)} />

                        {[
                            { prefix: 'pere', label: t('Le Père'), icon: 'man-outline' as const, num: '01' },
                            { prefix: 'mere', label: t('La Mère'), icon: 'woman-outline' as const, num: '02' },
                        ].map(p => (
                            <View key={p.prefix} style={styles.subCard}>
                                <View style={styles.subCardHeader}>
                                    <View style={styles.subCardNumber}>
                                        <Ionicons name={p.icon} size={14} color={C.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.subCardTitle}>{p.label}</Text>
                                        <Text style={styles.subCardTag}>{t('FILIATION')}</Text>
                                    </View>
                                </View>
                                <Field icon="person-outline" label={t('Nom')} value={(formData as any)[`${p.prefix}_nom`]} onChangeText={(v: string) => updateField(`${p.prefix}_nom` as any, v)} />
                                <Field icon="person-outline" label={t('Prénom')} value={(formData as any)[`${p.prefix}_prenom`]} onChangeText={(v: string) => updateField(`${p.prefix}_prenom` as any, v)} />
                                <Field icon="calendar-outline" label={t('Date de naissance')} placeholder="JJ/MM/AAAA" value={(formData as any)[`${p.prefix}_date_naissance`]} onChangeText={(v: string) => updateField(`${p.prefix}_date_naissance` as any, v)} />
                            </View>
                        ))}

                        <Field
                            label={t('Lettre de motivation')}
                            textArea
                            placeholder={t('Exprimez votre volonté de retrouver vos racines…')}
                            value={formData.motivation_lettre}
                            onChangeText={(v: string) => updateField('motivation_lettre', v)}
                        />

                        <SwitchRow
                            icon="shield-checkmark"
                            label={t('Je consens au traitement RGPD de mes données.')}
                            value={formData.consentement_rgpd}
                            onValueChange={(v: boolean) => updateField('consentement_rgpd', v)}
                            highlight
                        />
                    </AnimatedSection>
                )

            /* ─── STEP 4 : PREUVES ─── */
            case 4:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.stepHeader}>
                            <View style={styles.stepHeaderIcon}>
                                <Ionicons name="document-attach" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 05')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Pièces justificatives')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>{t('Téléversez vos documents pour finaliser votre dossier.')}</Text>

                        {/* Compteur global */}
                        <View style={styles.docCounter}>
                            <View style={styles.docCounterIcon}>
                                <Ionicons name="cloud-upload-outline" size={18} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.docCounterLabel}>{t('DOCUMENTS TÉLÉVERSÉS')}</Text>
                                <Text style={styles.docCounterValue}>
                                    {t('{n} fichier(s) joint(s)', { n: rawDocs.length })}
                                </Text>
                            </View>
                            <View style={styles.docCounterBadge}>
                                <Text style={styles.docCounterBadgeText}>{rawDocs.length}</Text>
                            </View>
                        </View>

                        {DEFAULT_DOC_SLOTS.map((slot, index) => {
                            const uploadedFiles = rawDocs.filter(d => d.key === slot.key)
                            const hasFiles = uploadedFiles.length > 0
                            return (
                                <AnimatedSection key={slot.key} delay={50 + index * 30}>
                                    <View style={[styles.docSlot, hasFiles && styles.docSlotActive]}>
                                        <View style={styles.docSlotHeader}>
                                            <View style={[styles.docSlotIcon, hasFiles && styles.docSlotIconActive]}>
                                                <Ionicons
                                                    name={hasFiles ? 'checkmark-circle' : 'document-outline'}
                                                    size={18}
                                                    color={hasFiles ? C.success : C.textSec}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.docSlotTitle}>
                                                    {t(slot.label)}
                                                    {slot.required && <Text style={{ color: C.accent }}> *</Text>}
                                                </Text>
                                                <View style={styles.docSlotTags}>
                                                    {slot.ancestral && (
                                                        <View style={[styles.miniTag, { backgroundColor: 'rgba(252, 209, 22, 0.12)', borderColor: C.border }]}>
                                                            <Text style={[styles.miniTagText, { color: C.accentDark }]}>{t('ANCESTRAL')}</Text>
                                                        </View>
                                                    )}
                                                    {slot.multi && (
                                                        <View style={[styles.miniTag, { backgroundColor: 'rgba(0, 135, 81, 0.06)', borderColor: 'rgba(0, 135, 81, 0.15)' }]}>
                                                            <Text style={[styles.miniTagText, { color: C.primary }]}>{t('MULTIPLE')}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.uploadBtn, hasFiles && styles.uploadBtnSecondary]}
                                                onPress={() => handleFilePick(slot.key, slot.multi)}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                hitSlop={6}
                                            >
                                                <Ionicons
                                                    name={hasFiles ? 'add' : 'cloud-upload-outline'}
                                                    size={14}
                                                    color={hasFiles ? C.primary : C.primaryText}
                                                />
                                                <Text style={[styles.uploadBtnText, hasFiles && styles.uploadBtnTextSecondary]}>
                                                    {hasFiles ? t('Ajouter') : t('Téléverser')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {hasFiles && (
                                            <View style={styles.uploadedList}>
                                                {uploadedFiles.map((f, idx) => {
                                                    const globalIndex = rawDocs.findIndex(d => d === f)
                                                    return (
                                                        <View key={idx} style={styles.uploadedItem}>
                                                            <View style={styles.uploadedItemIcon}>
                                                                <Ionicons name="document-text" size={14} color={C.accent} />
                                                            </View>
                                                            <Text style={styles.uploadedItemName} numberOfLines={1}>{f.name}</Text>
                                                            <TouchableOpacity onPress={() => removeFile(globalIndex)} hitSlop={10}
                                                                accessibilityRole="button"
                                                                accessibilityLabel={t('Effacer')}>
                                                                <Ionicons name="close-circle" size={18} color={C.error} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    )
                                                })}
                                            </View>
                                        )}
                                    </View>
                                </AnimatedSection>
                            )
                        })}
                    </AnimatedSection>
                )

            /* ─── STEP 5 : RÉCAPITULATIF ─── */
            case 5:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.stepHeader}>
                            <View style={styles.stepHeaderIcon}>
                                <Ionicons name="ribbon" size={20} color={C.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 06')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Récapitulatif final')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>
                            {t('Vérifiez vos informations avant de procéder au paiement sécurisé.')}
                        </Text>

                        {/* Section : Demandeur */}
                        <View style={styles.recapCard}>
                            <View style={styles.recapHeader}>
                                <Ionicons name="person-circle" size={16} color={C.accent} />
                                <Text style={styles.recapHeaderText}>{t('LE DEMANDEUR')}</Text>
                            </View>
                            <InfoRow label={t('Nom complet')} value={`${formData.prenom} ${formData.nom}`} />
                            <InfoRow label={t('Email')} value={formData.email} />
                            <InfoRow label={t('Nationalité')} value={formData.nationalite} />
                            <InfoRow label={t('Pays')} value={formData.pays_residence} last />
                        </View>

                        {/* Section : Racines */}
                        <View style={styles.recapCard}>
                            <View style={styles.recapHeader}>
                                <Ionicons name="git-branch" size={16} color={C.accent} />
                                <Text style={styles.recapHeaderText}>{t('LES RACINES')}</Text>
                            </View>
                            <InfoRow label={t('1er Ancêtre')} value={`${formData.ancestor1_prenom} ${formData.ancestor1_nom}`.trim()} />
                            <InfoRow label={t('Lien')} value={formData.ancestor1_lien_parente} last={!formData.ancestor2_nom} />
                            {formData.ancestor2_nom ? (
                                <InfoRow label={t('2ème Ancêtre')} value={`${formData.ancestor2_prenom} ${formData.ancestor2_nom}`.trim()} last />
                            ) : null}
                        </View>

                        {/* Section : Preuves */}
                        <View style={styles.recapCard}>
                            <View style={styles.recapHeader}>
                                <Ionicons name="document-attach" size={16} color={C.accent} />
                                <Text style={styles.recapHeaderText}>{t('LES PREUVES')}</Text>
                            </View>
                            <InfoRow label={t('Documents')} value={t('{n} pièce(s) jointe(s)', { n: rawDocs.length })} last />
                        </View>

                        {/* Carte paiement premium */}
                        <View style={styles.paymentCard}>
                            <View style={styles.paymentGlow} />
                            <View style={styles.paymentBadge}>
                                <Ionicons name="lock-closed" size={11} color={C.accent} />
                                <Text style={styles.paymentBadgeText}>{t('PAIEMENT SÉCURISÉ')}</Text>
                            </View>
                            <Text style={styles.paymentLabel}>{t('Frais de dossier')}</Text>
                            <Text style={styles.paymentAmount}>
                                {formAmount.toLocaleString('fr-FR')} <Text style={styles.paymentCurrency}>{formCurrency}</Text>
                            </Text>
                            <View style={styles.paymentDivider} />
                            <View style={styles.paymentFeatures}>
                                <View style={styles.paymentFeature}>
                                    <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                                    <Text style={styles.paymentFeatureText}>{t('Suivi en temps réel')}</Text>
                                </View>
                                <View style={styles.paymentFeature}>
                                    <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                                    <Text style={styles.paymentFeatureText}>{t('Email de confirmation')}</Text>
                                </View>
                                <View style={styles.paymentFeature}>
                                    <Ionicons name="checkmark-circle" size={13} color={C.accent} />
                                    <Text style={styles.paymentFeatureText}>{t('Accompagnement dédié')}</Text>
                                </View>
                            </View>
                        </View>
                    </AnimatedSection>
                )

            /* ─── STEP 6 : SUCCÈS ─── */
            case 6:
                return (
                    <AnimatedSection delay={0}>
                        <View style={styles.successCard}>
                            <View style={styles.successSeal}>
                                <View style={styles.successSealGlow} />
                                <View style={styles.successSealInner}>
                                    <Ionicons name="checkmark" size={42} color={C.primaryText} />
                                </View>
                                <View style={styles.successSealBadge}>
                                    <Ionicons name="ribbon" size={12} color={C.accent} />
                                </View>
                            </View>

                            <Text style={styles.successBadge}>{t('DOSSIER OFFICIEL')}</Text>
                            <Text style={styles.successTitle}>{t('Dossier scellé')}</Text>
                            <Text style={styles.successSubtitle}>
                                {t('Votre requête a été transmise à nos agents et est désormais dans nos archives pour étude. Un email de confirmation vous a été envoyé.')}
                            </Text>

                            {savedRef && (
                                <View style={styles.refBox}>
                                    <View style={styles.refLabel}>
                                        <Ionicons name="finger-print" size={12} color={C.accent} />
                                        <Text style={styles.refLabelText}>{t('RÉFÉRENCE OFFICIELLE')}</Text>
                                    </View>
                                    <Text style={styles.refValue}>{savedRef}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={styles.successBtn}
                                onPress={() => navigation.navigate('Main')}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                <Text style={styles.successBtnText}>{t("Retourner à l'accueil")}</Text>
                                <Ionicons name="arrow-forward" size={18} color={C.accent} style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>
                    </AnimatedSection>
                )

            default:
                return null
        }
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

            {/* NAV BAR */}
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.navBar}>
                <Pressable
                    onPress={() => (currentStep > 0 && currentStep < 6 ? prevStep() : navigation.goBack())}
                    style={styles.navBack}
                    accessibilityRole="button"
                    hitSlop={6}
                    accessibilityLabel={t('Retour')}
                >
                    <View style={styles.iconContainer}>
                        <Ionicons name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <Ionicons name="shield-checkmark" size={12} color={C.accent} />
                    <Text style={styles.navCounterText}>{t('Nationalité VIP')}</Text>
                </View>
            </View>

            {/* HEADER + STEPPER */}
            {currentStep < 6 && (
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.title}>{t('Demande de nationalité')}</Text>
                    <PremiumStepper current={currentStep} total={6} />
                </Animated.View>
            )}

            <ScrollView
                /* Réserve pour le pied d'action, qui recouvre le contenu. */
                contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {renderStepContent()}
            </ScrollView>

            {/* FOOTER ACTIONS
                Marge basse issue de `insets` : sous Android 15+ l'application
                dessine sous la barre système, et une constante laissait le
                bouton « Continuer » dessous, donc inatteignable. */}
            {currentStep < 6 && (
                <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
                    <TouchableOpacity
                        style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                        onPress={nextStep}
                        disabled={loading}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        {loading ? (
                            <ActivityIndicator color={C.primaryText} size="small" />
                        ) : (
                            <>
                                <Text style={styles.primaryBtnText}>
                                    {currentStep === 5
                                        ? t('Payer {amount} {currency}', { amount: formAmount.toLocaleString('fr-FR'), currency: formCurrency })
                                        : t('Poursuivre')}
                                </Text>
                                <Ionicons
                                    name={currentStep === 5 ? 'lock-closed' : 'arrow-forward'}
                                    size={18}
                                    color={C.accent}
                                    style={{ marginLeft: 10 }}
                                />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <KkiapayModal
                visible={showKkiapay}
                amount={String(formAmount)}
                serviceName="Nationalité VIP"
                onClose={() => setShowKkiapay(false)}
                onSuccess={handlePaymentSuccess}
            />
        </KeyboardAvoidingView>
    )
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : INFO ROW (récap)
═══════════════════════════════════════════════════════════ */
function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return (
        <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
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

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: { width: 44, height: 44, justifyContent: 'center' },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: C.border,
    },
    navCounterText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.accentDark,
        letterSpacing: 0.3,
    },

    /* ── Header ── */
    headerContainer: {
        paddingHorizontal: 24,
        marginTop: 8,
        marginBottom: 12,
    },
    title: { ...typography.h1, color: C.text },

    /* ── Stepper ── */
    stepperWrap: {
        marginTop: 22,
    },
    stepperHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    stepperBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    stepperBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.2,
    },
    stepperLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
    },
    progressTrack: {
        height: 5,
        backgroundColor: C.border,
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressFill: {
        height: '100%',
        backgroundColor: C.accent,
        borderRadius: 3,
    },
    stepDotsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    stepDot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: C.surface,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepDotDone: {
        backgroundColor: C.success,
        borderColor: C.success,
    },
    stepDotActive: {
        backgroundColor: C.primary,
        borderColor: C.accent,
        borderWidth: 2,
        transform: [{ scale: 1.1 }],
    },
    stepDotText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.textSec,
    },
    stepDotTextActive: {
        color: C.accent,
    },

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },

    /* ── Step Header (in cards) ── */
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 6,
        paddingHorizontal: 4,
    },
    stepHeaderIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    stepHeaderBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    stepHeaderTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.3,
    },
    stepIntro: {
        fontSize: 13,
        color: C.textSec,
        fontWeight: '400',
        lineHeight: 19,
        marginBottom: 18,
        paddingHorizontal: 4,
        fontStyle: 'italic',
    },

    /* ── Hero Card (step 0) ── */
    heroCard: {
        backgroundColor: C.surface,
        borderRadius: 22,
        padding: 24,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 16,
        alignItems: 'center',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    heroIconWrap: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: C.surfaceSolid,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: C.border,
        marginBottom: 18,
        position: 'relative',
    },
    heroIconGlow: { display: 'none' },
    heroBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 13.5,
        color: C.textSec,
        fontWeight: '400',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 22,
    },
    quoteBox: {
        flexDirection: 'row',
        backgroundColor: C.bg,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        width: '100%',
    },
    quoteBar: {
        width: 3,
        backgroundColor: C.accent,
        borderRadius: 2,
        marginRight: 14,
    },
    quoteText: {
        fontSize: 13,
        color: C.primary,
        lineHeight: 20,
        fontStyle: 'italic',
        fontWeight: '500',
    },

    /* ── Field ── */
    fieldWrap: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: C.textSec,
        letterSpacing: 0.4,
        marginBottom: 6,
        marginLeft: 4,
        textTransform: 'uppercase',
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1.2,
        borderRadius: 14,
        paddingHorizontal: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 1,
    },
    fieldContainerTextArea: {
        height: 110,
        alignItems: 'flex-start',
        paddingTop: 14,
    },
    fieldIcon: {
        marginRight: 10,
    },
    fieldInput: {
        flex: 1,
        color: C.primary,
        fontSize: 14.5,
        fontWeight: '500',
        paddingVertical: 0,
    },
    fieldInputTextArea: {
        textAlignVertical: 'top',
        height: '100%',
    },

    /* ── Switch Row ── */
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 14,
    },
    switchRowHighlight: {
        borderColor: C.border,
        backgroundColor: 'rgba(252, 209, 22, 0.04)',
    },
    switchIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    switchLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: C.primary,
        lineHeight: 18,
    },

    /* ── Sub Card (ancêtres / parents) ── */
    subCard: {
        backgroundColor: C.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 16,
        marginTop: 4,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    subCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    subCardNumber: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: C.accent,
    },
    subCardNumberText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 0.3,
    },
    subCardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.2,
        marginBottom: 2,
    },
    subCardTag: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.2,
    },

    /* ── Doc Counter ── */
    docCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.primary,
        borderRadius: 16,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 4,
    },
    docCounterIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(252, 209, 22, 0.20)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    docCounterLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentLight,
        letterSpacing: 1.2,
        marginBottom: 2,
    },
    docCounterValue: {
        fontSize: 13,
        fontWeight: '700',
        color: C.primaryText,
    },
    docCounterBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    docCounterBadgeText: {
        fontSize: 13,
        fontWeight: '800',
        color: C.primary,
    },

    /* ── Doc Slot ── */
    docSlot: {
        backgroundColor: C.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 10,
    },
    docSlotActive: {
        borderColor: C.border,
        backgroundColor: 'rgba(0, 135, 81, 0.03)',
    },
    docSlotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    docSlotIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 135, 81, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.08)',
    },
    docSlotIconActive: {
        backgroundColor: 'rgba(0, 135, 81, 0.10)',
        borderColor: C.border,
    },
    docSlotTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: C.primary,
        lineHeight: 17,
        marginBottom: 4,
    },
    docSlotTags: {
        flexDirection: 'row',
        gap: 4,
        flexWrap: 'wrap',
    },
    miniTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    miniTagText: {
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    /* ── Upload Button ── */
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadBtnSecondary: {
        backgroundColor: C.surfaceSolid,
        borderColor: C.border,
    },
    uploadBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: 0.3,
    },
    uploadBtnTextSecondary: {
        color: C.primary,
    },

    /* ── Uploaded Files ── */
    uploadedList: {
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    uploadedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: C.surfaceSolid,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadedItemIcon: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: 'rgba(252, 209, 22, 0.10)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadedItemName: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: C.primary,
    },

    /* ── Recap Card ── */
    recapCard: {
        backgroundColor: C.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: 14,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    recapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    recapHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 12,
    },
    infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.6)',
    },
    infoLabel: {
        fontSize: 12,
        color: C.textSec,
        fontWeight: '500',
        flex: 1,
    },
    infoValue: {
        fontSize: 12.5,
        color: C.primary,
        fontWeight: '700',
        flex: 1.2,
        textAlign: 'right',
    },

    /* ── Payment Card ── */
    paymentCard: {
        backgroundColor: C.primary,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1.5,
        borderColor: C.border,
        marginTop: 6,
        marginBottom: 10,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    paymentGlow: { display: 'none' },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(252, 209, 22, 0.18)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 14,
    },
    paymentBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.2,
    },
    paymentLabel: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '500',
        marginBottom: 4,
    },
    paymentAmount: {
        fontSize: 38,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: -1,
    },
    paymentCurrency: {
        fontSize: 18,
        color: C.accent,
        fontWeight: '700',
    },
    paymentDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 16,
    },
    paymentFeatures: {
        gap: 8,
    },
    paymentFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    paymentFeatureText: {
        fontSize: 12.5,
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
    },

    /* ── Footer ── */
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: C.surfaceSolid,
        paddingHorizontal: 20,
        paddingTop: 14,
        // paddingBottom fourni au montage depuis insets.bottom : voir l'usage.
        borderTopWidth: 1,
        borderTopColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 8,
    },
    primaryBtn: {
        height: 58,
        backgroundColor: C.primary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    primaryBtnDisabled: {
        backgroundColor: '#E4E4E4',
        shadowOpacity: 0,
        elevation: 0,
        borderColor: 'transparent',
    },
    primaryBtnText: {
        color: C.primaryText,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },

    /* ── Success Card ── */
    successCard: {
        backgroundColor: C.surface,
        borderRadius: 24,
        padding: 28,
        borderWidth: 1.2,
        borderColor: C.border,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    successSeal: {
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: 20,
    },
    successSealGlow: { display: 'none' },
    successSealInner: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: C.success,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: C.accent,
        shadowColor: C.success,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    successSealBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.accent,
    },
    successBadge: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accentDark,
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: C.primary,
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: 12,
    },
    successSubtitle: {
        fontSize: 13.5,
        color: C.textSec,
        fontWeight: '400',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 22,
    },
    refBox: {
        width: '100%',
        backgroundColor: C.primary,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1.5,
        borderColor: C.border,
        alignItems: 'center',
        marginBottom: 24,
    },
    refLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    refLabelText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.accent,
        letterSpacing: 1.5,
    },
    refValue: {
        fontSize: 22,
        fontWeight: '800',
        color: C.primaryText,
        letterSpacing: 2,
    },
    successBtn: {
        width: '100%',
        height: 56,
        backgroundColor: C.primary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.2,
        borderColor: C.border,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 6,
    },
    successBtnText: {
        color: C.primaryText,
        fontSize: 14.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
})