'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { FloppyDisk as Save, CircleNotch as Loader2, CheckCircle as CheckCircle2, ArrowLeft, Plus, Trash as Trash2, Layout, FileText } from '@phosphor-icons/react';
import Link from 'next/link'

interface PageContent {
    hero_title: string
    hero_subtitle: string
    description: string
    documents: string[]
    documents_note: string
    pricing_label: string
    pricing_amount: string
    cta_title: string
    cta_description: string
    cta_button_text: string
}

const DEFAULT_CONTENT: PageContent = {
    hero_title: "Recherche Ancestrale",
    hero_subtitle: "Retrouvez la trace de ceux que l'histoire a effacés. Reconstruire sa lignée, c'est se réapproprier ce qui nous a été pris.",
    description: "Pour des millions de descendants de la diaspora africaine, une partie de l'arbre généalogique a été délibérément effacée par la traite transatlantique. Retrouver l'ancêtre réduit en esclavage, c'est un acte de mémoire, de dignité et d'identité. Nous mobilisons des bases de données spécialisées, des archives officielles et des associations expertes pour reconstituer votre lignée jusqu'aux racines béninoises ou africaines : avec méthode, rigueur et profond respect pour l'histoire de votre famille.",
    documents: [
        "Extrait de naissance de vos deux parents (père et mère)",
        "Extrait de naissance ou de décès de vos grands-parents (côté paternel et côté maternel)",
        "Tout autre document disponible : acte de mariage, acte notarié, acte militaire ou certificat de décès de vos grands-parents et arrière-grands-parents",
    ],
    documents_note: "L'ensemble des pièces sont à transmettre par voie électronique : une démarche simple et sécurisée pour débuter votre recherche.",
    pricing_label: "Recherche complète : archives, bases de données & associations spécialisées",
    pricing_amount: "250 €",
    cta_title: "Prêt à entreprendre cette démarche ?",
    cta_description: "Chaque histoire mérite d'être retrouvée. Prenez rendez-vous avec nos experts pour débuter votre recherche ancestrale et renouer avec vos origines africaines.",
    cta_button_text: "Prendre rendez-vous",
}

const IC = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all'
const TA = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all resize-none'
const LC = 'text-xs font-bold text-gray-400 mb-1.5 block'

export default function RechercheAncestraleAdminPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [sectionId, setSectionId] = useState<string | null>(null)
    const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT)
    const [newDoc, setNewDoc] = useState('')

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('page_sections')
                .select('*')
                .eq('page', 'recherche-ancestrale')
                .eq('section_key', 'page_content')
                .single()

            if (data) {
                setSectionId(data.id)
                setContent({ ...DEFAULT_CONTENT, ...(data.content as PageContent) })
            }
            setLoading(false)
        }
        load()
    }, [])

    const update = (field: keyof PageContent, value: unknown) => {
        setContent(prev => ({ ...prev, [field]: value }))
    }

    const updateDoc = (i: number, value: string) => {
        const docs = [...content.documents]
        docs[i] = value
        update('documents', docs)
    }

    const removeDoc = (i: number) => {
        update('documents', content.documents.filter((_, idx) => idx !== i))
    }

    const addDoc = () => {
        if (!newDoc.trim()) return
        update('documents', [...content.documents, newDoc.trim()])
        setNewDoc('')
    }

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        if (sectionId) {
            await supabase
                .from('page_sections')
                .update({ content, updated_at: new Date().toISOString() })
                .eq('id', sectionId)
        } else {
            const { data } = await supabase
                .from('page_sections')
                .insert({
                    page: 'recherche-ancestrale',
                    section_key: 'page_content',
                    title: 'Contenu page Recherche Ancestrale',
                    content,
                    sort_order: 1,
                    is_active: true,
                })
                .select('id')
                .single()
            if (data) setSectionId(data.id)
        }
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-[#008751]" size={32} />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/services"
                        className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-[#FCD116]">
                            <Layout size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Page Recherche Ancestrale</span>
                        </div>
                        <h1 className="text-2xl font-black text-white">Éditer le contenu</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href="/services/recherche-ancestrale"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-white transition-colors underline underline-offset-4"
                    >
                        Voir la page →
                    </a>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-[#008751] hover:bg-[#00a36b] disabled:opacity-50 text-white font-black text-xs tracking-widest px-5 py-3 rounded-xl transition-all shadow-lg"
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                        {saved ? 'SAUVEGARDÉ' : 'SAUVEGARDER'}
                    </button>
                </div>
            </div>

            {/* Héro */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Héro</p>
                <div>
                    <label className={LC}>Titre principal</label>
                    <input type="text" className={IC} value={content.hero_title} onChange={e => update('hero_title', e.target.value)} />
                </div>
                <div>
                    <label className={LC}>Sous-titre</label>
                    <textarea rows={2} className={TA} value={content.hero_subtitle} onChange={e => update('hero_subtitle', e.target.value)} />
                </div>
            </div>

            {/* Description */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Description</p>
                <textarea rows={6} className={TA} value={content.description} onChange={e => update('description', e.target.value)} />
            </div>

            {/* Documents */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Documents requis</p>
                <div className="space-y-2">
                    {content.documents.map((doc, i) => (
                        <div key={i} className="flex gap-2">
                            <input
                                type="text"
                                className={IC}
                                value={doc}
                                onChange={e => updateDoc(i, e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeDoc(i)}
                                className="shrink-0 p-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/10 hover:bg-red-500/20 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        className={IC}
                        placeholder="Ajouter un document..."
                        value={newDoc}
                        onChange={e => setNewDoc(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addDoc()}
                    />
                    <button
                        type="button"
                        onClick={addDoc}
                        className="shrink-0 px-4 py-2 rounded-xl bg-[#008751]/20 text-[#008751] border border-[#008751]/20 hover:bg-[#008751]/30 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
                <div>
                    <label className={LC}>Note sur l'envoi des pièces</label>
                    <textarea rows={2} className={TA} value={content.documents_note} onChange={e => update('documents_note', e.target.value)} />
                </div>
            </div>

            {/* Tarif */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tarif</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={LC}>Montant affiché</label>
                        <input type="text" className={IC} value={content.pricing_amount} placeholder="ex: 250 €" onChange={e => update('pricing_amount', e.target.value)} />
                    </div>
                    <div>
                        <label className={LC}>Description du tarif</label>
                        <input type="text" className={IC} value={content.pricing_label} onChange={e => update('pricing_label', e.target.value)} />
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div className="bg-[#0a0f18] border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <FileText size={14} className="text-[#FCD116]" />
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Appel à l'action</p>
                </div>
                <div>
                    <label className={LC}>Titre</label>
                    <input type="text" className={IC} value={content.cta_title} onChange={e => update('cta_title', e.target.value)} />
                </div>
                <div>
                    <label className={LC}>Description</label>
                    <textarea rows={2} className={TA} value={content.cta_description} onChange={e => update('cta_description', e.target.value)} />
                </div>
                <div>
                    <label className={LC}>Texte du bouton</label>
                    <input type="text" className={IC} value={content.cta_button_text} onChange={e => update('cta_button_text', e.target.value)} />
                </div>
            </div>
        </div>
    )
}
