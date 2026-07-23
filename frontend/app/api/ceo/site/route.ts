import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = sb()

    const [blogRes, testRes, galRes, svcRes, settRes] = await Promise.allSettled([
        supabase.from('blog_posts').select('id', { count: 'exact', head: true }),
        supabase.from('testimonials').select('id', { count: 'exact', head: true }),
        supabase.from('gallery_items').select('id', { count: 'exact', head: true }),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('settings').select('key, value, category').in('category', ['general', 'frontend', 'seo']).limit(30),
    ])

    const cnt = (r: PromiseSettledResult<{ count: number | null }>) =>
        r.status === 'fulfilled' ? (r.value.count || 0) : 0

    return NextResponse.json({
        blog_posts:   cnt(blogRes as PromiseSettledResult<{ count: number | null }>),
        testimonials: cnt(testRes as PromiseSettledResult<{ count: number | null }>),
        gallery:      cnt(galRes  as PromiseSettledResult<{ count: number | null }>),
        services:     cnt(svcRes  as PromiseSettledResult<{ count: number | null }>),
        settings:     settRes.status === 'fulfilled' ? settRes.value.data || [] : [],
    })
}
