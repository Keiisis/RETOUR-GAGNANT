'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import { choose, confirm, toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Image, Platform, ActivityIndicator, Dimensions,
    Pressable, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    interpolateColor,
} from 'react-native-reanimated'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../config/supabase'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../navigation/AppNavigator'
import { FlagBar } from '../../components/ui'
import { useLang } from '../../contexts/LangContext'
import LanguagePicker from '../../components/LanguagePicker'
import { screenColors, typography, spacing, radius, shadows } from '../../config/theme'

/* ═══════════════════════════════════════════════════════════
   ProfilScreen — THEME "CORPORATE PREMIUM 2026"
   (Aligné avec tous les autres écrans premium)
═══════════════════════════════════════════════════════════ */

const { width } = Dimensions.get('window')

// Palette de l'agence (identique aux autres écrans)
// Palette de l'ecran : plus de copie locale. Toutes les couleurs
// viennent du design system v2 (blanc + tricolore Benin).
const C = screenColors

type Nav = NativeStackNavigationProp<RootStackParamList>

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : ANIMATED SECTION
═══════════════════════════════════════════════════════════ */

function AnimatedSection({
    children, delay = 0, style,
}: {
    children: React.ReactNode
    delay?: number
    style?: any
}) {
    const anim = useSharedValue(0)

    useEffect(() => {
        anim.value = withDelay(delay, withTiming(1, {
            duration: 800,
            easing: Easing.out(Easing.quad),
        }))
    }, [delay])

    const animStyle = useAnimatedStyle(() => ({
        opacity: anim.value,
        transform: [{ translateY: 30 * (1 - anim.value) }],
    }))

    return <Animated.View style={[animStyle, style]}>{children}</Animated.View>
}

/* ═══════════════════════════════════════════════════════════
   COMPOSANT : MENU ITEM (avec press feedback)
═══════════════════════════════════════════════════════════ */

function MenuItem({
    icon, label, sub, onPress, isLast, accent,
}: {
    icon: keyof typeof Ionicons.glyphMap
    label: string
    sub: string
    onPress: () => void
    isLast: boolean
    accent?: boolean
}) {
    const pressAnim = useSharedValue(0)

    const animStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            pressAnim.value, [0, 1],
            ['rgba(0, 135, 81, 0)', 'rgba(0, 135, 81, 0.04)']
        ),
    }))

    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { pressAnim.value = withSpring(1) }}
            onPressOut={() => { pressAnim.value = withSpring(0) }}
            accessibilityRole="button"
            hitSlop={6}
        >
            <Animated.View style={[menuStyles.item, !isLast && menuStyles.itemBorder, animStyle]}>
                <View style={[menuStyles.iconWrap, accent && menuStyles.iconWrapAccent]}>
                    <Ionicons name={icon} size={18} color={accent ? C.accent : C.primary} />
                </View>
                <View style={menuStyles.textWrap}>
                    <Text style={menuStyles.label}>{label}</Text>
                    <Text style={menuStyles.sub} numberOfLines={1}>{sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </Animated.View>
        </Pressable>
    )
}

const menuStyles = StyleSheet.create({
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: 12,
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: radius.sm,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.border,
    },
    iconWrapAccent: {
        backgroundColor: C.accentSoft,
        borderColor: C.border,
    },
    textWrap: {
        flex: 1,
    },
    label: {
        ...typography.button, fontSize: 13.5,
                color: C.primary,
        letterSpacing: -0.1,
    },
    sub: {
        ...typography.caption,
        color: C.textSec,
                marginTop: spacing.xxs,
    },
})

/* ═══════════════════════════════════════════════════════════
   ÉCRAN PRINCIPAL : PROFIL
═══════════════════════════════════════════════════════════ */

