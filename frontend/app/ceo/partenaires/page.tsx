'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Handshake, RefreshCw, Loader2, Trash2,
    CheckCircle2, Clock, Ban, MessageSquare, Mail, Phone,
    ChevronDown, ChevronUp, Building2, ToggleLeft, ToggleRight
} from 'lucide-react'

const GOLD = '#D4AF37'; const GREEN = '#008751'; const GREEN_L = '#00A86B'
const RED = '#E8112D'; const BG = '#0B1F0D'; const TEXT = '#F0EBD8'; const PANEL = '#0D2615'

interface Partner {
    id: string; name: string; description?: string; category?: string; location?: string
    logo?: string; cover_image?: string; email?: string; phone?: string; website?: string
    is_active?: boolean; is_premium?: boolean; sort_order?: number; created_at: string
}

interface Application {
    id: string; company_name: string; contact_name: string; email: string; phone?: string
    whatsapp?: string; category: string; location: string; activity_description?: string
    why_partner?: string; status: 'pending' | 'contacted' | 'confirmed' | 'rejected'
    notes?: string; is_read?: boolean; created_at: string
}

const APP_META = {
    pending:   { label: 'En attente',   color: GOLD,    bg: `${GOLD}15`,    icon: Clock },
    contacted: { label: 'Contacté',     color: '#3b82f6', bg: '#3b82f615', icon: MessageSquare },
    confirmed: { label: 'Confirmé',     color: GREEN_L, bg: `${GREEN_L}15`, icon: CheckCircle2 },
    rejected:  { label: 'Rejeté',       color: RED,     bg: `${RED}15`,    icon: Ban },
}

