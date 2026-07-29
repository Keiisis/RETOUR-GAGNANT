'use strict'
import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft } from 'lucide-react-native'

import { royal, fonts } from '../config/theme'

interface ScreenHeaderProps {
    title: string
    subtitle?: string
    onBack?: () => void
    rightAction?: React.ReactNode
}

/**
 * Premium header component matching the Boutique/Orders style.
 * Green gradient background with rounded bottom corners,
 * gold-accented title badge, and optional back/right actions.
 */
export default function ScreenHeader({ title, subtitle, onBack, rightAction }: ScreenHeaderProps) {
    const insets = useSafeAreaInsets()
    return (
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <View style={styles.headerBgWrap}>
                <LinearGradient colors={[royal.deepEmerald, royal.deepLightEmerald]} style={StyleSheet.absoluteFillObject} />
            </View>
            <View style={styles.headerTopRow}>
                {onBack ? (
                    <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}
                        accessibilityRole="button"
                        hitSlop={6}
                        accessibilityLabel="Retour">
                        <ArrowLeft size={24} color="#FFF" strokeWidth={2} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 44 }} />
                )}

                <View style={styles.stickyTitleWrapper}>
                    <View style={styles.titleDot} />
                    <Text style={styles.stickyTitle} numberOfLines={1}>{title.toUpperCase()}</Text>
                    <View style={styles.titleDot} />
                </View>

                {rightAction || <View style={{ width: 44 }} />}
            </View>
            {subtitle ? (
                <Text style={styles.headerSub}>{subtitle}</Text>
            ) : null}
        </View>
    )
}

const styles = StyleSheet.create({
    header: {
        paddingBottom: 24,
        paddingHorizontal: 20,
        shadowColor: royal.deepEmerald,
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 15,
        backgroundColor: 'transparent',
    },
    headerBgWrap: {
        ...StyleSheet.absoluteFillObject,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        overflow: 'hidden',
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    stickyTitleWrapper: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(220,165,64,0.15)',
        paddingHorizontal: 20, paddingVertical: 8,
        borderRadius: 24, borderWidth: 1, borderColor: 'rgba(220,165,64,0.3)',
        flexShrink: 1,
    },
    stickyTitle: {
        fontFamily: 'PlayfairDisplay_700Bold', fontSize: 14,
        color: royal.gold, letterSpacing: 2, textTransform: 'uppercase',
    },
    titleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: royal.gold, opacity: 0.8 },
    headerSub: {
        fontFamily: fonts.bodyMedium, fontSize: 14,
        color: royal.goldSoft, textAlign: 'center', fontStyle: 'italic',
        marginTop: 4,
    },
})
