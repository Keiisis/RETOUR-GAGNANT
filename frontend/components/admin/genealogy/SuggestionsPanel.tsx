'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lightbulb, X, CircleNotch as Loader2, WarningCircle as AlertCircle, Info, CaretRight as ChevronRight, ArrowClockwise as RefreshCw, FileText } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase'

interface Suggestion {
    person_id: string
    person_name: string
    relation_role: string
    missing_what: string
    severity: 'high' | 'medium' | 'low'
}

interface SuggestionsResponse {
    suggestions: Suggestion[]
    counts: { total: number; high: number; medium: number; low: number }
}

interface Props {
    treeId: string
    isDark?: boolean
    onSelectPerson?: (personId: string) => void
}

const MISSING_LABEL: Record<string, string> = {
    father: 'Père manquant',
    mother: 'Mère manquante',
    birth_date: 'Date de naissance manquante',
    birth_place: 'Lieu de naissance manquant',
    'doc:acte_naissance': 'Acte de naissance manquant',
    'doc:passeport': 'Passeport manquant',
}

const SEV_COLOR = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#3B82F6',
}
const SEV_BG = {
    high: 'rgba(239,68,68,0.12)',
    medium: 'rgba(245,158,11,0.12)',
    low: 'rgba(59,130,246,0.12)',
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

export default function SuggestionsPanel({ treeId, isDark = false, onSelectPerson }: Props) {
    const [open, setOpen] = useState(false)
    const [resp, setResp] = useState<SuggestionsResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/suggestions?tree_id=${treeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setResp(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [treeId])

    useEffect(() => {
        if (open) load()
    }, [open, load])

    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'
    const bgPanel = isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)'

    const filtered = resp?.suggestions.filter(s => filter === 'all' || s.severity === filter) || []
    const totalCount = resp?.counts.total ?? 0
    const highCount = resp?.counts.high ?? 0

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
                style={{
                    background: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.10)',
                    color: isDark ? '#FBBF24' : '#D97706',
                    border: `1px solid ${isDark ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)'}`,
                }}
                title="Suggestions pour compléter l'arbre"
            >
                <Lightbulb size={14} />
                Suggestions
                {highCount > 0 && (
                    <span
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1"
                        style={{ background: '#EF4444', color: '#FFFFFF', border: '2px solid ' + (isDark ? '#070B13' : '#FFFFFF') }}
                    >
                        {highCount > 9 ? '9+' : highCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[1000] flex justify-end"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="h-full w-full max-w-md flex flex-col shadow-2xl"
                        style={{ background: bgPanel, borderLeft: '1px solid rgba(245,158,11,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.25)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                                    <Lightbulb size={18} color="#D97706" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: textColor }}>Suggestions</h2>
                                    <p className="text-[10px] font-mono" style={{ color: subText }}>{totalCount} amélioration(s) possible(s)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={load} className="p-2 rounded-lg hover:bg-white/10" title="Rafraîchir">
                                    <RefreshCw size={14} color={subText} className={loading ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                                    <X size={16} color={subText} />
                                </button>
                            </div>
                        </div>

                        {/* Filter tabs */}
                        {resp && (
                            <div className="flex gap-1 p-3 border-b" style={{ borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.3)' }}>
                                {([
                                    { k: 'all', label: 'Tout', count: resp.counts.total, color: subText },
                                    { k: 'high', label: 'Critique', count: resp.counts.high, color: SEV_COLOR.high },
                                    { k: 'medium', label: 'Modéré', count: resp.counts.medium, color: SEV_COLOR.medium },
                                    { k: 'low', label: 'Mineur', count: resp.counts.low, color: SEV_COLOR.low },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.k}
                                        onClick={() => setFilter(tab.k as typeof filter)}
                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                                        style={{
                                            background: filter === tab.k ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') : 'transparent',
                                            color: filter === tab.k ? tab.color : subText,
                                        }}
                                    >
                                        {tab.label} ({tab.count})
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {error && (
                                <div className="mb-3 p-2.5 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {error}
                                </div>
                            )}

                            {loading && !resp ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin" color="#D97706" />
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="text-center py-12">
                                    <Info size={28} color={subText} className="mx-auto mb-3" />
                                    <p className="text-[12px]" style={{ color: subText }}>
                                        {totalCount === 0 ? 'Arbre complet — rien à suggérer.' : 'Aucune suggestion dans ce filtre.'}
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {filtered.map((s, idx) => {
                                        const Icon = s.missing_what.startsWith('doc:') ? FileText : AlertCircle
                                        return (
                                            <li
                                                key={`${s.person_id}-${s.missing_what}-${idx}`}
                                                className="rounded-xl border overflow-hidden"
                                                style={{
                                                    background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,249,0.7)',
                                                    borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)',
                                                }}
                                            >
                                                <button
                                                    onClick={() => { onSelectPerson?.(s.person_id); setOpen(false) }}
                                                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-all"
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ background: SEV_BG[s.severity] }}
                                                    >
                                                        <Icon size={14} color={SEV_COLOR[s.severity]} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-bold" style={{ color: textColor }}>
                                                            {MISSING_LABEL[s.missing_what] || s.missing_what}
                                                        </p>
                                                        <p className="text-[10px] mt-0.5 truncate" style={{ color: subText }}>
                                                            {s.person_name || 'Sans nom'} {s.relation_role && `· ${s.relation_role}`}
                                                        </p>
                                                    </div>
                                                    <ChevronRight size={14} color={subText} />
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
