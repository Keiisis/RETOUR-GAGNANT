'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, FileText, FileArrowDown as FileDown, CircleNotch as Loader2, MagnifyingGlass as Search, Trash as Trash2, Database, FileLock as FileLock2, CheckCircle as CheckCircle2, Warning as AlertTriangle, Scales as Scale, Clock, Scroll as ScrollText } from '@phosphor-icons/react';

interface PreviewSection { table: string; label: string; kind: 'data' | 'document'; count: number; rows: Record<string, unknown>[] }
interface Preview { email: string; found: boolean; totalRecords: number; documentCount: number; sections: PreviewSection[] }

const DOCS = [
    { id: 'registre', title: 'Registre des traitements', desc: 'Article 30 : fiches, sous-traitants, durées (interne)', icon: ScrollText },
    { id: 'procedure', title: 'Procédure de violation 72h', desc: 'Articles 33/34 : notification, confinement (interne)', icon: AlertTriangle },
    { id: 'politique', title: 'Politique de confidentialité', desc: 'Version publique (sans détails techniques)', icon: FileText },
]

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function AdminRgpdPage() {
    const [downloading, setDownloading] = useState<string | null>(null)
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<Preview | null>(null)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState(false)
    const [done, setDone] = useState('')

    const download = async (docId: string, format: 'pdf' | 'docx') => {
        const key = `${docId}-${format}`
        setDownloading(key)
        try {
            const res = await fetch(`/api/admin/rgpd/document?doc=${docId}&format=${format}`, { headers: await authHeaders() })
            if (!res.ok) throw new Error('Téléchargement refusé')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `rgb-${docId}.${format}`
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(url)
        } catch {
            alert('Téléchargement impossible (vérifiez votre session admin).')
        } finally {
            setDownloading(null)
        }
    }

    const lookup = async () => {
        if (!email.trim()) return
        setLoading(true); setError(''); setPreview(null); setDone('')
        try {
            const res = await fetch(`/api/admin/rgpd?email=${encodeURIComponent(email.trim())}`, { headers: await authHeaders() })
            const json = await res.json()
            if (!res.ok) setError(json.error || 'Erreur')
            else setPreview(json)
        } catch { setError('Erreur de connexion') }
        finally { setLoading(false) }
    }

    const erase = async () => {
        if (!confirm(`Effacer/anonymiser définitivement les données de ${email} ?`)) return
        setDeleting(true); setError('')
        try {
            const res = await fetch('/api/admin/rgpd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ email: email.trim(), confirm: true }),
            })
            const json = await res.json()
            if (!res.ok) setError(json.error || 'Erreur')
            else { setDone('Données traitées avec succès.'); setPreview(null) }
        } catch { setError('Erreur de connexion') }
        finally { setDeleting(false) }
    }

    return (
        <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-8">
            <header>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-emerald-500" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Centre RGPD</h1>
                        <p className="text-gray-400 text-sm">Documents officiels, conformité et exercice des droits</p>
                    </div>
                </div>
            </header>

            {/* État de conformité */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: CheckCircle2, label: 'Consentement', val: 'Sur tous les formulaires' },
                    { icon: Clock, label: 'Conservation', val: 'Purge automatisée' },
                    { icon: Scale, label: 'Violation 72h', val: 'Procédure définie' },
                    { icon: Trash2, label: 'Effacement', val: 'Opérationnel (self-service)' },
                ].map(c => (
                    <div key={c.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <c.icon className="w-5 h-5 text-emerald-400 mb-2" />
                        <p className="text-white text-sm font-semibold">{c.label}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{c.val}</p>
                    </div>
                ))}
            </section>

            {/* Documents */}
            <section>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-[#C9A84C]" /> Documents officiels</h2>
                <div className="space-y-3">
                    {DOCS.map(d => (
                        <div key={d.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <d.icon className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div>
                                    <p className="text-white font-medium">{d.title}</p>
                                    <p className="text-gray-400 text-xs">{d.desc}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => download(d.id, 'pdf')} disabled={downloading === `${d.id}-pdf`}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
                                </button>
                                <button onClick={() => download(d.id, 'docx')} disabled={downloading === `${d.id}-docx`}
                                    className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-docx` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Word
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Outil d'exercice des droits */}
            <section className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h2 className="text-white font-semibold mb-1 flex items-center gap-2"><Search className="w-4 h-4 text-emerald-400" /> Droit d&apos;accès & d&apos;effacement</h2>
                <p className="text-gray-400 text-sm mb-4">Recherchez les données d&apos;un utilisateur par email, puis exportez ou effacez à sa demande.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemple.com"
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 outline-none focus:border-emerald-500" />
                    <button onClick={lookup} disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Rechercher
                    </button>
                </div>

                {error && <p className="mt-3 text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>}
                {done && <p className="mt-3 text-emerald-400 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {done}</p>}

                {preview && (
                    <div className="mt-5 space-y-3">
                        {!preview.found ? (
                            <p className="text-gray-400 text-sm">Aucune donnée trouvée pour cet email.</p>
                        ) : (
                            <>
                                <p className="text-gray-300 text-sm">{preview.totalRecords} enregistrement(s){preview.documentCount > 0 && ` · ${preview.documentCount} document(s)`}</p>
                                <div className="space-y-2">
                                    {preview.sections.map(s => (
                                        <div key={s.table} className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                                            <span className="text-white text-sm flex items-center gap-2">
                                                {s.kind === 'document' ? <FileLock2 className="w-4 h-4 text-[#C9A84C]" /> : <Database className="w-4 h-4 text-emerald-400" />}
                                                {s.label}
                                            </span>
                                            <span className="text-gray-400 text-xs">{s.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={erase} disabled={deleting}
                                    className="mt-2 px-5 py-2.5 rounded-xl bg-red-500/90 hover:bg-red-600 text-white font-medium flex items-center gap-2 disabled:opacity-60">
                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Effacer / anonymiser ces données
                                </button>
                            </>
                        )}
                    </div>
                )}
            </section>

            <p className="text-gray-500 text-xs">
                Les utilisateurs peuvent aussi exercer leurs droits eux-mêmes via la page publique <span className="text-emerald-400">/mes-donnees</span> (vérification par e-mail).
            </p>
        </div>
    )
}
