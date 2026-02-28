import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, sujet, message } = body;

        if (!nom || !email || !message) {
            return NextResponse.json(
                { error: 'Nom, email et message sont requis.' },
                { status: 400 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Save to Supabase
        const { error: supabaseError } = await supabase
            .from('messages')
            .insert([{
                nom,
                prenom: prenom || '',
                email,
                sujet: sujet || 'Contact général',
                message,
                type: 'contact',
                lu: false,
            }]);

        if (supabaseError) throw supabaseError;

        return NextResponse.json({ success: true, message: 'Message envoyé avec succès !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreçur lors de l\'envoi du message.' },
            { status: 500 }
        );
    }
}
