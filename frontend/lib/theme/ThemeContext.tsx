'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/* ══════════════════════════════════════════════════════════════
   THEME CONTEXT — Toggle clair/sombre par panel
   Persistance localStorage par panel (chaque panel son reglage)
   Variables CSS appliquees sur un wrapper [data-theme][data-panel]
══════════════════════════════════════════════════════════════ */

export type Theme = 'light' | 'dark'
export type Panel = 'admin' | 'agent' | 'client' | 'ceo'

interface ThemeContextValue {
    theme: Theme
    panel: Panel
    toggle: () => void
    setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function storageKey(panel: Panel) {
    return `rgb-theme-${panel}`
}

export function ThemeProvider({
    panel,
    defaultTheme,
    children,
}: {
    panel: Panel
    defaultTheme: Theme
    children: ReactNode
}) {
    const [theme, setThemeState] = useState<Theme>(defaultTheme)
    const [mounted, setMounted] = useState(false)

    // Lecture localStorage au mount (evite flash SSR)
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const saved = localStorage.getItem(storageKey(panel))
            if (saved === 'light' || saved === 'dark') setThemeState(saved)
        } catch {
            /* storage indispo (private mode) — on garde defaultTheme */
        }
        setMounted(true)
    }, [panel])

    // Persistance a chaque changement
    useEffect(() => {
        if (!mounted) return
        try {
            localStorage.setItem(storageKey(panel), theme)
        } catch { /* no-op */ }
    }, [theme, panel, mounted])

    const toggle = () => setThemeState(t => (t === 'light' ? 'dark' : 'light'))
    const setTheme = (t: Theme) => setThemeState(t)

    return (
        <ThemeContext.Provider value={{ theme, panel, toggle, setTheme }}>
            <div
                data-theme={theme}
                data-panel={panel}
                style={{
                    minHeight: '100vh',
                    background: 'var(--panel-bg)',
                    color: 'var(--panel-text)',
                    transition: 'background-color 0.25s ease, color 0.25s ease',
                }}
            >
                {children}
            </div>
        </ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        // Fallback safe si utilise hors d'un Provider — retourne defaults
        return {
            theme: 'dark',
            panel: 'admin',
            toggle: () => {},
            setTheme: () => {},
        }
    }
    return ctx
}
