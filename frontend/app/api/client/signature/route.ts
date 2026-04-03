import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey)
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getClientId(request: NextRequest): Promise<string | null> {
    try {
        // Lire le JWT depuis le cookie Supabase
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const browserClient = createClient(supabaseUrl, anonKey, {
            global: { headers: { cookie: request.headers.get('cookie') || '' } },
        })
        const { data: { user } } = await browserClient.auth.getUser()
        return user?.id || null
    } catch {
        return null
    }
}

// GET /api/client/signature — récupérer la signature du client connecté
export async function GET(request: NextRequest) {
    try {
        const clientId = await getClientId(request)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('client_signatures')
            .select('*')
            .eq('client_id', clientId)
            .maybeSingle()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/client/signature — sauvegarder ou mettre à jour la signature
export async function POST(request: NextRequest) {
    try {
        const clientId = await getClientId(request)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const { signature_data, auto_sign } = body

        if (!signature_data || typeof signature_data !== 'string') {
            return NextResponse.json({ error: 'Données de signature manquantes' }, { status: 400 })
        }

        // Valider que c'est bien une image base64
        if (!signature_data.startsWith('data:image/')) {
            return NextResponse.json({ error: 'Format de signature invalide' }, { status: 400 })
        }

        // Limite raisonnable : ~500KB pour une signature
        if (signature_data.length > 700_000) {
            return NextResponse.json({ error: 'Signature trop lourde. Simplifiez votre dessin.' }, { status: 400 })
        }

        const validAutoSign = ['ask', 'auto', 'never']
        const cleanAutoSign = validAutoSign.includes(auto_sign) ? auto_sign : 'ask'

        const supabase = getSupabase()
        const now = new Date().toISOString()

        const { data, error } = await supabase
            .from('client_signatures')
            .upsert({
                client_id: clientId,
                signature_data,
                auto_sign: cleanAutoSign,
                updated_at: now,
            }, { onConflict: 'client_id' })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/client/signature — mettre à jour seulement les préférences (auto_sign)
export async function PATCH(request: NextRequest) {
    try {
        const clientId = await getClientId(request)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const validAutoSign = ['ask', 'auto', 'never']
        if (!validAutoSign.includes(body.auto_sign)) {
            return NextResponse.json({ error: 'Valeur auto_sign invalide' }, { status: 400 })
        }

        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('client_signatures')
            .update({ auto_sign: body.auto_sign, updated_at: new Date().toISOString() })
            .eq('client_id', clientId)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ signature: data })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/client/signature — supprimer la signature
export async function DELETE(request: NextRequest) {
    try {
        const clientId = await getClientId(request)
        if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const supabase = getSupabase()
        const { error } = await supabase
            .from('client_signatures')
            .delete()
            .eq('client_id', clientId)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
