'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Activity, RefreshCw, Loader2, ShoppingBag, Users, MessageSquare, FileText, UserCheck, Globe } from 'lucide-react'

const GOLD = '#D4AF37'; const YELLOW = '#FCD116'; const GREEN = '#008751'
const GREEN_L = '#00A86B'; const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'

function fmtDate(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface ActivityItem {
    id: string; type: string; label: string; sub?: string; date: string; color: string
    icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
}

export default function CeoActivite() {
    const [items, setItems] = useState<ActivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/ceo/activity', { cache: 'no-store' })
            if (!res.ok) { setLoading(false); return }
            const d = await res.json()

            const all: ActivityItem[] = []

            ;(d.orders || []).forEach((o: { id: string; created_at: string; total_amount: number; client_email?: string; status: string }) => all.push({
                id: `order-${o.id}`, type: 'order',
                label: `Nouvelle commande ${o.total_amount?.toLocaleString('fr-FR')} FCFA`,
                sub: o.client_email || o.status, date: o.created_at, color: GREEN_L, icon: ShoppingBag,
            }))
            ;(d.clients || []).forEach((c: { id: string; created_at: string; full_name?: string; email?: string }) => all.push({
                id: `client-${c.id}`, type: 'client',
                label: `Nouveau client : ${c.full_name || c.email || 'Inconnu'}`,
                date: c.created_at, color: GOLD, icon: Users,
            }))
            ;(d.messages || []).forEach((m: { id: string; created_at: string; name?: string; sujet?: string; subject?: string }) => all.push({
                id: `msg-${m.id}`, type: 'message',
                label: `Message de ${m.name || 'Inconnu'}`,
                sub: m.sujet || m.subject, date: m.created_at, color: RED, icon: MessageSquare,
            }))
            ;(d.dossiers || []).forEach((dos: { id: string; created_at: string; client_name?: string; type?: string }) => all.push({
                id: `dos-${dos.id}`, type: 'dossier',
                label: `Dossier ouvert : ${dos.client_name || dos.type || 'N/A'}`,
                date: dos.created_at, color: '#60a5fa', icon: FileText,
            }))
            ;(d.nationalite_requests || []).forEach((r: { id: string; created_at: string; full_name?: string }) => all.push({
                id: `nat-${r.id}`, type: 'nationalite',
                label: `Demande nationalité : ${r.full_name || 'N/A'}`,
                date: r.created_at, color: YELLOW, icon: Globe,
            }))
            ;(d.partner_applications || []).forEach((p: { id: string; created_at: string; company_name?: string; status?: string }) => all.push({
                id: `part-${p.id}`, type: 'partenaire',
                label: `Candidature partenaire : ${p.company_name || 'N/A'}`,
                sub: p.status, date: p.created_at, color: '#a78bfa', icon: UserCheck,
            }))

            all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setItems(all)
        } catch { /* silent */ }
        setLoading(false)
    }, [refresh])

    useEffect(() => { load() }, [load])

    const TYPE_LABELS: Record<string, string> = {
        order: 'Commande', client: 'Client', message: 'Message',
        dossier: 'Dossier', nationalite: 'Nationalité', partenaire: 'Partenaire',
    }

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${YELLOW}25` }}>
                            <Activity size={18} style={{ color: YELLOW }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Activité</h1>
                    </div>
                    <p className="text-sm opacity-50">Flux d&apos;activité — 72 dernières heures</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-80 transition-all" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
                </button>
            </motion.div>

            {/* Type breakdown */}
            <div className="flex gap-2 flex-wrap mb-6">
                {Object.entries(TYPE_LABELS).map(([k, v]) => {
                    const count = items.filter(i => i.type === k).length
                    if (!count) return null
                    return (
                        <div key={k} className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: '#0D2615', border: `1px solid ${GOLD}20`, color: GOLD }}>
                            {v} · {count}
                        </div>
                    )
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40" /></div>
            ) : items.length === 0 ? (
                <div className="py-16 text-center opacity-30 text-sm">Aucune activité récente</div>
            ) : (
                <div className="relative">
                    {/* Ligne verticale */}
                    <div className="absolute left-6 top-0 bottom-0 w-px" style={{ background: `${GOLD}20` }} />
                    <div className="space-y-3">
                        {items.map((item, i) => (
                            <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 25) * 0.03 }}
                                className="flex items-start gap-4 pl-0">
                                {/* Dot */}
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 z-10 relative" style={{ background: `${item.color}20`, border: `1px solid ${item.color}40` }}>
                                    <item.icon size={18} style={{ color: item.color }} />
                                </div>
                                {/* Content */}
                                <div className="flex-1 rounded-xl p-3.5" style={{ background: '#0D2615', border: `1px solid ${GOLD}10` }}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-semibold text-sm">{item.label}</div>
                                            {item.sub && <div className="text-xs opacity-50 mt-0.5">{item.sub}</div>}
                                        </div>
                                        <span className="text-xs opacity-40 whitespace-nowrap flex-shrink-0">{fmtDate(item.date)}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
