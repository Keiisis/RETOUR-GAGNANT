import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { proposalId, secretKey, viewedAt, userAgent, referrer } = await req.json()

    if (!proposalId) {
      return NextResponse.json({ error: 'Missing proposalId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    // 1. Log the view
    await supabase.from('proposal_views').insert({
      proposal_id: proposalId,
      secret_key: secretKey,
      viewed_at: viewedAt || new Date().toISOString(),
      user_agent: userAgent?.slice(0, 500) || null,
      referrer: referrer?.slice(0, 500) || null,
      ip_hint: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    })

    // 2. Update the proposal with last_viewed_at and view_count
    const { data: proposal } = await supabase
      .from('ai_proposals')
      .select('view_count')
      .eq('id', proposalId)
      .single()

    await supabase
      .from('ai_client_proposals')
      .update({
        last_viewed_at: viewedAt || new Date().toISOString(),
        view_count: (proposal?.view_count || 0) + 1,
      })
      .eq('id', proposalId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
