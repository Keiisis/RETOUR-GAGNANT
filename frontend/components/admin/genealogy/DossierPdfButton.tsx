'use client'

import { useState } from 'react'
import { FileText, CircleNotch as Loader2, Warning as AlertTriangle, X } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase'

interface Props {
    treeId: string
    /** Ref vers le container HTML à capturer pour l'image de l'arbre. */
    treeContainer?: HTMLElement | null
    /** Nom suggéré du fichier (sans extension). */
    suggestedFilename?: string
    isDark?: boolean
}

async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
}

async function captureTreeAsBase64(el: HTMLElement | null): Promise<string | null> {
    if (!el) return null
    try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(el, {
            backgroundColor: '#FFFFFF',
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true,
        })
        return canvas.toDataURL('image/png')
    } catch (e) {
        console.warn('[DossierPdfButton] capture failed:', e)
        return null
    }
}

export default function DossierPdfButton({
    treeId,
    treeContainer,
    suggestedFilename = 'Plan-de-Composition-Familiale',
    isDark = false,
}: Props) {
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [openMenu, setOpenMenu] = useState(false)

    const handleGenerate = async (dossierType: 'afro_descendance' | 'ancetre_esclavage' | 'both') => {
        setGenerating(true)
        setError(null)
        setOpenMenu(false)
        try {
            const token = await getAuthToken()
            if (!token) throw new Error('Session expirée')

            const treeImageBase64 = await captureTreeAsBase64(treeContainer || null)

            const res = await fetch('/api/genealogie/dossier-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    tree_id: treeId,
                    tree_image_base64: treeImageBase64,
                    dossier_type: dossierType,
                }),
            })

            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.error || `Erreur ${res.status}`)
            }

            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const today = new Date().toISOString().slice(0, 10)
            a.download = `${suggestedFilename}-${today}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur génération PDF')
        } finally {
            setGenerating(false)
        }
    }

    const subText = isDark ? '#94A3B8' : '#718096'
    const textColor = isDark ? '#E2E8F0' : '#1a2332'

    return (
        <div className="relative">
            <button
                onClick={() => setOpenMenu((v) => !v)}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all text-[11px] font-bold disabled:opacity-50"
                style={{
                    background: isDark ? 'rgba(220,165,64,0.18)' : 'rgba(220,165,64,0.10)',
                    color: isDark ? '#DCA540' : '#A68B3C',
                    border: `1px solid ${isDark ? 'rgba(220,165,64,0.35)' : 'rgba(220,165,64,0.25)'}`,
                }}
                title="Dossier PDF complet : page de garde + arbre + personnes + coffre + checklist"
            >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {generating ? 'PDF…' : 'Dossier PDF'}
            </button>

            {openMenu && !generating && (
                <div
                    className="absolute right-0 mt-1 w-60 rounded-2xl shadow-2xl p-2 z-[999] backdrop-blur-xl"
                    style={{
                        background: isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)',
                        border: '1px solid rgba(220,165,64,0.3)',
                    }}
                >
                    <button
                        onClick={() => handleGenerate('both')}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-all hover:bg-white/10"
                        style={{ color: textColor }}
                    >
                        Dossier complet (2 procédures)
                    </button>
                    <button
                        onClick={() => handleGenerate('afro_descendance')}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all hover:bg-white/10"
                        style={{ color: textColor }}
                    >
                        Afro-descendance uniquement
                    </button>
                    <button
                        onClick={() => handleGenerate('ancetre_esclavage')}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all hover:bg-white/10"
                        style={{ color: textColor }}
                    >
                        Recherche ancestrale uniquement
                    </button>
                    <p className="text-[9px] px-3 pt-2 pb-1" style={{ color: subText }}>
                        L&apos;arbre actuellement affiché sera capturé et inséré dans le PDF.
                    </p>
                </div>
            )}

            {error && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setError(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: isDark ? 'rgba(7,11,19,0.98)' : 'rgba(255,255,255,0.98)', border: '1px solid rgba(239,68,68,0.3)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} color="#EF4444" />
                                <h3 className="text-xs font-black uppercase tracking-wide" style={{ color: textColor }}>Échec génération</h3>
                            </div>
                            <button onClick={() => setError(null)}><X size={14} color={subText} /></button>
                        </div>
                        <div className="p-4">
                            <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
