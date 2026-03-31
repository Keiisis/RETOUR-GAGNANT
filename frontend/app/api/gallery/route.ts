import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ywvsfhqdtkgzavxsumnk.supabase.co'

interface GalleryRow {
    id: string | number
    url?: string
    src?: string
    image_url?: string
    filename?: string
    title?: string
}

interface StorageFile {
    name: string
}

/**
 * Resolves a gallery image URL:
 * - If it's already an absolute URL (https://...), keep it
 * - If it's a relative path like /images/gallery/filename.jpg,
 *   extract the filename and build a Supabase Storage public URL
 */
const resolveImageUrl = (rawUrl: string): string => {
    if (!rawUrl || rawUrl.trim() === '') return ''

    // Already a full URL (Supabase Storage, Unsplash, etc.)
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return rawUrl
    }

    // Relative path like /images/gallery/FB_IMG_xxx.jpg
    // Extract the filename and build the Supabase Storage public URL
    const filename = rawUrl.split('/').pop()
    if (filename) {
        return `${SUPABASE_URL}/storage/v1/object/public/gallery/${encodeURIComponent(filename)}`
    }

    return rawUrl
}

export async function GET() {
    try {
        // 1. Try Supabase gallery table first (admin-managed entries)
        const { data: tableData } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false })

        const tableImages = (tableData as GalleryRow[] || [])
            .filter((item) => {
                const url = item.url || item.src || item.image_url
                return url && url.trim() !== ''
            })
            .map((item, index) => {
                const rawUrl = item.url || item.src || item.image_url || ''
                return {
                    id: item.id || `db-${index}`,
                    src: resolveImageUrl(rawUrl),
                    filename: item.filename || item.title || `image-${index}`,
                }
            })

        // 2. List files directly from Supabase Storage bucket "gallery"
        const { data: storageFiles, error: storageError } = await supabase
            .storage
            .from('gallery')
            .list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } })

        let storageImages: { id: string; src: string; filename: string }[] = []
        if (!storageError && storageFiles) {
            const tableFilenames = new Set(
                tableImages.map((img) => {
                    const srcBasename = img.src ? img.src.split('/').pop()?.toLowerCase() : ''
                    return srcBasename
                })
            )

            storageImages = (storageFiles as StorageFile[])
                .filter((file) => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(file.name))
                .filter((file) => !tableFilenames.has(file.name.toLowerCase()))
                .map((file, index) => ({
                    id: `storage-${index}`,
                    src: `${SUPABASE_URL}/storage/v1/object/public/gallery/${encodeURIComponent(file.name)}`,
                    filename: file.name,
                }))
        }

        const allImages = [...tableImages, ...storageImages]

        return NextResponse.json({ images: allImages })
    } catch (error) {
        console.error('Gallery fetch error:', error)
        return NextResponse.json({ images: [] })
    }
}
