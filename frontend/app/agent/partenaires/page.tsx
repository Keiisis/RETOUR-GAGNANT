'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Handshake, Buildings as Building2, Envelope as Mail, Phone, Globe, MapPin, CheckCircle as CheckCircle2, Clock, ChatText as MessageSquare, Prohibit as Ban, CaretDown as ChevronDown, CaretUp as ChevronUp, ArrowClockwise as RefreshCw, Users, Star, Sparkle as Sparkles, Eye, Plus, Pencil, Trash as Trash2, FloppyDisk as Save, X, CircleNotch as Loader2, ArrowSquareOut as ExternalLink } from '@phosphor-icons/react';
import { cn } from '@/lib/utils'
import FileUpload from '@/components/ui/FileUpload'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface PartnerRow {
    id: string
    name: string
    description: string
    category: string
    location: string
    is_premium: boolean
    is_active: boolean
    logo: string
    cover_image: string
    website: string
    phone: string
    email: string
    sort_order: number
    products: { id: string; name: string; price: number }[]
}

interface Application {
    id: string
    company_name: string
    contact_name: string
    email: string
    phone: string
    whatsapp: string
    website: string
    category: string
    location: string
    activity_description: string
    target_audience: string
    years_in_business: string
    team_size: string
    why_partner: string
    what_offer: string
    partnership_types: string[]
    logo_url: string
    cover_image_url: string
    facebook_url: string
    instagram_url: string
    linkedin_url: string
    status: 'pending' | 'contacted' | 'confirmed' | 'rejected'
    notes: string
    is_read: boolean
    created_at: string
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

const CATEGORIES = [
    'Immobilier', 'Agro-Business', 'Art & Culture', 'Services & Tech',
    'Mode & Beauté', 'Tourisme & Hôtellerie', 'Santé & Bien-être',
    'Finance & Investissement', 'Éducation & Formation', 'Commerce & Distribution', 'Autre',
]

const STATUS_META = {
    pending:   { label: 'En attente', text: 'text-[#FCD116]', bg: 'bg-[#FCD116]/10', border: 'border-[#FCD116]/20', icon: Clock },
    contacted: { label: 'Contacté',   text: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/20', icon: MessageSquare },
    confirmed: { label: 'Confirmé',   text: 'text-[#008751]', bg: 'bg-[#008751]/10', border: 'border-[#008751]/20', icon: CheckCircle2 },
    rejected:  { label: 'Rejeté',     text: 'text-[#E8112D]', bg: 'bg-[#E8112D]/10', border: 'border-[#E8112D]/20', icon: Ban },
}

// ─── Shared input component ───────────────────────────────────────────────────

function Inp({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 placeholder-gray-700 transition-colors"
            />
        </div>
    )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function AgentPartenairesPage() {
    const [activeTab, setActiveTab] = useState<'partners' | 'candidatures'>('partners')

    // ── Partners state ──
    const [partners, setPartners] = useState<PartnerRow[]>([])
    const [loadingPartners, setLoadingPartners] = useState(true)
    const [editing, setEditing] = useState<string | null>(null)
    const [form, setForm] = useState<Partial<PartnerRow>>({})
    const [saving, setSaving] = useState(false)

    // ── Applications state ──
    const [applications, setApplications] = useState<Application[]>([])
    const [loadingApps, setLoadingApps] = useState(true)
    const [expandedApp, setExpandedApp] = useState<string | null>(null)
    const [appFilter, setAppFilter] = useState<'all' | Application['status']>('all')
    const [appNotes, setAppNotes] = useState<Record<string, string>>({})
    const [updatingApp, setUpdatingApp] = useState<string | null>(null)

    // ── Shared ──
    const [toasts, setToasts] = useState<Toast[]>([])
    const [toastCounter, setToastCounter] = useState(0)

    const addToast = useCallback((type: Toast['type'], msg: string) => {
        const id = toastCounter + 1
        setToastCounter(id)
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [toastCounter])

    // ── Fetch partners ──
    const fetchPartners = useCallback(async () => {
        setLoadingPartners(true)
        const { data } = await supabase.from('partners').select('*').order('sort_order')
        if (data) setPartners(data)
        setLoadingPartners(false)
    }, [])

    // ── Fetch applications ──
    const fetchApplications = useCallback(async () => {
        setLoadingApps(true)
        const res = await fetch('/api/admin/partner-applications')
        if (res.ok) {
            const data = await res.json()
            setApplications(data.applications || [])
        }
        setLoadingApps(false)
    }, [])

    useEffect(() => { fetchPartners(); fetchApplications() }, [fetchPartners, fetchApplications])

    // ── Partner CRUD ──
    const startNew = () => {
        setEditing('new')
        setForm({ name: '', description: '', category: 'Immobilier', location: '', is_premium: false, is_active: true, logo: '', cover_image: '', website: '', phone: '', email: '', sort_order: 0, products: [] })
    }

    const startEdit = (p: PartnerRow) => { setEditing(p.id); setForm({ ...p }) }

    const handleSave = async () => {
        if (!form.name?.trim()) { addToast('error', 'Le nom est obligatoire'); return }
        setSaving(true)
        const partnerData = { ...form }
        delete partnerData.id
        if (editing === 'new') {
            const { error } = await supabase.from('partners').insert([partnerData])
            if (error) { addToast('error', error.message); setSaving(false); return }
            addToast('success', 'Partenaire ajouté')
        } else {
            const { error } = await supabase.from('partners').update(partnerData).eq('id', editing)
            if (error) { addToast('error', error.message); setSaving(false); return }
            addToast('success', 'Partenaire mis à jour')
        }
        setEditing(null); setForm({})
        await fetchPartners()
        setSaving(false)
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Supprimer définitivement "${name}" ?`)) return
        const { error } = await supabase.from('partners').delete().eq('id', id)
        if (error) { addToast('error', error.message); return }
        addToast('success', 'Partenaire supprimé')
        await fetchPartners()
    }

    const toggleActive = async (p: PartnerRow) => {
        setPartners(prev => prev.map(x => x.id === p.id ? { ...x, is_active: !p.is_active } : x))
        const { error } = await supabase.from('partners').update({ is_active: !p.is_active }).eq('id', p.id)
        if (error) {
            setPartners(prev => prev.map(x => x.id === p.id ? { ...x, is_active: p.is_active } : x))
            addToast('error', 'Erreur mise à jour')
        } else { addToast('success', !p.is_active ? 'Partenaire activé' : 'Partenaire désactivé') }
    }

    // ── Application actions ──
    const updateAppStatus = async (app: Application, status: Application['status'], createPartner = false) => {
        setUpdatingApp(app.id)
        try {
            const res = await fetch(`/api/admin/partner-applications/${app.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, is_read: true, notes: appNotes[app.id] ?? app.notes ?? '', create_partner: createPartner }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status, is_read: true } : a))
            if (createPartner) { await fetchPartners(); addToast('success', 'Confirmé + Partenaire ajouté !') }
            else addToast('success', `Statut : ${STATUS_META[status].label}`)
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur')
        } finally { setUpdatingApp(null) }
    }

