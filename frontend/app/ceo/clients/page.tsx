'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, Search, RefreshCw, Loader2, MapPin, Mail, Phone, Calendar } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Client {
    id: string; created_at: string; email?: string; full_name?: string
    phone?: string; city?: string; country?: string; avatar_url?: string
}

export default function CeoClients() {
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/ceo/clients', { cache: 'no-store' })
        const data = res.ok ? await res.json() : { clients: [] }
        setClients(data.clients || [])
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const filtered = clients.filter(c =>
        !search ||
        (c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(search.toLowerCase())
    )

    const initials = (name?: string) => (name || '?').split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}25` }}>
                            <Users size={18} style={{ color: GOLD }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Clients</h1>
                    </div>
                    <p className="text-sm opacity-50">{clients.length} clients enregistrés</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total clients', value: String(clients.length), color: GOLD },
                    { label: 'Ce mois', value: String(clients.filter(c => {
                        if (!c.created_at) return false;
                        const dateObj = new Date(c.created_at);
                        return !isNaN(dateObj.getTime()) && dateObj >= new Date(new Date().setDate(1));
                    }).length), color: GREEN_L },
                    { label: 'Résultats', value: String(filtered.length), color: YELLOW },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: '#0D2615', border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email, ville..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: '#0D2615', border: `1px solid ${GOLD}20`, color: TEXT }} />
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center opacity-30 text-sm">Aucun client trouvé</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((c, i) => (
                        <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.03 }}
                            className="rounded-2xl p-4 hover:border-opacity-50 transition-all" style={{ background: '#0D2615', border: `1px solid ${GOLD}15` }}>
                            {/* Avatar */}
                            <div className="flex items-center gap-3 mb-3">
                                {c.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={c.avatar_url} alt={c.full_name} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black" style={{ background: `${GOLD}25`, color: GOLD }}>
                                        {initials(c.full_name)}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="font-bold text-sm truncate">{c.full_name || 'Client'}</div>
                                    <div className="text-[10px] opacity-40">
                                        <Calendar size={9} className="inline mr-1" />{fmtDate(c.created_at)}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                {c.email && (
                                    <div className="flex items-center gap-2 text-xs opacity-60 truncate">
                                        <Mail size={10} style={{ color: GOLD, flexShrink: 0 }} />
                                        <span className="truncate">{c.email}</span>
                                    </div>
                                )}
                                {c.phone && (
                                    <div className="flex items-center gap-2 text-xs opacity-60">
                                        <Phone size={10} style={{ color: GREEN_L, flexShrink: 0 }} />
                                        <span>{c.phone}</span>
                                    </div>
                                )}
                                {(c.city || c.country) && (
                                    <div className="flex items-center gap-2 text-xs opacity-60">
                                        <MapPin size={10} style={{ color: RED, flexShrink: 0 }} />
                                        <span>{[c.city, c.country].filter(Boolean).join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    )
}
