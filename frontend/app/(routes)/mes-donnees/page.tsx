'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    ShieldCheck, Mail, Loader2, Search, Trash2, FileLock2, CheckCircle2,
    AlertTriangle, Database, Inbox, RefreshCw,
} from 'lucide-react'

interface PreviewSection {
    table: string
    label: string
    kind: 'data' | 'document'
    count: number
    rows: Record<string, unknown>[]
}
interface Preview {
    email: string
    found: boolean
    totalRecords: number
    documentCount: number
    sections: PreviewSection[]
    generatedAt: string
}

const FIELD_LABELS: Record<string, string> = {
    nom: 'Nom', prenom: 'Prénom', full_name: 'Nom complet', email: 'E-mail',
    phone: 'Téléphone', telephone: 'Téléphone', whatsapp: 'WhatsApp',
    sujet: 'Sujet', subject: 'Sujet', message: 'Message', service: 'Service',
    statut: 'Statut', status: 'Statut', created_at: 'Reçu le', updated_at: 'Mis à jour le',
    date: 'Date', titre: 'Titre', title: 'Titre', note: 'Note', montant: 'Montant',
    amount: 'Montant', total: 'Total', adresse: 'Adresse', address: 'Adresse',
    ville: 'Ville', pays: 'Pays', country: 'Pays', description: 'Description',
    categorie: 'Catégorie', category: 'Catégorie',
}
const fmtVal = (k: string, v: unknown) => {
    if ((k === 'created_at' || k === 'updated_at' || k === 'date') && typeof v === 'string') {
        const d = new Date(v)
        if (!isNaN(d.getTime())) return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    }
    return String(v)
}

// ── Étape 1 : saisie de l'email → envoi du lien ──
function RequestForm() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return
        setLoading(true)
        try {
            await fetch('/api/rgpd/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            })
            setSent(true)
        } finally {
            setLoading(false)
        }
    }

    if (sent) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                    <Inbox className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold text-[#1a2332] mb-2">Vérifiez votre boîte e-mail</h2>
                <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
                    Si des données sont associées à cette adresse, un <strong>lien sécurisé</strong> vient de vous être
                    envoyé. Ouvrez-le pour consulter et, si vous le souhaitez, supprimer vos données.
                    Pensez à vérifier vos spams. Le lien est valable 1 heure.
                </p>
                <button type="button" onClick={() => { setSent(false); setEmail('') }} className="mt-5 text-sm text-emerald-700 hover:underline">
                    Utiliser une autre adresse
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
                Saisissez l&apos;adresse e-mail avec laquelle vous nous avez contactés. Pour votre sécurité, nous vous
                enverrons un <strong>lien de vérification</strong> : nous n&apos;affichons jamais de données sans confirmer
                que vous êtes bien le propriétaire de cette adresse.
            </p>
            <label className="block text-sm font-medium text-[#1a2332] mb-2">Votre adresse e-mail</label>
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-[#1a2332]"
                    />
                </div>
                <button type="submit" disabled={loading}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Vérifier mes données
                </button>
            </div>
        </form>
    )
}

