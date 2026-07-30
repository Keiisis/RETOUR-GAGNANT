'use strict'
/* ══════════════════════════════════════════════════════════════
   APPEL VOCAL — écran mobile

   Le client appelle ; tous les agents connectés voient l'appel sonner
   dans leur panel et le premier qui décroche prend la communication.
   La voix circule en pair-à-pair, sans passer par nos serveurs.
══════════════════════════════════════════════════════════════ */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react-native'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { supabase } from '../../config/supabase'
import { FlagBar } from '../../components/ui'
import { toast } from '../../lib/feedback'
import { MobileCallEngine, isCallSupported, formatDuree, basculerHautParleur } from '../../lib/call-engine'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

const C = screenColors
const AGENCE_TEL = '+2290160322121'

type Etat = 'connexion' | 'sonne' | 'actif' | 'termine'

export default function CallScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets()
    const { profile } = useAuth()
    const { t } = useLang()
    const sujet: string | undefined = route?.params?.sujet

    const [etat, setEtat] = useState<Etat>('connexion')
    const [muet, setMuet] = useState(false)
    const [hautParleur, setHautParleur] = useState(false)
    const [secondes, setSecondes] = useState(0)
    const [agentNom, setAgentNom] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const engine = useRef<MobileCallEngine | null>(null)
    const callIdRef = useRef<string | null>(null)
    const canalRef = useRef<any>(null)

    /* Chronomètre de conversation. */
    useEffect(() => {
        if (etat !== 'actif') return
        const id = setInterval(() => setSecondes(s => s + 1), 1000)
        return () => clearInterval(id)
    }, [etat])

    const fermer = useCallback(() => {
        engine.current?.hangup(); engine.current = null
        if (canalRef.current) { void supabase.removeChannel(canalRef.current); canalRef.current = null }
    }, [])

    const raccrocher = useCallback(async (silencieux = false) => {
        const id = callIdRef.current
        callIdRef.current = null
        fermer()
        setEtat('termine')
        if (id) {
            await supabase
                .from('calls')
                .update({ statut: 'ended', termine_par: 'client', ended_at: new Date().toISOString() })
                .eq('id', id)
                .in('statut', ['ringing', 'active'])
        }
        if (!silencieux) navigation.goBack()
    }, [fermer, navigation])

    /* ── Lancement de l'appel ── */
    useEffect(() => {
        let vivant = true

        const lancer = async () => {
            if (!profile?.id) {
                toast(t('Non connecté'), t('Connectez-vous pour appeler un conseiller.'))
                navigation.goBack()
                return
            }

            // Build sans le module natif : on ne bloque pas l'utilisateur,
            // on bascule sur l'appel téléphonique classique.
            // La detection est elle-meme protegee : si elle echoue, on
            // considere que l'appel in-app n'est pas disponible plutot que
            // de laisser une exception remonter jusqu'a l'ecran.
            //
            // Deux situations mènent ici, et le message doit valoir pour les
            // deux : un build de développement antérieur à l'ajout de
            // react-native-webrtc, ou Expo Go — qui embarque un jeu figé de
            // modules natifs et ne pourra JAMAIS passer cet appel, quelle
            // que soit la version de l'application. Parler de simple « mise
            // à jour » envoyait chercher un correctif inexistant.
            let disponible = false
            try { disponible = isCallSupported() } catch { disponible = false }

            if (!disponible) {
                toast(
                    t('Appel téléphonique'),
                    t("Cet appel exige le build RGB à jour — Expo Go ne le permet pas. Nous ouvrons votre téléphone."),
                )
                Linking.openURL(`tel:${AGENCE_TEL}`).catch(() => { })
                navigation.goBack()
                return
            }

            try {
                const nom = `${profile.prenom || ''} ${profile.nom || ''}`.trim() || (profile.email || '')
                const { data: appel, error } = await supabase
                    .from('calls')
                    .insert({
                        client_id: profile.id,
                        client_nom: nom,
                        client_email: profile.email || '',
                        sujet: sujet || null,
                        statut: 'ringing',
                    })
                    .select()
                    .single()
                if (error) throw new Error(error.message)
                if (!vivant) return

                callIdRef.current = appel.id
                setEtat('sonne')

                canalRef.current = supabase
                    .channel(`client-appel-${appel.id}`)
                    .on('postgres_changes', {
                        event: 'UPDATE', schema: 'public', table: 'calls',
                        filter: `id=eq.${appel.id}`,
                    }, (p: any) => {
                        const row = p.new as { statut: string; agent_nom: string | null }
                        if (row.statut === 'active') { setAgentNom(row.agent_nom); setEtat('actif') }
                        else if (row.statut === 'declined') {
                            setMessage(t('Aucun conseiller disponible pour le moment.'))
                            void raccrocher(true)
                        } else if (row.statut === 'missed') {
                            setMessage(t('Personne n\'a décroché.'))
                            void raccrocher(true)
                        } else if (row.statut === 'ended') {
                            void raccrocher(true)
                        }
                    })
                    .subscribe()

                const moteur = new MobileCallEngine({
                    supabase,
                    callId: appel.id,
                    onEnded: (raison) => { setMessage(raison); void raccrocher(true) },
                })
                engine.current = moteur
                await moteur.start()
            } catch (e) {
                const msg = e instanceof Error ? e.message : ''
                setMessage(
                    msg.includes('Permission') || msg.includes('denied')
                        ? t('Autorisez le micro pour appeler.')
                        : t("L'appel n'a pas pu être lancé."),
                )
                setEtat('termine')
            }
        }

        lancer()
        return () => {
            vivant = false
            const id = callIdRef.current
            callIdRef.current = null
            fermer()
            /* Quitter l'écran sans raccrocher — geste de retour, application
               fermée — laissait l'appel ouvert en base : l'agent voyait une
               communication qui n'existait plus. On clôt aussi côté serveur.
               La requête part sans être attendue : le composant disparaît. */
            if (id) {
                void supabase
                    .from('calls')
                    .update({ statut: 'ended', termine_par: 'client', ended_at: new Date().toISOString() })
                    .eq('id', id)
                    .in('statut', ['ringing', 'active'])
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id])

    const basculerMicro = () => {
        const suivant = !muet
        setMuet(suivant)
        engine.current?.setMuted(suivant)
    }

    /* Ecouteur par defaut : c'est ce qui limite le plus l'echo. Le
       haut-parleur reste a portee d'un appui pour les mains libres. */
    const basculerSortie = () => {
        const suivant = !hautParleur
        setHautParleur(suivant)
        basculerHautParleur(suivant)
    }

    const titre =
        etat === 'actif' ? (agentNom || t('Conseiller RGB'))
        : etat === 'sonne' ? t('Nous cherchons un conseiller…')
        : etat === 'connexion' ? t('Connexion…')
        : t('Appel terminé')

    return (
        <View style={styles.container}>
            <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                <FlagBar height={6} radiusTop={false} />
            </View>

            <View style={styles.body}>
                <Image
                    source={require('../../../assets/images/conseillere.webp')}
                    style={styles.avatar}
                    accessible={false}
                />

                <Text style={styles.label}>
                    {etat === 'actif' ? t('EN COMMUNICATION') : t('APPEL SORTANT')}
                </Text>
                <Text style={styles.title} numberOfLines={2}>{titre}</Text>

                {etat === 'actif' && (
                    <Text style={styles.timer}>{formatDuree(secondes)}</Text>
                )}
                {message && <Text style={styles.message}>{message}</Text>}
            </View>

            <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
                {etat === 'actif' && (
                    <Pressable
                        onPress={basculerSortie}
                        accessibilityRole="button"
                        accessibilityLabel={hautParleur ? t("Revenir à l'écouteur") : t('Activer le haut-parleur')}
                        accessibilityState={{ selected: hautParleur }}
                        style={[styles.roundBtn, hautParleur && styles.roundBtnActif]}
                    >
                        <Volume2 size={22} color={hautParleur ? C.primary : C.text} strokeWidth={2} />
                    </Pressable>
                )}

                {etat === 'actif' && (
                    <Pressable
                        onPress={basculerMicro}
                        accessibilityRole="button"
                        accessibilityLabel={muet ? t('Réactiver le micro') : t('Couper le micro')}
                        style={[styles.roundBtn, muet && styles.roundBtnMuted]}
                    >
                        {muet
                            ? <MicOff size={22} color={C.error} strokeWidth={2} />
                            : <Mic size={22} color={C.text} strokeWidth={2} />}
                    </Pressable>
                )}

                <Pressable
                    onPress={() => raccrocher()}
                    accessibilityRole="button"
                    accessibilityLabel={t('Raccrocher')}
                    style={styles.hangupBtn}
                >
                    <PhoneOff size={24} color={C.primaryText} strokeWidth={2} />
                </Pressable>

                {etat === 'termine' && (
                    <Pressable
                        onPress={() => Linking.openURL(`tel:${AGENCE_TEL}`).catch(() => { })}
                        accessibilityRole="button"
                        accessibilityLabel={t('Appeler par téléphone')}
                        style={styles.roundBtn}
                    >
                        <Phone size={22} color={C.primary} strokeWidth={2} />
                    </Pressable>
                )}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    topFlag: { marginHorizontal: 20, borderRadius: radius.pill, overflow: 'hidden' },

    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    avatar: { width: 128, height: 128, borderRadius: 64, marginBottom: spacing.lg },
    label: { ...typography.overline, fontSize: 12, color: C.textMuted },
    title: { ...typography.h1, fontSize: 26, color: C.text, textAlign: 'center', marginTop: spacing.sm },
    timer: { ...typography.h2, color: C.primary, marginTop: spacing.md },
    message: { ...typography.bodySmall, color: C.accentDark, textAlign: 'center', marginTop: spacing.md },

    actions: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.lg, paddingTop: spacing.lg,
    },
    roundBtn: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        alignItems: 'center', justifyContent: 'center', ...shadows.card,
    },
    roundBtnMuted: { backgroundColor: C.surfaceAlt },
    roundBtnActif: { backgroundColor: C.surfaceSoft, borderColor: C.primary },
    hangupBtn: {
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: C.error,
        alignItems: 'center', justifyContent: 'center', ...shadows.card,
    },
})
