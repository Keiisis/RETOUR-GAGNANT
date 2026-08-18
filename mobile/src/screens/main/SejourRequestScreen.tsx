/* ═══════════════════════════════════════════════════════════
   Préparer mon séjour — Tourisme & Culture.

   Le bouton « Préparer mon séjour » ouvrait une simple demande de rendez-vous :
   l'agent recevait une date, sans savoir ce que le client voulait vivre. Il ne
   pouvait donc pas bâtir de proposition. Cet écran capte le PARCOURS — étapes
   souhaitées, activités, récit du projet — EN MÊME TEMPS que le rendez-vous.

   Quatre chapitres, une seule soumission : POST /api/mobile/tourisme/sejour
   crée le rendez-vous ET le parcours, et prévient l'équipe.

   Charte v2 : blanc porteur, tricolore en accents, aucune palette locale.
   Le contenu revient EN HAUT à chaque chapitre (même correctif que le
   formulaire de nationalité, où l'on atterrissait au milieu de la page).
═══════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    View, Text, StyleSheet, ScrollView, Pressable, TextInput,
    ActivityIndicator, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    ChevronLeft, MapPin, CalendarDays, Users, Sparkles, Check,
    ArrowRight, CircleCheck, Compass,
} from 'lucide-react-native'
import Animated, { FadeInUp } from 'react-native-reanimated'
import { screenColors as C, spacing, radius, typography, shadows, fonts } from '../../config/theme'
import { FlagBar } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import { toast } from '../../lib/feedback'
import { fetchWithTimeout } from '../../lib/fetch'
import { authHeaders } from '../../config/api'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

/* Étapes proposées : les lieux que l'agence dessert réellement. Le client
   peut en ajouter d'autres — la liste guide, elle n'enferme pas. */
const VILLES = [
    'Ouidah', 'Abomey', 'Ganvié', 'Porto-Novo', 'Cotonou',
    'Natitingou', 'Grand-Popo', 'Possotomè', 'Tanguiéta', 'Dassa',
]

const ACTIVITES = [
    'Porte du Retour', 'Route des esclaves', 'Palais royaux d’Abomey',
    'Cérémonie Vaudou', 'Village lacustre', 'Cascades de Tanongou',
    'Parc de la Pendjari', 'Ateliers d’artisanat', 'Rencontre de dignitaires',
    'Recherche de mes racines', 'Cuisine béninoise', 'Plages & détente',
]

const CANAUX = [
    { v: 'visio', l: 'Visio' },
    { v: 'presentiel', l: 'Présentiel' },
    { v: 'whatsapp', l: 'WhatsApp' },
]

const CHAPITRES = ['Mon voyage', 'Où aller', 'Ce que je veux vivre', 'Rendez-vous']

/** Masque de saisie JJ/MM/AAAA : le client ne tape que des chiffres. */
function masqueDate(txt: string): string {
    const n = txt.replace(/\D/g, '').slice(0, 8)
    if (n.length <= 2) return n
    if (n.length <= 4) return `${n.slice(0, 2)}/${n.slice(2)}`
    return `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`
}

