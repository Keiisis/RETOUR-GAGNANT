import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/settings/frontend — paramètres publics frontend (calculateur, etc.)
// Utilise la service role key pour contourner RLS

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ settings: {} })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { data } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['passeport_show_calculator', 'autres_services_json'])

        const settings: Record<string, string> = {}
        if (data) {
            data.forEach((item: { key: string; value: string }) => {
                settings[item.key] = item.value
            })
        }

        return NextResponse.json({ settings })
    } catch {
        return NextResponse.json({ settings: {} })
    }
}
