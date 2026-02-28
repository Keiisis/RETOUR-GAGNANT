-- ═══════════════════════════════════════════════════════
-- MIGRATION: Email Logs + Realtime Notifications
-- Tracks all outgoing emails from the platform
-- ═══════════════════════════════════════════════════════

-- Email Logs Table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body_html TEXT DEFAULT '',
    context TEXT DEFAULT 'manual',  -- 'auto_reply', 'agent_reply', 'admin_notification', 'lead_notification', 'manual'
    related_id TEXT DEFAULT '',     -- ID of the related message/lead/order
    status TEXT DEFAULT 'pending',  -- 'sent', 'failed', 'pending'
    smtp_response TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all email_logs" ON public.email_logs FOR ALL USING (true);

-- Add 'telephone' column to messages if missing (for rdv forms)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'telephone'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN telephone TEXT DEFAULT '';
    END IF;
END $$;

-- Enable Supabase Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eligibility_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
