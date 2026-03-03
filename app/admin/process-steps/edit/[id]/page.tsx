'use client'

import { useForm, useNavigation } from '@refinedev/core'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GoldenIcon } from '@/components/ui/GoldenIcon'
import { ProcessStep } from '../../page'

const ICON_TYPES = ['cowrie', 'recade', 'drum', 'tata', 'assin', 'passport', 'tree']

export default function ProcessStepEdit() {
    const { id } = useParams()
    const { list } = useNavigation()
    const { onFinish, query, formLoading } = useForm<ProcessStep>({
        resource: 'process_steps',
        id: id as string,
        redirect: 'list',
        action: 'edit',
    })

    const record = query?.data?.data as ProcessStep | undefined

    const [formData, setFormData] = useState<Partial<ProcessStep> & { is_active?: boolean }>({
        title: '',
        description: '',
        icon_type: 'cowrie',
        order: 1,
        is_active: true,
    })

    const [initialized, setInitialized] = useState(false)
    useEffect(() => {
        if (record && !initialized) {
            setFormData({
                title: record.title || '',
                description: record.description || '',
                icon_type: (record.icon_type as any) || 'cowrie',
                order: record.order || 1,
                is_active: (record as unknown as { is_active?: boolean }).is_active !== false,
            })
            setInitialized(true)
        }
    }, [record, initialized])

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        onFinish(formData)
    }

    if (formLoading && !record) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <Loader2 className="animate-spin text-[#FCD116]" size={40} />
            </div>
        )
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            <div className="flex items-center gap-6">
                <button onClick={() => list('process_steps')} title="Retour à la liste" className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-400 hover:text-[#FCD116] transition-all">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-white font-heading">Modifier l&apos;Étape</h1>
                    <p className="text-xs text-gray-500 mt-1">ID: {id}</p>
                </div>
            </div>

            <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem]">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-3">
                        <label htmlFor="title" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Titre</label>
                        <input id="title" placeholder="Titre de l'étape" value={formData.title || ''} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} required className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-lg font-bold focus:outline-none focus:border-[#FCD116]/30" />
                    </div>
                    <div className="space-y-3">
                        <label htmlFor="description" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Description</label>
                        <textarea id="description" placeholder="Description de l'étape" value={formData.description || ''} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} rows={3} required className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none resize-none" />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Icône</label>
                        <div className="flex gap-3 flex-wrap">
                            {ICON_TYPES.map((type) => (
                                <button key={type} type="button" onClick={() => setFormData((p) => ({ ...p, icon_type: type }))} className={`p-4 rounded-2xl border-2 transition-all ${formData.icon_type === type ? 'border-[#FCD116] bg-[#FCD116]/10' : 'border-white/5 bg-white/5'}`}>
                                    {/* @ts-expect-error: GoldenIcon type is historically flexible */}
                                    <GoldenIcon type={type} size={24} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <label htmlFor="order" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Ordre</label>
                            <input id="order" type="number" placeholder="1" value={formData.order ?? 1} onChange={(e) => setFormData((p) => ({ ...p, order: parseInt(e.target.value) || 1 }))} className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white font-mono focus:outline-none" />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Visible</label>
                            <button
                                type="button"
                                onClick={() => setFormData((p) => ({ ...p, is_active: !p.is_active }))}
                                className={`w-full py-4 px-6 rounded-2xl font-bold text-sm transition-all ${formData.is_active ? 'bg-[#008751]/20 text-[#008751] border-2 border-[#008751]/30' : 'bg-red-500/20 text-red-400 border-2 border-red-500/30'}`}
                            >
                                {formData.is_active ? '✓ Active' : '✗ Masquée'}
                            </button>
                        </div>
                    </div>
                    <Button type="submit" disabled={formLoading} className="bg-benin-gradient text-white h-14 px-10 rounded-2xl font-black tracking-widest gap-3">
                        {formLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        METTRE À JOUR
                    </Button>
                </form>
            </Card>
        </div>
    )
}
