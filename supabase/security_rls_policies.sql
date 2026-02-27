-- ═══════════════════════════════════════════════════════
-- 🛡️ SECURITY — Row Level Security (RLS) Policies
-- Agent Dashboard — Retour Gagnant Bénin
-- ═══════════════════════════════════════════════════════
-- Enable RLS on all relevant tables
ALTER TABLE IF EXISTS dossier_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS eligibility_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
-- ═══ Drop existing policies to avoid conflicts ═══
DROP POLICY IF EXISTS "agents_select_dossiers" ON dossier_tracking;
DROP POLICY IF EXISTS "agents_insert_dossiers" ON dossier_tracking;
DROP POLICY IF EXISTS "agents_update_dossiers" ON dossier_tracking;
DROP POLICY IF EXISTS "agents_select_messages" ON messages;
DROP POLICY IF EXISTS "agents_update_messages" ON messages;
DROP POLICY IF EXISTS "agents_select_voice_messages" ON voice_messages;
DROP POLICY IF EXISTS "agents_update_voice_messages" ON voice_messages;
DROP POLICY IF EXISTS "agents_select_eligibility" ON eligibility_results;
DROP POLICY IF EXISTS "agents_update_eligibility" ON eligibility_results;
DROP POLICY IF EXISTS "users_select_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON user_profiles;
-- ═══ Helper function: check if user is agent or admin ═══
CREATE OR REPLACE FUNCTION is_agent_or_admin() RETURNS BOOLEAN AS $$ BEGIN RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE id = auth.uid()
            AND role IN ('agent', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ═══════════════════════════════════════════
-- DOSSIER TRACKING
-- ═══════════════════════════════════════════
-- Agents can read all dossiers
CREATE POLICY "agents_select_dossiers" ON dossier_tracking FOR
SELECT USING (is_agent_or_admin());
-- Agents can insert new dossiers
CREATE POLICY "agents_insert_dossiers" ON dossier_tracking FOR
INSERT WITH CHECK (is_agent_or_admin());
-- Agents can update dossiers
CREATE POLICY "agents_update_dossiers" ON dossier_tracking FOR
UPDATE USING (is_agent_or_admin());
-- ═══════════════════════════════════════════
-- MESSAGES
-- ═══════════════════════════════════════════
-- Agents can read all messages
CREATE POLICY "agents_select_messages" ON messages FOR
SELECT USING (is_agent_or_admin());
-- Agents can update message status (mark as read)
CREATE POLICY "agents_update_messages" ON messages FOR
UPDATE USING (is_agent_or_admin());
-- Anyone can insert messages (public contact form)
DROP POLICY IF EXISTS "public_insert_messages" ON messages;
CREATE POLICY "public_insert_messages" ON messages FOR
INSERT WITH CHECK (true);
-- ═══════════════════════════════════════════
-- VOICE MESSAGES
-- ═══════════════════════════════════════════
-- Agents can read all voice messages
CREATE POLICY "agents_select_voice_messages" ON voice_messages FOR
SELECT USING (is_agent_or_admin());
-- Agents can update voice message status
CREATE POLICY "agents_update_voice_messages" ON voice_messages FOR
UPDATE USING (is_agent_or_admin());
-- ═══════════════════════════════════════════
-- ELIGIBILITY RESULTS (Leads Oracle)
-- ═══════════════════════════════════════════
-- Agents can view all leads
CREATE POLICY "agents_select_eligibility" ON eligibility_results FOR
SELECT USING (is_agent_or_admin());
-- Agents can update leads (mark contacted)
CREATE POLICY "agents_update_eligibility" ON eligibility_results FOR
UPDATE USING (is_agent_or_admin());
-- Anyone can insert (public eligibility form)
DROP POLICY IF EXISTS "public_insert_eligibility" ON eligibility_results;
CREATE POLICY "public_insert_eligibility" ON eligibility_results FOR
INSERT WITH CHECK (true);
-- ═══════════════════════════════════════════
-- USER PROFILES
-- ═══════════════════════════════════════════
-- Users can only view their own profile
CREATE POLICY "users_select_own_profile" ON user_profiles FOR
SELECT USING (id = auth.uid());
-- Users can only update their own profile
CREATE POLICY "users_update_own_profile" ON user_profiles FOR
UPDATE USING (id = auth.uid());
-- Admins can view all profiles
DROP POLICY IF EXISTS "admins_select_all_profiles" ON user_profiles;
CREATE POLICY "admins_select_all_profiles" ON user_profiles FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM user_profiles up
            WHERE up.id = auth.uid()
                AND up.role = 'admin'
        )
    );