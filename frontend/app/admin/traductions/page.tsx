'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Translate as Languages, ArrowClockwise as RefreshCw, Warning as AlertTriangle, CheckCircle, MagnifyingGlass as Search, Pencil, Trash as Trash2, X, FloppyDisk as Save, CaretLeft as ChevronLeft, CaretRight as ChevronRight, Globe, Sparkle as Sparkles, Database, Funnel as Filter, CircleNotch as Loader2, Check } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES, type LangCode } from '@/lib/translation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Translation {
    source_text: string
    source_hash: string
    lang: LangCode
    translated_text: string
    context: 'auto' | 'batch' | 'manual' | string
}

interface AdminStats {
    stats: Record<string, number>
    translations: Translation[]
    total: number
    page: number
    limit: number
    pages: number
}

// ─── Context badge ─────────────────────────────────────────────────────────────

function ContextBadge({ context }: { context: string }) {
    if (context === 'manual') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">
                <Pencil size={8} /> Manuel
            </span>
        )
    }
    if (context === 'batch') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
                <Sparkles size={8} /> Batch
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#008751]/15 text-[#00c97a] border border-[#008751]/20">
            <Globe size={8} /> Auto
        </span>
    )
}

// ─── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
    item,
    onSave,
    onClose,
}: {
    item: Translation
    onSave: (hash: string, lang: LangCode, text: string) => Promise<void>
    onClose: () => void
}) {
    const [value, setValue] = useState(item.translated_text)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        textareaRef.current?.focus()
    }, [])

    const handleSave = async () => {
        if (!value.trim() || value === item.translated_text) { onClose(); return }
        setSaving(true)
        await onSave(item.source_hash, item.lang, value.trim())
        setSaving(false)
        setSaved(true)
        setTimeout(() => onClose(), 700)
    }

    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === item.lang)

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-[var(--panel-surface)] border border-[var(--panel-border)] rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-4"
            >
                <div className="flex items-center justify-between">
                    <h3 className="text-[var(--panel-text-heading)] font-bold text-lg flex items-center gap-2">
                        <Pencil size={18} className="text-blue-400" />
                        Modifier la traduction
                    </h3>
                    <button type="button" title="Fermer" onClick={onClose} className="text-[var(--panel-text-heading)]/40 hover:text-[var(--panel-text-heading)]/80 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Source */}
                <div className="space-y-1">
                    <label className="text-xs text-[var(--panel-text-heading)]/40 uppercase tracking-widest">Texte source (FR)</label>
                    <p className="text-[var(--panel-text-heading)]/70 text-sm bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl px-4 py-3 leading-relaxed">
                        {item.source_text}
                    </p>
                </div>

                {/* Language */}
                <div className="flex items-center gap-2 text-sm text-[var(--panel-text-heading)]/50">
                    <span className="text-xl">{langConfig?.flag}</span>
                    <span>{langConfig?.label} ({item.lang})</span>
                    <ContextBadge context={item.context} />
                </div>

                {/* Edit */}
                <div className="space-y-1">
                    <label htmlFor="edit-translation-text" className="text-xs text-[var(--panel-text-heading)]/40 uppercase tracking-widest">Traduction</label>
                    <textarea
                        id="edit-translation-text"
                        ref={textareaRef}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        rows={4}
                        className="w-full bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] focus:border-blue-500/50 text-[var(--panel-text-heading)] rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors"
                    />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                    <Button variant="ghost" onClick={onClose} className="text-[var(--panel-text-heading)]/50 hover:text-[var(--panel-text-heading)]">
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || saved || !value.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl font-bold flex items-center gap-2"
                    >
                        {saved
                            ? <><Check size={16} /> Sauvegardé</>
                            : saving
                                ? <><Loader2 size={16} className="animate-spin" /> Sauvegarde...</>
                                : <><Save size={16} /> Sauvegarder</>
                        }
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TraductionsAdminPage() {
    // Stats & list state
    const [stats, setStats] = useState<Record<string, number>>({})
    const [translations, setTranslations] = useState<Translation[]>([])
    const [total, setTotal] = useState(0)
    const [pages, setPages] = useState(1)
    const [loading, setLoading] = useState(false)
    const [statsLoading, setStatsLoading] = useState(true)

    // Filters
    const [selectedLang, setSelectedLang] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [page, setPage] = useState(1)

    // Edit modal
    const [editItem, setEditItem] = useState<Translation | null>(null)

    // Batch translate
    const [batchLang, setBatchLang] = useState<string | null>(null)
    const [batchGlobal, setBatchGlobal] = useState(false)
    const [batchResult, setBatchResult] = useState<{
        message: string
        newTranslations: number
        scannedTexts?: number
        staticStrings?: number
        errors?: number
        elapsed?: string
        perLang?: Record<string, { translated: number; skipped: number; errors: number }>
    } | null>(null)
    const [batchError, setBatchError] = useState<string | null>(null)
    const [scanCount, setScanCount] = useState<number | null>(null)
    const [batchStep, setBatchStep] = useState<'idle' | 'scanning' | 'translating'>('idle')

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<{ hash: string; lang: string; label: string } | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Notifications
    const [notify, setNotify] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const showNotify = (type: 'success' | 'error', text: string) => {
        setNotify({ type, text })
        setTimeout(() => setNotify(null), 3500)
    }

    // ─── Fetch data ────────────────────────────────────────────────────────────

    const fetchData = useCallback(async (opts?: { page?: number; lang?: string; search?: string }) => {
        setLoading(true)
        try {
            const p = opts?.page ?? page
            const l = opts?.lang ?? selectedLang
            const s = opts?.search ?? search

            const params = new URLSearchParams({ page: String(p), lang: l })
            if (s.trim()) params.set('search', s.trim())

            const res = await fetch(`/api/translate/admin?${params}`)
            const data: AdminStats = await res.json()

            setStats(data.stats || {})
            setTranslations(data.translations || [])
            setTotal(data.total || 0)
            setPages(data.pages || 1)
        } catch {
            showNotify('error', 'Erreur de chargement')
        } finally {
            setLoading(false)
            setStatsLoading(false)
        }
    }, [page, selectedLang, search])

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, selectedLang, search])

    // Debounce search
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
    const handleSearchChange = (v: string) => {
        setSearchInput(v)
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            setPage(1)
            setSearch(v)
        }, 450)
    }

    // ─── Update translation ─────────────────────────────────────────────────────

    const handleSave = async (hash: string, lang: LangCode, text: string) => {
        try {
            const res = await fetch('/api/translate/admin', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_hash: hash, lang, translated_text: text }),
            })
            if (!res.ok) throw new Error()
            showNotify('success', 'Traduction mise à jour')
            // Refresh list to reflect change
            await fetchData()
        } catch {
            showNotify('error', 'Erreur lors de la sauvegarde')
        }
    }

    // ─── Delete translation ─────────────────────────────────────────────────────

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            const res = await fetch('/api/translate/admin', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_hash: deleteTarget.hash, lang: deleteTarget.lang }),
            })
            if (!res.ok) throw new Error()
            showNotify('success', `Traduction supprimée`)
            setDeleteTarget(null)
            await fetchData()
        } catch {
            showNotify('error', 'Erreur lors de la suppression')
        } finally {
            setDeleting(false)
        }
    }

    // ─── Batch translate ────────────────────────────────────────────────────────

    const handleBatch = async (lang?: string) => {
        setBatchError(null)
        setBatchResult(null)
        setScanCount(null)

        if (lang) setBatchLang(lang)
        else setBatchGlobal(true)

        try {
            // Step 1 — quick scan to show how many texts will be processed
            setBatchStep('scanning')
            const scanRes = await fetch('/api/translate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lang ? { testMode: true, lang } : { testMode: true }),
            })
            if (scanRes.ok) {
                const scanData = await scanRes.json()
                setScanCount(scanData.totalTexts ?? null)
            }

            // Step 2 — actual translation
            setBatchStep('translating')
            const body = lang ? { lang } : {}
            const res = await fetch('/api/translate/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (res.ok) {
                setBatchResult({
                    message: data.message,
                    newTranslations: data.newTranslations ?? 0,
                    scannedTexts: data.scannedTexts,
                    staticStrings: data.staticStrings,
                    errors: data.errors,
                    perLang: data.perLang,
                })
                await fetchData()
            } else {
                setBatchError(data.error || 'Erreur lors de la traduction')
            }
        } catch (e: unknown) {
            setBatchError((e as Error).message || 'Erreur de connexion')
        } finally {
            setBatchLang(null)
            setBatchGlobal(false)
            setBatchStep('idle')
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    const langOptions = SUPPORTED_LANGUAGES.filter(l => l.code !== 'fr')
    const totalCount = Object.values(stats).reduce((a, b) => a + b, 0)

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[var(--panel-text-heading)] flex items-center gap-3">
                        <Languages className="text-[#008751]" size={32} />
                        Moteur de Traduction IA
                    </h1>
                    <p className="text-[var(--panel-text-heading)]/50 mt-1 text-sm">
                        Gérez le cache DB des traductions — <span className="text-[var(--panel-text-heading)]/80 font-semibold">{totalCount.toLocaleString('fr-FR')}</span> traductions stockées
                    </p>
                </div>

                <Button
                    onClick={() => handleBatch()}
                    disabled={batchGlobal || batchLang !== null}
                    className="bg-[#008751] hover:bg-[#006b40] text-white px-6 h-12 rounded-xl font-bold shadow-xl transition-all flex items-center gap-2 shrink-0"
                >
                    <RefreshCw className={batchGlobal ? 'animate-spin' : ''} size={18} />
                    {batchGlobal
                        ? (batchStep === 'scanning'
                            ? 'Analyse du site...'
                            : scanCount !== null
                                ? `Traduction de ${scanCount.toLocaleString('fr-FR')} textes...`
                                : 'Traduction en cours...')
                        : 'Forcer la traduction globale'
                    }
                </Button>
            </div>

            {/* ── Batch notifications ──────────────────────────────────── */}
            <AnimatePresence>
                {batchError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                        <AlertTriangle size={18} /> {batchError}
                    </motion.div>
                )}

                {batchResult && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-[#008751]/8 border border-[#008751]/20 rounded-2xl p-5 space-y-4">

                        {/* Summary row */}
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2 text-[#00c97a]">
                                <CheckCircle size={18} />
                                <span className="font-semibold text-sm">{batchResult.message}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-[var(--panel-text-heading)]/50 flex-wrap">
                                {batchResult.scannedTexts !== undefined && (
                                    <span>
                                        <strong className="text-[var(--panel-text-heading)]/80">{batchResult.scannedTexts.toLocaleString('fr-FR')}</strong> textes scannés
                                        {batchResult.staticStrings !== undefined && batchResult.staticStrings > 0 && (
                                            <span className="ml-1 text-[var(--panel-text-heading)]/30">
                                                (dont {batchResult.staticStrings} UI statiques)
                                            </span>
                                        )}
                                    </span>
                                )}
                                <span>
                                    <strong className="text-[#00c97a]">+{batchResult.newTranslations.toLocaleString('fr-FR')}</strong> nouvelles traductions
                                </span>
                                {batchResult.errors !== undefined && batchResult.errors > 0 && (
                                    <span className="text-orange-400">
                                        <strong>{batchResult.errors}</strong> erreurs
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Per-language breakdown */}
                        {batchResult.perLang && Object.keys(batchResult.perLang).length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                {Object.entries(batchResult.perLang).map(([code, data]) => {
                                    const lc = SUPPORTED_LANGUAGES.find(l => l.code === code)
                                    return (
                                        <div key={code} className="bg-[var(--panel-surface-alt)] border border-white/8 rounded-xl px-3 py-2 text-xs">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span>{lc?.flag}</span>
                                                <span className="text-[var(--panel-text-heading)]/60 font-mono">{code}</span>
                                            </div>
                                            <div className="text-[#00c97a] font-bold">+{data.translated}</div>
                                            {data.errors > 0 && (
                                                <div className="text-orange-400 text-[10px]">{data.errors} erreurs</div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Language Stats Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {langOptions.map(lang => (
                    <div
                        key={lang.code}
                        onClick={() => {
                            setSelectedLang(lang.code)
                            setPage(1)
                        }}
                        className={`bg-[var(--panel-surface-alt)] border rounded-2xl p-4 cursor-pointer transition-all hover:border-white/20 group relative overflow-hidden
                            ${selectedLang === lang.code ? 'border-[#008751]/60 bg-[#008751]/8' : 'border-[var(--panel-border)]'}`}
                    >
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/3 rounded-full blur-2xl" />
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">{lang.flag}</span>
                            {statsLoading ? (
                                <div className="w-8 h-4 bg-[var(--panel-surface-alt)] rounded animate-pulse" />
                            ) : (
                                <span className="text-[#008751] font-black text-lg">
                                    {(stats[lang.code] ?? 0).toLocaleString('fr-FR')}
                                </span>
                            )}
                        </div>
                        <p className="text-[var(--panel-text-heading)] font-semibold text-sm">{lang.label}</p>
                        <p className="text-[var(--panel-text-heading)]/30 text-[10px] font-mono uppercase">{lang.code}</p>

                        {/* Per-lang batch button */}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleBatch(lang.code) }}
                            disabled={batchLang === lang.code || batchGlobal}
                            className="mt-3 w-full flex items-center justify-center gap-1 text-[10px] text-[var(--panel-text-heading)]/40 hover:text-[#008751] transition-colors disabled:opacity-40"
                        >
                            <RefreshCw size={10} className={batchLang === lang.code ? 'animate-spin' : ''} />
                            {batchLang === lang.code
                                ? (batchStep === 'scanning' ? 'Analyse...' : 'Traduction...')
                                : 'Traduire'}
                        </button>
                    </div>
                ))}

                {/* All card */}
                <div
                    onClick={() => { setSelectedLang('all'); setPage(1) }}
                    className={`bg-[var(--panel-surface-alt)] border rounded-2xl p-4 cursor-pointer transition-all hover:border-white/20 group relative overflow-hidden
                        ${selectedLang === 'all' ? 'border-[#FCD116]/60 bg-[#FCD116]/5' : 'border-[var(--panel-border)]'}`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <Database size={22} className="text-[#FCD116]" />
                        {statsLoading ? (
                            <div className="w-8 h-4 bg-[var(--panel-surface-alt)] rounded animate-pulse" />
                        ) : (
                            <span className="text-[#FCD116] font-black text-lg">
                                {totalCount.toLocaleString('fr-FR')}
                            </span>
                        )}
                    </div>
                    <p className="text-[var(--panel-text-heading)] font-semibold text-sm">Toutes</p>
                    <p className="text-[var(--panel-text-heading)]/30 text-[10px] font-mono uppercase">all</p>
                    <div className="mt-3 h-4" /> {/* spacer */}
                </div>
            </div>

            {/* ── Search + Filter bar ──────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--panel-text-heading)]/30" />
                    <input
                        type="text"
                        placeholder="Rechercher dans les textes sources ou traduits..."
                        value={searchInput}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="w-full bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] focus:border-white/20 text-[var(--panel-text-heading)] rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors placeholder:text-[var(--panel-text-heading)]/25"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            title="Effacer la recherche"
                            onClick={() => { setSearchInput(''); handleSearchChange('') }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--panel-text-heading)]/30 hover:text-[var(--panel-text-heading)]/70"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 bg-[var(--panel-surface-alt)] border border-[var(--panel-border)] rounded-xl px-3 py-1.5 text-sm text-[var(--panel-text-heading)]/50 shrink-0">
                    <Filter size={14} />
                    <select
                        aria-label="Filtrer par langue"
                        value={selectedLang}
                        onChange={e => { setSelectedLang(e.target.value); setPage(1) }}
                        className="bg-transparent text-[var(--panel-text-heading)] outline-none cursor-pointer"
                    >
                        <option value="all">Toutes les langues</option>
                        {langOptions.map(l => (
                            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Translations Table ───────────────────────────────────── */}
            <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_1fr_80px_90px_80px] gap-0 border-b border-white/8 px-5 py-3 text-[11px] uppercase tracking-widest text-[var(--panel-text-heading)]/30 font-semibold">
                    <span>Texte source (FR)</span>
                    <span>Traduction</span>
                    <span>Langue</span>
                    <span>Contexte</span>
                    <span className="text-right">Actions</span>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-[var(--panel-text-heading)]/20" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && translations.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--panel-text-heading)]/30 space-y-2">
                        <Database size={40} />
                        <p className="text-sm">Aucune traduction{search ? ` pour "${search}"` : ''}</p>
                        {selectedLang !== 'all' && !search && (
                            <button
                                type="button"
                                onClick={() => handleBatch(selectedLang)}
                                className="mt-3 text-xs text-[#008751] hover:text-[#00c97a] flex items-center gap-1 transition-colors"
                            >
                                <Sparkles size={12} /> Lancer la traduction pour cette langue
                            </button>
                        )}
                    </div>
                )}

                {/* Rows */}
                {!loading && translations.map((t, idx) => {
                    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === t.lang)
                    return (
                        <div
                            key={`${t.source_hash}-${t.lang}`}
                            className={`grid grid-cols-[1fr_1fr_80px_90px_80px] gap-0 px-5 py-4 items-start transition-colors hover:bg-white/3
                                ${idx < translations.length - 1 ? 'border-b border-[var(--panel-border)]' : ''}`}
                        >
                            {/* Source text */}
                            <div className="pr-4">
                                <p className="text-[var(--panel-text-heading)]/70 text-xs leading-relaxed line-clamp-3">{t.source_text}</p>
                                <p className="text-[var(--panel-text-heading)]/20 font-mono text-[9px] mt-1">{t.source_hash.slice(0, 12)}…</p>
                            </div>

                            {/* Translated text */}
                            <div className="pr-4">
                                <p className="text-[var(--panel-text-heading)] text-xs leading-relaxed line-clamp-3">{t.translated_text}</p>
                            </div>

                            {/* Language */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-lg">{langConfig?.flag}</span>
                                <span className="text-[var(--panel-text-heading)]/40 text-xs font-mono">{t.lang}</span>
                            </div>

                            {/* Context */}
                            <div>
                                <ContextBadge context={t.context} />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditItem(t)}
                                    className="p-1.5 rounded-lg hover:bg-blue-500/20 text-white/30 hover:text-blue-400 transition-all"
                                    title="Modifier"
                                >
                                    <Pencil size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget({
                                        hash: t.source_hash,
                                        lang: t.lang,
                                        label: t.source_text.slice(0, 40),
                                    })}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"
                                    title="Supprimer"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── Pagination ───────────────────────────────────────────── */}
            {pages > 1 && (
                <div className="flex items-center justify-between text-sm text-[var(--panel-text-heading)]/40">
                    <span>{total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="text-[var(--panel-text-heading)]/50 hover:text-[var(--panel-text-heading)] disabled:opacity-30"
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <span className="text-[var(--panel-text-heading)] px-3">
                            {page} / {pages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page >= pages}
                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                            className="text-[var(--panel-text-heading)]/50 hover:text-[var(--panel-text-heading)] disabled:opacity-30"
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Architecture note ─────────────────────────────────────── */}
            <div className="bg-black/30 border border-[var(--panel-border)] rounded-2xl p-6">
                <h3 className="text-sm font-bold text-[var(--panel-text-heading)] mb-3 flex items-center gap-2">
                    <Sparkles size={14} className="text-[#FCD116]" /> Comment fonctionne le moteur ?
                </h3>
                <ol className="list-decimal list-inside text-[var(--panel-text-heading)]/50 space-y-2 text-sm leading-relaxed">
                    <li>Tout texte affiché en français est haché (djb2) et utilisé comme clé de cache dans Supabase.</li>
                    <li>Au premier affichage par un visiteur étranger, Groq Llama 3.3-70B traduit le texte en moins d&apos;une seconde.</li>
                    <li>La traduction est <strong className="text-[var(--panel-text-heading)]">sauvegardée définitivement</strong> dans la table <code className="text-[#FCD116] bg-[var(--panel-surface-alt)] px-1 rounded">translations</code>.</li>
                    <li>Les visiteurs suivants reçoivent la traduction depuis le cache — <strong className="text-[var(--panel-text-heading)]">0 latence</strong>.</li>
                    <li>Les traductions <strong className="text-[var(--panel-text-heading)]">manuelles</strong> (modifiées ici) ont priorité sur les traductions IA.</li>
                    <li>Le bouton <em>Forcer la traduction globale</em> pré-traduit tous les textes non encore traduits en une passe.</li>
                </ol>
            </div>

            {/* ── Edit Modal ────────────────────────────────────────────── */}
            <AnimatePresence>
                {editItem && (
                    <EditModal
                        item={editItem}
                        onSave={handleSave}
                        onClose={() => setEditItem(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── Delete Confirm Modal ──────────────────────────────────── */}
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
                    >
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="bg-[var(--panel-surface)] border border-red-500/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                                    <Trash2 size={18} className="text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-[var(--panel-text-heading)] font-bold">Supprimer la traduction</h3>
                                    <p className="text-[var(--panel-text-heading)]/40 text-xs">Cette action est irréversible</p>
                                </div>
                            </div>
                            <p className="text-[var(--panel-text-heading)]/60 text-sm bg-[var(--panel-surface-alt)] rounded-xl px-4 py-3">
                                &quot;{deleteTarget.label}{deleteTarget.label.length >= 40 ? '…' : ''}&quot;
                                <span className="ml-2 text-[var(--panel-text-heading)]/30 font-mono text-xs">({deleteTarget.lang})</span>
                            </p>
                            <p className="text-[var(--panel-text-heading)]/40 text-xs">
                                La prochaine fois qu&apos;un visiteur affichera ce texte dans cette langue, il sera re-traduit automatiquement par l&apos;IA.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-[var(--panel-text-heading)]/50">
                                    Annuler
                                </Button>
                                <Button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="bg-red-600 hover:bg-red-500 text-white px-5 rounded-xl font-bold flex items-center gap-2"
                                >
                                    {deleting ? <><Loader2 size={14} className="animate-spin" /> Suppression...</> : <><Trash2 size={14} /> Supprimer</>}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Toast notification ────────────────────────────────────── */}
            <AnimatePresence>
                {notify && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold
                            ${notify.type === 'success'
                                ? 'bg-[#008751] text-white'
                                : 'bg-red-600 text-white'}`}
                    >
                        {notify.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        {notify.text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
