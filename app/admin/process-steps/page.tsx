'use client'

import { useList, useNavigation, useDelete, useUpdate } from '@refinedev/core'
import { useState } from 'react'
import {
    Plus, Trash2, Edit2, ArrowUpDown, GripVertical,
    Loader2, Sparkles, CheckCircle2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GoldenIcon } from '@/components/ui/GoldenIcon'
import { cn } from '@/lib/utils'
import { BaseRecord } from '@refinedev/core'

export interface ProcessStep extends BaseRecord {
    id: string;
    title?: string;
    description?: string;
    icon_type?: string;
    order?: number;
    created_at?: string;
}

export default function ProcessStepsList() {
    const { create, edit } = useNavigation()
    const queryResult = useList<ProcessStep>({
        resource: 'process_steps',
        sorters: [{ field: 'order', order: 'asc' }],
    })

    const returnedData = (queryResult as unknown as { data?: { data: ProcessStep[] }, query?: { data?: { data: ProcessStep[] } } }).data ||
        (queryResult as unknown as { query?: { data?: { data: ProcessStep[] } } }).query?.data;
    const isLoading = (queryResult as unknown as { isLoading?: boolean }).isLoading ||
        (queryResult as unknown as { query?: { isLoading?: boolean } }).query?.isLoading;

    const { mutate: deleteItem } = useDelete()

    const items = returnedData?.data || []

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
                    <div className="flex items-center gap-2 text-[#FCD116]">
                        <Sparkles size={18} />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em]">Section Frontend</span>
                    </div>
                    <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                        VOTRE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#FCD116]">PARCOURS</span>
                    </h1>
                    <p className="text-gray-500 max-w-xl text-sm">Gérez les étapes de la démarche affichées sur le site public.</p>
                </div>
                <Button
                    onClick={() => create('process_steps')}
                    className="bg-benin-gradient text-white h-14 px-8 rounded-2xl font-black tracking-widest gap-2 shadow-xl"
                >
                    <Plus size={20} /> AJOUTER UNE ÉTAPE
                </Button>
            </div>

            {/* Steps List */}
            <div className="space-y-4">
                {items.map((step, index: number) => (
                    <Card
                        key={step.id}
                        className="bg-[#0a0f18] border-white/5 rounded-2xl p-6 flex items-center justify-between hover:border-white/10 transition-all group"
                    >
                        <div className="flex items-center gap-6">
                            <div className="text-gray-600">
                                <GripVertical size={20} />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-[#FCD116]/10 border border-[#FCD116]/20 flex items-center justify-center">
                                <span className="text-[#FCD116] font-black text-lg">{index + 1}</span>
                            </div>
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                {/* @ts-ignore */}
                                <GoldenIcon type={step.icon_type || 'cowrie'} size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">{step.title}</h3>
                                <p className="text-gray-500 text-sm mt-1">{step.description}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => edit('process_steps', step.id)}
                                className="p-3 bg-white/5 text-gray-400 rounded-xl hover:bg-[#FCD116] hover:text-black transition-all"
                                title="Modifier"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Supprimer cette étape ?')) deleteItem({ resource: 'process_steps', id: step.id })
                                }}
                                className="p-3 bg-white/5 text-gray-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                title="Supprimer"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
