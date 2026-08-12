import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { pageMeta } from '@/lib/seo'
import EventDetailClient from './EventDetailClient'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        )
        const { data } = await supabase
            .from('events')
            .select('title, short_description, description, cover_image_url')
            .eq('slug', slug)
            .maybeSingle()
        if (data) {
            const title = `${data.title} | Événements : Retour Gagnant`
            const desc = ((data.short_description || data.description || '') as string).replace(/\s+/g, ' ').trim().slice(0, 160)
                || 'Événement de la diaspora béninoise organisé par Retour Gagnant.'
            return pageMeta(title, desc, `/evenements/${slug}`, (data.cover_image_url as string) || undefined)
        }
    } catch { /* fallback */ }
    return pageMeta('Événement | Retour Gagnant', 'Événement de la diaspora béninoise organisé par Retour Gagnant.', `/evenements/${slug}`)
}

export default function Page() {
    return <EventDetailClient />
}
