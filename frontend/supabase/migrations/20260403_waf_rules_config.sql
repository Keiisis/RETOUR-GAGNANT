-- ══════════════════════════════════════════════════════════════
-- MIGRATION WAF AVANCÉ — Règles custom + Configuration dynamique
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Table waf_config ────────────────────────────────────────
-- Clés de configuration globale du WAF (modifiables depuis admin)
CREATE TABLE IF NOT EXISTS public.waf_config (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    key         TEXT        NOT NULL UNIQUE,
    value       TEXT        NOT NULL DEFAULT '',
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waf_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_waf_config"        ON public.waf_config;
DROP POLICY IF EXISTS "service_role_waf_config" ON public.waf_config;

CREATE POLICY "admin_waf_config" ON public.waf_config
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );
CREATE POLICY "service_role_waf_config" ON public.waf_config
    FOR ALL TO service_role USING (true);

-- Valeurs par défaut
INSERT INTO public.waf_config (key, value, description) VALUES
    ('enabled',           'true',  'Activer/désactiver le WAF entier'),
    ('paranoia_level',    '1',     'Niveau de paranoia 1-4 (1=normal, 4=strict)'),
    ('blocked_countries', '[]',    'Liste JSON des codes pays bloqués ex: ["KP","IR"]'),
    ('whitelisted_ips',   '[]',    'Liste JSON des IPs exemptées du WAF ex: ["1.2.3.4"]'),
    ('whitelisted_paths', '[]',    'Liste JSON des chemins exemptés ex: ["/api/webhook"]')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Table waf_rules ─────────────────────────────────────────
-- Règles custom créées depuis le panel admin
CREATE TABLE IF NOT EXISTS public.waf_rules (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT        NOT NULL,
    pattern     TEXT        NOT NULL,         -- Regex
    category    TEXT        NOT NULL DEFAULT 'custom',
    description TEXT,
    severity    INT         NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 5),
    targets     JSONB       NOT NULL DEFAULT '["all"]',
    enabled     BOOLEAN     NOT NULL DEFAULT true,
    created_by  UUID        REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waf_rules_enabled_idx ON public.waf_rules(enabled) WHERE enabled = true;

ALTER TABLE public.waf_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_waf_rules"        ON public.waf_rules;
DROP POLICY IF EXISTS "service_role_waf_rules" ON public.waf_rules;

CREATE POLICY "admin_waf_rules" ON public.waf_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );
CREATE POLICY "service_role_waf_rules" ON public.waf_rules
    FOR ALL TO service_role USING (true);

-- Trigger: updater updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS waf_rules_updated_at ON public.waf_rules;
CREATE TRIGGER waf_rules_updated_at
    BEFORE UPDATE ON public.waf_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. Colonne score dans waf_logs ─────────────────────────────
ALTER TABLE public.waf_logs
    ADD COLUMN IF NOT EXISTS score         INT     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS matched_rules JSONB   DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS paranoia_level INT    DEFAULT 1;

-- ── 4. Vérification ────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('waf_config', 'waf_rules', 'waf_logs');
