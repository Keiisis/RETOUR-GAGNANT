'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { FloppyDisk as Save, CircleNotch as Loader2, CheckCircle as CheckCircle2, ArrowLeft, Plus, Trash as Trash2, Layout, FileText, CreditCard, Info, WarningCircle, ListChecks, ShieldCheck, Question, ArrowsDownUp } from '@phosphor-icons/react'
import Link from 'next/link'
import { mergeServiceLanding, type ServiceLandingContent } from '@/lib/content/serviceLanding'

const IC = 'w-full bg-white/[0.04] border border-white/10 rounded-xl py-2.5 px-3.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 placeholder:text-gray-600 transition-all'
const TA = IC + ' resize-none'
const LC = 'text-xs font-bold text-gray-400 mb-1.5 block'

function StrList({ items, onChange, placeholder = 'Ajouter…' }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
    const [nv, setNv] = useState('')
    const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const a = [...items];[a[i], a[j]] = [a[j], a[i]]; onChange(a) }
    return (
        <div className="space-y-2">
            {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 group">
                    <span className="text-[10px] font-black text-emerald-400 w-5 shrink-0">{i + 1}</span>
                    <input value={it} onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))} className="flex-1 bg-transparent text-white text-sm focus:outline-none border-b border-transparent focus:border-emerald-500/30 pb-0.5" />
                    <button onClick={() => move(i, -1)} className="p-1 text-gray-600 hover:text-white opacity-0 group-hover:opacity-100" title="Monter"><ArrowsDownUp size={12} /></button>
                    <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13} /></button>
                </div>
            ))}
            <div className="flex gap-2">
                <input value={nv} onChange={e => setNv(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && nv.trim()) { onChange([...items, nv.trim()]); setNv('') } }} placeholder={placeholder} className={`${IC} flex-1`} />
                <button onClick={() => { if (nv.trim()) { onChange([...items, nv.trim()]); setNv('') } }} disabled={!nv.trim()} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-bold text-xs px-4 rounded-xl flex items-center gap-1.5 disabled:opacity-30 transition-all shrink-0"><Plus size={14} /></button>
            </div>
        </div>
    )
}

type FieldDef = { key: string; ph: string; ta?: boolean }
function ObjList<T extends Record<string, string>>({ items, fields, onChange, blank }: { items: T[]; fields: FieldDef[]; onChange: (v: T[]) => void; blank: T }) {
    const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const a = [...items];[a[i], a[j]] = [a[j], a[i]]; onChange(a) }
    return (
        <div className="space-y-2.5">
            {items.map((it, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-emerald-400">#{i + 1}</span>
                        <div className="flex items-center gap-1">
                            <button onClick={() => move(i, -1)} className="p-1 text-gray-600 hover:text-white" title="Monter"><ArrowsDownUp size={12} /></button>
                            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1.5 text-red-500/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        {fields.map(f => f.ta
                            ? <textarea key={f.key} rows={2} value={it[f.key]} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, [f.key]: e.target.value } : x))} placeholder={f.ph} className={TA} />
                            : <input key={f.key} value={it[f.key]} onChange={e => onChange(items.map((x, j) => j === i ? { ...x, [f.key]: e.target.value } : x))} placeholder={f.ph} className={IC} />)}
                    </div>
                </div>
            ))}
            <button onClick={() => onChange([...items, { ...blank }])} className="w-full bg-white/[0.03] border border-dashed border-white/15 hover:border-emerald-500/40 text-gray-400 hover:text-emerald-400 font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all"><Plus size={14} /> Ajouter</button>
        </div>
    )
}

function Section({ icon, color, title, sub, children }: { icon: ReactNode; color: string; title: string; sub?: string; children: ReactNode }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ background: `${color}1a`, borderColor: `${color}33`, color }}>{icon}</div>
                <div><h2 className="text-base font-black text-white">{title}</h2>{sub && <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{sub}</p>}</div>
            </div>
            {children}
        </div>
    )
}

