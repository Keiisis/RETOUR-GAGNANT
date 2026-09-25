import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guardPublic, CHAT_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
    const trop = guardPublic(request, 'support/send_message', CHAT_LIMIT)
    if (trop) return trop

    try {
        const body = await request.json();
        const { session_id, content, role } = body;

        if (!session_id || !UUID.test(String(session_id)) || !content?.trim()) {
            return NextResponse.json({ error: 'Missing session_id or content' }, { status: 400 });
        }

        // Only allow client role from this endpoint
        const msgRole = role === 'client' ? 'client' : 'client';

        const supabase = createClient(supabaseUrl, serviceKey);

        // Pas de message dans une conversation qui n'existe pas (injection dans la boîte agent).
        const { data: conv } = await supabase.from('messages').select('id').eq('id', session_id).eq('type', 'support').maybeSingle();
        if (!conv) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: session_id,
                role: msgRole,
                content: content.trim(),
            })
            .select('id, conversation_id, role, content, created_at')
            .single();

        if (error) throw error;

        return NextResponse.json({ message: data });
    } catch (error) {
        console.error('Send message error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
