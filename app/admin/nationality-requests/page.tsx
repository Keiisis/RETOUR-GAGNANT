'use client'

import { useList, useUpdate } from '@refinedev/core'
import { useState } from 'react'
import {
    Flag, Mail, Eye, Clock, CheckCircle2, AlertCircle,
    Loader2, Search, Filter, User, Calendar
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    nouveau: { label: 'Nouveau', color: '#3b82f6', icon: AlertCircle },
    en_cours: { label: 'En Cours', color: '#FCD116', icon: Clock },
    traite: { label: 'Traité', color: '#008751', icon: CheckCircle2 },
    archive: { label: 'Archivé', color: '#6b7280', icon: Eye },
}

export default function NationalityRequestsList() {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('tous')
    const [selectedId, setSelectedId] = useState<number | null>(null)

    const queryResult = useList({
        resource: 'nationality_requests',
        sorters: [{ field: 'created_at', order: 'desc' }],
        pagination: { pageSize: 50 },
    })

    const data = (queryResult as any).data || (queryResult as any).query?.data
    const isLoading = (queryResult as any).isLoading || (queryResult as any).query?.isLoading
    const { mutate: updateItem } = useUpdate()

    const items = (data?.data || []).filter((item: any) => {
        const matchSearch = !search || `${item.nom} ${item.prenom} ${item.email}`.toLowerCase().includes(search.toLowerCase())
        const matchStatus = statusFilter === 'tous' || item.statut === statusFilter
        return matchSearch && matchStatus
    })

    const handleStatusChange = (id: number, statut: string) => {
        updateItem({
            resource: 'nationality_requests',
            id,
            values: { statut, updated_at: new Date().toISOString() },
        })
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <Loader2 className="animate-spin text-[#FCD116]" size={40} />
            </div>
        )
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#E8112D]">
                        <Flag size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Demandes de Nationalité</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        NATIONALITÉ <span className="text-benin-gradient">BÉNINOISE</span>
                    </h1>
                    <p className="text-gray-500 max-w-xl text-sm">
                        Demandes reçues via le formulaire. Traitez et répondez aux clients.
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-[#0a0f18] border border-white/5 rounded-2xl p-2">
                    {['tous', 'nouveau', 'en_cours', 'traite', 'archive'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                'px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                                statusFilter === s ? 'bg-[#FCD116] text-black' : 'text-gray-500 hover:text-white'
                            )}
                        >
                            {s === 'tous' ? 'Tous' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, prénom ou email..."
                    className="w-full bg-[#0a0f18] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white text-sm focus:outline-none focus:border-[#FCD116]/30"
                />
            </div>

            {/* Counter */}
            <div className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                {items.length} demande{items.length !== 1 ? 's' : ''} trouvée{items.length !== 1 ? 's' : ''}
            </div>

            {/* Request Cards */}
            <div className="space-y-4">
                {items.map((item: any) => {
                    const status = STATUS_CONFIG[item.statut] || STATUS_CONFIG.nouveau
                    const StatusIcon = status.icon
                    const isExpanded = selectedId === item.id
                    const refId = String(item.id).padStart(6, '0')

                    return (
                        <Card
                            key={item.id}
                            className={cn(
                                'bg-[#0a0f18] border-white/5 rounded-2xl overflow-hidden transition-all cursor-pointer',
                                isExpanded && 'border-[#FCD116]/20'
                            )}
                            onClick={() => setSelectedId(isExpanded ? null : item.id)}
                        >
                            <div className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black" style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                                        <StatusIcon size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-white font-bold text-lg">{item.prenom} {item.nom}</h3>
                                            <span className="text-[9px] font-mono text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">#RG-{refId}</span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Mail size={12} /> {item.email}</span>
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full border" style={{ color: status.color, borderColor: `${status.color}30`, backgroundColor: `${status.color}10` }}>
                                        {status.label}
                                    </span>
                                    {item.email_sent && (
                                        <span className="text-[9px] font-black text-[#008751] bg-[#008751]/10 px-2 py-1 rounded-full">✓ Email</span>
                                    )}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="border-t border-white/5 p-6 space-y-6 animate-in fade-in">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mb-1">Nationalité</span>
                                            <span className="text-white font-bold text-sm">{item.nationalite_actuelle || 'Non précisée'}</span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mb-1">Email envoyé</span>
                                            <span className={cn('font-bold text-sm', item.email_sent ? 'text-[#008751]' : 'text-red-400')}>
                                                {item.email_sent ? 'Oui ✓' : 'Non ✗'}
                                            </span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mb-1">Date</span>
                                            <span className="text-white font-bold text-sm">{new Date(item.created_at).toLocaleString('fr-FR')}</span>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-xl">
                                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mb-1">Référence</span>
                                            <span className="text-[#FCD116] font-mono font-bold text-sm">#RG-{refId}</span>
                                        </div>
                                    </div>

                                    {item.motivation && (
                                        <div className="bg-white/5 p-6 rounded-xl">
                                            <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest block mb-2">Motivation</span>
                                            <p className="text-white text-sm leading-relaxed">{item.motivation}</p>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">Changer le statut :</span>
                                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                            <button
                                                key={key}
                                                onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, key) }}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                                                    item.statut === key
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'hover:scale-105'
                                                )}
                                                style={{ color: cfg.color, borderColor: `${cfg.color}30`, backgroundColor: `${cfg.color}10` }}
                                                disabled={item.statut === key}
                                            >
                                                {cfg.label}
                                            </button>
                                        ))}
                                    </div>

                                    <a
                                        href={`mailto:${item.email}?subject=Re: Votre demande de nationalité #RG-${refId}&body=Bonjour ${item.prenom},%0A%0ASuite à votre demande de nationalité béninoise (réf: #RG-${refId}),%0A%0A`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#3b82f6] text-white rounded-xl font-bold text-sm hover:bg-[#3b82f6]/80 transition-all"
                                    >
                                        <Mail size={16} /> Répondre par Email
                                    </a>
                                </div>
                            )}
                        </Card>
                    )
                })}

                {items.length === 0 && (
                    <div className="text-center py-20 opacity-30">
                        <Flag size={48} className="mx-auto mb-4" />
                        <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Aucune demande trouvée</p>
                    </div>
                )}
            </div>
        </div>
    )
}
