-- ══════════════════════════════════════════════════════════════
-- MIGRATION SÉCURITÉ — WAF + 2FA + Chiffrement
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Table ip_blocks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ip_blocks (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    ip              TEXT        NOT NULL UNIQUE,
    reason          TEXT,
    blocked_by      TEXT        NOT NULL DEFAULT 'auto',  -- 'auto' | 'manual'
    violation_count INT         NOT NULL DEFAULT 1,
    blocked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,          -- NULL = permanent
    unblocked_at    TIMESTAMPTZ           -- renseigné quand débloqué manuellement
);

CREATE INDEX IF NOT EXISTS ip_blocks_ip_idx         ON public.ip_blocks(ip);
CREATE INDEX IF NOT EXISTS ip_blocks_blocked_at_idx ON public.ip_blocks(blocked_at DESC);

-- RLS : seuls admin/superadmin voient et modifient
ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_ip_blocks"        ON public.ip_blocks;
DROP POLICY IF EXISTS "service_role_ip_blocks" ON public.ip_blocks;

CREATE POLICY "admin_ip_blocks" ON public.ip_blocks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

CREATE POLICY "service_role_ip_blocks" ON public.ip_blocks
    FOR ALL TO service_role USING (true);

-- ── 2. Table waf_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_logs (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    ip           TEXT        NOT NULL,
    method       TEXT,
    path         TEXT        NOT NULL,
    user_agent   TEXT,
    threat_type  TEXT        NOT NULL,   -- 'sql_injection'|'xss'|'path_traversal'|'rate_limit'|'blocked_ip'
    threat_detail TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waf_logs_ip_idx         ON public.waf_logs(ip);
CREATE INDEX IF NOT EXISTS waf_logs_created_at_idx ON public.waf_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS waf_logs_threat_idx     ON public.waf_logs(threat_type);

-- Rétention automatique : supprimer les logs de plus de 90 jours
-- (à appeler via une fonction cron Supabase ou via l'API cron)
CREATE OR REPLACE FUNCTION public.cleanup_old_waf_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.waf_logs WHERE created_at < now() - INTERVAL '90 days';
END;
$$;

ALTER TABLE public.waf_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_waf_logs"        ON public.waf_logs;
DROP POLICY IF EXISTS "service_role_waf_logs" ON public.waf_logs;

CREATE POLICY "admin_waf_logs" ON public.waf_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

CREATE POLICY "service_role_waf_logs" ON public.waf_logs
    FOR ALL TO service_role USING (true);

-- ── 3. Table totp_secrets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.totp_secrets (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    secret      TEXT        NOT NULL,    -- Secret TOTP chiffré AES-256
    enabled     BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ,
    CONSTRAINT totp_secrets_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS totp_secrets_user_id_idx ON public.totp_secrets(user_id);

ALTER TABLE public.totp_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_totp_secret"          ON public.totp_secrets;
DROP POLICY IF EXISTS "service_role_totp_secrets" ON public.totp_secrets;

-- Chaque utilisateur ne voit que son propre secret
CREATE POLICY "own_totp_secret" ON public.totp_secrets
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "service_role_totp_secrets" ON public.totp_secrets
    FOR ALL TO service_role USING (true);

-- ── 4. Table encrypted_files (métadonnées chiffrement) ─────────
CREATE TABLE IF NOT EXISTS public.encrypted_files (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id  UUID        REFERENCES public.client_documents(id) ON DELETE CASCADE,
    storage_path TEXT        NOT NULL,   -- Chemin dans Supabase Storage (fichier chiffré)
    iv           TEXT        NOT NULL,   -- Vecteur d'initialisation (hex)
    auth_tag     TEXT        NOT NULL,   -- Tag d'authentification GCM (hex)
    original_name TEXT       NOT NULL,
    file_type    TEXT        NOT NULL,
    file_size    INT         NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.encrypted_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_encrypted_files"        ON public.encrypted_files;
DROP POLICY IF EXISTS "service_role_encrypted_files" ON public.encrypted_files;

CREATE POLICY "admin_encrypted_files" ON public.encrypted_files
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

CREATE POLICY "service_role_encrypted_files" ON public.encrypted_files
    FOR ALL TO service_role USING (true);

-- ── 5. Vérification ────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ip_blocks', 'waf_logs', 'totp_secrets', 'encrypted_files');
