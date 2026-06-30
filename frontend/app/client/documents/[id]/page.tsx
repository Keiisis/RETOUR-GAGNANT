'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, FileText, Receipt, ExternalLink, Download, PenTool,
    CreditCard, CheckCircle2, Clock, AlertCircle, Shield, Zap, BellOff,
    X, Pen, AlertTriangle
} from 'lucide-react'
import Image from 'next/image'

interface Doc {
    id: string
    type: 'devis' | 'facture'
    numero: string
    client_nom: string
    client_prenom: string
    client_email: string
    items: any[]
    sous_total: number
    total_tva: number
    remise: number
    total: number
    status: string
    currency: string
    notes: string
    conditions: string
    validite: string
    created_at: string
    signature_url?: string
    signed_at?: string
    parent_devis_id?: string
}

interface ClientSignature {
    id: string
    client_id: string
    signature_data: string
    auto_sign: 'ask' | 'auto' | 'never'
    created_at: string
    updated_at: string
}

const STATUS = {
    brouillon: { label: 'Brouillon', cls: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
    envoye: { label: 'En attente de signature', cls: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    accepte: { label: 'Signé & Accepté', cls: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    refuse: { label: 'Refusé', cls: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    paye: { label: 'Payé', cls: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    en_retard: { label: 'En retard', cls: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    annule: { label: 'Annulé', cls: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
}

const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Safe date formatter to avoid RangeError: Invalid time value
const formatDateSafe = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', options)
}


// ─── Signature Authorization Modal ────────────────────────────────────────────
function SignatureAuthModal({
    docId,
    docNumero,
    signature,
    onClose,
}: {
    docId: string
    docNumero: string
    signature: ClientSignature
    onClose: () => void
}) {
    const proceed = (withSignature: boolean) => {
        const url = `/portail/${docId}${withSignature ? '?sign=1' : ''}`
        window.open(url, '_blank')
        onClose()
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="bg-[#0a1221] border border-white/[0.08] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-white/[0.06] flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                            <Pen size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-sm">Apposer votre signature ?</h2>
                            <p className="text-gray-500 text-[11px] mt-0.5">{docNumero}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} title="Fermer" className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-white transition-all flex-shrink-0">
                        <X size={15} />
                    </button>
                </div>

                {/* Signature preview */}
                <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-white">
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
                            <Shield size={11} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Votre signature enregistrée</span>
                        </div>
                        <div className="relative h-[100px] flex items-center justify-center p-3">
                            <Image
                                src={signature.signature_data}
                                alt="Votre signature"
                                fill
                                className="object-contain p-3"
                                unoptimized
                            />
                        </div>
                    </div>

                    <p className="text-[12px] text-gray-400 leading-relaxed">
                        Votre signature sera apposée électroniquement sur le devis <span className="text-white font-bold">{docNumero}</span>.
                        Cette action a valeur de consentement et d&apos;engagement contractuel.
                    </p>

                    {/* Actions */}
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => proceed(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[13px] transition-all shadow-lg shadow-emerald-500/20"
                        >
                            <CheckCircle2 size={16} />
                            Signer avec ma signature
                        </button>
                        <button
                            type="button"
                            onClick={() => proceed(false)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-gray-400 hover:text-white font-semibold text-[12px] transition-all"
                        >
                            <ExternalLink size={13} />
                            Continuer sans signature
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2 text-gray-600 hover:text-gray-400 text-[11px] font-semibold transition-colors"
                        >
                            Annuler
                        </button>
                    </div>

                    {/* Auto-sign hint */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-600 leading-relaxed">
                            Vous pouvez modifier ce comportement dans{' '}
                            <Link href="/client/signature" className="text-blue-400 hover:underline" onClick={onClose}>
                                Ma Signature → Préférences
                            </Link>
                            {' '}pour signer automatiquement ou ne jamais signer.
                        </p>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── No Signature Prompt Modal ────────────────────────────────────────────────
function NoSignatureModal({ docId, onClose }: { docId: string; onClose: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                className="bg-[#0a1221] border border-white/[0.08] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto">
                        <Pen size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-black text-base">Aucune signature enregistrée</h2>
                        <p className="text-gray-500 text-[12px] mt-1.5 leading-relaxed">
                            Enregistrez votre signature dans votre espace pour la apposer automatiquement sur vos documents.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Link
                            href="/client/signature"
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-[13px] transition-all"
                        >
                            <Pen size={14} />
                            Créer ma signature
                        </Link>
                        <button
                            type="button"
                            onClick={() => { window.open(`/portail/${docId}`, '_blank'); onClose() }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-gray-400 hover:text-white font-semibold text-[12px] transition-all"
                        >
                            <ExternalLink size={13} />
                            Signer sans signature enregistrée
                        </button>
                        <button type="button" onClick={onClose} className="w-full py-2 text-gray-600 hover:text-gray-400 text-[11px] font-semibold transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ClientDocumentDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [doc, setDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [clientSignature, setClientSignature] = useState<ClientSignature | null>(null)
    const [sigLoaded, setSigLoaded] = useState(false)
    const [modal, setModal] = useState<'auth' | 'no-sig' | null>(null)

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const email = session.user.email || ''

            const { data } = await supabase
                .from('documents_financiers')
                .select('*')
                .eq('id', id)
                .or(`client_id.eq.${session.user.id},client_email.eq.${email}`)
                .single()

            setDoc(data as Doc)
            setLoading(false)
        }
        load()
    }, [id])

    // Load client signature
    useEffect(() => {
        const loadSignature = async () => {
            try {
                const res = await fetch('/api/client/signature')
                if (res.ok) {
                    const json = await res.json()
                    setClientSignature(json.signature || null)
                }
            } catch {
                // signature unavailable — not critical
            } finally {
                setSigLoaded(true)
            }
        }
        loadSignature()
    }, [])

    const handleSignClick = useCallback(() => {
        if (!sigLoaded) return

        if (!clientSignature) {
            // No signature registered — offer to create or proceed without
            setModal('no-sig')
            return
        }

        const pref = clientSignature.auto_sign
        if (pref === 'auto') {
            // Automatic: open portal directly with sign flag
            window.open(`/portail/${doc?.id}?sign=1`, '_blank')
            return
        }
        if (pref === 'never') {
            // Never sign automatically: open portal without signature
            window.open(`/portail/${doc?.id}`, '_blank')
            return
        }
        // Default 'ask': show authorization modal
        setModal('auth')
    }, [sigLoaded, clientSignature, doc?.id])

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-7 h-7 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
    )

    if (!doc) return (
        <div className="text-center py-20">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-white font-bold">Document introuvable</p>
            <Link href="/client/documents" className="text-blue-400 text-sm mt-2 inline-flex items-center gap-1 hover:text-blue-300">
                <ArrowLeft size={14} /> Retour aux documents
            </Link>
        </div>
    )

    const s = STATUS[doc.status as keyof typeof STATUS] || { label: doc.status, cls: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' }
    const canSign = doc.type === 'devis' && doc.status === 'envoye'
    const canPay = doc.type === 'facture' && doc.status === 'envoye'

    // Auto-sign indicator badge
    const autoSignBadge = canSign && clientSignature ? (
        clientSignature.auto_sign === 'auto' ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <Zap size={9} /> Auto
            </span>
        ) : clientSignature.auto_sign === 'never' ? (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 bg-gray-500/10 border border-gray-500/20 rounded-full px-2 py-0.5">
                <BellOff size={9} /> Manuel
            </span>
        ) : null
    ) : null

    return (
        <>
            {/* Modals */}
            <AnimatePresence>
                {modal === 'auth' && clientSignature && doc && (
                    <SignatureAuthModal
                        docId={doc.id}
                        docNumero={doc.numero}
                        signature={clientSignature}
                        onClose={() => setModal(null)}
                    />
                )}
                {modal === 'no-sig' && doc && (
                    <NoSignatureModal
                        docId={doc.id}
                        onClose={() => setModal(null)}
                    />
                )}
            </AnimatePresence>

            <div className="space-y-6 max-w-3xl mx-auto">
                {/* Back */}
                <Link href="/client/documents" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
                    <ArrowLeft size={15} /> Mes documents
                </Link>

                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${doc.type === 'devis' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                                {doc.type === 'devis' ? <FileText size={24} /> : <Receipt size={24} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                                    {doc.type === 'devis' ? 'Devis' : 'Facture'}
                                </p>
                                <h1 className="text-xl font-black text-white">{doc.numero}</h1>
                                <p className="text-gray-500 text-sm">{formatDateSafe(doc.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>
                        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${s.bg} ${s.cls}`}>{s.label}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/[0.06]">
                        <Link href={`/portail/${doc.id}`} target="_blank"
                            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-sm text-white transition-all">
                            <Download size={14} className="text-blue-400" /> Télécharger PDF
                        </Link>

                        {canSign && (
                            <button
                                type="button"
                                onClick={handleSignClick}
                                disabled={!sigLoaded}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-bold transition-all disabled:opacity-50 disabled:pointer-events-none"
                            >
                                <PenTool size={14} />
                                Signer ce devis
                                {autoSignBadge}
                            </button>
                        )}

                        {canPay && (
                            <Link href={`/client/payer/${doc.id}`}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl text-sm text-amber-400 font-bold transition-all">
                                <CreditCard size={14} /> Payer maintenant
                            </Link>
                        )}

                        <Link href={`/portail/${doc.id}`} target="_blank"
                            className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-white text-sm transition-colors">
                            <ExternalLink size={13} /> Ouvrir le portail
                        </Link>
                    </div>
                </motion.div>

                {/* Signature status */}
                {doc.type === 'devis' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                        className={`rounded-xl p-4 border flex items-center gap-3 ${doc.signature_url ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                        {doc.signature_url ? (
                            <>
                                <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-white">Signé électroniquement</p>
                                    <p className="text-xs text-gray-500">Le {formatDateSafe(doc.signed_at)}</p>
                                </div>
                            </>
                        ) : canSign ? (
                            <>
                                <Clock size={20} className="text-blue-400 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-white">En attente de votre signature</p>
                                    <p className="text-xs text-gray-500">
                                        {clientSignature
                                            ? clientSignature.auto_sign === 'auto'
                                                ? 'Votre signature sera apposée automatiquement.'
                                                : 'Cliquez sur "Signer ce devis" pour procéder.'
                                            : 'Enregistrez votre signature dans "Ma Signature" pour signer en un clic.'
                                        }
                                    </p>
                                </div>
                                {!clientSignature && sigLoaded && (
                                    <Link href="/client/signature"
                                        className="flex-shrink-0 text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                                        <Pen size={11} /> Créer
                                    </Link>
                                )}
                            </>
                        ) : (
                            <>
                                <Clock size={20} className="text-blue-400 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-white">En attente de signature</p>
                                    <p className="text-xs text-gray-500">Cliquez sur "Signer ce devis" pour procéder.</p>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {/* Items */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-[#0a1221] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/[0.06]">
                        <h2 className="font-black text-white text-sm">Détail des prestations</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-white/[0.04]">
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Qté</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">PU HT</th>
                                    <th className="py-3 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Total HT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {(doc.items || []).map((item: any, i: number) => (
                                    <tr key={i} className="hover:bg-white/[0.02]">
                                        <td className="py-3.5 px-4 text-sm text-white">{item.description}</td>
                                        <td className="py-3.5 px-4 text-sm text-gray-300 text-center">{item.quantity}</td>
                                        <td className="py-3.5 px-4 text-sm text-gray-300 text-right font-mono">{fmtN(item.unit_price)}</td>
                                        <td className="py-3.5 px-4 text-sm text-white font-mono font-bold text-right">{fmtN(item.quantity * item.unit_price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="p-5 border-t border-white/[0.06]">
                        <div className="flex flex-col items-end space-y-2 max-w-xs ml-auto">
                            <div className="flex justify-between w-full text-sm text-gray-400">
                                <span>Sous-total HT</span>
                                <span className="font-mono">{fmtN(doc.sous_total)} {doc.currency || 'XOF'}</span>
                            </div>
                            {doc.total_tva > 0 && (
                                <div className="flex justify-between w-full text-sm text-gray-400">
                                    <span>TVA (18%)</span>
                                    <span className="font-mono">+ {fmtN(doc.total_tva)} {doc.currency || 'XOF'}</span>
                                </div>
                            )}
                            {doc.remise > 0 && (
                                <div className="flex justify-between w-full text-sm text-red-400">
                                    <span>Remise</span>
                                    <span className="font-mono">- {fmtN(doc.remise)} {doc.currency || 'XOF'}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-full pt-2 border-t border-white/[0.08]">
                                <span className="font-black text-white">TOTAL TTC</span>
                                <span className="font-black text-white font-mono text-lg">{fmtN(doc.total)} {doc.currency || 'XOF'}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Notes */}
                {doc.notes && (
                    <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl p-5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-2">Notes</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{doc.notes}</p>
                    </div>
                )}
            </div>
        </>
    )
}
