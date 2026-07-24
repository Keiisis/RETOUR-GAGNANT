'use client'

// ══════════════════════════════════════════════════════════════
//  CLIENT — CENTRE DE TÉLÉCHARGEMENT
//
//  Un seul endroit pour récupérer TOUS ses documents, jusqu'ici
//  éparpillés (factures documents_financiers vs commandes boutique) et,
//  pour les factures, carrément non téléchargeables (le générateur PDF
//  n'était branché nulle part). Chaque pièce se télécharge, et
//  « Tout télécharger » les enchaîne en un clic.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Download, FileText, ShoppingBag, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { formatPrice, type CurrencyCode } from '@/lib/currency'

interface Doc {
    id: string
    type: 'facture' | 'commande'
    ref: string
    montant: number
    devise: string
    paye: boolean
    date: string
    url: string        // endpoint de téléchargement
    libelle: string
}

export default function TelechargementsPage() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState('')
    const [busy, setBusy] = useState<string | null>(null)
    const [toutEnCours, setToutEnCours] = useState(false)

    useEffect(() => {
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) { setLoading(false); return }
            setToken(session.access_token || '')
            const uid = session.user.id
            const email = (session.user.email || '').toLowerCase()

            const [facRes, cmdRes] = await Promise.all([
                supabase.from('documents_financiers')
                    .select('id, numero, total, currency, status, created_at')
                    .or(`client_id.eq.${uid},client_email.eq.${email}`)
                    .eq('type', 'facture')
                    .order('created_at', { ascending: false }),
                supabase.from('orders')
                    .select('id, amount, currency, payment_status, product_title, created_at')
                    .or(`client_id.eq.${uid},customer_email.eq.${email}`)
                    .eq('payment_status', 'completed')
                    .order('created_at', { ascending: false }),
            ])

            const factures: Doc[] = (facRes.data || []).map(f => ({
                id: f.id, type: 'facture', ref: f.numero || f.id,
                montant: Number(f.total) || 0, devise: f.currency || 'XOF',
                paye: f.status === 'paye', date: f.created_at,
                url: `/api/client/factures/${f.id}/pdf`,
                libelle: 'Facture',
            }))
            const commandes: Doc[] = (cmdRes.data || []).map(o => ({
                id: o.id, type: 'commande', ref: o.id.slice(0, 8).toUpperCase(),
                montant: Number(o.amount) || 0, devise: o.currency || 'XOF',
                paye: true, date: o.created_at,
                url: `/api/invoices/${o.id}`,
                libelle: o.product_title || 'Commande boutique',
            }))

            const tous = [...factures, ...commandes]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setDocs(tous)
            setLoading(false)
        }
        load()
    }, [])

    // Télécharge un document via fetch authentifié → blob → ancre.
    // (Un simple <a href> ne porterait pas le jeton pour les routes /api/client/*.)
    const telecharger = async (doc: Doc): Promise<boolean> => {
        try {
            const res = await fetch(doc.url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            })
            if (!res.ok) return false
            const blob = await res.blob()
            const href = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = href
            a.download = `${doc.libelle.replace(/[^a-zA-Z0-9-]/g, '_')}-${doc.ref}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(href)
            return true
        } catch {
            return false
        }
    }

    const surUn = async (doc: Doc) => {
        setBusy(doc.id)
        const ok = await telecharger(doc)
        if (!ok) alert('Téléchargement impossible pour cette pièce.')
        setBusy(null)
    }

    const surTout = async () => {
        setToutEnCours(true)
        let echecs = 0
        for (const doc of docs) {
            const ok = await telecharger(doc)
            if (!ok) echecs++
            await new Promise(r => setTimeout(r, 400)) // laisse le navigateur souffler
        }
        setToutEnCours(false)
        if (echecs > 0) alert(`${echecs} pièce(s) n'ont pas pu être téléchargées.`)
    }

    return (
        <div className="p-5 md:p-8 max-w-4xl mx-auto text-white">
            <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Download className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Téléchargements</h1>
                        <p className="text-sm text-gray-400">Toutes vos factures et commandes, au même endroit</p>
                    </div>
                </div>
                {docs.length > 0 && (
                    <button onClick={surTout} disabled={toutEnCours}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50">
                        {toutEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Tout télécharger ({docs.length})
                    </button>
                )}
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-500">
                    <Loader2 className="animate-spin" size={22} />
                </div>
            ) : docs.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-sm">
                    Aucun document à télécharger pour l'instant.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {docs.map(doc => (
                        <div key={`${doc.type}-${doc.id}`}
                            className="flex items-center justify-between gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.type === 'facture' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
                                    {doc.type === 'facture'
                                        ? <FileText className="w-5 h-5 text-blue-400" />
                                        : <ShoppingBag className="w-5 h-5 text-purple-400" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm truncate">{doc.libelle} · {doc.ref}</p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                        <span>{formatPrice(doc.montant, doc.devise as CurrencyCode)}</span>
                                        <span>·</span>
                                        <span>{new Date(doc.date).toLocaleDateString('fr-FR')}</span>
                                        <span className={`inline-flex items-center gap-1 ${doc.paye ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {doc.paye ? <><CheckCircle2 size={11} /> Payé</> : <><Clock size={11} /> À régler</>}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => surUn(doc)} disabled={busy === doc.id}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 transition flex-shrink-0 disabled:opacity-50">
                                {busy === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                                PDF
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
