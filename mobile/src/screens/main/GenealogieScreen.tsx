/* ═══════════════════════════════════════════════════════════
   Plan de composition de famille (Généalogie)
   Vue client de son arbre : personnes groupées par génération
   (vous → parents → grands-parents → arrière-grands-parents…).
   Lecture directe Supabase (trees.user_id = user connecté), RLS.
   Design : Nexus Emerald, anti-slop, hiérarchie générationnelle claire.
═══════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, Image,
    ActivityIndicator, Modal, RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
    ArrowLeft, User, MapPin, Calendar, TreePine, Info, X, ChevronRight, Sparkles,
} from 'lucide-react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { Download } from 'lucide-react-native'
import { toast } from '../../lib/feedback'
import { authHeaders } from '../../config/api'
import { colors as C, spacing, radius, shadows, fonts, typography } from '../../config/theme'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* expo-sharing est un module NATIF : un `import` direct fait planter l'ecran
   entier sur tout build compile avant son ajout : « Cannot find native module
   'ExpoSharing' ». On le charge donc paresseusement et on tolere son absence :
   le fichier est alors ecrit sur le telephone, sans feuille de partage. */
function chargerPartage(): { isAvailableAsync: () => Promise<boolean>; shareAsync: (u: string, o?: object) => Promise<void> } | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('expo-sharing')
    } catch {
        return null
    }
}

// Libellés de rôle (non genrés) : miroir de lib/genealogy/requirements (web).
const ROLE_LABELS: Record<string, string> = {
    self: 'Le demandeur', father: 'Père', mother: 'Mère',
    paternal_grandfather: 'Grand-père paternel', paternal_grandmother: 'Grand-mère paternelle',
    maternal_grandfather: 'Grand-père maternel', maternal_grandmother: 'Grand-mère maternelle',
}
function roleLabel(role?: string | null): string {
    if (!role) return 'Membre'
    if (ROLE_LABELS[role]) return ROLE_LABELS[role]
    if (role.startsWith('trisaieul')) return role.includes('_f') ? 'Arrière-arrière-grand-père' : 'Arrière-arrière-grand-mère'
    if (role.includes('ggf') || (role.includes('gg') && role.includes('f'))) return 'Arrière-grand-père'
    if (role.includes('ggm') || (role.includes('gg') && role.includes('m'))) return 'Arrière-grand-mère'
    if (role.includes('grandfather')) return 'Grand-père'
    if (role.includes('grandmother')) return 'Grand-mère'
    return 'Membre'
}
// Tier générationnel dérivé du rôle (robuste sans connaître la numérotation).
function tierOf(role?: string | null): number {
    if (!role) return 5
    if (role === 'self') return 0
    if (role === 'father' || role === 'mother') return 1
    if (role.startsWith('trisaieul')) return 4
    if (role.includes('gg') || role.includes('ggf') || role.includes('ggm')) return 3
    if (role.includes('grand')) return 2
    return 5
}
const TIER_TITLES = ['Vous', 'Vos parents', 'Vos grands-parents', 'Vos arrière-grands-parents', 'Générations ancestrales', 'Autres membres']

interface Person {
    id: string
    first_name?: string | null
    last_name?: string | null
    relation_role?: string | null
    avatar_url?: string | null
    is_self?: boolean | null
    birth_date?: string | null
    death_date?: string | null
    birth_place?: string | null
    place?: string | null
    notes?: string | null
    generation?: number | null
}
interface Tree { id: string; name?: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GenealogieScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [tree, setTree] = useState<Tree | null>(null)
    const [persons, setPersons] = useState<Person[]>([])
    const [selected, setSelected] = useState<Person | null>(null)
    const [telechargement, setTelechargement] = useState(false)

