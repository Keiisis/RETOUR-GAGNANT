'use client'

/**
 * Champ image téléversable — remplace les champs « URL de l'image ».
 *
 * Les panels demandaient de coller une adresse : il fallait donc héberger le
 * fichier ailleurs avant de pouvoir l'utiliser. Ici on choisit un fichier sur
 * l'appareil (ou on le dépose), il part vers /api/upload/media, et l'URL
 * publique renvoyée alimente le même champ qu'avant — la base ne change pas.
 *
 * Le collage d'une adresse reste possible : certaines images vivent
 * légitimement ailleurs (partenaire, banque d'images). On ne retire pas une
 * possibilité, on en ajoute une.
 */

import { useCallback, useRef, useState } from 'react'
import {
    UploadSimple as Upload, CircleNotch as Loader2, X, Image as ImageIcon,
    Link as LinkIcon, Warning as AlertTriangle,
} from '@phosphor-icons/react'

type Gabarit = 'portrait' | 'logo' | 'couverture' | 'photo' | 'libre'

interface Props {
    value: string
    onChange: (url: string) => void
    /** Dossier de rangement dans le stockage (ex. « pretres », « services »). */
    dossier: string
    /** Cadrage appliqué à l'image téléversée. */
    gabarit?: Gabarit
    label?: string
    aide?: string
    /** Aperçu rond (portraits) plutôt que rectangulaire. */
    rond?: boolean
    className?: string
}

export default function ImageUploadField({
    value, onChange, dossier, gabarit = 'photo',
    label = 'Image', aide, rond = false, className = '',
}: Props) {
    const [envoi, setEnvoi] = useState(false)
    const [erreur, setErreur] = useState('')
    const [survol, setSurvol] = useState(false)
    const [modeUrl, setModeUrl] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const televerser = useCallback(async (file: File) => {
        setErreur(''); setEnvoi(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('dossier', dossier)
            fd.append('gabarit', gabarit)
            const res = await fetch('/api/upload/media', { method: 'POST', body: fd })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j.url) throw new Error(j.error || 'Téléversement impossible.')
            onChange(j.url)
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Téléversement impossible.')
        } finally {
            setEnvoi(false)
        }
    }, [dossier, gabarit, onChange])

    const surDepot = (e: React.DragEvent) => {
        e.preventDefault(); setSurvol(false)
        const f = e.dataTransfer.files?.[0]
        if (f) televerser(f)
    }

    return (
        <div className={className}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</label>
                <button
                    type="button"
                    onClick={() => setModeUrl(v => !v)}
                    className="text-[10px] font-bold text-gray-500 underline-offset-2 hover:underline"
                >
                    {modeUrl ? 'Téléverser un fichier' : 'Coller une adresse'}
                </button>
            </div>

            {modeUrl ? (
                <div className="flex items-center gap-2">
                    <LinkIcon size={15} className="shrink-0 text-gray-400" />
                    <input
                        type="url"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder="https://…"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-[#008751]/60"
                    />
                </div>
            ) : (
                <div
                    onDragOver={e => { e.preventDefault(); setSurvol(true) }}
                    onDragLeave={() => setSurvol(false)}
                    onDrop={surDepot}
                    className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${survol ? 'border-[#008751] bg-[#008751]/10' : 'border-white/12 bg-white/[0.03]'
                        }`}
                >
                    {/* Aperçu */}
                    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/5 ${rond ? 'h-16 w-16 rounded-full' : 'h-16 w-24 rounded-lg'
                        }`}>
                        {value
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={value} alt="" className="h-full w-full object-cover" />
                            : <ImageIcon size={20} className="text-gray-600" />}
                    </div>

                    <div className="min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={envoi}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#008751] px-3 py-2 text-xs font-black text-white transition-colors hover:bg-[#00643C] disabled:opacity-60"
                        >
                            {envoi ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            {envoi ? 'Envoi…' : value ? 'Remplacer' : 'Choisir un fichier'}
                        </button>
                        {value && !envoi && (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-2 text-xs font-bold text-gray-400 hover:bg-white/10"
                            >
                                <X size={13} /> Retirer
                            </button>
                        )}
                        <p className="mt-1 truncate text-[10px] text-gray-500">
                            {aide || 'Glissez une image ici, ou choisissez un fichier. JPG, PNG, WebP · 8 Mo max.'}
                        </p>
                    </div>

                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) televerser(f); e.target.value = '' }}
                    />
                </div>
            )}

            {erreur && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
                    <AlertTriangle size={13} /> {erreur}
                </p>
            )}
        </div>
    )
}
