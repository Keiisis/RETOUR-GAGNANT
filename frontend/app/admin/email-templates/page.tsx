'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Envelope as Mail, Pencil as Edit2, Eye, EyeSlash as EyeOff, CircleNotch as Loader2, FloppyDisk as Save, Code, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Plus, Trash as Trash2, ArrowClockwise as RefreshCw, X, Hash, CaretDown as ChevronDown, CaretUp as ChevronUp } from '@phosphor-icons/react';
import { cn } from '@/lib/utils'

interface EmailTemplate {
    id: number
    name: string
    slug: string
    subject: string
    html_body: string
    variables?: string[]
    created_at?: string
    updated_at?: string
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

// Données de prévisualisation avec des valeurs de démo
const PREVIEW_DATA: Record<string, string> = {
    prenom: 'Jean',
    nom: 'Dupont',
    nationalite: 'Française',
    ref: 'RG-000042',
    message: 'Votre profil est excellent et notre équipe souhaite vous rencontrer.',
    service: 'Passeport Béninois',
    date: '15 mars 2026',
    heure: '14h00',
    montant: '45 000 FCFA',
}

function fillPreview(html: string): string {
    return Object.entries(PREVIEW_DATA).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v),
        html
    )
}

export default function AdminEmailTemplatesPage() {
    const { t } = useTranslation();
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [previewId, setPreviewId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState({ name: '', slug: '', subject: '', html_body: '', variables: '' })
    const [saving, setSaving] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', slug: '', subject: '', html_body: '', variables: '' })
    const [creating, setCreating] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [toastCounter, setToastCounter] = useState(0)
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
    const [expandedId, setExpandedId] = useState<number | null>(null)

    const addToast = useCallback((type: Toast['type'], msg: string) => {
        const id = toastCounter + 1
        setToastCounter(id)
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [toastCounter])

    const fetchTemplates = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/email-templates')
            if (!res.ok) throw new Error('Erreur chargement templates')
            const data = await res.json()
            setTemplates(data.templates || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchTemplates() }, [fetchTemplates])

    const startEdit = (t: EmailTemplate) => {
        setEditingId(t.id)
        setEditForm({
            name: t.name,
            slug: t.slug,
            subject: t.subject,
            html_body: t.html_body,
            variables: (t.variables || []).join(', '),
        })
        setActiveTab('edit')
        setPreviewId(null)
    }

    const handleSave = async () => {
        if (!editingId) return
        setSaving(true)
        try {
            const variables = editForm.variables
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)
            const res = await fetch(`/api/admin/email-templates/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editForm, variables }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde')
            setTemplates(prev => prev.map(t => t.id === editingId ? { ...t, ...data.template } : t))
            setEditingId(null)
            addToast('success', 'Template sauvegardé')
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (template: EmailTemplate) => {
        if (!confirm(`Supprimer définitivement le template "${template.name}" ?`)) return
        try {
            const res = await fetch(`/api/admin/email-templates/${template.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erreur suppression')
            setTemplates(prev => prev.filter(t => t.id !== template.id))
            if (editingId === template.id) setEditingId(null)
            addToast('success', 'Template supprimé')
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur')
        }
    }

    const handleCreate = async () => {
        if (!createForm.name || !createForm.slug || !createForm.subject || !createForm.html_body) {
            addToast('error', 'Tous les champs sont obligatoires')
            return
        }
        setCreating(true)
        try {
            const variables = createForm.variables
                .split(',')
                .map(v => v.trim())
                .filter(Boolean)
            const res = await fetch('/api/admin/email-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...createForm, variables }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur création')
            setTemplates(prev => [...prev, data.template])
            setShowCreate(false)
            setCreateForm({ name: '', slug: '', subject: '', html_body: '', variables: '' })
            addToast('success', 'Template créé')
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur')
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Toast container */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={cn(
                                'flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold pointer-events-auto border',
                                t.type === 'success' ? 'bg-[#0a1a0f] border-[#008751]/30 text-[#00c870]' : 'bg-[#1a0a0a] border-[#E8112D]/30 text-[#ff4d4d]'
                            )}
                        >
                            {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#3b82f6]">
                        <Mail size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]"><T>Communication</T></span>
                    </div>
                    <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                        TEMPLATES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#06b6d4]"><T>EMAIL</T></span>
                    </h1>
                    <p className="text-sm text-gray-500">
                        {templates.length} template(s) — personnalisables avec variables dynamiques
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={fetchTemplates}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                        title={t("Rafraîchir")}
                    >
                        <RefreshCw size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all shadow-lg"
                    >
                        <Plus size={16} /> NOUVEAU TEMPLATE
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Create Form */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-[#0a0f18] border border-[#3b82f6]/20 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#3b82f6]/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
                                        <Plus size={14} className="text-[#3b82f6]" />
                                    </div>
                                    <p className="text-sm font-black text-white"><T>Nouveau Template</T></p>
                                </div>
                                <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Nom *</T></label>
                                        <input
                                            type="text"
                                            value={createForm.name}
                                            onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                                            placeholder={t("Confirmation de commande")}
                                            title={t("Nom du template")}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Slug (identifiant) *</T></label>
                                        <input
                                            type="text"
                                            value={createForm.slug}
                                            onChange={e => setCreateForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                                            placeholder={t("order_confirmation")}
                                            title={t("Slug du template")}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Objet de l&apos;email *</T></label>
                                    <input
                                        type="text"
                                        value={createForm.subject}
                                        onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))}
                                        placeholder={t("Retour Gagnant — {{titre}}")}
                                        title={t("Objet de l'email")}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <Code size={11} /> Corps HTML *
                                    </label>
                                    <textarea
                                        value={createForm.html_body}
                                        onChange={e => setCreateForm(p => ({ ...p, html_body: e.target.value }))}
                                        rows={12}
                                        title={t("Corps HTML")}
                                        placeholder={t("<!DOCTYPE html><html>...</html>")}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-green-400 text-xs font-mono focus:outline-none focus:border-[#3b82f6]/40 resize-none transition-colors leading-relaxed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <Hash size={11} /> Variables (séparées par des virgules)
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.variables}
                                        onChange={e => setCreateForm(p => ({ ...p, variables: e.target.value }))}
                                        placeholder={t("prenom, nom, ref, montant")}
                                        title={t("Variables du template")}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={creating}
                                        className="flex items-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black text-xs tracking-widest px-6 py-3 rounded-xl transition-all disabled:opacity-40"
                                    >
                                        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                        CRÉER LE TEMPLATE
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreate(false)}
                                        className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold transition-colors"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Templates list */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-[#3b82f6]" size={36} />
                </div>
            ) : (
                <div className="space-y-4">
                    {templates.map(template => (
                        <div key={template.id} className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                            {/* Card header */}
                            <div className="flex items-center justify-between gap-4 p-5 hover:bg-white/[0.015] transition-colors">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center shrink-0">
                                        <Mail size={18} className="text-[#3b82f6]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-white">{template.name}</p>
                                            <span className="text-[9px] font-mono text-gray-600 bg-white/5 px-2 py-0.5 rounded">{template.slug}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">{template.subject}</p>
                                    </div>
                                    {expandedId === template.id ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Variables preview */}
                                    {(template.variables || []).length > 0 && (
                                        <div className="hidden sm:flex items-center gap-1 flex-wrap max-w-xs">
                                            {(template.variables || []).slice(0, 3).map(v => (
                                                <span key={v} className="text-[9px] font-mono text-[#FCD116]/70 bg-[#FCD116]/5 border border-[#FCD116]/15 px-2 py-0.5 rounded">
                                                    {`{{${v}}}`}
                                                </span>
                                            ))}
                                            {(template.variables || []).length > 3 && (
                                                <span className="text-[9px] text-gray-600">+{(template.variables || []).length - 3}</span>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPreviewId(previewId === template.id ? null : template.id)
                                            setEditingId(null)
                                        }}
                                        title={t("Aperçu")}
                                        className={cn(
                                            'p-2 rounded-xl border transition-all text-xs font-bold',
                                            previewId === template.id
                                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                                : 'bg-white/5 text-gray-400 border-white/5 hover:text-[#3b82f6]'
                                        )}
                                    >
                                        {previewId === template.id ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            startEdit(template)
                                            setExpandedId(template.id)
                                        }}
                                        title={t("Modifier")}
                                        className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-[#FCD116] hover:bg-[#FCD116]/10 transition-all"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(template)}
                                        title={t("Supprimer")}
                                        className="p-2 rounded-xl bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded content */}
                            <AnimatePresence>
                                {expandedId === template.id && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                        className="overflow-hidden border-t border-white/5"
                                    >
                                        {/* Preview panel */}
                                        {previewId === template.id && (
                                            <div className="p-6 border-b border-white/5">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <Eye size={11} /> Aperçu avec données de démo
                                                </p>
                                                <div className="bg-white rounded-2xl overflow-hidden shadow-inner">
                                                    <iframe
                                                        srcDoc={fillPreview(template.html_body)}
                                                        className="w-full min-h-[400px] max-h-[600px] border-0"
                                                        title={`Preview — ${template.name}`}
                                                        sandbox="allow-same-origin"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Edit form */}
                                        {editingId === template.id && (
                                            <div className="p-6 space-y-5">
                                                {/* Tab switcher */}
                                                <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
                                                    {[
                                                        { key: 'edit' as const, label: 'Éditer', icon: Edit2 },
                                                        { key: 'preview' as const, label: 'Prévisualiser', icon: Eye },
                                                    ].map(tab => (
                                                        <button
                                                            key={tab.key}
                                                            type="button"
                                                            onClick={() => setActiveTab(tab.key)}
                                                            className={cn(
                                                                'flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg transition-all',
                                                                activeTab === tab.key ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'text-gray-500 hover:text-white'
                                                            )}
                                                        >
                                                            <tab.icon size={12} />
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                {activeTab === 'edit' ? (
                                                    <>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Nom du template</T></label>
                                                                <input
                                                                    type="text"
                                                                    value={editForm.name}
                                                                    onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                                                                    title={t("Nom du template")}
                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Slug</T></label>
                                                                <input
                                                                    type="text"
                                                                    value={editForm.slug}
                                                                    onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))}
                                                                    title={t("Slug du template")}
                                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider"><T>Objet de l&apos;email</T></label>
                                                            <input
                                                                type="text"
                                                                value={editForm.subject}
                                                                onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))}
                                                                title={t("Objet de l'email")}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                                                <Code size={11} /> Corps HTML
                                                            </label>
                                                            <textarea
                                                                value={editForm.html_body}
                                                                onChange={e => setEditForm(p => ({ ...p, html_body: e.target.value }))}
                                                                rows={20}
                                                                title={t("Corps HTML")}
                                                                className="w-full bg-[#030509] border border-white/10 rounded-xl py-4 px-5 text-green-400 text-xs font-mono focus:outline-none focus:border-[#3b82f6]/40 resize-y transition-colors leading-relaxed"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                                                <Hash size={11} /> Variables disponibles
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={editForm.variables}
                                                                onChange={e => setEditForm(p => ({ ...p, variables: e.target.value }))}
                                                                placeholder={t("prenom, nom, ref, montant")}
                                                                title={t("Variables du template")}
                                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm font-mono focus:outline-none focus:border-[#3b82f6]/40 transition-colors"
                                                            />
                                                            <p className="text-[10px] text-gray-600">Utilisez {`{{variable}}`} dans le HTML. Séparez les noms par des virgules.</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    /* Preview of edited version */
                                                    <div className="bg-white rounded-2xl overflow-hidden shadow-inner">
                                                        <iframe
                                                            srcDoc={fillPreview(editForm.html_body)}
                                                            className="w-full min-h-[400px] max-h-[600px] border-0"
                                                            title={t("Preview édition")}
                                                            sandbox="allow-same-origin"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex gap-3 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleSave}
                                                        disabled={saving}
                                                        className="flex items-center gap-2 bg-[#008751] hover:bg-[#009960] text-white font-black text-xs tracking-widest px-6 py-3 rounded-xl transition-all disabled:opacity-40 shadow-lg"
                                                    >
                                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        SAUVEGARDER
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingId(null)}
                                                        className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold transition-colors"
                                                    >
                                                        Annuler
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* If not editing, show subject + variable preview */}
                                        {editingId !== template.id && previewId !== template.id && (
                                            <div className="p-5 space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider mt-0.5 shrink-0 w-14"><T>Objet</T></span>
                                                    <span className="text-xs text-gray-300">{template.subject}</span>
                                                </div>
                                                {(template.variables || []).length > 0 && (
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider mt-0.5 shrink-0 w-14"><T>Vars</T></span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {(template.variables || []).map(v => (
                                                                <span key={v} className="text-[9px] font-mono text-[#FCD116]/70 bg-[#FCD116]/5 border border-[#FCD116]/15 px-2 py-0.5 rounded">
                                                                    {`{{${v}}}`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {template.updated_at && (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-wider shrink-0 w-14"><T>Modifié</T></span>
                                                        <span className="text-[10px] text-gray-500">
                                                            {new Date(template.updated_at).toLocaleString('fr-FR')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}

                    {templates.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center py-24 space-y-3">
                            <Mail size={40} className="text-gray-700" />
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest"><T>Aucun template email</T></p>
                            <button
                                type="button"
                                onClick={() => setShowCreate(true)}
                                className="text-[#3b82f6] text-xs font-bold hover:underline"
                            >
                                + Créer le premier template
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
