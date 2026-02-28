const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://ywvsfhqdtkgzavxsumnk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM',
    { db: { schema: 'public' } }
);

const sql = `
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    context TEXT DEFAULT 'manual',
    related_id TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    smtp_response TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Admin all email_logs" ON public.email_logs FOR ALL USING (true);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='telephone') THEN
        ALTER TABLE public.messages ADD COLUMN telephone TEXT DEFAULT '';
    END IF;
END $$;
`;

// Use the management API to run SQL
const url = 'https://ywvsfhqdtkgzavxsumnk.supabase.co/rest/v1/rpc/';
fetch('https://ywvsfhqdtkgzavxsumnk.supabase.co/rest/v1/', {
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3dnNmaHFkdGtnemF2eHN1bW5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAxOTMzMSwiZXhwIjoyMDg3NTk1MzMxfQ.bXmg2q4jNtKk_UaPC784YaAWwsS_VQPMqQX5P_8o9zM'
    }
}).then(r => r.text()).then(t => {
    console.log('Supabase REST is alive.');
    console.log('');
    console.log('=== IMPORTANT: Please run this SQL in your Supabase Dashboard ===');
    console.log('Go to: https://supabase.com/dashboard/project/ywvsfhqdtkgzavxsumnk/sql');
    console.log('Paste and execute the migration SQL from: supabase/migration_email_realtime.sql');
}).catch(e => console.error('Connection failed:', e.message));
