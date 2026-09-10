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
                item.key === 'paypal_webhook_id' ||
                /* Revolut : la cle `sk_…` et le secret de webhook `wsk_…` ne
                   sortent JAMAIS. Le widget n'a besoin que du jeton de
                   commande, produit par le serveur a chaque paiement. */
                item.key === 'revolut_webhook_secret'
            ) continue
            settings[item.key] = item.value || ''
        }

        return NextResponse.json(settings)
    } catch {
        return NextResponse.json({})
    }
}
