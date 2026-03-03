'use client'

import { useList, useUpdate } from '@refinedev/core'
import { useState } from 'react'
import {
    Mail, Edit2, Eye, Loader2, Save, Code, CheckCircle2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmailTemplate {
    id: number;
    name: string;
    slug: string;
    subject: string;
    html_body: string;
    variables?: string[];
    created_at?: string;
    updated_at?: string;
}

export default function EmailTemplatesList() {
    const queryResult = useList<EmailTemplate>({
        resource: 'email_templates',
        sorters: [{ field: 'created_at', order: 'desc' }],
    })
    const data = queryResult.query?.data
    const isLoading = queryResult.query?.isLoading
    const { mutate: updateTemplate } = useUpdate()

    const items = data?.data || []

    const [editingId, setEditingId] = useState<number | null>(null)
    const [editForm, setEditForm] = useState({ subject: '', html_body: '' })
    const [previewId, setPreviewId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const handleEdit = (item: EmailTemplate) => {
        setEditingId(item.id)
        setEditForm({ subject: item.subject, html_body: item.html_body })
        setPreviewId(null)
    }

    const handleSave = async () => {
        if (!editingId) return
        setSaving(true)
        try {
            updateTemplate({
                resource: 'email_templates',
                id: editingId,
                values: { ...editForm, updated_at: new Date().toISOString() },
            })
            setSaved(true)
            setTimeout(() => { setSaved(false); setEditingId(null) }, 2000)
        } finally {
            setSaving(false)
        }
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
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#3b82f6]">
                    <Mail size={18} />
                    <span className="text-[10px] font-black uppercase tracking-[0.5em]">Communication</span>
                </div>
                <h1 className="text-5xl font-black text-white font-heading tracking-tighter">
                    TEMPLATES <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#06b6d4]">EMAIL</span>
                </h1>
                <p className="text-gray-500 max-w-xl text-sm">
                    Personnalisez les emails automatiques envoyés aux clients.
                </p>
            </div>

            {/* Template Cards */}
            {items.map((item: EmailTemplate) => (
                <Card key={item.id} className="bg-[#0a0f18] border-white/5 rounded-[2rem] overflow-hidden">
                    <div className="p-8 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center">
                                <Mail size={24} className="text-[#3b82f6]" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">{item.name}</h3>
                                <p className="text-xs text-gray-500 font-mono mt-1">slug: {item.slug}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
                                className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-[#3b82f6] transition-all text-xs font-bold"
                            >
                                <Eye size={14} className="inline mr-2" /> Aperçu
                            </button>
                            <button
                                onClick={() => handleEdit(item)}
                                className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-[#FCD116] transition-all text-xs font-bold"
                            >
                                <Edit2 size={14} className="inline mr-2" /> Modifier
                            </button>
                        </div>
                    </div>

                    {/* Preview */}
                    {previewId === item.id && (
                        <div className="p-8 border-b border-white/5">
                            <div className="bg-white rounded-2xl p-1 max-h-[500px] overflow-auto shadow-inner">
                                <iframe
                                    srcDoc={item.html_body
                                        .replace(/\{\{nom\}\}/g, 'Dupont')
                                        .replace(/\{\{prenom\}\}/g, 'Jean')
                                        .replace(/\{\{nationalite\}\}/g, 'Française')
                                        .replace(/\{\{ref\}\}/g, '000042')
                                    }
                                    className="w-full min-h-[400px] border-0"
                                    title="Email Preview"
                                />
                            </div>
                        </div>
                    )}

                    {/* Edit Form */}
                    {editingId === item.id && (
                        <div className="p-8 space-y-6 animate-in fade-in">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Objet de l&apos;email</label>
                                <input
                                    value={editForm.subject}
                                    onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-white text-sm font-bold focus:outline-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] flex items-center gap-2">
                                    <Code size={12} /> Corps HTML
                                </label>
                                <textarea
                                    value={editForm.html_body}
                                    onChange={(e) => setEditForm((p) => ({ ...p, html_body: e.target.value }))}
                                    rows={20}
                                    className="w-full bg-white/5 border-2 border-white/5 rounded-2xl py-4 px-6 text-green-400 text-xs font-mono focus:outline-none resize-none leading-relaxed"
                                />
                            </div>
                            <div className="bg-[#FCD116]/10 p-4 rounded-xl border border-[#FCD116]/20">
                                <p className="text-[10px] text-[#FCD116] font-bold">
                                    Variables disponibles : {item.variables?.map((v: string) => `{{${v}}}`).join(', ')}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className={cn('rounded-2xl font-black tracking-widest gap-2', saved ? 'bg-[#008751]' : 'bg-[#3b82f6]')}
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                                    {saved ? 'SAUVEGARDÉ !' : 'SAUVEGARDER'}
                                </Button>
                                <Button variant="outline" onClick={() => setEditingId(null)} className="rounded-2xl border-white/10 text-gray-400">
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            ))}

            {items.length === 0 && (
                <div className="text-center py-20 opacity-30">
                    <Mail size={48} className="mx-auto mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Aucun template trouvé</p>
                </div>
            )}
        </div>
    )
}
