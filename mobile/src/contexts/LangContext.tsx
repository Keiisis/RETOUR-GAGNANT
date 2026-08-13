import React, {
    createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Supported languages (same as website) ───────────────────────────────────

export type LangCode = 'fr' | 'en' | 'es' | 'pt' | 'cr' | 'ht'

export interface LangConfig {
    code: LangCode
    label: string
    nativeLabel: string
    flag: string
}

export const SUPPORTED_LANGUAGES: LangConfig[] = [
    { code: 'fr', label: 'Français',         nativeLabel: 'Français',         flag: '🇫🇷' },
    { code: 'en', label: 'Anglais',           nativeLabel: 'English',          flag: '🇬🇧' },
    { code: 'es', label: 'Espagnol',          nativeLabel: 'Español',          flag: '🇪🇸' },
    { code: 'pt', label: 'Portugais',         nativeLabel: 'Português',        flag: '🇧🇷' },
    { code: 'cr', label: 'Créole',            nativeLabel: 'Kréyòl',           flag: '🇬🇵' },
    { code: 'ht', label: 'Créole Haïtien',    nativeLabel: 'Kreyòl Ayisyen',   flag: '🇭🇹' },
]

const DEFAULT_LANG: LangCode = 'fr'
const STORAGE_KEY = '@rg_mobile_lang'
const CACHE_KEY_PREFIX = '@rg_trans_cache_'
// ── CACHE_VERSION ─────────────────────────────────────────────────────────────
// Bump this number to force ALL phones to discard their local translation cache.
// v2: Purged corrupted Creole cache (English translations stored as Creole)
const CACHE_VERSION = 2
const CACHE_VERSION_KEY = '@rg_trans_cache_version'

// ─── Translation API URL ──────────────────────────────────────────────────────
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://www.retourgagnantbenin.bj'

// ─── Context type ─────────────────────────────────────────────────────────────

type Vars = Record<string, string | number>

interface LangContextType {
    lang: LangCode
    langConfig: LangConfig
    setLang: (lang: LangCode) => void
    t: (text: string, vars?: Vars) => string
    isTranslating: boolean
    preloadTexts: (texts: string[]) => void
    retryFailed: () => void
    clearCache: (target?: LangCode) => Promise<void>
}

// Replace `{key}` placeholders in a string with values from `vars`.
// Translation cache stays template-based : interpolation happens after lookup.
const interpolate = (text: string, vars?: Vars): string => {
    if (!vars) return text
    return text.replace(/\{(\w+)\}/g, (match, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
    )
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LangContext = createContext<LangContextType>({
    lang: DEFAULT_LANG,
    langConfig: SUPPORTED_LANGUAGES[0],
    setLang: () => {},
    t: (text, vars) => interpolate(text, vars),
    isTranslating: false,
    preloadTexts: () => {},
    retryFailed: () => {},
    clearCache: async () => {},
})

export const useLang = () => useContext(LangContext)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LangProvider({ children }: { children: React.ReactNode }) {
    const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG)
    const [cache, setCache] = useState<Map<string, string>>(new Map())
    const [isTranslating, setIsTranslating] = useState(false)

    // Refs to avoid stale closures in flushBatch
    const cacheRef = useRef(cache)
    const langRef = useRef(lang)

    // Keep refs in sync with state
    useEffect(() => { cacheRef.current = cache }, [cache])
    useEffect(() => { langRef.current = lang }, [lang])

    // Batch queue for translations
    const pendingTexts = useRef<Set<string>>(new Set())
    const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isFlushing = useRef(false)

    // ── ANTI-LOOP: Track permanently failed texts ──
    // Texts that failed after max retries are stored here so t() never re-queues them.
    // Cleared when language changes OR when retryFailed() is called (e.g. on foreground).
    const failedForever = useRef<Set<string>>(new Set())

    // ── Load persisted language ──
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then(stored => {
            if (stored && SUPPORTED_LANGUAGES.find(l => l.code === stored)) {
                setLangState(stored as LangCode)
            }
        }).catch(() => {})
    }, [])

    // ── Load cached translations when lang changes (with version check) ──
    useEffect(() => {
        // Clear failed set when language changes
        failedForever.current.clear()

        if (lang === DEFAULT_LANG) {
            setCache(new Map())
            return
        }
        const cacheKey = `${CACHE_KEY_PREFIX}${lang}`
        const versionKey = `${CACHE_VERSION_KEY}_${lang}`

        AsyncStorage.getItem(versionKey).then(storedVersion => {
            if (storedVersion !== String(CACHE_VERSION)) {
                // Version mismatch : old/corrupted cache, purge it
                console.log(`[LangContext] Cache version mismatch for ${lang} (stored=${storedVersion}, current=${CACHE_VERSION}). Purging local cache.`)
                AsyncStorage.removeItem(cacheKey).catch(() => {})
                AsyncStorage.setItem(versionKey, String(CACHE_VERSION)).catch(() => {})
                setCache(new Map())
                return
            }

            // Version matches : load from AsyncStorage
            return AsyncStorage.getItem(cacheKey).then(raw => {
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw)
                        const newMap = new Map<string, string>(Object.entries(parsed))
                        console.log(`[LangContext] Loaded ${newMap.size} cached translations for ${lang} (v${CACHE_VERSION})`)
                        setCache(newMap)
                    } catch {
                        setCache(new Map())
                    }
                } else {
                    setCache(new Map())
                }
            })
        }).catch(() => {
            setCache(new Map())
        })
    }, [lang])

    // ── Persist language choice ──
    const setLang = useCallback((newLang: LangCode) => {
        setLangState(newLang)
        AsyncStorage.setItem(STORAGE_KEY, newLang).catch(() => {})
        // Clear pending texts + failed set when language changes
        pendingTexts.current.clear()
        failedForever.current.clear()
        if (batchTimer.current) {
            clearTimeout(batchTimer.current)
            batchTimer.current = null
        }
    }, [])

    // ── Batch API call for translations ──
    const retryCount = useRef(0)
    const MAX_RETRIES = 3 // Trois tentatives : un ecran a moitie traduit est pire qu'un ecran lent

    const flushBatch = useCallback(async () => {
        const currentLang = langRef.current
        if (currentLang === DEFAULT_LANG || pendingTexts.current.size === 0) return
        if (isFlushing.current) return // Prevent concurrent flushes

        const texts = Array.from(pendingTexts.current)
        pendingTexts.current.clear()

        // Filter already cached or permanently failed : using ref for latest cache
        const currentCache = cacheRef.current
        const toTranslate = texts.filter(t =>
            !currentCache.has(t) && !failedForever.current.has(t)
        )
        if (toTranslate.length === 0) return

        const CHUNK_SIZE = 24 // Assez gros pour couvrir un ecran en un ou deux appels
        const FETCH_TIMEOUT = 20000 // Lots plus gros -> on laisse un peu plus de temps
        isFlushing.current = true
        setIsTranslating(true)

        const failedTexts: string[] = []

        console.log(`[LangContext] Translating ${toTranslate.length} texts in ${Math.ceil(toTranslate.length / CHUNK_SIZE)} chunks (lang=${currentLang}, retry=${retryCount.current})`)

        try {
            for (let i = 0; i < toTranslate.length; i += CHUNK_SIZE) {
                const chunk = toTranslate.slice(i, i + CHUNK_SIZE)
                const chunkNum = Math.floor(i / CHUNK_SIZE) + 1

                try {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

                    const res = await fetch(`${API_BASE}/api/translate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ texts: chunk, lang: currentLang }),
                        signal: controller.signal,
                    })

                    clearTimeout(timeoutId)

                    if (!res.ok) {
                        console.warn(`[LangContext] Chunk ${chunkNum} HTTP ${res.status}`)
                        failedTexts.push(...chunk)
                        continue
                    }

                    const responseText = await res.text()
                    let data: { translations?: Record<string, string> } = {}
                    try { data = JSON.parse(responseText) } catch {
                        console.warn(`[LangContext] Chunk ${chunkNum}: invalid JSON`)
                        failedTexts.push(...chunk)
                        continue
                    }

                    const translationsMap = data.translations || {}
                    const translatedCount = Object.keys(translationsMap).length

                    if (translatedCount > 0) {
                        // Find which texts were NOT translated
                        const untranslated = chunk.filter(t => !translationsMap[t])
                        if (untranslated.length > 0) failedTexts.push(...untranslated)

                        setCache(prev => {
                            const next = new Map(prev)
                            for (const [key, value] of Object.entries(translationsMap)) {
                                next.set(key, value)
                            }

                            // Persist to AsyncStorage
                            const storageKey = `${CACHE_KEY_PREFIX}${currentLang}`
                            const obj: Record<string, string> = {}
                            next.forEach((v, k) => { obj[k] = v })
                            AsyncStorage.setItem(storageKey, JSON.stringify(obj)).catch(() => {})
                            AsyncStorage.setItem(`${CACHE_VERSION_KEY}_${currentLang}`, String(CACHE_VERSION)).catch(() => {})

                            return next
                        })
                    } else {
                        failedTexts.push(...chunk)
                    }

                    // Small delay between chunks to avoid rate limiting
                    if (i + CHUNK_SIZE < toTranslate.length) {
                        await new Promise(r => setTimeout(r, 150))
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : ''
                    if (msg.includes('aborted')) {
                        console.warn(`[LangContext] Chunk ${chunkNum} timed out`)
                    } else {
                        console.warn(`[LangContext] Chunk ${chunkNum} failed: ${msg}`)
                    }
                    failedTexts.push(...chunk)
                }
            }
        } finally {
            isFlushing.current = false
            setIsTranslating(false)
        }

        // ── Handle failed texts ──
        if (failedTexts.length > 0) {
            const uncached = failedTexts.filter(t => !cacheRef.current.has(t))

            if (retryCount.current < MAX_RETRIES && uncached.length > 0) {
                // Retry once after a delay
                retryCount.current++
                console.log(`[LangContext] Retry ${retryCount.current}/${MAX_RETRIES}: ${uncached.length} texts in 3s...`)
                for (const t of uncached) pendingTexts.current.add(t)
                setTimeout(flushBatch, 3000)
            } else {
                // MAX RETRIES REACHED : mark texts as permanently failed
                // This STOPS the infinite loop: t() will not re-queue these texts
                // until retryFailed() is called (e.g. when app returns from background)
                console.log(`[LangContext] Giving up on ${uncached.length} texts after ${retryCount.current} retries (will retry on app foreground)`)
                for (const t of uncached) {
                    failedForever.current.add(t)
                }
                retryCount.current = 0
            }
            return
        }

        // Success : reset retry counter
        retryCount.current = 0

        // Check if more texts were queued while we were flushing
        if (pendingTexts.current.size > 0) {
            setTimeout(flushBatch, 200)
        }
    }, []) // No dependencies : uses refs for latest state

    // ── t() function : queues text for translation, with optional `{key}` interpolation ──
    const t = useCallback((text: string, vars?: Vars): string => {
        if (!text) return text
        if (lang === DEFAULT_LANG) return interpolate(text, vars)

        // Return cached translation immediately
        if (cache.has(text)) return interpolate(cache.get(text)!, vars)

        // If text permanently failed, return original (don't re-queue!)
        if (failedForever.current.has(text)) return interpolate(text, vars)

        // Queue for batch translation
        if (!pendingTexts.current.has(text)) {
            pendingTexts.current.add(text)

            // Debounce: flush 200ms after last call
            if (batchTimer.current) clearTimeout(batchTimer.current)
            batchTimer.current = setTimeout(() => {
                batchTimer.current = null
                flushBatch()
            }, 200)
        }

        return interpolate(text, vars) // Return original while translating
    }, [lang, cache, flushBatch])

    // ── preloadTexts() : immediately queue critical texts for translation ──
    const preloadTexts = useCallback((texts: string[]) => {
        if (lang === DEFAULT_LANG) return
        const currentCache = cacheRef.current
        let hasNew = false
        for (const text of texts) {
            if (text && !currentCache.has(text) && !pendingTexts.current.has(text) && !failedForever.current.has(text)) {
                pendingTexts.current.add(text)
                hasNew = true
            }
        }
        if (hasNew) {
            // Flush immediately (no debounce)
            if (batchTimer.current) clearTimeout(batchTimer.current)
            batchTimer.current = null
            flushBatch()
        }
    }, [lang, flushBatch])

    // ── retryFailed() : reset failedForever and re-queue those texts ──
    // Called on app foreground (network may have recovered) or manually for debug.
    const retryFailed = useCallback(() => {
        if (langRef.current === DEFAULT_LANG) return
        if (failedForever.current.size === 0) return

        const failed = Array.from(failedForever.current)
        failedForever.current.clear()
        retryCount.current = 0

        console.log(`[LangContext] retryFailed: re-queueing ${failed.length} texts`)
        for (const text of failed) {
            if (!cacheRef.current.has(text)) {
                pendingTexts.current.add(text)
            }
        }

        if (pendingTexts.current.size > 0) {
            if (batchTimer.current) clearTimeout(batchTimer.current)
            batchTimer.current = null
            flushBatch()
        }
    }, [flushBatch])


    /* Relance automatique des textes abandonnes. Sans cela, une coupure
       reseau d'une seconde laissait un ecran mi-francais mi-anglais jusqu'au
       prochain retour en avant-plan de l'application. */
    useEffect(() => {
        if (lang === DEFAULT_LANG) return
        const id = setInterval(() => { retryFailed() }, 45000)
        return () => clearInterval(id)
    }, [lang, retryFailed])

    // ── clearCache(lang?) : wipe AsyncStorage cache for a language (or all) ──
    const clearCache = useCallback(async (target?: LangCode) => {
        const targets = target ? [target] : SUPPORTED_LANGUAGES.map(l => l.code).filter(c => c !== 'fr')
        for (const code of targets) {
            await AsyncStorage.removeItem(`${CACHE_KEY_PREFIX}${code}`).catch(() => {})
            await AsyncStorage.removeItem(`${CACHE_VERSION_KEY}_${code}`).catch(() => {})
        }
        // If we just wiped the active language, clear in-memory cache too
        if (!target || target === langRef.current) {
            failedForever.current.clear()
            setCache(new Map())
        }
        console.log(`[LangContext] Cleared cache for: ${targets.join(', ')}`)
    }, [])

    // ── AppState listener: retry failed texts when app returns to foreground ──
    // Network may have recovered while the app was backgrounded.
    useEffect(() => {
        const handleAppStateChange = (next: AppStateStatus) => {
            if (next === 'active' && failedForever.current.size > 0) {
                retryFailed()
            }
        }
        const sub = AppState.addEventListener('change', handleAppStateChange)
        return () => sub.remove()
    }, [retryFailed])

    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === lang) || SUPPORTED_LANGUAGES[0]

    return (
        <LangContext.Provider value={{ lang, langConfig, setLang, t, isTranslating, preloadTexts, retryFailed, clearCache }}>
            {children}
        </LangContext.Provider>
    )
}
