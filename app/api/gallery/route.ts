import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ywvsfhqdtkgzavxsumnk.supabase.co'

export async function GET() {
    try {
        // 1. Try Supabase gallery table first (admin-managed entries)
        const { data: tableData } = await supabase
            .from('gallery')
            .select('*')
            .order('created_at', { ascending: false })

        const tableImages = (tableData || [])
            .filter((item: any) => {
                const url = item.url || item.src || item.image_url
                return url && url.trim() !== ''
            })
            .map((item: any, index: number) => ({
                id: item.id || `db-${index}`,
                src: item.url || item.src || item.image_url,
                filename: item.filename || item.title || `image-${index}`,
            }))

        // 2. List files directly from Supabase Storage bucket "gallery"
        const { data: storageFiles, error: storageError } = await supabase
            .storage
            .from('gallery')
            .list('', { limit: 500, sortBy: { column: 'name', order: 'asc' } })

        let storageImages: any[] = []
        if (!storageError && storageFiles) {
            const tableFilenames = new Set(
                tableImages.map((img: any) => {
                    const srcBasename = img.src ? img.src.split('/').pop()?.toLowerCase() : ''
                    return srcBasename
                })
            )

            storageImages = storageFiles
                .filter((file: any) => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(file.name))
                .filter((file: any) => !tableFilenames.has(file.name.toLowerCase()))
                .map((file: any, index: number) => ({
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
