import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    'https://ywvsfhqdtkgzavxsumnk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM'
)

async function migrate() {
    console.log('Adding last_seen_at column to user_profiles...')

    const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;'
    })

    if (error) {
        // Try direct approach if RPC doesn't exist
        console.log('RPC not available, trying direct update...')

        // Test by updating a user profile with last_seen_at
        const { error: testError } = await supabase
            .from('user_profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('role', 'agent')
            .limit(1)

        if (testError) {
            if (testError.message.includes('last_seen_at')) {
                console.error('Column does not exist. Please run this SQL in Supabase Dashboard:')
                console.error('ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;')
            } else {
                console.error('Error:', testError.message)
            }
        } else {
            console.log('Column already exists! Updated successfully.')
        }
    } else {
        console.log('Migration completed successfully!')
    }
}

migrate()
