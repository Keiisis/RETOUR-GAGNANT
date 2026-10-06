'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation, T } from '@/lib/translation'
import { ShieldCheck, Envelope as Mail, CircleNotch as Loader2, MagnifyingGlass as Search, Trash as Trash2, FileLock as FileLock2, CheckCircle as CheckCircle2, Warning as AlertTriangle, Database, Tray as Inbox, ArrowClockwise as RefreshCw } from '@phosphor-icons/react';

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
    const { t } = useTranslation()

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
                <h2 className="text-lg font-bold text-[#1a2332] mb-2"><T>Vérifiez votre boîte e-mail</T></h2>
                <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
                    <T>Si des données sont associées à cette adresse, un</T> <strong><T>lien sécurisé</T></strong> <T>vient de vous être
                    envoyé. Ouvrez-le pour consulter et, si vous le souhaitez, supprimer vos données.
                    Pensez à vérifier vos spams. Le lien est valable 1 heure.</T>
                </p>
                <button type="button" onClick={() => { setSent(false); setEmail('') }} className="mt-5 text-sm text-emerald-700 hover:underline">
                    <T>Utiliser une autre adresse</T>
                </button>
            </div>
        )
    }

    return (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <p className="text-gray-600 text-sm leading-relaxed mb-5">
                <T>Saisissez l&apos;adresse e-mail avec laquelle vous nous avez contactés. Pour votre sécurité, nous vous
                enverrons un</T> <strong><T>lien de vérification</T></strong> <T>: nous n&apos;affichons jamais de données sans confirmer
                que vous êtes bien le propriétaire de cette adresse.</T>
            </p>
            <label className="block text-sm font-medium text-[#1a2332] mb-2"><T>Votre adresse e-mail</T></label>
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder={t('vous@exemple.com')}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-[#1a2332]"
                    />
                </div>
                <button type="submit" disabled={loading}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <T>Vérifier mes données</T>
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
    const { t } = useTranslation()

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
                <p className="text-gray-500 text-sm mt-3"><T>Vérification de votre lien sécurisé…</T></p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-[#1a2332] font-semibold mb-1"><T>Accès impossible</T></p>
                <p className="text-gray-600 text-sm">{t(error)}</p>
                <a href="/mes-donnees" className="inline-block mt-5 text-sm text-emerald-700 hover:underline"><T>Refaire une demande</T></a>
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
                    <h2 className="text-lg font-bold text-[#1a2332] mb-2"><T>Vos données ont été supprimées</T></h2>
                    <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
                        <T>La suppression a été effectuée. Certaines pièces soumises à une obligation légale (comptabilité)
                        sont conservées sous forme</T> <strong><T>anonymisée</T></strong> <T>et ne vous sont plus rattachées.
                        Pour vous en assurer, relancez une vérification ci-dessous.</T>
                    </p>
                    <button type="button" onClick={load}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 font-medium hover:bg-emerald-50">
                        <RefreshCw className="w-4 h-4" /> <T>Vérifier à nouveau</T>
                    </button>
                </div>
                {isEmpty && (
                    <div className="bg-emerald-600 text-white rounded-2xl p-5 flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 shrink-0" />
                        <p className="text-sm font-medium"><T>Confirmé : plus aucune donnée personnelle vous concernant n&apos;est rattachée à cette adresse.</T></p>
                    </div>
                )}
                {preview && preview.found && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
                        {t("Il reste {n} enregistrement(s). S'il s'agit de pièces légales anonymisées, c'est normal. Sinon, contactez-nous à contact@retourgagnantbenin.bj.", { n: preview.totalRecords })}
                    </div>
                )}
            </div>
        )
    }

    if (preview && !preview.found) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                <Database className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-[#1a2332] mb-1"><T>Aucune donnée trouvée</T></h2>
                <p className="text-gray-600 text-sm"><T>Nous ne détenons aucune donnée personnelle rattachée à</T> <strong>{preview.email}</strong>.</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-bold text-[#1a2332]"><T>Données détenues sur vous</T></h2>
                </div>
                <p className="text-gray-500 text-sm">
                    {preview?.email} : {t('{n} enregistrement(s)', { n: preview?.totalRecords ?? 0 })}
                    {preview && preview.documentCount > 0 && ` · ${t('{n} document(s)', { n: preview.documentCount })}`}
                </p>
            </div>

            {preview?.sections.map(section => (
                <div key={section.table} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-[#F8FAF9] border-b border-gray-100 flex items-center justify-between">
                        <span className="font-semibold text-[#1a2332] flex items-center gap-2">
                            {section.kind === 'document' ? <FileLock2 className="w-4 h-4 text-[#C9A84C]" /> : <Database className="w-4 h-4 text-emerald-600" />}
                            {t(section.label)}
                        </span>
                        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-2.5 py-0.5">{section.count}</span>
                    </div>
                    <div className="p-5">
                        {section.kind === 'document' ? (
                            <p className="text-sm text-gray-500 italic flex items-center gap-2">
                                <FileLock2 className="w-4 h-4" />
                                {t("{n} document(s) enregistré(s). Pour votre sécurité, leur contenu n'est pas affiché ici : il sera supprimé en même temps que vos données.", { n: section.count })}
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {section.rows.map((row, i) => (
                                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                                        {Object.entries(row).map(([k, v]) => (
                                            <div key={k} className="flex gap-2">
                                                <span className="text-gray-400 shrink-0">{FIELD_LABELS[k] ? t(FIELD_LABELS[k]) : k} :</span>
                                                <span className="text-[#1a2332] break-words">{fmtVal(k, v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {section.rows.length === 0 && <p className="text-sm text-gray-400 italic"><T>Enregistrement présent (détail non affichable).</T></p>}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Bouton de suppression */}
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
                <h3 className="font-semibold text-[#1a2332] mb-1 flex items-center gap-2"><Trash2 className="w-4 h-4 text-red-500" /> <T>Supprimer mes données</T></h3>
                <p className="text-gray-600 text-sm mb-4">
                    <T>Cette action efface définitivement vos données (les pièces comptables légalement obligatoires sont anonymisées). Elle est</T> <strong><T>irréversible</T></strong>.
                </p>
                {!confirmOpen ? (
                    <button type="button" onClick={() => setConfirmOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> <T>Supprimer mes données</T>
                    </button>
                ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="button" onClick={doDelete} disabled={deleting}
                            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            <T>Oui, supprimer définitivement</T>
                        </button>
                        <button type="button" onClick={() => setConfirmOpen(false)} disabled={deleting}
                            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50">
                            <T>Annuler</T>
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
            <section className="py-14 md:py-20 bg-gradient-to-b from-[#FBFDFC] to-white text-slate-900 border-b border-slate-100">
                <div className="container mx-auto px-4 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-4">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold font-display mb-3"><T>Mes données personnelles</T></h1>
                    <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base">
                        <T>Consultez et supprimez vous-même, en toute autonomie, les données que nous détenons sur vous (RGPD).</T>
                    </p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-10 md:py-14 max-w-3xl">
                <Suspense fallback={<div className="bg-white rounded-2xl border border-gray-100 p-10 text-center"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin mx-auto" /></div>}>
                    <MesDonneesInner />
                </Suspense>

                <p className="text-center text-xs text-gray-400 mt-8">
                    <T>Une question ? Écrivez-nous à</T> <a href="mailto:contact@retourgagnantbenin.bj" className="text-emerald-700 hover:underline">contact@retourgagnantbenin.bj</a>.
                </p>
            </div>
        </div>
    )
}
