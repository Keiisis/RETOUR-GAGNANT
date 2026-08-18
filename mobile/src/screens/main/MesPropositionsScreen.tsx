/* ═══════════════════════════════════════════════════════════
   Mes propositions — Smart Slides reçus dans l'application.

   Jusqu'ici une proposition ne se partageait que par LIEN SECRET : rien ne la
   rattachait à un compte, donc rien ne pouvait l'afficher dans l'application.
   Le serveur rattache désormais la proposition au client (identifiant, ou
   email du profil en repli) ; cet écran la présente.

   Le rendu de la proposition reste celui du site (/p/{secret_key}) : une seule
   mise en page à maintenir, et le client voit exactement ce que voit l'agent.
   L'écran ajoute ce que le site ne peut pas faire : signer avec la signature
   déjà enregistrée, et enchaîner sur le règlement.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useState } from 'react'
import {
    View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
    Modal, RefreshControl, Share,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import {
    ChevronLeft, X, Share2, PenLine, CreditCard, MapPin,
    CalendarDays, Presentation, CircleCheck, Eye,
} from 'lucide-react-native'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

type Etat = 'nouvelle' | 'vue' | 'signee' | 'payee'

interface Proposition {
    id: string
    secret_key: string
    destination: string | null
    start_date: string | null
    end_date: string | null
    total_amount: number | null
    currency: string | null
    status: string | null
    etat: Etat
    sent_at: string | null
    signed_at: string | null
    created_at: string
}

const ETATS: Record<Etat, { label: string; fond: string; encre: string }> = {
    nouvelle: { label: 'Nouvelle', fond: C.primarySoft, encre: C.primary },
    vue: { label: 'Consultée', fond: C.surfaceAlt, encre: C.textSec },
    signee: { label: 'Signée', fond: '#FEF7DC', encre: '#8A6D08' },
    payee: { label: 'Réglée', fond: C.primarySoft, encre: C.primary },
}

const dateFr = (iso: string | null) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }
    catch { return '' }
}

const montant = (v: number | null, devise: string | null) =>
    v && v > 0 ? `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} ${devise === 'XOF' ? 'FCFA' : (devise || '')}`.trim() : null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function MesPropositionsScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const [items, setItems] = useState<Proposition[]>([])
    const [chargement, setChargement] = useState(true)
    const [rafraichit, setRafraichit] = useState(false)
    const [ouverte, setOuverte] = useState<Proposition | null>(null)

    const charger = useCallback(async () => {
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/proposals`, {
                headers: { ...(await authHeaders()) },
                timeoutMs: 15000,
            })
            const json = await res.json().catch(() => ({}))
            setItems(Array.isArray(json.proposals) ? json.proposals : [])
        } catch { /* l'écran affiche son état vide */ }
        finally { setChargement(false); setRafraichit(false) }
    }, [])

    useEffect(() => { if (profile) charger(); else setChargement(false) }, [profile, charger])

    /* Une proposition peut arriver, être signée ou réglée pendant que l'écran
       vit : on relit au retour dessus. */
    useEffect(() => {
        const unsub = navigation?.addListener?.('focus', charger)
        return () => { if (typeof unsub === 'function') unsub() }
    }, [navigation, charger])

    const partager = async (p: Proposition) => {
        try {
            await Share.share({
                message: t('Ma proposition Retour Gagnant : {u}', { u: `${API_BASE}/p/${p.secret_key}` }),
                url: `${API_BASE}/p/${p.secret_key}`,
            })
        } catch { toast(t('Partage impossible'), t('Réessayez dans un instant.')) }
    }

    const rendre = ({ item }: { item: Proposition }) => {
        const e = ETATS[item.etat] || ETATS.nouvelle
        const prix = montant(item.total_amount, item.currency)
        return (
            <Pressable onPress={() => setOuverte(item)} style={styles.carte} accessibilityRole="button">
                <View style={styles.carteHaut}>
                    <View style={styles.tuile}>
                        <Presentation size={20} color={C.primary} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.carteTitre} numberOfLines={2}>
                            {item.destination || t('Proposition de séjour')}
                        </Text>
                        <View style={styles.metaLigne}>
                            {!!item.start_date && (
                                <View style={styles.meta}>
                                    <CalendarDays size={11} color={C.textMuted} />
                                    <Text style={styles.metaText}>{dateFr(item.start_date)}</Text>
                                </View>
                            )}
                            {!!item.destination && (
                                <View style={styles.meta}>
                                    <MapPin size={11} color={C.textMuted} />
                                    <Text style={styles.metaText} numberOfLines={1}>{item.destination}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={[styles.etat, { backgroundColor: e.fond }]}>
                        <Text style={[styles.etatText, { color: e.encre }]}>{t(e.label)}</Text>
                    </View>
                </View>

                <View style={styles.carteBas}>
                    <Text style={styles.prix}>{prix || t('Montant à préciser')}</Text>
                    <Text style={styles.ouvrir}>
                        {item.etat === 'nouvelle' ? t('Découvrir') : t('Ouvrir')}
                    </Text>
                </View>
            </Pressable>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Mes propositions')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {chargement ? (
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={i => i.id}
                    renderItem={rendre}
                    contentContainerStyle={[styles.liste, { paddingBottom: insets.bottom + 32 }]}
                    refreshControl={
                        <RefreshControl refreshing={rafraichit} onRefresh={() => { setRafraichit(true); charger() }} tintColor={C.primary} />
                    }
                    ListEmptyComponent={
                        <View style={styles.vide}>
                            <Presentation size={34} color={C.textMuted} />
                            <Text style={styles.videTitre}>{t('Aucune proposition pour l’instant')}</Text>
                            <Text style={styles.videTexte}>
                                {t('Préparez votre séjour : un conseiller vous enverra une proposition illustrée, que vous pourrez signer et régler ici même.')}
                            </Text>
                            <Pressable onPress={() => navigation.navigate('SejourRequest')} style={styles.videBtn} accessibilityRole="button">
                                <Text style={styles.videBtnText}>{t('Préparer mon séjour')}</Text>
                            </Pressable>
                        </View>
                    }
                />
            )}

            {/* Lecture de la proposition + actions */}
            <Modal visible={!!ouverte} animationType="slide" onRequestClose={() => setOuverte(null)}>
                <View style={styles.container}>
                    <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                    <View style={styles.header}>
                        <Pressable onPress={() => setOuverte(null)} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Fermer')}>
                            <X size={22} color={C.text} strokeWidth={2.2} />
                        </Pressable>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {ouverte?.destination || t('Proposition')}
                        </Text>
                        <Pressable onPress={() => ouverte && partager(ouverte)} style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Partager')}>
                            <Share2 size={19} color={C.text} strokeWidth={2} />
                        </Pressable>
                    </View>

                    {!!ouverte && (
                        <WebView
                            source={{ uri: `${API_BASE}/p/${ouverte.secret_key}` }}
                            style={{ flex: 1, backgroundColor: C.bg }}
                            startInLoadingState
                            renderLoading={() => (
                                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
                            )}
                        />
                    )}

                    <View style={[styles.pied, { paddingBottom: insets.bottom + 12 }]}>
                        {/* Signer : masqué dès que c'est fait — un devis ne se signe qu'une fois. */}
                        {!ouverte?.signed_at ? (
                            <Pressable
                                onPress={() => {
                                    const p = ouverte
                                    setOuverte(null)
                                    if (p) navigation.navigate('SignatureDevis', { proposalId: p.id, secretKey: p.secret_key })
                                }}
                                style={styles.btnPrincipal} accessibilityRole="button"
                            >
                                <PenLine size={17} color="#FFFFFF" strokeWidth={2.2} />
                                <Text style={styles.btnPrincipalText}>{t('Signer le devis')}</Text>
                            </Pressable>
                        ) : ouverte.etat !== 'payee' ? (
                            <Pressable
                                onPress={() => {
                                    const p = ouverte
                                    setOuverte(null)
                                    if (p) navigation.navigate('DevisPaiement', { secretKey: p.secret_key })
                                }}
                                style={styles.btnPrincipal} accessibilityRole="button"
                            >
                                <CreditCard size={17} color="#FFFFFF" strokeWidth={2.2} />
                                <Text style={styles.btnPrincipalText}>{t('Régler ma proposition')}</Text>
                            </Pressable>
                        ) : (
                            <View style={styles.reglee}>
                                <CircleCheck size={17} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.regleeText}>{t('Proposition réglée. Merci !')}</Text>
                            </View>
                        )}

                        <Pressable onPress={() => ouverte && partager(ouverte)} style={styles.btnSecondaire} accessibilityRole="button">
                            <Share2 size={15} color={C.primary} strokeWidth={2} />
                            <Text style={styles.btnSecondaireText}>{t('Enregistrer / Partager')}</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    liste: { paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, gap: spacing.md },

    carte: { backgroundColor: C.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: C.border, padding: spacing.md, ...shadows.card },
    carteHaut: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    tuile: { width: 42, height: 42, borderRadius: radius.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    carteTitre: { fontFamily: fonts.bold, fontSize: 15, color: C.text, lineHeight: 20 },
    metaLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
    metaText: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    etat: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    etatText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },

    carteBas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: C.border },
    prix: { fontFamily: fonts.extrabold, fontSize: 16, color: '#00643C' },
    ouvrir: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: C.primary },

    vide: { alignItems: 'center', gap: spacing.sm, paddingTop: 80, paddingHorizontal: spacing.lg },
    videTitre: { fontFamily: fonts.bold, fontSize: 16, color: C.text, marginTop: spacing.sm },
    videTexte: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', lineHeight: 19 },
    videBtn: { marginTop: spacing.md, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12 },
    videBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },

    pied: { paddingHorizontal: spacing.gutter, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, gap: 8 },
    btnPrincipal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    btnPrincipalText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' },
    btnSecondaire: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 },
    btnSecondaireText: { fontFamily: fonts.bodyBold, fontSize: 13, color: C.primary },
    reglee: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingVertical: 14 },
    regleeText: { fontFamily: fonts.bold, fontSize: 14, color: C.primary },
})
