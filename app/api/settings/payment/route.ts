import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        // Fetch ALL payment-related settings (including enabled/sandbox flags)
        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .eq('category', 'payment')

        if (error) {
            console.error('Settings fetch error:', error)
            return NextResponse.json({})
        }

        const settings: Record<string, string> = {}
        for (const item of data || []) {
            // NEVER expose private/secret keys to client-side
            if (item.key.includes('private') || item.key.includes('secret')) continue
            settings[item.key] = item.value || ''
        }

        return NextResponse.json(settings)
    } catch {
        return NextResponse.json({})
    }
}
