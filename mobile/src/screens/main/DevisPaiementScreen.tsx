/* ═══════════════════════════════════════════════════════════
   Règlement d'une proposition de séjour — 5 états NATIFS.

   Cet écran chargeait /p/{secret}/paiement dans une WebView : fil d'Ariane,
   bulles de chat flottantes, bouton de son, champs coupés au milieu de
   l'écran. On payait dans un site, pas dans l'application.

   Ici tout est natif, et le parcours suit exactement la mécanique serveur
   déjà éprouvée sur le web :
     1. /api/checkout (is_proposal) crée la commande — le serveur RECALCULE le
        montant depuis ai_proposal_items, le total envoyé n'est qu'un contrôle ;
     2. le widget Kkiapay natif encaisse en XOF (la seule devise qu'il accepte) ;
     3. /api/checkout/verify interroge Kkiapay : sans transaction confirmée,
        rien n'est validé ;
     4. /api/ai/proposal-paid marque la proposition réglée — cette route exige
        une commande encaissée, elle refuse un simple POST.
   Un échec appelle /api/checkout/cancel : pas de commande fantôme en base.

   Carte bancaire et PayPal n'ont pas de SDK natif dans l'application : leurs
   lignes ouvrent la page sécurisée, en le disant clairement.

   Portage de l'export Sleek (Récapitulatif / Moyens / En cours / Succès /
   Échec). Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal,
    ActivityIndicator, Linking, Platform, KeyboardAvoidingView,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
    ChevronLeft, ChevronRight, Lock, Calendar, Users, Bed, UtensilsCrossed,
    Camera, Car, Sparkles, ShieldCheck, ArrowUpRight, User, Mail, Phone,
    Smartphone, CreditCard, Wallet, X, Check, AlertCircle, RotateCw,
    Headphones, FileText, ArrowLeft, UserCheck,
} from 'lucide-react-native'
import Animated, {
    FadeIn, FadeInDown, FadeInUp, Easing,
    useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated'
import { screenColors as C, radius, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import KkiapayModal from '../../components/KkiapayModal'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'
import { ttcFromHt } from '../../lib/tax'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'
const VERT_PROFOND = '#00643C'
const VERT_LISERE = 'rgba(0,135,81,0.15)'
const ROUGE = C.danger
const ROUGE_DOUX = C.dangerSoft
const AGENCE_TEL = '+2290160322121'

type Etat = 'recap' | 'encours' | 'succes' | 'echec'
type Moyen = 'kkiapay' | 'carte' | 'paypal'

interface Prestation {
    id: string
    type: string | null
    title: string | null
    selling_price: number | null
}

interface Proposition {
    id: string
    secret_key: string
    client_name: string | null
    destination: string | null
    start_date: string | null
    end_date: string | null
    currency: string | null
    status: string | null
    nb_voyageurs?: number | null
}

const ICONES: Record<string, typeof Bed> = {
    hotel: Bed, hebergement: Bed, restaurant: UtensilsCrossed,
    activity: Camera, activite: Camera, transport: Car,
}
const iconeDe = (t: string | null) => ICONES[String(t || '').toLowerCase()] || Sparkles

const somme = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0)

const SYMBOLES: Record<string, string> = { XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const money = (v: number, devise: string) => {
    const n = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: devise === 'XOF' ? 0 : 2,
        maximumFractionDigits: devise === 'XOF' ? 0 : 2,
    }).format(devise === 'XOF' ? Math.round(v) : v)
    return devise === 'USD' ? `$${n}` : `${n} ${SYMBOLES[devise] || devise}`
}

const dateFr = (iso: string | null) => {
    if (!iso) return null
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return null }
}

/* ── L'attente : un anneau qui respire, pas un sablier ── */
function Anneau() {
    const p = useSharedValue(0)
    useEffect(() => {
        p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false)
    }, [p])
    const style = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + p.value * 0.45 }],
        opacity: 0.55 * (1 - p.value),
    }))
    return <Animated.View style={[styles.anneauOnde, style]} />
}

