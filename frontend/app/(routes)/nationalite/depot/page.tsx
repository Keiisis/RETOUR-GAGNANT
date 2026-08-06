'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CloudArrowUp as UploadCloud, Plus, Trash as Trash2, CircleNotch as Loader2, Check, ShieldCheck, FileText } from '@phosphor-icons/react';

export const dynamic = 'force-dynamic'

interface Row { id: string; label: string; file: File | null }
const newRow = (): Row => ({ id: Math.random().toString(36).slice(2), label: '', file: null })

function DepotInner() {
    const params = useSearchParams()
    const token = params.get('t') || ''

    const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
    const [errorMsg, setErrorMsg] = useState('')
    const [ref, setRef] = useState('')
    const [prenom, setPrenom] = useState('')
    const [rows, setRows] = useState<Row[]>([newRow()])
    const [sending, setSending] = useState(false)
    const [done, setDone] = useState(0)

    useEffect(() => {
        if (!token) { setState('error'); setErrorMsg('Lien invalide.'); return }
        fetch(`/api/nationality/depot?token=${encodeURIComponent(token)}`)
            .then(r => r.json().then(j => ({ ok: r.ok, j })))
            .then(({ ok, j }) => {
                if (ok && j.ok) { setRef(j.ref || ''); setPrenom(j.prenom || ''); setState('ok') }
                else { setState('error'); setErrorMsg(j.error || 'Lien invalide ou expiré.') }
            })
            .catch(() => { setState('error'); setErrorMsg('Erreur réseau.') })
    }, [token])

    const submit = async () => {
        const ready = rows.filter(r => r.file && r.label.trim())
        if (ready.length === 0) { alert('Ajoutez au moins un fichier avec un nom.'); return }
        setSending(true)
        try {
            const docs: { label: string; path: string }[] = []
            for (const r of ready) {
                const ext = (r.file!.name.split('.').pop() || 'bin').toLowerCase()
                const fd = new FormData()
                fd.append('file', r.file!)
                fd.append('key', r.label.trim())
                fd.append('ext', ext)
                const up = await fetch('/api/nationality/upload-file', { method: 'POST', body: fd })
                const uj = await up.json().catch(() => ({}))
                if (!up.ok || !uj.path) throw new Error(uj.error || `Échec de l'envoi de « ${r.label} »`)
                docs.push({ label: r.label.trim(), path: uj.path })
            }
            const res = await fetch('/api/nationality/depot', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, docs }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.success) throw new Error(j.error || 'Envoi impossible.')
            setDone(docs.length)
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Erreur.')
        } finally { setSending(false) }
    }

    return (
        <div className="min-h-screen bg-[#F7F4EE] flex flex-col items-center px-4 py-10">
            {/* Liseré tricolore */}
            <div className="w-full max-w-xl h-1.5 rounded-full overflow-hidden flex mb-6">
                <div className="flex-[46] bg-[#008751]" /><div className="flex-[27] bg-[#FCD116]" /><div className="flex-[27] bg-[#E8112D]" />
            </div>

            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200/80 shadow-[0_18px_50px_rgba(60,60,60,0.10)] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#008751]">Retour Gagnant Bénin</p>
                    <h1 className="text-2xl font-black text-[#1F1B16] mt-1">Dépôt de vos pièces</h1>
                </div>

                {state === 'loading' && (
                    <div className="p-12 flex flex-col items-center gap-3 text-slate-400"><Loader2 size={26} className="animate-spin" /> Vérification du lien…</div>
                )}

                {state === 'error' && (
                    <div className="p-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#FDECEA] flex items-center justify-center mx-auto mb-4"><ShieldCheck size={26} className="text-[#E8112D]" /></div>
                        <h2 className="text-lg font-black text-[#1F1B16] mb-1">Lien indisponible</h2>
                        <p className="text-sm text-slate-500">{errorMsg}</p>
                    </div>
                )}

                {state === 'ok' && done > 0 && (
                    <div className="p-10 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#E6F3ED] flex items-center justify-center mx-auto mb-4"><Check size={28} className="text-[#008751]" /></div>
                        <h2 className="text-lg font-black text-[#1F1B16] mb-1">Merci {prenom} !</h2>
                        <p className="text-sm text-slate-500">{done} pièce(s) transmise(s). Notre équipe les traitera pour votre dossier {ref}.</p>
                    </div>
                )}

                {state === 'ok' && done === 0 && (
                    <>
                        <div className="px-6 pt-5">
                            <p className="text-sm text-slate-600">
                                Bonjour {prenom || ''}, ajoutez ici les pièces demandées pour votre dossier
                                {ref ? <> <span className="font-bold text-[#1F1B16]">{ref}</span></> : ''}.
                                Donnez un nom clair à chaque fichier.
                            </p>
                        </div>
                        <div className="p-6 space-y-3">
                            {rows.map(r => (
                                <div key={r.id} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[#F7F4EE] border border-slate-200 rounded-2xl p-3">
                                    <input
                                        type="text" value={r.label}
                                        onChange={e => setRows(prev => prev.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))}
                                        placeholder="Nom de la pièce (ex : Acte de naissance)"
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-[#1F1B16] focus:outline-none focus:border-[#008751]"
                                    />
                                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 cursor-pointer hover:border-[#008751]/50 whitespace-nowrap">
                                        <UploadCloud size={15} className="text-[#008751]" />
                                        <span className="truncate max-w-[150px]">{r.file ? r.file.name : 'Choisir un fichier'}</span>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx" className="hidden"
                                            onChange={e => { const f = e.target.files?.[0] || null; setRows(prev => prev.map(x => x.id === r.id ? { ...x, file: f } : x)) }} />
                                    </label>
                                    {rows.length > 1 && (
                                        <button onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))} title="Retirer" className="p-2 rounded-xl text-[#E8112D] hover:bg-[#FDECEA] self-center"><Trash2 size={16} /></button>
                                    )}
                                </div>
                            ))}
                            <button onClick={() => setRows(prev => [...prev, newRow()])} className="flex items-center gap-1.5 text-sm font-bold text-[#008751] hover:text-[#00643C]"><Plus size={15} /> Ajouter une autre pièce</button>
                        </div>
                        <div className="px-6 pb-6">
                            <button onClick={submit} disabled={sending}
                                className="w-full py-3.5 rounded-2xl bg-[#008751] hover:bg-[#00643C] text-white font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-60 shadow-[0_12px_28px_-10px_rgba(0,135,81,0.65)]">
                                {sending ? <><Loader2 size={17} className="animate-spin" /> Envoi en cours…</> : <><FileText size={17} /> Transmettre mes pièces</>}
                            </button>
                            <p className="text-[11px] text-slate-400 text-center mt-3">Transmission sécurisée. Vos documents ne sont visibles que par notre équipe.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default function DepotPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center text-slate-400"><Loader2 size={26} className="animate-spin" /></div>}>
            <DepotInner />
        </Suspense>
    )
}
