import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { emailProuve } from '@/lib/espace-email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Audit du 25/09/2026 : l'email venait de l'URL → n'importe qui obtenait
// l'identifiant (donc la lecture) de la conversation d'autrui. On ne croit
// plus que l'email PROUVÉ (cookie de l'espace client / session Supabase).
export async function GET(request: NextRequest) {
    try {
        const email = await emailProuve(request);

        if (!email) {
            return NextResponse.json({ sessionId: null });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // Cherche la session live_chat la plus récente (< 24h) pour cet email dans `messages`
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
            .from('messages')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .eq('type', 'support')
            .ilike('sujet', '%Live Chat%')
            .gte('created_at', yesterday)
            .order('created_at', { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            return NextResponse.json({ sessionId: data[0].id });
        }

        return NextResponse.json({ sessionId: null });
    } catch (error) {
        console.error('Check session error:', error);
        return NextResponse.json({ sessionId: null });
    }
}
