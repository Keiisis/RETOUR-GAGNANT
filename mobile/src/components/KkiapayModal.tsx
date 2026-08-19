/* ═══════════════════════════════════════════════════════════
   Feuille de paiement — commune à TOUS les services de l'application.

   Le client arrive ici depuis dix parcours différents (Fa, permis, logement,
   événements, boutique, récap…). Il doit y trouver la même chose, présentée
   de la même façon : ce qu'il paie, combien, par quel moyen, et un bouton qui
   dit le montant. C'est le portage de la maquette Sleek « Moyens de paiement »
   déjà validée pour le règlement du séjour.

   ⚠️ NE PAS revenir à `KkiapayProvider` / `useKkiapay()`. Le provider du SDK
   rend `{!widgetOpened && children}` : ouvrir le widget démonte toute
   l'application, et la fermer la remonte à neuf — navigation réinitialisée,
   saisies perdues, écran de résultat impossible. Le widget passe donc par
   `KkiapayWidget`, notre hôte, qui vit dans une fenêtre séparée.

   Charte v2 : blanc porteur, tricolore en accent, aucun fond sombre.
═══════════════════════════════════════════════════════════ */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from '../lib/feedback'
import {
    View, Text, StyleSheet, Modal, Pressable, ActivityIndicator,
} from 'react-native'
import { CreditCard, Lock, ShieldCheck, Smartphone, X } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import KkiapayWidget, { type ConfigKkiapay } from './KkiapayWidget'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { usePaymentSettings } from '../contexts/PaymentSettingsContext'
import { screenColors as C, radius, shadows, fonts } from '../config/theme'

const VERT_PROFOND = '#00643C'
const VERT_LISERE = 'rgba(0,135,81,0.15)'

interface KkiapayModalProps {
    visible: boolean
    amount: string
    serviceName: string
    onClose: () => void
    /* Appelé quand le client referme SANS avoir payé. Sans ce retour, l'écran
       appelant restait figé et une éventuelle commande gardait le statut
       « en attente » — le client repartait sans savoir où il en était. */
    onCancel?: () => void
    onSuccess: (transactionId: string) => void
}

