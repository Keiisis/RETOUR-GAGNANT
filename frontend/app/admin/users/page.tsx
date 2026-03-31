'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    UserCog, Search, Loader2, Plus, Trash2, Shield, User,
    Eye, EyeOff, Mail, RefreshCw, CheckCircle2, XCircle,
    Clock, Edit2, X, KeyRound, AlertTriangle, Wifi, WifiOff,
    Users, Crown, UserCheck, Lock
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdminUser {
    id: string
    email: string
    full_name: string
    role: string
    is_active: boolean
    last_seen_at: string | null
    created_at: string
}

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = [
    { value: 'agent', label: 'Agent', color: '#008751', Icon: User, desc: 'Leads, dossiers, messages, agenda' },
    { value: 'admin', label: 'Admin', color: '#FCD116', Icon: Shield, desc: 'Paramètres, boutique, services, contenu' },
    { value: 'superadmin', label: 'Super Admin', color: '#E8112D', Icon: Crown, desc: 'Tous droits, gestion des admins incluse' },
]

const roleColor = (r: string) => ROLES.find(x => x.value === r)?.color ?? '#6b7280'

// ─── Toast Component ──────────────────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className={cn(
                            'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold shadow-2xl',
                            t.type === 'success' ? 'bg-[#008751]/20 border-[#008751]/40 text-[#00c97a]' :
                                t.type === 'error' ? 'bg-[#E8112D]/20 border-[#E8112D]/40 text-[#ff6b7a]' :
                                    'bg-white/10 border-white/10 text-white'
                        )}
                    >
                        {t.type === 'success' ? <CheckCircle2 size={16} /> : t.type === 'error' ? <XCircle size={16} /> : <UserCog size={16} />}
                        {t.message}
                        <button type="button" onClick={() => dismiss(t.id)} className="ml-2 opacity-50 hover:opacity-100">
                            <X size={13} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteModal({ user, onConfirm, onCancel, loading }: {
    user: AdminUser; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onCancel}
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="relative bg-[#0a0f18] border border-red-500/20 rounded-2xl p-8 w-full max-w-md space-y-6 shadow-2xl"
            >
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest"><T>Action irréversible</T></p>
                        <h3 className="text-xl font-black text-white"><T>Supprimer ce compte</T></h3>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-sm font-bold text-white">{user.full_name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{user.email}</p>
                    <span className="inline-block mt-2 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ color: roleColor(user.role), backgroundColor: roleColor(user.role) + '20', border: `1px solid ${roleColor(user.role)}30` }}>
                        {user.role}
                    </span>
                </div>

                <p className="text-sm text-gray-400">
                    Le compte sera <span className="text-red-400 font-bold"><T>définitivement supprimé</T></span> de Supabase Auth et de la base de données. Cet agent ne pourra plus se connecter.
                </p>

                <div className="flex gap-3">
                    <button type="button" onClick={onCancel}
                        className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 font-black text-xs tracking-widest hover:bg-white/10 transition-colors">
                        ANNULER
                    </button>
                    <button type="button" onClick={onConfirm} disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black text-xs tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        SUPPRIMER
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── User Drawer (Create / Edit) ──────────────────────────────────────────────
function UserDrawer({ mode, user, onClose, onSaved, toast }: {
    mode: 'create' | 'edit'
    user?: AdminUser
    onClose: () => void
    onSaved: (updated: AdminUser, isNew: boolean) => void
    toast: (type: Toast['type'], msg: string) => void
}) {
    const { t } = useTranslation();
    const [fullName, setFullName] = useState(user?.full_name ?? '')
    const [email, setEmail] = useState(user?.email ?? '')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState(user?.role ?? 'agent')
    const [isActive, setIsActive] = useState(user?.is_active ?? true)
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    const handleSave = async () => {
        if (!fullName.trim() || !email.trim()) { setErr('Nom et email obligatoires'); return }
        if (mode === 'create' && password.length < 6) { setErr('Mot de passe min 6 caractères'); return }
        setSaving(true); setErr('')
        try {
            if (mode === 'create') {
                const res = await fetch('/api/admin/users/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim(), role }),
                })
                const data = await res.json()
                if (!res.ok) { setErr(data.error || 'Erreur création'); return }
                onSaved({
                    id: data.user.id, email: data.user.email,
                    full_name: fullName.trim(), role, is_active: true,
                    last_seen_at: null, created_at: new Date().toISOString()
                }, true)
                toast('success', data.updated ? `Compte "${fullName}" mis à jour` : `Compte "${fullName}" créé`)
            } else if (user) {
                const body: Record<string, unknown> = { full_name: fullName.trim(), role, is_active: isActive }
                if (password) body.password = password
                const res = await fetch(`/api/admin/users/${user.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
                const data = await res.json()
                if (!res.ok) { setErr(data.error || 'Erreur sauvegarde'); return }
                onSaved({ ...user, full_name: fullName.trim(), role, is_active: isActive }, false)
                toast('success', `Profil "${fullName}" sauvegardé`)
            }
            onClose()
        } catch { setErr('Erreur réseau') } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-[90] flex">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="w-full max-w-lg bg-[#070c14] border-l border-white/10 flex flex-col h-full overflow-y-auto"
            >
                {/* Drawer header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#070c14] z-10">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FCD116]">
                            {mode === 'create' ? 'Nouveau Compte' : 'Modifier le Compte'}
                        </p>
                        <h2 className="text-xl font-black text-white">
                            {mode === 'create' ? 'Créer un utilisateur' : user?.full_name}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose}
                        className="p-2 rounded-xl bg-white/5 text-gray-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Drawer body */}
                <div className="flex-1 p-6 space-y-6">
                    {/* Avatar preview */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0"
                            style={{ backgroundColor: roleColor(role) + '20', color: roleColor(role) }}>
                            {(fullName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{fullName || 'Nom complet'}</p>
                            <p className="text-[10px] text-gray-500">{email || 'email@exemple.com'}</p>
                            <span className="inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                                style={{ color: roleColor(role), backgroundColor: roleColor(role) + '20' }}>
                                {role}
                            </span>
                        </div>
                    </div>

                    {/* Nom */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block"><T>Nom complet *</T></label>
                        <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                            placeholder={t("Prénom et Nom")}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Mail size={11} /> Email *
                            {mode === 'edit' && <span className="font-normal normal-case text-gray-600"><T>(non modifiable après création)</T></span>}
                        </label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder={t("agent@retourgagnant.com")}
                            disabled={mode === 'edit'}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <KeyRound size={11} /> {mode === 'create' ? 'Mot de passe *' : 'Nouveau mot de passe'}
                            {mode === 'edit' && <span className="font-normal normal-case text-gray-600"><T>(laisser vide = inchangé)</T></span>}
                        </label>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={mode === 'create' ? 'Minimum 6 caractères' : '••••••••'}
                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 pr-12 text-white text-sm focus:outline-none focus:border-[#FCD116]/30 transition-colors" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                title={showPassword ? 'Masquer' : 'Afficher'}>
                                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block"><T>Rôle *</T></label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {ROLES.map(r => (
                                <button key={r.value} type="button" onClick={() => setRole(r.value)}
                                    className={cn('p-3 rounded-xl border text-left transition-all',
                                        role === r.value ? 'border-opacity-40 bg-opacity-10' : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                                    )}
                                    style={role === r.value ? { borderColor: r.color + '40', backgroundColor: r.color + '12' } : {}}>
                                    <r.Icon size={16} className="mb-1.5" style={{ color: role === r.value ? r.color : '#6b7280' }} />
                                    <p className="text-[10px] font-black text-white">{r.label}</p>
                                    <p className="text-[8px] text-gray-600 mt-0.5 leading-relaxed">{r.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Active toggle (edit only) */}
                    {mode === 'edit' && (
                        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5">
                            <div>
                                <p className="text-sm font-bold text-white"><T>Compte actif</T></p>
                                <p className="text-[10px] text-gray-500"><T>L&apos;agent peut se connecter</T></p>
                            </div>
                            <button type="button" onClick={() => setIsActive(!isActive)}
                                className={cn('w-12 h-6 rounded-full transition-colors relative', isActive ? 'bg-[#008751]' : 'bg-white/10')}
                                title={isActive ? 'Désactiver' : 'Activer'}>
                                <span className={cn('absolute top-1 w-4 h-4 bg-white rounded-full transition-all', isActive ? 'left-7' : 'left-1')} />
                            </button>
                        </div>
                    )}

                    {err && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">{err}</div>
                    )}
                </div>

                {/* Drawer footer */}
                <div className="p-6 border-t border-white/5 sticky bottom-0 bg-[#070c14] flex gap-3">
                    <button type="button" onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 font-black text-xs tracking-widest hover:bg-white/10 transition-colors">
                        ANNULER
                    </button>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="flex-1 py-3 rounded-xl text-white font-black text-xs tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ backgroundColor: mode === 'create' ? '#008751' : '#FCD116', color: mode === 'create' ? 'white' : 'black' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : mode === 'create' ? <Plus size={14} /> : <CheckCircle2 size={14} />}
                        {mode === 'create' ? 'CRÉER LE COMPTE' : 'SAUVEGARDER'}
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<'all' | 'agent' | 'admin' | 'superadmin'>('all')
    const [toasts, setToasts] = useState<Toast[]>([])
    const toastId = useRef(0)

    const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null)
    const [editingUser, setEditingUser] = useState<AdminUser | undefined>()
    const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const toast = useCallback((type: Toast['type'], message: string) => {
        const id = ++toastId.current
        setToasts(prev => [...prev, { id, type, message }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    }, [])

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/users')
            if (!res.ok) throw new Error('Erreur chargement')
            const data = await res.json()
            setUsers(data.users || [])
        } catch (e) {
            toast('error', e instanceof Error ? e.message : 'Erreur chargement utilisateurs')
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    // Auto-refresh online status every 30s
    useEffect(() => {
        const interval = setInterval(() => {
            fetch('/api/admin/users').then(r => r.json()).then(d => {
                if (d.users) setUsers(d.users)
            }).catch(() => { })
        }, 30000)
        return () => clearInterval(interval)
    }, [])

    const isOnline = (last: string | null) =>
        last ? new Date(last) > new Date(Date.now() - 5 * 60 * 1000) : false

    const toggleActive = async (user: AdminUser) => {
        const next = !user.is_active
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: next } : u))
        const res = await fetch(`/api/admin/users/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: next }),
        })
        if (!res.ok) {
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !next } : u))
            toast('error', 'Erreur mise à jour statut')
        } else {
            toast('info', `${user.full_name} — compte ${next ? 'activé' : 'désactivé'}`)
        }
    }

    const confirmDelete = async () => {
        if (!deletingUser) return
        setDeleteLoading(true)
        const res = await fetch(`/api/admin/users/${deletingUser.id}`, { method: 'DELETE' })
        if (res.ok) {
            setUsers(prev => prev.filter(u => u.id !== deletingUser.id))
            toast('success', `Compte "${deletingUser.full_name}" supprimé`)
            setDeletingUser(null)
        } else {
            const data = await res.json()
            toast('error', data.error || 'Erreur suppression')
        }
        setDeleteLoading(false)
    }

    const handleSaved = (updated: AdminUser, isNew: boolean) => {
        if (isNew) {
            setUsers(prev => [updated, ...prev])
        } else {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
        }
    }

    const filtered = users.filter(u => {
        const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase())
        const matchRole = roleFilter === 'all' || u.role === roleFilter
        return matchSearch && matchRole
    })

    const stats = {
        total: users.length,
        online: users.filter(u => isOnline(u.last_seen_at)).length,
        agents: users.filter(u => u.role === 'agent').length,
        admins: users.filter(u => u.role === 'admin' || u.role === 'superadmin').length,
    }

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-700">
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <UserCog size={18} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Gestion des Accès</T></span>
                        </div>
                        <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                            UTILISATEURS <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#E8112D]"><T>SYSTÈME</T></span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button type="button" onClick={fetchUsers}
                            className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                            title={t("Rafraîchir la liste")}>
                            <RefreshCw size={16} />
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                            <input type="text" placeholder={t("Rechercher...")} value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-[#0a0f18] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 text-sm w-full sm:w-52" />
                        </div>
                        <button type="button" onClick={() => { setEditingUser(undefined); setDrawerMode('create') }}
                            className="flex items-center gap-2 bg-[#008751] hover:bg-[#00a36b] text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all shadow-lg">
                            <Plus size={16} /> CRÉER UN COMPTE
                        </button>
                    </div>
                </div>

                {/* ── Stats ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Total comptes', value: stats.total, icon: Users, color: '#6b7280' },
                        { label: 'En ligne', value: stats.online, icon: Wifi, color: '#10b981', pulse: stats.online > 0 },
                        { label: 'Agents', value: stats.agents, icon: UserCheck, color: '#008751' },
                        { label: 'Admins', value: stats.admins, icon: Lock, color: '#FCD116' },
                    ].map(s => (
                        <div key={s.label} className="p-5 rounded-2xl bg-[#0a0f18] border border-white/5 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: s.color + '15' }}>
                                <s.icon size={18} style={{ color: s.color }} />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-white">{s.value}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{s.label}</p>
                            </div>
                            {s.pulse && s.value > 0 && (
                                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Role filter tabs ────────────────────────────────── */}
                <div className="flex items-center gap-2 flex-wrap">
                    {([
                        { value: 'all', label: `Tous (${users.length})` },
                        { value: 'agent', label: `Agents (${stats.agents})` },
                        { value: 'admin', label: `Admins (${users.filter(u => u.role === 'admin').length})` },
                        { value: 'superadmin', label: `Super Admins (${users.filter(u => u.role === 'superadmin').length})` },
                    ] as const).map(tab => (
                        <button key={tab.value} type="button" onClick={() => setRoleFilter(tab.value)}
                            className={cn(
                                'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all',
                                roleFilter === tab.value
                                    ? 'bg-white/10 border-white/20 text-white'
                                    : 'bg-white/[0.02] border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                            )}>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Users Grid ─────────────────────────────────────── */}
                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="animate-spin text-[#FCD116]" size={36} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                            <UserCog size={28} className="text-gray-700" />
                        </div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest"><T>Aucun utilisateur trouvé</T></p>
                        <button type="button" onClick={() => { setEditingUser(undefined); setDrawerMode('create') }}
                            className="text-[#008751] text-xs font-bold hover:underline">
                            + Créer le premier compte
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <AnimatePresence mode="popLayout">
                            {filtered.map(user => {
                                const online = isOnline(user.last_seen_at)
                                const rInfo = ROLES.find(r => r.value === user.role)
                                return (
                                    <motion.div
                                        key={user.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5 space-y-4 hover:border-white/10 transition-all group"
                                    >
                                        {/* Card header */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg relative flex-shrink-0"
                                                    style={{ backgroundColor: (rInfo?.color ?? '#6b7280') + '15', color: rInfo?.color ?? '#6b7280' }}>
                                                    {(user.full_name || 'U').charAt(0).toUpperCase()}
                                                    {online && (
                                                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0a0f18]" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{user.full_name}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                            {/* Active toggle */}
                                            <button type="button" onClick={() => toggleActive(user)}
                                                className={cn('p-1.5 rounded-lg transition-colors flex-shrink-0',
                                                    user.is_active ? 'text-[#008751] hover:bg-[#008751]/10' : 'text-gray-600 hover:bg-white/5'
                                                )}
                                                title={user.is_active ? 'Désactiver le compte' : 'Activer le compte'}>
                                                {user.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                                            </button>
                                        </div>

                                        {/* Role badge + status */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border"
                                                style={{ color: rInfo?.color, backgroundColor: (rInfo?.color ?? '#6b7280') + '15', borderColor: (rInfo?.color ?? '#6b7280') + '30' }}>
                                                {rInfo ? <rInfo.Icon size={9} /> : <User size={9} />}
                                                {user.role}
                                            </span>
                                            <span className={cn(
                                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border',
                                                user.is_active
                                                    ? 'bg-[#008751]/10 text-[#008751] border-[#008751]/20'
                                                    : 'bg-white/5 text-gray-600 border-white/5'
                                            )}>
                                                {user.is_active ? <CheckCircle2 size={9} /> : <XCircle size={9} />}
                                                {user.is_active ? 'Actif' : 'Inactif'}
                                            </span>
                                        </div>

                                        {/* Last seen */}
                                        <div className="flex items-center gap-1.5">
                                            {online ? <Wifi size={10} className="text-emerald-400" /> : <WifiOff size={10} className="text-gray-700" />}
                                            <span className="text-[10px] text-gray-500">
                                                {online ? 'En ligne maintenant' :
                                                    user.last_seen_at
                                                        ? `Vu le ${new Date(user.last_seen_at).toLocaleDateString('fr-FR')} à ${new Date(user.last_seen_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                                                        : 'Jamais connecté'
                                                }
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                            <button type="button"
                                                onClick={() => { setEditingUser(user); setDrawerMode('edit') }}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
                                                <Edit2 size={11} /> Modifier
                                            </button>
                                            {user.role !== 'superadmin' && (
                                                <button type="button" onClick={() => setDeletingUser(user)}
                                                    className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                                    title={t("Supprimer le compte")}>
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* ── Drawer ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {drawerMode && (
                    <UserDrawer
                        mode={drawerMode}
                        user={editingUser}
                        onClose={() => { setDrawerMode(null); setEditingUser(undefined) }}
                        onSaved={handleSaved}
                        toast={toast}
                    />
                )}
            </AnimatePresence>

            {/* ── Delete Modal ────────────────────────────────────────── */}
            <AnimatePresence>
                {deletingUser && (
                    <DeleteModal
                        user={deletingUser}
                        onConfirm={confirmDelete}
                        onCancel={() => setDeletingUser(null)}
                        loading={deleteLoading}
                    />
                )}
            </AnimatePresence>

            {/* ── Toasts ─────────────────────────────────────────────── */}
            <ToastContainer toasts={toasts} dismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
        </>
    )
}
