import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { client_email, client_nom, file_name, file_type, file_size } = body;

        if (!client_email || !file_name) {
            return NextResponse.json({ error: 'Email et nom de fichier requis.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('client_documents').insert({
            client_email,
            client_nom: client_nom || '',
            file_name,
            file_url: `/uploads/${file_name}`,
            file_type: file_type || 'autre',
            file_size: file_size || 0,
            status: 'en_attente',
        });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
