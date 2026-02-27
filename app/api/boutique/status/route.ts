import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: Check if boutique is in maintenance mode
export async function GET() {
    try {
        const { data } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['boutique_maintenance', 'boutique_maintenance_message'])

        const settings: Record<string, string> = {}
        for (const s of data || []) settings[s.key] = s.value

        return NextResponse.json({
            maintenance: settings.boutique_maintenance === 'true',
            message: settings.boutique_maintenance_message || 'La boutique est temporairement indisponible. Revenez bientot !',
        })
    } catch {
        return NextResponse.json({ maintenance: false, message: '' })
    }
}
