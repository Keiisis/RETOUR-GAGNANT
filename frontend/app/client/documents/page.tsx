'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { FileText, Receipt, Search, Download, Eye, ArrowRight, Filter, CreditCard } from 'lucide-react'
import { EmptyState, RowSkeleton } from '@/components/panel/PanelStates'

interface Doc {
    id: string
    type: 'devis' | 'facture'
    numero: string
    total: number
    status: string
    currency: string
    created_at: string
    signed_at?: string
    signature_url?: string
    items: any[]
}

const STATUS = {
    brouillon: { label: 'Brouillon', cls: 'text-gray-400 bg-gray-500/10' },
    envoye: { label: 'En attente', cls: 'text-[var(--panel-accent)] bg-[var(--panel-accent-soft)]' },
    accepte: { label: 'Signé', cls: 'text-emerald-400 bg-emerald-500/10' },
    refuse: { label: 'Refusé', cls: 'text-red-400 bg-red-500/10' },
    paye: { label: 'Payé', cls: 'text-green-400 bg-green-500/10' },
    en_retard: { label: 'En retard', cls: 'text-orange-400 bg-orange-500/10' },
    annule: { label: 'Annulé', cls: 'text-gray-500 bg-gray-500/10' },
}

const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Safe date formatter to avoid RangeError: Invalid time value
const formatDateSafe = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

const PAGE_SIZE = 20

