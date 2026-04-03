-- ══════════════════════════════════════════════════════════════
-- MIGRATION : WAF Mémoire IP + Apprentissage Automatique
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 0. Débloquer les IPs auto-bloquées légitimes ──────────────
-- IMPORTANT : Débloque les IPs bloquées par faux positifs du WAF
-- (les admins bloqués par la session précédente)
-- Supprime tous les auto-blocages (blocked_by = 'auto') créés avant aujourd'hui
UPDATE public.ip_blocks
SET unblocked_at = now()
WHERE unblocked_at IS NULL
  AND blocked_by = 'auto'
  AND blocked_at < now() - interval '1 hour';

-- ── 1. Mémoire IP active ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_ip_memory (
    ip               TEXT PRIMARY KEY,
    first_seen       TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen        TIMESTAMPTZ DEFAULT now() NOT NULL,
    total_requests   INTEGER DEFAULT 0 NOT NULL,
    blocked_count    INTEGER DEFAULT 0 NOT NULL,
    trust_score      INTEGER DEFAULT 50 NOT NULL,  -- 0-100 (50=neutre, 100=très fiable, 0=dangereux)
    attack_types     TEXT[] DEFAULT '{}' NOT NULL,
    payload_hashes   TEXT[] DEFAULT '{}' NOT NULL,
    is_trusted       BOOLEAN DEFAULT false NOT NULL,
    evolution_log    TEXT[] DEFAULT '{}' NOT NULL,
    CONSTRAINT trust_score_range CHECK (trust_score >= 0 AND trust_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_waf_ip_memory_trust ON public.waf_ip_memory(trust_score);
CREATE INDEX IF NOT EXISTS idx_waf_ip_memory_last_seen ON public.waf_ip_memory(last_seen DESC);

-- ── 2. Règles auto-apprises ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_learned_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern      TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'custom_rule',
    description  TEXT NOT NULL DEFAULT '',
    source_ips   TEXT[] DEFAULT '{}' NOT NULL,
    hit_count    INTEGER DEFAULT 1 NOT NULL,
    confidence   FLOAT DEFAULT 0.5 NOT NULL,  -- 0=faible, 1=certain
    auto_active  BOOLEAN DEFAULT false NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT confidence_range CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS idx_waf_learned_confidence ON public.waf_learned_rules(confidence, auto_active);
CREATE INDEX IF NOT EXISTS idx_waf_learned_created ON public.waf_learned_rules(created_at DESC);

-- ── 3. Campagnes d'attaque détectées ─────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_campaigns (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload_hash  TEXT NOT NULL UNIQUE,
    source_ips    TEXT[] DEFAULT '{}' NOT NULL,
    start_time    TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen     TIMESTAMPTZ DEFAULT now() NOT NULL,
    blocked_count INTEGER DEFAULT 0 NOT NULL,
    status        TEXT DEFAULT 'active' NOT NULL,  -- active | resolved | false_positive
    CONSTRAINT status_values CHECK (status IN ('active', 'resolved', 'false_positive'))
);

CREATE INDEX IF NOT EXISTS idx_waf_campaigns_hash ON public.waf_campaigns(payload_hash);
CREATE INDEX IF NOT EXISTS idx_waf_campaigns_status ON public.waf_campaigns(status, last_seen DESC);

-- ── 4. Alertes admin temps réel ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_alerts (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level      TEXT NOT NULL DEFAULT 'warning',  -- info | warning | critical | nuclear
    message    TEXT NOT NULL,
    context    JSONB DEFAULT '{}' NOT NULL,
    resolved   BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT level_values CHECK (level IN ('info', 'warning', 'critical', 'nuclear'))
);

CREATE INDEX IF NOT EXISTS idx_waf_alerts_unresolved ON public.waf_alerts(resolved, created_at DESC);

-- ── 5. Index performance waf_logs ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_waf_logs_ip_date ON public.waf_logs(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_logs_threat ON public.waf_logs(threat_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_logs_path ON public.waf_logs(path, created_at DESC);

-- ── 6. Ajouter colonnes score + règles à waf_logs si manquantes ─
ALTER TABLE public.waf_logs
    ADD COLUMN IF NOT EXISTS score        INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rule_ids     TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS snippet      TEXT DEFAULT '';

-- ── 7. RLS Policies ──────────────────────────────────────────
ALTER TABLE public.waf_ip_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_learned_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_alerts ENABLE ROW LEVEL SECURITY;

-- Admins + CEO peuvent tout lire/écrire
CREATE POLICY "admin_waf_ip_memory" ON public.waf_ip_memory
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
    ));

CREATE POLICY "admin_waf_learned_rules" ON public.waf_learned_rules
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
    ));

CREATE POLICY "admin_waf_campaigns" ON public.waf_campaigns
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
    ));

CREATE POLICY "admin_waf_alerts" ON public.waf_alerts
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
    ));

-- ── 8. Vérification ──────────────────────────────────────────
SELECT
    'waf_ip_memory'    AS table_name, count(*) AS rows FROM public.waf_ip_memory
UNION ALL SELECT 'waf_learned_rules', count(*) FROM public.waf_learned_rules
UNION ALL SELECT 'waf_campaigns',     count(*) FROM public.waf_campaigns
UNION ALL SELECT 'waf_alerts',        count(*) FROM public.waf_alerts;

SELECT 'IPs auto-débloquées: ' || count(*)::text AS deblocage_result
FROM public.ip_blocks
WHERE unblocked_at >= now() - interval '5 minutes';
