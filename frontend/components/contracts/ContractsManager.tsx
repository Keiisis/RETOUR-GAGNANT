'use client'

// ══════════════════════════════════════════════════════════════
//  CONTRATS : gestionnaire partagé Admin / Agent
//  Aperçu A4, envoi avec détection de compte, édition (série et
//  données d'émission IMMUABLES), suppression, téléchargement,
//  marquage signé/non-signé manuel, journal de traçabilité.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTranslation, T } from '@/lib/translation'
import { FileText as FileSignature, Plus, PaperPlaneTilt as Send, CheckCircle as CheckCircle2, Clock, X, FloppyDisk as Save, User, Envelope as Mail, FileText, MagnifyingGlass as Search, Eye, Download, Pencil, Trash as Trash2, ClockCounterClockwise as History, CircleNotch as Loader2, ShieldCheck, Link as Link2, Warning as AlertTriangle, ArrowCounterClockwise as Undo2, Icon as LucideIcon, Lock } from '@phosphor-icons/react';

interface AuditEntry { at: string; action: string; actor: string; details?: string }

interface Contract {
    id: string
    serial: string | null
    client_nom: string
    client_email: string
    title: string
    content: string
    amount: number
    currency: string
    status: string
    signed_at: string | null
    signed_name: string | null
    signature_method: string | null
    signature_hash: string | null
    sign_token: string | null
    agent_name: string
    audit_log: AuditEntry[] | null
    created_at: string
    expires_at: string | null
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

const EMPTY_FORM = { client_nom: '', client_email: '', title: '', content: '', amount: 0, currency: 'XOF' }

const ACTION_LABELS: Record<string, string> = {
    creation: 'Création', envoi: 'Envoi', renvoi: 'Renvoi', modification: 'Modification',
    signature_en_ligne: 'Signature en ligne', marquage_signe: 'Marquage signé (manuel)',
    marquage_non_signe: 'Signature retirée',
}

export default function ContractsManager({ role }: { role: 'admin' | 'agent' }) {
    const { t } = useTranslation()
    const [contracts, setContracts] = useState<Contract[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [actor, setActor] = useState(role === 'admin' ? 'Admin' : 'Agent')

    const [editing, setEditing] = useState<Contract | 'new' | null>(null)
    const [form, setForm] = useState({ ...EMPTY_FORM })
    const [saving, setSaving] = useState(false)
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null)
    const [signTarget, setSignTarget] = useState<Contract | null>(null)
    const [signName, setSignName] = useState('')
    const [expandedAudit, setExpandedAudit] = useState<string | null>(null)
    const [toasts, setToasts] = useState<Toast[]>([])

    const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
        const id = Date.now() + Math.random()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 5500)
    }, [])

    const fetchContracts = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/contracts', { cache: 'no-store' })
            const data = await res.json()
            setContracts(data.contracts || [])
        } catch { toast(t('Chargement impossible'), 'error') }
        setLoading(false)
    }, [toast, t])

    useEffect(() => { fetchContracts() }, [fetchContracts])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) setActor(`${role === 'admin' ? 'Admin' : 'Agent'} : ${session.user.email}`)
        })
    }, [role])

    // ── Création / Édition ──
    const openEdit = (c: Contract | 'new') => {
        setEditing(c)
        setForm(c === 'new' ? { ...EMPTY_FORM } : {
            client_nom: c.client_nom, client_email: c.client_email, title: c.title,
            content: c.content, amount: c.amount, currency: c.currency,
        })
    }

    const handleSave = async () => {
        if (!form.client_nom.trim() || !form.client_email.trim() || !form.title.trim() || !form.content.trim()) {
            toast(t('Nom, email, titre et contenu sont requis.'), 'error'); return
        }
        setSaving(true)
        try {
            const isNew = editing === 'new'
            const res = await fetch(isNew ? '/api/admin/contracts' : `/api/admin/contracts/${(editing as Contract).id}`, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, actor }),
            })
            const data = await res.json()
            if (data.success) {
                toast(isNew ? t('Contrat créé') + ` : ${data.contract?.serial || ''}` : t('Contrat mis à jour'))
                setEditing(null)
                fetchContracts()
            } else toast(data.error || t('Enregistrement impossible'), 'error')
        } catch { toast(t('Enregistrement impossible'), 'error') }
        setSaving(false)
    }

    // ── Envoi avec détection de compte ──
    const handleSend = async (c: Contract) => {
        setSendingId(c.id)
        try {
            const res = await fetch(`/api/admin/contracts/${c.id}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actor }),
            })
            const data = await res.json()
            if (data.success) {
                toast(data.hasAccount
                    ? t('Envoyé : compte client détecté : parcours Espace Client')
                    : t('Envoyé : aucun compte : lien de signature sécurisé transmis'))
                fetchContracts()
            } else toast(data.error || t('Envoi impossible'), 'error')
        } catch { toast(t('Envoi impossible'), 'error') }
        setSendingId(null)
    }

    // ── Suppression ──
    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            const res = await fetch(`/api/admin/contracts/${deleteTarget.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) { toast(t('Contrat supprimé')); fetchContracts() }
            else toast(data.error || t('Suppression impossible'), 'error')
        } catch { toast(t('Suppression impossible'), 'error') }
        setDeleteTarget(null)
    }

    // ── Marquage manuel signé / non signé ──
    const handleManualSign = async () => {
        if (!signTarget) return
        try {
            const res = await fetch(`/api/admin/contracts/${signTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: signTarget.status === 'signe' ? 'mark_unsigned' : 'mark_signed',
                    signed_name: signName.trim() || signTarget.client_nom,
                    actor,
                }),
            })
            const data = await res.json()
            if (data.success) {
                toast(signTarget.status === 'signe' ? t('Signature retirée') : t('Contrat marqué signé manuellement'))
                fetchContracts()
            } else toast(data.error || t('Opération impossible'), 'error')
        } catch { toast(t('Opération impossible'), 'error') }
        setSignTarget(null)
        setSignName('')
    }

    const copySignLink = (c: Contract) => {
        if (!c.sign_token) { toast(t('Token indisponible : appliquez la migration SQL'), 'error'); return }
        navigator.clipboard.writeText(`${window.location.origin}/contrat/${c.sign_token}`)
        toast(t('Lien de signature copié : envoyez-le par le canal de votre choix'))
    }

    const statusConfig: Record<string, { label: string; bg: string; fg: string; icon: LucideIcon }> = {
        brouillon: { label: t('Brouillon'), bg: 'rgba(107,114,128,0.12)', fg: '#6B7280', icon: FileText },
        envoye: { label: t('Envoyé'), bg: 'rgba(59,130,246,0.12)', fg: '#3B82F6', icon: Send },
        signe: { label: t('Signé'), bg: 'rgba(16,185,129,0.12)', fg: '#059669', icon: CheckCircle2 },
        refuse: { label: t('Refusé'), bg: 'rgba(239,68,68,0.12)', fg: '#EF4444', icon: X },
        expire: { label: t('Expiré'), bg: 'rgba(245,158,11,0.12)', fg: '#D97706', icon: Clock },
    }

    const filtered = contracts.filter(c => {
        const q = search.toLowerCase()
        return !q || [c.serial, c.client_nom, c.client_email, c.title].some(v => (v || '').toLowerCase().includes(q))
    })

    const inputStyle = {
        backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))',
        borderColor: 'var(--panel-border, rgba(255,255,255,0.1))',
        color: 'var(--panel-text, #fff)',
    }
    const labelStyle = { color: 'var(--panel-text-muted, #9CA3AF)' }

    // ══════════════ Modal création / édition ══════════════
    if (editing) {
        const isNew = editing === 'new'
        const existing = isNew ? null : editing as Contract
        return (
            <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--panel-bg, #0a0f14)' }}>
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-xl font-black" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                            {isNew ? <T>Nouveau Contrat</T> : <T>Modifier le contrat</T>}
                        </h1>
                        <button onClick={() => setEditing(null)} className="opacity-60 hover:opacity-100 transition-opacity" style={{ color: 'var(--panel-text, #fff)' }}><X size={20} /></button>
                    </div>

                    {existing && (
                        <div className="rounded-xl border p-4 mb-5 flex items-center gap-3"
                            style={{ backgroundColor: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}>
                            <Lock size={16} style={{ color: '#C9A84C' }} className="shrink-0" />
                            <div className="text-xs leading-relaxed" style={labelStyle}>
                                <T>Données d&apos;émission immuables :</T>{' '}
                                <span className="font-mono font-bold" style={{ color: '#C9A84C' }}>{existing.serial}</span>
                                {' : '}<T>émis le</T> {new Date(existing.created_at).toLocaleDateString('fr-FR')} <T>par</T> {existing.agent_name}.{' '}
                                <T>Ces informations ne peuvent jamais être modifiées (traçabilité).</T>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Nom du client *</T></label>
                                <div className="relative">
                                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                    <input type="text" value={form.client_nom} onChange={e => setForm({ ...form, client_nom: e.target.value })}
                                        className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Email du client *</T></label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                    <input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })}
                                        className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Titre du contrat *</T></label>
                            <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                placeholder={t("Contrat d'accompagnement : Nationalité")}
                                className="w-full border rounded-xl py-3 px-4 text-sm focus:outline-none" style={inputStyle} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Montant</T></label>
                                <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                                    className="w-full border rounded-xl py-3 px-4 text-sm focus:outline-none" style={inputStyle} />
                            </div>
                            <div>
                                <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Devise</T></label>
                                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                                    className="w-full border rounded-xl py-3 px-4 text-sm focus:outline-none" style={inputStyle}>
                                    <option value="XOF">XOF (FCFA)</option>
                                    <option value="EUR">EUR</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Contenu du contrat * (articles, engagements, modalités)</T></label>
                            <textarea rows={14} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                                placeholder={t('Article 1 : Objet\nLe Prestataire s\'engage à…\n\nArticle 2 : Modalités…')}
                                className="w-full border rounded-xl py-3 px-4 text-sm focus:outline-none resize-none font-mono" style={inputStyle} />
                            <p className="text-[11px] mt-1.5" style={labelStyle}><T>L&apos;en-tête légal (RCCM, IFU, parties), les clauses réglementaires et les blocs de signature sont ajoutés automatiquement au document final.</T></p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleSave} disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm">
                                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                {isNew ? <T>Créer le contrat</T> : <T>Enregistrer les modifications</T>}
                            </button>
                            <button onClick={() => setEditing(null)} className="text-sm font-bold px-4 py-3 opacity-70 hover:opacity-100" style={labelStyle}><T>Annuler</T></button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ══════════════ Liste ══════════════
    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--panel-bg, #0a0f14)' }}>
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#10B981' }}><T>Gestion</T></span>
                        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                            <FileSignature size={22} style={{ color: '#10B981' }} /> <T>Contrats</T>
                        </h1>
                    </div>
                    <button onClick={() => openEdit('new')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
                        <Plus size={16} /> <T>Nouveau Contrat</T>
                    </button>
                </div>

                <div className="relative mb-6">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={t('Rechercher par n° de série, client, email, titre…')}
                        className="w-full border rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none" style={inputStyle} />
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20" style={labelStyle}>
                        <FileSignature className="mx-auto mb-3 opacity-40" size={40} />
                        <p className="text-sm"><T>Aucun contrat</T></p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((c, i) => {
                            const cfg = statusConfig[c.status] || statusConfig.brouillon
                            const audit = Array.isArray(c.audit_log) ? c.audit_log : []
                            const expanded = expandedAudit === c.id
                            return (
                                <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                                    className="border rounded-xl p-5 transition-all"
                                    style={{ backgroundColor: 'var(--panel-surface, rgba(255,255,255,0.03))', borderColor: 'var(--panel-border, rgba(255,255,255,0.05))' }}>
                                    <div className="flex items-start justify-between flex-wrap gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md"
                                                    style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#059669' }}>{c.serial || '-'}</span>
                                                <p className="text-sm font-bold truncate" style={{ color: 'var(--panel-text-heading, #fff)' }}>{c.title}</p>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap" style={labelStyle}>
                                                <span className="flex items-center gap-1"><User size={10} /> {c.client_nom}</span>
                                                <span className="flex items-center gap-1"><Mail size={10} /> {c.client_email}</span>
                                                <span className="font-bold">{Number(c.amount || 0).toLocaleString('fr-FR')} {c.currency === 'XOF' ? 'FCFA' : c.currency}</span>
                                                <span><T>émis le</T> {new Date(c.created_at).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                            {c.status === 'signe' && (
                                                <p className="text-[11px] mt-1.5 flex items-center gap-1.5 font-semibold" style={{ color: '#059669' }}>
                                                    <ShieldCheck size={12} />
                                                    {c.signature_method === 'manuel' ? <T>Signé manuellement</T> : <T>Signé en ligne</T>}
                                                    {' : '}{c.signed_name || c.client_nom}{c.signed_at ? ` : ${new Date(c.signed_at).toLocaleString('fr-FR')}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shrink-0"
                                            style={{ backgroundColor: cfg.bg, color: cfg.fg }}>
                                            <cfg.icon size={10} /> {cfg.label}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                                        <a href={`/api/contracts/print?id=${c.id}`} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                            style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                            <Eye size={12} /> <T>Aperçu</T>
                                        </a>
                                        <a href={`/api/contracts/print?id=${c.id}`} target="_blank" rel="noopener noreferrer"
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                            style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                            <Download size={12} /> <T>Télécharger PDF</T>
                                        </a>
                                        {c.status !== 'signe' && (
                                            <button onClick={() => handleSend(c)} disabled={sendingId === c.id}
                                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                                                style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#3B82F6' }}>
                                                {sendingId === c.id ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                                                {c.status === 'envoye' ? <T>Renvoyer</T> : <T>Envoyer au client</T>}
                                            </button>
                                        )}
                                        <button onClick={() => copySignLink(c)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                            style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                            <Link2 size={12} /> <T>Copier le lien</T>
                                        </button>
                                        <button onClick={() => { setSignTarget(c); setSignName(c.client_nom) }}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                                            style={c.status === 'signe'
                                                ? { backgroundColor: 'rgba(245,158,11,0.12)', color: '#D97706' }
                                                : { backgroundColor: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                                            {c.status === 'signe' ? <><Undo2 size={12} /> <T>Retirer la signature</T></> : <><CheckCircle2 size={12} /> <T>Marquer signé</T></>}
                                        </button>
                                        <button onClick={() => openEdit(c)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                            style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                            <Pencil size={12} /> <T>Modifier</T>
                                        </button>
                                        <button onClick={() => setDeleteTarget(c)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                            <Trash2 size={12} /> <T>Supprimer</T>
                                        </button>
                                        <button onClick={() => setExpandedAudit(expanded ? null : c.id)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                            style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                            <History size={12} /> <T>Traçabilité</T> ({audit.length})
                                        </button>
                                    </div>

                                    {/* Journal d'audit */}
                                    <AnimatePresence>
                                        {expanded && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden">
                                                <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: '1px solid var(--panel-divider, rgba(255,255,255,0.06))' }}>
                                                    {audit.length === 0 ? (
                                                        <p className="text-[11px]" style={labelStyle}><T>Aucune entrée de traçabilité (contrat antérieur à la v2).</T></p>
                                                    ) : [...audit].reverse().map((entry, idx) => (
                                                        <div key={idx} className="flex items-start gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#10B981' }} />
                                                            <div className="text-[11px] leading-relaxed" style={labelStyle}>
                                                                <span className="font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>{ACTION_LABELS[entry.action] || entry.action}</span>
                                                                {' : '}{new Date(entry.at).toLocaleString('fr-FR')}{' : '}{entry.actor}
                                                                {entry.details && <span className="block opacity-80">{entry.details}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {c.signature_hash && (
                                                        <p className="text-[10px] font-mono pt-1 break-all" style={labelStyle}><T>Empreinte</T> : {c.signature_hash}</p>
                                                    )}
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

            {/* ── Modal suppression ── */}
            <AnimatePresence>
                {deleteTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(10,15,20,0.7)' }}
                        onClick={() => setDeleteTarget(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="border rounded-2xl p-6 max-w-md w-full"
                            style={{ backgroundColor: 'var(--panel-surface, #111827)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                            <AlertTriangle className="text-red-500 mb-3" size={26} />
                            <h3 className="text-base font-black mb-2" style={{ color: 'var(--panel-text-heading, #fff)' }}><T>Supprimer ce contrat ?</T></h3>
                            <p className="text-xs leading-relaxed mb-1" style={labelStyle}>
                                <span className="font-mono font-bold">{deleteTarget.serial}</span> : {deleteTarget.title}
                            </p>
                            <p className="text-xs leading-relaxed mb-5" style={labelStyle}>
                                <T>Cette action est définitive : le document et tout son journal de traçabilité seront effacés.</T>
                                {deleteTarget.status === 'signe' && <strong className="block mt-1 text-red-400"><T>Attention : ce contrat est SIGNÉ.</T></strong>}
                            </p>
                            <div className="flex gap-3">
                                <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all"><T>Supprimer définitivement</T></button>
                                <button onClick={() => setDeleteTarget(null)} className="flex-1 border font-bold text-sm py-2.5 rounded-xl transition-all"
                                    style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}><T>Annuler</T></button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Modal marquage manuel ── */}
            <AnimatePresence>
                {signTarget && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(10,15,20,0.7)' }}
                        onClick={() => setSignTarget(null)}>
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            onClick={e => e.stopPropagation()}
                            className="border rounded-2xl p-6 max-w-md w-full"
                            style={{ backgroundColor: 'var(--panel-surface, #111827)', borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                            {signTarget.status === 'signe' ? (
                                <>
                                    <Undo2 className="text-amber-500 mb-3" size={26} />
                                    <h3 className="text-base font-black mb-2" style={{ color: 'var(--panel-text-heading, #fff)' }}><T>Retirer la signature ?</T></h3>
                                    <p className="text-xs leading-relaxed mb-5" style={labelStyle}>
                                        <T>Le contrat repassera au statut « envoyé ». L&apos;opération sera consignée dans le journal de traçabilité.</T>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="text-emerald-500 mb-3" size={26} />
                                    <h3 className="text-base font-black mb-2" style={{ color: 'var(--panel-text-heading, #fff)' }}><T>Marquer signé manuellement</T></h3>
                                    <p className="text-xs leading-relaxed mb-4" style={labelStyle}>
                                        <T>Utilisez cette option quand le client a signé par un autre canal (papier, email, WhatsApp). L&apos;opération est horodatée et tracée à votre nom.</T>
                                    </p>
                                    <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Nom du signataire</T></label>
                                    <input type="text" value={signName} onChange={e => setSignName(e.target.value)}
                                        className="w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none mb-5" style={inputStyle} />
                                </>
                            )}
                            <div className="flex gap-3">
                                <button onClick={handleManualSign}
                                    className={`flex-1 text-white font-bold text-sm py-2.5 rounded-xl transition-all ${signTarget.status === 'signe' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                    <T>Confirmer</T>
                                </button>
                                <button onClick={() => setSignTarget(null)} className="flex-1 border font-bold text-sm py-2.5 rounded-xl transition-all"
                                    style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}><T>Annuler</T></button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Toasts ── */}
            <div className="fixed bottom-6 right-6 z-[60] space-y-2 max-w-sm">
                <AnimatePresence>
                    {toasts.map(tst => (
                        <motion.div key={tst.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                            className="rounded-xl px-4 py-3 text-sm font-semibold shadow-lg flex items-center gap-2.5 text-white"
                            style={{ backgroundColor: tst.type === 'success' ? '#047857' : '#DC2626' }}>
                            {tst.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
                            {tst.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
