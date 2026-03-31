'use client'

import { useTranslation, T } from '@/lib/translation';
import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
    value?: string
    onChange: (url: string) => void
    type: 'logo' | 'cover'
    label?: string
    required?: boolean
    hint?: string
    className?: string
}

export default function FileUpload({ value, onChange, type, label, required, hint, className }: FileUploadProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [drag, setDrag] = useState(false)
    const [justUploaded, setJustUploaded] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleUpload = useCallback(async (file: File) => {
        if (!file) return
        setError(null)
        setUploading(true)
        setJustUploaded(false)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', type)

            const res = await fetch('/api/upload/partner', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'upload')

            onChange(data.url)
            setJustUploaded(true)
            setTimeout(() => setJustUploaded(false), 2500)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur lors de l\'upload')
        } finally {
            setUploading(false)
        }
    }, [type, onChange])

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
        // Reset input so same file can be re-uploaded
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDrag(false)
        const file = e.dataTransfer.files[0]
        if (file) handleUpload(file)
    }

    const isLogo = type === 'logo'

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {label}
                    {required && <span className="text-[#E8112D] ml-1">*</span>}
                </label>
            )}

            <div
                className={cn(
                    'relative overflow-hidden rounded-xl border-2 border-dashed transition-all cursor-pointer select-none',
                    isLogo ? 'aspect-square max-w-[120px]' : 'aspect-[3/1]',
                    drag ? 'border-[#008751] bg-[#008751]/5 scale-[1.01]' : 'border-gray-200 hover:border-gray-300 bg-gray-50',
                    value ? 'border-solid border-gray-200' : '',
                    uploading ? 'pointer-events-none opacity-70' : '',
                    'group'
                )}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => !uploading && inputRef.current?.click()}
            >
                {/* Prévisualisation */}
                {value && !uploading && (
                    <>
                        <Image
                            src={value}
                            alt={t("Aperçu")}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                        {/* Overlay actions au survol */}
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                title={t("Supprimer")}
                                onClick={(e) => { e.stopPropagation(); onChange('') }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                <X size={14} />
                            </button>
                            <button
                                type="button"
                                title={t("Changer l'image")}
                                onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/40 transition-colors shadow-lg"
                            >
                                <Upload size={14} />
                            </button>
                        </div>
                        {/* Badge succès */}
                        {justUploaded && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-[#008751] text-white text-[10px] font-bold shadow">
                                <CheckCircle2 size={10} />
                                Enregistré
                            </div>
                        )}
                    </>
                )}

                {/* Loading */}
                {uploading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm">
                        <Loader2 size={22} className="animate-spin text-[#008751]" />
                        <span className="text-[11px] text-gray-500 font-semibold"><T>Envoi en cours...</T></span>
                    </div>
                )}

                {/* Placeholder vide */}
                {!value && !uploading && (
                    <div className={cn(
                        'absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-300 group-hover:text-gray-400 transition-colors p-3',
                        drag && 'text-[#008751]'
                    )}>
                        <ImageIcon size={isLogo ? 22 : 28} strokeWidth={1.5} />
                        <div className="text-center">
                            <p className="text-[11px] font-bold leading-tight">
                                {drag ? 'Déposez ici' : isLogo ? 'Logo' : 'Couverture'}
                            </p>
                            {!isLogo && (
                                <p className="text-[9px] mt-0.5 leading-tight">
                                    Cliquez ou glissez-déposez
                                    <br />
                                    JPG, PNG, WebP — max 5MB
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {hint && !error && <p className="text-[10px] text-gray-400">{hint}</p>}
            {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFile}
            />
        </div>
    )
}
