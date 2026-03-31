'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Loader2, ChevronDown, ChevronRight, Pencil, Check } from 'lucide-react'

interface PageSection {
    id: string
    page: string
    section_key: string
    title: string
    content: Record<string, unknown> | unknown[]
    sort_order: number
    is_active: boolean
}

const PAGE_LABELS: Record<string, string> = {
    'a-propos': '📄 À Propos',
    'notre-histoire': '📜 Notre Histoire',
    'contact': '📞 Contact',
    'simulateur': '🔮 Simulateur Oracle',
    'nationalite': '🌍 Nationalité (Formulaire)',
}

export default function AdminPageContent() {
    const { t } = useTranslation();
    const [sections, setSections] = useState<PageSection[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedPage, setExpandedPage] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [editTitle, setEditTitle] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

    const fetchSections = async () => {
        const { data } = await supabase
            .from('page_sections')
            .select('*')
            .order('page')
            .order('sort_order')
        if (data) setSections(data)
        setLoading(false)
    }

    useEffect(() => {
        const load = async () => {
            await fetchSections()
        }
        load()
    }, [])

    const pages = [...new Set(sections.map(s => s.page))]

    const startEdit = (section: PageSection) => {
        setEditingId(section.id)
        setEditTitle(section.title)
        setEditContent(JSON.stringify(section.content, null, 2))
    }

    const handleSave = async (id: string) => {
        setSaving(true)
        try {
            const parsed = JSON.parse(editContent)
            await supabase
                .from('page_sections')
                .update({ title: editTitle, content: parsed, updated_at: new Date().toISOString() })
                .eq('id', id)
            setEditingId(null)
            await fetchSections()
            setSaveSuccess(id)
            setTimeout(() => setSaveSuccess(null), 2000)
        } catch {
            alert('JSON invalide ! Vérifiez la syntaxe.')
        }
        setSaving(false)
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white"><T>Contenu des Pages</T></h1>
                <p className="text-gray-400 text-sm mt-1">
                    Modifiez les textes, valeurs, timeline et informations de contact affichés sur le site.
                </p>
            </div>

            <div className="space-y-3">
                {pages.map(page => {
                    const pageSections = sections.filter(s => s.page === page)
                    const isExpanded = expandedPage === page

                    return (
                        <div key={page} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpandedPage(isExpanded ? null : page)}
                                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{PAGE_LABELS[page] || page}</span>
                                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                                        {pageSections.length} section(s)
                                    </span>
                                </div>
                                {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                            </button>

                            {isExpanded && (
                                <div className="border-t border-white/5 p-4 space-y-4">
                                    {pageSections.map(section => (
                                        <div key={section.id} className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h3 className="font-bold text-white text-sm">{section.title || section.section_key}</h3>
                                                    <span className="text-[10px] text-gray-500 font-mono">{section.section_key}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {saveSuccess === section.id && (
                                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> Sauvegardé
                                                        </span>
                                                    )}
                                                    {editingId !== section.id ? (
                                                        <Button size="sm" variant="outline" onClick={() => startEdit(section)} className="border-white/10 text-gray-300">
                                                            <Pencil className="w-3 h-3 mr-1" /> Modifier
                                                        </Button>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <Button size="sm" onClick={() => handleSave(section.id)} disabled={saving} className="bg-[#008751]">
                                                                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                                                                Sauvegarder
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="border-white/10 text-gray-300">
                                                                Annuler
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {editingId === section.id ? (
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block"><T>Titre de la section</T></label>
                                                        <Input title={t("Titre de la section")} placeholder={t("Titre")} value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400 mb-1 block"><T>Contenu (JSON)</T></label>
                                                        <textarea
                                                            title={t("Contenu JSON")}
                                                            placeholder='{"key": "value"}'
                                                            value={editContent}
                                                            onChange={e => setEditContent(e.target.value)}
                                                            rows={12}
                                                            className="w-full rounded-md bg-black/30 border border-white/10 text-green-300 px-3 py-2 text-xs font-mono leading-relaxed"
                                                            spellCheck={false}
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-500">
                                                    {Array.isArray(section.content) ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {(section.content as Record<string, unknown>[]).map((item: Record<string, unknown>, i: number) => (
                                                                <span key={i} className="bg-white/5 px-2 py-1 rounded text-gray-400">
                                                                    {(item.title as string) || (item.name as string) || (item.label as string) || (item.value as string) || `#${i + 1}`}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(section.content).slice(0, 6).map(([key, val]) => (
                                                                <span key={key} className="bg-white/5 px-2 py-1 rounded text-gray-400">
                                                                    {key}: {String(val).substring(0, 30)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
