'use client'

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, X, Loader2, AlertTriangle, ArrowRight, RefreshCw, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PersonStub {
    id: string
    first_name: string | null
    last_name: string | null
    birth_date: string | null
    birth_place: string | null
    relation_role: string | null
}

interface DedupPair {
    person_a_id: string
    person_b_id: string
    name_match: string
    birth_year_diff: number
    person_a: PersonStub | null
    person_b: PersonStub | null
}

interface Props {
    treeId: string
    isDark?: boolean
    onMerged?: () => void
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

function fmt(p: PersonStub | null): string {
    if (!p) return '—'
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Sans nom'
    const parts: string[] = []
    if (p.birth_date) parts.push(`né(e) ${p.birth_date}`)
    if (p.birth_place) parts.push(p.birth_place)
    return parts.length > 0 ? `${name} · ${parts.join(' · ')}` : name
}

export default function DedupAlert({ treeId, isDark = false, onMerged }: Props) {
    const [open, setOpen] = useState(false)
    const [pairs, setPairs] = useState<DedupPair[]>([])
    const [loading, setLoading] = useState(false)
    const [merging, setMerging] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/dedup?tree_id=${treeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setPairs(json.pairs || [])
            setHasLoadedOnce(true)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [treeId])

    // Auto-load au montage (pour afficher le badge si doublons)
    useEffect(() => { load() }, [load])

    const handleMerge = async (keepId: string, mergeId: string) => {
        if (!confirm('Fusionner ces deux personnes ? Cette action est irréversible — toutes les relations, documents et faits seront déplacés vers la personne conservée, puis le doublon sera supprimé.')) return

        setMerging(mergeId)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch('/api/genealogie/dedup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ tree_id: treeId, keep_id: keepId, merge_id: mergeId }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            // Retirer la paire fusionnée de la liste sans tout recharger
            setPairs((prev) => prev.filter(p => p.person_a_id !== mergeId && p.person_b_id !== mergeId
                && p.person_a_id !== keepId && p.person_b_id !== keepId))
            onMerged?.()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur fusion')
        } finally {
            setMerging(null)
        }
    }

    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'
    const bgPanel = isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)'

    // Bouton header — masqué si pas de doublons détectés (et déjà chargé)
    if (hasLoadedOnce && pairs.length === 0 && !open) {
        return null
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
                style={{
                    background: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)',
                    color: isDark ? '#FCA5A5' : '#DC2626',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.25)'}`,
                }}
                title="Doublons potentiels dans l'arbre"
            >
                <GitMerge size={14} />
                Doublons
                {pairs.length > 0 && (
                    <span
                        className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black px-1.5"
                        style={{ background: '#EF4444', color: '#FFFFFF' }}
                    >
                        {pairs.length}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ background: bgPanel, border: '1px solid rgba(239,68,68,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
                                    <AlertTriangle size={18} color="#EF4444" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: textColor }}>Doublons potentiels</h2>
                                    <p className="text-[10px] font-mono" style={{ color: subText }}>
                                        {pairs.length} paire(s) détectée(s) · même nom complet + dates proches
                                    </p>
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

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {error && (
                                <div className="mb-3 p-2.5 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {error}
                                </div>
                            )}

                            {loading && pairs.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin" color="#EF4444" />
                                </div>
                            ) : pairs.length === 0 ? (
                                <div className="text-center py-12">
                                    <Check size={28} color="#10B981" className="mx-auto mb-3" />
                                    <p className="text-[12px]" style={{ color: subText }}>
                                        Aucun doublon détecté.
                                    </p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {pairs.map((pair, idx) => (
                                        <li
                                            key={`${pair.person_a_id}-${pair.person_b_id}-${idx}`}
                                            className="rounded-xl border p-3"
                                            style={{
                                                background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,249,0.7)',
                                                borderColor: 'rgba(239,68,68,0.2)',
                                            }}
                                        >
                                            <p className="text-[10px] mb-2 font-mono uppercase tracking-wider" style={{ color: subText }}>
                                                Écart de naissance : {pair.birth_year_diff} an(s)
                                            </p>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.7)' }}>
                                                    <p className="text-[11px] flex-1 min-w-0 truncate" style={{ color: textColor }}>
                                                        <span className="font-bold">A:</span> {fmt(pair.person_a)}
                                                    </p>
                                                    <button
                                                        onClick={() => handleMerge(pair.person_a_id, pair.person_b_id)}
                                                        disabled={merging !== null}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex-shrink-0"
                                                        style={{ background: '#10B981', color: '#FFFFFF' }}
                                                        title="Garder A, supprimer B"
                                                    >
                                                        {merging === pair.person_b_id ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                                                        Garder A
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg" style={{ background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.7)' }}>
                                                    <p className="text-[11px] flex-1 min-w-0 truncate" style={{ color: textColor }}>
                                                        <span className="font-bold">B:</span> {fmt(pair.person_b)}
                                                    </p>
                                                    <button
                                                        onClick={() => handleMerge(pair.person_b_id, pair.person_a_id)}
                                                        disabled={merging !== null}
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex-shrink-0"
                                                        style={{ background: '#10B981', color: '#FFFFFF' }}
                                                        title="Garder B, supprimer A"
                                                    >
                                                        {merging === pair.person_a_id ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                                                        Garder B
                                                    </button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
