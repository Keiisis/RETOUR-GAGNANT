import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const ALLOWED_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function sanitizeFileName(name: string): string {
    return name
        .replace(/\.\./g, '')
        .replace(/[/\\]/g, '')
        .replace(/[^\w\-. ]/g, '_')
        .slice(0, 255);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { client_email, client_nom, file_name, file_type, file_size } = body;

        if (!client_email || !file_name) {
            return NextResponse.json({ error: 'Email et nom de fichier requis.' }, { status: 400 });
        }

        // Validation email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client_email)) {
            return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
        }

        // Validation type de fichier
        const ext = (file_name.split('.').pop() || '').toLowerCase();
        if (!ALLOWED_TYPES.includes(ext)) {
            return NextResponse.json({
                error: `Type de fichier non autorisé. Types acceptés : ${ALLOWED_TYPES.join(', ')}`
            }, { status: 400 });
        }

        // Validation taille
        if (file_size && file_size > MAX_SIZE_BYTES) {
            return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo).' }, { status: 400 });
        }

        // Sanitisation nom de fichier (protection path traversal)
        const safeName = sanitizeFileName(file_name);
        if (!safeName) {
            return NextResponse.json({ error: 'Nom de fichier invalide.' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error } = await supabase.from('client_documents').insert({
            client_email,
            client_nom: client_nom || '',
            file_name: safeName,
            file_url: `/uploads/${safeName}`,
            file_type: ext,
            file_size: file_size || 0,
            status: 'en_attente',
        });

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
