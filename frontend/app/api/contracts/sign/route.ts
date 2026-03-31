import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contractId, clientEmail } = body;

        if (!contractId || !clientEmail) {
            return NextResponse.json({ error: 'ID contrat et email requis.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Generate signature hash
        const signatureHash = crypto
            .createHash('sha256')
            .update(`${contractId}-${clientEmail}-${new Date().toISOString()}`)
            .digest('hex');

        const { error } = await supabase
            .from('contracts')
            .update({
                status: 'signe',
                signed_at: new Date().toISOString(),
                signature_hash: signatureHash,
            })
            .eq('id', contractId)
            .eq('client_email', clientEmail);

        if (error) throw error;

        return NextResponse.json({ success: true, signatureHash });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
