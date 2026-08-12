'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Users, PaperPlaneTilt as Send, CircleNotch as Loader2, CheckCircle as CheckCircle2, Warning as AlertTriangle, Envelope as Mail } from '@phosphor-icons/react';

interface Campaign {
    id: string
    subject: string
    status: string
    recipient_count: number
    sent_count: number
    failed_count: number
    sent_by_nom: string | null
    created_at: string
}

interface Subscriber {
    id: string
    email: string
    status: string
    source: string | null
    subscribed_at: string
    unsubscribed_at: string | null
}

export default function AdminNewsletterPage() {
    const [activeSubscribers, setActive] = useState(0)
    const [totalSubscribers, setTotal] = useState(0)
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [subscribers, setSubscribers] = useState<Subscriber[]>([])
    const [loading, setLoading] = useState(true)

    const [subject, setSubject] = useState('')
    const [bodyHtml, setBodyHtml] = useState('')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/newsletter', { credentials: 'same-origin', cache: 'no-store' })
            if (res.ok) {
                const j = await res.json()
                setActive(j.activeSubscribers || 0)
                setTotal(j.totalSubscribers || 0)
                setCampaigns(j.campaigns || [])
                setSubscribers(j.subscribers || [])
            }
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    const handleSend = async () => {
        if (!subject.trim() || !bodyHtml.trim()) {
            setResult({ ok: false, msg: 'Renseignez le sujet et le contenu.' }); return
        }
        if (!confirm(`Envoyer cette newsletter à ${activeSubscribers} abonné(s) actif(s) ?`)) return
        setSending(true); setResult(null)
        try {
            const res = await fetch('/api/admin/newsletter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ subject: subject.trim(), html: bodyHtml.trim() }),
            })
            const j = await res.json()
            if (!res.ok) throw new Error(j.error || `Erreur ${res.status}`)
            setResult({ ok: true, msg: `Envoyée : ${j.sent} reçu(s)${j.failed ? `, ${j.failed} échec(s)` : ''} sur ${j.recipients}.` })
            setSubject(''); setBodyHtml('')
            load()
        } catch (e) {
            setResult({ ok: false, msg: e instanceof Error ? e.message : 'Échec envoi' })
        } finally { setSending(false) }
    }

    const fmtDate = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const statusBadge = (s: string) => s === 'sent' ? 'bg-emerald-100 text-emerald-700' : s === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600/10 flex items-center justify-center">
                    <Megaphone className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                    <h1 className="text-xl font-black text-[#1a2332]">Newsletter</h1>
                    <p className="text-xs text-gray-500">Diffusez vos actualités aux abonnés du site.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-emerald-700"><Users size={15} /><span className="text-[10px] font-black uppercase tracking-wider">Abonnés actifs</span></div>
                    <p className="text-2xl font-black text-[#1a2332] mt-1">{loading ? '…' : activeSubscribers}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500"><Mail size={15} /><span className="text-[10px] font-black uppercase tracking-wider">Total inscrits</span></div>
                    <p className="text-2xl font-black text-[#1a2332] mt-1">{loading ? '…' : totalSubscribers}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[#A68B3C]"><Send size={15} /><span className="text-[10px] font-black uppercase tracking-wider">Campagnes</span></div>
                    <p className="text-2xl font-black text-[#1a2332] mt-1">{loading ? '…' : campaigns.length}</p>
                </div>
            </div>

            {/* Composer */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-black text-[#1a2332]">Composer une campagne</h2>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Sujet</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex : Nos nouveautés de juin"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#1a2332] focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Contenu (HTML autorisé)</label>
                    <textarea value={bodyHtml} onChange={e => setBodyHtml(e.target.value)} rows={10}
                        placeholder="<h2>Bonjour </h2><p>Voici nos actualités…</p>"
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1a2332] font-mono focus:outline-none focus:border-emerald-500 resize-y" />
                    <p className="text-[10px] text-gray-400 mt-1">L&apos;email est automatiquement habillé (logo, bandeau tricolore, lien de désinscription).</p>
                </div>
                {result && (
                    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {result.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{result.msg}
                    </div>
                )}
                <div className="flex justify-end">
                    <button onClick={handleSend} disabled={sending || activeSubscribers === 0}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-3 rounded-xl transition-all disabled:opacity-50">
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        {sending ? 'Envoi en cours…' : `Envoyer à ${activeSubscribers} abonné(s)`}
                    </button>
                </div>
            </div>

            {/* Historique */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100"><h2 className="text-sm font-black text-[#1a2332]">Historique des campagnes</h2></div>
                {campaigns.length === 0 ? (
                    <p className="text-xs text-gray-400 italic p-5 text-center">Aucune campagne envoyée pour le moment.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="text-gray-400 border-b border-gray-100">
                                <th className="text-left font-bold px-4 py-2.5">Sujet</th>
                                <th className="text-center font-bold px-3 py-2.5">Statut</th>
                                <th className="text-right font-bold px-3 py-2.5">Reçus</th>
                                <th className="text-right font-bold px-3 py-2.5">Échecs</th>
                                <th className="text-left font-bold px-3 py-2.5">Par</th>
                                <th className="text-right font-bold px-4 py-2.5">Date</th>
                            </tr></thead>
                            <tbody>
                                {campaigns.map(c => (
                                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 text-[#1a2332] font-semibold truncate max-w-[260px]">{c.subject}</td>
                                        <td className="px-3 py-2.5 text-center"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge(c.status)}`}>{c.status}</span></td>
                                        <td className="px-3 py-2.5 text-right font-mono text-emerald-700">{c.sent_count}/{c.recipient_count}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-red-500">{c.failed_count || '-'}</td>
                                        <td className="px-3 py-2.5 text-gray-500">{c.sent_by_nom || '-'}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-400">{fmtDate(c.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══ LISTE NOMINATIVE DES ABONNÉS ═══ */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-emerald-700" />
                        <h2 className="text-sm font-black text-[#1a2332]">Abonnés</h2>
                        <span className="text-[11px] text-gray-400 font-medium">{subscribers.length} inscrit(s) : {activeSubscribers} actif(s)</span>
                    </div>
                </div>
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-emerald-600" /></div>
                ) : subscribers.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        <Mail size={26} className="mx-auto mb-2 text-gray-300" />
                        Aucun abonné pour le moment.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead><tr className="border-b border-gray-100 text-gray-400">
                                <th className="text-left font-bold px-4 py-2.5">Email</th>
                                <th className="text-center font-bold px-3 py-2.5">Statut</th>
                                <th className="text-left font-bold px-3 py-2.5">Source</th>
                                <th className="text-right font-bold px-4 py-2.5">Inscrit le</th>
                            </tr></thead>
                            <tbody>
                                {subscribers.map(s => (
                                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 text-[#1a2332] font-semibold">{s.email}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {s.status === 'active' ? 'Actif' : 'Désabonné'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-gray-500">{s.source || 'Site web'}</td>
                                        <td className="px-4 py-2.5 text-right text-gray-400">{fmtDate(s.subscribed_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