/* ── La coche du succès : elle se pose, elle n'apparaît pas ── */
function CocheSucces() {
    const e = useSharedValue(0)
    useEffect(() => {
        e.value = withSequence(
            withTiming(1.14, { duration: 320, easing: Easing.out(Easing.back(2)) }),
            withTiming(1, { duration: 180 }),
        )
    }, [e])
    const style = useAnimatedStyle(() => ({ transform: [{ scale: e.value }] }))
    return (
        <Animated.View style={[styles.succesCercle, style]}>
            <View style={styles.succesDisque}>
                <Check size={32} color="#FFFFFF" strokeWidth={3} />
            </View>
        </Animated.View>
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DevisPaiementScreen({ navigation, route }: { navigation: any; route: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const proposalId: string | undefined = route?.params?.proposalId
    const secretKey: string | undefined = route?.params?.secretKey
    const selection: string[] | undefined = route?.params?.selection

    const [prop, setProp] = useState<Proposition | null>(null)
    const [prestations, setPrestations] = useState<Prestation[]>([])
    const [taux, setTaux] = useState<Record<string, number>>({ XOF: 1 })
    const [passerelles, setPasserelles] = useState<Record<string, string>>({})
    const [chargement, setChargement] = useState(true)
    const [erreurChargement, setErreurChargement] = useState('')

    const [etat, setEtat] = useState<Etat>('recap')
    const [feuille, setFeuille] = useState(false)
    const [moyen, setMoyen] = useState<Moyen>('kkiapay')
    const [afficheDevise, setAfficheDevise] = useState('XOF')

    const [nom, setNom] = useState('')
    const [email, setEmail] = useState('')
    const [tel, setTel] = useState('')

    const [kkiapayVisible, setKkiapayVisible] = useState(false)
    const [etape, setEtape] = useState(1)          // 1 autorisation · 2 vérification · 3 confirmation
    const [reference, setReference] = useState('')
    const [motif, setMotif] = useState('')
    const orderRef = useRef<string | null>(null)

    /* ── Chargement : proposition, taux, passerelles ─────────── */
    const charger = useCallback(async () => {
        setChargement(true); setErreurChargement('')
        try {
            const entetes = await authHeaders()
            const [rProp, rTaux, rPay] = await Promise.all([
                proposalId
                    ? fetchWithTimeout(`${API_BASE}/api/mobile/proposals/${proposalId}`, { headers: entetes, timeoutMs: 15000 })
                    : Promise.resolve(null),
                fetchWithTimeout(`${API_BASE}/api/settings/currency`, { timeoutMs: 12000 }).catch(() => null),
                fetchWithTimeout(`${API_BASE}/api/settings/payment`, { timeoutMs: 12000 }).catch(() => null),
            ])

            if (!rProp) throw new Error('Proposition inconnue.')
            const jProp = await rProp.json().catch(() => ({}))
            if (!rProp.ok) throw new Error(jProp.error || `Chargement impossible (erreur ${rProp.status}).`)

            setProp(jProp.proposal)
            const liste: Prestation[] = Array.isArray(jProp.prestations) ? jProp.prestations : []
            setPrestations(liste)

            if (rTaux) {
                const jt = await rTaux.json().catch(() => [])
                // `exchange_rate_to_base` = combien de XOF valent 1 unité.
                const m: Record<string, number> = { XOF: 1 }
                for (const c of Array.isArray(jt) ? jt : []) {
                    const code = String(c.code || '').toUpperCase()
                    const r = c.is_base ? 1 : Number(c.exchange_rate_to_base)
                    if (code && isFinite(r) && r > 0) m[code] = r
                }
                setTaux(m)
            }
            if (rPay) {
                const jp = await rPay.json().catch(() => ({}))
                setPasserelles(jp && typeof jp === 'object' ? jp : {})
            }
        } catch (e) {
            setErreurChargement(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [proposalId])

    useEffect(() => { charger() }, [charger])

    // Coordonnées pré-remplies : le client ne doit pas ressaisir ce que son
    // compte contient déjà.
    useEffect(() => {
        if (!profile) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = profile as any
        setNom(n => n || `${p.prenom || ''} ${p.nom || ''}`.trim())
        setEmail(e => e || p.email || '')
        setTel(t2 => t2 || p.telephone || p.phone || '')
    }, [profile])

    /* ── Montants ────────────────────────────────────────────── */
    const devise = (prop?.currency || 'XOF').toUpperCase()

    // Le serveur n'accepte QUE des prestations facturables (prix > 0) dans
    // `selected_item_ids` : y glisser une prestation « comprise » ferait
    // rejeter toute la commande.
    const retenues = useMemo(() => {
        const garde = selection && selection.length ? new Set(selection) : null
        return prestations.filter(p => (garde ? garde.has(p.id) : true) && somme(p.selling_price) > 0)
    }, [prestations, selection])

    const totalHt = useMemo(() => retenues.reduce((s, p) => s + somme(p.selling_price), 0), [retenues])
    const totalTtc = useMemo(() => ttcFromHt(totalHt), [totalHt])

    // Kkiapay n'encaisse que le franc CFA : on convertit avec les taux réels.
    const tauxDevise = taux[devise]
    const totalXof = useMemo(() => {
        if (devise === 'XOF') return Math.round(totalTtc)
        if (!tauxDevise) return null
        return Math.round(totalTtc * tauxDevise)
    }, [devise, totalTtc, tauxDevise])

    const equivalent = useMemo(() => {
        if (afficheDevise === 'XOF' || totalXof === null) return null
        const r = taux[afficheDevise]
        if (!r) return null
        return money(Math.round((totalXof / r) * 100) / 100, afficheDevise)
    }, [afficheDevise, totalXof, taux])

    /* ── Paiement ────────────────────────────────────────────── */
    const creerCommande = async (methode: string): Promise<string | null> => {
        if (!prop) return null
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 25000,
                body: JSON.stringify({
                    product_id: prop.id,
                    product_title: `Séjour ${prop.destination || 'Bénin'} - ${prop.client_name || nom}`,
                    is_proposal: true,
                    quantity: 1,
                    amount: totalTtc,
                    selected_item_ids: retenues.map(p => p.id),
                    currency: devise,
                    customer_name: nom.trim(),
                    customer_email: email.trim(),
                    customer_phone: tel.trim(),
                    payment_method: methode,
                    shipping_zone: 'digital',
                    shipping_fee: 0,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!json.order_id) throw new Error(json.error || 'Création de commande impossible.')
            orderRef.current = String(json.order_id)
            return orderRef.current
        } catch (e) {
            setMotif(e instanceof Error ? e.message : 'Création de commande impossible.')
            setEtat('echec')
            return null
        }
    }

    const annulerCommande = async (oid: string) => {
        try {
            await fetchWithTimeout(`${API_BASE}/api/checkout/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 12000,
                body: JSON.stringify({ order_id: oid }),
            })
        } catch { /* la commande restera « pending », sans effet comptable */ }
    }

    const lancerKkiapay = async () => {
        if (!nom.trim() || !email.trim() || !tel.trim()) {
            toast(t('Coordonnées incomplètes'), t('Nom, email et téléphone sont nécessaires pour le reçu.'))
            return
        }
        if (totalXof === null) {
            toast(t('Devise non convertible'), t('Le taux de change est indisponible. Utilisez la page sécurisée.'))
            return
        }
        setFeuille(false)
        const oid = await creerCommande('kkiapay')
        if (!oid) return
        setKkiapayVisible(true)
    }

    /* Kkiapay a rendu un identifiant de transaction : il ne prouve rien tant
       que le serveur ne l'a pas confronté à la passerelle. */
    const surTransaction = async (transactionId: string) => {
        setKkiapayVisible(false)
        setReference(transactionId)
        setEtape(1)
        setEtat('encours')
        const oid = orderRef.current
        if (!oid) { setMotif('Commande introuvable.'); setEtat('echec'); return }

        try {
            setEtape(2)
            const res = await fetchWithTimeout(`${API_BASE}/api/checkout/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 30000,
                body: JSON.stringify({ order_id: oid, transaction_id: transactionId, payment_method: 'kkiapay' }),
            })
            const json = await res.json().catch(() => ({}))
            if (!json.success) throw new Error(json.error || 'Vérification refusée par la passerelle.')

            setEtape(3)
            // Marque la proposition réglée : la route refuse si aucune commande
            // encaissée n'existe, l'appel ne peut donc pas mentir.
            await fetchWithTimeout(`${API_BASE}/api/ai/proposal-paid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeoutMs: 25000,
                body: JSON.stringify({ proposal_id: prop?.id, client_email: email.trim(), client_name: nom.trim() }),
            }).catch(() => undefined)

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
            setEtat('succes')
        } catch (e) {
            await annulerCommande(oid)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
            setMotif(e instanceof Error ? e.message : 'Vérification impossible.')
            setEtat('echec')
        }
    }

    const ouvrirPageSecurisee = async () => {
        setFeuille(false)
        const cle = secretKey || prop?.secret_key
        if (!cle) { toast(t('Lien indisponible'), t('Contactez votre conseiller.')); return }
        Linking.openURL(`${API_BASE}/p/${cle}/paiement`).catch(() =>
            toast(t('Ouverture impossible'), t('Réessayez dans un instant.')))
    }

    /* ── États de chargement / erreur ────────────────────────── */
    if (chargement) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.centre}><ActivityIndicator color={C.primary} size="large" /></View>
            </View>
        )
    }

    if (erreurChargement || !prop) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.centre}>
                    <Text style={styles.erreur}>{erreurChargement || t('Proposition introuvable.')}</Text>
                    <Pressable onPress={() => navigation.goBack()} style={styles.ctaPlein} accessibilityRole="button">
                        <Text style={styles.ctaPleinText}>{t('Retour')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    const voyageurs = Math.max(1, Number(prop.nb_voyageurs) || 1)
    const periode = [dateFr(prop.start_date), dateFr(prop.end_date)].filter(Boolean).join(' au ')
    const montantAffiche = totalXof !== null ? money(totalXof, 'XOF') : money(totalTtc, devise)

    /* ══ EN COURS ══ */
    if (etat === 'encours') {
        const etapes = [
            { n: 1, titre: 'Autorisation de débit', sous: 'Demande transmise à la passerelle' },
            { n: 2, titre: 'Vérification', sous: 'Contrôle serveur de la transaction' },
            { n: 3, titre: 'Confirmation du séjour', sous: 'Facture et reçu' },
        ]
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.centreHaut}>
                    <Text style={styles.overline}>{t('Transaction sécurisée')}</Text>
                    <Text style={styles.sousEntete}>{t('Retour Gagnant Bénin · Mobile Money')}</Text>
                </View>

                <View style={styles.centreCorps}>
                    <View style={styles.anneauBloc}>
                        <Anneau />
                        <View style={styles.anneauCercle}>
                            <View style={styles.anneauDisque}>
                                <Smartphone size={32} color={C.primary} strokeWidth={2.2} />
                            </View>
                        </View>
                    </View>

                    <Animated.Text entering={FadeInUp.duration(400)} style={styles.grandMontant}>
                        {montantAffiche}
                    </Animated.Text>
                    <Text style={styles.titreEtat}>{t('Paiement en cours de traitement')}</Text>
                    <Text style={styles.texteEtat}>
                        {t('Validez la demande reçue sur votre téléphone avec votre code secret Mobile Money.')}
                    </Text>

                    <View style={styles.etapes}>
                        {etapes.map((e, i) => {
                            const fait = etape > e.n
                            const actif = etape === e.n
                            return (
                                <View key={e.n}>
                                    {i > 0 && <View style={[styles.etapeTrait, etape >= e.n && styles.etapeTraitOn]} />}
                                    <View style={[styles.etapeLigne, !fait && !actif && { opacity: 0.5 }]}>
                                        <View style={[
                                            styles.etapePastille,
                                            (fait || actif) && styles.etapePastilleOn,
                                            actif && styles.etapePastilleActive,
                                        ]}>
                                            {fait
                                                ? <Check size={14} color="#FFFFFF" strokeWidth={3} />
                                                : actif
                                                    ? <View style={styles.etapePoint} />
                                                    : <Text style={styles.etapeNum}>{e.n}</Text>}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.etapeTitre, actif && { color: C.primary }]}>
                                                {e.n}. {t(e.titre)}
                                            </Text>
                                            <Text style={styles.etapeSous}>{t(e.sous)}</Text>
                                        </View>
                                    </View>
                                </View>
                            )
                        })}
                    </View>
                </View>

                <View style={[styles.centreBas, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.avertissement}>
                        <AlertCircle size={14} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.avertissementText}>{t('Ne quittez pas cet écran pendant la validation.')}</Text>
                    </View>
                    <Text style={styles.petitGris}>{t('Délai estimé : 10 à 30 secondes')}</Text>
                </View>
            </View>
        )
    }

    /* ══ SUCCÈS ══ */
    if (etat === 'succes') {
        const maintenant = new Date().toLocaleString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.centreHaut}>
                    <Text style={styles.overline}>{t('Confirmation officielle')}</Text>
                </View>

                <ScrollView contentContainerStyle={styles.centreCorpsScroll} showsVerticalScrollIndicator={false}>
                    <CocheSucces />

                    <Animated.Text entering={FadeInDown.delay(180).duration(420)} style={styles.overlineVert}>
                        {t('Paiement validé')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInDown.delay(240).duration(420)} style={styles.titreSucces}>
                        {t('Votre séjour est confirmé')}
                    </Animated.Text>
                    <Animated.Text entering={FadeInUp.delay(300).duration(420)} style={styles.grandMontant}>
                        {montantAffiche}
                    </Animated.Text>

                    <Animated.View entering={FadeInDown.delay(360).duration(420)} style={styles.carteBlanche}>
                        <View style={styles.ligneCarte}>
                            <Text style={styles.ligneLabel}>{t('Référence transaction')}</Text>
                            <Text style={styles.ligneMono}>{reference || '—'}</Text>
                        </View>
                        <View style={[styles.ligneCarte, styles.ligneSep]}>
                            <Text style={styles.ligneLabel}>{t('Mode de règlement')}</Text>
                            <View style={styles.ligneValeurIcone}>
                                <Smartphone size={14} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.ligneValeur}>{t('Mobile Money')}</Text>
                            </View>
                        </View>
                        <View style={[styles.ligneCarte, styles.ligneSep]}>
                            <Text style={styles.ligneLabel}>{t('Date & heure')}</Text>
                            <Text style={styles.ligneValeur}>{maintenant}</Text>
                        </View>
                        <View style={[styles.ligneCarte, styles.ligneSep]}>
                            <Text style={styles.ligneLabel}>{t('Séjour')}</Text>
                            <Text style={styles.ligneValeurVerte} numberOfLines={1}>
                                {prop.destination || t('Bénin')}
                            </Text>
                        </View>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(420).duration(420)} style={styles.carteGrise}>
                        <View style={styles.tuileRonde}>
                            <UserCheck size={16} color={C.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.carteGriseText}>
                            <Text style={styles.gras}>{t('Prochaine étape :')} </Text>
                            {t('votre conseiller a reçu la confirmation et engage vos réservations auprès des partenaires. Le reçu part par email.')}
                        </Text>
                    </Animated.View>
                </ScrollView>

                <View style={[styles.centreBas, { paddingBottom: insets.bottom + 16 }]}>
                    <Pressable
                        onPress={() => navigation.navigate('Invoices')}
                        style={({ pressed }) => [styles.ctaPlein, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <FileText size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.ctaPleinText}>{t('Voir ma facture')}</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={({ pressed }) => [styles.ctaVide, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <ArrowLeft size={16} color={C.text} strokeWidth={2.2} />
                        <Text style={styles.ctaVideText}>{t('Retour à mon séjour')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    /* ══ ÉCHEC ══ */
    if (etat === 'echec') {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

                <View style={styles.centreHaut}>
                    <Text style={styles.overlineGris}>{t('Statut du règlement')}</Text>
                </View>

                <ScrollView contentContainerStyle={styles.centreCorpsScroll} showsVerticalScrollIndicator={false}>
                    <Animated.View entering={FadeIn.duration(360)} style={styles.echecCercle}>
                        <View style={styles.echecDisque}>
                            <X size={30} color="#FFFFFF" strokeWidth={3} />
                        </View>
                    </Animated.View>

                    <Text style={styles.overlineRouge}>{t('Échec de la transaction')}</Text>
                    <Text style={styles.titreSucces}>{t('Le paiement n’a pas abouti')}</Text>
                    <Text style={styles.texteEtat}>
                        {t('Aucun montant n’a été validé de notre côté. Si votre compte a été débité, la transaction sera automatiquement annulée par la passerelle.')}
                    </Text>

                    <View style={styles.carteGriseBloc}>
                        <View style={styles.ligneCarte}>
                            <Text style={styles.ligneLabel}>{t('Motif signalé')}</Text>
                            <Text style={styles.ligneRouge} numberOfLines={2}>{motif || t('Transaction non confirmée')}</Text>
                        </View>
                        <View style={[styles.ligneCarte, styles.ligneSep]}>
                            <Text style={styles.ligneLabel}>{t('Moyen utilisé')}</Text>
                            <Text style={styles.ligneValeur}>{t('Mobile Money')}</Text>
                        </View>
                        <View style={[styles.ligneCarte, styles.ligneSep]}>
                            <Text style={styles.ligneLabel}>{t('Montant à régler')}</Text>
                            <Text style={styles.ligneValeurForte}>{montantAffiche}</Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => Linking.openURL(`tel:${AGENCE_TEL}`).catch(() => undefined)}
                        style={styles.carteBlancheAide}
                        accessibilityRole="button"
                    >
                        <View style={styles.tuileRonde}>
                            <Headphones size={16} color={C.primary} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.carteGriseText}>
                            {t('Besoin d’aide ? Le cabinet reste joignable au ')}
                            <Text style={styles.gras}>{AGENCE_TEL}</Text>
                            {t(' ou par la messagerie de l’application.')}
                        </Text>
                    </Pressable>
                </ScrollView>

                <View style={[styles.centreBas, { paddingBottom: insets.bottom + 16 }]}>
                    <Pressable
                        onPress={() => { setMotif(''); setEtat('recap'); setFeuille(true) }}
                        style={({ pressed }) => [styles.ctaPlein, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <RotateCw size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.ctaPleinText}>{t('Réessayer le paiement')}</Text>
                    </Pressable>
                    <Pressable
                        onPress={ouvrirPageSecurisee}
                        style={({ pressed }) => [styles.ctaVide, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <Wallet size={16} color={C.text} strokeWidth={2.2} />
                        <Text style={styles.ctaVideText}>{t('Choisir un autre moyen')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    /* ══ RÉCAPITULATIF ══ */
    const complet = !!nom.trim() && !!email.trim() && !!tel.trim()

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.entete}>
                <Pressable onPress={() => navigation.goBack()} style={styles.rond} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}>
                    <ChevronLeft size={20} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.enteteTitre}>{t('Régler mon séjour')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Le séjour, verrouillé : ici on confirme, on ne choisit plus. */}
                    <Animated.View entering={FadeInDown.duration(420)} style={styles.carteSejour}>
                        <View style={styles.sejourHaut}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.overline}>{t('Séjour sur-mesure')}</Text>
                                <Text style={styles.sejourTitre} numberOfLines={2}>
                                    {prop.destination || t('Bénin')}
                                </Text>
                            </View>
                            <View style={styles.pastilleValide}>
                                <Lock size={12} color={C.primary} strokeWidth={2.4} />
                                <Text style={styles.pastilleValideText}>{t('Validé')}</Text>
                            </View>
                        </View>

                        <View style={styles.sejourMeta}>
                            {!!periode && (
                                <View style={styles.metaItem}>
                                    <Calendar size={13} color={C.primary} strokeWidth={2.2} />
                                    <Text style={styles.metaText}>{periode}</Text>
                                </View>
                            )}
                            <View style={styles.metaItem}>
                                <Users size={13} color={C.primary} strokeWidth={2.2} />
                                <Text style={styles.metaText}>
                                    {voyageurs > 1 ? t('{n} voyageurs', { n: voyageurs }) : t('1 voyageur')}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.sejourListe}>
                            {retenues.map(p => {
                                const Icone = iconeDe(p.type)
                                return (
                                    <View key={p.id} style={styles.sejourLigne}>
                                        <Icone size={14} color={C.primary} strokeWidth={2.2} />
                                        <Text style={styles.sejourLigneNom} numberOfLines={1}>
                                            {p.title || t('Prestation')}
                                        </Text>
                                        <Text style={styles.sejourLignePrix}>
                                            {money(somme(p.selling_price), devise)}
                                        </Text>
                                    </View>
                                )
                            })}
                        </View>

                        <Pressable onPress={() => navigation.goBack()} style={styles.lienModifier} accessibilityRole="button">
                            <Text style={styles.lienModifierText}>{t('Modifier ma sélection')}</Text>
                            <ArrowUpRight size={12} color={C.primary} strokeWidth={2.4} />
                        </Pressable>
                    </Animated.View>

                    {/* Le montant : FCFA est la devise débitée, le reste informe. */}
                    <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.carteMontant}>
                        <View style={styles.montantHaut}>
                            <Text style={styles.overlineGris}>{t('Montant total du séjour')}</Text>
                            <View style={styles.selecteur}>
                                {['XOF', 'EUR', 'USD', 'GBP'].map(d => (
                                    <Pressable
                                        key={d}
                                        onPress={() => setAfficheDevise(d)}
                                        style={[styles.selecteurBtn, afficheDevise === d && styles.selecteurBtnOn]}
                                        accessibilityRole="button"
                                    >
                                        <Text style={[styles.selecteurText, afficheDevise === d && styles.selecteurTextOn]}>
                                            {d === 'XOF' ? 'FCFA' : d}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <Text style={styles.montantGrand}>{montantAffiche}</Text>
                        <Text style={styles.montantSous}>
                            {equivalent ? `≈ ${equivalent} · ` : ''}
                            <Text style={styles.montantSousFort}>{t('Débité en francs CFA (XOF)')}</Text>
                        </Text>

                        <View style={styles.montantPied}>
                            <ShieldCheck size={14} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.montantPiedText}>
                                {t('Frais d’agence, réservations partenaires et assistance inclus. Règlement en une fois.')}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Coordonnées du payeur */}
                    <Animated.View entering={FadeInDown.delay(160).duration(420)}>
                        <Text style={[styles.overline, styles.titreSection]}>{t('Coordonnées du payeur')}</Text>

                        {[
                            { l: 'Nom complet', v: nom, set: setNom, Icone: User, kb: 'default' as const },
                            { l: 'Email de confirmation', v: email, set: setEmail, Icone: Mail, kb: 'email-address' as const },
                            { l: 'Téléphone / WhatsApp', v: tel, set: setTel, Icone: Phone, kb: 'phone-pad' as const },
                        ].map(ch => (
                            <View key={ch.l} style={styles.champBloc}>
                                <Text style={styles.champLabel}>{t(ch.l)}</Text>
                                <View style={styles.champLigne}>
                                    <ch.Icone size={16} color={C.primary} strokeWidth={2.2} />
                                    <TextInput
                                        value={ch.v}
                                        onChangeText={ch.set}
                                        keyboardType={ch.kb}
                                        autoCapitalize={ch.kb === 'email-address' ? 'none' : 'words'}
                                        placeholderTextColor={C.textMuted}
                                        style={styles.champInput}
                                    />
                                </View>
                            </View>
                        ))}
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Barre de règlement */}
            <View style={[styles.barre, { paddingBottom: insets.bottom + 14 }]}>
                <View>
                    <Text style={styles.overlineGris}>{t('Total à régler')}</Text>
                    <Text style={styles.barreMontant}>{montantAffiche}</Text>
                </View>
                <Pressable
                    onPress={() => { if (complet) setFeuille(true) }}
                    disabled={!complet}
                    style={({ pressed }) => [
                        styles.ctaBarre, !complet && { opacity: 0.45 },
                        pressed && complet && { transform: [{ scale: 0.98 }] },
                    ]}
                    accessibilityRole="button"
                >
                    <Text style={styles.ctaBarreText}>{t('Moyen de paiement')}</Text>
                    <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                </Pressable>
            </View>

            {/* ══ MOYENS DE PAIEMENT ══ */}
            <Modal visible={feuille} transparent animationType="slide" onRequestClose={() => setFeuille(false)}>
                <Pressable style={styles.voile} onPress={() => setFeuille(false)} />
                <View style={[styles.feuille, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.poignee} />

                    <View style={styles.feuilleEntete}>
                        <View>
                            <Text style={styles.overline}>{t('Étape 2/2')}</Text>
                            <Text style={styles.feuilleTitre}>{t('Moyen de paiement')}</Text>
                        </View>
                        <Pressable onPress={() => setFeuille(false)} style={styles.rondPetit} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Fermer')}>
                            <X size={16} color={C.textSec} strokeWidth={2.4} />
                        </Pressable>
                    </View>

                    <View style={styles.moyens}>
                        {/* Mobile Money : le seul qui encaisse DANS l'application. */}
                        <Pressable
                            onPress={() => setMoyen('kkiapay')}
                            style={[styles.moyen, moyen === 'kkiapay' && styles.moyenOn]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: moyen === 'kkiapay' }}
                        >
                            <View style={[styles.moyenTuile, moyen === 'kkiapay' && styles.moyenTuileOn]}>
                                <Smartphone size={24} color={moyen === 'kkiapay' ? C.primary : C.textSec} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={styles.moyenTitreLigne}>
                                    <Text style={styles.moyenTitre}>{t('Mobile Money')}</Text>
                                    <View style={styles.moyenBadge}>
                                        <Text style={styles.moyenBadgeText}>{t('Recommandé')}</Text>
                                    </View>
                                </View>
                                <Text style={styles.moyenSous}>{t('MTN MoMo · Moov Money · sans quitter l’app')}</Text>
                            </View>
                            <View style={[styles.radio, moyen === 'kkiapay' && styles.radioOn]}>
                                {moyen === 'kkiapay' && <View style={styles.radioPoint} />}
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setMoyen('carte')}
                            style={[styles.moyen, moyen === 'carte' && styles.moyenOn]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: moyen === 'carte' }}
                        >
                            <View style={[styles.moyenTuile, moyen === 'carte' && styles.moyenTuileOn]}>
                                <CreditCard size={24} color={moyen === 'carte' ? C.primary : C.textSec} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.moyenTitre}>{t('Carte bancaire')}</Text>
                                <Text style={styles.moyenSous}>{t('Visa / Mastercard · page sécurisée 3-D Secure')}</Text>
                            </View>
                            <View style={[styles.radio, moyen === 'carte' && styles.radioOn]}>
                                {moyen === 'carte' && <View style={styles.radioPoint} />}
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => setMoyen('paypal')}
                            style={[styles.moyen, moyen === 'paypal' && styles.moyenOn]}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: moyen === 'paypal' }}
                        >
                            <View style={[styles.moyenTuile, moyen === 'paypal' && styles.moyenTuileOn]}>
                                <Wallet size={24} color={moyen === 'paypal' ? C.primary : C.textSec} strokeWidth={2.2} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.moyenTitre}>{t('PayPal · international')}</Text>
                                <Text style={styles.moyenSous}>{t('Redirection vers votre compte PayPal')}</Text>
                            </View>
                            <View style={[styles.radio, moyen === 'paypal' && styles.radioOn]}>
                                {moyen === 'paypal' && <View style={styles.radioPoint} />}
                            </View>
                        </Pressable>
                    </View>

                    <View style={styles.rassurance}>
                        <Lock size={14} color={C.primary} strokeWidth={2.2} />
                        <Text style={styles.rassuranceText}>
                            {t('Paiement vérifié auprès de la passerelle avant validation.')}
                        </Text>
                    </View>

                    <Pressable
                        onPress={() => (moyen === 'kkiapay' ? lancerKkiapay() : ouvrirPageSecurisee())}
                        style={({ pressed }) => [styles.ctaPlein, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.ctaPleinText}>
                            {moyen === 'kkiapay'
                                ? t('Payer {m}', { m: montantAffiche })
                                : t('Continuer sur la page sécurisée')}
                        </Text>
                    </Pressable>
                    <Text style={styles.mentionCgv}>
                        {t('En confirmant, vous acceptez les conditions de vente de Retour Gagnant Bénin.')}
                    </Text>
                </View>
            </Modal>

            <KkiapayModal
                visible={kkiapayVisible}
                amount={String(totalXof ?? 0)}
                serviceName={`Séjour ${prop.destination || 'Bénin'}`}
                onClose={() => setKkiapayVisible(false)}
                onCancel={() => {
                    // Abandon confirmé par le modal : la commande créée juste
                    // avant l'ouverture ne doit pas rester « en attente ».
                    const oid = orderRef.current
                    if (oid) annulerCommande(oid)
                    setMotif('')
                }}
                onSuccess={surTransaction}
            />

            {/* Passerelles réellement activées côté admin : affichage discret,
                utile au support quand un moyen manque. */}
            {passerelles.kkiapay_enabled === 'false' && (
                <View style={styles.bandeauInfo}>
                    <Text style={styles.bandeauInfoText}>
                        {t('Mobile Money momentanément indisponible. Utilisez la page sécurisée.')}
                    </Text>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
    scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 20 },

    entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    enteteTitre: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: C.text },
    rond: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
    rondPetit: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

    overline: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    overlineGris: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 1.4, textTransform: 'uppercase' },
    overlineVert: { fontFamily: fonts.bold, fontSize: 11, color: C.primary, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 20 },
    overlineRouge: { fontFamily: fonts.bold, fontSize: 11, color: ROUGE, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 20 },
    titreSection: { marginBottom: 12, paddingHorizontal: 4 },

    /* Séjour verrouillé */
    carteSejour: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, gap: 14, ...shadows.card },
    sejourHaut: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    sejourTitre: { fontFamily: fonts.extrabold, fontSize: 16, color: C.text, marginTop: 2 },
    pastilleValide: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    pastilleValideText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.primary },
    sejourMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontFamily: fonts.body, fontSize: 12, color: C.textSec },
    sejourListe: { gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
    sejourLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sejourLigneNom: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 12, color: C.text },
    sejourLignePrix: { fontFamily: fonts.bold, fontSize: 12, color: VERT_PROFOND },
    lienModifier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
    lienModifierText: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: C.primary },

    /* Montant */
    carteMontant: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 20, padding: 16, gap: 10 },
    montantHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    selecteur: { flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 10, padding: 2 },
    selecteurBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    selecteurBtnOn: { backgroundColor: C.primary },
    selecteurText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: C.textSec },
    selecteurTextOn: { color: '#FFFFFF' },
    montantGrand: { fontFamily: fonts.extrabold, fontSize: 26, color: VERT_PROFOND },
    montantSous: { fontFamily: fonts.body, fontSize: 12, color: C.textMuted },
    montantSousFort: { fontFamily: fonts.bodySemibold, color: C.textSec },
    montantPied: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderTopColor: C.borderStrong, paddingTop: 10 },
    montantPiedText: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: C.textSec },

    /* Champs */
    champBloc: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, marginBottom: 10 },
    champLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
    champLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
    champInput: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13, color: C.text, paddingVertical: 6 },

    /* Barre */
    barre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 14, shadowColor: '#3C3C3C', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.05, shadowRadius: 24, elevation: 12 },
    barreMontant: { fontFamily: fonts.extrabold, fontSize: 19, color: VERT_PROFOND, marginTop: 2 },
    ctaBarre: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 14 },
    ctaBarreText: { fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' },

    /* Feuille des moyens */
    voile: { flex: 1, backgroundColor: 'rgba(60,60,60,0.18)' },
    feuille: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 20, paddingTop: 10, gap: 14 },
    poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong },
    feuilleEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
    feuilleTitre: { fontFamily: fonts.extrabold, fontSize: 16, color: C.text, marginTop: 2 },
    moyens: { gap: 10 },
    moyen: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 18, padding: 12 },
    moyenOn: { borderWidth: 2, borderColor: C.primary, backgroundColor: C.primarySoft },
    moyenTuile: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
    moyenTuileOn: { backgroundColor: '#FFFFFF', borderColor: VERT_LISERE },
    moyenTitreLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    moyenTitre: { fontFamily: fonts.extrabold, fontSize: 13, color: C.text },
    moyenBadge: { backgroundColor: C.primarySoft, borderWidth: 1, borderColor: VERT_LISERE, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
    moyenBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
    moyenSous: { fontFamily: fonts.body, fontSize: 11.5, color: C.textSec, marginTop: 3 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
    radioOn: { backgroundColor: C.primary, borderColor: C.primary },
    radioPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
    rassurance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
    rassuranceText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: C.textSec },
    mentionCgv: { fontFamily: fonts.body, fontSize: 10, color: C.textMuted, textAlign: 'center' },

    /* États pleine page */
    centreHaut: { alignItems: 'center', paddingTop: 20, gap: 3 },
    sousEntete: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.textMuted },
    centreCorps: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
    centreCorpsScroll: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, gap: 8 },
    centreBas: { paddingHorizontal: 24, paddingTop: 12, gap: 10, alignItems: 'center' },

    anneauBloc: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    anneauOnde: { position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: C.primarySoft },
    anneauCercle: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primarySoft, borderWidth: 2, borderColor: VERT_LISERE, alignItems: 'center', justifyContent: 'center' },
    anneauDisque: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadows.card },

    grandMontant: { fontFamily: fonts.extrabold, fontSize: 28, color: VERT_PROFOND, textAlign: 'center', marginTop: 6 },
    titreEtat: { fontFamily: fonts.bold, fontSize: 16, color: C.text, textAlign: 'center' },
    titreSucces: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, color: C.text, textAlign: 'center', marginTop: 4 },
    texteEtat: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: C.textSec, textAlign: 'center', maxWidth: 320, marginTop: 4 },

    etapes: { width: '100%', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 20, padding: 16, marginTop: 20 },
    etapeLigne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    etapePastille: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    etapePastilleOn: { backgroundColor: C.primary, borderColor: C.primary },
    etapePastilleActive: { borderWidth: 4, borderColor: C.primarySoft },
    etapePoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
    etapeNum: { fontFamily: fonts.bold, fontSize: 10, color: C.textMuted },
    etapeTitre: { fontFamily: fonts.bold, fontSize: 12.5, color: C.text },
    etapeSous: { fontFamily: fonts.body, fontSize: 10.5, color: C.textMuted, marginTop: 2 },
    etapeTrait: { width: 2, height: 12, backgroundColor: C.borderStrong, marginLeft: 12, marginVertical: 2 },
    etapeTraitOn: { backgroundColor: C.primary },

    avertissement: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
    avertissementText: { fontFamily: fonts.bodySemibold, fontSize: 11.5, color: C.textSec },
    petitGris: { fontFamily: fonts.body, fontSize: 10.5, color: C.textMuted },

    /* Succès */
    succesCercle: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    succesDisque: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

    carteBlanche: { width: '100%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, marginTop: 20, ...shadows.card },
    carteBlancheAide: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, marginTop: 14, ...shadows.card },
    carteGrise: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 18, padding: 14, marginTop: 14 },
    carteGriseBloc: { width: '100%', backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 20, padding: 16, marginTop: 20 },
    carteGriseText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: C.textSec },
    gras: { fontFamily: fonts.bold, color: C.text },
    tuileRonde: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },

    ligneCarte: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 9 },
    ligneSep: { borderTopWidth: 1, borderTopColor: C.border },
    ligneLabel: { fontFamily: fonts.body, fontSize: 11.5, color: C.textMuted },
    ligneValeur: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.text },
    ligneValeurForte: { fontFamily: fonts.extrabold, fontSize: 12.5, color: VERT_PROFOND },
    ligneValeurVerte: { fontFamily: fonts.bodySemibold, fontSize: 12, color: C.primary, flexShrink: 1 },
    ligneValeurIcone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ligneMono: { fontFamily: fonts.bold, fontSize: 11.5, color: C.text },
    ligneRouge: { fontFamily: fonts.bold, fontSize: 11.5, color: ROUGE, flexShrink: 1, textAlign: 'right' },

    /* Échec */
    echecCercle: { width: 80, height: 80, borderRadius: 40, backgroundColor: ROUGE_DOUX, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    echecDisque: { width: 56, height: 56, borderRadius: 28, backgroundColor: ROUGE, alignItems: 'center', justifyContent: 'center' },

    /* Actions communes */
    ctaPlein: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 15 },
    ctaPleinText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#FFFFFF' },
    ctaVide: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: radius.pill, paddingVertical: 14 },
    ctaVideText: { fontFamily: fonts.bold, fontSize: 13, color: C.text },

    bandeauInfo: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.dangerSoft, paddingHorizontal: 20, paddingVertical: 8 },
    bandeauInfoText: { fontFamily: fonts.bodySemibold, fontSize: 11, color: ROUGE, textAlign: 'center' },

    erreur: { fontFamily: fonts.body, fontSize: 14, color: C.textMuted, textAlign: 'center' },
})
