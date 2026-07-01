import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { validateStrongPassword } from '@/lib/password'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({
            error: 'Variables serveur manquantes (SUPABASE_SERVICE_ROLE_KEY)',
            hint: 'Vérifier les variables d\'environnement Vercel'
        }, { status: 500 })
    }

    const { email, password, fullName, role } = await request.json()

    if (!email || !password || !fullName) {
        return NextResponse.json({ error: 'email, password et fullName requis' }, { status: 400 })
    }
    const pwdErrors = validateStrongPassword(password)
    if (pwdErrors.length > 0) {
        return NextResponse.json({ error: `Mot de passe insuffisant : ${pwdErrors.join(', ')}` }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const supabase = createClient(supabaseUrl, serviceKey)

    // Vérifier si l'email existe déjà dans Supabase Auth
    const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = existingUsers?.users?.find(u => u.email === cleanEmail)

    let userId: string

    if (existingUser) {
        // L'utilisateur existe déjà (inscrit mais non confirmé, ou ancien compte)
        // On met à jour son mot de passe + métadonnées + email_confirm
        const { data: updatedAuth, error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName, role: role || 'agent' },
            }
        )

        if (updateError) {
            console.error('[Admin Create User] Update existing error:', updateError)
            return NextResponse.json({
                error: updateError.message,
                hint: 'Erreur lors de la mise à jour du compte existant'
            }, { status: 400 })
        }

        userId = existingUser.id
    } else {
        // Créer le user via Admin API — email auto-confirmé, sans email de vérification
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: role || 'agent' },
        })

        if (authError) {
            console.error('[Admin Create User] Auth error:', authError.message, 'code:', authError.status)

            // Tradure les erreurs Supabase en messages utiles
            let userMessage = authError.message
            if (authError.message.includes('invalid') && authError.message.includes('email')) {
                userMessage = `Email rejeté par Supabase. Vérifiez dans le Dashboard Supabase → Authentication → Settings que "Validate email domain" est désactivé. (Erreur originale : ${authError.message})`
            } else if (authError.message.includes('already') || authError.message.includes('exists')) {
                userMessage = 'Cet email est déjà enregistré dans Supabase.'
            } else if (authError.status === 401 || authError.message.includes('not authorized') || authError.message.includes('invalid claim')) {
                userMessage = 'SUPABASE_SERVICE_ROLE_KEY invalide ou absente. Vérifier Vercel → Settings → Environment Variables.'
            }

            return NextResponse.json({ error: userMessage }, { status: 400 })
        }

        userId = authData.user.id
    }

    // Créer / mettre à jour le profil dans user_profiles
    const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        role: role || 'agent',
        is_active: true,
    }, { onConflict: 'id' })

    if (profileError) {
        console.error('[Admin Create User] Profile error:', profileError.message)
        // L'auth user est créé/mis à jour, le profil a échoué — on retourne succès quand même
    }

    return NextResponse.json({
        success: true,
        updated: !!existingUser,
        user: {
            id: userId,
            email: cleanEmail,
            full_name: fullName,
            role: role || 'agent',
        }
    })
}
