import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET : récupérer le profil du client connecté
export async function GET(req: NextRequest) {
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => req.cookies.getAll(),
                    setAll: () => {},
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { data: profile } = await serviceSupabase
            .from('client_profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        return NextResponse.json({ profile })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

// PATCH : mettre à jour le profil
export async function PATCH(req: NextRequest) {
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => req.cookies.getAll(),
                    setAll: () => {},
                },
            }
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await req.json()
        const { nom, prenom, phone, adresse, ville, pays, avatar_url } = body

        const { data, error } = await serviceSupabase
            .from('client_profiles')
            .update({ nom, prenom, phone, adresse, ville, pays, avatar_url })
            .eq('id', user.id)
            .select()
            .single()

        if (error) throw new Error(error.message)

        return NextResponse.json({ success: true, profile: data })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur interne'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
