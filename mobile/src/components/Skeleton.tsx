import React, { useEffect } from 'react'
import { StyleSheet, View, ViewStyle, StyleProp, DimensionValue } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated'
import { skeletonColors, radius as themeRadius } from '../config/theme'

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient)

interface SkeletonProps {
    width?: DimensionValue
    height?: DimensionValue
    borderRadius?: number
    style?: StyleProp<ViewStyle>
}

/**
 * Skeleton shimmer pour les loading states. Utilise un gradient horizontal
 * qui translate de gauche à droite en boucle (1.4s).
 */
export default function Skeleton({
    width = '100%',
    height = 16,
    borderRadius = themeRadius.sm,
    style,
}: SkeletonProps) {
    const translateX = useSharedValue(-1)

    useEffect(() => {
        translateX.value = withRepeat(
            withTiming(1, {
                duration: 1400,
                easing: Easing.bezier(0.4, 0, 0.6, 1),
            }),
            -1,
            false,
        )
    }, [translateX])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value * 200 }],
    }))

    return (
        <View
            style={[
                styles.base,
                { width, height, borderRadius, backgroundColor: skeletonColors.base },
                style,
            ]}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
        >
            <AnimatedGradient
                colors={[skeletonColors.base, skeletonColors.highlight, skeletonColors.base]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[StyleSheet.absoluteFill, animatedStyle]}
            />
        </View>
    )
}

/* Block helpers : combos prédéfinis fréquents */

export function SkeletonText({
    lines = 3,
    lastLineWidth = '60%',
    spacing: rowSpacing = 8,
    style,
}: {
    lines?: number
    lastLineWidth?: DimensionValue
    spacing?: number
    style?: StyleProp<ViewStyle>
}) {
    return (
        <View style={style}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={12}
                    width={i === lines - 1 ? lastLineWidth : '100%'}
                    style={{ marginBottom: i < lines - 1 ? rowSpacing : 0 }}
                />
            ))}
        </View>
    )
}

export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
    return (
        <View style={[styles.card, style]}>
            <View style={styles.cardRow}>
                <Skeleton width={48} height={48} borderRadius={12} />
                <View style={styles.cardBody}>
                    <Skeleton height={14} width="80%" style={{ marginBottom: 8 }} />
                    <Skeleton height={11} width="60%" />
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    base: {
        overflow: 'hidden',
    },
    card: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0, 135, 81, 0.06)',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardBody: {
        flex: 1,
    },
})
