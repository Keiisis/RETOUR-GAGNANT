'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatPrice, type CurrencyCode } from '@/lib/currency'
import {
    Receipt, ShoppingBag, CreditCard, CheckCircle2, Clock, Loader2,
    Package, ChevronRight, Inbox,
} from 'lucide-react'

interface Facture {
    id: string
    numero: string | null
    total: number | null
    currency: string | null
    status: string | null
    type: string | null
    created_at: string
}
interface Commande {
    id: string
    amount: number | null
    currency: string | null
    payment_status: string | null
    shipping_status: string | null
    tracking_code: string | null
    product_title: string | null
    created_at: string
}

const factureStatus = (s: string | null) => {
    if (s === 'paye') return { label: 'Payée', color: '#10B981', icon: CheckCircle2 }
    if (s === 'envoye') return { label: 'À payer', color: '#F59E0B', icon: Clock }
    return { label: s || 'En cours', color: '#64748B', icon: Clock }
}
const orderStatus = (s: string | null) => {
    const map: Record<string, { label: string; color: string }> = {
        completed: { label: 'Payée', color: '#10B981' },
        pending: { label: 'En attente', color: '#F59E0B' },
        failed: { label: 'Échouée', color: '#EF4444' },
    }
    return map[s || ''] || { label: s || '—', color: '#64748B' }
}
const fmt = (a: number | null, c: string | null) => formatPrice(Number(a || 0), (c as CurrencyCode) || 'XOF')
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

export default function ClientFacturesPage() {
    const [loading, setLoading] = useState(true)
    const [factures, setFactures] = useState<Facture[]>([])
    const [commandes, setCommandes] = useState<Commande[]>([])
    const [tab, setTab] = useState<'factures' | 'commandes'>('factures')

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { setLoading(false); return }
            const uid = session.user.id
            const email = (session.user.email || '').toLowerCase()

            const [facRes, cmdRes] = await Promise.all([
                supabase.from('documents_financiers')
                    .select('id, numero, total, currency, status, type, created_at')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .eq('type', 'facture')
                    .order('created_at', { ascending: false }),
                supabase.from('orders')
                    .select('id, amount, currency, payment_status, shipping_status, tracking_code, product_title, created_at')
                    .or(`client_id.eq.${uid},customer_email.eq.${email}`)
                    .order('created_at', { ascending: false }),
            ])
            setFactures((facRes.data as Facture[]) || [])
            setCommandes((cmdRes.data as Commande[]) || [])
            setLoading(false)
        }
        load()
    }, [])

    const unpaidCount = factures.filter(f => f.status !== 'paye').length

    return (
        <div className="p-5 md:p-8 max-w-4xl mx-auto text-white">
            <header className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Factures &amp; Commandes</h1>
                    <p className="text-sm text-gray-400">Vos factures à régler et le suivi de vos commandes</p>
                </div>
            </header>

            {/* Onglets */}
            <div className="flex gap-2 mb-6">
                <button type="button" onClick={() => setTab('factures')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'factures' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                    <Receipt className="w-4 h-4" /> Factures
                    {unpaidCount > 0 && <span className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-500 text-black">{unpaidCount}</span>}
                </button>
                <button type="button" onClick={() => setTab('commandes')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${tab === 'commandes' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                    <ShoppingBag className="w-4 h-4" /> Commandes
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
            ) : tab === 'factures' ? (
                factures.length === 0 ? (
                    <Empty icon={Receipt} text="Aucune facture pour le moment." />
                ) : (
                    <div className="space-y-3">
                        {factures.map(f => {
                            const st = factureStatus(f.status)
                            const StIcon = st.icon
                            return (
                                <motion.div key={f.id} layout className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${st.color}22` }}>
                                        <StIcon className="w-5 h-5" style={{ color: st.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">Facture {f.numero || f.id.slice(0, 8)}</p>
                                        <p className="text-xs text-gray-400">{fmtDate(f.created_at)} · <span style={{ color: st.color }}>{st.label}</span></p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-black">{fmt(f.total, f.currency)}</p>
                                        {f.status !== 'paye' && (
                                            <Link href={`/client/payer/${f.id}`}
                                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300">
                                                <CreditCard className="w-3.5 h-3.5" /> Payer
                                            </Link>
                                        )}
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                )
            ) : (
                commandes.length === 0 ? (
                    <Empty icon={ShoppingBag} text="Aucune commande pour le moment." />
                ) : (
                    <div className="space-y-3">
                        {commandes.map(c => {
                            const st = orderStatus(c.payment_status)
                            return (
                                <div key={c.id} className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                                        <Package className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{c.product_title || 'Commande boutique'}</p>
                                        <div className="text-xs text-gray-400 flex flex-wrap gap-x-2">
                                            <span>{fmtDate(c.created_at)}</span>
                                            <span style={{ color: st.color }}>· {st.label}</span>
                                            {c.tracking_code && <span>· Suivi : {c.tracking_code}</span>}
                                        </div>
                                    </div>
                                    <p className="font-black shrink-0">{fmt(c.amount, c.currency)}</p>
                                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                                </div>
                            )
                        })}
                    </div>
                )
            )}
        </div>
    )
}

function Empty({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
    return (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-10 text-center">
            <Icon className="w-9 h-9 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 text-sm">{text}</p>
        </div>
    )
}
