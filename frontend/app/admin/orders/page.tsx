'use client'

import { useTranslation, T } from '@/lib/translation';
import { useList, useUpdate } from '@refinedev/core'
import { motion, AnimatePresence } from 'framer-motion'
import { Receipt, MagnifyingGlass as Search, CircleNotch as Loader2, CheckCircle as CheckCircle2, Clock, XCircle, ArrowCounterClockwise as RefreshCcw, Truck, X } from '@phosphor-icons/react';
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
    // Shipping / tracking
    tracking_code?: string | null
    tracking_carrier?: string | null
    tracking_url?: string | null
    shipping_status?: string | null
}

const SHIPPING_STATUSES = [
    { value: 'pending',    label: 'En attente' },
    { value: 'preparing',  label: 'En préparation' },
    { value: 'shipped',    label: 'Expédié' },
    { value: 'in_transit', label: 'En transit' },
    { value: 'delivered',  label: 'Livré' },
    { value: 'failed',     label: 'Échec' },
    { value: 'returned',   label: 'Retourné' },
]

const statusConfig: Record<string, { icon: typeof Clock, label: string, classes: string }> = {
    pending: { icon: Clock, label: 'En attente', classes: 'bg-[#FCD116]/15 text-[#FCD116] border-[#FCD116]/30' },
    completed: { icon: CheckCircle2, label: 'Payé', classes: 'bg-[#008751]/15 text-[#008751] border-[#008751]/30' },
    abandoned: { icon: XCircle, label: 'Abandonné', classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    failed: { icon: XCircle, label: 'Échouée', classes: 'bg-[#E8112D]/15 text-[#E8112D] border-[#E8112D]/30' },
    refunded: { icon: RefreshCcw, label: 'Remboursé', classes: 'bg-[#4A90D9]/15 text-[#4A90D9] border-[#4A90D9]/30' },
    cancelled: { icon: XCircle, label: 'Annulé', classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

export default function AdminOrdersPage() {
    const { t } = useTranslation();
    const queryResult = useList<OrderItem>({
        resource: 'orders',
        pagination: { pageSize: 100 },
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    useUpdate() // Refine context : required by parent layout
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // ── Modale suivi de colis ──
    const [trackingOrder, setTrackingOrder] = useState<OrderItem | null>(null)
    const [trackingForm, setTrackingForm] = useState({
        tracking_code: '',
        tracking_carrier: '',
        tracking_url: '',
        shipping_status: 'preparing',
        event_description: '',
    })
    const [trackingSaving, setTrackingSaving] = useState(false)

    const openTracking = (order: OrderItem) => {
        setTrackingOrder(order)
        setTrackingForm({
            tracking_code: order.tracking_code || '',
            tracking_carrier: order.tracking_carrier || '',
            tracking_url: order.tracking_url || '',
            shipping_status: order.shipping_status || 'preparing',
            event_description: '',
        })
    }

    const saveTracking = async () => {
        if (!trackingOrder) return
        setTrackingSaving(true)
        try {
            const res = await fetch(`/api/admin/orders/${trackingOrder.id}/tracking`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tracking_code: trackingForm.tracking_code.trim() || null,
                    tracking_carrier: trackingForm.tracking_carrier.trim() || null,
                    tracking_url: trackingForm.tracking_url.trim() || null,
                    shipping_status: trackingForm.shipping_status,
                    event_description: trackingForm.event_description.trim() || undefined,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.ok) {
                alert(`Erreur : ${data.error || 'Mise à jour échouée'}`)
                return
            }
            // Refresh la liste
            queryResult.query?.refetch?.()
            setTrackingOrder(null)
        } catch (e) {
            alert(`Erreur : ${e instanceof Error ? e.message : 'inconnue'}`)
        } finally {
            setTrackingSaving(false)
        }
    }

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
    const formatDate = (date: string) => {
        if (!date) return '-'
        const d = new Date(date)
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    // Stats
    const totalRevenue = items
        .filter((i) => i.payment_status === 'completed')
        .reduce((sum: number, i) => sum + (i.amount || 0), 0)
    const pendingCount = items.filter((i) => i.payment_status === 'pending').length
    const completedCount = items.filter((i) => i.payment_status === 'completed').length
    const abandonedCount = items.filter((i) => i.payment_status === 'abandoned').length

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* HEADER */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#FCD116]">
                    <Receipt size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Gestion Commerciale</T></span>
                </div>
                <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                    COMMANDES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FCD116] to-[#008751]"><T>EN LIGNE</T></span>
                </h1>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Revenu Total', value: `${formatPrice(totalRevenue)} XOF`, textClass: 'text-[#008751]' },
                    { label: 'Commandes Payees', value: String(completedCount), textClass: 'text-[#FCD116]' },
                    { label: 'En Attente', value: String(pendingCount), textClass: 'text-[#E8112D]' },
                    { label: 'Paniers Abandonnés', value: String(abandonedCount), textClass: 'text-orange-400' },
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
                        placeholder={t("Rechercher par client, produit, telephone...")}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#FCD116]/30 text-sm"
                    />
                </div>
                <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl overflow-x-auto scrollbar-none">
                    {['all', 'pending', 'completed', 'abandoned', 'failed', 'refunded'].map(s => (
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
                            <div className="col-span-2"><T>Client</T></div>
                            <div className="col-span-3"><T>Produit</T></div>
                            <div className="col-span-1"><T>Qte</T></div>
                            <div className="col-span-2"><T>Montant</T></div>
                            <div className="col-span-1"><T>Methode</T></div>
                            <div className="col-span-1"><T>Statut</T></div>
                            <div className="col-span-2"><T>Date</T></div>
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

                                        {/* Date + Tracking */}
                                        <div className="col-span-2 flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                                                {order.transaction_id && (
                                                    <p className="text-[9px] text-gray-700 font-mono mt-0.5 truncate">
                                                        TX: {order.transaction_id.slice(0, 12)}...
                                                    </p>
                                                )}
                                                {order.tracking_code && (
                                                    <p className="text-[9px] text-[#FCD116] font-mono mt-0.5 truncate">
                                                         {order.tracking_code}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => openTracking(order)}
                                                title={order.tracking_code ? t('Modifier le suivi') : t('Renseigner le suivi')}
                                                className="shrink-0 p-2 rounded-lg bg-white/5 hover:bg-[#FCD116]/15 hover:text-[#FCD116] text-gray-400 transition-colors"
                                            >
                                                <Truck size={14} />
                                            </button>
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

            {/* ── Modale suivi de colis ── */}
            <AnimatePresence>
                {trackingOrder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => !trackingSaving && setTrackingOrder(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg bg-[#0a0f18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[#FCD116]/15 flex items-center justify-center">
                                        <Truck size={18} className="text-[#FCD116]" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-sm uppercase tracking-widest">
                                            <T>Suivi de colis</T>
                                        </h3>
                                        <p className="text-[10px] text-gray-500 truncate">
                                            {trackingOrder.customer_name} · {trackingOrder.product_title || 'Commande'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    aria-label={t('Fermer')}
                                    title={t('Fermer')}
                                    onClick={() => !trackingSaving && setTrackingOrder(null)}
                                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Statut */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                        <T>{"Statut d'expédition"}</T>
                                    </label>
                                    <select
                                        aria-label={t("Statut d'expedition")}
                                        title={t("Statut d'expedition")}
                                        value={trackingForm.shipping_status}
                                        onChange={(e) => setTrackingForm(f => ({ ...f, shipping_status: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FCD116]"
                                    >
                                        {SHIPPING_STATUSES.map(s => (
                                            <option key={s.value} value={s.value} className="bg-[#0a0f18]">
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Code de suivi */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                        <T>Code de suivi</T>
                                    </label>
                                    <input
                                        type="text"
                                        value={trackingForm.tracking_code}
                                        onChange={(e) => setTrackingForm(f => ({ ...f, tracking_code: e.target.value }))}
                                        placeholder="UPS123456789BJ"
                                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-[#FCD116]"
                                    />
                                </div>

                                {/* Transporteur */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                        <T>Transporteur</T>
                                    </label>
                                    <input
                                        type="text"
                                        value={trackingForm.tracking_carrier}
                                        onChange={(e) => setTrackingForm(f => ({ ...f, tracking_carrier: e.target.value }))}
                                        placeholder="Bénin Post / DHL / Chronopost..."
                                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FCD116]"
                                    />
                                </div>

                                {/* URL transporteur */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                        <T>Lien de suivi (optionnel)</T>
                                    </label>
                                    <input
                                        type="url"
                                        value={trackingForm.tracking_url}
                                        onChange={(e) => setTrackingForm(f => ({ ...f, tracking_url: e.target.value }))}
                                        placeholder="https://..."
                                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FCD116]"
                                    />
                                </div>

                                {/* Note événement */}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                        <T>Note evenement (optionnel)</T>
                                    </label>
                                    <textarea
                                        value={trackingForm.event_description}
                                        onChange={(e) => setTrackingForm(f => ({ ...f, event_description: e.target.value }))}
                                        placeholder="Ex: Colis remis au transporteur ce matin"
                                        rows={2}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#FCD116] resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                                <button
                                    type="button"
                                    onClick={() => setTrackingOrder(null)}
                                    disabled={trackingSaving}
                                    className="px-4 py-2 text-xs font-black text-gray-400 hover:text-white uppercase tracking-widest transition-colors"
                                >
                                    <T>Annuler</T>
                                </button>
                                <button
                                    type="button"
                                    onClick={saveTracking}
                                    disabled={trackingSaving}
                                    className="px-5 py-2 rounded-lg bg-[#FCD116] hover:bg-[#FCD116]/90 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                                >
                                    {trackingSaving ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                                    <T>Enregistrer</T>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
