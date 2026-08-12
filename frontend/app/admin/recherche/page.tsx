'use client'

// ══════════════════════════════════════════════════════════════
//  ADMIN : RECHERCHE GLOBALE
//
//  Un client par nom, e-mail, téléphone, numéro de dossier ou de
//  facture : retrouvé d'un seul champ, à travers dossiers, factures,
//  messages et fiches clients. Résultats groupés, chacun cliquable vers
//  sa section. Requête déclenchée à la frappe (débounce 350 ms).
// ══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { MagnifyingGlass as Search, CircleNotch as Loader2, FolderOpen, Receipt, ChatText as MessageSquare, User, Phone, Envelope as Mail } from '@phosphor-icons/react';
import { formatPrice, type CurrencyCode } from '@/lib/currency'

interface Resultat {
    dossiers: Array<{ id: string; ref: string; client: string; statut: string; lien: string }>
    factures: Array<{ id: string; numero: string; client: string; total: number; devise: string; statut: string; lien: string }>
    messages: Array<{ id: string; sujet: string; expediteur: string; lien: string }>
    clients: Array<{ id: string; nom: string; email: string; phone: string | null }>
}

const VIDE: Resultat = { dossiers: [], factures: [], messages: [], clients: [] }

export default function AdminRecherchePage() {
    const [q, setQ] = useState('')
    const [res, setRes] = useState<Resultat>(VIDE)
    const [total, setTotal] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const chercher = useCallback(async (terme: string) => {
        if (terme.trim().length < 2) { setRes(VIDE); setTotal(null); return }
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const r = await fetch(`/api/admin/search?q=${encodeURIComponent(terme)}`, {
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                cache: 'no-store',
            })
            const d = await r.json().catch(() => ({}))
            if (r.ok) { setRes(d.resultat || VIDE); setTotal(d.total ?? 0) }
            else { setRes(VIDE); setTotal(null) }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => chercher(q), 350)
        return () => { if (timer.current) clearTimeout(timer.current) }
    }, [q, chercher])

    const sectionVide = total === 0

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Search className="text-indigo-500" size={22} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Recherche globale</h1>
                    <p className="text-sm text-gray-500">Dossiers, factures, messages et clients, d'un seul champ</p>
                </div>
            </div>

            <div className="relative mb-6">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                {loading && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                <input
                    autoFocus
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Nom, e-mail, téléphone, n° dossier, n° facture…"
                    className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-indigo-500/50 outline-none text-gray-900 dark:text-white text-sm"
                />
            </div>

            {total !== null && (
                <p className="text-xs text-gray-400 mb-4">{total} résultat(s) pour « {q} »</p>
            )}

            {sectionVide && (
                <div className="text-center py-16 text-gray-400 text-sm">Aucun résultat.</div>
            )}

            <div className="space-y-6">
                <Groupe titre="Clients" icon={User} items={res.clients} vide="Aucun client">
                    {res.clients.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{c.nom}</p>
                                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                    <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>
                                    {c.phone && <span className="flex items-center gap-1"><Phone size={11} /> {c.phone}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </Groupe>

                <Groupe titre="Dossiers" icon={FolderOpen} items={res.dossiers} vide="Aucun dossier">
                    {res.dossiers.map(d => (
                        <Link key={d.id} href={d.lien} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{d.ref}</p>
                                <p className="text-[11px] text-gray-500 truncate">{d.client}</p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 flex-shrink-0">{d.statut}</span>
                        </Link>
                    ))}
                </Groupe>

                <Groupe titre="Factures" icon={Receipt} items={res.factures} vide="Aucune facture">
                    {res.factures.map(f => (
                        <Link key={f.id} href={f.lien} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{f.numero}</p>
                                <p className="text-[11px] text-gray-500 truncate">{f.client}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(f.total, f.devise as CurrencyCode)}</p>
                                <p className="text-[10px] text-gray-400">{f.statut}</p>
                            </div>
                        </Link>
                    ))}
                </Groupe>

                <Groupe titre="Messages" icon={MessageSquare} items={res.messages} vide="Aucun message">
                    {res.messages.map(m => (
                        <Link key={m.id} href={m.lien} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition">
                            <div className="min-w-0">
                                <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{m.sujet}</p>
                                <p className="text-[11px] text-gray-500 truncate">{m.expediteur}</p>
                            </div>
                        </Link>
                    ))}
                </Groupe>
            </div>
        </div>
    )
}

function Groupe({ titre, icon: Icon, items, vide, children }: {
    titre: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    items: unknown[]
    vide: string
    children: React.ReactNode
}) {
    if (items.length === 0) return null
    return (
        <div>
            <div className="flex items-center gap-2 mb-2 px-1">
                <Icon size={15} className="text-gray-400" />
                <h2 className="text-xs font-black uppercase tracking-wide text-gray-500">{titre}</h2>
                <span className="text-[10px] text-gray-400">({items.length})</span>
            </div>
            <div className="bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-1.5">
                {children || <p className="text-xs text-gray-400 p-3">{vide}</p>}
            </div>
        </div>
    )
}
