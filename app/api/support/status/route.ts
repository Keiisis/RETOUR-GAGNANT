import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { count, error } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .in('role', ['agent', 'admin'])
            .eq('is_active', true);

        if (error) throw error;

        return NextResponse.json({ onlineAgents: count || 0, message: "Système interrogé avec succès" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ onlineAgents: 0 }, { status: 500 });
    }
}
