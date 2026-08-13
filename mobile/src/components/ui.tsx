/* ═══════════════════════════════════════════════════════════
   PRIMITIVES D'INTERFACE : Design System v2

   Pourquoi ce fichier : l'app comptait 9 composants partagés dont 7
   n'étaient importés par AUCUN écran, pendant que 33 écrans écrivaient
   chacun leur propre en-tête, leurs cartes et leurs états vides. Ces
   primitives-ci sont la traduction directe des maquettes validées et
   doivent remplacer les redéfinitions locales au fil de la migration.

   Toutes les valeurs viennent de config/theme.ts. Aucune couleur en dur.
═══════════════════════════════════════════════════════════ */

import React from 'react'
import {
    View, Text, Pressable, StyleSheet, ActivityIndicator,
    type ViewStyle, type TextStyle, type StyleProp,
} from 'react-native'
import type { LucideIcon } from 'lucide-react-native'
import { colors, flag, typography, spacing, radius, shadows, motion } from '../config/theme'

/* ── Liseré tricolore ─────────────────────────────────────
   Signature de la marque, reprise des documents officiels (factures,
   grille tarifaire). Se pose en tête d'écran ou en tête de carte. */
export function FlagBar({ height = 5, radiusTop = true }: { height?: number; radiusTop?: boolean }) {
    return (
        <View
            accessible={false}
            style={[
                styles.flagBar,
                { height },
                radiusTop && { borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
            ]}
        >
            <View style={{ flex: 46, backgroundColor: flag[0] }} />
            <View style={{ flex: 27, backgroundColor: flag[1] }} />
            <View style={{ flex: 27, backgroundColor: flag[2] }} />
        </View>
    )
}

/* ── En-tête d'écran ──────────────────────────────────────
   Titre + action optionnelle. Le liseré tricolore le surmonte. */
export function ScreenHeader({
    title,
    subtitle,
    right,
    onBack,
}: {
    title: string
    subtitle?: string
    right?: React.ReactNode
    onBack?: () => void
}) {
    return (
        <View style={styles.header}>
            <View style={styles.headerRow}>
                {onBack ? (
                    <Pressable
                        onPress={onBack}
                        accessibilityRole="button"
                        accessibilityLabel="Retour"
                        hitSlop={10}
                        style={styles.headerCircle}
                    >
                        <Text style={styles.headerBack}>‹</Text>
                    </Pressable>
                ) : null}
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle} numberOfLines={2}>{title}</Text>
                    {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
                </View>
                {right}
            </View>
        </View>
    )
}

/* ── Carte ────────────────────────────────────────────────
   Surface blanche, angle généreux, ombre douce teintée du gris de texte
   (jamais du noir pur). `flagTop` ajoute le liseré en tête. */
export function Card({
    children,
    style,
    flagTop = false,
    raised = false,
    onPress,
}: {
    children: React.ReactNode
    style?: StyleProp<ViewStyle>
    flagTop?: boolean
    raised?: boolean
    onPress?: () => void
}) {
    const content = (
        <View style={[styles.card, raised ? shadows.cardRaised : shadows.card, style]}>
            {flagTop ? <FlagBar /> : null}
            <View style={styles.cardBody}>{children}</View>
        </View>
    )
    if (!onPress) return content
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [pressed && { transform: [{ scale: motion.pressScale }] }]}
            hitSlop={6}
        >
            {content}
        </Pressable>
    )
}

/* ── Bouton ───────────────────────────────────────────────
   `primary` : vert plein, l'action attendue.
   `ghost`   : contour discret, action secondaire.
   `danger`  : rouge, réservé aux suppressions. */
export function Button({
    label,
    onPress,
    variant = 'primary',
    icon: Icon,
    loading = false,
    disabled = false,
    style,
}: {
    label: string
    onPress?: () => void
    variant?: 'primary' | 'ghost' | 'danger'
    icon?: LucideIcon
    loading?: boolean
    disabled?: boolean
    style?: StyleProp<ViewStyle>
}) {
    const off = disabled || loading
    const palette = {
        primary: { bg: colors.primary, fg: colors.textOnPrimary, border: 'transparent' },
        ghost: { bg: colors.surface, fg: colors.text, border: colors.borderStrong },
        danger: { bg: colors.danger, fg: colors.textOnPrimary, border: 'transparent' },
    }[variant]

    return (
        <Pressable
            onPress={off ? undefined : onPress}
            disabled={off}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: off, busy: loading }}
            style={({ pressed }) => [
                styles.button,
                { backgroundColor: palette.bg, borderColor: palette.border },
                variant === 'primary' && !off && shadows.action,
                off && { opacity: 0.5 },
                pressed && !off && { transform: [{ scale: motion.pressScale }] },
                style,
            ]}
            hitSlop={6}
        >
            {loading ? (
                <ActivityIndicator color={palette.fg} size="small" />
            ) : (
                <>
                    {Icon ? <Icon size={17} color={palette.fg} strokeWidth={2} /> : null}
                    <Text style={[styles.buttonLabel, { color: palette.fg }]} numberOfLines={1}>{label}</Text>
                </>
            )}
        </Pressable>
    )
}

