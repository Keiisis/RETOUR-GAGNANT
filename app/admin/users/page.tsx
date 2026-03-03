'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    UserCog, Search, Loader2, Plus, Trash2,
    Shield, User, Eye, EyeOff, Mail, RefreshCw,
    CheckCircle2, XCircle, Clock, Edit2
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AdminUser {
    id: string
    email: string
    full_name: string
    role: string
    is_active: boolean
    last_seen_at: string | null
    created_at: string
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editRole, setEditRole] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/users')
            if (!res.ok) throw new Error('Erreur chargement utilisateurs')
            const data = await res.json()
            setUsers(data.users || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const toggleActive = async (user: AdminUser) => {
        const res = await fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !user.is_active }),
        })
        if (res.ok) {
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
        }
    }

    const saveRole = async (userId: string) => {
        setSaving(true)
        const res = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: editRole }),
        })
        if (res.ok) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: editRole } : u))
            setEditingId(null)
        }
        setSaving(false)
    }

    const deleteUser = async (user: AdminUser) => {
        if (!confirm(`Supprimer définitivement ${user.full_name} (${user.email}) ?\nCette action est irréversible.`)) return
        const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
        if (res.ok) {
            setUsers(prev => prev.filter(u => u.id !== user.id))
        }
    }

    const isOnline = (last: string | null) =>
        last ? new Date(last) > new Date(Date.now() - 5 * 60 * 1000) : false

    const filtered = users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <UserCog size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Gestion des Accès</span>
                    </div>
                    <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                        UTILISATEURS <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]">ADMIN</span>
                    </h1>
                    <p className="text-sm text-gray-500">
                        {users.length} compte(s) — {users.filter(u => isOnline(u.last_seen_at)).length} en ligne maintenant
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={fetchUsers} className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors" title="Rafraîchir">
                        <RefreshCw size={16} />
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#0a0f18] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 text-sm w-56"
                        />
                    </div>
                    <Link href="/admin/users/create"
                        className="flex items-center gap-2 bg-[#008751] hover:bg-[#00a36b] text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all shadow-lg">
                        <Plus size={16} /> CRÉER UN AGENT
                    </Link>
                </div>
            </div>

            {/* Role legend */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                    { role: 'agent', color: '#008751', icon: User, desc: 'Espace agent — leads, dossiers, messages, agenda' },
                    { role: 'admin', color: '#FCD116', icon: Shield, desc: 'Admin — paramètres, boutique, services, contenu' },
                    { role: 'superadmin', color: '#E8112D', icon: Shield, desc: 'SuperAdmin — tous droits, gestion des admins incluse' },
                ].map(r => (
                    <div key={r.role} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                        <r.icon size={18} style={{ color: r.color }} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs font-black text-white capitalize">{r.role}</p>
                            <p className="text-[10px] text-gray-600 mt-0.5">{r.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Table */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#FCD116]" size={36} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                        <UserCog size={40} className="text-gray-700" />
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Aucun utilisateur trouvé</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-white/[0.02] text-[9px] font-black text-gray-600 uppercase tracking-widest">
                            <div className="col-span-4">Utilisateur</div>
                            <div className="col-span-2">Rôle</div>
                            <div className="col-span-2">Statut</div>
                            <div className="col-span-3">Dernière activité</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>
                        <AnimatePresence mode="popLayout">
                            {filtered.map(user => (
                                <motion.div
                                    key={user.id}
                                    layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors items-center"
                                >
                                    {/* Avatar + info */}
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className={cn(
                                            'w-10 h-10 rounded-xl flex items-center justify-center font-black text-base relative flex-shrink-0',
                                            user.role === 'superadmin' ? 'bg-[#E8112D]/10 text-[#E8112D]' :
                                            user.role === 'admin' ? 'bg-[#FCD116]/10 text-[#FCD116]' :
                                            'bg-[#008751]/10 text-[#008751]'
                                        )}>
                                            {(user.full_name || 'U').charAt(0).toUpperCase()}
                                            {isOnline(user.last_seen_at) && (
                                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0f18]" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{user.full_name}</p>
                                            <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
                                                <Mail size={9} /> {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div className="col-span-2">
                                        {editingId === user.id ? (
                                            <div className="flex items-center gap-1">
                                                <select value={editRole} onChange={e => setEditRole(e.target.value)}
                                                    title="Changer le rôle"
                                                    className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none flex-1">
                                                    <option value="agent">Agent</option>
                                                    <option value="admin">Admin</option>
                                                    <option value="superadmin">SuperAdmin</option>
                                                </select>
                                                <button type="button" onClick={() => saveRole(user.id)} disabled={saving}
                                                    title="Sauvegarder" className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                                    {saving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                </button>
                                                <button type="button" onClick={() => setEditingId(null)} title="Annuler" className="p-1.5 bg-red-500/20 text-red-400 rounded-lg">
                                                    <XCircle size={11} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setEditingId(user.id); setEditRole(user.role) }}
                                                className={cn(
                                                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border hover:opacity-80 transition-all',
                                                    user.role === 'superadmin' ? 'bg-[#E8112D]/10 text-[#E8112D] border-[#E8112D]/20' :
                                                    user.role === 'admin' ? 'bg-[#FCD116]/10 text-[#FCD116] border-[#FCD116]/20' :
                                                    'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                                )}>
                                                {user.role === 'agent' ? <User size={9} /> : <Shield size={9} />}
                                                {user.role}
                                                <Edit2 size={8} className="opacity-40" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-2">
                                        <button onClick={() => toggleActive(user)}
                                            className={cn(
                                                'flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all',
                                                user.is_active
                                                    ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/20 hover:bg-[#008751]/20'
                                                    : 'bg-white/5 text-gray-500 border-white/5 hover:bg-white/10'
                                            )}>
                                            {user.is_active ? <Eye size={9} /> : <EyeOff size={9} />}
                                            {user.is_active ? 'Actif' : 'Inactif'}
                                        </button>
                                    </div>

                                    {/* Last seen */}
                                    <div className="col-span-3 flex items-center gap-1.5">
                                        <Clock size={10} className={isOnline(user.last_seen_at) ? 'text-emerald-400' : 'text-gray-600'} />
                                        <span className="text-[10px] text-gray-500">
                                            {isOnline(user.last_seen_at) ? 'En ligne maintenant' :
                                                user.last_seen_at
                                                    ? `Vu le ${new Date(user.last_seen_at).toLocaleDateString('fr-FR')} à ${new Date(user.last_seen_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                                                    : 'Jamais connecté'
                                            }
                                        </span>
                                    </div>

                                    {/* Delete */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        {user.role !== 'superadmin' && (
                                            <button onClick={() => deleteUser(user)}
                                                className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                                title="Supprimer">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