/** JJ/MM/AAAA → AAAA-MM-JJ (ce qu'attend la base). Vide si incomplet. */
function versIso(fr: string): string {
    const m = fr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SejourRequestScreen({ navigation }: { navigation: any }) {
    const insets = useSafeAreaInsets()
    const { t } = useLang()
    const { profile } = useAuth()

    const [chapitre, setChapitre] = useState(0)
    const [envoi, setEnvoi] = useState(false)
    const [termine, setTermine] = useState(false)
    const scrollRef = useRef<ScrollView>(null)

    // Chapitre 1
    const [dateDebut, setDateDebut] = useState('')
    const [dateFin, setDateFin] = useState('')
    const [voyageurs, setVoyageurs] = useState('1')
    const [budget, setBudget] = useState('')

    // Chapitres 2 et 3
    const [villes, setVilles] = useState<string[]>([])
    const [villeLibre, setVilleLibre] = useState('')
    const [activites, setActivites] = useState<string[]>([])
    const [recit, setRecit] = useState('')

    // Chapitre 4
    const [rdvDate, setRdvDate] = useState('')
    const [rdvHeure, setRdvHeure] = useState('')
    const [canal, setCanal] = useState('visio')

    /* Nouveau chapitre → on repart du haut. Sans cela on atterrit au milieu
       du formulaire, à la position héritée du chapitre précédent. */
    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false })
    }, [chapitre])

    const basculer = (liste: string[], set: (v: string[]) => void, valeur: string) => {
        set(liste.includes(valeur) ? liste.filter(x => x !== valeur) : [...liste, valeur])
    }

    const ajouterVilleLibre = () => {
        const v = villeLibre.trim()
        if (!v) return
        if (!villes.includes(v)) setVilles(prev => [...prev, v])
        setVilleLibre('')
    }

    const dureeJours = useMemo(() => {
        const d = versIso(dateDebut), f = versIso(dateFin)
        if (!d || !f) return null
        const j = Math.round((new Date(f).getTime() - new Date(d).getTime()) / 86400000)
        return j > 0 ? j : null
    }, [dateDebut, dateFin])

    const valider = (): boolean => {
        if (chapitre === 1 && villes.length === 0) {
            toast(t('Aucune étape'), t('Choisissez au moins un lieu, ou ajoutez le vôtre.'))
            return false
        }
        if (chapitre === 2 && activites.length === 0 && !recit.trim()) {
            toast(t('Dites-nous en plus'), t('Choisissez une activité, ou décrivez votre projet en quelques mots.'))
            return false
        }
        return true
    }

    const suivant = () => {
        if (!valider()) return
        if (chapitre < CHAPITRES.length - 1) setChapitre(c => c + 1)
        else envoyer()
    }

    const envoyer = async () => {
        setEnvoi(true)
        try {
            const res = await fetchWithTimeout(`${API_BASE}/api/mobile/tourisme/sejour`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                timeoutMs: 20000,
                body: JSON.stringify({
                    rdv: { date: versIso(rdvDate), heure: rdvHeure.trim(), type: canal },
                    itineraire: {
                        villes, activites, recit: recit.trim(),
                        date_debut: versIso(dateDebut), date_fin: versIso(dateFin),
                        duree_jours: dureeJours, voyageurs: Number(voyageurs) || 1,
                        budget: Number(budget) || null, devise: 'EUR',
                    },
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.success) throw new Error(json.error || 'Envoi impossible.')
            setTermine(true)
        } catch (e) {
            toast(t('Envoi impossible'), e instanceof Error ? e.message : t('Réessayez dans un instant.'))
        } finally {
            setEnvoi(false)
        }
    }

    /* ── Confirmation ── */
    if (termine) {
        return (
            <View style={styles.container}>
                <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>
                <View style={styles.finWrap}>
                    <View style={styles.finIcon}><CircleCheck size={38} color={C.primary} strokeWidth={2} /></View>
                    <Text style={styles.finTitre}>{t('Votre projet est parti')}</Text>
                    <Text style={styles.finTexte}>
                        {t('Un conseiller étudie votre parcours et vous enverra une proposition illustrée directement dans l’application. Vous pourrez la consulter, la signer et la régler ici même.')}
                    </Text>
                    <Pressable onPress={() => navigation.navigate('MesPropositions')} style={styles.finBtn} accessibilityRole="button">
                        <Text style={styles.finBtnText}>{t('Voir mes propositions')}</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate('Main', { screen: 'Home' })} style={styles.finLien} accessibilityRole="button">
                        <Text style={styles.finLienText}>{t('Revenir à l’accueil')}</Text>
                    </Pressable>
                </View>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <View style={{ paddingTop: insets.top }}><FlagBar height={6} radiusTop={false} /></View>

            <View style={styles.header}>
                <Pressable
                    onPress={() => (chapitre > 0 ? setChapitre(c => c - 1) : navigation.goBack())}
                    style={styles.circleBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Retour')}
                >
                    <ChevronLeft size={24} color={C.text} strokeWidth={2.2} />
                </Pressable>
                <Text style={styles.headerTitle}>{t('Préparer mon séjour')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Progression : où j'en suis, combien il reste */}
            <View style={styles.progWrap}>
                <Text style={styles.progLabel}>
                    {t('Étape')} {chapitre + 1} {t('sur')} {CHAPITRES.length} · {t(CHAPITRES[chapitre])}
                </Text>
                <View style={styles.progBar}>
                    {CHAPITRES.map((_, i) => (
                        <View key={i} style={[styles.progSeg, i <= chapitre && styles.progSegOn]} />
                    ))}
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── 1. MON VOYAGE ── */}
                {chapitre === 0 && (
                    <Animated.View entering={FadeInUp.duration(320)}>
                        <View style={styles.badge}>
                            <CalendarDays size={13} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.badgeText}>{t('Votre voyage')}</Text>
                        </View>
                        <Text style={styles.h1}>{t('Quand souhaitez-vous venir ?')}</Text>
                        <Text style={styles.intro}>
                            {t('Ces repères nous servent à bâtir un programme réaliste. Rien n’est figé : tout se précise à l’entretien.')}
                        </Text>

                        <View style={styles.ligne2}>
                            <Champ label={t('Arrivée')} value={dateDebut} onChangeText={v => setDateDebut(masqueDate(v))}
                                placeholder="JJ/MM/AAAA" keyboardType="number-pad" maxLength={10} flex />
                            <Champ label={t('Départ')} value={dateFin} onChangeText={v => setDateFin(masqueDate(v))}
                                placeholder="JJ/MM/AAAA" keyboardType="number-pad" maxLength={10} flex />
                        </View>
                        {dureeJours !== null && (
                            <Text style={styles.aide}>{t('Soit')} {dureeJours} {t('jours sur place.')}</Text>
                        )}

                        <View style={styles.ligne2}>
                            <Champ label={t('Voyageurs')} value={voyageurs} onChangeText={setVoyageurs}
                                placeholder="1" keyboardType="number-pad" maxLength={2} flex />
                            <Champ label={t('Budget indicatif (€)')} value={budget} onChangeText={setBudget}
                                placeholder={t('facultatif')} keyboardType="number-pad" flex />
                        </View>
                    </Animated.View>
                )}

                {/* ── 2. OÙ ALLER ── */}
                {chapitre === 1 && (
                    <Animated.View entering={FadeInUp.duration(320)}>
                        <View style={styles.badge}>
                            <MapPin size={13} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.badgeText}>{t('Votre itinéraire')}</Text>
                        </View>
                        <Text style={styles.h1}>{t('Où voulez-vous aller ?')}</Text>
                        <Text style={styles.intro}>
                            {t('Touchez les lieux qui vous appellent. L’ordre de vos choix devient l’ordre de votre parcours.')}
                        </Text>

                        <View style={styles.puces}>
                            {VILLES.map(v => {
                                const on = villes.includes(v)
                                const rang = villes.indexOf(v) + 1
                                return (
                                    <Pressable key={v} onPress={() => basculer(villes, setVilles, v)}
                                        style={[styles.puce, on && styles.puceOn]}
                                        accessibilityRole="button" accessibilityState={{ selected: on }}>
                                        {on && <View style={styles.rang}><Text style={styles.rangText}>{rang}</Text></View>}
                                        <Text style={[styles.puceText, on && styles.puceTextOn]}>{v}</Text>
                                    </Pressable>
                                )
                            })}
                        </View>

                        <Text style={styles.label}>{t('Un autre lieu ?')}</Text>
                        <View style={styles.ligneAjout}>
                            <View style={[styles.champWrap, { flex: 1 }]}>
                                <TextInput
                                    style={styles.champ} value={villeLibre} onChangeText={setVilleLibre}
                                    placeholder={t('Village, région…')} placeholderTextColor={C.textMuted}
                                    onSubmitEditing={ajouterVilleLibre} returnKeyType="done"
                                />
                            </View>
                            <Pressable onPress={ajouterVilleLibre} style={styles.btnAjout} accessibilityRole="button">
                                <Text style={styles.btnAjoutText}>{t('Ajouter')}</Text>
                            </Pressable>
                        </View>

                        {villes.length > 0 && (
                            <View style={styles.recap}>
                                <Text style={styles.recapLabel}>{t('VOTRE PARCOURS')}</Text>
                                <Text style={styles.recapText}>{villes.join('  →  ')}</Text>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* ── 3. CE QUE JE VEUX VIVRE ── */}
                {chapitre === 2 && (
                    <Animated.View entering={FadeInUp.duration(320)}>
                        <View style={styles.badge}>
                            <Sparkles size={13} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.badgeText}>{t('Vos envies')}</Text>
                        </View>
                        <Text style={styles.h1}>{t('Que voulez-vous vivre ?')}</Text>
                        <Text style={styles.intro}>
                            {t('Choisissez ce qui compte pour vous. C’est ce qui distinguera votre séjour d’un circuit touristique.')}
                        </Text>

                        <View style={styles.puces}>
                            {ACTIVITES.map(a => {
                                const on = activites.includes(a)
                                return (
                                    <Pressable key={a} onPress={() => basculer(activites, setActivites, a)}
                                        style={[styles.puce, on && styles.puceOn]}
                                        accessibilityRole="button" accessibilityState={{ selected: on }}>
                                        {on && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                                        <Text style={[styles.puceText, on && styles.puceTextOn]}>{a}</Text>
                                    </Pressable>
                                )
                            })}
                        </View>

                        <Text style={styles.label}>{t('Racontez-nous votre projet')}</Text>
                        <View style={[styles.champWrap, styles.champLong]}>
                            <TextInput
                                style={[styles.champ, { minHeight: 110, textAlignVertical: 'top' }]}
                                value={recit} onChangeText={setRecit} multiline
                                placeholder={t('Vos racines, une famille à retrouver, une occasion particulière, votre rythme…')}
                                placeholderTextColor={C.textMuted}
                            />
                        </View>
                    </Animated.View>
                )}

                {/* ── 4. RENDEZ-VOUS ── */}
                {chapitre === 3 && (
                    <Animated.View entering={FadeInUp.duration(320)}>
                        <View style={styles.badge}>
                            <Users size={13} color={C.primary} strokeWidth={2.2} />
                            <Text style={styles.badgeText}>{t('Premier échange')}</Text>
                        </View>
                        <Text style={styles.h1}>{t('Quand vous appelle-t-on ?')}</Text>
                        <Text style={styles.intro}>
                            {t('Un conseiller vous contacte pour affiner votre parcours, puis vous envoie une proposition illustrée dans l’application.')}
                        </Text>

                        <View style={styles.ligne2}>
                            <Champ label={t('Date souhaitée')} value={rdvDate} onChangeText={v => setRdvDate(masqueDate(v))}
                                placeholder="JJ/MM/AAAA" keyboardType="number-pad" maxLength={10} flex />
                            <Champ label={t('Heure')} value={rdvHeure} onChangeText={setRdvHeure}
                                placeholder="14:00" maxLength={5} flex />
                        </View>

                        <Text style={styles.label}>{t('Par quel canal ?')}</Text>
                        <View style={styles.puces}>
                            {CANAUX.map(c => {
                                const on = canal === c.v
                                return (
                                    <Pressable key={c.v} onPress={() => setCanal(c.v)}
                                        style={[styles.puce, on && styles.puceOn]}
                                        accessibilityRole="button" accessibilityState={{ selected: on }}>
                                        <Text style={[styles.puceText, on && styles.puceTextOn]}>{t(c.l)}</Text>
                                    </Pressable>
                                )
                            })}
                        </View>

                        {/* Récapitulatif : le client voit ce qu'il envoie */}
                        <View style={styles.recapFinal}>
                            <Text style={styles.recapLabel}>{t('CE QUE VOUS ENVOYEZ')}</Text>
                            {!!villes.length && <LigneRecap label={t('Étapes')} valeur={villes.join(' → ')} />}
                            {!!activites.length && <LigneRecap label={t('Activités')} valeur={activites.join(', ')} />}
                            {dureeJours !== null && <LigneRecap label={t('Durée')} valeur={`${dureeJours} ${t('jours')}`} />}
                            <LigneRecap label={t('Voyageurs')} valeur={voyageurs} />
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            {/* Barre d'action */}
            <View style={[styles.barre, { paddingBottom: insets.bottom + 12 }]}>
                <Pressable
                    onPress={suivant} disabled={envoi}
                    style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }] }, envoi && { opacity: 0.6 }]}
                    accessibilityRole="button"
                >
                    {envoi ? <ActivityIndicator color="#FFFFFF" /> : (
                        <>
                            <Text style={styles.ctaText}>
                                {chapitre < CHAPITRES.length - 1 ? t('Continuer') : t('Envoyer mon projet')}
                            </Text>
                            <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.4} />
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    )
}

/* ── Primitives locales ── */
function Champ({
    label, value, onChangeText, placeholder, keyboardType, maxLength, flex,
}: {
    label: string; value: string; onChangeText: (v: string) => void
    placeholder?: string; keyboardType?: 'default' | 'number-pad'; maxLength?: number; flex?: boolean
}) {
    return (
        <View style={flex ? { flex: 1 } : undefined}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.champWrap}>
                <TextInput
                    style={styles.champ} value={value} onChangeText={onChangeText}
                    placeholder={placeholder} placeholderTextColor={C.textMuted}
                    keyboardType={keyboardType === 'number-pad' && Platform.OS === 'ios' ? 'number-pad' : keyboardType}
                    maxLength={maxLength}
                />
            </View>
        </View>
    )
}

