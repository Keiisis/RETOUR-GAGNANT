import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyApiAuth } from '@/lib/api-auth';
import { NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent');
    if (!auth.authenticated) return auth.error!;

    try {
        const body = await request.json();
        const { session_id, content } = body;

        if (!session_id || !content?.trim()) {
            return NextResponse.json({ error: 'Missing session_id or content' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

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
