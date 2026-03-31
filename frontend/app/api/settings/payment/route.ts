import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
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
            // Ne jamais exposer les clés privées/secrètes au client
            if (
                item.key.includes('private') ||
                item.key.includes('secret') ||
                item.key === 'paypal_client_secret' ||
                item.key === 'stripe_webhook_secret' ||
                item.key === 'paypal_webhook_id'
            ) continue
            settings[item.key] = item.value || ''
        }

        return NextResponse.json(settings)
    } catch {
        return NextResponse.json({})
    }
}