// ── Étape 2 : aperçu (jeton vérifié) + suppression ──
function VerifiedView({ token }: { token: string }) {
    const [preview, setPreview] = useState<Preview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [deleted, setDeleted] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/rgpd/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Lien invalide ou expiré.'); setPreview(null) }
            else setPreview(json)
        } catch {
            setError('Erreur de connexion. Réessayez.')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { load() }, [load])

    const doDelete = async () => {
        setDeleting(true); setConfirmOpen(false)
        try {
            const res = await fetch('/api/rgpd/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const json = await res.json()
            if (res.ok && json.success) setDeleted(true)
            else setError(json.error || 'Échec de la suppression.')
        } catch {
            setError('Erreur de connexion pendant la suppression.')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
                <p className="text-gray-500 text-sm mt-3">Vérification de votre lien sécurisé…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-[#1a2332] font-semibold mb-1">Accès impossible</p>
                <p className="text-gray-600 text-sm">{error}</p>
                <a href="/mes-donnees" className="inline-block mt-5 text-sm text-emerald-700 hover:underline">Refaire une demande</a>
            </div>
        )
    }

    // Après suppression : confirmation + re-vérification
    if (deleted) {
        const isEmpty = preview && !preview.found
        return (
            <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-8 text-center">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-[#1a2332] mb-2">Vos données ont été supprimées</h2>
                    <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
                        La suppression a été effectuée. Certaines pièces soumises à une obligation légale (comptabilité)
                        sont conservées sous forme <strong>anonymisée</strong> et ne vous sont plus rattachées.
                        Pour vous en assurer, relancez une vérification ci-dessous.
                    </p>
                    <button type="button" onClick={load}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-50">
                        <RefreshCw className="w-4 h-4" /> Vérifier à nouveau
                    </button>
                </div>
                {isEmpty && (
                    <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 shrink-0" />
                        <p className="text-sm font-medium">Confirmé : plus aucune donnée personnelle vous concernant n&apos;est rattachée à cette adresse.</p>
                    </div>
                )}
                {preview && preview.found && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
                        Il reste {preview.totalRecords} enregistrement(s). S&apos;il s&apos;agit de pièces légales anonymisées, c&apos;est normal.
                        Sinon, contactez-nous à contact@retourgagnantbenin.bj.
                    </div>
                )}
            </div>
        )
    }

    if (preview && !preview.found) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <Database className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-[#1a2332] mb-1">Aucune donnée trouvée</h2>
                <p className="text-gray-600 text-sm">Nous ne détenons aucune donnée personnelle rattachée à <strong>{preview.email}</strong>.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-bold text-[#1a2332]">Données détenues sur vous</h2>
                </div>
                <p className="text-gray-500 text-sm">
                    {preview?.email} — {preview?.totalRecords} enregistrement(s)
                    {preview && preview.documentCount > 0 && ` · ${preview.documentCount} document(s)`}
                </p>
            </div>

            {preview?.sections.map(section => (
                <div key={section.table} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-[#F8FAF9] border-b border-gray-100 flex items-center justify-between">
                        <span className="font-semibold text-[#1a2332] flex items-center gap-2">
                            {section.kind === 'document' ? <FileLock2 className="w-4 h-4 text-[#C9A84C]" /> : <Database className="w-4 h-4 text-emerald-600" />}
                            {section.label}
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">{section.count}</span>
                    </div>
                    <div className="p-5">
                        {section.kind === 'document' ? (
                            <p className="text-sm text-gray-500 italic flex items-center gap-2">
                                <FileLock2 className="w-4 h-4" />
                                {section.count} document(s) enregistré(s). Pour votre sécurité, leur contenu n&apos;est pas affiché ici — il sera supprimé en même temps que vos données.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {section.rows.map((row, i) => (
                                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                        {Object.entries(row).map(([k, v]) => (
                                            <div key={k} className="flex gap-2">
                                                <span className="text-gray-400 shrink-0">{FIELD_LABELS[k] || k} :</span>
                                                <span className="text-[#1a2332] break-words">{fmtVal(k, v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {section.rows.length === 0 && <p className="text-sm text-gray-400 italic">Enregistrement présent (détail non affichable).</p>}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Bouton de suppression */}
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
                <h3 className="font-semibold text-[#1a2332] mb-1 flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-500" /> Supprimer mes données</h3>
                <p className="text-gray-600 text-sm mb-4">
                    Cette action efface définitivement vos données (les pièces comptables légalement obligatoires sont anonymisées). Elle est <strong>irréversible</strong>.
                </p>
                {!confirmOpen ? (
                    <button type="button" onClick={() => setConfirmOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Supprimer mes données
                    </button>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="button" onClick={doDelete} disabled={deleting}
                            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Oui, supprimer définitivement
                        </button>
                        <button type="button" onClick={() => setConfirmOpen(false)} disabled={deleting}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
                            Annuler
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function MesDonneesInner() {
    const params = useSearchParams()
    const token = params.get('token')
    return token ? <VerifiedView token={token} /> : <RequestForm />
}

export default function MesDonneesPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <section className="py-14 md:py-20 bg-gradient-to-br from-[#0f141e] via-[#1a2a3a] to-[#0f141e] text-white">
                <div className="container mx-auto px-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3">Mes données personnelles</h1>
                    <p className="text-white/60 max-w-xl mx-auto text-sm md:text-base">
                        Consultez et supprimez vous-même, en toute autonomie, les données que nous détenons sur vous (RGPD).
                    </p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-10 md:py-14 max-w-3xl">
                <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-100 p-10 text-center"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto" /></div>}>
                    <MesDonneesInner />
                </Suspense>

                <p className="text-center text-xs text-gray-400 mt-8">
                    Une question ? Écrivez-nous à <a href="mailto:contact@retourgagnantbenin.bj" className="text-emerald-700 hover:underline">contact@retourgagnantbenin.bj</a>.
                </p>
            </div>
        </div>
    )
}