export default function ClientDocumentsPage() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [page, setPage] = useState(0)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'devis' | 'facture' | 'paye'>('all')
    const [userId, setUserId] = useState('')
    const [userEmail, setUserEmail] = useState('')

    const fetchDocs = async (userId: string, email: string, pageNum: number, append = false) => {
        const { data } = await supabase
            .from('documents_financiers')
            .select('id, type, numero, total, status, currency, created_at, signed_at, signature_url, items')
            .or(`client_id.eq.${userId},client_email.eq.${email}`)
            .order('created_at', { ascending: false })
            .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

        const results = data as Doc[] || []
        setHasMore(results.length === PAGE_SIZE)
        if (append) setDocs(prev => [...prev, ...results])
        else setDocs(results)
    }

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) return
            const email = session.user.email || ''
            setUserId(session.user.id)
            setUserEmail(email)
            await fetchDocs(session.user.id, email, 0)
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadMore = async () => {
        setLoadingMore(true)
        const nextPage = page + 1
        await fetchDocs(userId, userEmail, nextPage, true)
        setPage(nextPage)
        setLoadingMore(false)
    }

    const filtered = docs.filter(d => {
        const matchSearch = d.numero?.toLowerCase().includes(search.toLowerCase())
        const matchFilter = filter === 'all' || d.type === filter || (filter === 'paye' && d.status === 'paye')
        return matchSearch && matchFilter
    })

    const devisCount = docs.filter(d => d.type === 'devis').length
    const factureCount = docs.filter(d => d.type === 'facture').length
    const toSign = docs.filter(d => d.type === 'devis' && d.status === 'envoye').length
    const toPay = docs.filter(d => d.type === 'facture' && d.status === 'envoye').length

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <FileText size={14} className="text-[var(--panel-accent)]" />
                    <span className="text-[10px] font-bold text-[var(--panel-accent)] uppercase tracking-[0.3em]">Mes Documents</span>
                </div>
                <h1 className="text-2xl font-black text-white">Devis & Factures</h1>
                <p className="text-gray-500 text-sm mt-1">Consultez, signez et téléchargez vos documents.</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total devis', value: devisCount, color: 'text-[var(--panel-accent)]' },
                    { label: 'Total factures', value: factureCount, color: 'text-emerald-400' },
                    { label: 'Devis à signer', value: toSign, color: 'text-amber-400', alert: toSign > 0 },
                    { label: 'Factures à payer', value: toPay, color: 'text-orange-400', alert: toPay > 0 },
                ].map(s => (
                    <div key={s.label} className={`bg-[#0a1221] rounded-xl p-4 border ${s.alert ? 'border-amber-500/30' : 'border-white/[0.06]'}`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher par numéro..."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-[var(--panel-accent)] text-sm transition-colors" />
                </div>
                <div className="flex gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
                    {(['all', 'devis', 'facture', 'paye'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-[var(--panel-accent-soft)] text-[var(--panel-accent)]' : 'text-gray-500 hover:text-white'}`}>
                            <Filter size={11} />
                            {f === 'all' ? 'Tous' : f === 'devis' ? 'Devis' : f === 'facture' ? 'Factures' : 'Payés'}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="bg-[#0a1221] border border-white/[0.06] rounded-xl overflow-hidden">
                {loading ? (
                    <RowSkeleton rows={5} />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={FileText}
                        title="Aucun document pour le moment"
                        body="Vos devis et vos factures apparaîtront ici dès que votre conseiller les aura émis."
                        action={{ label: 'Voir mes services', href: '/client/services' }}
                    />
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {filtered.map((doc, i) => {
                            const s = STATUS[doc.status as keyof typeof STATUS] || { label: doc.status, cls: 'text-gray-400 bg-gray-500/10' }
                            const needsAction = (doc.type === 'devis' && doc.status === 'envoye') || (doc.type === 'facture' && doc.status === 'envoye')
                            const canPay = doc.type === 'facture' && doc.status === 'envoye'
                            return (
                                <motion.div key={doc.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                    className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3.5 sm:py-4 hover:bg-white/[0.02] transition-colors group ${needsAction ? 'border-l-2 border-amber-500/50' : ''}`}>
                                    <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${doc.type === 'devis' ? 'bg-[var(--panel-accent-soft)] text-[var(--panel-accent)]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                        {doc.type === 'devis' ? <FileText size={15} /> : <Receipt size={15} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="font-bold text-white text-sm truncate">{doc.numero}</p>
                                            {needsAction && <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">Action requise</span>}
                                        </div>
                                        <p className="text-[11px] text-gray-500 truncate">{formatDateSafe(doc.created_at)} · {doc.items?.length || 0} ligne{(doc.items?.length || 0) > 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-mono font-black text-white text-xs sm:text-sm whitespace-nowrap">{fmtN(doc.total)} <span className="text-gray-400">{doc.currency || 'XOF'}</span></p>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
                                    </div>
                                    {/* Mobile: show pay button always if needed */}
                                    {canPay && (
                                        <Link href={`/client/payer/${doc.id}`}
                                            className="sm:hidden flex-shrink-0 p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 transition-colors" title="Payer cette facture">
                                            <CreditCard size={14} />
                                        </Link>
                                    )}
                                    {/* Desktop: hover action buttons */}
                                    <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canPay && (
                                            <Link href={`/client/payer/${doc.id}`}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold transition-colors" title="Payer">
                                                <CreditCard size={12} /> Payer
                                            </Link>
                                        )}
                                        <Link href={`/client/documents/${doc.id}`} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-[var(--panel-accent)] transition-colors" title="Voir">
                                            <Eye size={15} />
                                        </Link>
                                        <Link href={`/portail/${doc.id}`} target="_blank" className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-emerald-400 transition-colors" title="Ouvrir le portail">
                                            <Download size={15} />
                                        </Link>
                                    </div>
                                    <Link href={`/client/documents/${doc.id}`} className="flex-shrink-0">
                                        <ArrowRight size={14} className="text-gray-700 group-hover:text-[var(--panel-accent)] transition-colors" />
                                    </Link>
                                </motion.div>
                            )
                        })}
                        {hasMore && !search && filter === 'all' && (
                            <div className="p-4 text-center border-t border-white/[0.04]">
                                <button type="button" onClick={loadMore} disabled={loadingMore}
                                    className="text-sm font-bold text-[var(--panel-accent)] hover:opacity-80 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto">
                                    {loadingMore ? <span className="w-4 h-4 border-2 border-[var(--panel-accent)]/30 border-t-[var(--panel-accent)] rounded-full animate-spin inline-block" /> : null}
                                    {loadingMore ? 'Chargement...' : 'Charger plus de documents'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
