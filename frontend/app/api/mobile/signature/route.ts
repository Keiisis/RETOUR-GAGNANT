import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'

/* ════════════════════════════════════════════════════════════════════════════
   Mobile signature endpoint — l'identité vient du JETON (Bearer), jamais d'un
   client_id fourni en query/body (anti-IDOR).
   ════════════════════════════════════════════════════════════════════════════ */

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_AUTO_SIGN = ['ask', 'auto', 'never']

// GET — signature du client authentifié
export async function GET(req: NextRequest) {
    try {
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { data, error } = await supabase
            .from('client_signatures')
            .select('*')
            .eq('client_id', clientId)
            .maybeSingle()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// POST { client_id, signature_data, auto_sign }
export async function POST(req: NextRequest) {
    try {
        const client_id = await getMobileUserId(req)
        if (!client_id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await req.json()
        const { signature_data, auto_sign } = body

        if (!signature_data || typeof signature_data !== 'string') {
            return NextResponse.json({ error: 'Données de signature manquantes' }, { status: 400 })
        }
        if (!signature_data.startsWith('data:image/')) {
            return NextResponse.json({ error: 'Format de signature invalide' }, { status: 400 })
        }
        if (signature_data.length > 700_000) {
            return NextResponse.json({ error: 'Signature trop lourde. Simplifiez votre dessin.' }, { status: 400 })
        }
        const cleanAutoSign = VALID_AUTO_SIGN.includes(auto_sign) ? auto_sign : 'ask'

        const { data, error } = await supabase
            .from('client_signatures')
            .upsert({
                client_id,
                signature_data,
                auto_sign: cleanAutoSign,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'client_id' })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// PATCH { client_id, auto_sign } — updates only the preference
export async function PATCH(req: NextRequest) {
    try {
        const client_id = await getMobileUserId(req)
        if (!client_id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await req.json()
        const { auto_sign } = body

        if (!VALID_AUTO_SIGN.includes(auto_sign)) {
            return NextResponse.json({ error: 'Valeur auto_sign invalide' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('client_signatures')
            .update({ auto_sign, updated_at: new Date().toISOString() })
            .eq('client_id', client_id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// DELETE — supprime la signature du client authentifié
export async function DELETE(req: NextRequest) {
    try {
        const clientId = await getMobileUserId(req)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { error } = await supabase
            .from('client_signatures')
            .delete()
            .eq('client_id', clientId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
