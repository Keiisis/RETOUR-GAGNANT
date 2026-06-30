'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Plus, Trash2, Loader2, FileText, X, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Confidence = 'proven' | 'probable' | 'possible' | 'unverified' | 'disputed'

interface Fact {
    id: string
    person_id: string
    fact_type: string
    value: string
    value_date: string | null
    source_doc_id: string | null
    source_text: string | null
    confidence: Confidence
    notes: string | null
    created_at: string
    source_doc?: { id: string; doc_type: string; title: string | null; file_url: string | null } | null
}

interface Props {
    personId: string
    isDark?: boolean
}

const FACT_TYPES = [
    { v: 'birth_date', label: 'Date de naissance' },
    { v: 'birth_place', label: 'Lieu de naissance' },
    { v: 'death_date', label: 'Date de décès' },
    { v: 'death_place', label: 'Lieu de décès' },
    { v: 'first_name', label: 'Prénom' },
    { v: 'last_name', label: 'Nom' },
    { v: 'gender', label: 'Genre' },
    { v: 'occupation', label: 'Profession' },
    { v: 'residence', label: 'Résidence' },
    { v: 'baptism', label: 'Baptême' },
    { v: 'marriage', label: 'Mariage' },
    { v: 'immigration', label: 'Immigration' },
    { v: 'emigration', label: 'Émigration' },
    { v: 'education', label: 'Éducation' },
    { v: 'military', label: 'Service militaire' },
    { v: 'other', label: 'Autre' },
]

const CONF_LABEL: Record<Confidence, string> = {
    proven: 'Prouvé',
    probable: 'Probable',
    possible: 'Possible',
    unverified: 'Non vérifié',
    disputed: 'Contesté',
}

