/* ═══════════════════════════════════════════════════════════
   Mes récaps de dossier MyAfroOrigins.

   Une demande de récap se règle sur le site, mais les pièces qui la nourrissent
   sont sur le téléphone : la photo d'un courrier reçu, la capture de l'espace
   MyAfroOrigins. Les faire transiter par un ordinateur, c'était perdre la
   moitié des clients en route.

   Le compte porte déjà l'email qui lie la demande : aucune référence à
   ressaisir. Le serveur revérifie ce couple à chaque dépôt.

   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import {
    ChevronLeft, FileSearch, Paperclip, CheckCircle, Clock, Archive,
    FileText, Plus, ExternalLink,
} from 'lucide-react-native'
import { screenColors as C, radius, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const VERT_PROFOND = '#00643C'
const TAILLE_MAX = 10 * 1024 * 1024

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

const poids = (o: number | null) => {
    const n = Number(o) || 0
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function RecapMyafroScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const [recaps, setRecaps] = useState<Recap[]>([])
    const [chargement, setChargement] = useState(true)
    const [rafraichit, setRafraichit] = useState(false)
    const [depotEnCours, setDepotEnCours] = useState<string | null>(null)

    const charger = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/recaps`, {
                headers: { ...(await authHeaders()) },
                timeoutMs: 15000,
            })
            const json = await res.json().catch(() => ({}))
            setRecaps(Array.isArray(json.recaps) ? json.recaps : [])
        } catch { /* l'écran affiche son état vide */ }
        finally { setChargement(false); setRafraichit(false) }
    }, [])

    useEffect(() => { if (profile) charger(); else setChargement(false) }, [profile, charger])

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

            {chargement ? (
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger() }} tintColor={C.primary} />
                    }
                >
                    {recaps.length === 0 ? (
                        <View style={styles.vide}>
                            <View style={styles.videTuile}>
                                <FileSearch size={30} color={C.primary} strokeWidth={1.8} />
                            </View>
                            <Text style={styles.videTitre}>{t('Aucune demande de récap')}</Text>
                            <Text style={styles.videTexte}>
                                {t('Votre dossier MyAfroOrigins n’avance plus ? Nous l’analysons et vous remettons une fiche claire : ce qui bloque, ce qui manque, par quoi commencer.')}
                            </Text>
                            <Pressable
                                onPress={() => Linking.openURL(`${API_BASE}/services/recap-myafroorigins`).catch(() => undefined)}
                                style={({ pressed }) => [styles.ctaLarge, pressed && { transform: [{ scale: 0.98 }] }]}
                                accessibilityRole="button"
                            >
                                <Text style={styles.ctaLargeText}>{t('Demander mon récap')}</Text>
                                <ExternalLink size={16} color="#FFFFFF" strokeWidth={2.2} />
                            </Pressable>
                            <Text style={styles.videNote}>
                                {t('Une fois la demande réglée, elle apparaît ici et vous pouvez y joindre vos pièces.')}
                            </Text>
                        </View>
                    ) : (
                        recaps.map((r, i) => {
                            const etat = ETATS[r.statut] || ETATS.nouveau
                            return (
                                <Animated.View key={r.id} entering={FadeInDown.delay(i * 70).duration(400)} style={styles.carte}>
                                    <View style={styles.carteHaut}>
                                        <View style={styles.tuile}>
                                            <etat.Icone size={18} color={C.primary} strokeWidth={2.2} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.carteEtat}>{t(etat.label)}</Text>
                                            <Text style={styles.carteRef}>{r.reference}</Text>
                                        </View>
                                        <Text style={styles.cartePrix}>
                                            {r.montant} {r.devise === 'XOF' ? 'FCFA' : r.devise}
                                        </Text>
                                    </View>

                                    <Text style={styles.carteSituation} numberOfLines={3}>{r.situation}</Text>

                                    {/* La fiche, dès qu'elle est livrée */}
                                    {r.statut === 'recap_livre' && !!r.recap_ia && (
                                        <View style={styles.fiche}>
                                            <Text style={styles.ficheTitre}>{t('Votre fiche d’analyse')}</Text>
                                            <Text style={styles.ficheTexte}>{r.recap_ia}</Text>
                                        </View>
                                    )}

                                    {/* Pièces jointes */}
                                    <View style={styles.pieces}>
                                        <View style={styles.piecesEntete}>
                                            <Paperclip size={13} color={C.textMuted} strokeWidth={2.2} />
                                            <Text style={styles.piecesTitre}>
                                                {r.pieces.length > 0
                                                    ? t('{n} pièce(s) jointe(s)', { n: r.pieces.length })
                                                    : t('Aucune pièce jointe')}
                                            </Text>
                                        </View>

                                        {r.pieces.map(p => (
                                            <View key={p.id} style={styles.piece}>
                                                <FileText size={14} color={C.primary} strokeWidth={2.2} />
                                                <Text style={styles.pieceNom} numberOfLines={1}>{p.file_name}</Text>
                                                <Text style={styles.piecePoids}>{poids(p.file_size)}</Text>
                                            </View>
                                        ))}

                                        <Pressable
                                            onPress={() => deposer(r)}
                                            disabled={depotEnCours === r.id}
                                            style={({ pressed }) => [
                                                styles.ajouter,
                                                depotEnCours === r.id && { opacity: 0.5 },
                                                pressed && { transform: [{ scale: 0.98 }] },
                                            ]}
                                            accessibilityRole="button"
                                        >
                                            {depotEnCours === r.id
                                                ? <ActivityIndicator color={C.primary} size="small" />
                                                : <Plus size={15} color={C.primary} strokeWidth={2.6} />}
                                            <Text style={styles.ajouterText}>
                                                {depotEnCours === r.id ? t('Envoi en cours…') : t('Ajouter une pièce')}
                                            </Text>
                                        </Pressable>

                                        <Text style={styles.piecesNote}>
                                            {t('Capture de votre espace, courrier reçu, acte déjà obtenu… PDF ou image, 10 Mo max.')}
                                        </Text>
                                    </View>
                                </Animated.View>
                            )
                        })
                    )}
                </ScrollView>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    enteteTitre: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    rond: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    carte: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, gap: 12, ...shadows.card },
    carteHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    tuile: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    carteEtat: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase' },
    carteRef: { fontFamily: fonts.bold, fontSize: 13.5, color: C.text, marginTop: 2 },
    cartePrix: { fontFamily: fonts.extrabold, fontSize: 13, color: VERT_PROFOND },
    carteSituation: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: C.textSec },

    fiche: { backgroundColor: C.primarySoft, borderRadius: 14, padding: 14 },
    ficheTitre: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
    ficheTexte: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 20, color: '#00643C' },

    pieces: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, gap: 8 },
    piecesEntete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    piecesTitre: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
    piece: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceAlt, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
    pieceNom: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: C.text },
    piecePoids: { fontFamily: fonts.body, fontSize: 10.5, color: C.textMuted },
    ajouter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: 'rgba(0,135,81,0.15)', borderRadius: radius.pill, paddingVertical: 12 },
    ajouterText: { fontFamily: fonts.bold, fontSize: 12.5, color: C.primary },
    piecesNote: { fontFamily: fonts.body, fontSize: 10.5, lineHeight: 15, color: C.textMuted, textAlign: 'center' },

    vide: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 12, gap: 10 },
    videTuile: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    videTitre: { fontFamily: fonts.extrabold, fontSize: 18, color: C.text, textAlign: 'center' },
    videTexte: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: C.textSec, textAlign: 'center' },
    videNote: { fontFamily: fonts.body, fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 4 },
    ctaLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 26, paddingVertical: 15, marginTop: 10 },
    ctaLargeText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
})
