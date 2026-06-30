import React from 'react'
import { View, ViewProps, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, shadows } from '../config/theme'

interface NexusCardProps extends ViewProps {
    variant?: 'glass' | 'solid' | 'elevated' | 'glow'
    children: React.ReactNode
    style?: ViewStyle | ViewStyle[]
}

export default function NexusCard({ variant = 'glass', children, style, ...props }: NexusCardProps) {
    const getVariantStyle = (): ViewStyle => {
        switch (variant) {
            case 'glass':
                return {
                    backgroundColor: colors.glass,
                    borderColor: colors.borderLight,
                    borderWidth: 1,
                }
            case 'solid':
                return {
                    backgroundColor: colors.surface,
                    borderColor: 'transparent',
                    borderWidth: 0,
                }
            case 'elevated':
                return {
                    backgroundColor: colors.surfaceWarm,
                    borderColor: colors.borderLight,
                    borderWidth: 1,
                    ...shadows.sm,
                }
            case 'glow':
                return {
                    backgroundColor: colors.headerBg,
                    borderColor: colors.primary + '30',
                    borderWidth: 1,
                    ...shadows.glow,
                }
            default:
                return {}
        }
    }

    return (
        <View style={[styles.card, getVariantStyle(), style]} {...props}>
            {children}
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        borderRadius: radius.md,
        overflow: 'hidden',
    },
})
