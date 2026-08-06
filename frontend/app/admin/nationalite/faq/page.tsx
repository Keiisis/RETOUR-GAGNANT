'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash as Trash2, FloppyDisk as Save, CaretUp as ChevronUp, CaretDown as ChevronDown, PencilLine as Edit3, X, Question as HelpCircle } from '@phosphor-icons/react';

interface FAQ { id: string; question_fr: string; answer_fr: string; sort_order: number; is_active: boolean }

export default function AdminFaqPage() {
    const { t } = useTranslation();
    const [faqs, setFaqs] = useState<FAQ[]>([])
    const [editing, setEditing] = useState<string | null>(null)
    const [adding, setAdding] = useState(false)
    const [newQ, setNewQ] = useState('')
    const [newA, setNewA] = useState('')
    const [editQ, setEditQ] = useState('')
    const [editA, setEditA] = useState('')
    const [saving, setSaving] = useState(false)

    const load = async () => {
        const { data } = await supabase.from('nationality_faq').select('*').order('sort_order')
        setFaqs((data || []) as FAQ[])
    }

    useEffect(() => { load() }, [])

    const add = async () => {
        if (!newQ.trim() || !newA.trim()) return
        setSaving(true)
        await supabase.from('nationality_faq').insert({ question_fr: newQ, answer_fr: newA, sort_order: faqs.length + 1, is_active: true })
        setNewQ(''); setNewA(''); setAdding(false); setSaving(false); load()
    }

    const update = async (id: string) => {
        if (!editQ.trim() || !editA.trim()) return
        setSaving(true)
        await supabase.from('nationality_faq').update({ question_fr: editQ, answer_fr: editA }).eq('id', id)
        setEditing(null); setSaving(false); load()
    }

    const remove = async (id: string) => {
        if (!confirm('Supprimer cette question ?')) return
        await supabase.from('nationality_faq').delete().eq('id', id)
        load()
    }

    const toggle = async (id: string, active: boolean) => {
        await supabase.from('nationality_faq').update({ is_active: !active }).eq('id', id)
        load()
    }

    const moveUp = async (idx: number) => {
        if (idx === 0) return
        const a = faqs[idx], b = faqs[idx - 1]
        await Promise.all([
            supabase.from('nationality_faq').update({ sort_order: b.sort_order }).eq('id', a.id),
            supabase.from('nationality_faq').update({ sort_order: a.sort_order }).eq('id', b.id),
        ])
        load()
    }

    const moveDown = async (idx: number) => {
        if (idx >= faqs.length - 1) return
        const a = faqs[idx], b = faqs[idx + 1]
        await Promise.all([
            supabase.from('nationality_faq').update({ sort_order: b.sort_order }).eq('id', a.id),
            supabase.from('nationality_faq').update({ sort_order: a.sort_order }).eq('id', b.id),
        ])
        load()
    }

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]"><T>Nationalité</T></span>
                    <h1 className="text-2xl font-black text-white flex items-center gap-2"><HelpCircle size={22} className="text-emerald-400" /> <T>Gestion FAQ</T></h1>
                    <p className="text-xs text-gray-500 mt-1">{faqs.length} questions — Ajoutez, modifiez, réordonnez ou supprimez</p>
                </div>

                <div className="space-y-2">
                    {faqs.map((faq, idx) => (
                        <div key={faq.id} className={`bg-white/[0.03] border rounded-xl overflow-hidden transition-all ${faq.is_active ? 'border-white/5' : 'border-red-500/10 opacity-60'}`}>
                            {editing === faq.id ? (
                                <div className="p-5 space-y-3">
                                    <input value={editQ} onChange={e => setEditQ(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none" placeholder={t("Question")} />
                                    <textarea value={editA} onChange={e => setEditA(e.target.value)} rows={6} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none resize-none" placeholder={t("Réponse")} />
                                    <div className="flex gap-2">
                                        <button onClick={() => update(faq.id)} disabled={saving} className="bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1"><Save size={12} /> <T>Sauvegarder</T></button>
                                        <button onClick={() => setEditing(null)} className="bg-white/5 text-gray-400 text-xs px-4 py-2 rounded-lg"><T>Annuler</T></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5 flex items-start gap-3">
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button onClick={() => moveUp(idx)} className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-white"><ChevronUp size={14} /></button>
                                        <span className="text-[10px] font-black text-gray-600 text-center">{idx + 1}</span>
                                        <button onClick={() => moveDown(idx)} className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-white"><ChevronDown size={14} /></button>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white mb-1 truncate">{faq.question_fr}</p>
                                        <p className="text-xs text-gray-500 line-clamp-2">{faq.answer_fr}</p>
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                        <button onClick={() => { setEditing(faq.id); setEditQ(faq.question_fr); setEditA(faq.answer_fr) }} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"><Edit3 size={14} /></button>
                                        <button onClick={() => toggle(faq.id, faq.is_active)} className={`p-1.5 rounded-lg text-[10px] font-bold ${faq.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{faq.is_active ? 'ON' : 'OFF'}</button>
                                        <button onClick={() => remove(faq.id)} className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {adding ? (
                    <div className="mt-4 bg-white/[0.03] border border-emerald-500/20 rounded-xl p-5 space-y-3">
                        <input value={newQ} onChange={e => setNewQ(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none" placeholder={t("Nouvelle question")} />
                        <textarea value={newA} onChange={e => setNewA(e.target.value)} rows={5} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none resize-none" placeholder={t("Réponse détaillée...")} />
                        <div className="flex gap-2">
                            <button onClick={add} disabled={saving} className="bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1"><Save size={12} /> <T>Ajouter</T></button>
                            <button onClick={() => setAdding(false)} className="bg-white/5 text-gray-400 text-xs px-4 py-2 rounded-lg"><T>Annuler</T></button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setAdding(true)} className="mt-4 bg-white/5 hover:bg-white/10 text-white font-bold text-xs px-4 py-3 rounded-xl transition-all flex items-center gap-2 w-full justify-center border border-dashed border-white/10"><Plus size={14} /> <T>Ajouter une question</T></button>
                )}
            </div>
        </div>
    )
}
