'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash as Trash2, Pencil as Edit2, MagnifyingGlass as Search, CircleNotch as Loader2, StackSimple as Layers, ArrowClockwise as RefreshCw, ToggleLeft, ToggleRight } from '@phosphor-icons/react';
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Service {
    id: string
    title: string
    slug: string
    subtitle: string
    description: string
    features: string[]
    pricing_options: Array<{ label: string; price: string }>
    color: string
    icon_type: string
    image_url: string | null
    price_display: string
    order_index: number
    is_active: boolean
    created_at: string
}

export default function AdminServicesPage() {
    const { t } = useTranslation();
    const router = useRouter()
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [error, setError] = useState('')

    const fetchServices = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/services')
            if (!res.ok) throw new Error('Erreur chargement services')
            const data = await res.json()
            setServices(data.services || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchServices() }, [fetchServices])

    const toggleActive = async (service: Service) => {
        const res = await fetch(`/api/admin/services/${service.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !service.is_active }),
        })
        if (res.ok) {
            setServices(prev => prev.map(s => s.id === service.id ? { ...s, is_active: !s.is_active } : s))
        }
    }

    const deleteService = async (service: Service) => {
        if (!confirm(`Supprimer définitivement "${service.title}" ?\nCette action est irréversible.`)) return
        const res = await fetch(`/api/admin/services/${service.id}`, { method: 'DELETE' })
        if (res.ok) {
            setServices(prev => prev.filter(s => s.id !== service.id))
        }
    }

    const filtered = services.filter(s =>
        s.title?.toLowerCase().includes(search.toLowerCase()) ||
        s.slug?.toLowerCase().includes(search.toLowerCase())
    )

    const getEditHref = (service: Service) => {
        if (service.slug === 'nationalite-vip') return '/admin/nationalite/content'
        if (service.slug === 'recherche-ancestrale') return '/admin/recherche-ancestrale'
        if (service.slug === 'autres') return '/admin/autres-services'
        return `/admin/services/edit/${service.id}`
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#008751]">
                        <Layers size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]"><T>Gestion des Services</T></span>
                    </div>
                    <h1 className="text-4xl font-black text-white font-heading tracking-tighter">
                        SERVICES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#FCD116]"><T>PREMIUM</T></span>
                    </h1>
                    <p className="text-sm text-gray-500">
                        {services.length} service(s) — {services.filter(s => s.is_active).length} actif(s)
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={fetchServices}
                        className="p-3 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white transition-colors"
                        title={t("Rafraîchir")}
                    >
                        <RefreshCw size={16} />
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                        <input
                            type="text"
                            placeholder={t("Rechercher...")}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#0a0f18] border border-white/5 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#008751]/30 text-sm w-56"
                        />
                    </div>
                    <Link
                        href="/admin/services/create"
                        className="flex items-center gap-2 bg-[#008751] hover:bg-[#00a36b] text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all shadow-lg"
                    >
                        <Plus size={16} /> CRÉER UN SERVICE
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {/* Grid */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-[#008751]" size={36} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 space-y-3">
                        <Layers size={40} className="text-gray-700" />
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest"><T>Aucun service trouvé</T></p>
                        <Link href="/admin/services/create" className="text-[#008751] text-xs font-bold hover:underline">
                            + Créer le premier service
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {/* Table header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-white/[0.02] text-[9px] font-black text-gray-600 uppercase tracking-widest">
                            <div className="col-span-1"><T>Ordre</T></div>
                            <div className="col-span-3"><T>Service</T></div>
                            <div className="col-span-2"><T>Slug</T></div>
                            <div className="col-span-3"><T>Prix</T></div>
                            <div className="col-span-1"><T>Options</T></div>
                            <div className="col-span-1"><T>Statut</T></div>
                            <div className="col-span-1 text-right"><T>Actions</T></div>
                        </div>
                        <AnimatePresence mode="popLayout">
                            {filtered.map(service => (
                                <motion.div
                                    key={service.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 hover:bg-white/[0.02] transition-colors items-center"
                                >
                                    {/* Order */}
                                    <div className="col-span-1">
                                        <span className="text-xs font-black text-gray-600">#{service.order_index}</span>
                                    </div>

                                    {/* Title + color indicator */}
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-lg flex-shrink-0"
                                            style={{ backgroundColor: (service.color || '#008751') + '20', border: `1px solid ${service.color || '#008751'}40` }}
                                        >
                                            {service.image_url ? (
                                                <img src={service.image_url} alt="" className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <div className="w-full h-full rounded-lg" style={{ backgroundColor: service.color || '#008751' }} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{service.title}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{service.subtitle}</p>
                                        </div>
                                    </div>

                                    {/* Slug */}
                                    <div className="col-span-2">
                                        <span className="text-[10px] font-mono text-gray-400 bg-white/5 px-2 py-1 rounded">
                                            /{service.slug}
                                        </span>
                                    </div>

                                    {/* Price */}
                                    <div className="col-span-3">
                                        <p className="text-xs font-bold text-white">{service.price_display || '—'}</p>
                                    </div>

                                    {/* Pricing options count */}
                                    <div className="col-span-1">
                                        <span className="text-[10px] text-gray-500">
                                            {(service.pricing_options || []).length} option(s)
                                        </span>
                                    </div>

                                    {/* Active toggle */}
                                    <div className="col-span-1">
                                        <button
                                            type="button"
                                            onClick={() => toggleActive(service)}
                                            className={cn(
                                                'transition-colors',
                                                service.is_active ? 'text-[#008751]' : 'text-gray-600'
                                            )}
                                            title={service.is_active ? 'Désactiver' : 'Activer'}
                                        >
                                            {service.is_active
                                                ? <ToggleRight size={20} />
                                                : <ToggleLeft size={20} />
                                            }
                                        </button>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => router.push(getEditHref(service))}
                                            className="p-2 rounded-xl bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white transition-all"
                                            title={t("Modifier")}
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteService(service)}
                                            className="p-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                                            title={t("Supprimer")}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
