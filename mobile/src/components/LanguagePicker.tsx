import React, { useEffect } from 'react'
import {
    View, Text, StyleSheet, TouchableOpacity,
    Modal, Dimensions, Platform, Pressable,
} from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { Check, ChevronRight, Globe, X } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLang, SUPPORTED_LANGUAGES, type LangCode } from '../contexts/LangContext'
import { colors, spacing, radius, typography, shadows } from '../config/theme'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_H = SCREEN_H * 0.62

interface LanguagePickerProps {
    visible: boolean
    onClose: () => void
}

export default function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
    const { lang, setLang, t } = useLang()
    const slide = useSharedValue(SHEET_H)
    const fade = useSharedValue(0)

    // ── Open / close animation ──
    useEffect(() => {
        if (visible) {
            fade.value = withTiming(1, { duration: 240 })
            slide.value = withSpring(0, { damping: 22, stiffness: 260 })
        } else {
            fade.value = withTiming(0, { duration: 180 })
            slide.value = withTiming(SHEET_H, { duration: 200 })
        }
    }, [visible, fade, slide])

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: fade.value,
    }))

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slide.value }],
    }))

    const handleSelect = (code: LangCode) => {
        setLang(code)
        setTimeout(onClose, 140)
    }

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onClose}>
            {/* Backdrop */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }, backdropStyle]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer"
                    hitSlop={6}/>
            </Animated.View>

            {/* Bottom sheet */}
            <Animated.View style={[styles.sheet, sheetStyle]}>
                {/* Handle */}
                <View style={styles.handle}/>

                {/* Header */}
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.sheetHeader}>
                    {/* Gold accent line */}
                    <View style={styles.goldAccent}/>

                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.headerTitle}>{t("Langue de l'application")}</Text>
                            <Text style={styles.headerSub}>
                                {t('Choisissez votre langue préférée')}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Fermer"
                            hitSlop={6}>
                            <X size={18} color={colors.gold} strokeWidth={1.75} />
                        </TouchableOpacity>
                    </View>

                    {/* Active language badge */}
                    <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeFlag}>
                            {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.flag}
                        </Text>
                        <Text style={styles.activeBadgeText}>
                            {SUPPORTED_LANGUAGES.find(l => l.code === lang)?.nativeLabel}
                        </Text>
                        <View style={styles.activeDot}/>
                    </View>
                </LinearGradient>

                {/* Language list */}
                <View style={styles.list}>
                    {SUPPORTED_LANGUAGES.map((item, index) => {
                        const isSelected = item.code === lang
                        const isLast = index === SUPPORTED_LANGUAGES.length - 1

                        return (
                            <TouchableOpacity
                                key={item.code}
                                style={[
                                    styles.langItem,
                                    isSelected && styles.langItemActive,
                                    !isLast && styles.langItemBorder,
                                ]}
                                onPress={() => handleSelect(item.code)}
                                activeOpacity={0.65}
                                accessibilityRole="button"
                                hitSlop={6}
                            >
                                {/* Flag */}
                                <View style={[styles.flagWrap, isSelected && styles.flagWrapActive]}>
                                    <Text style={styles.flag}>{item.flag}</Text>
                                </View>

                                {/* Labels */}
                                <View style={styles.langLabels}>
                                    <Text style={[styles.nativeLabel, isSelected && styles.nativeLabelActive]}>
                                        {item.nativeLabel}
                                    </Text>
                                    <Text style={styles.frenchLabel}>{item.label}</Text>
                                </View>

                                {/* Check or arrow */}
                                {isSelected ? (
                                    <View style={styles.checkWrap}>
                                        <LinearGradient
                                            colors={[colors.gold, colors.goldDark]}
                                            style={styles.checkGradient}
                                        >
                                            <Check size={14} color="#FFF" strokeWidth={1.75} />
                                        </LinearGradient>
                                    </View>
                                ) : (
                                    <ChevronRight size={16} color={colors.border} strokeWidth={1.75} />
                                )}
                            </TouchableOpacity>
                        )
                    })}
                </View>

                {/* Footer note */}
                <View style={styles.footer}>
                    <Globe size={13} color={colors.textMuted} strokeWidth={1.75} />
                    <Text style={styles.footerText}>
                        {t('La traduction est automatique et propulsée par IA')}
                    </Text>
                </View>

                {/* Safe area padding */}
                <View style={{ height: Platform.OS === 'ios' ? 28 : 12 }}/>
            </Animated.View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    sheet: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        ...shadows.lg,
        overflow: 'hidden',
    },

    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center', marginTop: 10, marginBottom: 0,
    },

    // ── Header ──
    sheetHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
    },
    goldAccent: {
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2, backgroundColor: colors.gold,
    },
    headerContent: {
        flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerTitle: {
        ...typography.h3,
        color: colors.textOnDark,
        fontSize: 16,
    },
    headerSub: {
        ...typography.caption,
        color: colors.gold + '99',
        marginTop: 2,
    },
    closeBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: colors.gold + '15',
        alignItems: 'center', justifyContent: 'center',
    },
    activeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.gold + '12',
        borderRadius: radius.sm, borderWidth: 1, borderColor: colors.gold + '25',
        paddingHorizontal: 12, paddingVertical: 7,
        alignSelf: 'flex-start',
    },
    activeBadgeFlag: { fontSize: 18 },
    activeBadgeText: {
        ...typography.label,
        color: colors.goldLight,
        fontSize: 13,
    },
    activeDot: {
        width: 7, height: 7, borderRadius: 3.5,
        backgroundColor: colors.success,
        marginLeft: 2,
    },

    // ── List ──
    list: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.borderLight,
        overflow: 'hidden',
    },
    langItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing.md, paddingVertical: 13,
        gap: 12,
    },
    langItemActive: {
        backgroundColor: colors.goldMuted,
    },
    langItemBorder: {
        borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },

    flagWrap: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: colors.background,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.borderLight,
    },
    flagWrapActive: {
        borderColor: colors.gold + '40',
        backgroundColor: colors.goldShimmer,
    },
    flag: { fontSize: 24 },

    langLabels: { flex: 1 },
    nativeLabel: {
        ...typography.label, fontSize: 15,
        color: colors.textPrimary,
    },
    nativeLabelActive: { color: colors.textGold },
    frenchLabel: {
        ...typography.caption,
        color: colors.textMuted, marginTop: 2,
    },

    checkWrap: { width: 28, height: 28 },
    checkGradient: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        ...shadows.gold,
    },

    // ── Footer ──
    footer: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginHorizontal: spacing.lg, marginTop: spacing.md,
        paddingHorizontal: 12, paddingVertical: 8,
        backgroundColor: colors.navyMuted,
        borderRadius: radius.sm,
    },
    footerText: {
        ...typography.caption, fontSize: 12,
        color: colors.textMuted, flex: 1,
    },
})
