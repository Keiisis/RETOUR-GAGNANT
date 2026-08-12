'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gear as Settings, FloppyDisk as Save, CircleNotch as Loader2, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Palette, ShareNetwork as Share2, Globe, CreditCard, Envelope as Mail, MonitorPlay, Pencil as Edit2, X, ArrowClockwise as RefreshCw, Database, ShieldCheck } from '@phosphor-icons/react';
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Setting {
    key: string
    value: string
    category: string
}

// Métadonnées d'affichage pour chaque clé
const KEY_META: Record<string, { label: string; type: 'text' | 'color' | 'email' | 'url' | 'tel'; placeholder?: string }> = {
    site_title: { label: 'Titre du site', type: 'text', placeholder: 'Retour Gagnant Bénin' },
    site_slogan: { label: 'Slogan', type: 'text', placeholder: "L'alliance parfaite..." },
    logo_url: { label: 'URL du logo', type: 'url', placeholder: '/logo.png' },
    primary_color: { label: 'Couleur primaire', type: 'color' },
    contact_email: { label: 'Email de contact', type: 'email', placeholder: 'contact@retourgagnantbenin.bj' },
    contact_phone: { label: 'Téléphone', type: 'tel', placeholder: '+229 01 60 32 21 21 / +229 01 94 35 50 50' },
    address: { label: 'Adresse', type: 'text', placeholder: 'Haie Vive, Cotonou, Bénin' },
    facebook_url: { label: 'Facebook', type: 'url', placeholder: 'https://facebook.com/...' },
    instagram_url: { label: 'Instagram', type: 'url', placeholder: 'https://instagram.com/...' },
    linkedin_url: { label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/...' },
    whatsapp_number: { label: 'WhatsApp (avec indicatif)', type: 'tel', placeholder: '+22901234567' },
    serper_api_key_1: { label: 'Clé d\'API Serper 1', type: 'text', placeholder: 'xxxx...' },
    serper_api_key_2: { label: 'Clé d\'API Serper 2', type: 'text', placeholder: 'xxxx...' },
    serper_api_key_3: { label: 'Clé d\'API Serper 3', type: 'text', placeholder: 'xxxx...' },
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Settings; color: string; description: string }> = {
    general: {
        label: 'Général',
        icon: Globe,
        color: '#FCD116',
        description: 'Identité du site, contacts et réseaux sociaux',
    },
    email: {
        label: 'Email / SMTP',
        icon: Mail,
        color: '#3b82f6',
        description: 'Configuration du serveur d\'envoi d\'emails',
    },
    payment: {
        label: 'Paiements',
        icon: CreditCard,
        color: '#008751',
        description: 'Passerelles de paiement (Kkiapay, FedaPay, Stripe, PayPal)',
    },
    frontend: {
        label: 'Frontend',
        icon: MonitorPlay,
        color: '#a855f7',
        description: 'Personnalisation visuelle du site public',
    },
    radar: {
        label: 'Radar IA Configuration',
        icon: Globe,
        color: '#FCD116',
        description: 'Moteur de recherche intelligent & LLMs',
    }
}

// Catégories qui ont leurs propres sous-pages dédiées (on affiche juste un lien)
const SUB_PAGE_CATEGORIES: Record<string, string> = {
    email: '/admin/settings/email',
    payment: '/admin/settings/payment',
    frontend: '/admin/settings/frontend',
    mecef: '/admin/settings/mecef',
}

interface Toast { id: number; type: 'success' | 'error'; msg: string }

export default function AdminSettingsPage() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<Setting[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [saving, setSaving] = useState(false)
    const [toasts, setToasts] = useState<Toast[]>([])
    const [toastCounter, setToastCounter] = useState(0)

    const addToast = useCallback((type: Toast['type'], msg: string) => {
        const id = toastCounter + 1
        setToastCounter(id)
        setToasts(t => [...t, { id, type, msg }])
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }, [toastCounter])

    const fetchSettings = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/settings')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur chargement paramètres')
            setSettings(data.settings || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchSettings() }, [fetchSettings])

    const startEdit = (setting: Setting) => {
        setEditingKey(setting.key)
        setEditValue(setting.value || '')
    }

    const cancelEdit = () => {
        setEditingKey(null)
        setEditValue('')
    }

    const saveEdit = async (setting: Setting) => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: setting.key, value: editValue, category: setting.category }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde')
            setSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: editValue } : s))
            setEditingKey(null)
            addToast('success', `"${KEY_META[setting.key]?.label || setting.key}" mis à jour`)
        } catch (e) {
            addToast('error', e instanceof Error ? e.message : 'Erreur')
        } finally {
            setSaving(false)
        }
    }

    const generalSettings = settings.filter(s => s.category === 'general')
    const otherCategories = [...new Set(settings.filter(s => s.category !== 'general').map(s => s.category))]

    return (
        <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
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
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <Settings size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]"><T>Configuration du Système</T></span>
                    </div>
                    <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                        PARAMÈTRES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>SYSTÈME</T></span>
                    </h1>
                    <p className="text-sm text-gray-500">
                        {settings.length} paramètre(s) configuré(s) : modifiables en temps réel
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchSettings}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                    title={t("Rafraîchir")}
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* General Settings : inline editing */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-4 p-6 border-b border-white/5 bg-white/[0.02]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FCD116' + '20', border: '1px solid #FCD116' + '40' }}>
                        <Globe size={18} style={{ color: '#FCD116' }} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-white"><T>Informations Générales</T></p>
                        <p className="text-[10px] text-gray-500 mt-0.5"><T>Identité du site, contacts officiels et réseaux sociaux</T></p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-[#FCD116]" size={32} />
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {generalSettings.map(setting => {
                            const meta = KEY_META[setting.key]
                            const isEditing = editingKey === setting.key
                            return (
                                <div key={setting.key} className="px-6 py-4 hover:bg-white/[0.015] transition-colors group">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">
                                                {meta?.label || setting.key}
                                            </p>
                                            {isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    {meta?.type === 'color' ? (
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="color"
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                                                                title={meta?.label || setting.key}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#FCD116]/40 w-32"
                                                                title={t("Code couleur hex")}
                                                                placeholder={t("#FCD116")}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type={meta?.type || 'text'}
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            placeholder={meta?.placeholder}
                                                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(setting); if (e.key === 'Escape') cancelEdit() }}
                                                            autoFocus
                                                            title={meta?.label || setting.key}
                                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FCD116]/40 transition-colors"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => saveEdit(setting)}
                                                        disabled={saving}
                                                        title={t("Sauvegarder")}
                                                        className="p-2.5 rounded-xl bg-[#008751]/20 text-[#008751] hover:bg-[#008751]/30 transition-colors disabled:opacity-40"
                                                    >
                                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={cancelEdit}
                                                        title={t("Annuler")}
                                                        className="p-2.5 rounded-xl bg-white/5 text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {meta?.type === 'color' ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded-md border border-white/20 flex-shrink-0" style={{ backgroundColor: setting.value || '#FCD116' }} />
                                                            <span className="text-sm font-mono text-white/80">{setting.value || '-'}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-white/80 truncate max-w-xs">
                                                            {setting.value || <span className="text-gray-600 italic"><T>Non défini</T></span>}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {!isEditing && (
                                            <button
                                                type="button"
                                                onClick={() => startEdit(setting)}
                                                title={t("Modifier")}
                                                className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-600 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {generalSettings.length === 0 && !loading && (
                            <div className="p-12 text-center">
                                <Database size={32} className="mx-auto mb-3 text-gray-700" />
                                <p className="text-gray-500 text-sm"><T>Aucun paramètre général trouvé</T></p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Autres catégories avec données en DB (non general) */}
            {otherCategories.length > 0 && (
                <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Autres catégories en base</T></p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {otherCategories.map(cat => {
                            const meta = CATEGORY_META[cat]
                            const catSettings = settings.filter(s => s.category === cat)
                            const subPage = SUB_PAGE_CATEGORIES[cat]
                            if (subPage) return null // on affiche les shortcuts en bas
                            return (
                                <div key={cat} className="bg-[#0a0f18] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (meta?.color || '#FCD116') + '20' }}>
                                            <Database size={14} style={{ color: meta?.color || '#FCD116' }} />
                                        </div>
                                        <p className="text-xs font-black text-white uppercase tracking-wider">{meta?.label || cat}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {catSettings.slice(0, 4).map(s => (
                                            <div key={s.key} className="flex justify-between items-center text-xs">
                                                <span className="text-gray-500">{KEY_META[s.key]?.label || s.key}</span>
                                                <span className="text-white/60 font-mono truncate max-w-[140px]">{s.value || '-'}</span>
                                            </div>
                                        ))}
                                        {catSettings.length > 4 && (
                                            <p className="text-[10px] text-gray-600">+{catSettings.length - 4} autres...</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Shortcuts vers sous-pages dédiées */}
            <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Configurations avancées</T></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            href: '/admin/settings/email',
                            icon: Mail,
                            color: '#3b82f6',
                            title: 'Serveur d\'Emails (SMTP)',
                            desc: 'Configurez Gmail ou SMTP privé pour l\'envoi des notifications et factures.',
                        },
                        {
                            href: '/admin/settings/payment',
                            icon: CreditCard,
                            color: '#FCD116',
                            title: 'Passerelles de Paiement',
                            desc: 'Kkiapay, FedaPay, Zeyow, Stripe, PayPal : sandbox/production.',
                        },
                        {
                            href: '/admin/settings/mecef',
                            icon: ShieldCheck,
                            color: '#008751',
                            title: 'Normalisation e-MCF (DGI)',
                            desc: 'Jeton API, sandbox/production, opérateur : factures normalisées automatiquement.',
                        },
                        {
                            href: '/admin/settings/frontend',
                            icon: MonitorPlay,
                            color: '#a855f7',
                            title: 'Personnalisation Frontend',
                            desc: 'Vidéo d\'accueil, textes, navigation, identité visuelle publique.',
                            colSpan: 2,
                        },
                    ].map(({ href, icon: Icon, color, title, desc, colSpan }) => (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'group flex items-center justify-between gap-5 p-6 bg-[#0a0f18] border border-white/5 rounded-2xl transition-all hover:border-white/10',
                                colSpan === 2 ? 'md:col-span-2' : ''
                            )}
                            style={{ '--hover-color': color } as React.CSSProperties}
                        >
                            <div className="flex items-center gap-5">
                                <div
                                    className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105"
                                    style={{ backgroundColor: color + '15', border: `1px solid ${color}30` }}
                                >
                                    <Icon size={22} style={{ color }} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white">{title}</h3>
                                    <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs">{desc}</p>
                                </div>
                            </div>
                            <Settings size={18} className="text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" />
                        </Link>
                    ))}
                </div>
            </div>

            {/* Palette d'identité */}
            {generalSettings.length > 0 && (
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <Palette size={16} className="text-[#FCD116]" />
                        <p className="text-xs font-black text-white uppercase tracking-wider"><T>Aperçu Identité Visuelle</T></p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Logo */}
                        {generalSettings.find(s => s.key === 'logo_url')?.value && (
                            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={generalSettings.find(s => s.key === 'logo_url')?.value}
                                    alt={t("Logo")}
                                    className="w-10 h-10 object-contain"
                                />
                            </div>
                        )}
                        {/* Couleurs */}
                        <div className="flex items-center gap-2">
                            {['primary_color'].map(key => {
                                const s = generalSettings.find(x => x.key === key)
                                if (!s?.value) return null
                                return (
                                    <div key={key} className="text-center">
                                        <div className="w-10 h-10 rounded-xl border border-white/20" style={{ backgroundColor: s.value }} />
                                        <p className="text-[9px] text-gray-600 font-mono mt-1">{s.value}</p>
                                    </div>
                                )
                            })}
                            {/* Couleurs Bénin fixes */}
                            {['#FCD116', '#008751', '#E8112D'].map(c => (
                                <div key={c} className="text-center">
                                    <div className="w-10 h-10 rounded-xl border border-white/20 opacity-40" style={{ backgroundColor: c }} />
                                    <p className="text-[9px] text-gray-600 font-mono mt-1">{c}</p>
                                </div>
                            ))}
                        </div>
                        {/* Site title + slogan */}
                        <div className="ml-2">
                            <p className="text-sm font-black text-white">
                                {generalSettings.find(s => s.key === 'site_title')?.value || 'Retour Gagnant'}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs truncate">
                                {generalSettings.find(s => s.key === 'site_slogan')?.value || ''}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
