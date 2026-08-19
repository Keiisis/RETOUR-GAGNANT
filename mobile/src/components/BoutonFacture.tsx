/* ═══════════════════════════════════════════════════════════
   « Télécharger la facture » — un seul geste, partout.

   Après un règlement, le serveur établit la facture et l'envoie par email.
   Ce bouton ne remplace PAS cet envoi : il évite au client d'aller chercher sa
   boîte mail pour un document qu'il vient de payer.

   Le document est retrouvé par la TRANSACTION — la seule chose que le
   téléphone connaisse à coup sûr. Une route qui accepterait un numéro de
   facture serait énumérable ; celle-ci ne l'est pas, et le serveur vérifie en
   plus que la facture appartient bien au compte connecté.

   Le paraphe : la facture porte un cadre « Bon pour accord : client ». Sans
   signature enregistrée, ce cadre reste vide — on le dit une fois, on propose
   de signer (le paraphe vaudra ensuite pour TOUS les documents du compte), et
   on n'empêche jamais le téléchargement. Le client a payé.
═══════════════════════════════════════════════════════════ */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Download, PenLine, FileText } from 'lucide-react-native'
import { screenColors as C, radius, fonts } from '../config/theme'
import { useLang } from '../contexts/LangContext'
import { fetchWithTimeout } from '../lib/fetch'
import { authHeaders } from '../config/api'
import { telechargerDocument } from '../lib/documents'
import { toast } from '../lib/feedback'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

interface Props {
    /** Référence de transaction de la passerelle. */
    tx?: string | null
    /** 'contour' (défaut) reste discret ; 'plein' porte l'action principale. */
    variant?: 'contour' | 'plein'
    /** Rendu tant que la facture n'est pas encore établie (défaut : rien). */
    enAttente?: React.ReactNode
}

