import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ywvsfhqdtkgzavxsumnk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function setupRoles() {
    console.log('🔄 Restauration du compte ornelrgb@gmail.com en tant qu\'agent...')

    // Obtenir l'utilisateur existant
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
        console.error('❌ Erreur:', usersError.message)
        return
    }

    const ornel = usersData.users.find(u => u.email === 'ornelrgb@gmail.com')
    if (ornel) {
        await supabase.from('user_profiles').update({ role: 'agent' }).eq('id', ornel.id)
        console.log('✅ Ornel RGB est de nouveau un agent.')
    } else {
        console.log('⚠️ ornelrgb@gmail.com non trouvé.')
    }

    console.log('\n👑 Création du compte Super Admin...')

    const adminEmail = 'kevinrtgagnant@gmail.com'
    const adminPassword = 'Degagebb1226'

    const kevin = usersData.users.find(u => u.email === adminEmail)

    let adminId = ''

    if (kevin) {
        console.log('⚠️ Le compte existe déjà, mise à jour du rôle...')
        adminId = kevin.id
    } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
        })

        if (authError) {
            console.error('❌ Erreur de création du compte:', authError.message)
            return
        }
        adminId = authData.user.id
        console.log('✅ Compte Auth Créé.')
    }

    // Définir le profil en tant qu'admin
    const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            id: adminId,
            full_name: 'Kevin RT Gagnant',
            role: 'admin',
            is_active: true,
        })

    if (profileError) {
        console.error('❌ Erreur de profil:', profileError.message)
        return
    }

    console.log('✅ Profil ADMIN configuré avec succès !')
    console.log('-------------------------------------------')
    console.log(`👨‍💻 L'ADMIN (Plein accès) s'identifie avec :`)
    console.log(`✉️ Email   : ${adminEmail}`)
    console.log(`🔑 Mot pass: ${adminPassword}`)
    console.log(`👉 Lien    : /admin/login`)
}

setupRoles()