    const markRead = async (id: string) => {
        await fetch(`/api/admin/partner-applications/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
        })
        setApplications(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
    }

    const deleteApp = async (id: string) => {
        if (!confirm('Supprimer cette candidature ?')) return
        await fetch(`/api/admin/partner-applications/${id}`, { method: 'DELETE' })
        setApplications(prev => prev.filter(a => a.id !== id))
        addToast('success', 'Candidature supprimée')
    }

    const unread = applications.filter(a => !a.is_read).length
    const filteredApps = appFilter === 'all' ? applications : applications.filter(a => a.status === appFilter)

    return (
        <div className="space-y-8">
            {/* ── Toasts ── */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id}
                            initial={{ opacity: 0, y: 12, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn('flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto border',
                                t.type === 'success'
                                    ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]'
                                    : 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]'
                            )}>
                            <CheckCircle2 size={15}/> {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <Handshake size={16}/>
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Réseau</span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter flex items-center gap-3">
                        Gestion des{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                            Partenaires
                        </span>
                        {unread > 0 && (
                            <span className="text-sm bg-[#E8112D] text-white font-black px-2.5 py-1 rounded-full">
                                {unread} nouveau{unread > 1 ? 'x' : ''}
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Gérez les partenaires actifs et les demandes de candidature
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => { fetchPartners(); fetchApplications() }}
                        className="flex items-center gap-2 text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2.5 rounded-xl transition-all border border-white/5">
                        <RefreshCw size={13}/> Rafraîchir
                    </button>
                    {activeTab === 'partners' && (
                        <button type="button" onClick={startNew}
                            className="flex items-center gap-2 text-xs font-black bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-xl transition-all">
                            <Plus size={13}/> Nouveau partenaire
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-white/5 rounded-2xl p-1 w-fit">
                {([
                    { key: 'partners' as const, label: 'Partenaires Actifs', count: partners.length, badge: 0 },
                    { key: 'candidatures' as const, label: 'Candidatures', count: applications.length, badge: unread },
                ]).map(tab => (
                    <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                        className={cn('flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl transition-all',
                            activeTab === tab.key
                                ? 'bg-white/10 text-white shadow-sm'
                                : 'text-gray-500 hover:text-white'
                        )}>
                        {tab.label}
                        <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded-full',
                            activeTab === tab.key ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500'
                        )}>
                            {tab.count}
                        </span>
                        {tab.badge > 0 && (
                            <span className="w-2 h-2 rounded-full bg-[#E8112D]"/>
                        )}
                    </button>
                ))}
            </div>

            {/* ══════════════ TAB: PARTENAIRES ACTIFS ══════════════ */}
            {activeTab === 'partners' && (
                <div className="space-y-4">
                    {/* Inline edit / new form */}
                    <AnimatePresence>
                        {editing && (
                            <motion.div
                                key="partner-form"
                                initial={{ opacity: 0, y: -12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                    <h3 className="font-black text-white text-sm flex items-center gap-2">
                                        <Building2 size={14} className="text-emerald-400"/>
                                        {editing === 'new' ? 'Nouveau partenaire' : 'Modifier le partenaire'}
                                    </h3>
                                    <button type="button" title="Annuler" onClick={() => { setEditing(null); setForm({}) }}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
                                        <X size={15}/>
                                    </button>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Inp label="Nom *" value={form.name || ''} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Nom de la structure"/>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Catégorie</label>
                                            <select title="Catégorie" value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/40 transition-colors">
                                                {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0a0f18]">{c}</option>)}
                                            </select>
                                        </div>
                                        <Inp label="Localisation" value={form.location || ''} onChange={v => setForm(p => ({ ...p, location: v }))} placeholder="Ville, Pays"/>
                                        <Inp label="Site web" value={form.website || ''} onChange={v => setForm(p => ({ ...p, website: v }))} placeholder="https://..."/>
                                        <Inp label="Téléphone" value={form.phone || ''} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+229..."/>
                                        <Inp label="Email" value={form.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder="contact@..."/>

                                        {/* Logo upload */}
                                        <div className="flex items-start gap-4">
                                            <FileUpload
                                                type="logo"
                                                label="Logo"
                                                value={form.logo || ''}
                                                onChange={v => setForm(p => ({ ...p, logo: v }))}
                                                hint="PNG, JPG — max 5MB"
                                                className="w-[100px] flex-shrink-0"
                                            />
                                        </div>

                                        {/* Cover upload — full width */}
                                        <div className="md:col-span-2">
                                            <FileUpload
                                                type="cover"
                                                label="Photo de couverture"
                                                value={form.cover_image || ''}
                                                onChange={v => setForm(p => ({ ...p, cover_image: v }))}
                                                hint="1200×400px recommandé — JPG, PNG, WebP"
                                            />
                                        </div>

                                        {/* Description */}
                                        <div className="md:col-span-2 space-y-1.5">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
                                            <textarea title="Description" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                                                placeholder="Description du partenaire..."
                                                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/40 resize-none placeholder-gray-700 transition-colors"/>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 pt-1">
                                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                            <input type="checkbox" checked={form.is_premium || false} onChange={e => setForm(p => ({ ...p, is_premium: e.target.checked }))} className="rounded"/>
                                            <Star className="w-4 h-4 text-[#FCD116]"/> Premium
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                            <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded"/>
                                            Actif
                                        </label>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button type="button" onClick={handleSave} disabled={saving}
                                            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-40">
                                            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Enregistrer
                                        </button>
                                        <button type="button" onClick={() => { setEditing(null); setForm({}) }}
                                            className="px-5 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold transition-colors">
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Partners list */}
                    {loadingPartners ? (
                        <div className="flex justify-center py-16">
                            <div className="w-7 h-7 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"/>
                        </div>
                    ) : partners.length === 0 ? (
                        <div className="flex flex-col items-center py-20 gap-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <Handshake size={36} className="text-gray-700"/>
                            <p className="text-gray-500 text-sm font-bold">Aucun partenaire enregistré</p>
                            <button type="button" onClick={startNew}
                                className="flex items-center gap-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-5 py-2.5 rounded-xl text-xs font-black hover:bg-emerald-500/25 transition-all">
                                <Plus size={13}/> Ajouter le premier partenaire
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {partners.map((p, i) => (
                                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                    className={cn('bg-white/[0.03] border rounded-2xl overflow-hidden transition-all',
                                        p.is_active ? 'border-white/5' : 'border-white/5 opacity-50'
                                    )}>
                                    <div className="flex items-center gap-4 p-4">
                                        {/* Cover thumbnail */}
                                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 relative">
                                            {p.cover_image ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={p.cover_image} alt={p.name} className="w-full h-full object-cover"/>
                                            ) : p.logo ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={p.logo} alt={p.name} className="w-12 h-12 object-contain m-1"/>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Building2 size={18} className="text-gray-600"/>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-sm text-white truncate">{p.name}</p>
                                                {p.is_premium && <Star size={11} className="text-[#FCD116]" fill="#FCD116"/>}
                                                <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full',
                                                    p.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-500'
                                                )}>
                                                    {p.is_active ? 'Actif' : 'Inactif'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                                {p.category} · {p.location}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {p.website && (
                                                <a href={p.website} target="_blank" rel="noopener noreferrer"
                                                    title={`Visiter ${p.name}`}
                                                    className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors">
                                                    <ExternalLink size={13}/>
                                                </a>
                                            )}
                                            <button type="button"
                                                title={p.is_active ? 'Désactiver' : 'Activer'}
                                                onClick={() => toggleActive(p)}
                                                className={cn('p-2 rounded-lg text-xs transition-all',
                                                    p.is_active
                                                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                        : 'bg-white/5 text-gray-500 hover:text-white'
                                                )}>
                                                <CheckCircle2 size={13}/>
                                            </button>
                                            <button type="button" title="Modifier" onClick={() => startEdit(p)}
                                                className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors">
                                                <Pencil size={13}/>
                                            </button>
                                            <button type="button" title="Supprimer" onClick={() => handleDelete(p.id, p.name)}
                                                className="p-2 rounded-lg bg-red-500/10 text-red-500/70 hover:bg-red-500/20 hover:text-red-400 transition-all">
                                                <Trash2 size={13}/>
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════ TAB: CANDIDATURES ══════════════ */}
            {activeTab === 'candidatures' && (
                <div className="space-y-5">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Total', value: applications.length, cls: 'text-white', icon: Users },
                            { label: 'En attente', value: applications.filter(a => a.status === 'pending').length, cls: 'text-[#FCD116]', icon: Clock },
                            { label: 'Contactées', value: applications.filter(a => a.status === 'contacted').length, cls: 'text-[#3b82f6]', icon: MessageSquare },
                            { label: 'Confirmées', value: applications.filter(a => a.status === 'confirmed').length, cls: 'text-[#008751]', icon: Star },
                        ].map(s => (
                            <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <s.icon size={14} className={s.cls}/>
                                </div>
                                <div>
                                    <p className={cn('text-xl font-black font-mono', s.cls)}>{s.value}</p>
                                    <p className="text-[9px] uppercase tracking-widest text-gray-600 font-bold leading-tight">{s.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit flex-wrap">
                        {(['all', 'pending', 'contacted', 'confirmed', 'rejected'] as const).map(f => (
                            <button key={f} type="button" onClick={() => setAppFilter(f)}
                                className={cn('text-xs font-bold px-4 py-2 rounded-lg transition-all',
                                    appFilter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                                )}>
                                {f === 'all'
                                    ? `Toutes (${applications.length})`
                                    : `${STATUS_META[f].label} (${applications.filter(a => a.status === f).length})`
                                }
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    {loadingApps ? (
                        <div className="flex justify-center py-16">
                            <div className="w-7 h-7 border-2 border-[#FCD116]/30 border-t-[#FCD116] rounded-full animate-spin"/>
                        </div>
                    ) : filteredApps.length === 0 ? (
                        <div className="flex flex-col items-center py-20 gap-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <Sparkles size={32} className="text-gray-700"/>
                            <p className="text-gray-500 text-sm font-bold">Aucune candidature trouvée</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredApps.map((app, i) => {
                                const meta = STATUS_META[app.status]
                                const StatusIcon = meta.icon
                                const isOpen = expandedApp === app.id
                                return (
                                    <motion.div key={app.id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                                        className={cn('bg-white/[0.03] border rounded-2xl overflow-hidden transition-all',
                                            !app.is_read ? 'border-[#FCD116]/25' : 'border-white/5'
                                        )}>
                                        {/* Row */}
                                        <div className="flex items-center justify-between gap-4 p-4">
                                            <button type="button"
                                                onClick={() => { setExpandedApp(isOpen ? null : app.id); if (!app.is_read) markRead(app.id) }}
                                                className="flex items-center gap-3 flex-1 min-w-0 text-left">
                                                {/* Logo thumb */}
                                                <div className="w-10 h-10 rounded-xl bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                    {app.logo_url
                                                        ? /* eslint-disable-next-line @next/next/no-img-element */
                                                          <img src={app.logo_url} alt={app.company_name} className="w-full h-full object-cover"/>
                                                        : <Building2 size={16} className="text-[#008751]"/>
                                                    }
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-bold text-sm text-white">{app.company_name}</p>
                                                        {!app.is_read && <span className="w-2 h-2 rounded-full bg-[#FCD116]" title="Nouveau"/>}
                                                        <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1', meta.bg, meta.border, meta.text)}>
                                                            <StatusIcon size={9}/> {meta.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                                        {app.contact_name} · {app.category} · {app.location}
                                                    </p>
                                                </div>
                                                {isOpen ? <ChevronUp size={14} className="text-gray-500 flex-shrink-0"/> : <ChevronDown size={14} className="text-gray-500 flex-shrink-0"/>}
                                            </button>

                                            {/* Quick contact */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {app.email && (
                                                    <a href={`mailto:${app.email}?subject=Retour Gagnant — Suite à votre candidature partenaire`}
                                                        title={`Email : ${app.email}`}
                                                        onClick={() => app.status === 'pending' && updateAppStatus(app, 'contacted')}
                                                        className="flex items-center gap-1 text-[11px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/20 px-3 py-1.5 rounded-lg transition-all">
                                                        <Mail size={11}/> Email
                                                    </a>
                                                )}
                                                {app.whatsapp && (
                                                    <a href={`https://wa.me/${app.whatsapp.replace(/\D/g, '')}?text=Bonjour ${app.contact_name}, suite à votre candidature partenaire chez Retour Gagnant...`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        title="WhatsApp"
                                                        onClick={() => app.status === 'pending' && updateAppStatus(app, 'contacted')}
                                                        className="flex items-center gap-1 text-[11px] font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 px-3 py-1.5 rounded-lg transition-all">
                                                        <Phone size={11}/> WA
                                                    </a>
                                                )}
                                                <button type="button" title="Voir le détail"
                                                    onClick={() => { setExpandedApp(isOpen ? null : app.id); if (!app.is_read) markRead(app.id) }}
                                                    className="p-1.5 rounded-lg bg-white/5 text-gray-500 hover:text-white transition-colors">
                                                    <Eye size={13}/>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded detail */}
                                        <AnimatePresence>
                                            {isOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden">
                                                    <div className="border-t border-white/5 p-5 space-y-4">
                                                        {/* Cover image if any */}
                                                        {app.cover_image_url && (
                                                            <div className="rounded-xl overflow-hidden h-28 relative">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={app.cover_image_url} alt="Couverture" className="w-full h-full object-cover"/>
                                                            </div>
                                                        )}

                                                        {/* Contact info grid */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {[
                                                                { icon: Mail, label: 'Email', value: app.email, href: `mailto:${app.email}` },
                                                                { icon: Phone, label: 'Tél / WA', value: app.phone || app.whatsapp, href: undefined },
                                                                { icon: Globe, label: 'Site', value: app.website, href: app.website },
                                                                { icon: MapPin, label: 'Lieu', value: app.location, href: undefined },
                                                                { icon: Users, label: 'Équipe', value: app.team_size, href: undefined },
                                                                { icon: Handshake, label: 'Ancienneté', value: app.years_in_business, href: undefined },
                                                            ].filter(r => r.value).map(({ icon: Icon, label, value, href }) => (
                                                                <div key={label} className="flex items-center gap-2 text-[11px]">
                                                                    <Icon size={11} className="text-gray-500 flex-shrink-0"/>
                                                                    <span className="text-gray-500">{label} :</span>
                                                                    {href
                                                                        ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-bold hover:underline truncate">{value}</a>
                                                                        : <span className="text-white font-bold truncate">{value}</span>
                                                                    }
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {app.activity_description && (
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Activité</p>
                                                                <p className="text-xs text-gray-300 leading-relaxed border-l-2 border-white/10 pl-3">{app.activity_description}</p>
                                                            </div>
                                                        )}
                                                        {app.why_partner && (
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Motivation</p>
                                                                <p className="text-xs text-gray-300 leading-relaxed border-l-2 border-[#FCD116]/30 pl-3">{app.why_partner}</p>
                                                            </div>
                                                        )}
                                                        {app.partnership_types?.length > 0 && (
                                                            <div className="flex flex-wrap gap-2">
                                                                {app.partnership_types.map(pt => (
                                                                    <span key={pt} className="text-[10px] font-bold bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20 px-2 py-1 rounded-lg">{pt}</span>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Notes */}
                                                        <textarea
                                                            value={appNotes[app.id] ?? app.notes ?? ''}
                                                            onChange={e => setAppNotes(p => ({ ...p, [app.id]: e.target.value }))}
                                                            placeholder="Ajouter une note interne..."
                                                            title="Notes internes"
                                                            rows={2}
                                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-white/20 resize-none placeholder-gray-600 transition-colors"
                                                        />

                                                        {/* Actions */}
                                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                                            {app.status !== 'contacted' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'contacted')}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    <MessageSquare size={12}/> Marquer contacté
                                                                </button>
                                                            )}
                                                            {app.status !== 'confirmed' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'confirmed', true)}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-[#008751]/15 text-[#008751] hover:bg-[#008751]/25 border border-[#008751]/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    <CheckCircle2 size={12}/> Confirmer + Ajouter
                                                                </button>
                                                            )}
                                                            {app.status !== 'rejected' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'rejected')}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    <Ban size={12}/> Rejeter
                                                                </button>
                                                            )}
                                                            <button type="button" disabled={!!updatingApp} onClick={() => deleteApp(app.id)}
                                                                title="Supprimer la candidature"
                                                                className="ml-auto flex items-center gap-1.5 text-xs font-bold bg-red-500/10 text-red-500/60 hover:bg-red-500/20 hover:text-red-400 border border-red-500/10 px-3 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                <Trash2 size={12}/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
