'use client'

import { useTranslation, T } from '@/lib/translation';
import { useForm, useNavigation } from '@refinedev/core'
import { useState } from 'react'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GoldenIcon } from '@/components/ui/GoldenIcon'

const ICON_TYPES = ['cowrie', 'recade', 'drum', 'tata', 'assin', 'passport', 'tree']

export default function ProcessStepCreate() {
    const { t } = useTranslation();
    const { list } = useNavigation()
    const { onFinish, formLoading } = useForm({
        resource: 'process_steps',
        redirect: 'list',
        action: 'create',
    })

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        icon_type: 'cowrie',
        order: 1,
        is_active: true,
    })

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault()
        onFinish(formData)
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            <div className="flex items-center gap-6">
                <button
                    onClick={() => list('process_steps')}
                    title={t("Retour à la liste")}
                    className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-400 hover:text-[#FCD116] transition-all"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-white font-heading"><T>Nouvelle Étape</T></h1>
                    <p className="text-xs text-gray-500 mt-1"><T>Section &quot;Votre Parcours&quot;</T></p>
                </div>
            </div>

            <Card className="bg-[#0a0f18] border-white/5 p-8 rounded-[2.5rem]">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-3">
                        <label htmlFor="title" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Titre de l&apos;étape</T></label>
                        <input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                            placeholder={t("Ex: Prise de Contact")}
                            required
                            className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-lg font-bold focus:outline-none focus:border-[#FCD116]/30"
                        />
                    </div>
                    <div className="space-y-3">
                        <label htmlFor="description" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Description</T></label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                            placeholder={t("Description courte...")}
                            rows={3}
                            required
                            className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm focus:outline-none resize-none"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Icône</T></label>
                        <div className="flex gap-3 flex-wrap">
                            {ICON_TYPES.map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFormData((p) => ({ ...p, icon_type: type }))}
                                    className={`p-4 rounded-2xl border-2 transition-all ${formData.icon_type === type ? 'border-[#FCD116] bg-[#FCD116]/10' : 'border-white/5 bg-white/5'}`}
                                >
                                    {/* @ts-expect-error type is string from map but GoldenIcon expects specific union */}
                                    <GoldenIcon type={type} size={24} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label htmlFor="order" className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]"><T>Ordre d&apos;affichage</T></label>
                        <input
                            id="order"
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData((p) => ({ ...p, order: parseInt(e.target.value) || 1 }))}
                            title={t("Ordre d'affichage")}
                            placeholder="1"
                            className="w-32 bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white font-mono focus:outline-none"
                        />
                    </div>
                    <Button type="submit" disabled={formLoading} className="bg-benin-gradient text-white h-14 px-10 rounded-2xl font-black tracking-widest gap-3">
                        {formLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        CRÉER L&apos;ÉTAPE
                    </Button>
                </form>
            </Card>
        </div>
    )
}