export default function KkiapayModal({ visible, amount, serviceName, onClose, onSuccess, onCancel }: KkiapayModalProps) {
    /* La navigation vit ICI, pas dans chaque écran appelant. Répartie, elle
       produisait exactement ce qu'on voulait éviter : certains parcours
       menaient à l'écran de résultat, d'autres à une simple alerte. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = useNavigation<any>()
    const [loading, setLoading] = useState(false)
    const { profile } = useAuth()
    const { t } = useLang()
    const { kkiapayPublicKey: kkiapayKey, kkiapaySandbox: sandbox } = usePaymentSettings()

    // Configuration du widget : `null` tant qu'aucun paiement n'est lancé.
    const [config, setConfig] = useState<ConfigKkiapay | null>(null)

    /* Moyen choisi. Les deux passent par la même passerelle — c'est elle qui
       présente ensuite le formulaire correspondant. Le choix n'est donc pas
       décoratif : il dit à la passerelle par quoi commencer, et il rassure le
       client qui cherche « carte bancaire » et ne voit que « Mobile Money ». */
    const [moyen, setMoyen] = useState<'momo' | 'carte'>('momo')

    /* Les retours de l'écran appelant sont lus via des références : le widget
       peut conclure longtemps après le rendu qui l'a ouvert. */
    const onSuccessRef = useRef(onSuccess)
    const onCloseRef = useRef(onClose)
    const onCancelRef = useRef(onCancel)
    const serviceNameRef = useRef(serviceName)
    const montantRef = useRef(0)
    // Un paiement a-t-il abouti pendant cette ouverture ? Sert à distinguer
    // « fermeture après issue » de « fermeture par abandon ».
    const abouti = useRef(false)

    useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
    useEffect(() => { onCloseRef.current = onClose }, [onClose])
    useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
    useEffect(() => { serviceNameRef.current = serviceName }, [serviceName])
    // À chaque réouverture, on repart d'une ardoise propre.
    useEffect(() => { if (visible) abouti.current = false }, [visible])

    /* On masque D'ABORD, on agit ENSUITE : changer d'écran pendant qu'une
       fenêtre se ferme produit un affichage instable. */
    const terminer = useCallback((suite?: () => void) => {
        setConfig(null)
        onCloseRef.current()
        if (suite) setTimeout(suite, 320)
    }, [])

    const surSucces = useCallback((transactionId: string) => {
        abouti.current = true
        terminer(() => onSuccessRef.current(transactionId))
    }, [terminer])

    const surEchec = useCallback((motif?: string) => {
        abouti.current = true
        terminer(() => nav.navigate('ResultatPaiement', {
            etat: 'echec',
            objet: serviceNameRef.current,
            montant: montantRef.current,
            devise: 'XOF',
            motif,
        }))
    }, [terminer, nav])

    /* Fermeture sans paiement : le client doit le savoir sur un écran, pas
       dans une alerte qui disparaît en trois secondes. */
    const surAbandon = useCallback(() => {
        if (abouti.current) return
        terminer(() => {
            // D'abord la conséquence métier (annuler une commande en attente),
            // puis l'écran qui l'annonce.
            onCancelRef.current?.()
            nav.navigate('ResultatPaiement', {
                etat: 'annule',
                objet: serviceNameRef.current,
                montant: montantRef.current,
                devise: 'XOF',
            })
        })
    }, [terminer, nav])

    /* Croix de CETTE feuille : le widget n'est pas encore ouvert, il n'y a donc
       rien à annuler — on referme, simplement. */
    const fermer = useCallback(() => { terminer() }, [terminer])

    /* Le montant arrive parfois habillé (« À partir de 150 000 FCFA ») : on en
       extrait le nombre, seule chose que la passerelle accepte. */
    const montant = (() => {
        const trouve = amount.match(/\d+([\s]?\d+)*/g)
        return trouve?.length ? parseInt(trouve[0].replace(/\s/g, ''), 10) : 1000
    })()
    const montantLisible = `${montant.toLocaleString('fr-FR')} FCFA`

    const ouvrirWidget = useCallback(() => {
        if (!kkiapayKey) {
            toast(t('Paiement indisponible'), t('La clé de paiement n’est pas configurée. Contactez-nous.'))
            return
        }
        setLoading(true)
        montantRef.current = montant
        setConfig({
            amount: montant,
            api_key: kkiapayKey,
            sandbox, // Lu depuis settings.kkiapay_sandbox — jamais codé en dur.
            email: profile?.email || '',
            phone: profile?.phone || '',
            reason: serviceName || t('Paiement de service'),
            /* ⚠️ On n'envoie PAS `paymentmethod`. Le widget attend un tableau et
               rejette la configuration — « paramètres invalides » — comme
               constaté sur le web (voir les trois pages de paiement, où le
               champ est explicitement écarté pour cette raison). Le choix
               ci-dessus reste utile : il dit au client que la carte est
               acceptée, et la passerelle lui présente les deux onglets. */
        })
        setLoading(false)
    }, [kkiapayKey, montant, profile, sandbox, serviceName, t])

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={fermer}>
            <Pressable style={styles.voile} onPress={fermer} accessibilityRole="button" accessibilityLabel={t('Fermer')} />

            <View style={styles.feuille}>
                <View style={styles.poignee} />

                <View style={styles.entete}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.overline}>{t('Étape 2/2')}</Text>
                        <Text style={styles.titre}>{t('Moyen de paiement')}</Text>
                    </View>
                    <Pressable
                        onPress={fermer}
                        style={styles.croix}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={t('Fermer le paiement')}
                    >
                        <X size={16} color={C.textSec} strokeWidth={2.4} />
                    </Pressable>
                </View>

                {/* Ce qui est payé, et combien. */}
                <View style={styles.recap}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.recapLabel}>{t('Vous réglez')}</Text>
                        <Text style={styles.recapObjet} numberOfLines={2}>{serviceName}</Text>
                    </View>
                    <Text style={styles.recapMontant}>{montantLisible}</Text>
                </View>

                <View style={styles.moyens}>
                    {([
                        {
                            cle: 'momo' as const,
                            Icone: Smartphone,
                            titre: 'Mobile Money',
                            sous: 'MTN MoMo · Moov Money · Celtiis',
                            recommande: true,
                        },
                        {
                            cle: 'carte' as const,
                            Icone: CreditCard,
                            titre: 'Carte bancaire',
                            sous: 'Visa · Mastercard — l’onglet carte s’ouvre dans la fenêtre de paiement',
                            recommande: false,
                        },
                    ]).map(m => {
                        const actif = moyen === m.cle
                        return (
                            <Pressable
                                key={m.cle}
                                onPress={() => setMoyen(m.cle)}
                                style={({ pressed }) => [
                                    styles.moyen, actif && styles.moyenActif,
                                    pressed && { transform: [{ scale: 0.99 }] },
                                ]}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: actif }}
                                accessibilityLabel={t(m.titre)}
                            >
                                <View style={[styles.tuile, actif && styles.tuileActive]}>
                                    <m.Icone size={22} color={actif ? C.primary : C.textSec} strokeWidth={2.2} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.moyenTitreLigne}>
                                        <Text style={styles.moyenTitre}>{t(m.titre)}</Text>
                                        {m.recommande && (
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>{t('Recommandé au Bénin')}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.moyenSous}>{t(m.sous)}</Text>
                                </View>
                                <View style={[styles.radio, actif && styles.radioActif]}>
                                    {actif && <View style={styles.radioPoint} />}
                                </View>
                            </Pressable>
                        )
                    })}
                </View>

                <View style={styles.rassurance}>
                    <Lock size={14} color={C.primary} strokeWidth={2.2} />
                    <Text style={styles.rassuranceText}>
                        {t('Paiement vérifié auprès de la passerelle avant validation.')}
                    </Text>
                </View>

                <Pressable
                    onPress={ouvrirWidget}
                    disabled={loading || !kkiapayKey}
                    style={({ pressed }) => [
                        styles.cta,
                        (loading || !kkiapayKey) && { opacity: 0.5 },
                        pressed && !loading && { transform: [{ scale: 0.98 }] },
                    ]}
                    accessibilityRole="button"
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <ShieldCheck size={18} color="#FFFFFF" strokeWidth={2.2} />
                            <Text style={styles.ctaText}>{t('Payer')} {montantLisible}</Text>
                        </>
                    )}
                </Pressable>

                <Text style={styles.mention}>
                    {t('En confirmant, vous acceptez les conditions de vente de Retour Gagnant Bénin.')}
                </Text>
            </View>

            {/* Le widget vit dans SA propre fenêtre : il ne démonte pas
                l'application, contrairement au provider du SDK. */}
            <KkiapayWidget
                visible={!!config}
                config={config}
                onSucces={surSucces}
                onEchec={surEchec}
                onAnnule={surAbandon}
            />
        </Modal>
    )
}