export default function ProfilScreen() {
    const { profile, signOut, updateProfile, refreshProfile } = useAuth()
    const navigation = useNavigation<Nav>()
    const insets = useSafeAreaInsets()
    const { langConfig, t } = useLang()
    const [langPickerVisible, setLangPickerVisible] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [stats, setStats] = useState({ dossiers: 0, appointments: 0, payments: 0 })

    /* ── Animations Corporate ── */
    const headerAnim = useSharedValue(0)

    useEffect(() => {
        headerAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) })
    }, [])


    const styleHeader = useAnimatedStyle(() => ({
        opacity: headerAnim.value,
        transform: [{ translateY: 30 * (1 - headerAnim.value) }],
    }))


    /* ── Avatars animés prédéfinis par genre ── */

    useEffect(() => {
        if (!profile) return
        Promise.all([
            supabase.from('dossiers').select('*', { count: 'exact', head: true }).eq('client_id', profile.id),
            supabase.from('appointments').select('*', { count: 'exact', head: true })
                .eq('client_id', profile.id).neq('status', 'cancelled'),
            supabase.from('paiements').select('*', { count: 'exact', head: true })
                .eq('client_id', profile.id).eq('status', 'success'),
        ]).then(([d, a, p]) => {
            setStats({ dossiers: d.count || 0, appointments: a.count || 0, payments: p.count || 0 })
        }).catch(() => { })
    }, [profile])

    const initials = ((profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')).toUpperCase() || 'CL'

    /* ── Calcul de la complétion du profil ── */
    const profileFields = [
        profile?.prenom,
        profile?.nom,
        profile?.phone,
        profile?.ville,
        profile?.avatar_url || profile?.avatar_preset,
    ]
    const completionPercent = Math.round(
        (profileFields.filter(f => !!f).length / profileFields.length) * 100
    )

    /* ── Upload photo de profil ── */
    const handlePickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
            toast(t('Permission requise'), t("Veuillez autoriser l'accès à votre galerie dans les paramètres de l'application."))
            return
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        })

        if (result.canceled || !result.assets[0]) return

        const asset = result.assets[0]
        const userId = profile?.id
        if (!userId) return

        setUploadingAvatar(true)
        try {
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
            })

            const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg'
            const fileName = `avatar_${userId}_${Date.now()}.${ext}`
            const filePath = `${userId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(base64), {
                    contentType: asset.mimeType || `image/${ext}`,
                    upsert: true,
                })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            await supabase.from('client_profiles').update({
                avatar_url: publicUrl, avatar_type: 'photo', avatar_preset: null,
            }).eq('id', userId)
            await refreshProfile()

            toast(t('Photo mise à jour'), t('Votre photo de profil a été modifiée avec succès.'))
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('Erreur lors du téléchargement')
            toast(t('Erreur'), msg)
        } finally {
            setUploadingAvatar(false)
        }
    }

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync()
        if (status !== 'granted') {
            toast(t('Permission requise'), t('Accès à la caméra refusé.'))
            return
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        })

        if (result.canceled || !result.assets[0]) return

        const asset = result.assets[0]
        const userId = profile?.id
        if (!userId) return

        setUploadingAvatar(true)
        try {
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
            })
            const fileName = `avatar_${userId}_${Date.now()}.jpg`
            const filePath = `${userId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(base64), { contentType: 'image/jpeg', upsert: true })

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
            await supabase.from('client_profiles').update({
                avatar_url: publicUrl, avatar_type: 'photo', avatar_preset: null,
            }).eq('id', userId)
            await refreshProfile()

            toast(t('Photo mise à jour'), t('Photo de profil modifiée avec succès.'))
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('Erreur lors du téléchargement')
            toast(t('Erreur'), msg)
        } finally {
            setUploadingAvatar(false)
        }
    }


    const showAvatarOptions = () => {
        choose({
            title: t('Photo de profil'),
            message: t('Choisissez une option'),
            cancelLabel: t('Annuler'),
            options: [
                { label: t('Prendre une photo'), onPress: handleTakePhoto },
                { label: t('Choisir dans la galerie'), onPress: handlePickAvatar },
            ],
        })
    }

    const handleLogout = () => {
        confirm({
            title: t('Déconnexion'),
            message: t('Êtes-vous sûr de vouloir vous déconnecter ?'),
            confirmLabel: t('Se déconnecter'),
            cancelLabel: t('Annuler'),
            destructive: true,
            onConfirm: signOut,
        })
    }

    const menuSections = [
        {
            title: t('COMPTE'),
            items: [
                {
                    icon: 'person-outline' as const,
                    label: t('Informations personnelles'),
                    sub: t('Modifier votre profil'),
                    onPress: () => navigation.navigate('EditProfil'),
                    accent: true,
                },
                {
                    icon: 'card-outline' as const,
                    label: t('Paiements'),
                    sub: t('Historique et méthodes'),
                    onPress: () => navigation.navigate('Payments'),
                },
                {
                    icon: 'receipt-outline' as const,
                    label: t('Mes factures'),
                    sub: t('Historique facturation'),
                    onPress: () => navigation.navigate('Invoices'),
                },
                {
                    icon: 'cube-outline' as const,
                    label: t('Mes commandes'),
                    sub: t('Suivi de vos colis'),
                    onPress: () => navigation.navigate('Orders'),
                },
                {
                    icon: 'calendar-outline' as const,
                    label: t('Mes rendez-vous'),
                    sub: t('Prochains RDV'),
                    onPress: () => navigation.navigate('Appointments'),
                },
                {
                    icon: 'create-outline' as const,
                    label: t('Ma signature'),
                    sub: t('Signer factures et devis'),
                    onPress: () => navigation.navigate('Signature'),
                },
            ],
        },
        {
            title: t('MON PARCOURS'),
            items: [
                {
                    icon: 'git-network-outline' as const,
                    label: t('Plan de composition de famille'),
                    sub: t('Votre arbre généalogique'),
                    onPress: () => navigation.navigate('Genealogie'),
                    accent: true,
                },
                {
                    icon: 'sparkles-outline' as const,
                    label: t('Prêtres Fa & Racines'),
                    sub: t('Consulter et réserver'),
                    onPress: () => navigation.navigate('Fa'),
                },
            ],
        },
        {
            title: t('PRÉFÉRENCES'),
            items: [
                {
                    icon: 'language-outline' as const,
                    label: t("Langue de l'application"),
                    sub: `${langConfig.flag}  ${langConfig.nativeLabel}`,
                    onPress: () => setLangPickerVisible(true),
                    accent: true,
                },
                {
                    icon: 'notifications-outline' as const,
                    label: t('Notifications'),
                    sub: t('Gérer les alertes'),
                    onPress: () => navigation.navigate('Notifications'),
                },
                {
                    icon: 'shield-checkmark-outline' as const,
                    label: t('Sécurité & Mot de passe'),
                    sub: t('Modifier le mot de passe'),
                    onPress: () => navigation.navigate('Security'),
                },
            ],
        },
        {
            title: t('SUPPORT'),
            items: [
                {
                    icon: 'help-circle-outline' as const,
                    label: t('Aide & FAQ'),
                    sub: t('Questions fréquentes'),
                    onPress: () => navigation.navigate('FAQ'),
                },
                {
                    icon: 'information-circle-outline' as const,
                    label: t('À propos'),
                    sub: t('Version et mentions légales'),
                    onPress: () => navigation.navigate('About'),
                },
                {
                    icon: 'document-text-outline' as const,
                    label: t('CGU & Confidentialité'),
                    sub: t('Conditions et politique de données'),
                    onPress: () => navigation.navigate('Legal'),
                },
            ],
        },
    ]

    /* ── Rendu de l'avatar (image / preset / initiales) ── */
    const renderAvatarContent = () => {
        if (uploadingAvatar) {
            return (
                <View style={styles.avatarLoading}>
                    <ActivityIndicator color={C.accent} size="large" />
                </View>
            )
        }
        if (profile?.avatar_url) {
            return <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
        }
        return (
            <View style={styles.avatarInitialsWrap}>
                <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>

            <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* LISERÉ TRICOLORE */}
                <View style={[styles.topFlag, { marginTop: insets.top + 8 }]}>
                    <FlagBar height={6} radiusTop={false} />
                </View>

                {/* EN-TÊTE */}
                <View style={styles.navBar}>
                    <Text style={styles.navTitle}>{t('Mon profil')}</Text>
                    <Pressable
                        onPress={() => navigation.navigate('EditProfil')}
                        accessibilityRole="button"
                        accessibilityLabel={t('Modifier mon profil')}
                        hitSlop={8}
                        style={styles.navEditBtn}
                    >
                        <Ionicons name="create-outline" size={19} color={C.primary} />
                    </Pressable>
                </View>

                {/* ═══ CARTE IDENTITÉ ═══ */}
                <AnimatedSection delay={100}>
                    <View style={styles.profileCard}>
                        <FlagBar height={5} radiusTop={false} />

                        <View style={styles.profileBody}>
                            <Pressable
                                style={styles.avatarOuter}
                                onPress={showAvatarOptions}
                                disabled={uploadingAvatar}
                                accessibilityRole="button"
                                accessibilityLabel={t('Changer ma photo de profil')}
                                hitSlop={6}
                            >
                                <View style={styles.avatarBorder}>
                                    {renderAvatarContent()}
                                </View>
                                <View style={styles.cameraBadge}>
                                    <Ionicons name="camera" size={14} color={C.primaryText} />
                                </View>
                            </Pressable>

                            <Text style={styles.userName}>
                                {profile?.prenom} {profile?.nom}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                                {profile?.email}
                            </Text>

                            <View style={styles.badgesRow}>
                                <View style={styles.roleBadge}>
                                    <Ionicons name="shield-checkmark" size={13} color={C.primary} />
                                    <Text style={styles.roleText}>{t('Client vérifié')}</Text>
                                </View>
                                {profile?.ville ? (
                                    <View style={styles.villeBadge}>
                                        <Ionicons name="location-outline" size={13} color={C.accentInk} />
                                        <Text style={styles.villeText}>{profile.ville}</Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={styles.completionWrap}>
                                <View style={styles.completionHeader}>
                                    <Text style={styles.completionLabel}>
                                        {t('Profil complété')}
                                    </Text>
                                    <Text style={styles.completionPercent}>
                                        {completionPercent}%
                                    </Text>
                                </View>
                                <View
                                    accessible
                                    accessibilityRole="progressbar"
                                    accessibilityLabel={`${t('Profil complété')} ${completionPercent}%`}
                                    style={styles.completionBar}
                                >
                                    <View
                                        style={[
                                            styles.completionFill,
                                            { width: `${completionPercent}%` },
                                        ]}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ CHIFFRES CLÉS ═══ */}
                <AnimatedSection delay={200}>
                    <View style={styles.statsRow}>
                        {[
                            /* 'Dossier' est l'onglet réel ; 'MyServices' n'existe
                               dans aucun navigateur — l'ancien lien était mort. */
                            { icon: 'folder-open' as const, value: stats.dossiers, label: t('Dossiers'), dest: 'Dossier' },
                            { icon: 'calendar' as const, value: stats.appointments, label: t('Rendez-vous'), dest: 'Appointments' },
                            { icon: 'card' as const, value: stats.payments, label: t('Paiements'), dest: 'Payments' },
                        ].map((s) => (
                            <Pressable
                                key={s.dest}
                                style={styles.statCard}
                                onPress={() => navigation.navigate(s.dest as never)}
                                accessibilityRole="button"
                                accessibilityLabel={`${s.value} ${s.label}`}
                                hitSlop={6}
                            >
                                <View style={styles.statIconWrap}>
                                    <Ionicons name={s.icon} size={20} color={C.primary} />
                                </View>
                                <Text style={styles.statValue}>{s.value}</Text>
                                <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </AnimatedSection>

                {/* ═══ MENU SECTIONS ═══ */}
                {menuSections.map((section, si) => (
                    <AnimatedSection key={si} delay={300 + si * 100}>
                        <View style={styles.sectionTitleWrap}>
                            <Text style={styles.sectionLabel}>{section.title}</Text>
                            <View style={styles.sectionUnderline} />
                        </View>

                        <View style={styles.menuCard}>
                            {section.items.map((item, ii) => (
                                <MenuItem
                                    key={ii}
                                    icon={item.icon}
                                    label={item.label}
                                    sub={item.sub}
                                    onPress={item.onPress}
                                    isLast={ii === section.items.length - 1}
                                    accent={(item as any).accent}
                                />
                            ))}
                        </View>
                    </AnimatedSection>
                ))}

                {/* ═══ DÉCONNEXION ═══ */}
                <AnimatedSection delay={650}>
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        onPress={handleLogout}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        hitSlop={6}
                    >
                        <View style={styles.logoutIconWrap}>
                            <Ionicons name="log-out-outline" size={18} color={C.error} />
                        </View>
                        <Text style={styles.logoutText}>{t('Se déconnecter')}</Text>
                    </TouchableOpacity>
                </AnimatedSection>

                {/* ═══ FOOTER ═══ */}
                <AnimatedSection delay={750}>
                    <View style={styles.footerWrap}>
                        <View style={styles.footerDivider}>
                            <View style={styles.dividerLine} />
                            <View style={styles.dividerDot} />
                            <View style={styles.dividerLine} />
                        </View>
                        <Text style={styles.version}>Retour Gagnant Bénin</Text>
                        <Text style={styles.versionSub}>v1.0.0 · {t('Fait avec excellence à Cotonou')}</Text>
                    </View>
                </AnimatedSection>
            </ScrollView>

            <LanguagePicker
                visible={langPickerVisible}
                onClose={() => setLangPickerVisible(false)}
            />

        </View>
    )
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.bg,
    },

    scroll: {
        paddingBottom: spacing.gutter,
    },

    /* ── Nav Bar ── */
    navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
    navTitle: { ...typography.h1, color: C.text, flex: 1 },
    navEditBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },

    /* ── Header ── */

    /* ── Profile Card (Hero bleu massif) ── */
    profileBody: { padding: spacing.lg },
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },
    profileCard: { backgroundColor: C.surface, borderRadius: radius.xl, marginHorizontal: spacing.gutter, marginBottom: spacing.md, overflow: 'hidden', ...shadows.cardRaised },

    /* ── Avatar ── */
    avatarOuter: { width: 96, height: 96, alignSelf: 'center', marginBottom: spacing.md },
    avatarBorder: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    avatarLoading: {
        width: 94,
        height: 94,
        borderRadius: 47,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 94,
        height: 94,
        borderRadius: 47,
    },
    avatarEmoji: {
        width: 94,
        height: 94,
        borderRadius: 47,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitialsWrap: {
        width: 94,
        height: 94,
        borderRadius: 47,
        backgroundColor: C.primaryDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        ...typography.h1, fontSize: 32,
                color: C.accent,
        letterSpacing: 1,
    },
    cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRadius: 17, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },

    userName: { ...typography.h2, color: C.text, textAlign: 'center' },
    userEmail: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginTop: spacing.xs },

    /* ── Badges ── */
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: C.primarySoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
    roleText: { ...typography.label, fontSize: 12, color: C.primary },
    villeBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: C.accentSoft, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
    villeText: { ...typography.label, fontSize: 12, color: C.accentInk },

    /* ── Completion ── */
    completionWrap: { marginTop: spacing.lg },
    completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    completionLabel: { ...typography.label, color: C.textMuted },
    completionPercent: { ...typography.label, color: C.primary },
    completionBar: { height: 8, borderRadius: radius.pill, backgroundColor: C.surfaceAlt, overflow: 'hidden' },
    completionFill: { height: '100%', borderRadius: radius.pill, backgroundColor: C.primary },

    /* ── Stats Row ── */
    statsRow: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.gutter, marginBottom: spacing.lg },
    statCard: { flex: 1, alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.xl, paddingVertical: spacing.md, gap: spacing.xs, ...shadows.card },
    statIconWrap: { width: 44, height: 44, borderRadius: radius.lg, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
    statValue: { ...typography.h2, color: C.text },
    statLabel: { ...typography.caption, color: C.textMuted },

    /* ── Section Titles ── */
    sectionTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginHorizontal: spacing.gutter,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    sectionLabel: {
        ...typography.button, fontSize: 12,
                color: C.accentDark,
        letterSpacing: 1.5,
    },
    sectionUnderline: {
        flex: 1,
        height: 1,
        backgroundColor: C.border,
    },

    /* ── Menu Card ── */
    menuCard: {
        marginHorizontal: spacing.gutter,
        backgroundColor: C.surface,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1.2,
        borderColor: C.border,
        marginBottom: spacing.md,
        ...shadows.card,
    },

    /* ── Logout ── */
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginHorizontal: spacing.gutter,
        marginTop: spacing.sm,
        backgroundColor: C.dangerSoft,
        borderRadius: radius.lg,
        paddingVertical: spacing.md,
        borderWidth: 1.2,
        borderColor: C.danger,
    },
    logoutIconWrap: {
        width: 32,
        height: 32,
        borderRadius: radius.xs,
        backgroundColor: C.dangerSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoutText: {
        ...typography.button, fontSize: 14,
                color: C.error,
        letterSpacing: 0.2,
    },

    /* ── Footer ── */
    footerWrap: {
        alignItems: 'center',
        marginTop: 28,
    },
    footerDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    dividerLine: {
        width: 40,
        height: 1,
        backgroundColor: C.accent,
        opacity: 0.4,
    },
    dividerDot: {
        width: 6,
        height: 6,
        backgroundColor: C.accent,
        transform: [{ rotate: '45deg' }],
    },
    version: {
        ...typography.button, fontSize: 13,
        color: C.primary,
                textAlign: 'center',
        letterSpacing: 0.2,
    },
    versionSub: {
        fontSize: 12,
        color: C.textMuted,
        textAlign: 'center',
        marginTop: spacing.xs,
        fontStyle: 'italic',
        letterSpacing: 0.2,
    },
})

/* ═══════════════════════════════════════════════════════════
   STYLES MODAL GALERIE
═══════════════════════════════════════════════════════════ */