function LigneRecap({ label, valeur }: { label: string; valeur: string }) {
    return (
        <View style={styles.recapLigne}>
            <Text style={styles.recapCle}>{label}</Text>
            <Text style={styles.recapVal} numberOfLines={3}>{valeur}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    scroll: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerTitle: { fontFamily: fonts.bold, fontSize: 15, color: C.text },
    circleBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

    progWrap: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.md },
    progLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.primary, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
    progBar: { flexDirection: 'row', gap: 5 },
    progSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
    progSegOn: { backgroundColor: C.primary },

    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: spacing.md },
    badgeText: { ...typography.button, fontSize: 11.5, color: C.primary },
    h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, color: C.text, marginBottom: spacing.sm },
    intro: { ...typography.body, color: C.textSec, lineHeight: 21, marginBottom: spacing.xl },

    label: { fontFamily: fonts.bodyBold, fontSize: 11, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 6 },
    champWrap: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.lg, paddingHorizontal: 14, ...shadows.xs },
    champLong: { paddingVertical: 10 },
    champ: { fontFamily: fonts.body, fontSize: 15, color: C.text, paddingVertical: 13 },
    ligne2: { flexDirection: 'row', gap: spacing.md },
    aide: { ...typography.bodySmall, fontSize: 12, color: C.primary, marginTop: 6 },

    puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    puce: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
    puceOn: { backgroundColor: C.primary, borderColor: C.primary },
    puceText: { fontFamily: fonts.bodyBold, fontSize: 13, color: C.text },
    puceTextOn: { color: '#FFFFFF' },
    rang: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    rangText: { fontFamily: fonts.extrabold, fontSize: 10, color: '#FFFFFF' },

    ligneAjout: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    btnAjout: { backgroundColor: C.primarySoft, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14 },
    btnAjoutText: { fontFamily: fonts.bold, fontSize: 13, color: C.primary },

    recap: { marginTop: spacing.lg, backgroundColor: C.primarySoft, borderRadius: radius.lg, padding: spacing.md },
    recapFinal: { marginTop: spacing.xl, backgroundColor: C.surfaceAlt, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
    recapLabel: { fontFamily: fonts.bold, fontSize: 10, color: C.primary, letterSpacing: 1.6, marginBottom: 6 },
    recapText: { fontFamily: fonts.bodyBold, fontSize: 14, color: C.text, lineHeight: 21 },
    recapLigne: { flexDirection: 'row', gap: spacing.md },
    recapCle: { fontFamily: fonts.bodyBold, fontSize: 11.5, color: C.textMuted, width: 84 },
    recapVal: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: C.text, lineHeight: 19 },

    barre: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: spacing.gutter, paddingTop: 12 },
    cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16 },
    ctaText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },

    finWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
    finIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    finTitre: { fontFamily: fonts.extrabold, fontSize: 24, color: C.text, textAlign: 'center' },
    finTexte: { ...typography.body, color: C.textSec, textAlign: 'center', lineHeight: 22 },
    finBtn: { marginTop: spacing.lg, backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 15 },
    finBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
    finLien: { paddingVertical: 10 },
    finLienText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: C.textMuted },
})
