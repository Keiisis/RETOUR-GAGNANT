'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LockOpen as Unlock, ShieldCheck, Warning as AlertTriangle, CheckCircle as CheckCircle2, X } from '@phosphor-icons/react';

export interface ClotureRow {
    id: string
    periode: string
    date_cloture: string
    cloture_par_nom: string | null
    total_encaisse: number
    total_depenses: number
    total_tva: number
    benefice_net: number
    total_commissions?: number | null
    benefice_net_final?: number | null
    nb_documents: number
    nb_paiements: number
    nb_depenses: number
    notes: string | null
    hash_integrite: string | null
    status?: string | null              // 'closed' | 'reopened'
    reopened_at?: string | null
    reopened_par_nom?: string | null
    reopen_count?: number | null
}

interface Props {
    /** Période actuellement sélectionnée (ex: '2026-04') */
    currentPeriod: string
    /** true si c'est un mois précis (format YYYY-MM), false sinon */
    isMonthPeriod: boolean
    /** Libellé lisible de la période */
    periodLabel: string
    /** Liste des clôtures mensuelles (de l'API /api/admin/comptabilite) */
    clotures: ClotureRow[]
    /** Totaux calculés pour la période (affichés dans le modal de confirmation) */
    snapshot: {
        totalEncaisse: number
        totalDepenses: number
        beneficeNet: number
        nbDocuments: number
        nbPaiements: number
        nbDepenses: number
    }
    /** Callback appelé après clôture/réouverture réussie (pour refetch) */
    onChange: () => void
    /** Formateur de montants */
    fmt: (n: number) => string
}

