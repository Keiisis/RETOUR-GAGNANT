'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import {
    Plus, Pencil, Trash2, Save, X, Loader2, Star, CheckCircle2,
    AlertCircle, Globe, Mail, Phone, MapPin, ExternalLink,
    Building2, Users, Eye, MessageSquare, RefreshCw,
    ChevronDown, ChevronUp, Handshake, Clock, Ban
} from 'lucide-react'
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
    revenue_range: string
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

const CATEGORIES = ['Immobilier', 'Agro-Business', 'Art & Culture', 'Services & Tech', 'Mode & Beauté', 'Tourisme & Hôtellerie', 'Santé & Bien-être', 'Finance & Investissement', 'Éducation & Formation', 'Commerce & Distribution', 'Autre']

const STATUS_META = {
    pending: { label: 'En attente', text: 'text-[#FCD116]', bg: 'bg-[#FCD116]/10', border: 'border-[#FCD116]/20', icon: Clock },
    contacted: { label: 'Contacté', text: 'text-[#3b82f6]', bg: 'bg-[#3b82f6]/10', border: 'border-[#3b82f6]/20', icon: MessageSquare },
    confirmed: { label: 'Confirmé', text: 'text-[#008751]', bg: 'bg-[#008751]/10', border: 'border-[#008751]/20', icon: CheckCircle2 },
    rejected: { label: 'Rejeté', text: 'text-[#E8112D]', bg: 'bg-[#E8112D]/10', border: 'border-[#E8112D]/20', icon: Ban },
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function AdminPartenaires() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'partners' | 'candidatures'>('partners')

    // Partners state
    const [partners, setPartners] = useState<PartnerRow[]>([])
    const [loadingPartners, setLoadingPartners] = useState(true)
    const [editing, setEditing] = useState<string | null>(null)
    const [form, setForm] = useState<Partial<PartnerRow>>({})
    const [saving, setSaving] = useState(false)

    // Applications state
    const [applications, setApplications] = useState<Application[]>([])
    const [loadingApps, setLoadingApps] = useState(true)
    const [expandedApp, setExpandedApp] = useState<string | null>(null)
    const [appFilter, setAppFilter] = useState<'all' | Application['status']>('all')
    const [appNotes, setAppNotes] = useState<Record<string, string>>({})
    const [updatingApp, setUpdatingApp] = useState<string | null>(null)

    // Shared
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
        } else addToast('success', !p.is_active ? 'Partenaire activé' : 'Partenaire désactivé')
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
            if (createPartner) { await fetchPartners(); addToast('success', 'Candidature confirmée + Partenaire ajouté !') }
            else addToast('success', `Statut mis à jour : ${STATUS_META[status].label}`)
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
        const res = await fetch(`/api/admin/partner-applications/${id}`, { method: 'DELETE' })
        if (res.ok) { setApplications(prev => prev.filter(a => a.id !== id)); addToast('success', 'Candidature supprimée') }
        else addToast('error', 'Erreur suppression')
    }

    const filteredApps = appFilter === 'all' ? applications : applications.filter(a => a.status === appFilter)
    const unreadCount = applications.filter(a => !a.is_read).length

    const stats = {
        total: partners.length,
        active: partners.filter(p => p.is_active).length,
        premium: partners.filter(p => p.is_premium).length,
        pending: applications.filter(a => a.status === 'pending').length,
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Toast */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className={cn('flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto border',
                                t.type === 'success' ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]' : 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]')}>
                            {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <div className="flex items-center gap-2 text-[#008751] mb-2">
                        <Handshake size={16} />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]"><T>Réseau Partenaires</T></span>
                    </div>
                    <h1 className="text-3xl font-black text-white font-heading tracking-tighter">
                        PARTENAIRES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>& CANDIDATURES</T></span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => { fetchPartners(); fetchApplications() }}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors" title={t("Rafraîchir")}>
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Partenaires', value: stats.total, cls: 'text-[#FCD116]' },
                    { label: 'Actifs', value: stats.active, cls: 'text-[#008751]' },
                    { label: 'Premium', value: stats.premium, cls: 'text-purple-400' },
                    { label: 'Candidatures en attente', value: stats.pending, cls: 'text-[#E8112D]' },
                ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                        <p className={cn('text-2xl font-black font-mono', s.cls)}>{s.value}</p>
                        <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                <button type="button" onClick={() => setActiveTab('partners')}
                    className={cn('flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-lg transition-all',
                        activeTab === 'partners' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                    <Building2 size={13} /> Partenaires Actifs
                    <span className="text-[9px] font-mono opacity-60">{stats.total}</span>
                </button>
                <button type="button" onClick={() => setActiveTab('candidatures')}
                    className={cn('flex items-center gap-2 text-xs font-bold px-5 py-2.5 rounded-lg transition-all relative',
                        activeTab === 'candidatures' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                    <Users size={13} /> Candidatures
                    <span className="text-[9px] font-mono opacity-60">{applications.length}</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E8112D] rounded-full text-[9px] font-black text-white flex items-center justify-center">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ════════════════════════ TAB: PARTENAIRES ════════════════════════ */}
            {activeTab === 'partners' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button type="button" onClick={startNew}
                            className="flex items-center gap-2 bg-[#008751] hover:bg-[#009960] text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all">
                            <Plus size={15} /> Ajouter un partenaire
                        </button>
                    </div>

                    {/* Form */}
                    <AnimatePresence>
                        {editing && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="bg-[#0a0f18] border border-[#008751]/20 rounded-2xl overflow-hidden">
                                    <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#008751]/5">
                                        <p className="text-sm font-black text-white">{editing === 'new' ? 'Nouveau partenaire' : 'Modifier le partenaire'}</p>
                                        <button type="button" title={t("Fermer")} onClick={() => { setEditing(null); setForm({}) }} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Inp label="Nom *" value={form.name || ''} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder={t("Nom de la structure")} />
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Catégorie</T></label>
                                                <select title={t("Catégorie")} value={form.category || ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                                    className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-3 py-2.5 text-sm focus:outline-none">
                                                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0a0f18]">{c}</option>)}
                                                </select>
                                            </div>
                                            <Inp label="Localisation" value={form.location || ''} onChange={v => setForm(p => ({ ...p, location: v }))} placeholder={t("Ville, Pays")} />
                                            <Inp label="Site web" value={form.website || ''} onChange={v => setForm(p => ({ ...p, website: v }))} placeholder="https://..." />
                                            <Inp label="Téléphone" value={form.phone || ''} onChange={v => setForm(p => ({ ...p, phone: v }))} placeholder="+229..." />
                                            <Inp label="Email" value={form.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))} placeholder={t("contact@...")} />
                                            <div className="flex items-start gap-4">
                                                <FileUpload
                                                    type="logo"
                                                    label="Logo"
                                                    value={form.logo || ''}
                                                    onChange={v => setForm(p => ({ ...p, logo: v }))}
                                                    hint="PNG, JPG, WebP — max 5MB"
                                                    className="w-[100px] flex-shrink-0"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <FileUpload
                                                    type="cover"
                                                    label="Photo de couverture"
                                                    value={form.cover_image || ''}
                                                    onChange={v => setForm(p => ({ ...p, cover_image: v }))}
                                                    hint="1200×400px recommandé — JPG, PNG, WebP"
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider"><T>Description</T></label>
                                                <textarea title={t("Description")} value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
                                                    placeholder={t("Description du partenaire...")}
                                                    className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-3 text-sm focus:outline-none" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 pt-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                                <input type="checkbox" checked={form.is_premium || false} onChange={e => setForm(p => ({ ...p, is_premium: e.target.checked }))} className="rounded" />
                                                <Star className="w-4 h-4 text-[#FCD116]" /> Premium
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                                                <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="rounded" />
                                                Actif
                                            </label>
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button type="button" onClick={handleSave} disabled={saving}
                                                className="flex items-center gap-2 bg-[#008751] hover:bg-[#009960] text-white font-black text-xs px-5 py-3 rounded-xl transition-all disabled:opacity-40">
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                                            </button>
                                            <button type="button" onClick={() => { setEditing(null); setForm({}) }}
                                                className="px-5 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold transition-colors">
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Partners list */}
                    {loadingPartners ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FCD116]" size={32} /></div>
                    ) : (
                        <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                            {partners.length === 0 && (
                                <div className="flex flex-col items-center py-16 gap-3">
                                    <Building2 size={32} className="text-gray-700" />
                                    <p className="text-gray-500 text-sm"><T>Aucun partenaire enregistré</T></p>
                                </div>
                            )}
                            {partners.map(p => (
                                <div key={p.id} className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.02] transition-colors group">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Logo */}
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {p.logo ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={p.logo} alt={p.name} className="w-8 h-8 object-contain" />
                                            ) : (
                                                <Building2 size={16} className="text-gray-600" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-sm text-white">{p.name}</p>
                                                {p.is_premium && <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FCD116]/15 text-[#FCD116] border border-[#FCD116]/25 font-black uppercase"><T>★ PREMIUM</T></span>}
                                                {!p.is_active && <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-black uppercase"><T>INACTIF</T></span>}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                <span>{p.category}</span>
                                                {p.location && <><span>•</span><span className="flex items-center gap-1"><MapPin size={10} />{p.location}</span></>}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {p.website && (
                                            <a href={p.website} target="_blank" rel="noopener noreferrer" title={`Visiter ${p.name}`}
                                                className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-[#3b82f6] transition-colors">
                                                <ExternalLink size={13} />
                                            </a>
                                        )}
                                        <button type="button" title={p.is_active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(p)}
                                            className={cn('p-2 rounded-lg transition-colors text-xs font-bold',
                                                p.is_active ? 'bg-[#008751]/15 text-[#008751] hover:bg-[#008751]/25' : 'bg-white/5 text-gray-500 hover:text-white')}>
                                            <Eye size={13} />
                                        </button>
                                        <button type="button" title={t("Modifier")} onClick={() => startEdit(p)}
                                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-[#FCD116] hover:bg-[#FCD116]/10 transition-all">
                                            <Pencil size={13} />
                                        </button>
                                        <button type="button" title={t("Supprimer")} onClick={() => handleDelete(p.id, p.name)}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════ TAB: CANDIDATURES ════════════════════════ */}
            {activeTab === 'candidatures' && (
                <div className="space-y-4">
                    {/* Filter */}
                    <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit flex-wrap">
                        {(['all', 'pending', 'contacted', 'confirmed', 'rejected'] as const).map(f => (
                            <button key={f} type="button" onClick={() => setAppFilter(f)}
                                className={cn('text-xs font-bold px-4 py-2 rounded-lg transition-all',
                                    appFilter === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white')}>
                                {f === 'all' ? `Toutes (${applications.length})` : `${STATUS_META[f].label} (${applications.filter(a => a.status === f).length})`}
                            </button>
                        ))}
                    </div>

                    {loadingApps ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FCD116]" size={32} /></div>
                    ) : filteredApps.length === 0 ? (
                        <div className="flex flex-col items-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <Users size={32} className="text-gray-700" />
                            <p className="text-gray-500 text-sm">Aucune candidature{appFilter !== 'all' ? ` "${STATUS_META[appFilter as Application['status']].label}"` : ''}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredApps.map(app => {
                                const meta = STATUS_META[app.status]
                                const StatusIcon = meta.icon
                                const isExpanded = expandedApp === app.id
                                return (
                                    <div key={app.id} className={cn('bg-[#0a0f18] border rounded-2xl overflow-hidden transition-all', !app.is_read ? 'border-[#FCD116]/30' : 'border-white/5')}>
                                        {/* Card header */}
                                        <div className="flex items-center justify-between gap-4 p-5">
                                            <button type="button" onClick={() => { setExpandedApp(isExpanded ? null : app.id); if (!app.is_read) markRead(app.id) }}
                                                className="flex items-center gap-4 flex-1 min-w-0 text-left">
                                                <div className="w-12 h-12 rounded-2xl bg-[#008751]/10 border border-[#008751]/20 flex items-center justify-center flex-shrink-0">
                                                    <Building2 size={20} className="text-[#008751]" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-black text-sm text-white">{app.company_name}</p>
                                                        {!app.is_read && <span className="w-2 h-2 rounded-full bg-[#FCD116] flex-shrink-0" />}
                                                        <span className={cn('text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1', meta.bg, meta.border, meta.text)}>
                                                            <StatusIcon size={9} /> {meta.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">{app.contact_name} • {app.category} • {app.location}</p>
                                                    <p className="text-[10px] text-gray-600">{new Date(app.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                                </div>
                                                {isExpanded ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />}
                                            </button>

                                            {/* Quick actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {app.email && (
                                                    <a href={`mailto:${app.email}?subject=Retour Gagnant — Suite à votre candidature partenaire`}
                                                        onClick={() => app.status === 'pending' && updateAppStatus(app, 'contacted')}
                                                        className="flex items-center gap-1 text-xs font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/20 px-3 py-1.5 rounded-lg transition-all">
                                                        <Mail size={12} /> Email
                                                    </a>
                                                )}
                                                {app.whatsapp && (
                                                    <a href={`https://wa.me/${app.whatsapp.replace(/\s+/g, '')}?text=Bonjour ${app.contact_name}, suite à votre candidature partenaire sur Retour Gagnant...`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        onClick={() => app.status === 'pending' && updateAppStatus(app, 'contacted')}
                                                        className="flex items-center gap-1 text-xs font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 px-3 py-1.5 rounded-lg transition-all">
                                                        <Phone size={12} /> WA
                                                    </a>
                                                )}
                                                <button type="button" title={t("Supprimer la candidature")} onClick={() => deleteApp(app.id)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/10 transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded details */}
                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                    <div className="border-t border-white/5 p-5 space-y-5">
                                                        {/* Info grid */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {[
                                                                { icon: Mail, label: 'Email', value: app.email },
                                                                { icon: Phone, label: 'Téléphone', value: app.phone },
                                                                { icon: Phone, label: 'WhatsApp', value: app.whatsapp },
                                                                { icon: Globe, label: 'Site web', value: app.website },
                                                                { icon: MapPin, label: 'Localisation', value: app.location },
                                                                { icon: Users, label: 'Équipe', value: app.team_size },
                                                            ].filter(i => i.value).map(({ icon: Icon, label, value }) => (
                                                                <div key={label} className="flex items-center gap-2 text-xs">
                                                                    <Icon size={12} className="text-gray-500 flex-shrink-0" />
                                                                    <span className="text-gray-500">{label} :</span>
                                                                    <span className="text-white font-bold truncate">{value}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Descriptions */}
                                                        {app.activity_description && (
                                                            <DetailBlock label="Activité" content={app.activity_description} />
                                                        )}
                                                        {app.why_partner && (
                                                            <DetailBlock label="Pourquoi partenaire" content={app.why_partner} borderClass="border-[#FCD116]/30" />
                                                        )}
                                                        {app.what_offer && (
                                                            <DetailBlock label="Ce qu'ils apportent" content={app.what_offer} borderClass="border-[#008751]/30" />
                                                        )}
                                                        {app.partnership_types?.length > 0 && (
                                                            <div>
                                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2"><T>Types de partenariat souhaités</T></p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {app.partnership_types.map(pt => (
                                                                        <span key={pt} className="text-[10px] font-bold bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20 px-2 py-1 rounded-lg">{pt}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Notes */}
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Notes internes</T></label>
                                                            <textarea
                                                                value={appNotes[app.id] ?? app.notes ?? ''}
                                                                onChange={e => setAppNotes(p => ({ ...p, [app.id]: e.target.value }))}
                                                                placeholder={t("Ajouter des notes sur cette candidature...")}
                                                                title={t("Notes internes")}
                                                                rows={2}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FCD116]/30 resize-none"
                                                            />
                                                        </div>

                                                        {/* Status actions */}
                                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                                            {app.status !== 'contacted' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'contacted')}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    <MessageSquare size={12} /> Marquer contacté
                                                                </button>
                                                            )}
                                                            {app.status !== 'confirmed' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'confirmed', true)}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-[#008751]/15 text-[#008751] hover:bg-[#008751]/25 border border-[#008751]/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    {updatingApp === app.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                                    Confirmer + Ajouter partenaire
                                                                </button>
                                                            )}
                                                            {app.status !== 'rejected' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'rejected')}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 px-4 py-2 rounded-xl transition-all disabled:opacity-40">
                                                                    <Ban size={12} /> Rejeter
                                                                </button>
                                                            )}
                                                            {app.status === 'rejected' && (
                                                                <button type="button" disabled={!!updatingApp} onClick={() => updateAppStatus(app, 'pending')}
                                                                    className="flex items-center gap-1.5 text-xs font-bold bg-white/5 text-gray-400 hover:text-white border border-white/10 px-4 py-2 rounded-xl transition-all">
                                                                    <RefreshCw size={12} /> Remettre en attente
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function Inp({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} title={label}
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white px-4 py-2.5 text-sm focus:outline-none focus:border-[#008751]/40 placeholder-gray-600 transition-colors" />
        </div>
    )
}

function DetailBlock({ label, content, borderClass = 'border-[#3b82f6]/30' }: { label: string; content: string; borderClass?: string }) {
    return (
        <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
            <div className={cn('border-l-2 pl-3 py-1', borderClass)}>
                <p className="text-xs text-gray-300 leading-relaxed">{content}</p>
            </div>
        </div>
    )
}