/* ── Badge ────────────────────────────────────────────────
   `accent` (jaune) pour le premium, `success`/`danger` pour l'état. */
export function Badge({
    label,
    tone = 'accent',
    icon: Icon,
}: {
    label: string
    tone?: 'accent' | 'success' | 'danger' | 'neutral'
    icon?: LucideIcon
}) {
    const palette = {
        accent: { bg: colors.accentSoft, fg: colors.accentInk },
        success: { bg: colors.successSoft, fg: colors.primaryDark },
        danger: { bg: colors.dangerSoft, fg: colors.danger },
        neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    }[tone]
    return (
        <View style={[styles.badge, { backgroundColor: palette.bg }]}>
            {Icon ? <Icon size={13} color={palette.fg} strokeWidth={2.2} /> : null}
            <Text style={[styles.badgeLabel, { color: palette.fg }]}>{label}</Text>
        </View>
    )
}

/* ── Pastille d'icône ─────────────────────────────────────
   Le carré arrondi teinté qui précède un titre de service. */
export function IconTile({
    icon: Icon,
    tone = 'primary',
    size = 52,
}: {
    icon: LucideIcon
    tone?: 'primary' | 'accent' | 'neutral'
    size?: number
}) {
    const palette = {
        primary: { bg: colors.primarySoft, fg: colors.primary },
        accent: { bg: colors.accentSoft, fg: colors.accentInk },
        neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    }[tone]
    return (
        <View style={{
            width: size, height: size, borderRadius: radius.lg,
            backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center',
        }}>
            <Icon size={size * 0.44} color={palette.fg} strokeWidth={1.9} />
        </View>
    )
}

/* ── État vide ────────────────────────────────────────────
   Un écran vide est une invitation à agir : on nomme ce qui manque,
   on explique quand il se remplira, et on propose l'action s'il y en a une. */
export function EmptyState({
    icon: Icon,
    title,
    body,
    actionLabel,
    onAction,
}: {
    icon: LucideIcon
    title: string
    body?: string
    actionLabel?: string
    onAction?: () => void
}) {
    return (
        <View style={styles.empty}>
            <IconTile icon={Icon} size={60} />
            <Text style={styles.emptyTitle}>{title}</Text>
            {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
            {actionLabel && onAction ? (
                <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.md, alignSelf: 'center' }} />
            ) : null}
        </View>
    )
}

/* ── Séparateur de section ────────────────────────────────
   Intitulé en capitales vertes, comme « ÉTAT CIVIL & NATIONALITÉ ». */
export function SectionTitle({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
    return <Text style={[styles.sectionTitle, style]}>{children}</Text>
}

const styles = StyleSheet.create({
    flagBar: { flexDirection: 'row', width: '100%', overflow: 'hidden' },

    header: { paddingHorizontal: spacing.gutter, paddingTop: spacing.md, paddingBottom: spacing.sm },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    headerCircle: {
        width: 44, height: 44, borderRadius: radius.pill,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerBack: { fontSize: 26, lineHeight: 28, color: colors.text, marginTop: -3 },
    headerTitle: { ...typography.h1, color: colors.text },
    headerSubtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },

    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        overflow: 'hidden',
    },
    cardBody: { padding: spacing.md },

    button: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, height: 52, paddingHorizontal: spacing.lg,
        borderRadius: radius.pill, borderWidth: 1,
    },
    buttonLabel: { ...typography.button },

    badge: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill,
        alignSelf: 'flex-start',
    },
    badgeLabel: { ...typography.label, fontSize: 12 },

    empty: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
    emptyTitle: { ...typography.h3, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
    emptyBody: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', maxWidth: 300 },

    sectionTitle: { ...typography.overline, color: colors.primary, marginBottom: spacing.md },
})
