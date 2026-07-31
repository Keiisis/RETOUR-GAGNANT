'use strict'
import React, { useState, useEffect } from 'react'
import { toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    TextInput, ActivityIndicator, Platform, KeyboardAvoidingView,
    Switch, Pressable, Dimensions, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
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
import { screenColors, typography, spacing, radius, shadows, fonts } from '../../config/theme'

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

    /* Une seule barre, fine, à la façon de celle du dossier sur l'accueil.
       Les six pastilles numérotées ont été retirées : elles répétaient le
       « chapitre n sur 6 » du sur-titre sans rien apporter, puisqu'on ne peut
       pas sauter d'étape. Trois indicateurs pour une même information, c'est
       ce qui donnait au formulaire son air chargé. */
    return (
        <View style={styles.stepperWrap}>
            <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, fillStyle]} />
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
        borderColor: interpolateColor(focusAnim.value, [0, 1], [C.border, C.primary]),
        backgroundColor: focused ? C.surfaceSolid : C.surface,
        shadowOpacity: interpolate(focusAnim.value, [0, 1], [0.02, 0.08]),
    }))

    return (
        <View style={styles.fieldWrap}>
            {label && (
                <Text style={styles.fieldLabel}>
                    {label}
                    {required && <Text style={{ color: C.primary }}> *</Text>}
                </Text>
            )}
            <Animated.View style={[styles.fieldContainer, textArea && styles.fieldContainerTextArea, rStyle]}>
                {icon && !textArea && (
                    <LucideIcon
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
                    selectionColor={C.primary}
                    multiline={textArea}
                    keyboardType={keyboardType}
                    {...rest}
                />
            </Animated.View>
        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   LISTES D'OPTIONS — IDENTIQUES À CELLES DU SITE

   Le formulaire web contraint huit champs à une liste ; le mobile n'offrait
   qu'une saisie libre avec un exemple en gris. Deux consequences reelles :
   le client pouvait ecrire « masculin », « M » ou « homme » la ou le site
   n'accepte que « Masculin », et l'agent recevait des valeurs qu'aucun
   filtre du panel ne reconnait.

   Les listes sont recopiees a l'identique depuis
   frontend/app/(routes)/nationalite/formulaire/page.tsx. Toute evolution
   doit se faire DES DEUX COTES.
═══════════════════════════════════════════════════════════ */
const PAYS = ['Bénin', 'France', 'États-Unis', 'Brésil', 'Haïti', 'Canada', 'Royaume-Uni',
    'Jamaïque', 'Trinidad et Tobago', 'Colombie', 'Cuba', 'Guadeloupe', 'Martinique',
    'Guyane française', 'Suriname', 'Barbade', 'Bahamas', 'République Dominicaine',
    'Porto Rico', 'Antigua-et-Barbuda', 'Allemagne', 'Belgique', 'Suisse', 'Pays-Bas',
    'Italie', 'Espagne', 'Portugal', 'Ghana', 'Togo', 'Nigeria', 'Sénégal', "Côte d'Ivoire",
    'Cameroun', 'Congo', 'Gabon', 'Mali', 'Burkina Faso', 'Guinée', 'Niger', 'Tchad', 'Autre']

const PROFESSIONS = ['Salarié(e)', 'Entrepreneur/Commerçant', 'Profession libérale',
    'Étudiant(e)', 'Fonctionnaire', 'Retraité(e)', 'Artisan', 'Agriculteur', 'Artiste',
    'Ingénieur', 'Médecin', 'Avocat', 'Enseignant', 'Sans emploi', 'Autre']

const GENRES = ['Masculin', 'Féminin', 'Non-binaire', 'Préfère ne pas préciser']

const LIENS = ['Père', 'Mère', 'Grand-père paternel', 'Grand-mère paternelle',
    'Grand-père maternel', 'Grand-mère maternelle', 'Arrière-grand-père',
    'Arrière-grand-mère', 'Autre']

/* Ces deux listes stockent un CODE en base, pas le libellé affiché — c'est
   ce que fait le site, et le panel agent filtre sur ce code. */
const SITUATIONS: Array<{ code: string; label: string }> = [
    { code: 'celibataire', label: 'Célibataire' },
    { code: 'marie', label: 'Marié(e)' },
    { code: 'divorce', label: 'Divorcé(e)' },
    { code: 'veuf', label: 'Veuf/Veuve' },
    { code: 'union_libre', label: 'Union libre' },
]

const TYPES_DOCUMENT: Array<{ code: string; label: string }> = [
    { code: 'passeport', label: 'Passeport' },
    { code: 'cni', label: 'CNI' },
    { code: 'carte_electeur', label: "Carte d'électeur" },
    { code: 'autre', label: 'Autre' },
]

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : CHAMP À OPTIONS

   Même anatomie que `Field` — libellé, icône, cadre — pour que les deux se
   suivent sans rupture dans le formulaire. Le choix s'ouvre dans une feuille
   par le bas, plus confortable au pouce qu'une liste déroulante native.
═══════════════════════════════════════════════════════════ */
function SelectField({
    label, icon, value, onSelect, options, required, placeholder,
}: {
    label: string
    icon?: string
    value: string
    onSelect: (v: string) => void
    /** Chaîne simple, ou couple code/libellé quand la base stocke un code. */
    options: Array<string | { code: string; label: string }>
    required?: boolean
    placeholder?: string
}) {
    const { t } = useLang()
    const [ouvert, setOuvert] = useState(false)
    const insets = useSafeAreaInsets()

    const normalisees = options.map(o => typeof o === 'string' ? { code: o, label: o } : o)
    const choisi = normalisees.find(o => o.code === value)

    return (
        <View style={styles.fieldWrap}>
            {label && (
                <Text style={styles.fieldLabel}>
                    {label}
                    {required && <Text style={{ color: C.primary }}> *</Text>}
                </Text>
            )}

            <Pressable
                onPress={() => setOuvert(true)}
                accessibilityRole="button"
                accessibilityLabel={`${label} : ${choisi ? t(choisi.label) : t('choisir')}`}
                style={styles.fieldContainer}
            >
                {icon && (
                    <LucideIcon name={icon} size={18} color={C.placeholder} style={styles.fieldIcon} />
                )}
                <Text
                    style={[styles.fieldInput, !choisi && { color: C.placeholder }]}
                    numberOfLines={1}
                >
                    {choisi ? t(choisi.label) : (placeholder || t('Choisir'))}
                </Text>
                <LucideIcon name="chevron-down" size={18} color={C.textMuted} />
            </Pressable>

            <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
                <Pressable style={styles.selectOverlay} onPress={() => setOuvert(false)}>
                    <Pressable
                        style={[styles.selectSheet, { paddingBottom: insets.bottom + spacing.md }]}
                        onPress={e => e.stopPropagation()}
                    >
                        <View style={styles.selectHandle} />
                        <Text style={styles.selectTitle}>{label}</Text>

                        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                            {normalisees.map(o => {
                                const actif = o.code === value
                                return (
                                    <Pressable
                                        key={o.code}
                                        onPress={() => { onSelect(o.code); setOuvert(false) }}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: actif }}
                                        style={[styles.selectOption, actif && styles.selectOptionActive]}
                                    >
                                        <Text style={[styles.selectOptionText, actif && styles.selectOptionTextActive]}>
                                            {t(o.label)}
                                        </Text>
                                        {actif && <LucideIcon name="checkmark" size={18} color={C.primary} />}
                                    </Pressable>
                                )
                            })}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
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
                    <LucideIcon name={icon} size={16} color={C.primary} />
                </View>
            )}
            <Text style={[styles.switchLabel, { flex: 1 }]}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: C.borderStrong, true: C.primary }}
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
                                <LucideIcon name="shield-checkmark" size={32} color={C.primary} />
                            </View>
                            <Text style={styles.heroBadge}>{t('CADRE JURIDIQUE OFFICIEL')}</Text>
                            <Text style={styles.heroTitle}>{t('Loi N° 2024-31')}</Text>
                            <Text style={styles.heroSubtitle}>
                                {t('Portant reconnaissance de la nationalité béninoise aux afro-descendants.')}
                            </Text>

                            <View style={styles.quoteBox}>
                                <View style={styles.quoteBar} />
                                <View style={{ flex: 1 }}>
                                    <LucideIcon name="library" size={16} color={C.primary} style={{ marginBottom: 8 }} />
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
                                <LucideIcon name="git-branch" size={20} color={C.primary} />
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
                                    <SelectField icon="git-branch" label={t('Lien de parenté')} options={LIENS} value={(formData as any)[`ancestor${n}_lien_parente`] || ''} onSelect={(v: string) => updateField(`ancestor${n}_lien_parente` as any, v)} />
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
                                <LucideIcon name="person" size={20} color={C.primary} />
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
                        <SelectField icon="male-female-outline" label={t('Genre')} required options={GENRES} value={formData.genre} onSelect={(v: string) => updateField('genre', v)} />
                        <Field icon="calendar-outline" label={t('Date de naissance')} required placeholder="JJ/MM/AAAA" value={formData.date_naissance} onChangeText={(v: string) => updateField('date_naissance', v)} />
                        <SelectField icon="earth-outline" label={t('Pays de naissance')} options={PAYS} value={formData.pays_naissance} onSelect={(v: string) => updateField('pays_naissance', v)} />
                        <Field icon="location-outline" label={t('Ville de naissance')} value={formData.ville_naissance} onChangeText={(v: string) => updateField('ville_naissance', v)} />
                        <SelectField icon="flag-outline" label={t('Nationalité actuelle')} required options={PAYS} value={formData.nationalite} onSelect={(v: string) => updateField('nationalite', v)} />
                        <SelectField icon="earth-outline" label={t('Pays de résidence')} required options={PAYS} value={formData.pays_residence} onSelect={(v: string) => updateField('pays_residence', v)} />
                        <Field label={t('Adresse de résidence')} textArea value={formData.adresse_residence} onChangeText={(v: string) => updateField('adresse_residence', v)} />
                        <Field icon="call-outline" label={t('Téléphone')} value={formData.telephone} onChangeText={(v: string) => updateField('telephone', v)} keyboardType="phone-pad" />
                        <SelectField icon="briefcase-outline" label={t('Profession')} options={PROFESSIONS} value={formData.profession} onSelect={(v: string) => updateField('profession', v)} />
                        <SelectField icon="heart-outline" label={t('Situation matrimoniale')} options={SITUATIONS} value={formData.situation_matrimoniale} onSelect={(v: string) => updateField('situation_matrimoniale', v)} />
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
                                <LucideIcon name="people" size={20} color={C.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.stepHeaderBadge}>{t('CHAPITRE 04')}</Text>
                                <Text style={styles.stepHeaderTitle}>{t('Document & filiation')}</Text>
                            </View>
                        </View>
                        <Text style={styles.stepIntro}>{t("Pièce d'identité et informations sur vos parents.")}</Text>

                        <SelectField icon="card-outline" label={''} required options={TYPES_DOCUMENT} value={formData.type_document_identite} onSelect={(v: string) => updateField('type_document_identite', v)} />
                        <Field icon="barcode-outline" label={t('Numéro du document')} value={formData.numero_document} onChangeText={(v: string) => updateField('numero_document', v)} />
                        <Field icon="calendar-outline" label={t("Date d'expiration")} placeholder="JJ/MM/AAAA" value={formData.date_expiration_document} onChangeText={(v: string) => updateField('date_expiration_document', v)} />
                        <SelectField icon="earth-outline" label={t('Pays de délivrance')} options={PAYS} value={formData.pays_delivrance} onSelect={(v: string) => updateField('pays_delivrance', v)} />
                        <Field icon="location-outline" label={t('Lieu de délivrance')} value={formData.lieu_delivrance} onChangeText={(v: string) => updateField('lieu_delivrance', v)} />
                        <Field icon="business-outline" label={t('Autorité de délivrance')} value={formData.autorite_delivrance} onChangeText={(v: string) => updateField('autorite_delivrance', v)} />

                        {[
                            { prefix: 'pere', label: t('Le Père'), icon: 'man-outline' as const, num: '01' },
                            { prefix: 'mere', label: t('La Mère'), icon: 'woman-outline' as const, num: '02' },
                        ].map(p => (
                            <View key={p.prefix} style={styles.subCard}>
                                <View style={styles.subCardHeader}>
                                    <View style={styles.subCardNumber}>
                                        <LucideIcon name={p.icon} size={14} color={C.primaryText} />
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
                                <LucideIcon name="document-attach" size={20} color={C.primary} />
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
                                <LucideIcon name="cloud-upload-outline" size={18} color={C.primaryText} />
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
                                                <LucideIcon
                                                    name={hasFiles ? 'checkmark-circle' : 'document-outline'}
                                                    size={18}
                                                    color={hasFiles ? C.success : C.textSec}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.docSlotTitle}>
                                                    {t(slot.label)}
                                                    {slot.required && <Text style={{ color: C.primary }}> *</Text>}
                                                </Text>
                                                <View style={styles.docSlotTags}>
                                                    {slot.ancestral && (
                                                        <View style={[styles.miniTag, { backgroundColor: C.accentSoft, borderColor: C.border }]}>
                                                            <Text style={[styles.miniTagText, { color: C.primary }]}>{t('ANCESTRAL')}</Text>
                                                        </View>
                                                    )}
                                                    {slot.multi && (
                                                        <View style={[styles.miniTag, { backgroundColor: C.surfaceSoft, borderColor: C.border }]}>
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
                                                <LucideIcon
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
                                                                <LucideIcon name="document-text" size={14} color={C.primary} />
                                                            </View>
                                                            <Text style={styles.uploadedItemName} numberOfLines={1}>{f.name}</Text>
                                                            <TouchableOpacity onPress={() => removeFile(globalIndex)} hitSlop={10}
                                                                accessibilityRole="button"
                                                                accessibilityLabel={t('Effacer')}>
                                                                <LucideIcon name="close-circle" size={18} color={C.error} />
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
                                <LucideIcon name="ribbon" size={20} color={C.primary} />
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
                                <LucideIcon name="person-circle" size={16} color={C.primary} />
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
                                <LucideIcon name="git-branch" size={16} color={C.primary} />
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
                                <LucideIcon name="document-attach" size={16} color={C.primary} />
                                <Text style={styles.recapHeaderText}>{t('LES PREUVES')}</Text>
                            </View>
                            <InfoRow label={t('Documents')} value={t('{n} pièce(s) jointe(s)', { n: rawDocs.length })} last />
                        </View>

                        {/* Carte paiement premium */}
                        <View style={styles.paymentCard}>
                            <View style={styles.paymentGlow} />
                            <View style={styles.paymentBadge}>
                                <LucideIcon name="lock-closed" size={11} color={C.primaryText} />
                                <Text style={styles.paymentBadgeText}>{t('PAIEMENT SÉCURISÉ')}</Text>
                            </View>
                            <Text style={styles.paymentLabel}>{t('Frais de dossier')}</Text>
                            <Text style={styles.paymentAmount}>
                                {formAmount.toLocaleString('fr-FR')} <Text style={styles.paymentCurrency}>{formCurrency}</Text>
                            </Text>
                            <View style={styles.paymentDivider} />
                            <View style={styles.paymentFeatures}>
                                <View style={styles.paymentFeature}>
                                    <LucideIcon name="checkmark-circle" size={13} color={C.primary} />
                                    <Text style={styles.paymentFeatureText}>{t('Suivi en temps réel')}</Text>
                                </View>
                                <View style={styles.paymentFeature}>
                                    <LucideIcon name="checkmark-circle" size={13} color={C.primary} />
                                    <Text style={styles.paymentFeatureText}>{t('Email de confirmation')}</Text>
                                </View>
                                <View style={styles.paymentFeature}>
                                    <LucideIcon name="checkmark-circle" size={13} color={C.primary} />
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
                                    <LucideIcon name="checkmark" size={42} color={C.primaryText} />
                                </View>
                                <View style={styles.successSealBadge}>
                                    <LucideIcon name="ribbon" size={12} color={C.primaryText} />
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
                                        <LucideIcon name="finger-print" size={12} color={C.primaryText} />
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
                                <LucideIcon name="arrow-forward" size={18} color={C.primaryText} style={{ marginLeft: 8 }} />
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
                        <LucideIcon name="arrow-back" size={22} color={C.primary} />
                    </View>
                </Pressable>

                <View style={styles.navCounter}>
                    <LucideIcon name="shield-checkmark" size={12} color={C.primary} />
                    <Text style={styles.navCounterText}>{t('Nationalité VIP')}</Text>
                </View>
            </View>

            {/* EN-TÊTE — vocabulaire de l'accueil
                L'ancien en-tête annonçait la progression QUATRE fois : pastille
                « CHAPITRE 1 / 6 », barre, six pastilles numérotées, et libellé
                du chapitre. D'où l'impression de surcharge.

                L'accueil pose un sur-titre discret puis un grand titre —
                « BONJOUR, » puis le prénom. On applique la même grammaire :
                le sur-titre porte le repère de progression, le titre porte le
                nom du chapitre. Une seule barre fine complète, et les six
                pastilles disparaissent : elles répétaient l'information sans
                rien ajouter, puisqu'on ne peut pas sauter d'étape. */}
            {currentStep < 6 && (
                <Animated.View style={[styles.headerContainer, styleHeader]}>
                    <Text style={styles.overline}>
                        {`${t('CHAPITRE')} ${currentStep + 1} ${t('SUR')} 6`}
                    </Text>
                    <Text style={styles.title}>{t(STEPS_META[currentStep].label)}</Text>
                    <Text style={styles.subtitle}>{t('Demande de nationalité béninoise')}</Text>
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
                                <LucideIcon
                                    name={currentStep === 5 ? 'lock-closed' : 'arrow-forward'}
                                    size={18}
                                    color={C.primary}
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
    /* ── Feuille de sélection ──
       Ouverte par le bas plutôt qu'une liste déroulante native : plus
       confortable au pouce, et rendu identique sur Android et iOS. */
    selectOverlay: {
        flex: 1,
        backgroundColor: C.overlay,
        justifyContent: 'flex-end',
    },
    selectSheet: {
        backgroundColor: C.surface,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.sm,
        ...shadows.floating,
    },
    selectHandle: {
        width: 44, height: 5, borderRadius: 3,
        backgroundColor: C.borderStrong,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    selectTitle: {
        ...typography.h3,
        color: C.text,
        marginBottom: spacing.sm,
    },
    selectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    selectOptionActive: {
        borderBottomColor: C.primary,
    },
    selectOptionText: {
        ...typography.body,
        color: C.text,
        flex: 1,
    },
    selectOptionTextActive: {
        ...typography.body,
        fontFamily: fonts.bold,
        color: C.primary,
        flex: 1,
    },

    container: {
        flex: 1,
        backgroundColor: C.bg,
    },

    /* ── Nav Bar ── */
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navBack: { width: 44, height: 44, justifyContent: 'center' },
    iconContainer: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    navCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    navCounterText: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 0.3,
    },

    /* ── Header ── */
    /* Même grammaire que l'accueil : gouttière commune, sur-titre discret,
       grand titre, sous-titre en gris secondaire. */
    headerContainer: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    overline: { ...typography.overline, color: C.textFaint },
    title: { ...typography.h1, color: C.text, marginTop: spacing.xs },
    subtitle: { ...typography.bodySmall, color: C.textMuted, marginTop: spacing.xs },

    /* ── Stepper ── */
    stepperWrap: {
        marginTop: spacing.md,
    },
    /* Fine et sobre, a l'image de la barre du dossier sur l'accueil. */
    progressTrack: {
        height: 6,
        backgroundColor: C.surfaceAlt,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: C.primary,
        borderRadius: 3,
    },

    /* ── Scroll ── */
    scroll: {
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.md,
    },

    /* ── Step Header (in cards) ── */
    stepHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.xs,
    },
    stepHeaderIcon: {
        width: 42,
        height: 42,
        borderRadius: radius.md,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    stepHeaderBadge: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1.2,
        marginBottom: spacing.xxs,
    },
    stepHeaderTitle: {
        ...typography.h3, fontSize: 19,
        color: C.primary,
        letterSpacing: -0.3,
    },
    stepIntro: {
        ...typography.label,
        color: C.textSec,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
        fontStyle: 'italic',
    },

    /* ── Hero Card (step 0) ── */
    heroCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        alignItems: 'center',
        ...shadows.card,
    },
    heroIconWrap: {
        width: 72,
        height: 72,
        borderRadius: radius.xxl,
        backgroundColor: C.surfaceSolid,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        position: 'relative',
    },
    heroIconGlow: { display: 'none' },
    heroBadge: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
    },
    heroTitle: {
        ...typography.h1, fontSize: 26,
        color: C.primary,
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    heroSubtitle: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.gutter,
    },
    quoteBox: {
        flexDirection: 'row',
        backgroundColor: C.bg,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        width: '100%',
    },
    quoteBar: {
        width: 3,
        backgroundColor: C.accent,
        borderRadius: 2,
        marginRight: spacing.md,
    },
    quoteText: {
        ...typography.label,
        color: C.primary,
        fontStyle: 'italic',
    },

    /* ── Field ── */
    fieldWrap: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        ...typography.overline,
        color: C.textSec,
        marginBottom: spacing.xs,
        marginLeft: spacing.xs,
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        borderWidth: 1,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        ...shadows.card,
    },
    fieldContainerTextArea: {
        height: 110,
        alignItems: 'flex-start',
        paddingTop: spacing.md,
    },
    fieldIcon: {
        marginRight: spacing.sm,
    },
    fieldInput: {
        flex: 1,
        color: C.primary,
        ...typography.body, fontSize: 14.5,
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
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    switchRowHighlight: {
        borderColor: C.border,
        backgroundColor: C.accentSoft,
    },
    switchIconWrap: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    switchLabel: {
        ...typography.label,
        color: C.primary,
    },

    /* ── Sub Card (ancêtres / parents) ── */
    subCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        marginTop: spacing.xs,
        ...shadows.card,
    },
    subCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    subCardNumber: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: C.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.primary,
    },
    subCardNumberText: {
        ...typography.button, fontSize: 12,
        color: C.primaryText,
        letterSpacing: 0.3,
    },
    subCardTitle: {
        ...typography.button,
        color: C.primary,
        letterSpacing: -0.2,
        marginBottom: spacing.xxs,
    },
    subCardTag: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1.2,
    },

    /* ── Doc Counter ── */
    docCounter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    docCounterIcon: {
        width: 38,
        height: 38,
        borderRadius: radius.sm,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    docCounterLabel: {
        ...typography.button, fontSize: 12,
        color: C.accentLight,
        letterSpacing: 1.2,
        marginBottom: spacing.xxs,
    },
    docCounterValue: {
        ...typography.button, fontSize: 13,
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
        ...typography.button, fontSize: 13,
        color: C.primary,
    },

    /* ── Doc Slot ── */
    docSlot: {
        backgroundColor: C.surface,
        borderRadius: radius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.sm,
    },
    docSlotActive: {
        borderColor: C.border,
        backgroundColor: C.surfaceSoft,
    },
    docSlotHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    docSlotIcon: {
        width: 36,
        height: 36,
        borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    docSlotIconActive: {
        backgroundColor: C.surfaceSoft,
        borderColor: C.border,
    },
    docSlotTitle: {
        ...typography.button, fontSize: 12.5,
        color: C.primary,
        marginBottom: spacing.xs,
    },
    docSlotTags: {
        flexDirection: 'row',
        gap: spacing.xs,
        flexWrap: 'wrap',
    },
    miniTag: {
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs,
        borderRadius: radius.xs,
        borderWidth: 1,
    },
    miniTagText: {
        ...typography.button, fontSize: 12,
        letterSpacing: 0.5,
    },

    /* ── Upload Button ── */
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.primary,
        paddingHorizontal: 12,
        paddingVertical: spacing.sm,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadBtnSecondary: {
        backgroundColor: C.surfaceSolid,
        borderColor: C.border,
    },
    uploadBtnText: {
        ...typography.button, fontSize: 12,
        color: C.primaryText,
        letterSpacing: 0.3,
    },
    uploadBtnTextSecondary: {
        color: C.primary,
    },

    /* ── Uploaded Files ── */
    uploadedList: {
        gap: spacing.xs,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: C.border,
    },
    uploadedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: C.surfaceSolid,
        padding: spacing.sm,
        borderRadius: radius.xs,
        borderWidth: 1,
        borderColor: C.border,
    },
    uploadedItemIcon: {
        width: 26,
        height: 26,
        borderRadius: radius.xs,
        backgroundColor: C.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadedItemName: {
        flex: 1,
        ...typography.caption,
        color: C.primary,
    },

    /* ── Recap Card ── */
    recapCard: {
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
    },
    recapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 12,
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    recapHeaderText: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1.3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        gap: 12,
    },
    infoRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    infoLabel: {
        ...typography.caption,
        color: C.textSec,
        flex: 1,
    },
    infoValue: {
        ...typography.button, fontSize: 12.5,
        color: C.primary,
        flex: 1.2,
        textAlign: 'right',
    },

    /* ── Payment Card ── */
    paymentCard: {
        backgroundColor: C.primary,
        borderRadius: radius.xl,
        padding: spacing.gutter,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
        position: 'relative',
        overflow: 'hidden',
        ...shadows.card,
    },
    paymentGlow: { display: 'none' },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: C.accentSoft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: spacing.md,
    },
    paymentBadgeText: {
        ...typography.button, fontSize: 12,
        color: C.primaryText,
        letterSpacing: 1.2,
    },
    paymentLabel: {
        ...typography.caption,
        color: 'rgba(255, 255, 255, 0.7)',
        marginBottom: spacing.xs,
    },
    paymentAmount: {
        ...typography.h1, fontSize: 38,
        color: C.primaryText,
        letterSpacing: -1,
    },
    paymentCurrency: {
        ...typography.h3, fontSize: 18,
        color: C.primary,
    },
    paymentDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: spacing.md,
    },
    paymentFeatures: {
        gap: spacing.sm,
    },
    paymentFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    paymentFeatureText: {
        ...typography.label, fontSize: 12.5,
        color: 'rgba(255, 255, 255, 0.85)',
    },

    /* ── Footer ── */
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: C.surfaceSolid,
        paddingHorizontal: spacing.gutter,
        paddingTop: spacing.md,
        // paddingBottom fourni au montage depuis insets.bottom : voir l'usage.
        borderTopWidth: 1,
        borderTopColor: C.border,
        ...shadows.card,
    },
    primaryBtn: {
        height: 58,
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    primaryBtnDisabled: {
        backgroundColor: C.borderStrong,
        shadowOpacity: 0,
        elevation: 0,
        borderColor: 'transparent',
    },
    primaryBtnText: {
        color: C.primaryText,
        ...typography.button,
        letterSpacing: 0.2,
    },

    /* ── Success Card ── */
    successCard: {
        backgroundColor: C.surface,
        borderRadius: radius.xxl,
        padding: 28,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        marginTop: spacing.gutter,
        ...shadows.card,
    },
    successSeal: {
        width: 110,
        height: 110,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: spacing.gutter,
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
        borderColor: C.primary,
        shadowColor: '#3C3C3C',
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
        borderColor: C.primary,
    },
    successBadge: {
        ...typography.button, fontSize: 12,
        color: C.primary,
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
    },
    successTitle: {
        ...typography.h1, fontSize: 28,
        color: C.primary,
        letterSpacing: -0.5,
        textAlign: 'center',
        marginBottom: 12,
    },
    successSubtitle: {
        ...typography.bodySmall, fontSize: 13.5,
        color: C.textSec,
        textAlign: 'center',
        marginBottom: spacing.gutter,
    },
    refBox: {
        width: '100%',
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    refLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    refLabelText: {
        ...typography.button, fontSize: 12,
        color: C.primaryText,
        letterSpacing: 1.5,
    },
    refValue: {
        ...typography.h2,
        color: C.primaryText,
        letterSpacing: 2,
    },
    successBtn: {
        width: '100%',
        height: 56,
        backgroundColor: C.primary,
        borderRadius: radius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
        ...shadows.card,
    },
    successBtnText: {
        color: C.primaryText,
        ...typography.button, fontSize: 14.5,
        letterSpacing: 0.2,
    },
})