export default function ComptaLockPanel({
    currentPeriod, isMonthPeriod, periodLabel, clotures, snapshot, onChange, fmt,
}: Props) {
    const [showConfirm, setShowConfirm] = useState(false)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const cloture = clotures.find(c => c.periode === currentPeriod)
    const isReopened = !!cloture && (cloture.status ?? 'closed') === 'reopened'
    const isLocked = !!cloture && !isReopened
    const canClose = isMonthPeriod && !isLocked         // inclut la re-clôture d'une période rouverte
    const canReopen = isMonthPeriod && isLocked

    const doClose = async () => {
        setSaving(true); setError(null)
        try {
            const res = await fetch('/api/admin/comptabilite/cloture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ periode: currentPeriod, notes: notes || null }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || 'Erreur lors de la clôture')
            setShowConfirm(false)
            setNotes('')
            onChange()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setSaving(false)
        }
    }

    const doReopen = async () => {
        if (!confirm(`Rouvrir la période ${periodLabel} ?\n\nLe verrou est levé et les modifications redeviennent possibles. Le snapshot et le hash d'origine sont conservés ; la réouverture est tracée dans le journal d'audit.`)) return
        setSaving(true); setError(null)
        try {
            const res = await fetch(`/api/admin/comptabilite/cloture?periode=${currentPeriod}`, { method: 'DELETE' })
            const body = await res.json()
            if (!res.ok) throw new Error(body.error || 'Erreur lors de la réouverture')
            onChange()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setSaving(false)
        }
    }

    if (!isMonthPeriod && !isLocked) return null

    return (
        <>
            {/* Bandeau verrou si période clôturée */}
            {isLocked && cloture && (
                <div className="bg-gradient-to-r from-[#008751]/15 via-[#008751]/10 to-transparent border border-[#008751]/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#008751]/25 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-6 h-6 text-[#00c870]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#00c870]">Période clôturée & verrouillée</p>
                            <p className="text-white font-black mt-0.5">{periodLabel}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                Clôturée le {new Date(cloture.date_cloture).toLocaleString('fr-FR')}
                                {cloture.cloture_par_nom ? ` par ${cloture.cloture_par_nom}` : ''}
                                {' · '}Hash {cloture.hash_integrite?.slice(0, 10)}…
                            </p>
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 md:grid-cols-5 gap-3 text-[10px]">
                        <div><p className="text-gray-500">Encaissé</p><p className="text-white font-bold text-xs">{fmt(cloture.total_encaisse)}</p></div>
                        <div><p className="text-gray-500">Dépenses</p><p className="text-red-400 font-bold text-xs">{fmt(cloture.total_depenses)}</p></div>
                        <div><p className="text-gray-500">Bénéfice net</p><p className={`font-bold text-xs ${cloture.benefice_net >= 0 ? 'text-[#00c870]' : 'text-red-400'}`}>{fmt(cloture.benefice_net)}</p></div>
                        {cloture.total_commissions != null && (
                            <div><p className="text-gray-500">Commissions</p><p className="text-[#C9A84C] font-bold text-xs">− {fmt(cloture.total_commissions)}</p></div>
                        )}
                        {cloture.benefice_net_final != null && (
                            <div><p className="text-gray-500">Net final</p><p className={`font-bold text-xs ${cloture.benefice_net_final >= 0 ? 'text-[#00c870]' : 'text-red-400'}`}>{fmt(cloture.benefice_net_final)}</p></div>
                        )}
                    </div>
                    {canReopen && (
                        <button
                            type="button"
                            onClick={doReopen}
                            disabled={saving}
                            className="flex items-center gap-2 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 font-bold text-[11px] px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
                        >
                            <Unlock size={12} /> Rouvrir
                        </button>
                    )}
                </div>
            )}

            {/* Bandeau période ROUVERTE (verrou levé, en attente de reclôture) */}
            {isReopened && cloture && (
                <div className="bg-gradient-to-r from-[#E8112D]/15 via-[#E8112D]/8 to-transparent border border-[#E8112D]/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center gap-4 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#E8112D]/20 flex items-center justify-center shrink-0">
                            <Unlock className="w-6 h-6 text-[#E8112D]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E8112D]">Période rouverte : verrou levé</p>
                            <p className="text-white font-black mt-0.5">{periodLabel}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                Rouverte{cloture.reopened_at ? ` le ${new Date(cloture.reopened_at).toLocaleString('fr-FR')}` : ''}
                                {cloture.reopened_par_nom ? ` par ${cloture.reopened_par_nom}` : ''}
                                {cloture.reopen_count ? ` · ${cloture.reopen_count} réouverture${cloture.reopen_count > 1 ? 's' : ''}` : ''}
                                {' · '}Reclôturez après vérification (l\'écart de hash sera tracé).
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Bouton clôturer / reclôturer (période non verrouillée) */}
            {canClose && (
                <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FCD116]/15 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-[#FCD116]" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{isReopened ? 'Reclôture mensuelle' : 'Clôture mensuelle'}</p>
                        <p className="text-white text-sm mt-0.5">
                            {isReopened ? 'Refermer' : 'Verrouiller'} <strong>{periodLabel}</strong> après {isReopened ? 'vérification des corrections' : 'exportation du rapport comptable'}.
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                            Plus aucune écriture (paiement, dépense, facture) ne pourra être modifiée pour ce mois.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        className="flex items-center gap-2 bg-[#FCD116] text-[#0a0f18] hover:bg-[#e6bc00] font-black text-[11px] px-4 py-2.5 rounded-xl transition-all"
                    >
                        <Lock size={12} /> {isReopened ? 'Reclôturer la période' : 'Clôturer la période'}
                    </button>
                </div>
            )}

            {/* Modal confirmation */}
            <AnimatePresence>
                {showConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => !saving && setShowConfirm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
                            className="bg-[#0a0f18] border border-white/10 rounded-2xl p-6 max-w-xl w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-[#FCD116]/15 flex items-center justify-center">
                                        <AlertTriangle className="w-6 h-6 text-[#FCD116]" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white">Clôturer {periodLabel} ?</h3>
                                        <p className="text-[11px] text-gray-500 mt-0.5">Cette action est réversible mais tracée.</p>
                                    </div>
                                </div>
                                <button type="button" title="Fermer" onClick={() => !saving && setShowConfirm(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                                <div><p className="text-gray-500">Documents</p><p className="text-white font-bold">{snapshot.nbDocuments}</p></div>
                                <div><p className="text-gray-500">Paiements</p><p className="text-white font-bold">{snapshot.nbPaiements}</p></div>
                                <div><p className="text-gray-500">Dépenses</p><p className="text-white font-bold">{snapshot.nbDepenses}</p></div>
                                <div><p className="text-gray-500">Encaissé</p><p className="text-[#00c870] font-bold">{fmt(snapshot.totalEncaisse)}</p></div>
                                <div><p className="text-gray-500">Dépenses</p><p className="text-red-400 font-bold">{fmt(snapshot.totalDepenses)}</p></div>
                                <div><p className="text-gray-500">Bénéfice net</p><p className={`font-bold ${snapshot.beneficeNet >= 0 ? 'text-[#00c870]' : 'text-red-400'}`}>{fmt(snapshot.beneficeNet)}</p></div>
                            </div>

                            <label className="block mb-4">
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1.5">Notes (optionnel)</span>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Rapport transmis au comptable le…, fichier archivé dans…"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#FCD116]/50 resize-none"
                                />
                            </label>

                            <div className="bg-[#FCD116]/5 border border-[#FCD116]/20 rounded-xl p-3 mb-4 flex gap-2">
                                <AlertTriangle size={14} className="text-[#FCD116] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-300 leading-relaxed">
                                    Après clôture, toute tentative de modification (ajout de paiement, édition de facture, suppression de dépense)
                                    <strong className="text-white"> sur ce mois </strong>
                                    sera <strong className="text-[#FCD116]">refusée</strong> par la base de données.
                                    Un snapshot SHA-256 sera calculé pour détecter toute altération ultérieure.
                                </p>
                            </div>

                            {error && (
                                <p className="text-xs text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowConfirm(false)} disabled={saving}
                                    className="flex-1 bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
                                    Annuler
                                </button>
                                <button type="button" onClick={doClose} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 bg-[#FCD116] text-[#0a0f18] hover:bg-[#e6bc00] font-black text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
                                    {saving ? (
                                        <div className="w-3.5 h-3.5 border-2 border-[#0a0f18] border-t-transparent rounded-full animate-spin" />
                                    ) : <CheckCircle2 size={14} />}
                                    Confirmer la clôture
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
