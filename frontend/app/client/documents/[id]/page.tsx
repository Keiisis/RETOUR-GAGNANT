'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Receipt, ExternalLink, Download, PenTool, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

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

export default function ClientDocumentDetailPage() {
    const { id } = useParams<{ id: string }>()
    const [doc, setDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)

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

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Back */}
            <Link href="/client/documents" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm transition-colors">
                <ArrowLeft size={15} /> Mes documents
            </Link>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#0a1221] border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${doc.type === 'devis' ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {doc.type === 'devis' ? <FileText size={24} /> : <Receipt size={24} />}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                                {doc.type === 'devis' ? 'Devis' : 'Facture'}
                            </p>
                            <h1 className="text-xl font-black text-white">{doc.numero}</h1>
                            <p className="text-gray-500 text-sm">{new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
                        <Link href={`/portail/${doc.id}`} target="_blank"
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-bold transition-all">
                            <PenTool size={14} /> Signer ce devis
                        </Link>
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
                                <p className="text-sm font-bold text-white">Signé electroniquement</p>
                                <p className="text-xs text-gray-500">Le {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString('fr-FR') : '—'}</p>
                            </div>
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
    )
}
