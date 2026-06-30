'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    UserCog, Search, RefreshCw, Loader2, Plus, X, Save,
    Shield, Crown, User, Trash2, CheckCircle2, XCircle, Eye, EyeOff, Lock
} from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'
const PANEL = '#0D2615'

interface AdminUser {
    id: string; email: string; full_name: string; role: string
    is_active: boolean; last_seen_at: string | null; created_at: string
}

const ROLES = [
    { value: 'client', label: 'Client', color: '#60a5fa' },
    { value: 'agent', label: 'Agent', color: GREEN_L },
    { value: 'admin', label: 'Admin', color: YELLOW },
    { value: 'ceo', label: 'CEO', color: '#f97316' },
    { value: 'superadmin', label: 'Super Admin', color: RED },
]

function roleColor(r: string) { return ROLES.find(x => x.value === r)?.color ?? '#6b7280' }
function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CeoUtilisateurs() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [selected, setSelected] = useState<AdminUser | null>(null)
    const [editRole, setEditRole] = useState('')
    const [editActive, setEditActive] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'agent' })
    const [showPwd, setShowPwd] = useState(false)
    const [creating, setCreating] = useState(false)
    const [createErr, setCreateErr] = useState('')
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/admin/users', { cache: 'no-store' })
        const data = res.ok ? await res.json() : { users: [] }
        setUsers(data.users || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const openUser = (u: AdminUser) => {
        setSelected(u); setEditRole(u.role); setEditActive(u.is_active)
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        await fetch(`/api/admin/users/${selected.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: editRole, is_active: editActive }),
        })
        setSaving(false)
        setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, role: editRole, is_active: editActive } : u))
        setSelected(null)
    }

    const deleteUser = async (id: string) => {
        if (!confirm('Supprimer définitivement ce compte ?')) return
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
        setUsers(prev => prev.filter(u => u.id !== id))
        setSelected(null)
    }

    const create = async () => {
        setCreateErr('')
        if (!newUser.full_name || !newUser.email || !newUser.password) {
            setCreateErr('Tous les champs sont requis')
            return
        }
        setCreating(true)
        const res = await fetch('/api/admin/users/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser),
        })
        const data = await res.json()
        if (!res.ok) { setCreateErr(data.error || 'Erreur'); setCreating(false); return }
        setShowCreate(false)
        setNewUser({ full_name: '', email: '', password: '', role: 'agent' })
        setRefresh(r => r + 1)
        setCreating(false)
    }

    const filtered = users.filter(u => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false
        if (search && !u.full_name?.toLowerCase().includes(search.toLowerCase()) &&
            !u.email?.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const stats = {
        total: users.length,
        actifs: users.filter(u => u.is_active).length,
        agents: users.filter(u => u.role === 'agent').length,
        clients: users.filter(u => u.role === 'client').length,
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${YELLOW}20` }}>
                            <UserCog size={18} style={{ color: YELLOW }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Utilisateurs</h1>
                    </div>
                    <p className="text-sm opacity-50">Gestion complète des comptes</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                        style={{ background: GOLD, color: BG }}>
                        <Plus size={14} /> Nouveau
                    </button>
                    <button onClick={() => setRefresh(r => r + 1)}
                        title="Actualiser" aria-label="Actualiser"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80"
                        style={{ background: `${GREEN}25`, color: GREEN_L }}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: stats.total, color: GOLD },
                    { label: 'Actifs', value: stats.actifs, color: GREEN_L },
                    { label: 'Agents', value: stats.agents, color: YELLOW },
                    { label: 'Clients', value: stats.clients, color: '#60a5fa' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: PANEL, border: `1px solid ${GOLD}20`, color: TEXT }} />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {['all', ...ROLES.map(r => r.value)].map(r => (
                        <button key={r} onClick={() => setRoleFilter(r)}
                            className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                                background: roleFilter === r ? (ROLES.find(x => x.value === r)?.color || GREEN_L) : `${GOLD}12`,
                                color: roleFilter === r ? '#fff' : GOLD
                            }}>
                            {r === 'all' ? 'Tous' : ROLES.find(x => x.value === r)?.label || r}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${GOLD}15` }}>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                    <h2 className="font-bold text-sm" style={{ color: GOLD }}>Liste des utilisateurs</h2>
                    <span className="text-xs opacity-40">{filtered.length} résultats</span>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center opacity-30 text-sm">Aucun utilisateur</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs opacity-40 uppercase tracking-wider border-b" style={{ borderColor: `${GOLD}10` }}>
                                    <th className="text-left px-5 py-3">Nom</th>
                                    <th className="text-left px-5 py-3">Email</th>
                                    <th className="text-left px-5 py-3">Rôle</th>
                                    <th className="text-left px-5 py-3">Statut</th>
                                    <th className="text-left px-5 py-3">Créé le</th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((u, i) => (
                                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 20) * 0.02 }}
                                        className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: `${GOLD}08` }}>
                                        <td className="px-5 py-3 font-semibold text-sm">{u.full_name || '—'}</td>
                                        <td className="px-5 py-3 text-xs opacity-60">{u.email}</td>
                                        <td className="px-5 py-3">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase"
                                                style={{ background: `${roleColor(u.role)}20`, color: roleColor(u.role) }}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {u.is_active
                                                ? <span className="flex items-center gap-1 text-xs" style={{ color: GREEN_L }}><CheckCircle2 size={12} /> Actif</span>
                                                : <span className="flex items-center gap-1 text-xs" style={{ color: RED }}><XCircle size={12} /> Inactif</span>
                                            }
                                        </td>
                                        <td className="px-5 py-3 text-xs opacity-50">{fmtDate(u.created_at)}</td>
                                        <td className="px-5 py-3">
                                            <button onClick={() => openUser(u)} title="Voir les détails" aria-label="Voir les détails"
                                                className="p-1.5 rounded-lg hover:opacity-80" style={{ background: `${GOLD}15` }}>
                                                <Eye size={12} style={{ color: GOLD }} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            {/* Edit Modal */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                        onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="font-black" style={{ color: GOLD }}>{selected.full_name}</h3>
                                    <p className="text-xs opacity-50">{selected.email}</p>
                                </div>
                                <button onClick={() => setSelected(null)} title="Fermer" aria-label="Fermer" className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="mb-4">
                                <label className="text-xs opacity-50 uppercase tracking-wider block mb-2">Rôle</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ROLES.map(r => (
                                        <button key={r.value} onClick={() => setEditRole(r.value)}
                                            className="py-2.5 px-3 rounded-xl text-xs font-bold transition-all border"
                                            style={{
                                                background: editRole === r.value ? `${r.color}25` : 'transparent',
                                                borderColor: editRole === r.value ? r.color : `${r.color}30`,
                                                color: r.color,
                                            }}>
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between mb-5 p-3 rounded-xl" style={{ background: '#0B1F0D', border: `1px solid ${GOLD}20` }}>
                                <span className="text-sm font-semibold">Compte actif</span>
                                <button onClick={() => setEditActive(!editActive)}
                                    title={editActive ? "Désactiver le compte" : "Activer le compte"}
                                    aria-label={editActive ? "Désactiver le compte" : "Activer le compte"}
                                    className="w-12 h-6 rounded-full transition-all relative"
                                    style={{ background: editActive ? GREEN : '#374151' }}>
                                    <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                                        style={{ left: editActive ? '26px' : '4px' }} />
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => deleteUser(selected.id)}
                                    title="Supprimer le compte" aria-label="Supprimer le compte"
                                    className="p-2.5 rounded-xl hover:opacity-80" style={{ background: `${RED}20`, color: RED }}>
                                    <Trash2 size={16} />
                                </button>
                                <button onClick={save} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Enregistrer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}
                        onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-md rounded-3xl p-6" style={{ background: PANEL, border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>Nouvel utilisateur</h3>
                                <button onClick={() => setShowCreate(false)} title="Fermer" aria-label="Fermer" className="opacity-40 hover:opacity-70 p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label htmlFor="newUserFullName" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Nom complet *</label>
                                    <input id="newUserFullName" type="text" value={newUser.full_name}
                                        onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                                <div>
                                    <label htmlFor="newUserEmail" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Email *</label>
                                    <input id="newUserEmail" type="email" value={newUser.email}
                                        onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                        style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                </div>
                                <div>
                                    <label htmlFor="newUserPassword" className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Mot de passe *</label>
                                    <div className="relative">
                                        <input id="newUserPassword" type={showPwd ? 'text' : 'password'} value={newUser.password}
                                            onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                                            className="w-full px-4 py-2.5 pr-10 rounded-xl text-sm outline-none"
                                            style={{ background: '#0B1F0D', border: `1px solid ${GOLD}25`, color: TEXT }} />
                                        <button type="button" onClick={() => setShowPwd(!showPwd)}
                                            title={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70">
                                            {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-2">Rôle</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ROLES.map(r => (
                                            <button key={r.value} onClick={() => setNewUser(p => ({ ...p, role: r.value }))}
                                                className="py-2 px-2 rounded-xl text-[10px] font-bold transition-all border"
                                                style={{
                                                    background: newUser.role === r.value ? `${r.color}25` : 'transparent',
                                                    borderColor: newUser.role === r.value ? r.color : `${r.color}30`,
                                                    color: r.color,
                                                }}>
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {createErr && <p className="text-xs mb-3" style={{ color: RED }}>{createErr}</p>}
                            <button onClick={create} disabled={creating}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-40"
                                style={{ background: GOLD, color: BG }}>
                                {creating ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                Créer le compte
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