const styles = StyleSheet.create({
    voile: { flex: 1, backgroundColor: 'rgba(60,60,60,0.18)' },

    feuille: {
        backgroundColor: C.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderTopWidth: 1,
        borderTopColor: C.border,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 30,
        gap: 14,
        shadowColor: '#3C3C3C',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.12,
        shadowRadius: 40,
        elevation: 20,
    },
    poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.borderStrong },

    entete: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
    overline: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.4, textTransform: 'uppercase' },
    titre: { fontFamily: fonts.extrabold, fontSize: 16, color: C.text, marginTop: 2 },
    croix: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },

    recap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14 },
    recapLabel: { fontFamily: fonts.bold, fontSize: 9.5, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
    recapObjet: { fontFamily: fonts.bodySemibold, fontSize: 13, color: C.text, marginTop: 3 },
    recapMontant: { fontFamily: fonts.extrabold, fontSize: 17, color: VERT_PROFOND },

    moyens: { gap: 10 },
    moyen: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 18, padding: 12 },
    moyenActif: { borderWidth: 2, borderColor: C.primary, backgroundColor: C.primarySoft },
    tuile: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
    tuileActive: { backgroundColor: '#FFFFFF', borderColor: VERT_LISERE },
    moyenTitreLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    moyenTitre: { fontFamily: fonts.extrabold, fontSize: 13, color: C.text },
    moyenSous: { fontFamily: fonts.body, fontSize: 11.5, color: C.textSec, marginTop: 3 },
    badge: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: VERT_LISERE, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontFamily: fonts.bold, fontSize: 8.5, color: C.primary, letterSpacing: 0.8, textTransform: 'uppercase' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.borderStrong, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    radioActif: { borderColor: C.primary, backgroundColor: C.primary },
    radioPoint: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },

    rassurance: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    rassuranceText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: C.textSec },

    cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16 },
    ctaText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },
    mention: { fontFamily: fonts.body, fontSize: 10, color: C.textMuted, textAlign: 'center' },
})
