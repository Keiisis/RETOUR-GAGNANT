'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
    PenLine, Trash2, CheckCircle2, AlertCircle, Loader2,
    Shield, Zap, Bell, BellOff, Info, Clock,
    FileText, FileSignature, History, Settings2,
    ChevronRight, RefreshCw, Lock
} from 'lucide-react'
import SignaturePad from '@/components/client/SignaturePad'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type AutoSign = 'ask' | 'auto' | 'never'

interface SignatureRecord {
    id: string
    client_id: string
    signature_data: string
    auto_sign: AutoSign
    created_at: string
    updated_at: string
}

interface Toast { id: number; type: 'success' | 'error' | 'info'; msg: string }

// ─── Auto-sign options ────────────────────────────────────────────────────────

const AUTO_SIGN_OPTIONS: { value: AutoSign; label: string; desc: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }[] = [
    {
        value: 'ask',
        label: 'Me demander à chaque fois',
        desc: 'Une confirmation vous sera demandée avant chaque apposition',
        icon: Bell,
        color: 'text-[#FCD116]',
    },
    {
        value: 'auto',
        label: 'Apposer automatiquement',
        desc: 'Votre signature est apposée dès que vous approuvez un document',
        icon: Zap,
        color: 'text-[#008751]',
    },
    {
        value: 'never',
        label: 'Ne jamais signer automatiquement',
        desc: 'Votre signature ne sera jamais apposée sur les documents',
        icon: BellOff,
        color: 'text-gray-400',
    },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClientSignaturePage() {
    const [signature, setSignature] = useState<SignatureRecord | null>(null)
    const [loading, setLoading]     = useState(true)
    const [saving, setSaving]       = useState(false)
    const [deleting, setDeleting]   = useState(false)
    const [toasts, setToasts]       = useState<Toast[]>([])
    const [tab, setTab]             = useState<'signature' | 'settings' | 'history'>('signature')
    const [showDraw, setShowDraw]   = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [autoSign, setAutoSign]   = useState<AutoSign>('ask')
    const [savingSettings, setSavingSettings] = useState(false)

    const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
        const id = Date.now()
        setToasts(p => [...p, { id, type, msg }])
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500)
    }, [])

    const fetchSignature = useCallback(async () => {
        setLoading(true)
        try {
            const res  = await fetch('/api/client/signature')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSignature(data.signature)
            if (data.signature) setAutoSign(data.signature.auto_sign || 'ask')
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur de chargement', 'error')
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { fetchSignature() }, [fetchSignature])

    // Save drawn signature
    const handleSave = async (dataUrl: string) => {
        setSaving(true)
        try {
            const res = await fetch('/api/client/signature', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signature_data: dataUrl, auto_sign: autoSign }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSignature(data.signature)
            setShowDraw(false)
            toast('✓ Signature enregistrée avec succès')
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement', 'error')
        } finally {
            setSaving(false)
        }
    }

    // Save settings only
    const handleSaveSettings = async () => {
        setSavingSettings(true)
        try {
            const res = await fetch('/api/client/signature', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_sign: autoSign }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSignature(p => p ? { ...p, auto_sign: data.signature.auto_sign } : null)
            toast('Préférences mises à jour')
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur', 'error')
        } finally {
            setSavingSettings(false)
        }
    }

    // Delete signature
    const handleDelete = async () => {
        setDeleting(true)
        try {
            const res = await fetch('/api/client/signature', { method: 'DELETE' })
            if (!res.ok) throw new Error((await res.json()).error)
            setSignature(null)
            setConfirmDelete(false)
            setShowDraw(false)
            toast('Signature supprimée')
        } catch (e) {
            toast(e instanceof Error ? e.message : 'Erreur', 'error')
        } finally {
            setDeleting(false)
        }
    }

    const fmtDate = (iso: string) => {
        const d = new Date(iso)
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            {/* Toasts */}
            <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 pointer-events-none">
                <AnimatePresence>
                    {toasts.map(t => (
                        <motion.div key={t.id}
                            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                            className={cn(
                                'px-4 py-3 rounded-2xl text-sm font-bold shadow-2xl',
                                t.type === 'success' ? 'bg-[#008751] text-white' :
                                t.type === 'error'   ? 'bg-red-500 text-white' :
                                'bg-[#1a2332] text-white border border-white/10'
                            )}
                        >
                            {t.msg}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#008751] to-[#FCD116] flex items-center justify-center shadow-lg">
                            <FileSignature size={16} className="text-white" />
                        </div>
                        <h1 className="text-2xl font-black text-white">Ma Signature</h1>
                    </div>
                    <p className="text-[13px] text-gray-500 ml-10">
                        Apposée automatiquement sur vos devis et factures approuvés
                    </p>
                </div>
                <button type="button" onClick={fetchSignature} title="Actualiser"
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-gray-500 hover:text-white transition-all flex-shrink-0">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ── Security notice ── */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/[0.06] border border-blue-500/15 rounded-2xl">
                <Lock size={15} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-blue-300/80 leading-relaxed">
                    Votre signature est <strong>chiffrée et stockée de façon sécurisée</strong>. Elle ne sera jamais partagée
                    et ne sera apposée que sur des documents dont vous avez explicitement confirmé l&apos;approbation.
                </p>
            </div>

            {/* ── Tabs ── */}
            <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 gap-1">
                {([
                    { key: 'signature', label: 'Ma Signature', icon: PenLine },
                    { key: 'settings',  label: 'Préférences', icon: Settings2 },
                    { key: 'history',   label: 'Historique',  icon: History },
                ] as const).map(t => (
                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all',
                            tab === t.key
                                ? 'bg-[#1a2332] text-white shadow-sm border border-white/[0.08]'
                                : 'text-gray-500 hover:text-gray-300'
                        )}>
                        <t.icon size={13} />
                        <span className="hidden sm:inline">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab: Signature ── */}
            {tab === 'signature' && (
                <AnimatePresence mode="wait">
                    <motion.div key="sig-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 size={24} className="animate-spin text-[#008751]" />
                            </div>
                        ) : signature ? (
                            /* ── Signature EXISTS ── */
                            <div className="space-y-4">
                                {/* Display card */}
                                <div className="bg-[#0d1220] border border-white/[0.07] rounded-2xl overflow-hidden">
                                    {/* Cover */}
                                    <div className="relative h-36 bg-white flex items-center justify-center p-4">
                                        <Image
                                            src={signature.signature_data}
                                            alt="Ma signature"
                                            fill
                                            className="object-contain p-3"
                                            unoptimized
                                        />
                                        {/* Status badge */}
                                        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-[#008751] rounded-full shadow-md">
                                            <CheckCircle2 size={10} className="text-white" />
                                            <span className="text-[9px] font-black text-white uppercase tracking-wider">Enregistrée</span>
                                        </div>
                                    </div>
                                    {/* Info footer */}
                                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-white font-bold text-[13px]">Signature active</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Clock size={10} className="text-gray-500" />
                                                <p className="text-[11px] text-gray-500">
                                                    {signature.updated_at !== signature.created_at ? 'Mise à jour' : 'Créée'} le {fmtDate(signature.updated_at || signature.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold',
                                                signature.auto_sign === 'auto'  ? 'bg-[#008751]/10 border-[#008751]/20 text-[#008751]' :
                                                signature.auto_sign === 'never' ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' :
                                                'bg-[#FCD116]/10 border-[#FCD116]/20 text-[#FCD116]'
                                            )}>
                                                {signature.auto_sign === 'auto'  ? <Zap size={10} />  :
                                                 signature.auto_sign === 'never' ? <BellOff size={10} /> : <Bell size={10} />}
                                                {signature.auto_sign === 'auto'  ? 'Automatique' :
                                                 signature.auto_sign === 'never' ? 'Désactivée'  : 'Sur demande'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => setShowDraw(!showDraw)}
                                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/[0.08] text-gray-300 hover:text-white hover:bg-white/10 transition-all text-[13px] font-bold">
                                        <PenLine size={15} />
                                        Modifier la signature
                                    </button>
                                    <button type="button" onClick={() => setConfirmDelete(true)}
                                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-all text-[13px] font-bold">
                                        <Trash2 size={15} />
                                        Supprimer
                                    </button>
                                </div>

                                {/* Redraw pad */}
                                <AnimatePresence>
                                    {showDraw && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
                                        >
                                            <div className="bg-[#0d1220] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                                                <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Nouvelle signature</p>
                                                {saving ? (
                                                    <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
                                                        <Loader2 size={18} className="animate-spin text-[#008751]" />
                                                        <span className="text-sm">Enregistrement...</span>
                                                    </div>
                                                ) : (
                                                    <SignaturePad onSave={handleSave} />
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            /* ── No signature yet ── */
                            <div className="space-y-4">
                                {/* Empty state */}
                                <div className="bg-[#0d1220] border-2 border-dashed border-white/[0.06] rounded-2xl p-8 text-center space-y-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#008751]/20 to-[#FCD116]/10 border border-[#008751]/20 flex items-center justify-center mx-auto">
                                        <FileSignature size={28} className="text-[#008751]" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-lg mb-1">Aucune signature enregistrée</h3>
                                        <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
                                            Dessinez votre signature une seule fois. Elle sera apposée automatiquement sur vos documents officiels.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mt-4">
                                        {[
                                            { icon: Shield,      title: 'Sécurisée',       desc: 'Chiffrée et protégée' },
                                            { icon: Zap,         title: 'Automatique',     desc: 'Sur chaque document approuvé' },
                                            { icon: CheckCircle2, title: 'Légale',         desc: 'Valeur probatoire complète' },
                                        ].map(f => (
                                            <div key={f.title} className="flex items-start gap-2.5 p-3 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                                                <f.icon size={14} className="text-[#008751] mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-white font-bold text-[12px]">{f.title}</p>
                                                    <p className="text-gray-500 text-[10px]">{f.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Draw pad */}
                                <div className="bg-[#0d1220] border border-white/[0.07] rounded-2xl p-5 space-y-3">
                                    <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Créez votre signature</p>
                                    {saving ? (
                                        <div className="flex items-center justify-center h-40 gap-3 text-gray-400">
                                            <Loader2 size={18} className="animate-spin text-[#008751]" />
                                            <span className="text-sm">Enregistrement...</span>
                                        </div>
                                    ) : (
                                        <SignaturePad onSave={handleSave} />
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            )}

            {/* ── Tab: Settings ── */}
            {tab === 'settings' && (
                <AnimatePresence mode="wait">
                    <motion.div key="settings-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                        {!signature ? (
                            <div className="flex items-center gap-3 p-4 bg-orange-500/[0.06] border border-orange-500/15 rounded-2xl">
                                <AlertCircle size={15} className="text-orange-400 flex-shrink-0" />
                                <p className="text-[12px] text-orange-300/80">
                                    Ces préférences s&apos;activent une fois que vous avez enregistré une signature.
                                </p>
                            </div>
                        ) : null}

                        <div className="bg-[#0d1220] border border-white/[0.07] rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/[0.05]">
                                <h3 className="text-white font-black text-[14px]">Comportement à l&apos;approbation</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">Que faire quand vous approuvez un document ?</p>
                            </div>
                            <div className="p-3 space-y-2">
                                {AUTO_SIGN_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setAutoSign(opt.value)}
                                        className={cn(
                                            'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                                            autoSign === opt.value
                                                ? 'bg-white/[0.06] border-white/15'
                                                : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                                        )}>
                                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                            autoSign === opt.value ? 'bg-white/10' : 'bg-white/[0.04]')}>
                                            <opt.icon size={18} className={autoSign === opt.value ? opt.color : 'text-gray-600'} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn('font-bold text-[13px]', autoSign === opt.value ? 'text-white' : 'text-gray-400')}>
                                                {opt.label}
                                            </p>
                                            <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">{opt.desc}</p>
                                        </div>
                                        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                            autoSign === opt.value ? 'border-[#008751] bg-[#008751]' : 'border-gray-700')}>
                                            {autoSign === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button type="button" onClick={handleSaveSettings} disabled={savingSettings || !signature}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#008751] text-white font-black text-[13px] hover:bg-[#006e42] transition-all disabled:opacity-40 shadow-lg shadow-[#008751]/10">
                            {savingSettings ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                            Enregistrer les préférences
                        </button>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* ── Tab: History ── */}
            {tab === 'history' && (
                <AnimatePresence mode="wait">
                    <motion.div key="history-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <div className="bg-[#0d1220] border border-white/[0.07] rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-3">
                                <History size={16} className="text-[#008751]" />
                                <h3 className="text-white font-black text-[14px]">Utilisation de la signature</h3>
                            </div>
                            <div className="p-5 flex flex-col items-center gap-4 text-center py-12">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center">
                                    <FileText size={20} className="text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-gray-400 font-bold text-sm">Historique disponible prochainement</p>
                                    <p className="text-gray-600 text-[12px] mt-1">
                                        Vous verrez ici la liste de tous les documents sur lesquels votre signature a été apposée.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}

            {/* ── Delete Confirm Modal ── */}
            <AnimatePresence>
                {confirmDelete && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm"
                            onClick={() => setConfirmDelete(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 16 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-[#0d1220] border border-red-500/20 rounded-[24px] p-6 max-w-sm w-full shadow-2xl pointer-events-auto"
                                onClick={e => e.stopPropagation()}>
                                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={24} className="text-red-400" />
                                </div>
                                <h3 className="text-white font-black text-center text-base mb-2">Supprimer ma signature ?</h3>
                                <p className="text-gray-500 text-center text-[13px] mb-6 leading-relaxed">
                                    Cette action est irréversible. Votre signature sera supprimée définitivement et ne sera plus apposée sur vos documents.
                                </p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setConfirmDelete(false)}
                                        className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 hover:text-white transition-all font-bold text-sm">
                                        Annuler
                                    </button>
                                    <button type="button" onClick={handleDelete} disabled={deleting}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500 text-white font-black text-sm hover:bg-red-600 transition-all disabled:opacity-50">
                                        {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                        Supprimer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
