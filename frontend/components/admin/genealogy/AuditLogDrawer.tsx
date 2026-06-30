'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, X, Loader2, RefreshCw, ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AuditEntry {
    id: string
    table_name: string
    record_id: string
    tree_id: string | null
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    actor_id: string | null
    actor_email: string | null
    before_data: Record<string, unknown> | null
    after_data: Record<string, unknown> | null
    diff: Record<string, { old: unknown; new: unknown }> | null
    created_at: string
}

interface Props {
    treeId: string
    isDark?: boolean
}

const TABLE_LABEL: Record<string, string> = {
    trees: 'Arbre',
    persons: 'Personne',
    genealogy_documents: 'Document',
    dossiers: 'Dossier',
    tree_collaborators: 'Collaborateur',
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

function formatRecordSummary(entry: AuditEntry): string {
    const data = entry.after_data || entry.before_data
    if (!data) return entry.record_id.slice(0, 8)
    if (entry.table_name === 'persons') {
        const first = (data as { first_name?: string }).first_name || ''
        const last = (data as { last_name?: string }).last_name || ''
        const name = `${first} ${last}`.trim()
        return name || entry.record_id.slice(0, 8)
    }
    if (entry.table_name === 'genealogy_documents') {
        return (data as { title?: string; doc_type?: string }).title
            || (data as { doc_type?: string }).doc_type
            || entry.record_id.slice(0, 8)
    }
    if (entry.table_name === 'trees') {
        return (data as { name?: string }).name || entry.record_id.slice(0, 8)
    }
    if (entry.table_name === 'dossiers') {
        return (data as { dossier_type?: string }).dossier_type || entry.record_id.slice(0, 8)
    }
    return entry.record_id.slice(0, 8)
}

function formatRelative(iso: string): string {
    const now = Date.now()
    const ts = new Date(iso).getTime()
    const diffSec = Math.floor((now - ts) / 1000)
    if (diffSec < 60) return 'il y a quelques secondes'
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`
    if (diffSec < 7 * 86400) return `il y a ${Math.floor(diffSec / 86400)} j`
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AuditLogDrawer({ treeId, isDark = false }: Props) {
    const [open, setOpen] = useState(false)
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [tableFilter, setTableFilter] = useState<string>('')
    const [actionFilter, setActionFilter] = useState<string>('')
    const [expanded, setExpanded] = useState<Set<string>>(new Set())

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const params = new URLSearchParams({ tree_id: treeId, limit: '50' })
            if (tableFilter) params.set('table', tableFilter)
            if (actionFilter) params.set('action', actionFilter)
            const res = await fetch(`/api/genealogie/audit-log?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setEntries(json.audit || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur chargement')
        } finally {
            setLoading(false)
        }
    }, [treeId, tableFilter, actionFilter])

    useEffect(() => {
        if (open) load()
    }, [open, load])

    const toggleExpand = (id: string) => {
        setExpanded((s) => {
            const n = new Set(s)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
        })
    }

    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'
    const bgPanel = isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)'

    const ActionIcon = ({ action }: { action: AuditEntry['action'] }) => {
        if (action === 'INSERT') return <Plus size={12} color="#10B981" />
        if (action === 'UPDATE') return <Pencil size={12} color="#3B82F6" />
        return <Trash2 size={12} color="#EF4444" />
    }
    const actionColor = (a: AuditEntry['action']) => a === 'INSERT' ? '#10B981' : a === 'UPDATE' ? '#3B82F6' : '#EF4444'
    const actionBg = (a: AuditEntry['action']) =>
        a === 'INSERT' ? 'rgba(16,185,129,0.12)' : a === 'UPDATE' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
                style={{
                    background: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.10)',
                    color: isDark ? '#CBD5E1' : '#475569',
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.2)'}`,
                }}
                title="Historique des modifications de l'arbre"
            >
                <History size={14} />
                Historique
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[1000] flex justify-end"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="h-full w-full max-w-2xl flex flex-col shadow-2xl"
                        style={{ background: bgPanel, borderLeft: '1px solid rgba(148,163,184,0.25)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.4)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(148,163,184,0.15)' }}>
                                    <History size={18} color={isDark ? '#CBD5E1' : '#475569'} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: textColor }}>Journal d&apos;audit</h2>
                                    <p className="text-[10px] font-mono" style={{ color: subText }}>Toutes les modifications de l&apos;arbre, tracées</p>
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

                        {/* Filters */}
                        <div className="px-5 py-3 border-b flex gap-2 items-center" style={{ borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.3)' }}>
                            <select
                                value={tableFilter}
                                onChange={(e) => setTableFilter(e.target.value)}
                                className="px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                                style={{
                                    background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)',
                                    color: textColor,
                                    borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                                }}
                            >
                                <option value="">Toutes les tables</option>
                                <option value="trees">Arbre</option>
                                <option value="persons">Personnes</option>
                                <option value="genealogy_documents">Documents</option>
                                <option value="dossiers">Dossiers</option>
                                <option value="tree_collaborators">Collaborateurs</option>
                            </select>
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                className="px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                                style={{
                                    background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)',
                                    color: textColor,
                                    borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                                }}
                            >
                                <option value="">Toutes les actions</option>
                                <option value="INSERT">Création</option>
                                <option value="UPDATE">Modification</option>
                                <option value="DELETE">Suppression</option>
                            </select>
                            <span className="text-[10px] ml-auto" style={{ color: subText }}>{entries.length} entrée(s)</span>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {error && (
                                <div className="mb-3 p-2.5 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {error}
                                </div>
                            )}

                            {loading && entries.length === 0 ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin" color="#94A3B8" />
                                </div>
                            ) : entries.length === 0 ? (
                                <p className="text-center text-[12px] py-8" style={{ color: subText }}>
                                    Aucune action enregistrée pour cet arbre.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {entries.map((entry) => {
                                        const isExpanded = expanded.has(entry.id)
                                        const diffKeys = entry.diff ? Object.keys(entry.diff) : []
                                        return (
                                            <li
                                                key={entry.id}
                                                className="rounded-xl border overflow-hidden"
                                                style={{
                                                    background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,249,0.7)',
                                                    borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)',
                                                }}
                                            >
                                                <button
                                                    onClick={() => toggleExpand(entry.id)}
                                                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5"
                                                >
                                                    <div
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                        style={{ background: actionBg(entry.action) }}
                                                    >
                                                        <ActionIcon action={entry.action} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: actionColor(entry.action) }}>
                                                                {entry.action === 'INSERT' ? 'Création' : entry.action === 'UPDATE' ? 'Modification' : 'Suppression'}
                                                            </span>
                                                            <span className="text-[10px] font-mono" style={{ color: subText }}>·</span>
                                                            <span className="text-[11px] font-bold" style={{ color: textColor }}>
                                                                {TABLE_LABEL[entry.table_name] || entry.table_name}
                                                            </span>
                                                            <span className="text-[10px] font-mono" style={{ color: subText }}>·</span>
                                                            <span className="text-[11px] truncate" style={{ color: textColor }}>
                                                                {formatRecordSummary(entry)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] mt-0.5" style={{ color: subText }}>
                                                            {entry.actor_email || 'système'} · {formatRelative(entry.created_at)}
                                                            {entry.action === 'UPDATE' && diffKeys.length > 0 && (
                                                                <> · {diffKeys.length} champ{diffKeys.length > 1 ? 's' : ''} modifié{diffKeys.length > 1 ? 's' : ''}</>
                                                            )}
                                                        </p>
                                                    </div>
                                                    {isExpanded ? <ChevronDown size={14} color={subText} /> : <ChevronRight size={14} color={subText} />}
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-3 pb-3 border-t" style={{ borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)' }}>
                                                        {entry.action === 'UPDATE' && diffKeys.length > 0 && (
                                                            <div className="mt-2 space-y-1.5">
                                                                {diffKeys.map((k) => (
                                                                    <div key={k} className="grid grid-cols-[100px_1fr] gap-2 text-[10px]">
                                                                        <span className="font-mono font-bold" style={{ color: subText }}>{k}</span>
                                                                        <div>
                                                                            <span className="line-through" style={{ color: '#EF4444' }}>
                                                                                {JSON.stringify(entry.diff![k].old) || '∅'}
                                                                            </span>
                                                                            <span className="mx-1.5" style={{ color: subText }}>→</span>
                                                                            <span style={{ color: '#10B981' }}>
                                                                                {JSON.stringify(entry.diff![k].new) || '∅'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {(entry.action === 'INSERT' || entry.action === 'DELETE') && (
                                                            <details className="mt-2">
                                                                <summary className="text-[10px] cursor-pointer" style={{ color: subText }}>
                                                                    Données {entry.action === 'INSERT' ? 'créées' : 'supprimées'}
                                                                </summary>
                                                                <pre className="mt-1 text-[10px] p-2 rounded-lg overflow-x-auto" style={{ background: isDark ? 'rgba(15,23,42,0.7)' : 'rgba(241,245,249,0.9)', color: textColor }}>
                                                                    {JSON.stringify(entry.after_data || entry.before_data, null, 2)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                )}
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
