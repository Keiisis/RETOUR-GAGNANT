'use client'

/**
 * Envoyer un Smart Slide dans l'application d'un client — et le montrer.
 *
 * Le panel ne distinguait pas une proposition simplement partagée par lien
 * d'une proposition réellement adressée à un client. Ce composant apporte les
 * deux : le BADGE d'état, et l'action d'envoi.
 *
 * Deux chemins, parce que les deux existent dans la vraie vie :
 *   · rattachement AUTOMATIQUE si l'email saisi sur la proposition correspond
 *     à un compte — le cas courant, aucun effort demandé à l'agent ;
 *   · choix EXPLICITE dans la liste des comptes, avec recherche, quand l'email
 *     diffère ou manque.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    DeviceMobile as Smartphone, LinkSimple as LinkIcon, CircleNotch as Loader2,
    MagnifyingGlass as Search, X, CheckCircle as CheckCircle2, PenNib as Signature,
} from '@phosphor-icons/react'

export interface Rattachement {
    client_id: string | null
    client_nom: string | null
    sent_to_mobile: boolean
    sent_at: string | null
    signed_at: string | null
    signed_name: string | null
}

interface ClientCompte {
    id: string
    nom: string | null
    prenom: string | null
    email: string | null
}

/** Badge d'état : lisible d'un coup d'œil dans une liste. */
export function BadgeRattachement({ r }: { r?: Rattachement }) {
    if (r?.signed_at) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black text-amber-300">
                <Signature size={11} /> Signé{r.signed_name ? ` · ${r.signed_name}` : ''}
            </span>
        )
    }
    if (r?.sent_to_mobile && r.client_nom) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-300">
                <Smartphone size={11} /> Dans l&apos;app de {r.client_nom}
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-black text-gray-400">
            <LinkIcon size={11} /> Lien secret
        </span>
    )
}

export default function EnvoyerDansApp({
    proposalId, rattachement, onChange,
}: {
    proposalId: string
    rattachement?: Rattachement
    onChange?: () => void
}) {
    const [ouvert, setOuvert] = useState(false)
    const [envoi, setEnvoi] = useState(false)
    const [recherche, setRecherche] = useState('')
    const [comptes, setComptes] = useState<ClientCompte[]>([])
    const [chargement, setChargement] = useState(false)
    const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    const chercher = useCallback(async (q: string) => {
        setChargement(true)
        try {
            const res = await fetch(`/api/proposals/envoyer-app?q=${encodeURIComponent(q)}`)
            const j = await res.json()
            setComptes(Array.isArray(j.clients) ? j.clients : [])
        } catch { setComptes([]) }
        finally { setChargement(false) }
    }, [])

    useEffect(() => {
        if (!ouvert) return
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => chercher(recherche), 250)
        return () => { if (debounce.current) clearTimeout(debounce.current) }
    }, [ouvert, recherche, chercher])

    const envoyer = async (clientId?: string) => {
        setEnvoi(true); setMessage(null)
        try {
            const res = await fetch('/api/proposals/envoyer-app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proposal_id: proposalId, client_id: clientId || null }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.success) throw new Error(j.error || 'Envoi impossible.')
            setMessage({
                ok: true,
                texte: j.rattachement_auto
                    ? 'Envoyé : le compte a été retrouvé par son email.'
                    : 'Envoyé dans l’application du client.',
            })
            onChange?.()
            setTimeout(() => setOuvert(false), 1200)
        } catch (e) {
            setMessage({ ok: false, texte: e instanceof Error ? e.message : 'Envoi impossible.' })
        } finally { setEnvoi(false) }
    }

    const detacher = async () => {
        setEnvoi(true); setMessage(null)
        try {
            const res = await fetch(`/api/proposals/envoyer-app?proposal_id=${encodeURIComponent(proposalId)}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setMessage({ ok: true, texte: 'Retirée de l’application. Le lien secret reste valable.' })
            onChange?.()
        } catch {
            setMessage({ ok: false, texte: 'Retrait impossible.' })
        } finally { setEnvoi(false) }
    }

    const dejaEnvoyee = !!rattachement?.sent_to_mobile

    return (
        <>
            <button
                type="button"
                onClick={() => { setOuvert(true); setMessage(null) }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${dejaEnvoyee
                    ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                title={dejaEnvoyee ? 'Gérer l’envoi dans l’application' : 'Envoyer dans l’application du client'}
            >
                <Smartphone size={13} /> {dejaEnvoyee ? 'Dans l’app' : 'Envoyer dans l’app'}
            </button>

            {ouvert && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={() => setOuvert(false)}>
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1017] p-5" onClick={e => e.stopPropagation()}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-black text-white">Envoyer dans l’application</h3>
                                <p className="mt-0.5 text-xs text-gray-500">
                                    La proposition apparaîtra dans le compte du client, qui pourra la signer et la régler.
                                </p>
                            </div>
                            <button onClick={() => setOuvert(false)} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        {dejaEnvoyee && (
                            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 p-3">
                                <p className="text-xs font-semibold text-emerald-300">
                                    Déjà dans l’application de {rattachement?.client_nom || 'ce client'}.
                                </p>
                                <button
                                    onClick={detacher} disabled={envoi}
                                    className="shrink-0 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-gray-300 hover:bg-white/10 disabled:opacity-50"
                                >
                                    Retirer
                                </button>
                            </div>
                        )}

                        {/* Chemin rapide : rattachement par l'email de la proposition */}
                        <button
                            onClick={() => envoyer()}
                            disabled={envoi}
                            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                            {envoi ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                            Retrouver le compte par l’email de la proposition
                        </button>

                        <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            ou choisir le compte
                        </p>

                        <div className="relative mb-2">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                value={recherche}
                                onChange={e => setRecherche(e.target.value)}
                                placeholder="Nom, prénom ou email…"
                                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500"
                            />
                        </div>

                        <div className="max-h-56 space-y-1 overflow-y-auto">
                            {chargement ? (
                                <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-emerald-400" /></div>
                            ) : comptes.length === 0 ? (
                                <p className="py-6 text-center text-xs text-gray-500">Aucun compte trouvé.</p>
                            ) : comptes.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => envoyer(c.id)}
                                    disabled={envoi}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-bold text-white">
                                            {`${c.prenom || ''} ${c.nom || ''}`.trim() || 'Sans nom'}
                                        </span>
                                        <span className="block truncate text-[11px] text-gray-500">{c.email}</span>
                                    </span>
                                    <Smartphone size={15} className="shrink-0 text-emerald-400" />
                                </button>
                            ))}
                        </div>

                        {message && (
                            <p className={`mt-3 rounded-xl p-2.5 text-xs font-semibold ${message.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                                {message.texte}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
