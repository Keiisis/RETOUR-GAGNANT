import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated'
import NetInfo from '@react-native-community/netinfo'
import { WifiOff } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { typography } from '../config/theme'
import { useLang } from '../contexts/LangContext'

/* ═══════════════════════════════════════════════════════════
   OfflineBanner — Displayed at top when device is offline.
   Automatically hides when connectivity is restored.
   Migrated to Reanimated (UI thread).
═══════════════════════════════════════════════════════════ */

export default function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false)
    const slide = useSharedValue(-80)
    const { t } = useLang()
    const insets = useSafeAreaInsets()

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            const offline = !(state.isConnected && state.isInternetReachable !== false)
            setIsOffline(offline)
            slide.value = withSpring(offline ? 0 : -80, { damping: 16, stiffness: 120 })
        })

        return () => unsubscribe()
    }, [slide])

    const bannerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slide.value }],
    }))

    if (!isOffline) return null

    return (
        <Animated.View
            style={[
                styles.banner,
                { paddingTop: insets.top + 8 },
                bannerStyle,
            ]}
        >
            <WifiOff size={18} color="#FFF" strokeWidth={2} />
            <Text style={styles.text}>{t('Pas de connexion Internet')}</Text>
        </Animated.View>
    )
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#E8112D',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingBottom: 12,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 20,
    },
    text: {
        ...typography.label,
        color: '#FFFFFF',
        fontSize: 14,
    },
})
