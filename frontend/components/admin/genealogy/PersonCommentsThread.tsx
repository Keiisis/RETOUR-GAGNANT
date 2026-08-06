'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChatCircle as MessageCircle, PaperPlaneTilt as Send, Check, Trash as Trash2, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase'

interface Comment {
    id: string
    person_id: string
    author_id: string | null
    author_email: string | null
    body: string
    resolved_at: string | null
    resolved_by: string | null
    created_at: string
    updated_at: string
}

interface Props {
    personId: string
    isDark?: boolean
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

function formatRelative(iso: string): string {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (diff < 60) return "à l'instant"
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
    if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PersonCommentsThread({ personId, isDark = false }: Props) {
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(false)
    const [posting, setPosting] = useState(false)
    const [draft, setDraft] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const sess = await supabase.auth.getUser(token)
            setCurrentUserId(sess.data.user?.id || null)
            const res = await fetch(`/api/genealogie/persons/${personId}/comments`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setComments(json.comments || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        } finally {
            setLoading(false)
        }
    }, [personId])

    useEffect(() => { load() }, [load])

    const handlePost = async () => {
        const text = draft.trim()
        if (!text) return
        setPosting(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/persons/${personId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ body: text }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setComments((prev) => [json.comment, ...prev])
            setDraft('')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur publication')
        } finally {
            setPosting(false)
        }
    }

    const handleResolveToggle = async (c: Comment) => {
        const token = await getAuthToken()
        if (!token) return
        const res = await fetch(`/api/genealogie/persons/${personId}/comments/${c.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ resolved: !c.resolved_at }),
        })
        if (res.ok) {
            const json = await res.json()
            setComments((prev) => prev.map(p => p.id === c.id ? json.comment : p))
        }
    }

    const handleDelete = async (c: Comment) => {
        if (!confirm('Supprimer ce commentaire ?')) return
        const token = await getAuthToken()
        if (!token) return
        const res = await fetch(`/api/genealogie/persons/${personId}/comments/${c.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            setComments((prev) => prev.filter(p => p.id !== c.id))
        } else {
            const j = await res.json().catch(() => ({}))
            setError(j.error || 'Erreur suppression')
        }
    }

    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <MessageCircle size={14} color={subText} />
                <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: subText }}>
                    Discussion ({comments.length})
                </h3>
            </div>

            {error && (
                <div className="p-2 rounded-lg text-[10px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {error}
                </div>
            )}

            {/* Composer */}
            <div className="flex gap-2 items-start">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Annoter cette fiche…"
                    rows={2}
                    maxLength={4000}
                    className="flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none resize-none"
                    style={{
                        background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)',
                        color: textColor,
                        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                    }}
                />
                <button
                    onClick={handlePost}
                    disabled={posting || !draft.trim()}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    style={{ background: '#10B981', color: '#FFFFFF' }}
                >
                    {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Publier
                </button>
            </div>

            {/* List */}
            {loading && comments.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin" color={subText} />
                </div>
            ) : comments.length === 0 ? (
                <p className="text-center text-[10px] py-3" style={{ color: subText }}>
                    Aucun commentaire. Soyez le premier à annoter.
                </p>
            ) : (
                <ul className="space-y-2">
                    {comments.map((c) => {
                        const isOwn = c.author_id === currentUserId
                        const isResolved = !!c.resolved_at
                        return (
                            <li
                                key={c.id}
                                className="p-2.5 rounded-xl border"
                                style={{
                                    background: isResolved
                                        ? (isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)')
                                        : (isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.9)'),
                                    borderColor: isResolved
                                        ? 'rgba(16,185,129,0.25)'
                                        : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.4)'),
                                    opacity: isResolved ? 0.85 : 1,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[9px] font-mono font-bold truncate" style={{ color: subText }}>
                                        {c.author_email || 'Anonyme'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px]" style={{ color: subText }}>{formatRelative(c.created_at)}</span>
                                        <button
                                            onClick={() => handleResolveToggle(c)}
                                            className="p-1 rounded hover:bg-white/10"
                                            title={isResolved ? 'Re-ouvrir' : 'Marquer comme résolu'}
                                        >
                                            <Check size={11} color={isResolved ? '#10B981' : subText} />
                                        </button>
                                        {isOwn && (
                                            <button
                                                onClick={() => handleDelete(c)}
                                                className="p-1 rounded hover:bg-white/10"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={11} color="#EF4444" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-[11px] whitespace-pre-wrap" style={{ color: textColor, textDecoration: isResolved ? 'line-through' : 'none' }}>
                                    {c.body}
                                </p>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
