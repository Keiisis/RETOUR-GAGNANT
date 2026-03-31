'use client'

// ═══════════════════════════════════════════════════════
// <T> Component — Inline translation wrapper
// Usage: <T>Bienvenue chez nous</T>
// ═══════════════════════════════════════════════════════

import { useTranslation } from './useTranslation'

interface TProps {
    children: string
    vars?: Record<string, string | number>
}

export const T = ({ children, vars }: TProps) => {
    const { t } = useTranslation()
    return <>{t(children, vars)}</>
}
