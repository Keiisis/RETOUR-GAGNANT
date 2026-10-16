import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiAuth } from '@/lib/api-auth';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
    // Agent ou administrateur authentifié uniquement (verifyApiAuth 'agent' accepte aussi les admins).
    const auth = await verifyApiAuth(request, 'agent');
    if (!auth.authenticated) return auth.error!;

    try {
        const body = await request.json();
        const { session_id, content } = body;

        if (!session_id || !UUID.test(String(session_id)) || typeof content !== 'string' || !content.trim()) {
            return NextResponse.json({ error: 'Missing session_id or content' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // La conversation doit exister : `session_id` est l'id de la ligne `messages`
        // ouverte par le client (start_live) ou affichée dans la boîte agent.
        const { data: conv } = await supabase.from('messages').select('id').eq('id', session_id).maybeSingle();
        if (!conv) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 });

        const { data, error } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: session_id,
                role: 'agent',
                content: content.trim(),
            })
            .select('id, conversation_id, role, content, created_at')
            .single();

        if (error) throw error;

        return NextResponse.json({ message: data });
    } catch (error) {
        console.error('Agent reply error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
