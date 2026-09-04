'use client'

// ══════════════════════════════════════════════════════════════
//  Choisir LA facture qui correspond à un dossier saisi à la main.
//
//  Tant qu'aucune facture n'est rattachée, le dossier n'est pas réputé payé et
//  n'entre pas dans les recettes. Ce n'est pas une formalité : c'est la pièce
//  qui prouve l'encaissement.
//
//  Réutilisable pour les deux natures : `recap` et `dossier`.
// ══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CircleNotch, Receipt, MagnifyingGlass, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { formatMontant } from '@/lib/currency-format'

interface Facture {
    id: string
    numero: string
    client_nom: string | null
    client_prenom: string | null
    client_email: string | null
    total: number
    currency: string | null
    statut: string | null
    created_at: string
    suggeree?: boolean
}

interface Props {
    ouvert: boolean
    nature: 'recap' | 'dossier'
    dossierId: string
    /** Adresse du client : sert à faire remonter les factures probables. */
    email?: string | null
    onFermer: () => void
    onRattache: (facture: Facture) => void
}

export default function RattacherFacture({
    ouvert, nature, dossierId, email, onFermer, onRattache,
}: Props) {
    const [factures, setFactures] = useState<Facture[]>([])
    const [chargement, setChargement] = useState(false)
    const [recherche, setRecherche] = useState('')
    const [erreur, setErreur] = useState('')
    const [migration, setMigration] = useState(false)
    const [enCours, setEnCours] = useState<string | null>(null)

    const charger = useCallback(async (q: string) => {
        setChargement(true); setErreur('')
        try {
            const p = new URLSearchParams()
            if (email) p.set('email', email)
            if (q) p.set('q', q)
            const res = await fetch(`/api/admin/rattacher-facture?${p}`)
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || 'Chargement impossible.')
            setFactures(Array.isArray(json.factures) ? json.factures : [])
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Chargement impossible.')
        } finally { setChargement(false) }
    }, [email])

    useEffect(() => { if (ouvert) charger('') }, [ouvert, charger])

    const rattacher = async (f: Facture) => {
        setEnCours(f.id); setErreur(''); setMigration(false)
        try {
            const res = await fetch('/api/admin/rattacher-facture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nature, id: dossierId, facture_id: f.id }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setMigration(!!json.migration_requise); throw new Error(json.error || 'Rattachement impossible.') }
            onRattache(f)
            onFermer()
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Rattachement impossible.')
        } finally { setEnCours(null) }
    }

    return (
        <AnimatePresence>
            {ouvert && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[60] backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
                    style={{ background: 'color-mix(in srgb, var(--panel-bg) 78%, transparent)' }}
                    onClick={onFermer}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-xl rounded-3xl border shadow-2xl flex flex-col max-h-[88vh]"
                        style={{ background: 'var(--panel-surface)', borderColor: 'var(--panel-border)' }}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b shrink-0"
                            style={{ borderColor: 'var(--panel-border)' }}>
                            <div>
                                <h3 className="text-lg font-black" style={{ color: 'var(--panel-text-heading)' }}>
                                    Confirmer le paiement
                                </h3>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--panel-text-muted)' }}>
                                    Choisissez la facture émise qui correspond à ce client. Sans elle, le
                                    dossier n’entre pas dans les recettes.
                                </p>
                            </div>
                            <button type="button" onClick={onFermer} title="Fermer"
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'var(--panel-surface-hover)', color: 'var(--panel-text-muted)' }}>
                                <X size={16} />
                            </button>
                        </div>

                        <div className="px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
                            <div className="relative">
                                <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--panel-text-faint)' }} />
                                <input
                                    value={recherche}
                                    onChange={e => { setRecherche(e.target.value); charger(e.target.value) }}
                                    placeholder="Numéro, nom ou e-mail…"
                                    className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none border focus:border-emerald-500/60"
                                    style={{
                                        background: 'var(--panel-surface-alt)',
                                        borderColor: 'var(--panel-border)',
                                        color: 'var(--panel-text)',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="overflow-y-auto min-h-0 flex-1 p-4 space-y-2">
                            {chargement ? (
                                <div className="flex justify-center py-10">
                                    <CircleNotch size={22} className="text-emerald-500 animate-spin" />
                                </div>
                            ) : factures.length === 0 ? (
                                <p className="text-center py-10 text-sm" style={{ color: 'var(--panel-text-muted)' }}>
                                    Aucune facture émise ne correspond.
                                </p>
                            ) : factures.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => rattacher(f)}
                                    disabled={!!enCours}
                                    className="w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition-colors disabled:opacity-50"
                                    style={{
                                        background: f.suggeree ? 'rgba(16,185,129,0.08)' : 'var(--panel-surface-alt)',
                                        borderColor: f.suggeree ? 'rgba(16,185,129,0.35)' : 'var(--panel-border)',
                                    }}
                                >
                                    <Receipt size={16} className="shrink-0 text-emerald-500" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-black" style={{ color: 'var(--panel-text-heading)' }}>
                                                {f.numero}
                                            </span>
                                            {f.suggeree && (
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                                                    Même e-mail
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] truncate" style={{ color: 'var(--panel-text-muted)' }}>
                                            {[f.client_prenom, f.client_nom].filter(Boolean).join(' ') || '—'}
                                            {f.client_email ? ` · ${f.client_email}` : ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black font-mono" style={{ color: 'var(--panel-text-heading)' }}>
                                            {formatMontant(Number(f.total) || 0, f.currency)}
                                        </p>
                                        <p className="text-[10px]" style={{ color: 'var(--panel-text-faint)' }}>{f.statut || '—'}</p>
                                    </div>
                                    {enCours === f.id
                                        ? <CircleNotch size={16} className="animate-spin text-emerald-500 shrink-0" />
                                        : <CheckCircle size={16} className="shrink-0" style={{ color: 'var(--panel-text-faint)' }} />}
                                </button>
                            ))}
                        </div>

                        {erreur && (
                            <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--panel-border)' }}>
                                <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                                    <WarningCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-300">
                                        {erreur}
                                        {migration && (
                                            <> Exécutez <code className="font-mono">20260904_rattachement_facture.sql</code> dans Supabase.</>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
