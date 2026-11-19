/* ═══════════════════════════════════════════════════════════
   Récap de dossier MyAfroOrigins — écran de service.

   Service GRATUIT depuis l'agrément de l'agence (décision du 18/11/2026) :
   le client décrit sa situation, consent au traitement de ses données, et
   la demande part directement, sans paiement.
   · Le CONSENTEMENT au traitement des données (loi n° 2017-20, Code du
     numérique béninois) reste exigé, comme sur le site.
   · Le RÉCIT de la situation reste obligatoire : c'est la matière même de
     l'analyse.

   Cet écran suit la structure éditoriale des autres services (Fa, Permis) et
   porte le parcours complet : comprendre, décrire, consentir, envoyer, suivre.

   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
    RefreshControl, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import {
    ChevronLeft, FileSearch, Paperclip, CheckCircle, Clock, Archive,
    FileText, Plus, AlertTriangle, ListOrdered, HandHeart, Lock, ArrowRight,
    User, Mail, Phone, ShieldCheck,
} from 'lucide-react-native'
import { supabase } from '../../config/supabase'
import { screenColors as C, radius, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { aEnMemoire, avecMemoire, cleDuClient, etatMemorise } from '../../lib/memoire'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const VERT_PROFOND = '#00643C'
const TAILLE_MAX = 10 * 1024 * 1024
const MINI_SITUATION = 40

interface Piece { id: string; file_name: string; file_size: number | null; created_at: string }

interface Recap {
    id: string
    reference: string
    email: string
    statut: string
    situation: string
    recap_ia: string | null
    montant: number
    devise: string
    created_at: string
    pieces: Piece[]
}

const ETATS: Record<string, { label: string; Icone: typeof Clock }> = {
    nouveau: { label: 'Reçue', Icone: Clock },
    en_analyse: { label: 'En analyse', Icone: FileSearch },
    recap_livre: { label: 'Récap livré', Icone: CheckCircle },
    clos: { label: 'Clos', Icone: Archive },
}

/* Ce que contient la fiche — annoncé avant la demande, tenu après. */
const LIVRABLE = [
    { Icone: FileSearch, titre: 'Votre situation, reformulée', desc: 'Ce que nous avons compris, écrit noir sur blanc. Vous corrigez si nous nous trompons.' },
    { Icone: AlertTriangle, titre: 'Ce qui bloque', desc: 'Par ordre de gravité : la plateforme, vos pièces, ou l’état civil béninois.' },
    { Icone: ListOrdered, titre: 'Les pièces à réunir', desc: 'La liste exacte, dans l’ordre où les obtenir.' },
    { Icone: HandHeart, titre: 'La marche à suivre', desc: 'Étape par étape, et ce que l’agence prend en charge.' },
]

