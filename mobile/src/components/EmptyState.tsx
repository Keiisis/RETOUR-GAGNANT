import React from 'react'
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { LucideIcon } from 'lucide-react-native'
import { colors, spacing, radius, typography, shadows } from '../config/theme'
import PressableCard from './PressableCard'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    body?: string
    cta?: {
        label: string
        onPress: () => void
        icon?: LucideIcon
    }
    variant?: 'soft' | 'plain'
    style?: StyleProp<ViewStyle>
}

/**
 * EmptyState : fallback unifié pour les listes vides ou les zones sans data.
 * - icon : LucideIcon affiché dans un cercle dégradé doré
 * - cta optionnel : bouton primary émeraude
 * - variant 'soft' (défaut) : carte avec bordure ; 'plain' : juste le contenu
 */
export default function EmptyState({
    icon: Icon,
    title,
    body,
    cta,
    variant = 'soft',
    style,
}: EmptyStateProps) {
    const Wrapper = (
        <View style={[variant === 'soft' ? styles.card : styles.plain, style]}>
            <LinearGradient
                colors={[colors.goldSoft, '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconCircle}
            >
                <Icon size={32} color={colors.primary} strokeWidth={1.6} />
            </LinearGradient>

            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}

            {cta && (
                <PressableCard
                    haptic="medium"
                    onPress={cta.onPress}
                    style={styles.cta}
                    accessibilityLabel={cta.label}
                >
                    {cta.icon ? (
                        <cta.icon size={16} color="#FFF" strokeWidth={2} style={{ marginRight: 8 }} />
                    ) : null}
                    <Text style={styles.ctaText}>{cta.label}</Text>
                </PressableCard>
            )}
        </View>
    )

    return Wrapper
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...shadows.xs,
    },
    plain: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderGold,
        ...shadows.gold,
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: 6,
        textAlign: 'center',
    },
    body: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.md,
        maxWidth: 320,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        borderRadius: radius.md,
        marginTop: spacing.xs,
        ...shadows.primary,
    },
    ctaText: {
        ...typography.button,
        color: '#FFFFFF',
    },
})
