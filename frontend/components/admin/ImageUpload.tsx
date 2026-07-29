'use client'

import { useTranslation, T } from '@/lib/translation';
import { compressImage } from '@/lib/compress-image'
import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2, ImageIcon, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
    value: string
    onChange: (url: string) => void
    bucket?: string
    folder?: string
    className?: string
}

export function ImageUpload({
    value,
    onChange,
    bucket = 'products',
    folder = 'images',
    className,
}: ImageUploadProps) {
    const { t } = useTranslation();
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [error, setError] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const uploadFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Seules les images sont acceptees')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Taille maximale: 5 Mo')
            return
        }

        setUploading(true)
        setError('')

        try {
            // Les visuels étaient envoyés bruts : des PNG de 3 Mo se retrouvaient
            // en boutique, invisibles pendant plusieurs secondes sur réseau mobile.
            // On redimensionne et ré-encode AVANT l'envoi. Le helper renvoie le
            // fichier d'origine intact s'il ne peut pas faire mieux.
            const optimise = await compressImage(file, {
                maxDim: 1600,
                quality: 0.8,
                skipBelowBytes: 200 * 1024,
            })

            const ext = optimise.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg')
            const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

            const { error: uploadErr } = await supabase.storage
                .from(bucket)
                .upload(fileName, optimise, {
                    cacheControl: '31536000',
                    upsert: false,
                })

            if (uploadErr) throw uploadErr

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName)

            onChange(publicUrl)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload eéchouée'
            setError(message)
        } finally {
            setUploading(false)
        }
    }, [bucket, folder, onChange])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) uploadFile(file)
    }

    const removeImage = () => {
        onChange('')
        setError('')
    }

    return (
        <div className={cn('space-y-2', className)}>
            {value ? (
                // Preview
                <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
                    <div className="relative w-full h-48">
                        <Image src={value} alt={t("Preview")} fill className="object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold backdrop-blur-sm hover:bg-white/20 transition-colors"
                        >
                            Changer
                        </button>
                        <button
                            type="button"
                            onClick={removeImage}
                            className="p-2 rounded-xl bg-[#E8112D]/20 text-[#E8112D] hover:bg-[#E8112D]/40 transition-colors"
                            title={t("Supprimer l'image")}
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="absolute top-3 right-3">
                        <div className="w-6 h-6 rounded-full bg-[#008751] flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-white" />
                        </div>
                    </div>
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
                        <>
                            <Loader2 size={32} className="animate-spin text-[#FCD116] mb-3" />
                            <p className="text-xs text-gray-400 font-bold"><T>Upload en cours...</T></p>
                        </>
                    ) : (
                        <>
                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                                <Upload size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm font-bold text-white mb-1"><T>Glissez une image ici</T></p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest"><T>ou cliquez pour parcourir</T></p>
                            <p className="text-[9px] text-gray-600 mt-2"><T>JPG, PNG, WebP — Max 5 Mo</T></p>
                        </>
                    )}
                </div>
            )}

            {/* URL manuelle */}
            <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest"><T>ou URL directe</T></span>
                <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="relative">
                <ImageIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                    type="url"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-9 pr-4 text-white text-xs focus:outline-none focus:border-[#FCD116]/30 transition-colors font-mono"
                    aria-label={t("URL directe de l'image")}
                    title={t("URL de l'image")}
                />
            </div>

            {error && (
                <p className="text-[10px] text-[#E8112D] font-bold">{error}</p>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label={t("Sélectionner un fichier image")}
                title={t("Sélecteur d'image")}
            />
        </div>
    )
}
