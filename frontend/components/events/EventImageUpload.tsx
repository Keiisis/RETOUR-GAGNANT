'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, ImageIcon, Loader2, Link as LinkIcon } from 'lucide-react'
import { useTranslation, T } from '@/lib/translation'

interface EventImageUploadProps {
    label: string
    value: string
    onChange: (url: string) => void
    uploadType?: string
    /** Afficher le champ URL en plus du bouton upload */
    showUrlInput?: boolean
    aspectRatio?: 'video' | 'square' | 'auto'
    className?: string
}

export default function EventImageUpload({
    label,
    value,
    onChange,
    uploadType = 'cover',
    showUrlInput = false,
    aspectRatio = 'video',
    className = '',
}: EventImageUploadProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [showUrl, setShowUrl] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const upload = useCallback(async (file: File) => {
        setUploading(true)
        setError('')
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', uploadType)
        try {
            const res = await fetch('/api/upload/event', { method: 'POST', body: fd })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || t('Échec upload'))
            onChange(data.url)
        } catch (e) {
            setError(e instanceof Error ? e.message : t('Erreur upload'))
        } finally {
            setUploading(false)
        }
    }, [uploadType, onChange])

    const handleFile = useCallback((file: File | null | undefined) => {
        if (!file) return
        if (!file.type.startsWith('image/')) { setError(t('Fichier image requis (JPG, PNG, WebP)')); return }
        if (file.size > 8 * 1024 * 1024) { setError(t('Image trop lourde (max 8 MB)')); return }
        upload(file)
    }, [upload])

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFile(e.dataTransfer.files[0])
    }, [handleFile])

    const aspectClass = aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : ''

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={11} />{label}
                </label>
                {showUrlInput && (
                    <button type="button" onClick={() => setShowUrl(v => !v)}
                        className="text-[10px] font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer transition-colors">
                        <LinkIcon size={10} />
                        {showUrl ? t('Masquer URL') : t('Coller une URL')}
                    </button>
                )}
            </div>

            {/* URL input optionnel */}
            {showUrl && (
                <input
                    type="url"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={t('https://...')}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-[#008751]/50 transition-all"
                />
            )}

            {/* Zone d'upload */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => !value && inputRef.current?.click()}
                className={`relative w-full rounded-2xl border-2 border-dashed transition-all overflow-hidden ${
                    dragOver
                        ? 'border-[#008751] bg-[#008751]/5 scale-[1.01]'
                        : value
                        ? 'border-transparent cursor-default'
                        : 'border-white/[0.10] bg-white/[0.02] hover:border-[#008751]/50 hover:bg-[#008751]/5 cursor-pointer'
                } ${aspectClass}`}
                style={{ minHeight: aspectRatio === 'auto' ? '120px' : undefined }}
            >
                {value ? (
                    /* ── Preview ── */
                    <div className={`relative w-full ${aspectClass}`} style={{ minHeight: aspectRatio === 'auto' ? '120px' : undefined }}>
                        <Image
                            src={value} alt={t("Aperçu")}
                            fill className="object-cover"
                            unoptimized
                        />
                        {/* Actions overlay */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
                            <button type="button"
                                onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                                className="px-3 py-2 rounded-xl bg-white text-[#1a2332] text-[11px] font-black flex items-center gap-1.5 shadow-md hover:bg-gray-100 cursor-pointer transition-all">
                                <Upload size={12} /> <T>Remplacer</T> </button>
                            <button type="button"
                                onClick={e => { e.stopPropagation(); onChange('') }}
                                className="w-8 h-8 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 cursor-pointer transition-all">
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ) : uploading ? (
                    /* ── Loading ── */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-full border-2 border-[#008751] border-t-transparent animate-spin" />
                        <span className="text-xs font-bold text-gray-400"><T>Envoi en cours...</T></span>
                    </div>
                ) : (
                    /* ── Drop zone ── */
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, rgba(0,135,81,0.15), rgba(0,135,81,0.05))' }}>
                            <Upload size={22} className="text-[#008751]" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-300">
                                <T>Glisser-déposer ou</T>{' '}
                                <span className="text-[#008751] underline underline-offset-2"><T>parcourir</T></span>
                            </p>
                            <p className="text-[10px] text-gray-600 mt-1"><T>JPG, PNG, WebP — max 8 MB</T></p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bouton upload si image existante */}
            {!value && !uploading && (
                <button type="button"
                    onClick={() => inputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-bold text-gray-400 hover:text-white hover:border-[#008751]/40 hover:bg-[#008751]/5 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploading ? t('Envoi...') : t('Choisir depuis l\'appareil')}
                </button>
            )}

            {error && (
                <p className="text-[11px] text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                    {error}
                </p>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0])}
            />
        </div>
    )
}
