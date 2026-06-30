'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ShieldCheck, FileText, FileDown, Loader2, AlertTriangle, ScrollText,
    CheckCircle2, Clock, Scale, Trash2, Info,
} from 'lucide-react'

const DOCS = [
    { id: 'registre', title: 'Registre des traitements', desc: 'Article 30 — fiches, sous-traitants, durées (interne)', icon: ScrollText },
    { id: 'procedure', title: 'Procédure de violation 72h', desc: 'Articles 33/34 — notification, confinement (interne)', icon: AlertTriangle },
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
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center"><ShieldCheck className="w-6 h-6 text-emerald-600" /></div>
                <div>
                    <h1 className="text-2xl font-bold text-[#1a2332]">Espace RGPD</h1>
                    <p className="text-gray-500 text-sm">Documents de conformité & rappel des bonnes pratiques</p>
                </div>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon: CheckCircle2, label: 'Consentement', val: 'Sur tous les formulaires' },
                    { icon: Clock, label: 'Conservation', val: 'Purge automatisée' },
                    { icon: Scale, label: 'Violation 72h', val: 'Procédure définie' },
                    { icon: Trash2, label: 'Effacement', val: 'Self-service client' },
                ].map(c => (
                    <div key={c.label} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4">
                        <c.icon className="w-5 h-5 text-emerald-600 mb-2" />
                        <p className="text-[#1a2332] text-sm font-semibold">{c.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{c.val}</p>
                    </div>
                ))}
            </section>

            <section>
                <h2 className="text-[#1a2332] font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-[#C9A84C]" /> Documents officiels</h2>
                <div className="space-y-3">
                    {DOCS.map(d => (
                        <div key={d.id} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1">
                                <d.icon className="w-5 h-5 text-emerald-600 shrink-0" />
                                <div>
                                    <p className="text-[#1a2332] font-medium">{d.title}</p>
                                    <p className="text-gray-500 text-xs">{d.desc}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => download(d.id, 'pdf')} disabled={downloading === `${d.id}-pdf`}
                                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-pdf` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
                                </button>
                                <button onClick={() => download(d.id, 'docx')} disabled={downloading === `${d.id}-docx`}
                                    className="px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#1a2332] text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
                                    {downloading === `${d.id}-docx` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Word
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex gap-3">
                <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-900 space-y-1">
                    <p className="font-semibold">Exercice des droits</p>
                    <p>L&apos;effacement et l&apos;export de données par email se font depuis l&apos;espace administrateur. Les clients peuvent aussi le faire eux-mêmes via la page publique <strong>« Mes données »</strong> (vérification par e-mail). En cas de demande reçue par un client, orientez-le vers cette page ou transmettez à l&apos;administration.</p>
                </div>
            </section>
        </div>
    )
}
