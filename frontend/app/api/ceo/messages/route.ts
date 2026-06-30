import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/messages — tous les messages (table 'messages', lu / contact_messages fallback)
export async function GET() {
    const supabase = sb()

    // Essai table 'messages' (champ lu)
    const { data: msgs, error: err1 } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

    if (!err1 && msgs && msgs.length > 0) {
        // Normalise le champ lu → is_read pour le frontend
        const normalized = msgs.map(m => ({
            ...m,
            is_read: m.lu ?? m.is_read ?? false,
        }))
        return NextResponse.json({ messages: normalized, table: 'messages' })
    }

    // Fallback table 'contact_messages'
    const { data: contactMsgs, error: err2 } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300)

    if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })

    return NextResponse.json({ messages: contactMsgs || [], table: 'contact_messages' })
}

// PATCH /api/ceo/messages — marquer comme lu
export async function PATCH(request: NextRequest) {
    const supabase = sb()
    const body = await request.json()
    const { id, table = 'messages' } = body

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    if (table === 'messages') {
        const { error } = await supabase.from('messages').update({ lu: true }).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
        const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}
