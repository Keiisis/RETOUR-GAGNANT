import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { nom, prenom, email, telephone, service, message } = body;

        if (!nom || !email) {
            return NextResponse.json(
                { error: 'Nom et email sont requis.' },
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
                telephone: telephone || '',
                sujet: `RDV (${service}) : ${body.date || 'Date N/A'} - ${body.timeSlot || 'Créneau N/A'} [${body.contactMethod}]`,
                message: message || '',
                type: 'rendez-vous',
                lu: false,
            }]);

        if (supabaseError) throw supabaseError;

        return NextResponse.json({ success: true, message: 'Demande de rendez-vous envoyée !' });
    } catch (error) {
        return NextResponse.json(
            { error: 'Erreçur lors de la soumission.' },
            { status: 500 }
        );
    }
}
