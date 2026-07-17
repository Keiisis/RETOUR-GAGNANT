'use client'

// ══════════════════════════════════════════════════════════════
//  GÉNÉRER LIEN DE PAIEMENT — partagé Admin / Agent
//  Crée des liens de paiement réels (5 providers) reliés à la
//  facturation et à la comptabilité : à chaque paiement, une
//  facture ERP est générée automatiquement + email client.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useTranslation, T } from '@/lib/translation'
import {
    Link2, Plus, Copy, ExternalLink, Trash2, CheckCircle2, Clock,
    Loader2, Mail, User, Phone, Tag, AlertTriangle, Send, ShieldCheck
} from 'lucide-react'

interface PaymentLink {
    id: string
    secret_key: string
    client_name: string
    client_email: string | null
    client_phone: string | null
    destination: string
    total_amount: number
    currency: string | null
    status: string
    notes: string
    created_at: string
    url: string
    paid: boolean
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

export default function PaymentLinksManager({ role }: { role: 'admin' | 'agent' }) {
    const { t } = useTranslation()
    const [links, setLinks] = useState<PaymentLink[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [actor, setActor] = useState(role === 'admin' ? 'Admin' : 'Agent')
    const [deleteTarget, setDeleteTarget] = useState<PaymentLink | null>(null)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [form, setForm] = useState({
        label: '', amount: 0, currency: 'XOF',
        client_name: '', client_email: '', client_phone: '', send_email: true,
    })

    const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
        const id = Date.now() + Math.random()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 6000)
    }, [])

    const fetchLinks = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/payment-links', { cache: 'no-store' })
            const data = await res.json()
            setLinks(data.links || [])
        } catch { toast(t('Chargement impossible'), 'error') }
        setLoading(false)
    }, [toast, t])

    useEffect(() => { fetchLinks() }, [fetchLinks])

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) setActor(`${role === 'admin' ? 'Admin' : 'Agent'} — ${session.user.email}`)
        })
    }, [role])

    const handleCreate = async () => {
        if (!form.label.trim() || !form.client_name.trim() || form.amount <= 0) {
            toast(t('Libellé, nom du client et montant positif sont requis.'), 'error'); return
        }
        setSaving(true)
        try {
            const res = await fetch('/api/admin/payment-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, actor }),
            })
            const data = await res.json()
            if (data.success) {
                navigator.clipboard.writeText(data.url).catch(() => {})
                toast(data.emailSent
                    ? t('Lien créé, copié et envoyé par email au client')
                    : t('Lien créé et copié dans le presse-papiers'))
                setCreating(false)
                setForm({ label: '', amount: 0, currency: 'XOF', client_name: '', client_email: '', client_phone: '', send_email: true })
                fetchLinks()
            } else toast(data.error || t('Création impossible'), 'error')
        } catch { toast(t('Création impossible'), 'error') }
        setSaving(false)
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            const res = await fetch(`/api/admin/payment-links?id=${deleteTarget.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) { toast(t('Lien supprimé')); fetchLinks() }
            else toast(data.error || t('Suppression impossible'), 'error')
        } catch { toast(t('Suppression impossible'), 'error') }
        setDeleteTarget(null)
    }

    const copyLink = (l: PaymentLink) => {
        navigator.clipboard.writeText(l.url)
        toast(t('Lien copié — partagez-le par le canal de votre choix'))
    }

    const fmtA = (n: number, c: string | null) =>
        `${Number(n || 0).toLocaleString('fr-FR')} ${c === 'EUR' ? '€' : c === 'USD' ? '$' : 'FCFA'}`

    const inputStyle = {
        backgroundColor: 'var(--panel-surface-alt, rgba(255,255,255,0.05))',
        borderColor: 'var(--panel-border, rgba(255,255,255,0.1))',
        color: 'var(--panel-text, #fff)',
    }
    const labelStyle = { color: 'var(--panel-text-muted, #9CA3AF)' }

    return (
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--panel-bg, #0a0f14)' }}>
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: '#10B981' }}><T>Encaissement</T></span>
                        <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: 'var(--panel-text-heading, #fff)' }}>
                            <Link2 size={22} style={{ color: '#10B981' }} /> <T>Générer lien de paiement</T>
                        </h1>
                    </div>
                    <button onClick={() => setCreating(v => !v)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2">
                        <Plus size={16} /> <T>Nouveau lien</T>
                    </button>
                </div>
                <p className="text-xs mb-6 leading-relaxed max-w-2xl" style={labelStyle}>
                    <T>Chaque lien ouvre une page de paiement sécurisée (Mobile Money, carte, PayPal). Dès que le client paie, la facture est générée automatiquement dans la Facturation, la Comptabilité est alimentée et le client reçoit sa confirmation par email.</T>
                </p>

                {/* Formulaire de création */}
                <AnimatePresence>
                    {creating && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="border rounded-2xl p-5 mb-6 space-y-4"
                                style={{ backgroundColor: 'var(--panel-surface, rgba(255,255,255,0.03))', borderColor: 'var(--panel-border, rgba(255,255,255,0.08))' }}>
                                <div>
                                    <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Libellé de la prestation *</T></label>
                                    <div className="relative">
                                        <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                        <input type="text" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                                            placeholder={t('Frais de dossier — Accompagnement passeport')}
                                            className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Montant *</T></label>
                                        <input type="number" min={0} value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Nom du client *</T></label>
                                        <div className="relative">
                                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                            <input type="text" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                                                className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Email client</T></label>
                                        <div className="relative">
                                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                            <input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })}
                                                className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold mb-1 block" style={labelStyle}><T>Téléphone client</T></label>
                                        <div className="relative">
                                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" style={labelStyle} />
                                            <input type="tel" value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })}
                                                className="w-full border rounded-xl py-3 pl-9 pr-4 text-sm focus:outline-none" style={inputStyle} />
                                        </div>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input type="checkbox" checked={form.send_email} onChange={e => setForm({ ...form, send_email: e.target.checked })}
                                        className="w-4 h-4 accent-emerald-600" />
                                    <span className="text-xs" style={labelStyle}><T>Envoyer immédiatement le lien par email au client (modèle professionnel)</T></span>
                                </label>
                                <button onClick={handleCreate} disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm">
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                    <T>Générer le lien de paiement</T>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Liste */}
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
                ) : links.length === 0 ? (
                    <div className="text-center py-16" style={labelStyle}>
                        <Link2 className="mx-auto mb-3 opacity-40" size={36} />
                        <p className="text-sm"><T>Aucun lien de paiement généré</T></p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {links.map((l, i) => (
                            <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                                className="border rounded-xl p-5"
                                style={{ backgroundColor: 'var(--panel-surface, rgba(255,255,255,0.03))', borderColor: 'var(--panel-border, rgba(255,255,255,0.05))' }}>
                                <div className="flex items-start justify-between flex-wrap gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold" style={{ color: 'var(--panel-text-heading, #fff)' }}>{l.destination}</p>
                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap" style={labelStyle}>
                                            <span className="flex items-center gap-1"><User size={10} /> {l.client_name}</span>
                                            {l.client_email && <span className="flex items-center gap-1"><Mail size={10} /> {l.client_email}</span>}
                                            <span className="font-bold" style={{ color: 'var(--panel-text, #E5E7EB)' }}>{fmtA(l.total_amount, l.currency)}</span>
                                            <span>{new Date(l.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        {l.paid && (
                                            <p className="text-[11px] mt-1.5 flex items-center gap-1.5 font-semibold" style={{ color: '#059669' }}>
                                                <ShieldCheck size={12} /> <T>Payé — facture générée automatiquement et comptabilisée</T>
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shrink-0"
                                        style={l.paid
                                            ? { backgroundColor: 'rgba(16,185,129,0.12)', color: '#059669' }
                                            : { backgroundColor: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                                        {l.paid ? <><CheckCircle2 size={10} /> <T>Payé</T></> : <><Clock size={10} /> <T>En attente</T></>}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-3.5 flex-wrap">
                                    <button onClick={() => copyLink(l)}
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                        style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                        <Copy size={12} /> <T>Copier le lien</T>
                                    </button>
                                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all hover:border-emerald-400"
                                        style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}>
                                        <ExternalLink size={12} /> <T>Ouvrir</T>
                                    </a>
                                    {!l.paid && (
                                        <button onClick={() => setDeleteTarget(l)}
                                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                                            style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                                            <Trash2 size={12} /> <T>Supprimer</T>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal suppression */}
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
                            <h3 className="text-base font-black mb-2" style={{ color: 'var(--panel-text-heading, #fff)' }}><T>Supprimer ce lien ?</T></h3>
                            <p className="text-xs leading-relaxed mb-5" style={labelStyle}>
                                {deleteTarget.destination} — {fmtA(deleteTarget.total_amount, deleteTarget.currency)}.{' '}
                                <T>Le lien ne fonctionnera plus. Les liens déjà payés ne peuvent jamais être supprimés (traçabilité comptable).</T>
                            </p>
                            <div className="flex gap-3">
                                <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-2.5 rounded-xl transition-all"><T>Supprimer</T></button>
                                <button onClick={() => setDeleteTarget(null)} className="flex-1 border font-bold text-sm py-2.5 rounded-xl transition-all"
                                    style={{ ...inputStyle, borderColor: 'var(--panel-border, rgba(255,255,255,0.1))' }}><T>Annuler</T></button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toasts */}
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
