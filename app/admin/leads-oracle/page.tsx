'use client'

import { useList } from '@refinedev/core'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Phone, CheckCircle2, Clock, Search, Eye } from 'lucide-react'

export default function AdminLeadsOraclePage() {
    const listResult = useList({
        resource: 'eligibility_results',
        sorters: [{ field: 'created_at', order: 'desc' }],
    })

    const data = listResult?.result?.data || []
    const isLoading = listResult?.query?.isLoading ?? true
    const [searchQuery, setSearchQuery] = useState('')

    const leads = data || []
    const filtered = leads.filter((l: Record<string, unknown>) =>
        (l.client_nom as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.client_email as string)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.recommended_service as string)?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black font-heading tracking-tight flex items-center gap-3">
                    <Sparkles size={28} className="text-[#FCD116]" />
                    Leads Oracle
                </h1>
                <p className="text-gray-500 text-sm mt-1">Prospects qualifiés par le simulateur d&apos;éligibilité</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total Leads', count: leads.length, color: '#FCD116' },
                    { label: 'Score 90+', count: leads.filter((l: Record<string, unknown>) => (l.eligibility_score as number) >= 90).length, color: '#008751' },
                    { label: 'Avec Origines', count: leads.filter((l: Record<string, unknown>) => l.has_origins === true).length, color: '#3b82f6' },
                    { label: 'Non contactés', count: leads.filter((l: Record<string, unknown>) => l.is_contacted === false).length, color: '#E8112D' },
                ].map((stat) => (
                    <div key={stat.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black font-mono" style={{ color: stat.color }}>{stat.count}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un lead..."
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FCD116]"
                />
            </div>

            {/* List */}
            {isLoading ? (
                <div className="text-center py-16">
                    <div className="w-8 h-8 border-2 border-[#FCD116] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((lead: Record<string, unknown>) => (
                        <motion.div
                            key={lead.id as string}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                        <span className="text-lg font-black text-[#FCD116]">{(lead.eligibility_score as number)}%</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">
                                            {lead.client_prenom as string} {lead.client_nom as string}
                                            {(lead.has_origins as boolean) && <span className="ml-2 text-[9px] px-2 py-0.5 rounded-full bg-[#008751]/10 text-[#008751] border border-[#008751]/20 uppercase tracking-widest font-black">Origines 🇧🇯</span>}
                                        </h4>
                                        <p className="text-gray-500 text-xs flex items-center gap-3 mt-1">
                                            <span className="flex items-center gap-1"><Mail size={12} /> {lead.client_email as string}</span>
                                            {(lead.client_whatsapp as string) && <span className="flex items-center gap-1"><Phone size={12} /> {lead.client_whatsapp as string}</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-[#FCD116]/10 text-[#FCD116] border border-[#FCD116]/20">
                                        {lead.recommended_service as string}
                                    </span>
                                    {lead.is_contacted ? (
                                        <span className="flex items-center gap-1 text-[#008751] text-[10px] font-bold uppercase tracking-widest">
                                            <CheckCircle2 size={14} /> Contacté
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[#E8112D] text-[10px] font-bold uppercase tracking-widest">
                                            <Clock size={14} /> À contacter
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {filtered.length === 0 && (
                        <div className="text-center py-16 text-gray-500">
                            <Eye size={40} className="mx-auto mb-4 opacity-30" />
                            <p className="font-bold">Aucun lead trouvé</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
