import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nom, email, question } = body;

        if (!nom || !question) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // 1. Create the session in `messages` table
        const { data: sessionData, error: sessionError } = await supabase
            .from('messages')
            .insert({
                nom: nom,
                prenom: "",
                email: email || "anonyme@livechat.com",
                sujet: "Live Chat Session",
                message: question,
                type: 'support',
                lu: false
            })
            .select('id')
            .single();

        if (sessionError) throw sessionError;

        // 2. Insert the first message into `chat_messages`
        const { error: msgError } = await supabase
            .from('chat_messages')
            .insert({
                conversation_id: sessionData.id,
                role: 'client',
                content: question
            });

        if (msgError) throw msgError;

        return NextResponse.json({ sessionId: sessionData.id });
    } catch (error) {
        console.error("Live Chat Start Error:", error);
        const message = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
