/* ═══════════════════════════════════════════════════════════
   ABLAWA — le support qui répond tout de suite.

   Le bouton « Support » de l'accueil ouvrait la messagerie humaine : on posait
   sa question, puis on attendait qu'un agent soit disponible. Pour une diaspora
   répartie sur plusieurs fuseaux, cela veut souvent dire le lendemain.

   Ablawa répond dans la seconde. Elle n'est pas un agent de plus : elle est la
   PREMIÈRE réponse, et elle sait passer la main — un litige, un dossier bloqué,
   un engagement contractuel, cela reste humain. Le support humain existe
   toujours, juste à côté, et l'écran le dit.

   Même langue visuelle que la messagerie (liseré tricolore, avatar carré,
   bulles, barre de saisie) : ce sont deux portes du même couloir, elles doivent
   se ressembler. Ce qui les distingue tient en un mot dans l'en-tête.

   La conversation vit sur le TÉLÉPHONE (MMKV) : rien n'est stocké côté serveur,
   aucune table, et le fil reste chez son propriétaire. Il repart avec chaque
   question pour qu'Ablawa garde le fil.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    View, Text, FlatList, TextInput, StyleSheet, Pressable,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Send, ArrowLeft, Headphones, ShieldCheck } from 'lucide-react-native'
import {
    screenColors as C, typography, spacing, radius, shadows, fonts,
} from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { toast } from '../../lib/feedback'
import { cleDuClient, etatMemorise, ecrireMemoire } from '../../lib/memoire'
import { localeActuelle } from '../../lib/dates'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const AGENCE_TEL = '+2290160322121'
/** Ce qu'on renvoie au serveur pour qu'elle garde le fil. */
const MAX_HISTORIQUE = 12

interface Tour {
    id: string
    role: 'user' | 'assistant'
    content: string
    at: string
}

/* Quelques entrées en matière, pour que l'écran vide ne soit pas une page
   blanche. Elles disent aussi ce qu'Ablawa sait faire — donc ce qu'elle ne
   fait pas. */
const AMORCES = [
    'Comment obtenir la nationalité béninoise ?',
    'Combien coûte la recherche ancestrale ?',
    'Où en est mon dossier ?',
    'Quels documents dois-je préparer ?',
]

