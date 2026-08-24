'use strict'
/* ═══════════════════════════════════════════════════════════
   Mes documents — l'index de tout ce qui appartient au client.

   POURQUOI CET ÉCRAN EXISTE.

   L'accueil proposait une tuile « Documents » qui menait à l'écran de
   SIGNATURE : deux notions différentes derrière un même mot. Le client qui
   cherchait une facture arrivait sur un pavé à signer, et rien, nulle part,
   ne réunissait ses pièces. Ses documents existaient pourtant — dispersés
   dans quatre écrans qu'il fallait connaître :

     · factures et devis .......... écran Factures
     · propositions de séjour ..... écran Mes propositions
     · récaps MyAfroOrigins ....... au fond du parcours du service
     · pièces déposées ............ dans la fiche du dossier concerné

   Cet écran ne DUPLIQUE aucune de ces logiques : il les indexe. Chaque
   entrée renvoie vers l'écran qui sait déjà l'afficher, la télécharger ou
   la signer. Un seul endroit pour chercher, aucun code de rendu en double
   — donc aucun risque de voir deux écrans diverger avec le temps.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList, Pressable,
    ActivityIndicator, RefreshControl, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, ChevronRight, FileText, ReceiptText, FileSignature,
    FileSearch, Paperclip, FolderOpen, FileBadge, Download,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FlagBar } from '../../components/ui'
import { toast } from '../../lib/feedback'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { fetchWithTimeout } from '../../lib/fetch'
import { aEnMemoire, avecMemoire, cleDuClient, etatMemorise } from '../../lib/memoire'
import { authHeaders } from '../../config/api'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { screenColors as C, typography, spacing, radius, shadows, fonts } from '../../config/theme'
import { localeActuelle } from '../../lib/dates'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Documents'>

type Categorie = 'livrable' | 'facture' | 'devis' | 'proposition' | 'recap' | 'piece'

interface Doc {
    id: string
    categorie: Categorie
    titre: string
    detail: string
    date: string
    /** Lien signé, court : présent quand un fichier est téléchargeable. */
    lien?: string | null
    /** Analyse rédigée par l'agence, à lire dans l'application. */
    texte?: string | null
    /** Écran de destination quand il n'y a pas de fichier. */
    cible?: string | null
    cibleId?: string | null
}

const ICONES: Record<Categorie, typeof FileText> = {
    livrable: FileBadge,
    facture: ReceiptText,
    devis: FileSignature,
    proposition: FileText,
    recap: FileSearch,
    piece: Paperclip,
}

const LIBELLES: Record<Categorie, string> = {
    livrable: 'Fiche d’analyse',
    facture: 'Facture',
    devis: 'Devis',
    proposition: 'Proposition',
    recap: 'Récap MyAfroOrigins',
    piece: 'Pièce déposée',
}

/* Filtres. « Tout » d'abord : c'est la raison d'être de l'écran. */
const FILTRES: Array<{ cle: 'tout' | Categorie; libelle: string }> = [
    { cle: 'tout', libelle: 'Tout' },
    { cle: 'livrable', libelle: 'Analyses' },
    { cle: 'facture', libelle: 'Factures' },
    { cle: 'devis', libelle: 'Devis' },
    { cle: 'proposition', libelle: 'Propositions' },
    { cle: 'recap', libelle: 'Récaps' },
    { cle: 'piece', libelle: 'Pièces' },
]

