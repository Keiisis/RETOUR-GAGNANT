import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ywvsfhqdtkgzavxsumnk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function createAgent() {
    console.log('🔧 Création de l\'agent...')

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'ornelrgb@gmail.com',
        password: 'Degagebb26',
        email_confirm: true,
    })

    if (authError) {
        console.error('❌ Erreur Auth:', authError.message)
        return
    }

    console.log('✅ Utilisateur Auth créé:', authData.user.id)

    const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            id: authData.user.id,
            full_name: 'Ornel RGB',
            role: 'agent',
            avatar_url: null,
            is_active: true,
        })

    if (profileError) {
        console.error('❌ Erreur Profil:', profileError.message)
        return
    }

    console.log('✅ Profil agent créé!')
    console.log('📋 Email: ornelrgb@gmail.com | Rôle: agent | ID:', authData.user.id)
    console.log('🔗 http://localhost:3000/agent/login')
}

createAgent()
