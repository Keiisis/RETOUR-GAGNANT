'use client'

import { Sun, Moon } from '@phosphor-icons/react';
import { useTheme } from '@/lib/theme/ThemeContext'

/* ══════════════════════════════════════════════════════════════
   THEME TOGGLE : Bouton Sun/Moon compact
   A placer dans le header de chaque panel
══════════════════════════════════════════════════════════════ */

export function ThemeToggle({
    className = '',
    size = 17,
}: {
    className?: string
    size?: number
}) {
    const { theme, toggle } = useTheme()
    const isDark = theme === 'dark'
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className={`relative inline-flex items-center justify-center rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95 ${className}`}
            style={{
                width: size + 18,
                height: size + 18,
                background: 'var(--panel-surface, rgba(255,255,255,0.05))',
                borderColor: 'var(--panel-border, rgba(255,255,255,0.1))',
                color: 'var(--panel-text-muted, currentColor)',
            }}
        >
            <span
                style={{
                    display: 'inline-flex',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)',
                }}
            >
                {isDark ? <Sun size={size} /> : <Moon size={size} />}
            </span>
        </button>
    )
}