function formaterDate(iso: string, t: (s: string) => string): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const jours = Math.floor((Date.now() - d.getTime()) / 86400000)
    if (jours === 0) return t('Aujourd’hui')
    if (jours === 1) return t('Hier')
    return d.toLocaleDateString(localeActuelle(), { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocumentsScreen({ navigation }: { navigation: Nav }) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()

    const cle = cleDuClient(profile?.id, 'mes-documents')
    const [docs, setDocs] = useState<Doc[]>(() => etatMemorise<Doc[]>(cle, []))
    const [chargement, setChargement] = useState(() => !aEnMemoire(cle))
    const [rafraichit, setRafraichit] = useState(false)
    const [filtre, setFiltre] = useState<'tout' | Categorie>('tout')

    /* UNE seule route, côté serveur, qui rassemble les cinq sources.
       L'écran interrogeait d'abord quatre routes et recollait les morceaux
       ici ; chaque nouveau type de document imposait alors de modifier
       l'application, donc un build et une attente. Et les livrables de
       l'agence — les fiches d'analyse — n'y figuraient pas, faute d'exister
       en base. Le serveur décide désormais de ce qui appartient au client ;
       l'écran ne fait que l'afficher. */
    const rassembler = useCallback(async (): Promise<Doc[]> => {
        const res = await fetchWithTimeout(`${API_BASE}/api/mobile/documents`, {
            headers: { ...(await authHeaders()) },
            timeoutMs: 20000,
        })
        if (!res.ok) return []
        const json = await res.json().catch(() => ({}))
        return Array.isArray(json.documents) ? json.documents as Doc[] : []
    }, [])

    const charger = useCallback(async () => {
        await avecMemoire<Doc[]>(cle, rassembler, (liste) => {
            setDocs(liste)
            setChargement(false)
        })
        setChargement(false)
        setRafraichit(false)
    }, [cle, rassembler])

    useEffect(() => {
        if (profile) charger()
        else setChargement(false)
    }, [profile, charger])

    const visibles = useMemo(
        () => filtre === 'tout' ? docs : docs.filter(d => d.categorie === filtre),
        [docs, filtre],
    )

    /* Deux comportements, décidés par la DONNÉE et non par la catégorie :
         · un fichier existe  → on l'ouvre (lien signé, valable 10 minutes) ;
         · sinon              → on renvoie vers l'écran qui sait le traiter.

       Décider sur `lien` plutôt que sur `categorie` évite d'avoir à toucher
       cet écran le jour où un nouveau type de livrable apparaîtra : s'il
       porte un fichier, il s'ouvrira. */
    const ouvrir = useCallback((d: Doc) => {
        if (d.lien) {
            Linking.openURL(d.lien).catch(() => {
                toast(t('Ouverture impossible'), t('Réessayez dans un instant.'))
            })
            return
        }
        if (d.cible === 'PropositionDetail' && d.cibleId) {
            navigation.navigate('PropositionDetail', { proposalId: d.cibleId })
            return
        }
        if (d.cible === 'Invoices') { navigation.navigate('Invoices'); return }
        if (d.cible === 'RecapMyafroDemande') { navigation.navigate('RecapMyafroDemande'); return }
        if (d.categorie === 'piece') {
            /* « Dossier » est un ONGLET, pas un écran de la pile : on passe par
               le navigateur d'onglets, sinon la route reste introuvable. */
            navigation.navigate('Main', { screen: 'Dossier' } as never)
        }
    }, [navigation, t])

    const compteur = useCallback(
        (cleFiltre: 'tout' | Categorie) => cleFiltre === 'tout' ? docs.length : docs.filter(d => d.categorie === cleFiltre).length,
        [docs],
    )

    return (
        <View style={styles.conteneur}>
            <View style={{ paddingTop: insets.top }}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.entete}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.boutonRond}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('Retour')}
                >
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.enteteTitre}>{t('Mes documents')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Filtres : chaque puce annonce son compte, pour qu'un onglet
                vide se voie AVANT d'être ouvert. */}
            <View style={styles.filtres}>
                <FlatList
                    data={FILTRES}
                    keyExtractor={f => f.cle}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filtresRangee}
                    renderItem={({ item }) => {
                        const actif = filtre === item.cle
                        const n = compteur(item.cle)
                        return (
                            <Pressable
                                onPress={() => setFiltre(item.cle)}
                                style={[styles.puce, actif && styles.puceActive]}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: actif }}
                                accessibilityLabel={`${t(item.libelle)}, ${n}`}
                            >
                                <Text style={[styles.puceTexte, actif && styles.puceTexteActif]}>
                                    {t(item.libelle)}{n > 0 ? ` · ${n}` : ''}
                                </Text>
                            </Pressable>
                        )
                    }}
                />
            </View>

            {chargement ? (
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            ) : (
                <FlatList
                    data={visibles}
                    keyExtractor={d => d.id}
                    contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + 100 }]}
                    refreshControl={
                        <RefreshControl
                            refreshing={rafraichit}
                            onRefresh={() => { setRafraichit(true); charger() }}
                            tintColor={C.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.vide}>
                            <View style={styles.videTuile}>
                                <FolderOpen size={26} color={C.primary} strokeWidth={1.8} />
                            </View>
                            <Text style={styles.videTitre}>
                                {filtre === 'tout' ? t('Aucun document pour l’instant') : t('Rien dans cette catégorie')}
                            </Text>
                            <Text style={styles.videTexte}>
                                {t('Vos factures, devis, récaps et pièces déposées apparaîtront ici au fur et à mesure.')}
                            </Text>
                        </View>
                    }
                    renderItem={({ item, index }) => {
                        const Icone = ICONES[item.categorie]
                        return (
                            <Animated.View entering={FadeInUp.duration(280).delay(Math.min(index, 8) * 40)}>
                                <Pressable
                                    onPress={() => ouvrir(item)}
                                    style={({ pressed }) => [styles.carte, pressed && styles.cartePressee]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t(LIBELLES[item.categorie])} — ${item.titre}`}
                                >
                                    <View style={styles.tuile}>
                                        <Icone size={19} color={C.primary} strokeWidth={2} />
                                    </View>
                                    <View style={styles.corps}>
                                        <Text style={styles.categorie}>{t(LIBELLES[item.categorie])}</Text>
                                        <Text style={styles.titre} numberOfLines={1}>{item.titre}</Text>
                                        {!!item.detail && (
                                            <Text style={styles.detail} numberOfLines={1}>{item.detail}</Text>
                                        )}
                                    </View>
                                    <View style={styles.fin}>
                                        <Text style={styles.date}>{formaterDate(item.date, t)}</Text>
                                        {/* L'icône annonce ce qui va se passer : une flèche
                                            mène ailleurs, un téléchargement ouvre un fichier. */}
                                        {item.lien
                                            ? <Download size={18} color={C.primary} strokeWidth={2} />
                                            : <ChevronRight size={18} color={C.textMuted} strokeWidth={2} />}
                                    </View>
                                </Pressable>
                            </Animated.View>
                        )
                    }}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    conteneur: { flex: 1, backgroundColor: C.bg },

    entete: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        gap: spacing.sm, paddingHorizontal: spacing.gutter,
        paddingTop: spacing.md, paddingBottom: spacing.sm,
    },
    enteteTitre: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    boutonRond: {
        width: 40, height: 40, borderRadius: radius.pill,
        borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center',
    },

    filtres: { paddingBottom: spacing.sm },
    filtresRangee: { paddingHorizontal: spacing.gutter, gap: spacing.sm },
    puce: {
        paddingHorizontal: 14, minHeight: 36, paddingVertical: 8,
        borderRadius: radius.pill, backgroundColor: C.surface,
        borderWidth: 1, borderColor: C.border, justifyContent: 'center',
    },
    puceActive: { backgroundColor: C.primary, borderColor: C.primary },
    puceTexte: { ...typography.label, fontSize: 12.5, color: C.textSec },
    puceTexteActif: { color: C.primaryText },

    liste: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xs, gap: spacing.sm },

    carte: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: C.surface, borderRadius: radius.lg,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: spacing.md, paddingVertical: 14,
        ...shadows.card,
    },
    cartePressee: { backgroundColor: C.surfaceAlt },
    tuile: {
        width: 42, height: 42, borderRadius: radius.md,
        backgroundColor: C.primarySoft,
        alignItems: 'center', justifyContent: 'center',
    },
    corps: { flex: 1, gap: 2 },
    categorie: {
        ...typography.overline, fontSize: 11, color: C.primary, letterSpacing: 0.8,
    },
    titre: { fontFamily: fonts.bold, fontSize: 14.5, color: C.text },
    detail: { ...typography.caption, fontSize: 12, color: C.textMuted },
    fin: { alignItems: 'flex-end', gap: 4 },
    date: { ...typography.caption, fontSize: 11, color: C.textMuted },

    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    vide: { alignItems: 'center', paddingTop: 72, paddingHorizontal: spacing.xl, gap: spacing.sm },
    videTuile: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: C.primarySoft,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.border, marginBottom: spacing.sm,
    },
    videTitre: { ...typography.h3, fontSize: 17, color: C.text, textAlign: 'center' },
    videTexte: { ...typography.body, fontSize: 13.5, lineHeight: 20, color: C.textSec, textAlign: 'center' },
})