function fmt(d: string) {
    if (!d) return '—'
    const dateObj = new Date(d)
    return isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CeoPartenaires() {
    const [tab, setTab] = useState<'partners' | 'applications'>('partners')
    const [partners, setPartners] = useState<Partner[]>([])
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [editNotes, setEditNotes] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState<string | null>(null)
    const [refresh, setRefresh] = useState(0)

    const load = useCallback(async () => {
        if (!loading) setLoading(true)
        const [pRes, aRes] = await Promise.all([
            fetch('/api/ceo/partenaires?type=partners', { cache: 'no-store' }),
            fetch('/api/ceo/partenaires?type=applications', { cache: 'no-store' }),
        ])
        const pData = pRes.ok ? await pRes.json() : {}
        const aData = aRes.ok ? await aRes.json() : {}
        setPartners(pData.partners || [])
        setApplications(aData.applications || [])
        setLoading(false)
    }, [loading])

    useEffect(() => { load() }, [load, refresh])

    const updateAppStatus = async (id: string, status: Application['status']) => {
        setSaving(id)
        await fetch('/api/ceo/partenaires', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, table: 'applications', status, is_read: true, notes: editNotes[id] || '' })
        })
        setSaving(null)
        setApplications(prev => prev.map(a => a.id === id ? { ...a, status, is_read: true } : a))
    }

    const togglePartner = async (p: Partner) => {
        await fetch('/api/ceo/partenaires', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, table: 'partners', is_active: !p.is_active }) })
        setPartners(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
    }

    const delPartner = async (id: string) => {
        if (!confirm('Supprimer ce partenaire ?')) return
        await fetch(`/api/ceo/partenaires?id=${id}&table=partners`, { method: 'DELETE' })
        setPartners(prev => prev.filter(x => x.id !== id))
    }

    const pending = applications.filter(a => a.status === 'pending').length
    const unread = applications.filter(a => !a.is_read).length

    return (
        <div className="min-h-screen p-6 lg:p-8" style={{ background: BG, color: TEXT }}>
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}25` }}>
                            <Handshake size={18} style={{ color: GREEN_L }}/>
                        </div>
                        <h1 className="text-2xl font-black tracking-tight">Partenaires</h1>
                    </div>
                    <p className="text-sm opacity-50">{partners.length} partenaires · {pending} candidature{pending > 1 ? 's' : ''} en attente</p>
                </div>
                <button onClick={() => setRefresh(r => r + 1)} className="px-4 py-2 rounded-xl hover:opacity-80 flex items-center gap-2 text-sm font-semibold" style={{ background: `${GREEN}25`, color: GREEN_L }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualiser
                </button>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Partenaires', value: partners.length, color: GREEN_L },
                    { label: 'Actifs', value: partners.filter(p => p.is_active).length, color: GREEN_L },
                    { label: 'Candidatures', value: applications.length, color: GOLD },
                    { label: 'Non lues', value: unread, color: unread > 0 ? RED : '#94a3b8' },
                ].map((s, i) => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-2xl p-4" style={{ background: PANEL, border: `1px solid ${s.color}20` }}>
                        <div className="text-xs opacity-40 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
                    </motion.div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
                {[
                    { key: 'partners', label: 'Partenaires actifs' },
                    { key: 'applications', label: `Candidatures${unread > 0 ? ` (${unread})` : ''}` },
                ].map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key as typeof tab)}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{ background: tab === t.key ? GOLD : `${GOLD}12`, color: tab === t.key ? BG : GOLD }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin opacity-40"/></div>
            ) : tab === 'partners' ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {partners.map((p, i) => (
                        <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.05 }}
                            className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: PANEL, border: `1px solid ${p.is_active ? `${GREEN}30` : `${GOLD}15`}` }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: `${GREEN}20` }}>
                                    {p.logo
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={p.logo} alt="" className="w-full h-full object-cover"/>
                                        : <Building2 size={16} style={{ color: GREEN_L }}/>
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{p.name}</p>
                                    <p className="text-[11px] opacity-40 truncate">{p.category}{p.location ? ` · ${p.location}` : ''}</p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                                    style={{ background: p.is_active ? `${GREEN_L}20` : `${GOLD}12`, color: p.is_active ? GREEN_L : GOLD }}>
                                    {p.is_active ? 'Actif' : 'Inactif'}
                                </span>
                            </div>
                            {p.description && <p className="text-[12px] opacity-50 line-clamp-2">{p.description}</p>}
                            <div className="flex gap-2 pt-2 border-t border-white/5">
                                {p.email && <a href={`mailto:${p.email}`} title="Envoyer un e-mail" aria-label="Envoyer un e-mail" className="p-2 rounded-xl hover:opacity-80" style={{ background: '#3b82f615', color: '#3b82f6' }}><Mail size={14}/></a>}
                                {p.phone && <a href={`https://wa.me/${p.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="Contacter par WhatsApp" aria-label="Contacter par WhatsApp" className="p-2 rounded-xl hover:opacity-80" style={{ background: `${GREEN}15`, color: GREEN_L }}><Phone size={14}/></a>}
                                <button type="button" onClick={() => togglePartner(p)} title={p.is_active ? "Désactiver le partenaire" : "Activer le partenaire"} aria-label={p.is_active ? "Désactiver le partenaire" : "Activer le partenaire"} className="p-2 rounded-xl hover:opacity-80" style={{ background: p.is_active ? `${RED}12` : `${GREEN}15`, color: p.is_active ? RED : GREEN_L }}>
                                    {p.is_active ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                                </button>
                                <button type="button" onClick={() => delPartner(p.id)} title="Supprimer le partenaire" aria-label="Supprimer le partenaire" className="ml-auto p-2 rounded-xl hover:opacity-80" style={{ background: `${RED}12`, color: RED }}>
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        </motion.div>
                    ))}
                    {partners.length === 0 && <p className="col-span-3 text-center opacity-30 py-12">Aucun partenaire</p>}
                </div>
            ) : (
                <div className="space-y-3">
                    {applications.map((app, i) => {
                        const meta = APP_META[app.status]
                        const Icon = meta.icon
                        const isOpen = expanded === app.id
                        return (
                            <motion.div key={app.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}
                                className="rounded-2xl overflow-hidden" style={{ background: PANEL, border: `1px solid ${meta.color}20` }}>
                                <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : app.id)}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                                        <Icon size={16} style={{ color: meta.color }}/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-sm truncate">{app.company_name}</p>
                                            {!app.is_read && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RED }}/>}
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                                        </div>
                                        <p className="text-[11px] opacity-40">{app.contact_name} · {app.category} · {fmt(app.created_at)}</p>
                                    </div>
                                    {isOpen ? <ChevronUp size={16} className="opacity-40 flex-shrink-0"/> : <ChevronDown size={16} className="opacity-40 flex-shrink-0"/>}
                                </div>
                                <AnimatePresence>
                                    {isOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                            style={{ borderTop: `1px solid ${meta.color}15` }}>
                                            <div className="p-5 space-y-4">
                                                <div className="grid grid-cols-2 gap-3 text-sm opacity-60">
                                                    <div className="flex items-center gap-2"><Mail size={12}/>{app.email}</div>
                                                    {app.phone && <div className="flex items-center gap-2"><Phone size={12}/>{app.phone}</div>}
                                                </div>
                                                {app.activity_description && <p className="text-[12px] opacity-50 p-3 rounded-xl" style={{ background: BG }}>{app.activity_description}</p>}
                                                {app.why_partner && <p className="text-[12px] opacity-50 p-3 rounded-xl" style={{ background: BG }}>{app.why_partner}</p>}
                                                <div>
                                                    <label className="text-xs opacity-50 uppercase tracking-wider block mb-1.5">Notes internes</label>
                                                    <textarea
                                                        value={editNotes[app.id] ?? app.notes ?? ''}
                                                        onChange={e => setEditNotes(p => ({ ...p, [app.id]: e.target.value }))}
                                                        rows={2} placeholder="Ajouter des notes..." className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                                                        style={{ background: BG, border: `1px solid ${GOLD}20`, color: TEXT }}/>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <a href={`mailto:${app.email}`} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: '#3b82f615', color: '#3b82f6' }}><Mail size={13}/> Email</a>
                                                    {(app.whatsapp || app.phone) && (
                                                        <a href={`https://wa.me/${((app.whatsapp || app.phone) || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80" style={{ background: `${GREEN}15`, color: GREEN_L }}>
                                                            <Phone size={13}/> WhatsApp
                                                        </a>
                                                    )}
                                                    <div className="ml-auto flex gap-2">
                                                        {app.status !== 'contacted' && (
                                                            <button type="button" disabled={saving === app.id} onClick={() => updateAppStatus(app.id, 'contacted')}
                                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80"
                                                                style={{ background: '#3b82f615', color: '#3b82f6' }}>
                                                                {saving === app.id ? <Loader2 size={12} className="animate-spin"/> : <MessageSquare size={12}/>} Contacté
                                                            </button>
                                                        )}
                                                        {app.status !== 'confirmed' && (
                                                            <button type="button" disabled={saving === app.id} onClick={() => updateAppStatus(app.id, 'confirmed')}
                                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80"
                                                                style={{ background: `${GREEN}20`, color: GREEN_L }}>
                                                                <CheckCircle2 size={12}/> Confirmer
                                                            </button>
                                                        )}
                                                        {app.status !== 'rejected' && (
                                                            <button type="button" disabled={saving === app.id} onClick={() => updateAppStatus(app.id, 'rejected')}
                                                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:opacity-80"
                                                                style={{ background: `${RED}15`, color: RED }}>
                                                                <Ban size={12}/> Rejeter
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                    {applications.length === 0 && <p className="text-center opacity-30 py-12">Aucune candidature</p>}
                </div>
            )}
        </div>
    )
}
