import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// L'identifiant de conversation (UUID aléatoire) est la clé d'accès : on refuse tout autre format.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const session_id = searchParams.get('session_id');

        if (!session_id || !UUID.test(session_id)) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        const { data, error } = await supabase
            .from('chat_messages')
            .select('id, conversation_id, role, content, created_at')
            .eq('conversation_id', session_id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ messages: data || [] });
    } catch (error) {
        console.error('Get messages error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