    /* ── Téléchargement du plan ──
       L'admin peut sortir le dossier en PDF depuis son panel ; le client ne
       le pouvait pas depuis l'application. La route serveur accepte pourtant
       un jeton client et verifie `can_read_tree` : elle etait simplement
       inutilisee cote mobile.

       Le client CONSULTE et TELECHARGE : il ne modifie rien. L'ecriture reste
       le privilege de l'admin, garanti par la meme fonction cote base. */
    const telechargerPlan = useCallback(async () => {
        if (!tree || telechargement) return
        setTelechargement(true)
        try {
            const res = await fetch(`${API_BASE}/api/genealogie/dossier-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ tree_id: tree.id, dossier_type: 'both' }),
            })
            if (!res.ok) {
                let detail = `HTTP ${res.status}`
                try { const j = await res.json(); if (j?.error) detail = j.error } catch { /* non JSON */ }
                toast(t('Téléchargement impossible'), detail)
                return
            }

            /* Le PDF arrive en binaire : on passe par le base64 parce que
               React Native n'expose pas d'API de fichier sur un Blob. */
            const buffer = await res.arrayBuffer()
            const octets = new Uint8Array(buffer)
            let binaire = ''
            for (let i = 0; i < octets.length; i++) binaire += String.fromCharCode(octets[i])
            /* `btoa` est fourni par Hermes ; on le lit sur globalThis pour ne
               dependre ni de `global` ni du polyfill Buffer de Node. */
            const encoder = (globalThis as { btoa?: (s: string) => string }).btoa
            if (!encoder) throw new Error(t('Encodage indisponible sur cet appareil'))
            const base64 = encoder(binaire)

            const chemin = `${FileSystem.cacheDirectory}Plan-de-composition-familiale.pdf`
            await FileSystem.writeAsStringAsync(chemin, base64, { encoding: FileSystem.EncodingType.Base64 })

            const partage = chargerPartage()
            if (partage && await partage.isAvailableAsync().catch(() => false)) {
                await partage.shareAsync(chemin, {
                    mimeType: 'application/pdf',
                    dialogTitle: t('Plan de composition familiale'),
                })
            } else {
                toast(t('Document enregistré'), t('Votre plan a été enregistré sur le téléphone.'))
            }
        } catch (e) {
            toast(t('Téléchargement impossible'), e instanceof Error ? e.message : t('Erreur réseau'))
        } finally {
            setTelechargement(false)
        }
    }, [tree, telechargement, t])

    const load = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setTree(null); setPersons([]); return }
            const { data: treeData } = await supabase
                .from('trees').select('id, name').eq('user_id', user.id).maybeSingle()
            if (!treeData) { setTree(null); setPersons([]); return }
            setTree(treeData)
            const { data: ppl } = await supabase
                .from('persons').select('*').eq('tree_id', treeData.id)
            setPersons(Array.isArray(ppl) ? ppl : [])
        } catch { /* rls / réseau */ }
    }, [])

    useEffect(() => { (async () => { await load(); setLoading(false) })() }, [load])

    const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false) }, [load])

    // Regroupement par génération, ordonné.
    const tiers = useMemo(() => {
        const groups = new Map<number, Person[]>()
        for (const p of persons) {
            const tr = p.is_self ? 0 : tierOf(p.relation_role)
            if (!groups.has(tr)) groups.set(tr, [])
            groups.get(tr)!.push(p)
        }
        return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
    }, [persons])

    const displayName = (p: Person) => `${p.first_name || ''} ${p.last_name || ''}`.trim() || t('Sans nom')

    return (
        <View style={styles.container}>
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
                    <Text style={styles.hTitle}>{t('Plan de composition de famille')}</Text>
                    <Text style={styles.hSub}>{t('Votre lignée, génération après génération')}</Text>
                </View>

                {/* Le client télécharge son plan, comme l'admin depuis son
                    panel. Il ne peut pas le modifier : l'écran est en lecture
                    seule, et la base le garantit indépendamment de l'interface. */}
                {tree && (
                    <Pressable
                        onPress={telechargerPlan}
                        disabled={telechargement}
                        accessibilityRole="button"
                        accessibilityLabel={t('Télécharger mon plan de composition familiale')}
                        hitSlop={10}
                        style={[styles.back, telechargement && { opacity: 0.5 }]}
                    >
                        {telechargement
                            ? <ActivityIndicator size="small" color={C.primary} />
                            : <Download size={20} color={C.primary} />}
                    </Pressable>
                )}
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
            ) : !tree ? (
                <ScrollView contentContainerStyle={styles.emptyWrap}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
                    <View style={styles.emptyIcon}><TreePine size={30} color={C.primary} /></View>
                    <Text style={styles.emptyTitle}>{t('Votre arbre est en préparation')}</Text>
                    <Text style={styles.emptyText}>
                        {t('Notre équipe généalogique constitue votre plan de composition familiale à partir de votre dossier. Il apparaîtra ici dès qu’il sera prêt.')}
                    </Text>
                </ScrollView>
            ) : (
                <ScrollView
                    contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 24 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
                >
                    <View style={styles.stat}>
                        <Sparkles size={16} color={C.primary} />
                        <Text style={styles.statText}>
                            {persons.length} {persons.length > 1 ? t('membres identifiés') : t('membre identifié')}{tree.name ? ` · ${tree.name}` : ''}
                        </Text>
                    </View>

                    {tiers.map(([tier, members]) => (
                        <View key={tier} style={styles.tier}>
                            <View style={styles.tierHead}>
                                <View style={styles.tierDot} />
                                <Text style={styles.tierTitle}>{t(TIER_TITLES[tier] || TIER_TITLES[5])}</Text>
                                <Text style={styles.tierCount}>{members.length}</Text>
                            </View>
                            {members.map(p => (
                                <Pressable key={p.id} style={styles.person} onPress={() => setSelected(p)}
                                    accessibilityRole="button"
                                    hitSlop={6}>
                                    <PersonAvatar uri={p.avatar_url} self={!!p.is_self} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.personName}>{displayName(p)}</Text>
                                        <Text style={styles.personRole}>{t(roleLabel(p.relation_role))}</Text>
                                        {(p.birth_date || p.death_date) && (
                                            <Text style={styles.personDates}>
                                                {p.birth_date ? `${t('Né(e)')} ${fmtYear(p.birth_date)}` : ''}
                                                {p.death_date ? ` · ${t('Décédé(e)')} ${fmtYear(p.death_date)}` : ''}
                                            </Text>
                                        )}
                                    </View>
                                    <ChevronRight size={18} color={C.textMuted} />
                                </Pressable>
                            ))}
                        </View>
                    ))}

                    <View style={styles.note}>
                        <Info size={14} color={C.textMuted} />
                        <Text style={styles.noteText}>{t('Un détail est incorrect ? Signalez-le à votre conseiller depuis la messagerie.')}</Text>
                    </View>
                </ScrollView>
            )}

            {/* DÉTAIL PERSONNE */}
            <Modal visible={selected !== null} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
                <View style={styles.sheetWrap}>
                    <Pressable style={styles.sheetBackdrop} onPress={() => setSelected(null)}
                        accessibilityRole="button"
                        hitSlop={6} />
                    <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                        {selected && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.sheetHandle} />
                                <View style={styles.detailHead}>
                                    <PersonAvatar uri={selected.avatar_url} self={!!selected.is_self} size={72} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.detailName}>{displayName(selected)}</Text>
                                        <Text style={styles.detailRole}>{t(roleLabel(selected.relation_role))}</Text>
                                    </View>
                                    <Pressable onPress={() => setSelected(null)} hitSlop={10}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('Fermer la fiche')}><X size={22} color={C.textMuted} /></Pressable>
                                </View>
                                <DetailRow icon={<Calendar size={15} color={C.primary} />} label={t('Naissance')}
                                    value={selected.birth_date ? fmtDate(selected.birth_date) : t('Inconnue')} />
                                {!!selected.death_date && (
                                    <DetailRow icon={<Calendar size={15} color={C.danger} />} label={t('Décès')} value={fmtDate(selected.death_date)} />
                                )}
                                {!!(selected.birth_place || selected.place) && (
                                    <DetailRow icon={<MapPin size={15} color={C.primary} />} label={t('Lieu')} value={selected.birth_place || selected.place || ''} />
                                )}
                                {!!selected.notes && (
                                    <View style={styles.notes}>
                                        <Text style={styles.notesLabel}>{t('Notes')}</Text>
                                        <Text style={styles.notesText}>{selected.notes}</Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    )
}

function fmtYear(d: string): string { const y = new Date(d).getFullYear(); return isNaN(y) ? '' : String(y) }
function fmtDate(d: string): string {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return d
    return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PersonAvatar({ uri, self, size = 48 }: { uri?: string | null; self?: boolean; size?: number }) {
    if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceWarm }} />
    return (
        <View style={{
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: self ? C.primary : C.primarySoft, alignItems: 'center', justifyContent: 'center',
        }}>
            <User size={size * 0.45} color={self ? '#fff' : C.primary} />
        </View>
    )
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <View style={styles.detailRow}>
            <View style={styles.detailIcon}>{icon}</View>
            <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topFlag: { marginHorizontal: spacing.lg, borderRadius: radius.pill, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    back: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
    hTitle: { ...typography.h2, color: C.textPrimary },
    hSub: { ...typography.bodySmall, color: C.textMuted, marginTop: 2 },

    emptyWrap: { padding: spacing.xl, alignItems: 'center', paddingTop: spacing.xxl },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
    emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: C.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
    emptyText: { fontFamily: fonts.body, fontSize: 13.5, color: C.textMuted, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

    stat: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceWarm, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 14, marginBottom: spacing.lg, borderWidth: 1, borderColor: C.borderGold },
    statText: { fontFamily: fonts.bodySemibold, fontSize: 13, color: C.textSecondary },

    tier: { marginBottom: spacing.lg },
    tierHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
    tierDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    tierTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.textPrimary, flex: 1 },
    tierCount: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.primary, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' },

    person: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: C.border, ...shadows.xs },
    personName: { fontFamily: fonts.bodyBold, fontSize: 15, color: C.textPrimary },
    personRole: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: C.primary, marginTop: 1 },
    personDates: { fontFamily: fonts.body, fontSize: 12, color: C.textMuted, marginTop: 2 },

    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 4 },
    noteText: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: C.textMuted, lineHeight: 17 },

    sheetWrap: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: C.overlay },
    sheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, maxHeight: '85%' },
    sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: spacing.md },
    detailHead: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: spacing.md },
    detailName: { fontFamily: fonts.heading, fontSize: 20, color: C.textPrimary },
    detailRole: { fontFamily: fonts.bodyMedium, fontSize: 13, color: C.primary, marginTop: 2 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.borderLight },
    detailIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
    detailLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    detailValue: { fontFamily: fonts.bodySemibold, fontSize: 14.5, color: C.textPrimary, marginTop: 1 },
    notes: { marginTop: spacing.md, backgroundColor: C.surfaceWarm, borderRadius: radius.lg, padding: spacing.md },
    notesLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: C.textPrimary, marginBottom: 4 },
    notesText: { fontFamily: fonts.body, fontSize: 13.5, color: C.textSecondary, lineHeight: 20 },
})
