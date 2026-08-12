'use client'

// ══════════════════════════════════════════════════════════════
// Éditeur de galerie multi-images d'un slide Smart Slides.
// Chaque image porte sa propre légende (comme une vraie slide).
// Stockage : metadata.images de ai_proposal_items (jsonb, sans migration).
// Upload : /api/upload/proposal (même endpoint que l'image principale).
// ══════════════════════════════════════════════════════════════

import { useState, useRef } from 'react'
import { ImageSquare as ImagePlus, Trash as Trash2, CircleNotch as Loader2, DotsSixVertical as GripVertical, Link as Link2 } from '@phosphor-icons/react';

export interface SlideImage { url: string; caption?: string }

export default function SlideGalleryEditor({
    images, onChange,
}: {
    images: SlideImage[]
    onChange: (imgs: SlideImage[]) => void
}) {
    const [uploading, setUploading] = useState(false)
    const [urlDraft, setUrlDraft] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)

    const upload = async (file: File) => {
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/upload/proposal', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.url) onChange([...images, { url: data.url, caption: '' }])
            else alert(data.error || 'Erreur upload')
        } catch { alert('Erreur lors du téléchargement.') }
        finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
    }

    const move = (i: number, dir: -1 | 1) => {
        const j = i + dir
        if (j < 0 || j >= images.length) return
        const next = [...images]
        ;[next[i], next[j]] = [next[j], next[i]]
        onChange(next)
    }

    return (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Galerie du slide <span className="text-slate-600 normal-case font-medium tracking-normal">({images.length} image{images.length > 1 ? 's' : ''} : chacune avec sa légende)</span>
                </p>
            </div>

            {images.map((img, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2">
                    <div className="flex flex-col shrink-0">
                        <button type="button" title="Monter" onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-600 hover:text-white disabled:opacity-30 leading-none">▲</button>
                        <GripVertical size={12} className="text-slate-700 mx-auto" />
                        <button type="button" title="Descendre" onClick={() => move(i, 1)} disabled={i === images.length - 1} className="text-slate-600 hover:text-white disabled:opacity-30 leading-none">▼</button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-slate-800" />
                    <input
                        value={img.caption || ''}
                        onChange={e => onChange(images.map((x, k) => k === i ? { ...x, caption: e.target.value } : x))}
                        placeholder="Légende de cette image (affichée sur la slide)…"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-300 text-xs focus:border-[#FCD116] focus:outline-none"
                    />
                    <button type="button" title="Retirer cette image" onClick={() => onChange(images.filter((_, k) => k !== i))}
                        className="p-2 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 shrink-0">
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}

            <div className="flex gap-2">
                <label className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-slate-700 py-2.5 text-xs font-bold text-slate-300 hover:border-[#FCD116] hover:text-[#FCD116] transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                    {uploading ? 'Téléchargement…' : 'Ajouter une image'}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
                </label>
                <div className="flex-1 flex gap-1">
                    <input
                        value={urlDraft}
                        onChange={e => setUrlDraft(e.target.value)}
                        placeholder="Ou coller une URL d'image…"
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-500 text-xs focus:border-[#FCD116] focus:outline-none"
                    />
                    <button type="button" title="Ajouter l'URL" disabled={!/^https?:\/\/.+/.test(urlDraft)}
                        onClick={() => { onChange([...images, { url: urlDraft.trim(), caption: '' }]); setUrlDraft('') }}
                        className="px-3 rounded-lg bg-slate-800 text-slate-300 hover:text-[#FCD116] disabled:opacity-40">
                        <Link2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    )
}
