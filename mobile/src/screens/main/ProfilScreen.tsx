'use strict'
import React, { useState, useEffect, useCallback } from 'react'
import { choose, confirm, toast } from '../../lib/feedback'
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity,
    Image, Platform, ActivityIndicator, Dimensions,
    Pressable, Modal,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LucideIcon } from '../../components/Icon'
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
   ProfilScreen : THEME "CORPORATE PREMIUM 2026"
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
    icon: string
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
                    <LucideIcon name={icon} size={18} color={accent ? C.accentInk : C.primary} />
                </View>
                <Text style={menuStyles.label} numberOfLines={1}>{label}</Text>
                <LucideIcon name="chevron-forward" size={18} color={C.textMuted} />
            </Animated.View>
        </Pressable>
    )
}

const menuStyles = StyleSheet.create({
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        gap: 14,
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        backgroundColor: C.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapAccent: {
        backgroundColor: C.accentSoft,
    },
    textWrap: {
        flex: 1,
    },
    label: {
        ...typography.button, fontSize: 14,
                color: C.text,
        letterSpacing: -0.1,
        flex: 1,
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
                    <ActivityIndicator color={C.primary} size="large" />
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

                {/* ═══ EN-TÊTE PROFIL (style Sleek : avatar centré) ═══ */}
                <AnimatedSection delay={100}>
                    <View style={styles.header}>
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
                            <View style={styles.editBadge}>
                                <LucideIcon name="create-outline" size={15} color={C.primaryText} />
                            </View>
                        </Pressable>

                        <Text style={styles.userName}>
                            {profile?.prenom} {profile?.nom}
                        </Text>
                        <Text style={styles.userSubtitle} numberOfLines={1}>
                            {[t('Client vérifié'), profile?.ville].filter(Boolean).join('   •   ')}
                        </Text>

                        {/* Chiffres clés (2 mini-cartes) */}
                        <View style={styles.statsRow}>
                            {[
                                /* 'Dossier' = onglet réel ; 'Appointments' = écran RDV réel. */
                                { value: stats.dossiers, label: t('Dossiers'), dest: 'Dossier' },
                                { value: stats.appointments, label: t('Rendez-vous'), dest: 'Appointments' },
                            ].map((s) => (
                                <Pressable
                                    key={s.dest}
                                    style={styles.statCard}
                                    onPress={() => navigation.navigate(s.dest as never)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${s.value} ${s.label}`}
                                    hitSlop={6}
                                >
                                    <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
                                    <Text style={styles.statValue}>{String(s.value).padStart(2, '0')}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </AnimatedSection>

                {/* ═══ MENU SECTIONS ═══ */}
                {menuSections.map((section, si) => (
                    <AnimatedSection key={si} delay={300 + si * 100}>
                        <View style={styles.sectionTitleWrap}>
                            <Text style={styles.sectionLabel}>{section.title}</Text>
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
                        <LucideIcon name="log-out-outline" size={18} color={C.error} />
                        <Text style={styles.logoutText}>{t('Se déconnecter')}</Text>
                    </TouchableOpacity>
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

    /* ── Header (style Sleek : centré) ── */
    header: { alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.lg },
    topFlag: { marginHorizontal: spacing.gutter, borderRadius: radius.pill, overflow: 'hidden' },

    /* ── Avatar ── */
    avatarOuter: { width: 112, height: 112, alignSelf: 'center', marginBottom: spacing.md },
    avatarBorder: { width: 112, height: 112, borderRadius: 40, overflow: 'hidden', backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.surface, ...shadows.cardRaised },
    avatarLoading: {
        width: 104,
        height: 104,
        borderRadius: 36,
        backgroundColor: C.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 104,
        height: 104,
        borderRadius: 36,
    },
    avatarEmoji: {
        width: 104,
        height: 104,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitialsWrap: {
        width: 104,
        height: 104,
        borderRadius: 36,
        backgroundColor: C.primaryDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        ...typography.h1, fontSize: 32,
                color: C.primaryText,
        letterSpacing: 1,
    },
    editBadge: { position: 'absolute', right: -2, bottom: 2, width: 36, height: 36, borderRadius: radius.md, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.bg },

    userName: { ...typography.h2, color: C.text, textAlign: 'center' },
    userSubtitle: { ...typography.bodySmall, color: C.textMuted, textAlign: 'center', marginTop: spacing.xs, fontWeight: '500' },

    /* ── Stats Row (2 mini-cartes) ── */
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    statCard: { alignItems: 'center', backgroundColor: C.surface, borderRadius: radius.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: C.border, ...shadows.card },
    statLabel: { ...typography.caption, fontSize: 10, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    statValue: { ...typography.h3, color: C.text },

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
        ...typography.button, fontSize: 11,
                color: C.primary,
        letterSpacing: 2,
        textTransform: 'uppercase',
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
        borderRadius: radius.xxl,
        overflow: 'hidden',
        borderWidth: 1,
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
        paddingVertical: spacing.lg,
        borderWidth: 1,
        borderColor: C.dangerSoft,
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