export default function BoutonFacture({ tx, variant = 'contour', enAttente = null }: Props) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const navigation = useNavigation<NativeStackNavigationProp<any>>()

    const [numero, setNumero] = useState<string | null>(null)
    const [existe, setExiste] = useState(false)
    const [signee, setSignee] = useState<boolean | null>(null)
    const [autoSign, setAutoSign] = useState<string | null>(null)
    const [enCours, setEnCours] = useState(false)
    const [feuille, setFeuille] = useState(false)
    /** Vrai quand on a envoyé le client signer : le retour relance le geste. */
    const revientDeSignature = useRef(false)

    const interroger = useCallback(async (): Promise<{ facturee: boolean; signee: boolean }> => {
        if (!tx) return { facturee: false, signee: false }
        try {
            const r = await fetchWithTimeout(
                `${API_BASE}/api/mobile/facture?tx=${encodeURIComponent(tx)}`,
                { timeoutMs: 9000, headers: { ...(await authHeaders()) } },
            )
            const d = await r.json().catch(() => ({}))
            if (!r.ok) return { facturee: false, signee: false }
            if (d?.facture?.id) { setExiste(true); setNumero(d.facture.numero || null) }
            const aSigne = !!d?.signature?.enregistree
            setSignee(aSigne)
            setAutoSign(d?.signature?.auto_sign ?? null)
            return { facturee: !!d?.facture?.id, signee: aSigne }
        } catch {
            return { facturee: false, signee: false }
        }
    }, [tx])

    /* Certains services facturent en tâche de fond (l'email ne doit pas retenir
       l'écran) : trois tentatives espacées, plutôt qu'une absence annoncée trop
       vite au client. */
    useEffect(() => {
        if (!tx) return
        let vivant = true
        const minuteries: ReturnType<typeof setTimeout>[] = []
        const essayer = async (rang: number) => {
            if (!vivant) return
            const { facturee } = await interroger()
            if (!vivant || facturee || rang >= 2) return
            minuteries.push(setTimeout(() => essayer(rang + 1), rang === 0 ? 2200 : 5000))
        }
        essayer(0)
        return () => { vivant = false; minuteries.forEach(clearTimeout) }
    }, [tx, interroger])

    const telecharger = useCallback(async () => {
        if (!tx || enCours) return
        setEnCours(true)
        try {
            const r = await telechargerDocument(
                `${API_BASE}/api/mobile/facture/pdf?tx=${encodeURIComponent(tx)}`,
                `Facture-${numero || 'RGB'}`,
            )
            if (!r.ok) toast(t('Téléchargement impossible'), r.erreur, 'danger')
            else if (!r.partage) {
                toast(t('Facture enregistrée'), t('Le document est disponible dans vos fichiers.'), 'success')
            }
        } finally {
            setEnCours(false)
        }
    }, [tx, enCours, numero, t])

    const demander = useCallback(() => {
        // `never` : le client a demandé qu'on n'appose pas son paraphe. On ne
        // le sollicite plus.
        if (signee === false && autoSign !== 'never') setFeuille(true)
        else telecharger()
    }, [signee, autoSign, telecharger])

    useFocusEffect(useCallback(() => {
        if (!revientDeSignature.current) return
        revientDeSignature.current = false
        let vivant = true
        interroger().then(({ signee: aSigne }) => {
            // Paraphe tout juste enregistré : on enchaîne sans refaire cliquer.
            if (vivant && aSigne) telecharger()
        })
        return () => { vivant = false }
    }, [interroger, telecharger]))

    if (!tx || !existe) return <>{enAttente}</>

    const plein = variant === 'plein'
    const teinte = plein ? '#FFFFFF' : C.primary

    return (
        <>
            <Pressable
                onPress={demander}
                disabled={enCours}
                style={({ pressed }) => [
                    plein ? styles.plein : styles.contour,
                    enCours && { opacity: 0.6 },
                    pressed && !enCours && { transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('Télécharger la facture')}
            >
                {enCours
                    ? <ActivityIndicator size="small" color={teinte} />
                    : <Download size={16} color={teinte} strokeWidth={2.2} />}
                <Text style={[styles.texte, { color: teinte }]}>
                    {enCours
                        ? t('Préparation du document…')
                        : numero ? `${t('Télécharger la facture')} ${numero}` : t('Télécharger la facture')}
                </Text>
            </Pressable>

            <Modal visible={feuille} transparent animationType="fade" onRequestClose={() => setFeuille(false)}>
                <Pressable style={styles.voile} onPress={() => setFeuille(false)} accessibilityRole="button" />
                <View style={[styles.feuille, { paddingBottom: insets.bottom + 18 }]}>
                    <View style={styles.poignee} />

                    <View style={styles.tuile}>
                        <PenLine size={20} color={C.primary} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.titre}>{t('Signez votre bon pour accord')}</Text>
                    <Text style={styles.paragraphe}>
                        {t('Votre facture comporte un cadre « Bon pour accord : client ». Enregistrez votre paraphe une seule fois : il s’apposera ensuite sur tous vos documents, factures et devis compris.')}
                    </Text>

                    <Pressable
                        onPress={() => {
                            setFeuille(false)
                            revientDeSignature.current = true
                            navigation.navigate('Signature')
                        }}
                        style={({ pressed }) => [styles.plein, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <PenLine size={16} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={[styles.texte, { color: '#FFFFFF' }]}>{t('Enregistrer ma signature')}</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => { setFeuille(false); telecharger() }}
                        style={({ pressed }) => [styles.neutre, pressed && { transform: [{ scale: 0.98 }] }]}
                        accessibilityRole="button"
                    >
                        <FileText size={16} color={C.text} strokeWidth={2.2} />
                        <Text style={[styles.texte, { color: C.text }]}>{t('Télécharger sans signer')}</Text>
                    </Pressable>
                </View>
            </Modal>
        </>
    )
}

const rangee = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 14,
}

const styles = StyleSheet.create({
    plein: { ...rangee, backgroundColor: C.primary, paddingVertical: 15 },
    contour: { ...rangee, backgroundColor: C.primarySoft, borderWidth: 1, borderColor: C.primary },
    neutre: { ...rangee, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong },
    texte: { fontFamily: fonts.bold, fontSize: 13 },

    voile: { flex: 1, backgroundColor: 'rgba(24,24,24,0.42)' },
    feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, gap: 10 },
    poignee: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginBottom: 14 },
    tuile: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
    titre: { fontFamily: fonts.extrabold, fontSize: 18, color: C.text, marginTop: 4 },
    paragraphe: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: C.textSec, marginBottom: 6 },
})
