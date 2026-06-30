import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

export async function GET() {
    const supabase = sb()

    const [clientDocsRes, docsRes] = await Promise.allSettled([
        supabase.from('client_documents').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(500),
    ])

    const clientDocs = clientDocsRes.status === 'fulfilled' ? clientDocsRes.value.data || [] : []
    const docs       = docsRes.status       === 'fulfilled' ? docsRes.value.data       || [] : []

    // Prefer client_documents; fall back to documents if empty
    const result = clientDocs.length > 0 ? clientDocs : docs
    result.sort((a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ docs: result })
}
