import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: Request) {
    const trop = guardPublic(request, 'support/start_live', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const body = await request.json();
        const { nom, email, question } = body;

        if (!nom || !question) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // 1. Créer une entrée dans `messages` (visible dans l'inbox agent immédiatement)
        //    On utilise le même id comme conversation_id dans chat_messages → cohérence garantie
        const { data: msgData, error: msgError } = await supabase
            .from('messages')
            .insert({
                nom: nom.trim(),
                prenom: '',
                email: (email || 'anonyme@livechat.com').toLowerCase().trim(),
 sujet: `Live Chat — ${nom.trim()}`,
                message: question.trim(),
                type: 'support',
                lu: false,
            })
            .select('id')
            .single();

        if (msgError) {
            console.error('[start_live] messages insert error:', msgError.message);
            return NextResponse.json({ error: msgError.message }, { status: 500 });
        }

        const sessionId = msgData.id;

        // 2. Stocker le premier message dans chat_messages (history du chat)
        const { error: chatError } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: sessionId,
                role: 'client',
                content: question.trim(),
            });

        if (chatError) {
            // Table chat_messages manquante — retourner quand même le sessionId
            // Le message sera stocké dans `messages.message` comme fallback
            console.error('[start_live] chat_messages error (table missing?):', chatError.message);
        }

        return NextResponse.json({ sessionId });
    } catch (error) {
        console.error("Live Chat Start Error:", error);
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