export default function ServiceLandingEditor({ page, defaults, title, backHref = '/admin/services', frontendPath }: { page: string; defaults: ServiceLandingContent; title: string; backHref?: string; frontendPath: string }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const [sectionId, setSectionId] = useState<string | null>(null)
    const [c, setC] = useState<ServiceLandingContent>(defaults)

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('page_sections').select('*').eq('page', page).eq('section_key', 'page_content').single()
            if (data) { setSectionId(data.id); setC(mergeServiceLanding(defaults, data.content as Partial<ServiceLandingContent>)) }
            setLoading(false)
        })()
    }, [page, defaults])

    const up = <K extends keyof ServiceLandingContent>(k: K, v: ServiceLandingContent[K]) => setC(prev => ({ ...prev, [k]: v }))

    const handleSave = async () => {
        setSaving(true); setSaved(false); setErr(null)
        try {
            if (sectionId) {
                const { error } = await supabase.from('page_sections').update({ content: c, updated_at: new Date().toISOString() }).eq('id', sectionId)
                if (error) throw error
            } else {
                const { data, error } = await supabase.from('page_sections').insert({ page, section_key: 'page_content', title: `Contenu ${title}`, content: c, sort_order: 1, is_active: true }).select().single()
                if (error) throw error
                if (data) setSectionId(data.id)
            }
            setSaved(true); setTimeout(() => setSaved(false), 3500)
        } catch (e) { setErr(e instanceof Error ? e.message : 'Échec de l\'enregistrement.') } finally { setSaving(false) }
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>

    const SaveBtn = ({ full = false }: { full?: boolean }) => (
        <button onClick={handleSave} disabled={saving} className={`bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm ${full ? 'px-8' : 'px-6'} py-3 rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all`}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            {saving ? 'Enregistrement…' : saved ? 'Enregistré !' : 'Enregistrer'}
        </button>
    )

    return (
        <div className="min-h-screen bg-[#0a0f14] py-8 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <Link href={backHref} className="text-xs text-gray-500 hover:text-white flex items-center gap-1.5 mb-2 transition-colors"><ArrowLeft size={12} /> Retour</Link>
                        <h1 className="text-2xl font-black text-white flex items-center gap-3"><Layout size={22} className="text-emerald-400" /> Contenu : {title}</h1>
                        <p className="text-xs text-gray-500 mt-1">Toutes les sections de <span className="font-mono text-gray-400">{frontendPath}</span> : 100% éditable.</p>
                    </div>
                    <SaveBtn />
                </div>

                {saved && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-400" /><p className="text-sm text-emerald-400 font-bold">Enregistré. Changements immédiatement visibles.</p></div>}
                {err && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3"><WarningCircle size={18} className="text-red-400 shrink-0 mt-0.5" /><div><p className="text-sm text-red-400 font-bold">Échec de l&apos;enregistrement</p><p className="text-xs text-red-300/70 mt-0.5">{err}</p></div></div>}

                {/* HERO */}
                <Section icon={<Layout size={18} />} color="#FCD116" title="Bannière Hero" sub="Badge, titre, sous-titre, puces, image, boutons">
                    <div><label className={LC}>Badge</label><input value={c.hero_badge} onChange={e => up('hero_badge', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Titre principal <span className="text-red-400">*</span></label><input value={c.hero_title} onChange={e => up('hero_title', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Sous-titre</label><textarea rows={2} value={c.hero_subtitle} onChange={e => up('hero_subtitle', e.target.value)} className={TA} /></div>
                    <div><label className={LC}>Puces de confiance</label><StrList items={c.hero_chips} onChange={v => up('hero_chips', v)} /></div>
                    <div><label className={LC}>Image (chemin, ex : /assets/icones/…png)</label><input value={c.hero_image} onChange={e => up('hero_image', e.target.value)} className={IC} /></div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <div><label className={LC}>Bouton 1 : texte</label><input value={c.cta1_label} onChange={e => up('cta1_label', e.target.value)} className={IC} /></div>
                        <div><label className={LC}>Bouton 1 : lien</label><input value={c.cta1_href} onChange={e => up('cta1_href', e.target.value)} className={IC} /></div>
                        <div><label className={LC}>Bouton 2 : texte</label><input value={c.cta2_label} onChange={e => up('cta2_label', e.target.value)} className={IC} /></div>
                        <div><label className={LC}>Bouton 2 : lien</label><input value={c.cta2_href} onChange={e => up('cta2_href', e.target.value)} className={IC} /></div>
                    </div>
                </Section>

                {/* PILIERS */}
                <Section icon={<ShieldCheck size={18} />} color="#10b981" title="Piliers (bande verte)" sub="4 blocs : icônes fixes">
                    <ObjList items={c.piliers} onChange={v => up('piliers', v)} blank={{ title: '', desc: '' }} fields={[{ key: 'title', ph: 'Titre' }, { key: 'desc', ph: 'Description' }]} />
                </Section>

                {/* INTRO + ÉTAPES */}
                <Section icon={<FileText size={18} />} color="#10b981" title="Introduction + étapes" sub="Texte principal + process">
                    <div><label className={LC}>Sur-titre (eyebrow)</label><input value={c.intro_eyebrow} onChange={e => up('intro_eyebrow', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Titre</label><input value={c.intro_title} onChange={e => up('intro_title', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Texte</label><textarea rows={5} value={c.intro_text} onChange={e => up('intro_text', e.target.value)} className={TA} /></div>
                    <div><label className={LC}>Titre du bloc étapes</label><input value={c.etapes_title} onChange={e => up('etapes_title', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Étapes (n° / titre / description)</label>
                        <ObjList items={c.etapes} onChange={v => up('etapes', v)} blank={{ num: '', title: '', desc: '' }} fields={[{ key: 'num', ph: 'N° (01)' }, { key: 'title', ph: 'Titre' }, { key: 'desc', ph: 'Description', ta: true }]} />
                    </div>
                </Section>

                {/* CONTRASTE */}
                <Section icon={<ListChecks size={18} />} color="#E8112D" title="Comparatif : En solo vs Avec RGB" sub="Aversion à la perte">
                    <div className="grid md:grid-cols-2 gap-3">
                        <div><label className={LC}>Titre</label><input value={c.contrast_title} onChange={e => up('contrast_title', e.target.value)} className={IC} /></div>
                        <div><label className={LC}>Titre (partie verte)</label><input value={c.contrast_accent} onChange={e => up('contrast_accent', e.target.value)} className={IC} /></div>
                    </div>
                    <div><label className={LC}>Intro</label><textarea rows={2} value={c.contrast_intro} onChange={e => up('contrast_intro', e.target.value)} className={TA} /></div>
                    <div><label className={LC}>« En solo »</label><StrList items={c.solo} onChange={v => up('solo', v)} /></div>
                    <div><label className={LC}>« Avec Retour Gagnant »</label><StrList items={c.avec} onChange={v => up('avec', v)} /></div>
                </Section>

                {/* FEATURES */}
                <Section icon={<FileText size={18} />} color="#3b82f6" title="Liste (pièces / prestations)" sub={`${c.features.length} élément(s)`}>
                    <div><label className={LC}>Sur-titre (eyebrow)</label><input value={c.features_eyebrow} onChange={e => up('features_eyebrow', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Titre</label><input value={c.features_title} onChange={e => up('features_title', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Intro</label><textarea rows={2} value={c.features_intro} onChange={e => up('features_intro', e.target.value)} className={TA} /></div>
                    <div><label className={LC}>Liste</label><StrList items={c.features} onChange={v => up('features', v)} placeholder="Ajouter un élément…" /></div>
                    <div><label className={LC}>Note (italique)</label><textarea rows={2} value={c.features_note} onChange={e => up('features_note', e.target.value)} className={TA} /></div>
                </Section>

                {/* RÉASSURANCE */}
                <Section icon={<ShieldCheck size={18} />} color="#10b981" title="Réassurance" sub="3 blocs : icônes fixes">
                    <ObjList items={c.reassurance} onChange={v => up('reassurance', v)} blank={{ title: '', desc: '' }} fields={[{ key: 'title', ph: 'Titre' }, { key: 'desc', ph: 'Description' }]} />
                </Section>

                {/* FAQ */}
                <Section icon={<Question size={18} />} color="#8b5cf6" title="Questions fréquentes" sub={`${c.faq.length} question(s)`}>
                    <ObjList items={c.faq} onChange={v => up('faq', v)} blank={{ q: '', r: '' }} fields={[{ key: 'q', ph: 'Question' }, { key: 'r', ph: 'Réponse', ta: true }]} />
                </Section>

                {/* CTA FINAL */}
                <Section icon={<CreditCard size={18} />} color="#00643C" title="CTA final (bandeau vert)" sub="Dernière conversion">
                    <div><label className={LC}>Titre</label><input value={c.final_title} onChange={e => up('final_title', e.target.value)} className={IC} /></div>
                    <div><label className={LC}>Texte</label><textarea rows={3} value={c.final_text} onChange={e => up('final_text', e.target.value)} className={TA} /></div>
                    <div><label className={LC}>Note sous le bouton</label><input value={c.final_note} onChange={e => up('final_note', e.target.value)} className={IC} /></div>
                </Section>

                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-5 flex items-start gap-4">
                    <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-gray-400 space-y-1"><p className="font-bold text-blue-400">Page concernée</p><p>Les modifications s&apos;appliquent immédiatement sur <span className="font-mono text-white">{frontendPath}</span>.</p></div>
                </div>

                <div className="flex justify-end pb-10"><SaveBtn full /></div>
            </div>
        </div>
    )
}