const poids = (o: number | null) => {
    const n = Number(o) || 0
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`
}

type Vue = 'service' | 'formulaire'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecapMyafroDemandeScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const [vue, setVue] = useState<Vue>('formulaire')
    const cleRecaps = cleDuClient(profile?.id, 'recaps')
    const [recaps, setRecaps] = useState<Recap[]>(() => etatMemorise<Recap[]>(cleRecaps, []))
    const [chargement, setChargement] = useState(() => !aEnMemoire(cleRecaps))
    const [rafraichit, setRafraichit] = useState(false)
    const [depotEnCours, setDepotEnCours] = useState<string | null>(null)

    const [delai, setDelai] = useState('48 heures ouvrées')

    const [form, setForm] = useState({
        prenom: '', nom: '', email: '', telephone: '',
        pays_residence: '', myafro_reference: '', depuis_quand: '',
        situation: '', attentes: '',
    })
    const [consentement, setConsentement] = useState(false)
    const [envoi, setEnvoi] = useState(false)

    /* ── Chargement ─────────────────────────────────────────── */
    const charger = useCallback(async () => {
        // Demandes deja deposees : affichees depuis la derniere version connue.
        await avecMemoire<Recap[]>(
            cleRecaps,
            async () => {
                const res = await fetchWithTimeout(`${API_BASE}/api/mobile/recaps`, {
                    headers: { ...(await authHeaders()) }, timeoutMs: 15000,
                })
                const json = await res.json().catch(() => ({}))
                // 401/500 : on lève — la liste affichée (et mémorisée) reste,
                // au lieu d'être remplacée par « aucune demande ».
                if (!res.ok || !Array.isArray(json.recaps)) throw new Error(`recaps HTTP ${res.status}`)
                return json.recaps
            },
            (liste) => { setRecaps(liste); setChargement(false) },
        )
        setChargement(false); setRafraichit(false)
    }, [profile?.id])

    useEffect(() => { if (profile) charger(); else setChargement(false) }, [profile, charger])

    /* Délai de remise annoncé, réglé depuis l'admin. Le service étant
       gratuit, aucun montant n'est lu ici. */
    useEffect(() => {
        void avecMemoire<{ delai?: string }>(
            'recap-myafro-delai',
            async () => {
                const { data, error } = await supabase.from('page_sections').select('content')
                    .eq('page', 'recap-myafroorigins').eq('section_key', 'form_settings').maybeSingle()
                if (error) throw new Error(error.message)
                const c = (data?.content || {}) as Record<string, unknown>
                return { delai: c.delai ? String(c.delai) : undefined }
            },
            (v) => { if (v.delai) setDelai(v.delai) },
        )
    }, [])

    // Coordonnées pré-remplies : le client ne ressaisit pas ce que son compte
    // contient déjà.
    useEffect(() => {
        if (!profile) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = profile as any
        setForm(f => ({
            ...f,
            prenom: f.prenom || p.prenom || '',
            nom: f.nom || p.nom || '',
            email: f.email || p.email || '',
            telephone: f.telephone || p.phone || p.telephone || '',
        }))
    }, [profile])

    const champsOk = !!(form.prenom.trim() && form.nom.trim() && form.email.trim()
        && form.telephone.trim() && form.situation.trim().length >= MINI_SITUATION)
    const pret = champsOk && consentement

    /* ── Envoi de la demande (gratuite, aucun paiement) ────────
       Aucun argent n'est engagé : en cas d'échec, la demande reste à
       l'écran et le client renvoie. Pas de file d'envoi ici : sans
       référence de paiement, la route ne peut pas dédoublonner un rejeu. */
    const envoyer = async () => {
        setEnvoi(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/services/recap-myafroorigins`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 40000,
                body: JSON.stringify({
                    ...form,
                    consentement,
                    payment_method: 'gratuit',
                    payment_status: 'gratuit',
                    amount: 0,
                    source: 'mobile',
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || t('Enregistrement impossible.'))

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
            setVue('service')
            setForm(f => ({ ...f, situation: '', attentes: '', myafro_reference: '', depuis_quand: '' }))
            setConsentement(false)
            charger()
            toast(
                t('Demande envoyée'),
                t('Un analyste reprend votre situation. Vous recevez votre fiche sous {d}.', { d: delai }),
            )
        } catch (e) {
            toast(t('Envoi impossible'), e instanceof Error ? e.message : t('Réessayez dans un instant.'))
        } finally { setEnvoi(false) }
    }

    /* ── Pièces jointes ─────────────────────────────────────── */
    const deposer = async (recap: Recap) => {
        try {
            const choix = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
            if (choix.canceled || !choix.assets?.length) return
            const f = choix.assets[0]
            if ((f.size || 0) > TAILLE_MAX) {
                toast(t('Fichier trop volumineux'), t('10 Mo maximum par pièce.'))
                return
            }
            setDepotEnCours(recap.id)
            const fd = new FormData()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fd.append('file', { uri: f.uri, name: f.name, type: f.mimeType || 'application/octet-stream' } as any)
            fd.append('reference', recap.reference)
            fd.append('email', recap.email)
            fd.append('source', 'mobile')

            const res = await fetchWithTimeout(`${API_BASE}/api/services/recap-myafroorigins/documents`, {
                method: 'POST', body: fd, timeoutMs: 60000,
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || t('Dépôt impossible.'))

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
            toast(t('Pièce envoyée'), t('Elle est jointe à votre demande.'))
            charger()
        } catch (e) {
            toast(t('Dépôt impossible'), e instanceof Error ? e.message : t('Réessayez dans un instant.'))
        } finally { setDepotEnCours(null) }
    }

    /* ══ FORMULAIRE ══ */
    if (vue === 'formulaire') {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.entete}>
                    <Pressable onPress={() => navigation.goBack()} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                        <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                    <Text style={styles.enteteTitre}>{t('Ma demande')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView contentContainerStyle={styles.scrollForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={styles.formIntro}>
                            {t('Plus votre récit est précis, plus l’analyse est utile. Prenez le temps : c’est la matière de votre fiche.')}
                        </Text>

                        {[
                            { k: 'prenom' as const, l: 'Prénom', Icone: User, kb: 'default' as const },
                            { k: 'nom' as const, l: 'Nom', Icone: User, kb: 'default' as const },
                            { k: 'email' as const, l: 'Email', Icone: Mail, kb: 'email-address' as const },
                            { k: 'telephone' as const, l: 'Téléphone / WhatsApp', Icone: Phone, kb: 'phone-pad' as const },
                        ].map(ch => (
                            <View key={ch.k} style={styles.champ}>
                                <Text style={styles.champLabel}>{t(ch.l)} <Text style={styles.requis}>*</Text></Text>
                                <View style={styles.champLigne}>
                                    <ch.Icone size={16} color={C.primary} strokeWidth={2.2} />
                                    <TextInput
                                        value={form[ch.k]}
                                        onChangeText={v => setForm(f => ({ ...f, [ch.k]: v }))}
                                        keyboardType={ch.kb}
                                        autoCapitalize={ch.kb === 'email-address' ? 'none' : 'words'}
                                        style={styles.champInput}
                                        placeholderTextColor={C.textMuted}
                                    />
                                </View>
                            </View>
                        ))}

                        {[
                            { k: 'pays_residence' as const, l: 'Pays de résidence', ph: 'France, Martinique…' },
                            { k: 'myafro_reference' as const, l: 'Réf. MyAfroOrigins', ph: 'si vous l’avez' },
                            { k: 'depuis_quand' as const, l: 'Sans nouvelle depuis', ph: '8 mois…' },
                        ].map(ch => (
                            <View key={ch.k} style={styles.champ}>
                                <Text style={styles.champLabel}>{t(ch.l)}</Text>
                                <View style={styles.champLigne}>
                                    <TextInput
                                        value={form[ch.k]}
                                        onChangeText={v => setForm(f => ({ ...f, [ch.k]: v }))}
                                        placeholder={t(ch.ph)}
                                        placeholderTextColor={C.textMuted}
                                        style={styles.champInput}
                                    />
                                </View>
                            </View>
                        ))}

                        <View style={styles.champ}>
                            <Text style={styles.champLabel}>{t('Votre situation')} <Text style={styles.requis}>*</Text></Text>
                            <TextInput
                                value={form.situation}
                                onChangeText={v => setForm(f => ({ ...f, situation: v }))}
                                multiline
                                numberOfLines={7}
                                maxLength={4000}
                                placeholder={t('Quand avez-vous déposé votre demande ? Qu’avez-vous fourni ? Qu’est-ce qu’on vous a répondu ? Qu’est-ce qui vous semble bloquer ?')}
                                placeholderTextColor={C.textMuted}
                                style={styles.zoneTexte}
                            />
                            <Text style={[styles.compteur, form.situation.trim().length >= MINI_SITUATION && { color: C.primary }]}>
                                {form.situation.trim().length < MINI_SITUATION
                                    ? t('Encore {n} caractères pour une analyse exploitable.', { n: MINI_SITUATION - form.situation.trim().length })
                                    : t('Merci, c’est suffisamment précis.')}
                            </Text>
                        </View>

                        <View style={styles.champ}>
                            <Text style={styles.champLabel}>{t('Ce que vous attendez de nous')}</Text>
                            <TextInput
                                value={form.attentes}
                                onChangeText={v => setForm(f => ({ ...f, attentes: v }))}
                                multiline
                                numberOfLines={3}
                                maxLength={2000}
                                style={[styles.zoneTexte, { minHeight: 80 }]}
                                placeholderTextColor={C.textMuted}
                            />
                        </View>

                        {/* Consentement — condition d'existence de la donnée */}
                        <View style={styles.rgpd}>
                            <View style={styles.rgpdEntete}>
                                <Lock size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.rgpdTitre}>{t('Protection de vos données')}</Text>
                            </View>
                            {[
                                'Responsable : Agence Retour Gagnant Bénin.',
                                'Finalité : analyser votre dossier et vous remettre votre fiche.',
                                'Destinataires : nos analystes uniquement. Aucune revente.',
                                'Conservation : 3 ans, puis effacement.',
                                'Vos droits : accès, rectification, effacement, opposition — par email.',
                                'Conforme à la loi n° 2017-20 (Code du numérique, Bénin — APDP).',
                            ].map(l => (
                                <Text key={l} style={styles.rgpdLigne}>· {t(l)}</Text>
                            ))}
                            <Pressable
                                onPress={() => setConsentement(v => !v)}
                                style={styles.consentement}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: consentement }}
                            >
                                <View style={[styles.case, consentement && styles.caseOn]}>
                                    {consentement && <CheckCircle size={14} color="#FFFFFF" strokeWidth={2.6} />}
                                </View>
                                <Text style={styles.consentementText}>
                                    {t('Je consens au traitement des informations ci-dessus pour l’analyse de mon dossier.')}
                                    <Text style={styles.requis}> *</Text>
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                    <View style={styles.barreHaut}>
                        <View>
                            <Text style={styles.barreLabel}>{t('Fiche d’analyse')}</Text>
                            <Text style={styles.barreMontant}>{t('Gratuit')}</Text>
                        </View>
                        <View style={styles.securise}>
                            <ShieldCheck size={13} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.securiseText}>{t('Agence agréée')}</Text>
                        </View>
                    </View>

                    {envoi ? (
                        <View style={styles.ctaAttente}>
                            <ActivityIndicator color={C.primary} size="small" />
                            <Text style={styles.ctaAttenteText}>{t('Enregistrement…')}</Text>
                        </View>
                    ) : (
                        <Pressable
                            onPress={envoyer}
                            disabled={!pret}
                            style={({ pressed }) => [
                                styles.ctaLarge, !pret && { opacity: 0.4 },
                                pressed && pret && { transform: [{ scale: 0.98 }] },
                            ]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.ctaLargeText}>{t('Envoyer ma demande')}</Text>
                        </Pressable>
                    )}

                    {!pret && !envoi && (
                        <Text style={styles.barreNote}>
                            {!champsOk
                                ? t('Complétez les champs obligatoires pour continuer.')
                                : t('Votre consentement est nécessaire pour poursuivre.')}
                        </Text>
                    )}
                </View>
            </View>
        )
    }

    /* ══ SERVICE ══ */
    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.entete}>
                <Pressable onPress={() => navigation.goBack()} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.enteteTitre}>{t('Récap MyAfroOrigins')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 130 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger() }} tintColor={C.primary} />
                }
            >
                {/* Ouverture éditoriale */}
                <Animated.View entering={FadeInDown.duration(420)}>
                    <View style={styles.badge}>
                        <FileSearch size={13} color={C.primary} strokeWidth={2.4} />
                        <Text style={styles.badgeText}>{t('Reprise de dossier bloqué')}</Text>
                    </View>
                    <Text style={styles.h1}>{t('Votre dossier MyAfroOrigins n’avance plus ?')}</Text>
                    <Text style={styles.chapeau}>
                        {t('Vous avez déposé votre demande, et depuis, le silence. Nous reprenons votre situation, nous l’analysons, et nous vous remettons une fiche claire : ce qui bloque, ce qui manque, et par quoi commencer.')}
                    </Text>
                </Animated.View>

                {/* Ce que contient la fiche */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitre}>{t('Ce que vous recevez')}</Text>
                    {LIVRABLE.map((it, i) => (
                        <Animated.View key={it.titre} entering={FadeInDown.delay(80 + i * 70).duration(400)} style={styles.carteLivrable}>
                            <View style={styles.tuile}>
                                <it.Icone size={18} color={C.primary} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.carteTitre}>{t(it.titre)}</Text>
                                <Text style={styles.carteDesc}>{t(it.desc)}</Text>
                            </View>
                        </Animated.View>
                    ))}
                    <Text style={styles.note}>
                        {t('Aucune pièce d’identité n’est demandée à cette étape. Elles ne le seront que si l’analyse montre qu’elles sont nécessaires.')}
                    </Text>
                </View>

                {/* Mes demandes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitre}>{t('Mes demandes')}</Text>

                    {chargement ? (
                        <ActivityIndicator color={C.primary} style={{ marginVertical: 20 }} />
                    ) : recaps.length === 0 ? (
                        <View style={styles.vide}>
                            <Text style={styles.videText}>
                                {t('Aucune demande pour l’instant. Une fois envoyée, votre demande apparaît ici et vous pouvez y joindre vos pièces.')}
                            </Text>
                        </View>
                    ) : (
                        recaps.map((r, i) => {
                            const etat = ETATS[r.statut] || ETATS.nouveau
                            return (
                                <Animated.View key={r.id} entering={FadeInDown.delay(i * 70).duration(400)} style={styles.carte}>
                                    <View style={styles.carteHaut}>
                                        <View style={styles.tuile}>
                                            <etat.Icone size={17} color={C.primary} strokeWidth={2.2} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.carteEtat}>{t(etat.label)}</Text>
                                            <Text style={styles.carteRef}>{r.reference}</Text>
                                        </View>
                                        {/* Demandes réglées avant l'agrément : montant
                                            conservé ; les suivantes sont gratuites. */}
                                        <Text style={styles.cartePrix}>
                                            {Number(r.montant) > 0
                                                ? `${r.montant} ${r.devise === 'XOF' ? 'FCFA' : r.devise}`
                                                : t('Gratuit')}
                                        </Text>
                                    </View>

                                    <Text style={styles.carteSituation} numberOfLines={3}>{r.situation}</Text>

                                    {r.statut === 'recap_livre' && !!r.recap_ia && (
                                        <View style={styles.fiche}>
                                            <Text style={styles.ficheTitre}>{t('Votre fiche d’analyse')}</Text>
                                            <Text style={styles.ficheTexte}>{r.recap_ia}</Text>
                                        </View>
                                    )}

                                    <View style={styles.pieces}>
                                        <View style={styles.piecesEntete}>
                                            <Paperclip size={12} color={C.textMuted} strokeWidth={2.2} />
                                            <Text style={styles.piecesTitre}>
                                                {r.pieces.length > 0
                                                    ? t('{n} pièce(s) jointe(s)', { n: r.pieces.length })
                                                    : t('Aucune pièce jointe')}
                                            </Text>
                                        </View>
                                        {r.pieces.map(p => (
                                            <View key={p.id} style={styles.piece}>
                                                <FileText size={13} color={C.primary} strokeWidth={2.2} />
                                                <Text style={styles.pieceNom} numberOfLines={1}>{p.file_name}</Text>
                                                <Text style={styles.piecePoids}>{poids(p.file_size)}</Text>
                                            </View>
                                        ))}
                                        <Pressable
                                            onPress={() => deposer(r)}
                                            disabled={depotEnCours === r.id}
                                            style={({ pressed }) => [styles.ajouter, depotEnCours === r.id && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}
                                            accessibilityRole="button"
                                        >
                                            {depotEnCours === r.id
                                                ? <ActivityIndicator color={C.primary} size="small" />
                                                : <Plus size={14} color={C.primary} strokeWidth={2.6} />}
                                            <Text style={styles.ajouterText}>
                                                {depotEnCours === r.id ? t('Envoi en cours…') : t('Ajouter une pièce')}
                                            </Text>
                                        </Pressable>
                                    </View>
                                </Animated.View>
                            )
                        })
                    )}
                </View>
            </ScrollView>

            {/* Barre d'appel à l'action */}
            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <View style={styles.barreHaut}>
                    <View>
                        <Text style={styles.barreLabel}>{t('Fiche d’analyse')}</Text>
                        <Text style={styles.barreMontant}>{t('Gratuit')}</Text>
                    </View>
                    <View style={styles.securise}>
                        <Clock size={13} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.securiseText}>{delai}</Text>
                    </View>
                </View>
                <Pressable
                    onPress={() => setVue('formulaire')}
                    style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                    accessibilityRole="button"
                >
                    <Text style={styles.ctaLargeText}>{t('Demander mon récap')}</Text>
                    <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    enteteTitre: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    rond: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    scroll: { paddingHorizontal: 20, paddingTop: 20 },
    scrollForm: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },

    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
    badgeText: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    h1: { fontFamily: fonts.extrabold, fontSize: 25, lineHeight: 31, color: C.text, marginTop: 12 },
    chapeau: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 21, color: C.textSec, marginTop: 10 },

    section: { marginTop: 28 },
    sectionTitre: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 },
    carteLivrable: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginBottom: 10, ...shadows.card },
    carteTitre: { fontFamily: fonts.bold, fontSize: 14, color: C.text },
    carteDesc: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: C.textSec, marginTop: 3 },
    note: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: C.textMuted, marginTop: 6 },
    tuile: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },

    carte: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, gap: 12, marginBottom: 12, ...shadows.card },
    carteHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    carteEtat: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    carteRef: { fontFamily: fonts.bold, fontSize: 13, color: C.text, marginTop: 2 },
    cartePrix: { fontFamily: fonts.extrabold, fontSize: 12.5, color: VERT_PROFOND },
    carteSituation: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: C.textSec },

    fiche: { backgroundColor: C.primarySoft, borderRadius: 14, padding: 14 },
    ficheTitre: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
    ficheTexte: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 20, color: VERT_PROFOND },

    pieces: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, gap: 8 },
    piecesEntete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    piecesTitre: { fontFamily: fonts.bold, fontSize: 11, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
    piece: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
    pieceNom: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: C.text },
    piecePoids: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted },
    ajouter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: 'rgba(0,135,81,0.15)', borderRadius: radius.pill, paddingVertical: 11 },
    ajouterText: { fontFamily: fonts.bold, fontSize: 12, color: C.primary },

    vide: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
    videText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: C.textSec, textAlign: 'center' },

    /* Formulaire */
    formIntro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, marginBottom: 18 },
    champ: { marginBottom: 14 },
    champLabel: { fontFamily: fonts.bold, fontSize: 11, color: C.textMuted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 6 },
    requis: { color: C.danger },
    champLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14 },
    champInput: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13.5, color: C.text, paddingVertical: 12 },
    zoneTexte: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, minHeight: 150, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: C.text },
    compteur: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, marginTop: 6 },

    rgpd: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, marginTop: 4 },
    rgpdEntete: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
    rgpdTitre: { fontFamily: fonts.bold, fontSize: 11, color: C.text, letterSpacing: 1, textTransform: 'uppercase' },
    rgpdLigne: { fontFamily: fonts.body, fontSize: 11.5, lineHeight: 17, color: C.textSec },
    consentement: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
    case: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    caseOn: { backgroundColor: C.primary, borderColor: C.primary },
    consentementText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: C.text },

    /* Barre */
    barre: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 12, gap: 10, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.05, shadowRadius: 24, elevation: 12 },
    barreHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    barreLabel: { fontFamily: fonts.bold, fontSize: 11, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
    barreMontant: { fontFamily: fonts.extrabold, fontSize: 20, color: VERT_PROFOND, marginTop: 2 },
    securise: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    securiseText: { fontFamily: fonts.body, fontSize: 11, color: C.textSec },
    ctaLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    ctaLargeText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
    ctaAttente: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
    ctaAttenteText: { fontFamily: fonts.bold, fontSize: 13, color: C.primary },
    barreNote: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, textAlign: 'center' },
})
