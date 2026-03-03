'use client'

import { useList, useUpdate } from '@refinedev/core'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Receipt, Search, Loader2,
    CheckCircle2, Clock, XCircle, RefreshCcw
} from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface OrderItem {
    id: string
    customer_name?: string
    customer_phone?: string
    product_title?: string
    quantity?: number
    amount?: number
    currency?: string
    payment_status?: string
    payment_method?: string
    transaction_id?: string
    created_at: string
}

const statusConfig: Record<string, { icon: typeof Clock, label: string, classes: string }> = {
    pending: { icon: Clock, label: 'En attente', classes: 'bg-[#FCD116]/15 text-[#FCD116] border-[#FCD116]/30' },
    completed: { icon: CheckCircle2, label: 'Paye', classes: 'bg-[#008751]/15 text-[#008751] border-[#008751]/30' },
    failed: { icon: XCircle, label: 'Eéchouée', classes: 'bg-[#E8112D]/15 text-[#E8112D] border-[#E8112D]/30' },
    refunded: { icon: RefreshCcw, label: 'Rembourse', classes: 'bg-[#4A90D9]/15 text-[#4A90D9] border-[#4A90D9]/30' },
}

export default function AdminOrdersPage() {
    const queryResult = useList<OrderItem>({
        resource: 'orders',
        pagination: { pageSize: 100 },
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    const { mutate: updateOrder } = useUpdate()
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const data = queryResult.query?.data;
    const isLoading = queryResult.query?.isLoading;
    const items: OrderItem[] = data?.data || []
    const filtered = items.filter((item) => {
        const matchSearch =
            (item.customer_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.product_title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (item.customer_phone || '').includes(searchTerm)
        const matchStatus = statusFilter === 'all' || item.payment_status === statusFilter
        return matchSearch && matchStatus
    })

    const formatPrice = (price: number) => new Intl.NumberFormat('fr-FR').format(price || 0)
    const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    // Stats
    const totalRevenue = items
        .filter((i) => i.payment_status === 'completed')
        .reduce((sum: number, i) => sum + (i.amount || 0), 0)
    const pendingCount = items.filter((i) => i.payment_status === 'pending').length
    const completedCount = items.filter((i) => i.payment_status === 'completed').length

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#FCD116]">
                    <Receipt size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Gestion Commerciale</span>
                </div>
                <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                    COMMANDES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]">EN LIGNE</span>
                </h1>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Revenu Total', value: `${formatPrice(totalRevenue)} XOF`, textClass: 'text-[#008751]' },
                    { label: 'Commandes Payees', value: String(completedCount), textClass: 'text-[#FCD116]' },
                    { label: 'En Attente', value: String(pendingCount), textClass: 'text-[#E8112D]' },
                ].map(stat => (
                    <div key={stat.label} className="p-6 rounded-2xl bg-[#0a0f18] border border-white/5">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-2xl font-black font-heading tracking-tighter ${stat.textClass}`}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder="Rechercher par client, produit, telephone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 text-sm"
                    />
                </div>
                <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl overflow-x-auto scrollbar-none">
                    {['all', 'pending', 'completed', 'failed', 'refunded'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                statusFilter === s ? 'bg-[#FCD116] text-black shadow-lg' : 'text-gray-500 hover:text-white'
                            )}
                        >
                            {s === 'all' ? 'Toutes' : statusConfig[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Table */}
            <Card className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#FCD116]" size={48} />
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="divide-y divide-white/5">
                        {/* Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 bg-white/[0.02] text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            <div className="col-span-2">Client</div>
                            <div className="col-span-3">Produit</div>
                            <div className="col-span-1">Qte</div>
                            <div className="col-span-2">Montant</div>
                            <div className="col-span-1">Methode</div>
                            <div className="col-span-1">Statut</div>
                            <div className="col-span-2">Date</div>
                        </div>

                        <AnimatePresence mode="popLayout">
                            {filtered.map((order) => {
                                const status = statusConfig[order.payment_status as string] || statusConfig.pending
                                const StatusIcon = status.icon

                                return (
                                    <motion.div
                                        key={order.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-5 hover:bg-white/[0.02] transition-colors items-center"
                                    >
                                        {/* Client */}
                                        <div className="col-span-2">
                                            <p className="text-sm font-bold text-white truncate">{order.customer_name}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{order.customer_phone}</p>
                                        </div>

                                        {/* Product */}
                                        <div className="col-span-3">
                                            <p className="text-sm text-gray-300 truncate">{order.product_title || 'Article'}</p>
                                        </div>

                                        {/* Qty */}
                                        <div className="col-span-1">
                                            <span className="text-sm text-gray-400">{order.quantity || 1}</span>
                                        </div>

                                        {/* Amount */}
                                        <div className="col-span-2">
                                            <p className="text-sm font-black text-white">
                                                {formatPrice(order.amount || 0)} <span className="text-gray-500 text-[10px]">{order.currency || 'XOF'}</span>
                                            </p>
                                        </div>

                                        {/* Method */}
                                        <div className="col-span-1">
                                            <span className="px-2 py-1 rounded-lg bg-white/5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                                {order.payment_method}
                                            </span>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-1">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${status.classes}`}
                                            >
                                                <StatusIcon size={10} />
                                                {status.label}
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                                            {order.transaction_id && (
                                                <p className="text-[9px] text-gray-700 font-mono mt-0.5 truncate">
                                                    TX: {order.transaction_id.slice(0, 12)}...
                                                </p>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Receipt size={48} className="text-gray-700" />
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                            Aucune commande trouvee.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    )
}
