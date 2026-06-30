'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
    treeId: string
    onImported?: () => void
    isDark?: boolean
}

interface ImportSummary {
    individuals_imported: number
    relations_set: number
    warnings: string[]
    errors: string[]
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

export default function GedcomImportButton({ treeId, onImported, isDark = false }: Props) {
    const fileRef = useRef<HTMLInputElement | null>(null)
    const [importing, setImporting] = useState(false)
    const [summary, setSummary] = useState<ImportSummary | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 10 * 1024 * 1024) {
            setError('Fichier trop volumineux (max 10 Mo)')
            return
        }

        setImporting(true)
        setError(null)
        setSummary(null)
        try {
            const gedcom = await file.text()
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')

            const res = await fetch('/api/genealogie/import-gedcom', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ tree_id: treeId, gedcom }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setSummary({
                individuals_imported: json.individuals_imported,
                relations_set: json.relations_set,
                warnings: json.warnings || [],
                errors: json.errors || [],
            })
            onImported?.()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur import')
        } finally {
            setImporting(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    const bgPanel = isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)'
    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'

    return (
        <>
            <input
                ref={fileRef}
                type="file"
                accept=".ged,.gedcom,text/plain"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
            <button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold disabled:opacity-50"
                style={{
                    background: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)',
                    color: '#6366F1',
                    border: `1px solid ${isDark ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.25)'}`,
                }}
                title="Importer un fichier GEDCOM (.ged) depuis Gramps, Geneanet, FamilySearch…"
            >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Import…' : 'Importer GEDCOM'}
            </button>

            {(summary || error) && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={() => { setSummary(null); setError(null) }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: bgPanel, border: error ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: error ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: error ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }}>
                                    {error ? <AlertTriangle size={18} color="#EF4444" /> : <CheckCircle2 size={18} color="#10B981" />}
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: textColor }}>
                                        {error ? 'Échec import' : 'Import terminé'}
                                    </h2>
                                </div>
                            </div>
                            <button onClick={() => { setSummary(null); setError(null) }} className="p-1.5 rounded-lg hover:bg-white/10">
                                <X size={16} color={subText} />
                            </button>
                        </div>

                        <div className="p-5 space-y-3">
                            {error && (
                                <p className="text-[12px]" style={{ color: '#EF4444' }}>{error}</p>
                            )}
                            {summary && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10B981' }}>Personnes</p>
                                            <p className="text-2xl font-black mt-1" style={{ color: textColor }}>{summary.individuals_imported}</p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6366F1' }}>Relations</p>
                                            <p className="text-2xl font-black mt-1" style={{ color: textColor }}>{summary.relations_set}</p>
                                        </div>
                                    </div>

                                    {summary.warnings.length > 0 && (
                                        <details className="rounded-xl border p-3" style={{ borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.08)' }}>
                                            <summary className="text-[11px] font-bold cursor-pointer" style={{ color: '#D97706' }}>
                                                {summary.warnings.length} avertissement(s)
                                            </summary>
                                            <ul className="mt-2 space-y-1 text-[10px]" style={{ color: subText }}>
                                                {summary.warnings.slice(0, 10).map((w, i) => (<li key={i}>• {w}</li>))}
                                                {summary.warnings.length > 10 && <li>… et {summary.warnings.length - 10} autres</li>}
                                            </ul>
                                        </details>
                                    )}

                                    {summary.errors.length > 0 && (
                                        <details className="rounded-xl border p-3" style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)' }}>
                                            <summary className="text-[11px] font-bold cursor-pointer" style={{ color: '#EF4444' }}>
                                                {summary.errors.length} erreur(s)
                                            </summary>
                                            <ul className="mt-2 space-y-1 text-[10px]" style={{ color: subText }}>
                                                {summary.errors.slice(0, 10).map((er, i) => (<li key={i}>• {er}</li>))}
                                            </ul>
                                        </details>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="p-4 border-t" style={{ borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)' }}>
                            <button
                                onClick={() => { setSummary(null); setError(null) }}
                                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
                                style={{ background: error ? '#EF4444' : '#10B981', color: '#FFFFFF' }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
