import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ywvsfhqdtkgzavxsumnk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function makeAdmin() {
    console.log('🔍 Recherche de l\'utilisateur ornelrgb@gmail.com...')

    // Obtenir l'utilisateur par e-mail
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
        console.error('Erreur:', usersError.message)
        return
    }

    const user = usersData.users.find(u => u.email === 'ornelrgb@gmail.com')

    if (!user) {
        console.error('❌ Utilisateur non trouvé !')
        return
    }

    console.log('✅ Utilisateur trouvé (ID:', user.id, ')')

    // Mettre à jour le profil pour le passer en Admin
    const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            id: user.id,
            full_name: 'Ornel RGB',
            role: 'admin',      // Passage en ADMIN !
            is_active: true,
        })

    if (profileError) {
        console.error('❌ Erreur de mise à jour du profil:', profileError.message)
        return
    }

    console.log('✅ Profil mis à jour avec le rôle ADMIN !')
}

makeAdmin()
