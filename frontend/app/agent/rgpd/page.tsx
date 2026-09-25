'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldCheck, FileText, FileArrowDown as FileDown, CircleNotch as Loader2, Warning as AlertTriangle, Scroll as ScrollText, CheckCircle as CheckCircle2, Clock, Scales as Scale, Trash as Trash2, Info } from '@phosphor-icons/react';

const DOCS = [
    { id: 'registre', title: 'Registre des traitements', desc: 'Article 30 : fiches, sous-traitants, durées (interne)', icon: ScrollText },
    { id: 'procedure', title: 'Procédure de violation 72h', desc: 'Articles 33/34 : notification, confinement (interne)', icon: AlertTriangle },
    { id: 'politique', title: 'Politique de confidentialité', desc: 'Version publique', icon: FileText },
]

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export default function AgentRgpdPage() {
    const [downloading, setDownloading] = useState<string | null>(null)

    const download = async (docId: string, format: 'pdf' | 'docx') => {
        const key = `${docId}-${format}`
        setDownloading(key)
        try {
            const res = await fetch(`/api/admin/rgpd/document?doc=${docId}&format=${format}`, { headers: await authHeaders() })
            if (!res.ok) throw new Error('refusé')
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `rgb-${docId}.${format}`
            document.body.appendChild(a); a.click(); a.remove()
            URL.revokeObjectURL(url)
        } catch {
            alert('Téléchargement impossible (vérifiez votre session).')
        } finally {
            setDownloading(null)
        }
    }

    return (
        <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-8">
            <header className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-emerald-500" /></div>
                <div>
                    <h1 className="text-2xl font-bold text-[var(--panel-text-heading)]">Espace RGPD</h1>
                    <p className="text-[var(--panel-text-muted)] text-sm">Documents de conformité & rappel des bonnes pratiques</p>
                </div>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: CheckCircle2, label: 'Consentement', val: 'Sur tous les formulaires' },
                    { icon: Clock, label: 'Conservation', val: 'Purge automatisée' },
                    { icon: Scale, label: 'Violation 72h', val: 'Procédure définie' },
                    { icon: Trash2, label: 'Effacement', val: 'Self-service client' },
                ].map(c => (
                    <div key={c.label} className="bg-[var(--panel-surface)] border border-[var(--panel-border)] shadow-sm rounded-2xl p-4">
                        <c.icon className="w-5 h-5 text-emerald-500 mb-2" />
                        <p className="text-[var(--panel-text-heading)] text-sm font-semibold">{c.label}</p>
                        <p className="text-[var(--panel-text-muted)] text-xs mt-0.5">{c.val}</p>
                    </div>
                ))}
            </section>

            <section>
                <h2 className="text-[var(--panel-text-heading)] font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-[#C9A84C]" /> Documents officiels</h2>
                <div className="space-y-3">
                    {DOCS.map(d => (
                        <div key={d.id} className="bg-[var(--panel-surface)] border border-[var(--panel-border)] shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <d.icon className="w-5 h-5 text-emerald-500 shrink-0" />
                                <div>
                                    <p className="text-[var(--panel-text-heading)] font-medium">{d.title}</p>
                                    <p className="text-[var(--panel-text-muted)] text-xs">{d.desc}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => download(d.id, 'pdf')} disabled={downloading === `${d.id}-pdf`}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-[#fff] text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
                                </button>
                                <button onClick={() => download(d.id, 'docx')} disabled={downloading === `${d.id}-docx`}
                                    className="px-3.5 py-2 rounded-lg bg-[var(--panel-surface-alt)] hover:bg-[var(--panel-surface-active)] border border-[var(--panel-border)] text-[var(--panel-text-heading)] text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-docx` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Word
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5 flex gap-3">
                <Info className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--panel-text)] space-y-1">
                    <p className="font-semibold text-[var(--panel-text-heading)]">Exercice des droits</p>
                    <p>L&apos;effacement et l&apos;export de données par email se font depuis l&apos;espace administrateur. Les clients peuvent aussi le faire eux-mêmes via la page publique <strong>« Mes données »</strong> (vérification par e-mail). En cas de demande reçue par un client, orientez-le vers cette page ou transmettez à l&apos;administration.</p>
                </div>
            </section>
        </div>
    )
}