const CONF_COLOR: Record<Confidence, string> = {
    proven: '#10B981',
    probable: '#3B82F6',
    possible: '#F59E0B',
    unverified: '#94A3B8',
    disputed: '#EF4444',
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

export default function PersonFactsList({ personId, isDark = false }: Props) {
    const [facts, setFacts] = useState<Fact[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const [newFact, setNewFact] = useState({
        fact_type: 'birth_date',
        value: '',
        value_date: '',
        source_text: '',
        confidence: 'unverified' as Confidence,
        notes: '',
    })
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/persons/${personId}/facts`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setFacts(json.facts || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [personId])

    useEffect(() => { load() }, [load])

    const handleAdd = async () => {
        const value = newFact.value.trim()
        if (!value) return
        setSaving(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/persons/${personId}/facts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...newFact,
                    value,
                    value_date: newFact.value_date || null,
                    source_text: newFact.source_text || null,
                    notes: newFact.notes || null,
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setFacts((prev) => [json.fact, ...prev])
            setShowAdd(false)
            setNewFact({ fact_type: 'birth_date', value: '', value_date: '', source_text: '', confidence: 'unverified', notes: '' })
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur ajout')
        } finally {
            setSaving(false)
        }
    }

    const handleConfidenceChange = async (factId: string, confidence: Confidence) => {
        const token = await getAuthToken()
        if (!token) return
        const res = await fetch(`/api/genealogie/persons/${personId}/facts/${factId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ confidence }),
        })
        if (res.ok) {
            setFacts((prev) => prev.map(f => f.id === factId ? { ...f, confidence } : f))
        }
    }

    const handleDelete = async (factId: string) => {
        if (!confirm('Supprimer ce fait ?')) return
        const token = await getAuthToken()
        if (!token) return
        const res = await fetch(`/api/genealogie/persons/${personId}/facts/${factId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            setFacts((prev) => prev.filter(f => f.id !== factId))
        }
    }

    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'
    const inputBg = isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)'
    const inputBorder = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)'

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={14} color={subText} />
                    <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: subText }}>
                        Faits attestés ({facts.length})
                    </h3>
                </div>
                <button
                    onClick={() => setShowAdd((v) => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{ background: '#10B981', color: '#FFFFFF' }}
                >
                    {showAdd ? <X size={10} /> : <Plus size={10} />}
                    {showAdd ? 'Annuler' : 'Ajouter'}
                </button>
            </div>

            {error && (
                <div className="p-2 rounded-lg text-[10px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {error}
                </div>
            )}

            {showAdd && (
                <div className="rounded-xl border p-3 space-y-2" style={{ background: inputBg, borderColor: inputBorder }}>
                    <div className="grid grid-cols-2 gap-2">
                        <select
                            value={newFact.fact_type}
                            onChange={(e) => setNewFact({ ...newFact, fact_type: e.target.value })}
                            className="px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                            style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                        >
                            {FACT_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                        </select>
                        <select
                            value={newFact.confidence}
                            onChange={(e) => setNewFact({ ...newFact, confidence: e.target.value as Confidence })}
                            className="px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                            style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                        >
                            {(['proven','probable','possible','unverified','disputed'] as Confidence[]).map(c => (
                                <option key={c} value={c}>{CONF_LABEL[c]}</option>
                            ))}
                        </select>
                    </div>
                    <input
                        value={newFact.value}
                        onChange={(e) => setNewFact({ ...newFact, value: e.target.value })}
                        placeholder="Valeur (ex: 15 mai 1950)"
                        className="w-full px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                        style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                    />
                    <input
                        type="date"
                        value={newFact.value_date}
                        onChange={(e) => setNewFact({ ...newFact, value_date: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none"
                        style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                    />
                    <textarea
                        value={newFact.source_text}
                        onChange={(e) => setNewFact({ ...newFact, source_text: e.target.value })}
                        placeholder="Source (témoignage, registre, livre, etc.)"
                        rows={2}
                        className="w-full px-2 py-1.5 rounded-lg text-[11px] border focus:outline-none resize-none"
                        style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving || !newFact.value.trim()}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                        style={{ background: '#10B981', color: '#FFFFFF' }}
                    >
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Enregistrer
                    </button>
                </div>
            )}

            {loading && facts.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin" color={subText} />
                </div>
            ) : facts.length === 0 ? (
                <p className="text-center text-[10px] py-3" style={{ color: subText }}>
                    Aucun fait attesté pour cette personne.
                </p>
            ) : (
                <ul className="space-y-1.5">
                    {facts.map((f) => {
                        const factTypeLabel = FACT_TYPES.find(t => t.v === f.fact_type)?.label || f.fact_type
                        return (
                            <li
                                key={f.id}
                                className="rounded-lg border p-2 flex items-start gap-2"
                                style={{
                                    background: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.9)',
                                    borderColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)',
                                }}
                            >
                                <div
                                    className="w-1.5 self-stretch rounded-full"
                                    style={{ background: CONF_COLOR[f.confidence] }}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] font-mono uppercase tracking-wider font-bold" style={{ color: subText }}>
                                            {factTypeLabel}
                                        </span>
                                        <span
                                            className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider"
                                            style={{ background: CONF_COLOR[f.confidence] + '22', color: CONF_COLOR[f.confidence] }}
                                        >
                                            {CONF_LABEL[f.confidence]}
                                        </span>
                                    </div>
                                    <p className="text-[11px] mt-0.5 break-words" style={{ color: textColor }}>{f.value}</p>
                                    {f.source_text && (
                                        <p className="text-[9px] mt-0.5 italic" style={{ color: subText }}>
                                            Source : {f.source_text}
                                        </p>
                                    )}
                                    {f.source_doc && (
                                        <a
                                            href={f.source_doc.file_url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-[9px] mt-0.5"
                                            style={{ color: '#3B82F6' }}
                                        >
                                            <FileText size={9} />
                                            {f.source_doc.title || f.source_doc.doc_type}
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <select
                                        value={f.confidence}
                                        onChange={(e) => handleConfidenceChange(f.id, e.target.value as Confidence)}
                                        className="px-1 py-0.5 rounded text-[9px] border focus:outline-none"
                                        style={{ background: inputBg, color: textColor, borderColor: inputBorder }}
                                    >
                                        {(['proven','probable','possible','unverified','disputed'] as Confidence[]).map(c => (
                                            <option key={c} value={c}>{CONF_LABEL[c]}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleDelete(f.id)}
                                        className="p-1 rounded hover:bg-white/10"
                                        title="Supprimer"
                                    >
                                        <Trash2 size={10} color="#EF4444" />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            <p className="text-[9px] flex items-start gap-1" style={{ color: subText }}>
                <AlertTriangle size={9} className="mt-0.5 flex-shrink-0" />
                Seuls les faits <strong>Prouvé</strong> ou <strong>Probable</strong> seront inclus dans le PDF du dossier RGB.
            </p>
        </div>
    )
}
