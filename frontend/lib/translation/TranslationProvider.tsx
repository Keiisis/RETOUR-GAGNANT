'use client'

// ═══════════════════════════════════════════════════════
// Translation Engine : React Context Provider
// Manages active language, loads translations from cache,
// provides t() function for all components.
// ═══════════════════════════════════════════════════════

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { usePathname } from 'next/navigation'
import { type LangCode, DEFAULT_LANG, LANG_COOKIE_NAME, DASHBOARD_LANG_COOKIE, SUPPORTED_LANGUAGES, isValidLang } from './constants'
import { hashText } from './hash'
import { extractBrands } from './brands'

interface TranslationContextType {
    lang: LangCode
    setLang: (lang: LangCode) => void
    t: (text: string, vars?: Record<string, string | number>) => string
    isLoading: boolean
    translationCount: number
}

export const TranslationContext = createContext<TranslationContextType>({
    lang: DEFAULT_LANG,
    setLang: () => { },
    t: (text: string) => text,
    isLoading: false,
    translationCount: 0,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Pending translations queue (to batch API calls)
let pendingTexts: Set<string> = new Set()
let pendingTimer: ReturnType<typeof setTimeout> | null = null

export function TranslationProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG)
    const [cache, setCache] = useState<Map<string, string>>(new Map())
    const [isLoading, setIsLoading] = useState(false)
    // Pas de demande à l'IA avant la fin du chargement (dictionnaire + base) : sinon chaque texte de la page
    // partait à /api/translate au premier rendu, la limite par IP tombait et des pans entiers restaient en français.
    const charge = useRef(false)
    const pathname = usePathname()

    // Read language from cookie on mount
    useEffect(() => {
        const isDashboard = pathname?.startsWith('/admin') || pathname?.startsWith('/agent')

        if (isDashboard) {
            const dashboardCookieMatch = document.cookie.match(new RegExp(`${DASHBOARD_LANG_COOKIE}=([a-z]{2})`))
            if (dashboardCookieMatch && isValidLang(dashboardCookieMatch[1])) {
                setLangState(dashboardCookieMatch[1] as LangCode)
            } else {
                setLangState(DEFAULT_LANG)
            }
        } else {
            const cookieMatch = document.cookie.match(new RegExp(`${LANG_COOKIE_NAME}=([a-z]{2})`))
            if (cookieMatch && isValidLang(cookieMatch[1])) {
                setLangState(cookieMatch[1] as LangCode)
            } else {
                // Auto-detect from browser
                const browserLang = navigator.language.split('-')[0]
                const detectedLangs: Record<string, LangCode> = {
                    fr: 'fr', en: 'en', es: 'es', pt: 'pt', ht: 'ht',
                }
                const detected = detectedLangs[browserLang] || DEFAULT_LANG
                setLangState(detected)
                document.cookie = `${LANG_COOKIE_NAME}=${detected};path=/;max-age=${365 * 24 * 3600};SameSite=Lax`
            }
        }
    }, [pathname])

    // Load translations from Supabase when language changes
    useEffect(() => {
        if (lang === 'fr') {
            setCache(new Map())
            return
        }

        const loadTranslations = async () => {
            charge.current = false
            setIsLoading(true)
            // 1. Dictionnaire statique versionné (lib/translation/dict/<lang>.json) : toute l'interface,
            //    disponible sans réseau ni IA. Chaque langue est un fichier séparé, chargé seulement si choisie.
            const statique: Record<string, string> = await import(`./dict/${lang}.json`).then(m => m.default).catch(() => ({}))
            setCache(new Map(Object.entries(statique)))
            try {
                const supabase = createClient(supabaseUrl, supabaseKey)

                // Paginated load : Supabase returns max 1000 rows per query by default.
                // A site with thousands of translations must page through all of them.
                const PAGE_SIZE = 1000
                const allRows: { source_hash: string; translated_text: string }[] = []
                let page = 0
                let hasMore = true

                while (hasMore) {
                    const { data, error } = await supabase
                        .from('translations')
                        .select('source_hash, translated_text')
                        .eq('lang', lang)
                        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

                    if (error || !data || data.length === 0) {
                        hasMore = false
                    } else {
                        allRows.push(...data)
                        hasMore = data.length === PAGE_SIZE
                        page++
                    }
                }

                // 2. La base (corrections faites dans l'admin, contenus du CMS) complète et prime sur le dictionnaire
                const newCache = new Map<string, string>(Object.entries(statique))
                for (const row of allRows) {
                    newCache.set(row.source_hash, row.translated_text)
                }
                setCache(newCache)

                // Save to localStorage as offline backup
                try {
                    const cacheObj: Record<string, string> = {}
                    newCache.forEach((v, k) => { cacheObj[k] = v })
                    localStorage.setItem(`rg_tl_${lang}`, JSON.stringify(cacheObj))
                } catch { /* localStorage full or unavailable */ }
            } catch {
                // Fall back to localStorage if Supabase is unreachable
                try {
                    const stored = localStorage.getItem(`rg_tl_${lang}`)
                    if (stored) {
                        const parsed = JSON.parse(stored) as Record<string, string>
                        const fallbackCache = new Map<string, string>(Object.entries(statique))
                        Object.entries(parsed).forEach(([k, v]) => fallbackCache.set(k, v))
                        setCache(fallbackCache)
                    }
                } catch { /* no fallback available */ }
            } finally {
                charge.current = true
                setIsLoading(false)
            }
        }

        loadTranslations()
    }, [lang])

    // Set language with cookie persistence
    const setLang = useCallback((newLang: LangCode) => {
        if (!SUPPORTED_LANGUAGES.find(l => l.code === newLang)) return
        setLangState(newLang)

        const isDashboard = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/agent')
        if (isDashboard) {
            document.cookie = `${DASHBOARD_LANG_COOKIE}=${newLang};path=/;max-age=${365 * 24 * 3600};SameSite=Lax`
        } else {
            document.cookie = `${LANG_COOKIE_NAME}=${newLang};path=/;max-age=${365 * 24 * 3600};SameSite=Lax`
        }
        document.documentElement.lang = newLang
    }, [])

    // Request translation for missing text (batched)
    const requestTranslation = useCallback((text: string) => {
        if (lang === 'fr' || !text.trim() || !charge.current) return

        pendingTexts.add(text)

        if (pendingTimer) clearTimeout(pendingTimer)
        pendingTimer = setTimeout(async () => {
            const texts = Array.from(pendingTexts)
            pendingTexts = new Set()

            if (texts.length === 0) return

            try {
                const res = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ texts, lang }),
                })

                if (res.ok) {
                    const data = await res.json()
                    if (data.translations) {
                        setCache(prev => {
                            const next = new Map(prev)
                            Object.entries(data.translations as Record<string, string>).forEach(([sourceText, translated]) => {
                                next.set(hashText(sourceText), translated)
                            })
                            return next
                        })
                    }
                }
            } catch { /* silent fail - text stays in French */ }
        }, 300) // Batch every 300ms
    }, [lang])

    // The main translation function
    const t = useCallback((text: string, vars?: Record<string, string | number>): string => {
        if (!text || lang === 'fr') {
            return applyVars(text, vars)
        }

        const { maskedText, extractedVars } = extractBrands(text)
        const hash = hashText(maskedText)
        const cached = cache.get(hash)

        const finalVars = { ...vars, ...extractedVars }

        if (cached) {
            return applyVars(cached, finalVars)
        }

        // Request async translation using the masked text (will update on next render)
        requestTranslation(maskedText)

        // Return French text as fallback
        return applyVars(maskedText, finalVars)
    }, [lang, cache, requestTranslation])

    const value = useMemo(() => ({
        lang,
        setLang,
        t,
        isLoading,
        translationCount: cache.size,
    }), [lang, setLang, t, isLoading, cache.size])

    return (
        <TranslationContext.Provider value={value}>
            {children}
        </TranslationContext.Provider>
    )
}

// Replace {var} placeholders in text
const applyVars = (text: string, vars?: Record<string, string | number>): string => {
    if (!vars || !text) return text || ''
    let result = text
    for (const [key, val] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val))
    }
    return result
}
