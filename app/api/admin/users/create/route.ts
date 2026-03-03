import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    if (!serviceKey) return NextResponse.json({ error: 'Service key manquante' }, { status: 500 })

    const { email, password, fullName, role } = await request.json()

    if (!email || !password || !fullName) {
        return NextResponse.json({ error: 'email, password et fullName requis' }, { status: 400 })
    }
    if (password.length < 6) {
        return NextResponse.json({ error: 'Mot de passe trop court (min 6 caractères)' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Créer le user via Admin API — email auto-confirmé, pas de mail de vérification
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role || 'agent' },
    })

    if (authError) {
        console.error('[Admin Create User] Auth error:', authError.message)
        return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // Créer / mettre à jour le profil dans user_profiles
    const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: userId,
        email: email.trim().toLowerCase(),
        full_name: fullName,
        role: role || 'agent',
        is_active: true,
    }, { onConflict: 'id' })

    if (profileError) {
        console.error('[Admin Create User] Profile error:', profileError.message)
        // L'auth user est créé mais le profil a échoué — on le signale mais ce n'est pas bloquant
    }

    return NextResponse.json({
        success: true,
        user: {
            id: userId,
            email: email.trim().toLowerCase(),
            full_name: fullName,
            role: role || 'agent',
        }
    })
}
