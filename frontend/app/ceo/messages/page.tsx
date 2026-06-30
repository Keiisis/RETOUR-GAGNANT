'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, RefreshCw, Loader2, Mail, Phone, Clock, CheckCircle2, Eye, X } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Msg {
    id: string; created_at: string; name?: string; email?: string
    phone?: string; subject?: string; message?: string; is_read?: boolean
}

export default function CeoMessages() {
    const [msgs, setMsgs] = useState<Msg[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [selected, setSelected] = useState<Msg | null>(null)
    const [refresh, setRefresh] = useState(0)
    const [msgTable, setMsgTable] = useState('messages')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/ceo/messages', { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setMsgs(data.messages || [])
                setMsgTable(data.table || 'messages')
            }
        } catch { /* silent */ }
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const markRead = async (id: string) => {
        await fetch('/api/ceo/messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, table: msgTable }),
        })
        setMsgs(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m))
    }

    const open = (m: Msg) => { setSelected(m); if (!m.is_read) markRead(m.id) }

    const displayed = filter === 'unread' ? msgs.filter(m => !m.is_read) : msgs
    const unreadCount = msgs.filter(m => !m.is_read).length

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${RED}25` }}>
                            <MessageSquare size={18} style={{ color: RED }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Messages</h1>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-black" style={{ background: RED, color: '#fff' }}>{unreadCount}</span>
                        )}
                    </div>
                    <p className="text-sm opacity-50">Messages de contact reçus</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Stats + filter */}
            <div className="flex gap-3 mb-6 flex-wrap">
                {[
                    { key: 'all', label: `Tous (${msgs.length})` },
                    { key: 'unread', label: `Non lus (${unreadCount})` },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: filter === f.key ? RED : `${RED}15`, color: filter === f.key ? '#fff' : RED }}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : displayed.length === 0 ? (
                <div className="py-16 text-center opacity-30 text-sm">Aucun message{filter === 'unread' ? ' non lu' : ''}</div>
            ) : (
                <div className="space-y-3">
                    {displayed.map((m, i) => (
                        <motion.div key={m.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 15) * 0.04 }}
                            onClick={() => open(m)} className="rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
                            style={{ background: '#0D2615', border: `1px solid ${m.is_read ? `${GOLD}12` : `${RED}40`}` }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {!m.is_read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RED }} />}
                                        <span className="font-bold text-sm truncate">{m.name || 'Anonyme'}</span>
                                        {m.subject && <span className="text-xs opacity-50 truncate">— {m.subject}</span>}
                                    </div>
                                    <p className="text-xs opacity-50 line-clamp-2">{m.message}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs opacity-40">
                                        {m.email && <span className="flex items-center gap-1"><Mail size={9} />{m.email}</span>}
                                        {m.phone && <span className="flex items-center gap-1"><Phone size={9} />{m.phone}</span>}
                                        <span className="flex items-center gap-1"><Clock size={9} />{fmtDate(m.created_at)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {m.is_read
                                        ? <CheckCircle2 size={16} style={{ color: GREEN_L }} />
                                        : <span className="w-2 h-2 rounded-full" style={{ background: RED }} />
                                    }
                                    <Eye size={14} style={{ color: GOLD }} />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Modal détail */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setSelected(null)}>
                        <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-3xl p-6" style={{ background: '#0D2615', border: `1px solid ${GOLD}30` }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="font-black" style={{ color: GOLD }}>{selected.subject || 'Message'}</h3>
                                <button onClick={() => setSelected(null)} title="Fermer" aria-label="Fermer" className="opacity-40 hover:opacity-70 transition-opacity p-1"><X size={18} /></button>
                            </div>
                            <div className="space-y-2 mb-5">
                                {[['De', selected.name], ['Email', selected.email], ['Téléphone', selected.phone], ['Date', fmtDate(selected.created_at)]].filter(([, v]) => v).map(([k, v]) => (
                                    <div key={k} className="flex gap-3 text-sm">
                                        <span className="opacity-40 w-20 flex-shrink-0">{k}</span>
                                        <span className="font-semibold">{v}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-xl p-4 text-sm leading-relaxed opacity-80" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}15` }}>
                                {selected.message}
                            </div>
                            {selected.email && (
                                <a href={`mailto:${selected.email}?subject=Re: ${selected.subject || 'Votre message'}`}
                                    className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm transition-all hover:opacity-90"
                                    style={{ background: GREEN, color: '#fff' }}>
                                    <Mail size={14} /> Répondre par email
                                </a>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
