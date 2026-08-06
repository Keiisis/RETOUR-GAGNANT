'use client'

import { useTranslation, T } from '@/lib/translation'
import { useState, useRef, useCallback } from 'react'
import { Upload, X, CircleNotch as Loader2, Image as ImageIcon, FilmStrip as Film, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type MediaType = 'image' | 'video' | 'any'

interface MediaUploadProps {
    value: string
    onChange: (url: string) => void
    bucket?: string
    folder?: string
    className?: string
    accept?: MediaType
    maxSizeMB?: number
    label?: string
    compact?: boolean
}

const ACCEPT_MAP: Record<MediaType, string> = {
    image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
    video: 'video/mp4,video/webm,video/quicktime',
    any: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime',
}

const MIME_CHECK: Record<MediaType, (t: string) => boolean> = {
    image: (t) => t.startsWith('image/'),
    video: (t) => t.startsWith('video/'),
    any: (t) => t.startsWith('image/') || t.startsWith('video/'),
}

export function MediaUpload({
    value,
    onChange,
    bucket = 'blog-assets',
    folder = 'media',
    className,
    accept = 'any',
    maxSizeMB = 50,
    label,
    compact = false,
}: MediaUploadProps) {
    const { t } = useTranslation()
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [error, setError] = useState('')
    const [progress, setProgress] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    const isVideo = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url) || url.includes('video')

    const uploadFile = useCallback(async (file: File) => {
        if (!MIME_CHECK[accept](file.type)) {
            const msg = accept === 'image' ? 'Seules les images sont acceptées'
                : accept === 'video' ? 'Seules les vidéos sont acceptées'
                    : 'Images et vidéos uniquement'
            setError(msg)
            return
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`Taille maximale: ${maxSizeMB} Mo`)
            return
        }

        setUploading(true)
        setError('')
        setProgress(0)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', folder)

            const xhr = new XMLHttpRequest()

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100)
                    setProgress(percent)
                }
            })

            const uploadPromise = new Promise<string>((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const res = JSON.parse(xhr.responseText)
                            if (res.url) {
                                resolve(res.url)
                            } else {
                                reject(new Error(res.error || 'Erreur inconnue'))
                            }
                        } catch (err) {
                            reject(new Error('Format de réponse invalide'))
                        }
                    } else {
                        try {
                            const res = JSON.parse(xhr.responseText)
                            reject(new Error(res.error || `Erreur d'upload: ${xhr.status}`))
                        } catch (err) {
                            reject(new Error(`Erreur d'upload: ${xhr.status}`))
                        }
                    }
                }
                xhr.onerror = () => reject(new Error('Erreur réseau réseau'))
                xhr.open('POST', '/api/upload/blog')
                xhr.send(formData)
            })

            const publicUrl = await uploadPromise
            setProgress(100)
            onChange(publicUrl)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload échoué'
            setError(message)
        } finally {
            setTimeout(() => {
                setUploading(false)
                setProgress(0)
            }, 500)
        }
    }, [folder, onChange, accept, maxSizeMB])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
        if (e.target) e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) uploadFile(file)
    }

    const removeMedia = () => {
        onChange('')
        setError('')
    }

    // Compact inline insertion button (for content body)
    if (compact) {
        return (
            <div className={cn('inline-flex items-center', className)}>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20',
                        uploading && 'pointer-events-none opacity-60'
                    )}
                >
                    {uploading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : accept === 'video' ? (
                        <Film size={14} />
                    ) : (
                        <ImageIcon size={14} />
                    )}
                    {uploading ? 'Upload...' : label || (accept === 'video' ? 'Vidéo' : accept === 'image' ? 'Image' : 'Média')}
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT_MAP[accept]}
                    onChange={handleFileSelect}
                    className="hidden"
                />
                {error && <span className="ml-2 text-[10px] text-red-400">{error}</span>}
            </div>
        )
    }

    return (
        <div className={cn('space-y-2', className)}>
            {label && <label className="text-xs font-bold text-gray-400 mb-1 block">{label}</label>}

            {value ? (
                // Preview
                <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
                    <div className="relative w-full h-48">
                        {isVideo(value) ? (
                            <video
                                src={value}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                            />
                        ) : (
                            <Image src={value} alt={t("Preview")} fill className="object-cover" />
                        )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold backdrop-blur-sm hover:bg-white/20 transition-colors"
                        >
                            <T>Changer</T>
                        </button>
                        <button
                            type="button"
                            onClick={removeMedia}
                            className="p-2 rounded-xl bg-[#E8112D]/20 text-[#E8112D] hover:bg-[#E8112D]/40 transition-colors"
                            title={t("Supprimer")}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 rounded-full bg-[#008751] flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-white" />
                        </div>
                    </div>
                    {isVideo(value) && (
                        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 text-[10px] text-white font-bold flex items-center gap-1">
                            <Film size={10} /> Vidéo
                        </div>
                    )}
                </div>
            ) : (
                // Upload zone
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                        'relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                        dragOver
                            ? 'border-[#FCD116] bg-[#FCD116]/5'
                            : 'border-white/10 hover:border-white/20 bg-white/[0.02]',
                        uploading && 'pointer-events-none opacity-60'
                    )}
                >
                    {uploading ? (
                        <div className="flex flex-col items-center gap-3 w-full">
                            <Loader2 size={32} className="animate-spin text-[#FCD116]" />
                            <div className="w-full max-w-[200px] h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-[#FCD116] to-[#008751] rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 font-bold"><T>Upload en cours...</T></p>
                        </div>
                    ) : (
                        <>
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                                {accept === 'video' ? (
                                    <Film size={24} className="text-gray-400" />
                                ) : (
                                    <Upload size={24} className="text-gray-400" />
                                )}
                            </div>
                            <p className="text-sm font-bold text-white mb-1">
                                <T>{accept === 'video' ? 'Glissez une vidéo ici' : accept === 'image' ? 'Glissez une image ici' : 'Glissez un fichier ici'}</T>
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest"><T>ou cliquez pour parcourir</T></p>
                            <p className="text-[9px] text-gray-600 mt-2">
                                {accept === 'video' ? 'MP4, WebM, MOV' : accept === 'image' ? 'JPG, PNG, WebP, GIF' : 'Images & Vidéos'}
                                {' '}— Max {maxSizeMB} Mo
                            </p>
                        </>
                    )}
                </div>
            )}

            {error && (
                <p className="text-[10px] text-[#E8112D] font-bold">{error}</p>
            )}

            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT_MAP[accept]}
                onChange={handleFileSelect}
                className="hidden"
                aria-label={t("Sélectionner un fichier")}
            />
        </div>
    )
}
