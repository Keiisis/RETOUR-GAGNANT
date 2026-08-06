'use client'

import { useCallback, useEffect, useState } from 'react'
import { Users, X, UserPlus, Trash as Trash2, Check, CircleNotch as Loader2, ShieldCheck, Eye } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase'

interface Collaborator {
    id: string
    tree_id: string
    user_id: string
    role: 'viewer' | 'editor'
    invited_by: string | null
    accepted_at: string | null
    created_at: string
    user_email: string | null
    invited_by_email: string | null
}

interface Props {
    treeId: string
    isDark?: boolean
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

export default function CollaboratorsModal({ treeId, isDark = false }: Props) {
    const [open, setOpen] = useState(false)
    const [collabs, setCollabs] = useState<Collaborator[]>([])
    const [loading, setLoading] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer')
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch(`/api/genealogie/collaborators?tree_id=${treeId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setCollabs(json.collaborators || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur de chargement')
        } finally {
            setLoading(false)
        }
    }, [treeId])

    useEffect(() => {
        if (open) load()
    }, [open, load])

    const handleInvite = async () => {
        const email = inviteEmail.trim().toLowerCase()
        if (!email) return
        setInviting(true)
        setError(null)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')
            const res = await fetch('/api/genealogie/collaborators', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ tree_id: treeId, email, role: inviteRole }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
            setInviteEmail('')
            setInviteRole('viewer')
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Échec invitation')
        } finally {
            setInviting(false)
        }
    }

    const handleRoleChange = async (collab: Collaborator, newRole: 'viewer' | 'editor') => {
        try {
            const token = await getAuthToken()
            if (!token) return
            const res = await fetch(`/api/genealogie/collaborators/${collab.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role: newRole }),
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                setError(j.error || `Erreur ${res.status}`)
                return
            }
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        }
    }

    const handleRevoke = async (collab: Collaborator) => {
        if (!confirm(`Révoquer l'accès de ${collab.user_email || 'cet utilisateur'} ?`)) return
        try {
            const token = await getAuthToken()
            if (!token) return
            const res = await fetch(`/api/genealogie/collaborators/${collab.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                setError(j.error || `Erreur ${res.status}`)
                return
            }
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur')
        }
    }

    const bgPanel = isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)'
    const textColor = isDark ? '#E2E8F0' : '#1a2332'
    const subText = isDark ? '#94A3B8' : '#718096'

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold"
                style={{
                    background: isDark ? 'rgba(124,92,202,0.12)' : 'rgba(124,92,202,0.08)',
                    color: isDark ? '#A78BFA' : '#7C5CCA',
                    border: `1px solid ${isDark ? 'rgba(124,92,202,0.25)' : 'rgba(124,92,202,0.2)'}`,
                }}
                title="Partager l'arbre avec d'autres utilisateurs"
            >
                <Users size={14} />
                Partager
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: bgPanel, border: '1px solid rgba(124,92,202,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgba(124,92,202,0.2)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,92,202,0.15)' }}>
                                    <Users size={18} color="#7C5CCA" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: textColor }}>Collaborateurs</h2>
                                    <p className="text-[10px] font-mono" style={{ color: subText }}>Gérez qui peut consulter ou éditer cet arbre</p>
                                </div>
                            </div>
                            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                                <X size={16} color={subText} />
                            </button>
                        </div>

                        {/* Invite form */}
                        <div className="p-5 border-b" style={{ borderColor: 'rgba(124,92,202,0.15)' }}>
                            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: subText }}>
                                Inviter par e-mail
                            </label>
                            <div className="mt-2 flex gap-2">
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="utilisateur@exemple.com"
                                    className="flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none"
                                    style={{
                                        background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)',
                                        color: textColor,
                                        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                                    }}
                                />
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'editor')}
                                    className="px-3 py-2 rounded-xl text-xs border focus:outline-none"
                                    style={{
                                        background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(248,250,249,0.9)',
                                        color: textColor,
                                        borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                                    }}
                                >
                                    <option value="viewer">Lecteur</option>
                                    <option value="editor">Éditeur</option>
                                </select>
                                <button
                                    onClick={handleInvite}
                                    disabled={inviting || !inviteEmail.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                                    style={{ background: '#7C5CCA', color: '#FFFFFF' }}
                                >
                                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                    Inviter
                                </button>
                            </div>
                            <p className="mt-2 text-[10px]" style={{ color: subText }}>
                                Lecteur = consultation seule. Éditeur = peut modifier l&apos;arbre et les documents.
                            </p>
                        </div>

                        {/* List */}
                        <div className="max-h-[40vh] overflow-y-auto p-5">
                            {error && (
                                <div className="mb-3 p-2.5 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {error}
                                </div>
                            )}

                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={20} className="animate-spin" color="#7C5CCA" />
                                </div>
                            ) : collabs.length === 0 ? (
                                <p className="text-center text-[11px] py-6" style={{ color: subText }}>
                                    Aucun collaborateur invité. Invitez quelqu&apos;un pour commencer.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {collabs.map((c) => (
                                        <li
                                            key={c.id}
                                            className="flex items-center gap-3 p-3 rounded-xl"
                                            style={{ background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(248,250,249,0.7)', border: '1px solid rgba(124,92,202,0.15)' }}
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: c.role === 'editor' ? 'rgba(16,185,129,0.15)' : 'rgba(124,92,202,0.15)' }}>
                                                {c.role === 'editor' ? <ShieldCheck size={14} color="#10B981" /> : <Eye size={14} color="#7C5CCA" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold truncate" style={{ color: textColor }}>{c.user_email || c.user_id.slice(0, 8)}</p>
                                                <p className="text-[10px]" style={{ color: subText }}>
                                                    {c.accepted_at ? (
                                                        <span className="inline-flex items-center gap-1"><Check size={9} /> Accepté</span>
                                                    ) : (
                                                        'Invitation en attente'
                                                    )}
                                                    {' · '}invité {new Date(c.created_at).toLocaleDateString('fr-FR')}
                                                </p>
                                            </div>
                                            <select
                                                value={c.role}
                                                onChange={(e) => handleRoleChange(c, e.target.value as 'viewer' | 'editor')}
                                                className="px-2 py-1 rounded-lg text-[10px] border focus:outline-none"
                                                style={{
                                                    background: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.9)',
                                                    color: textColor,
                                                    borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(203,213,225,0.6)',
                                                }}
                                            >
                                                <option value="viewer">Lecteur</option>
                                                <option value="editor">Éditeur</option>
                                            </select>
                                            <button
                                                onClick={() => handleRevoke(c)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/15"
                                                title="Révoquer l'accès"
                                            >
                                                <Trash2 size={13} color="#EF4444" />
                                            </button>
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