const heure = (iso: string) => {
    try {
        return new Date(iso).toLocaleTimeString(localeActuelle(), { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function AblawaScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t, lang } = useLang()
    const { profile } = useAuth()

    /* Le fil est peint dès la première image : on retrouve sa conversation là
       où on l'avait laissée, sans le moindre chargement. */
    const cleFil = cleDuClient(profile?.id, 'ablawa-fil')
    const [tours, setTours] = useState<Tour[]>(() => etatMemorise<Tour[]>(cleFil, []))
    const [question, setQuestion] = useState('')
    const [envoi, setEnvoi] = useState(false)
    const [focus, setFocus] = useState(false)
    const liste = useRef<FlatList<Tour>>(null)

    // Toute évolution du fil est conservée : fermer l'écran ne perd rien.
    useEffect(() => { ecrireMemoire(cleFil, tours.slice(-60)) }, [tours, cleFil])

    const versLeBas = useCallback(() => {
        requestAnimationFrame(() => liste.current?.scrollToEnd({ animated: true }))
    }, [])

    const demander = useCallback(async (texte?: string) => {
        const q = (texte ?? question).trim()
        if (!q || envoi) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
        setQuestion('')
        setEnvoi(true)

        const mien: Tour = { id: `u-${Date.now()}`, role: 'user', content: q, at: new Date().toISOString() }
        // L'historique ENVOYÉ n'inclut pas la question du moment : le serveur
        // la reçoit à part, sinon elle compterait deux fois.
        const historique = tours.slice(-MAX_HISTORIQUE).map(x => ({ role: x.role, content: x.content }))
        setTours(prev => [...prev, mien])
        versLeBas()

        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/ablawa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 30000,
                /* `langue` n'était PAS envoyée : le serveur ignorait donc le
                   réglage de l'application, et un prompt entièrement rédigé en
                   français ramenait Ablawa au français — y compris face à une
                   question posée en anglais. Elle sert de langue PAR DÉFAUT ;
                   le serveur bascule de lui-même si le message est écrit dans
                   une autre langue. */
                body: JSON.stringify({ question: q, historique, langue: lang }),
            })
            const json = await res.json().catch(() => ({}))
            const dit = String(json?.reponse || json?.repli || '').trim()

            if (!dit) {
                /* Le message DIT ce qui s'est passé. « Réessayez dans un
                   instant » masquait tout : un 404 (route pas encore
                   déployée), un 401 (session expirée) et une panne du modèle
                   avaient le même visage — impossible à diagnostiquer, pour
                   vous comme pour nous. */
                const detail = res.status === 401
                    ? t('Session expirée. Reconnectez-vous.')
                    : res.status === 404
                        ? t('Service indisponible sur le serveur (404). Il vient d’être publié : réessayez dans quelques minutes.')
                        : res.status === 429
                            ? t('Trop de questions d’un coup. Laissez-lui un instant.')
                            : `${json?.error || t('Réessayez dans un instant.')} (${res.status})`
                toast(t('Ablawa n’a pas répondu'), detail, 'warning')
                return
            }
            setTours(prev => [...prev, {
                id: `a-${Date.now()}`, role: 'assistant', content: dit, at: new Date().toISOString(),
            }])
            versLeBas()
        } catch {
            toast(
                t('Connexion interrompue'),
                t('Votre question n’est pas partie. Réessayez, ou écrivez à l’équipe.'),
                'danger',
            )
        } finally {
            setEnvoi(false)
        }
    }, [question, envoi, tours, versLeBas, t, lang])

    const bulle = ({ item }: { item: Tour }) => {
        const moi = item.role === 'user'
        return (
            <View style={[styles.row, moi ? styles.rowMoi : styles.rowElle]}>
                {!moi && (
                    <View style={styles.avatarElle}>
                        <Text style={styles.initialePetite}>A</Text>
                    </View>
                )}
                <View style={[styles.bulle, moi ? styles.bulleMoi : styles.bulleElle]}>
                    {!moi && (
                        <View style={styles.nomRow}>
                            <Text style={styles.nom}>{t('Ablawa')}</Text>
                            <View style={styles.badge}>
                                <ShieldCheck size={9} color={C.primary} strokeWidth={2.4} />
                            </View>
                        </View>
                    )}
                    <Text style={[styles.texte, moi ? styles.texteMoi : styles.texteElle]}>
                        {item.content}
                    </Text>
                    <View style={styles.meta}>
                        <Text style={[styles.metaHeure, moi ? styles.heureMoi : styles.heureElle]}>
                            {heure(item.at)}
                        </Text>
                    </View>
                </View>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            {/* EN-TÊTE — même structure que la messagerie, un mot les distingue */}
            <View style={styles.navBar}>
                {navigation?.canGoBack?.() ? (
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={styles.rond}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t('Retour')}
                    >
                        <ArrowLeft size={20} color={C.text} strokeWidth={2.2} />
                    </Pressable>
                ) : null}

                {/* Une INITIALE, pas une etincelle : Ablawa se presente comme
                    une personne du repertoire, pas comme un gadget. */}
                <View style={styles.avatarEntete}>
                    <Text style={styles.initiale}>A</Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text style={styles.navTitre} numberOfLines={1}>{t('Ablawa')}</Text>
                    <View style={styles.statutRow}>
                        <View style={styles.point} />
                        <Text style={styles.statut} numberOfLines={1}>
                            {envoi ? t('écrit…') : t('Assistante IA · répond tout de suite')}
                        </Text>
                    </View>
                </View>

                {/* La porte à côté : quand il faut un humain, on ne le cache pas. */}
                <Pressable
                    onPress={() => navigation.navigate('Messages')}
                    style={styles.rond}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('Parler à un conseiller')}
                >
                    <Headphones size={18} color={C.primary} strokeWidth={2.2} />
                </Pressable>
            </View>

            {tours.length === 0 ? (
                <View style={styles.vide}>
                    <View style={styles.videTuile}>
                        <Text style={styles.initialeGrande}>A</Text>
                    </View>
                    <Text style={styles.videTitre}>{t('Bonjour, je suis Ablawa')}</Text>
                    <Text style={styles.videTexte}>
                        {t('Posez-moi vos questions sur la nationalité, la recherche ancestrale, le logement, vos dossiers — je réponds tout de suite. Pour un litige ou un dossier bloqué, je vous passe l’équipe.')}
                    </Text>

                    <View style={styles.amorces}>
                        {AMORCES.map(a => (
                            <Pressable
                                key={a}
                                onPress={() => demander(t(a))}
                                style={({ pressed }) => [styles.amorce, pressed && { opacity: 0.7 }]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.amorceTexte}>{t(a)}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : (
                <FlatList
                    ref={liste}
                    data={tours}
                    keyExtractor={x => x.id}
                    renderItem={bulle}
                    contentContainerStyle={styles.fil}
                    onContentSizeChange={versLeBas}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={envoi ? (
                        <View style={[styles.row, styles.rowElle]}>
                            <View style={styles.avatarElle}>
                                <Text style={styles.initialePetite}>A</Text>
                            </View>
                            <View style={[styles.bulle, styles.bulleElle, styles.bulleEcrit]}>
                                <ActivityIndicator size="small" color={C.primary} />
                                <Text style={styles.ecritTexte}>{t('Ablawa réfléchit…')}</Text>
                            </View>
                        </View>
                    ) : null}
                />
            )}

            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <View style={[styles.champWrap, { borderColor: focus ? C.accent : C.border }]}>
                    <TextInput
                        style={styles.champ}
                        value={question}
                        onChangeText={setQuestion}
                        onFocus={() => setFocus(true)}
                        onBlur={() => setFocus(false)}
                        placeholder={t('Écrivez à Ablawa…')}
                        placeholderTextColor={C.textMuted}
                        multiline
                        editable={!envoi}
                    />
                </View>
                <Pressable
                    onPress={() => demander()}
                    disabled={!question.trim() || envoi}
                    style={[styles.envoyer, (!question.trim() || envoi) && styles.envoyerEteint]}
                    accessibilityRole="button"
                    accessibilityLabel={t('Envoyer')}
                >
                    {envoi
                        ? <ActivityIndicator size="small" color={C.primaryText} />
                        : <Send size={20} color={C.primaryText} strokeWidth={2.2} />}
                </Pressable>
            </View>

            <Text style={[styles.mention, { marginBottom: insets.bottom > 0 ? 0 : 8 }]}>
                {t('Ablawa est une assistante. Pour un engagement ferme, l’équipe reprend la main au')} {AGENCE_TEL}.
            </Text>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    /* ── En-tête (repris de la messagerie) ── */
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    rond: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    avatarEntete: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...shadows.card },
    initiale: { fontFamily: fonts.extrabold, fontSize: 19, color: C.primaryText },
    initialePetite: { fontFamily: fonts.extrabold, fontSize: 12, color: C.primaryText },
    initialeGrande: { fontFamily: fonts.extrabold, fontSize: 30, color: C.primary },
    navTitre: { ...typography.h3, fontSize: 17, color: C.text },
    statutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    statut: { ...typography.bodySmall, color: C.success, fontSize: 12, flexShrink: 1 },
    point: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },

    /* ── Écran vide ── */
    vide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    videTuile: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
    videTitre: { ...typography.h3, fontSize: 19, color: C.text, marginTop: spacing.lg },
    videTexte: { ...typography.body, fontSize: 13.5, lineHeight: 20, color: C.textSec, textAlign: 'center', marginTop: spacing.sm },
    amorces: { width: '100%', gap: spacing.sm, marginTop: spacing.xl },
    amorce: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, paddingVertical: 13, paddingHorizontal: spacing.md, ...shadows.card },
    amorceTexte: { ...typography.bodySmall, color: C.primary, fontSize: 13 },

    /* ── Fil ── */
    fil: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    rowMoi: { justifyContent: 'flex-end' },
    rowElle: { justifyContent: 'flex-start' },
    avatarElle: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

    bulle: { maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
    bulleMoi: { backgroundColor: C.primary, borderBottomRightRadius: 4, borderWidth: 1, borderColor: C.border, ...shadows.card },
    bulleElle: { backgroundColor: C.surfaceSolid, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border, ...shadows.card },
    bulleEcrit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    ecritTexte: { ...typography.bodySmall, color: C.textSec, fontSize: 12.5 },

    nomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    nom: { ...typography.overline, color: C.primary },
    badge: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },

    texte: { ...typography.body, fontSize: 14.5, lineHeight: 21 },
    texteMoi: { color: C.primaryText },
    texteElle: { color: C.primary },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs, justifyContent: 'flex-end' },
    metaHeure: { ...typography.caption, letterSpacing: 0.2 },
    heureMoi: { color: 'rgba(255,255,255,0.65)' },
    heureElle: { color: C.textMuted },

    /* ── Barre de saisie ── */
    barre: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.surfaceSolid, paddingHorizontal: spacing.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: spacing.sm, ...shadows.card },
    champWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, minHeight: 52, maxHeight: 120 },
    champ: { flex: 1, ...typography.body, fontSize: 14.5, color: C.primary, paddingVertical: Platform.OS === 'ios' ? 14 : 10, maxHeight: 100 },
    envoyer: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border, ...shadows.card },
    envoyerEteint: { backgroundColor: C.borderStrong, shadowOpacity: 0, elevation: 0, borderColor: 'transparent' },

    mention: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: C.textMuted, textAlign: 'center', paddingHorizontal: 24, paddingTop: 8, backgroundColor: C.surfaceSolid },
})
