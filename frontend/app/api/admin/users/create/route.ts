import { NextRequest, NextResponse } from 'next/server'
import { trouverUtilisateurParEmail } from '@/lib/auth-lookup'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { validateStrongPassword } from '@/lib/password'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/* Même liste que /api/admin/users/[id] : `role` était recopié tel quel, un
   admin pouvait créer un super-admin ou un rôle inventé — et, via la branche
   « compte existant », réécrire le mot de passe d'un super-admin. */
const ROLES_VALIDES = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent', 'client']
const ROLES_SUPER = ['super_admin', 'superadmin', 'ceo']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({
            error: 'Variables serveur manquantes (SUPABASE_SERVICE_ROLE_KEY)',
            hint: 'Vérifier les variables d\'environnement Vercel'
        }, { status: 500 })
    }

    const corps = await request.json().catch(() => ({}))
    const { email, password, fullName } = corps as { email?: string; password?: string; fullName?: string }
    const role = String((corps as { role?: string }).role || 'agent')

    if (!email || !password || !fullName || typeof email !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'email, password et fullName requis' }, { status: 400 })
    }
    if (!EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ error: 'Adresse e-mail invalide' }, { status: 400 })
    }
    if (!ROLES_VALIDES.includes(role)) {
        return NextResponse.json({ error: `Rôle inconnu : ${role}` }, { status: 400 })
    }
    const appelantSuper = ROLES_SUPER.includes(String(auth.role || ''))
    if (ROLES_SUPER.includes(role) && !appelantSuper) {
        return NextResponse.json({ error: 'Seul un super-administrateur peut créer un super-administrateur.' }, { status: 403 })
    }
    const pwdErrors = validateStrongPassword(password)
    if (pwdErrors.length > 0) {
        return NextResponse.json({ error: `Mot de passe insuffisant : ${pwdErrors.join(', ')}` }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const supabase = createClient(supabaseUrl, serviceKey)

    /* Anti-doublon BORNE : la lecture de la premiere page de mille comptes
       laissait passer un doublon des que la base depassait mille inscrits —
       et deux comptes pour une meme adresse, c'est un client qui se connecte
       un jour sur deux au mauvais. */
    const existingUser = await trouverUtilisateurParEmail(supabase, cleanEmail)

    let userId: string

    if (existingUser) {
        // Branche « compte existant » = réécriture du mot de passe et du rôle
        // d'un compte tiers : interdite sur un super-admin sauf par un super-admin.
        const { data: profilExistant } = await supabase
            .from('user_profiles').select('role').eq('id', existingUser.id).maybeSingle()
        const roleExistant = String((profilExistant as { role?: string } | null)?.role || '')
        if (ROLES_SUPER.includes(roleExistant) && !appelantSuper) {
            return NextResponse.json({ error: 'Ce compte appartient à un super-administrateur : modification refusée.' }, { status: 403 })
        }
        if (existingUser.id === auth.userId) {
            return NextResponse.json({ error: 'Utilisez votre profil pour modifier votre propre compte.' }, { status: 400 })
        }

        // L'utilisateur existe déjà (inscrit mais non confirmé, ou ancien compte)
        // On met à jour son mot de passe + métadonnées + email_confirm
        const { data: updatedAuth, error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName, role },
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
        // Créer le user via Admin API : email auto-confirmé, sans email de vérification
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role },
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
        role,
        is_active: true,
    }, { onConflict: 'id' })

    if (profileError) {
        console.error('[Admin Create User] Profile error:', profileError.message)
        // Le rôle vit dans user_profiles : sans profil, le compte existe mais
        // n'a pas les droits annoncés. On ne répond plus « succès ».
        return NextResponse.json({
            error: `Compte d'authentification créé, mais profil non enregistré : ${profileError.message}`,
            userId,
        }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        updated: !!existingUser,
        user: {
            id: userId,
            email: cleanEmail,
            full_name: fullName,
            role,
        }
    })
}
