import React from 'react'
import { Pressable, StyleProp, ViewStyle, GestureResponderEvent } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { motion } from '../config/theme'

type HapticStrength = 'light' | 'medium' | 'heavy' | 'selection' | 'none'

interface PressableCardProps {
    children: React.ReactNode
    onPress?: (e: GestureResponderEvent) => void
    onLongPress?: (e: GestureResponderEvent) => void
    style?: StyleProp<ViewStyle>
    disabled?: boolean
    haptic?: HapticStrength
    pressScale?: number
    accessibilityLabel?: string
    accessibilityHint?: string
    testID?: string
}

const triggerHaptic = (strength: HapticStrength) => {
    if (strength === 'none') return
    try {
        switch (strength) {
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                break
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                break
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                break
            case 'selection':
                Haptics.selectionAsync()
                break
        }
    } catch {
        // Haptics indisponibles (Expo Go ou device sans support) : silencieux
    }
}

export default function PressableCard({
    children,
    onPress,
    onLongPress,
    style,
    disabled = false,
    haptic = 'light',
    pressScale = motion.pressScale,
    accessibilityLabel,
    accessibilityHint,
    testID,
}: PressableCardProps) {
    const scale = useSharedValue(1)
    const opacity = useSharedValue(1)

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }))

    const handlePressIn = () => {
        if (disabled) return
        scale.value = withSpring(pressScale, motion.spring.snappy)
        opacity.value = withTiming(0.92, { duration: motion.fast })
    }

    const handlePressOut = () => {
        if (disabled) return
        scale.value = withSpring(1, motion.spring.snappy)
        opacity.value = withTiming(1, { duration: motion.fast })
    }

    const handlePress = (e: GestureResponderEvent) => {
        if (disabled) return
        triggerHaptic(haptic)
        onPress?.(e)
    }

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            onLongPress={onLongPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled }}
            testID={testID}
            hitSlop={6}
        >
            <Animated.View style={[style, animatedStyle, disabled && { opacity: 0.5 }]}>
                {children}
            </Animated.View>
        </Pressable>
    )
}
