import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

export async function POST(request: Request) {
    // 🛡️ SECURITY: Require CRON_SECRET for this endpoint
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Delete treated nationality requests older than 24h
        const { data: deleted, error: delError } = await supabase
            .from('nationality_requests')
            .delete()
            .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .in('statut', ['traite', 'archive'])
            .select('id')

        const deletedCount = deleted?.length || 0

        // Log the cleanup action
        await supabase.from('security_logs').insert([{
            action: 'auto_cleanup_24h',
            details: {
                table: 'nationality_requests',
                timestamp: new Date().toISOString(),
                statuses_deleted: ['traite', 'archive'],
            },
            records_affected: deletedCount,
        }])

        return NextResponse.json({
            success: true,
            recordsDeleted: deletedCount,
            timestamp: new Date().toISOString(),
        })
    } catch (error: unknown) {
        return NextResponse.json(
            { error: 'Cleanup failed' },
            { status: 500 }
        )
    }
}

// Also support GET for cron job services like Vercel Cron
export async function GET(request: Request) {
    return POST(request)
}
