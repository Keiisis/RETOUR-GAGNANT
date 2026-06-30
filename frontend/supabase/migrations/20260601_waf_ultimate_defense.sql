-- ══════════════════════════════════════════════════════════════
-- MIGRATION : WAF ULTIMATE v2 — Défense Active & Adaptative
-- Cyber-déception · Corrélation comportementale · Auto-scoring
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- Dépendances : 20260405_waf_memory_learning, 20260406_waf_autonomous,
--               20260601_waf_ultimate_defense
-- ══════════════════════════════════════════════════════════════

-- ── 0. Types ENUM stricts (intégrité + perf vs TEXT libre) ────
DO $$ BEGIN
    CREATE TYPE waf_action AS ENUM (
        'allow', 'monitor', 'challenge', 'tarpit',
        'deceive', 'block', 'ban', 'shadowban'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE waf_attack_class AS ENUM (
        'sql_injection', 'xss', 'lfi', 'rfi', 'rce', 'ssrf',
        'ssti', 'xxe', 'path_traversal', 'scanner_detection',
        'brute_force', 'credential_stuffing', 'enumeration',
        'honeypot', 'protocol_anomaly', 'rate_abuse', 'unknown'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. Enrichissement waf_ip_memory (scoring + géo + ASN) ─────
ALTER TABLE public.waf_ip_memory
    ADD COLUMN IF NOT EXISTS fingerprint_hashes  TEXT[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS tarpit_level         INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deception_count      INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_action          TEXT    DEFAULT 'allow',
    ADD COLUMN IF NOT EXISTS ip_hopper            BOOLEAN DEFAULT false,
    -- Nouveaux : enrichissement threat intel
    ADD COLUMN IF NOT EXISTS asn                  INTEGER,
    ADD COLUMN IF NOT EXISTS asn_org              TEXT,
    ADD COLUMN IF NOT EXISTS country_code         TEXT,
    ADD COLUMN IF NOT EXISTS is_datacenter        BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_tor               BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vpn               BOOLEAN DEFAULT false,
    -- Scoring décroissant dans le temps (threat decay)
    ADD COLUMN IF NOT EXISTS threat_score         NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS threat_velocity      NUMERIC(8,4) DEFAULT 0,  -- vitesse d'escalade
    ADD COLUMN IF NOT EXISTS score_decay_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS campaign_id          UUID,
    ADD COLUMN IF NOT EXISTS attack_vectors       waf_attack_class[] DEFAULT '{}';

-- ── 2. Enrichissement waf_logs (forensic + corrélation) ───────
ALTER TABLE public.waf_logs
    ADD COLUMN IF NOT EXISTS action             TEXT    DEFAULT 'block',
    ADD COLUMN IF NOT EXISTS response_delay_ms  INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fingerprint_hash   TEXT    DEFAULT '',
    -- Nouveaux : richesse forensique
    ADD COLUMN IF NOT EXISTS attack_class       waf_attack_class DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS confidence         NUMERIC(5,2) DEFAULT 0,    -- 0-100
    ADD COLUMN IF NOT EXISTS matched_rule_ids   TEXT[]  DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS request_entropy    NUMERIC(6,3),              -- détection payload obfusqué
    ADD COLUMN IF NOT EXISTS campaign_id        UUID,
    ADD COLUMN IF NOT EXISTS geo_country        TEXT,
    ADD COLUMN IF NOT EXISTS asn                INTEGER;

-- ── 3. Table : Device Fingerprints (avec décroissance + entropie) ─
CREATE TABLE IF NOT EXISTS public.waf_device_fingerprints (
    hash            TEXT PRIMARY KEY,
    components      JSONB NOT NULL DEFAULT '{}',
    associated_ips  TEXT[] DEFAULT '{}' NOT NULL,
    asn_history     INTEGER[] DEFAULT '{}' NOT NULL,   -- ASN traversés
    country_history TEXT[] DEFAULT '{}' NOT NULL,      -- pays traversés
    first_seen      TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen       TIMESTAMPTZ DEFAULT now() NOT NULL,
    trust_score     NUMERIC(6,2) DEFAULT 50 NOT NULL,
    stability_score NUMERIC(6,2) DEFAULT 50 NOT NULL,  -- cohérence des composants
    total_requests  BIGINT  DEFAULT 0 NOT NULL,
    blocked_count   BIGINT  DEFAULT 0 NOT NULL,
    deceived_count  BIGINT  DEFAULT 0 NOT NULL,
    distinct_ips    INTEGER DEFAULT 0 NOT NULL,         -- cardinalité = signal hopper
    is_known_bad    BOOLEAN DEFAULT false NOT NULL,
    tags            TEXT[] DEFAULT '{}' NOT NULL,
    campaign_id     UUID,
    CONSTRAINT fp_trust_range CHECK (trust_score >= 0 AND trust_score <= 100),
    CONSTRAINT fp_stab_range  CHECK (stability_score >= 0 AND stability_score <= 100)
);

-- Auto-réparation : si la table existe déjà depuis un run antérieur avec un
-- schéma plus ancien, CREATE TABLE IF NOT EXISTS la saute SANS ajouter les
-- colonnes manquantes. On garantit donc chaque colonne avant les index/triggers.
ALTER TABLE public.waf_device_fingerprints
    ADD COLUMN IF NOT EXISTS components      JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS associated_ips  TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS asn_history     INTEGER[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS country_history TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS trust_score     NUMERIC(6,2) NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS stability_score NUMERIC(6,2) NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS total_requests  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS blocked_count   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deceived_count  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distinct_ips    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_known_bad    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS tags            TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS campaign_id     UUID;

CREATE INDEX IF NOT EXISTS idx_waf_fp_trust
    ON public.waf_device_fingerprints(trust_score) WHERE trust_score < 30;
CREATE INDEX IF NOT EXISTS idx_waf_fp_bad
    ON public.waf_device_fingerprints(is_known_bad) WHERE is_known_bad = true;
CREATE INDEX IF NOT EXISTS idx_waf_fp_last_seen
    ON public.waf_device_fingerprints(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_waf_fp_campaign
    ON public.waf_device_fingerprints(campaign_id) WHERE campaign_id IS NOT NULL;
-- Recherche GIN sur IP associées (jointure rapide hopper)
CREATE INDEX IF NOT EXISTS idx_waf_fp_ips_gin
    ON public.waf_device_fingerprints USING GIN (associated_ips);
CREATE INDEX IF NOT EXISTS idx_waf_fp_tags_gin
    ON public.waf_device_fingerprints USING GIN (tags);

-- ── 4. Table : Campagnes d'attaque (corrélation multi-IP) ─────
-- Regroupe des attaquants distincts en une seule campagne coordonnée
CREATE TABLE IF NOT EXISTS public.waf_attack_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label           TEXT NOT NULL DEFAULT 'auto-detected',
    signature_hash  TEXT,                                -- pattern commun (TTP)
    attack_classes  waf_attack_class[] DEFAULT '{}',
    distinct_ips    INTEGER DEFAULT 0,
    distinct_fps    INTEGER DEFAULT 0,
    total_events    BIGINT  DEFAULT 0,
    severity        INTEGER DEFAULT 1,                   -- 1-10
    is_active       BOOLEAN DEFAULT true,
    first_seen      TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen       TIMESTAMPTZ DEFAULT now() NOT NULL,
    notes           TEXT DEFAULT '',
    CONSTRAINT camp_sev CHECK (severity BETWEEN 1 AND 10)
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_attack_campaigns
    ADD COLUMN IF NOT EXISTS label          TEXT NOT NULL DEFAULT 'auto-detected',
    ADD COLUMN IF NOT EXISTS signature_hash TEXT,
    ADD COLUMN IF NOT EXISTS attack_classes waf_attack_class[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS distinct_ips   INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS distinct_fps   INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_events   BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS severity       INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS last_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS notes          TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_waf_camp_active
    ON public.waf_attack_campaigns(is_active, severity DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_waf_camp_sig
    ON public.waf_attack_campaigns(signature_hash);

-- ── 5. Table : Configuration Tarpitting (adaptative) ──────────
CREATE TABLE IF NOT EXISTS public.waf_tarpit_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trust_min       INTEGER NOT NULL,
    trust_max       INTEGER NOT NULL,
    delay_ms        INTEGER NOT NULL,
    jitter_ms       INTEGER DEFAULT 0,
    -- Nouveaux : escalade dynamique
    backoff_factor  NUMERIC(4,2) DEFAULT 1.0,   -- multiplicateur par récidive
    max_delay_ms    INTEGER DEFAULT 30000,
    drip_bytes      INTEGER DEFAULT 0,          -- slow-drip de la réponse (octets/intervalle)
    description     TEXT NOT NULL DEFAULT '',
    enabled         BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT trust_order    CHECK (trust_min < trust_max),
    CONSTRAINT delay_positive CHECK (delay_ms >= 0 AND delay_ms <= 30000),
    CONSTRAINT backoff_pos    CHECK (backoff_factor >= 1.0)
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_tarpit_config
    ADD COLUMN IF NOT EXISTS trust_min      INTEGER,
    ADD COLUMN IF NOT EXISTS trust_max      INTEGER,
    ADD COLUMN IF NOT EXISTS delay_ms       INTEGER,
    ADD COLUMN IF NOT EXISTS jitter_ms      INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS backoff_factor NUMERIC(4,2) DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS max_delay_ms   INTEGER DEFAULT 30000,
    ADD COLUMN IF NOT EXISTS drip_bytes     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description    TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS enabled        BOOLEAN DEFAULT true;

INSERT INTO public.waf_tarpit_config
    (trust_min, trust_max, delay_ms, jitter_ms, backoff_factor, drip_bytes, description) VALUES
    (40, 50, 0,    0,    1.0, 0,  'Neutre — aucun délai'),
    (30, 40, 500,  200,  1.3, 0,  'Suspicion légère — 0.5s, backoff x1.3'),
    (20, 30, 2000, 500,  1.5, 64, 'Suspicion modérée — 2s + slow-drip 64o'),
    (10, 20, 5000, 1000, 1.8, 16, 'Haute suspicion — 5s + drip 16o'),
    (0,  10, 8000, 2000, 2.0, 4,  'Danger critique — 8s + drip 4o (étranglement max)')
ON CONFLICT DO NOTHING;

-- ── 6. Table : Payloads de Déception (rotation pondérée + TTP) ─
CREATE TABLE IF NOT EXISTS public.waf_deception_payloads (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attack_type      waf_attack_class NOT NULL,
    payload_name     TEXT NOT NULL,
    status_code      INTEGER DEFAULT 200,
    content_type     TEXT DEFAULT 'text/html',
    response_body    TEXT NOT NULL,
    response_headers JSONB DEFAULT '{}',
    description      TEXT DEFAULT '',
    rotation_weight  INTEGER DEFAULT 1,
    served_count     BIGINT  DEFAULT 0,          -- stats d'usage
    bait_tokens      TEXT[]  DEFAULT '{}',       -- canary tokens injectés (traque réutilisation)
    enabled          BOOLEAN DEFAULT true NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT dec_weight CHECK (rotation_weight >= 0)
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_deception_payloads
    ADD COLUMN IF NOT EXISTS attack_type      waf_attack_class,
    ADD COLUMN IF NOT EXISTS payload_name     TEXT,
    ADD COLUMN IF NOT EXISTS status_code      INTEGER DEFAULT 200,
    ADD COLUMN IF NOT EXISTS content_type     TEXT DEFAULT 'text/html',
    ADD COLUMN IF NOT EXISTS response_body    TEXT,
    ADD COLUMN IF NOT EXISTS response_headers JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS description      TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS rotation_weight  INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS served_count     BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bait_tokens      TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS enabled          BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waf_deception_type
    ON public.waf_deception_payloads(attack_type, enabled) WHERE enabled = true;

-- (Tes payloads existants restent valides — exemple condensé conservé)
INSERT INTO public.waf_deception_payloads
    (attack_type, payload_name, status_code, content_type, response_body, response_headers, bait_tokens, description) VALUES
('sql_injection','fake_mysql_error',500,'text/html; charset=utf-8',
 E'<!DOCTYPE html><html><head><title>Database Error</title></head><body><h1>Database Error</h1><p><b>MySQL Error 1045:</b> Access denied for user ''webapp_prod''@''10.0.3.42'' (using password: YES)</p><p>Server: <code>db-replica-03.internal.corp</code></p></body></html>',
 '{"X-Powered-By":"PHP/7.4.33","Server":"Apache/2.4.41 (Ubuntu)"}',
 ARRAY['db-replica-03.internal.corp','webapp_prod'],
 'Faux MySQL avec canary tokens — détecte la réutilisation des infos leak')
ON CONFLICT DO NOTHING;

-- ── 7. Table : Interactions Honeypot (forensic enrichi) ───────
CREATE TABLE IF NOT EXISTS public.waf_honeypot_interactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip               TEXT NOT NULL,
    fingerprint_hash TEXT DEFAULT '',
    campaign_id      UUID,
    path             TEXT NOT NULL,
    method           TEXT DEFAULT 'GET',
    attack_class     waf_attack_class DEFAULT 'honeypot',
    payload_used     TEXT DEFAULT '',
    request_headers  JSONB DEFAULT '{}',
    request_body     TEXT DEFAULT '',
    captured_creds   JSONB DEFAULT '{}',     -- credentials extraits du faux login
    duration_ms      INTEGER DEFAULT 0,
    engagement_depth INTEGER DEFAULT 1,      -- nb d'étapes suivies dans le piège
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_honeypot_interactions
    ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS campaign_id      UUID,
    ADD COLUMN IF NOT EXISTS path             TEXT,
    ADD COLUMN IF NOT EXISTS method           TEXT DEFAULT 'GET',
    ADD COLUMN IF NOT EXISTS attack_class     waf_attack_class DEFAULT 'honeypot',
    ADD COLUMN IF NOT EXISTS payload_used     TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS request_headers  JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS request_body     TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS captured_creds   JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS duration_ms      INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS engagement_depth INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waf_hp_ip   ON public.waf_honeypot_interactions(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_hp_date ON public.waf_honeypot_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_hp_camp ON public.waf_honeypot_interactions(campaign_id) WHERE campaign_id IS NOT NULL;

-- ── 8. FONCTION : Calcul de l'action adaptative ───────────────
-- Le cœur intelligent : décide allow/tarpit/deceive/block à partir
-- du trust score, de la vélocité et du contexte threat intel.
CREATE OR REPLACE FUNCTION public.waf_decide_action(
    p_trust_score   NUMERIC,
    p_threat_score  NUMERIC,
    p_is_hopper     BOOLEAN DEFAULT false,
    p_is_tor        BOOLEAN DEFAULT false,
    p_known_bad     BOOLEAN DEFAULT false
) RETURNS waf_action
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF p_known_bad OR p_threat_score >= 90 THEN RETURN 'ban';        END IF;
    IF p_is_hopper AND p_threat_score >= 60 THEN RETURN 'shadowban'; END IF;
    IF p_trust_score < 10 OR p_threat_score >= 75 THEN RETURN 'deceive'; END IF;
    IF p_trust_score < 30 OR p_threat_score >= 50 THEN RETURN 'tarpit';  END IF;
    IF p_is_tor OR p_trust_score < 40            THEN RETURN 'challenge';END IF;
    IF p_trust_score < 50                         THEN RETURN 'monitor'; END IF;
    RETURN 'allow';
END $$;

-- ── 9. FONCTION : Décroissance temporelle du threat score ─────
-- Le danger s'estompe avec le temps (évite le bannissement éternel
-- d'IP dynamiques recyclées + concentre la défense sur menaces vives)
CREATE OR REPLACE FUNCTION public.waf_decay_threat_scores(
    p_half_life_hours NUMERIC DEFAULT 24
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
    UPDATE public.waf_ip_memory
    SET threat_score = GREATEST(0, threat_score *
            POWER(0.5, EXTRACT(EPOCH FROM (now() - COALESCE(score_decay_at, now())))
                       / (p_half_life_hours * 3600))),
        score_decay_at = now()
    WHERE threat_score > 0
      AND COALESCE(score_decay_at, first_seen) < now() - INTERVAL '1 hour';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END $$;

-- ── 10. TRIGGER : Auto-détection ip_hopper + maj fingerprint ──
CREATE OR REPLACE FUNCTION public.waf_fp_maintenance() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.distinct_ips := COALESCE(array_length(NEW.associated_ips, 1), 0);
    NEW.last_seen    := now();
    -- Marque hopper si > 3 IP distinctes OU traversée de plusieurs ASN
    IF NEW.distinct_ips > 3
       OR COALESCE(array_length(NEW.asn_history, 1), 0) > 2 THEN
        IF NOT ('ip_hopper' = ANY(NEW.tags)) THEN
            NEW.tags := array_append(NEW.tags, 'ip_hopper');
        END IF;
        NEW.trust_score := GREATEST(0, NEW.trust_score - 15);
    END IF;
    -- Trust auto-dégradé selon taux de blocage
    IF NEW.total_requests > 0 THEN
        NEW.stability_score := GREATEST(0, 100 -
            (NEW.blocked_count::NUMERIC / NEW.total_requests * 100));
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_waf_fp_maintenance ON public.waf_device_fingerprints;
CREATE TRIGGER trg_waf_fp_maintenance
    BEFORE INSERT OR UPDATE ON public.waf_device_fingerprints
    FOR EACH ROW EXECUTE FUNCTION public.waf_fp_maintenance();

-- ── 11. VUE MATÉRIALISÉE : Top menaces temps réel ─────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.waf_threat_dashboard AS
SELECT
    m.ip,
    m.threat_score,
    m.country_code,
    m.asn_org,
    m.ip_hopper,
    m.attack_vectors,
    public.waf_decide_action(50, m.threat_score, m.ip_hopper, m.is_tor, false) AS recommended_action,
    c.label   AS campaign,
    c.severity,
    m.last_action
FROM public.waf_ip_memory m
LEFT JOIN public.waf_attack_campaigns c ON c.id = m.campaign_id
WHERE m.threat_score > 0
ORDER BY m.threat_score DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_waf_dashboard_ip
    ON public.waf_threat_dashboard(ip);

-- ── 12. RLS pour toutes les nouvelles tables ──────────────────
ALTER TABLE public.waf_device_fingerprints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_tarpit_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_deception_payloads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_honeypot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_attack_campaigns      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'waf_device_fingerprints','waf_tarpit_config','waf_deception_payloads',
        'waf_honeypot_interactions','waf_attack_campaigns'
    ] LOOP
        BEGIN
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO authenticated
                USING (EXISTS (SELECT 1 FROM public.user_profiles
                       WHERE id = auth.uid()
                       AND role IN ('admin','super_admin','superadmin','ceo')));
            $f$, 'admin_'||t, t);
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO service_role USING (true);
            $f$, 'service_'||t, t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;

-- ── 13. Index performance supplémentaires ─────────────────────
CREATE INDEX IF NOT EXISTS idx_waf_logs_action
    ON public.waf_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_logs_fingerprint
    ON public.waf_logs(fingerprint_hash) WHERE fingerprint_hash != '';
CREATE INDEX IF NOT EXISTS idx_waf_logs_class
    ON public.waf_logs(attack_class, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_logs_campaign
    ON public.waf_logs(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waf_ip_memory_hopper
    ON public.waf_ip_memory(ip_hopper) WHERE ip_hopper = true;
CREATE INDEX IF NOT EXISTS idx_waf_ip_memory_threat
    ON public.waf_ip_memory(threat_score DESC) WHERE threat_score > 0;

-- ── 14. ENUM : Nouvelles classes d'attaque (système immunitaire) ─
-- Ajout sécurisé des nouvelles valeurs (ne casse pas si déjà existantes)
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'idor'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'bola'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'request_smuggling'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'mass_assignment'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'business_logic'; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE waf_attack_class ADD VALUE IF NOT EXISTS 'deserialization'; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── 15. Table : Honey-Records (pièges dans la base de données) ─
-- Des enregistrements "empoisonnés" insérés dans les tables réelles.
-- Toute lecture déclenche une alerte + destruction de session.
CREATE TABLE IF NOT EXISTS public.waf_honey_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name       TEXT NOT NULL,              -- ex: 'client_profiles', 'documents'
    record_id        UUID NOT NULL,              -- ID réel de l'enregistrement piège
    canary_token     TEXT NOT NULL UNIQUE,        -- token unique traçable
    trap_type        TEXT NOT NULL DEFAULT 'fake_user',
    -- Types : email_canary, fake_user, fake_document, fake_api_key, fake_payment
    description      TEXT DEFAULT '',
    access_count     INTEGER DEFAULT 0,
    last_accessed_by TEXT DEFAULT '',              -- IP du dernier accès
    last_accessed_at TIMESTAMPTZ,
    alerted          BOOLEAN DEFAULT false,
    auto_destroy     BOOLEAN DEFAULT true,        -- détruire la session automatiquement
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT hr_trap_type CHECK (trap_type IN (
        'email_canary','fake_user','fake_document','fake_api_key','fake_payment','fake_admin'
    ))
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_honey_records
    ADD COLUMN IF NOT EXISTS table_name       TEXT,
    ADD COLUMN IF NOT EXISTS record_id        UUID,
    ADD COLUMN IF NOT EXISTS canary_token     TEXT,
    ADD COLUMN IF NOT EXISTS trap_type        TEXT NOT NULL DEFAULT 'fake_user',
    ADD COLUMN IF NOT EXISTS description      TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS access_count     INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_accessed_by TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS alerted          BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS auto_destroy     BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waf_honey_table
    ON public.waf_honey_records(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_waf_honey_token
    ON public.waf_honey_records(canary_token);
CREATE INDEX IF NOT EXISTS idx_waf_honey_accessed
    ON public.waf_honey_records(access_count DESC) WHERE access_count > 0;

-- ── 16. Table : Canary Tokens (traque des fuites de données) ──
-- Tokens uniques injectés dans les payloads de déception.
-- Si un attaquant RÉUTILISE une info du faux payload, le token le trahit.
CREATE TABLE IF NOT EXISTS public.waf_canary_tokens (
    token            TEXT PRIMARY KEY,             -- token unique (ex: UUID ou string aléatoire)
    token_type       TEXT NOT NULL DEFAULT 'data_leak',
    -- Types : data_leak, api_key, email, url, credential, dns
    embedded_in      TEXT DEFAULT '',              -- quel payload de déception l'utilise
    source_payload   UUID,                         -- FK vers waf_deception_payloads
    triggered_count  INTEGER DEFAULT 0,
    first_triggered  TIMESTAMPTZ,
    last_triggered   TIMESTAMPTZ,
    source_ip        TEXT DEFAULT '',
    source_context   JSONB DEFAULT '{}',           -- headers, path, etc. du déclencheur
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT ct_type CHECK (token_type IN (
        'data_leak','api_key','email','url','credential','dns','hostname','db_name'
    ))
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_canary_tokens
    ADD COLUMN IF NOT EXISTS token_type      TEXT NOT NULL DEFAULT 'data_leak',
    ADD COLUMN IF NOT EXISTS embedded_in     TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_payload  UUID,
    ADD COLUMN IF NOT EXISTS triggered_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_triggered TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_triggered  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source_ip       TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_context  JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_active       BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waf_canary_active
    ON public.waf_canary_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_waf_canary_triggered
    ON public.waf_canary_tokens(triggered_count DESC) WHERE triggered_count > 0;
CREATE INDEX IF NOT EXISTS idx_waf_canary_type
    ON public.waf_canary_tokens(token_type);

-- ── 17. Table : IDOR Tracking (suivi des accès par pattern) ───
-- Détecte les tentatives d'énumération séquentielle d'endpoints
CREATE TABLE IF NOT EXISTS public.waf_idor_tracking (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip               TEXT NOT NULL,
    fingerprint_hash TEXT DEFAULT '',
    endpoint_pattern TEXT NOT NULL,                 -- ex: '/api/client/dossier/*'
    distinct_ids     INTEGER DEFAULT 1,            -- nb d'IDs distincts accédés
    accessed_ids     TEXT[] DEFAULT '{}',           -- IDs tentés (max 50 conservés)
    time_window_start TIMESTAMPTZ DEFAULT now(),
    time_window_end  TIMESTAMPTZ DEFAULT now(),
    is_suspicious    BOOLEAN DEFAULT false,
    escalated        BOOLEAN DEFAULT false,         -- alerte envoyée
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Auto-réparation schéma (table possiblement créée par un run antérieur)
ALTER TABLE public.waf_idor_tracking
    ADD COLUMN IF NOT EXISTS fingerprint_hash  TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS endpoint_pattern  TEXT,
    ADD COLUMN IF NOT EXISTS distinct_ids      INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS accessed_ids      TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS time_window_start TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS time_window_end   TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS is_suspicious     BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS escalated         BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_waf_idor_ip
    ON public.waf_idor_tracking(ip, endpoint_pattern, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_idor_suspicious
    ON public.waf_idor_tracking(is_suspicious) WHERE is_suspicious = true;

-- ── 18. RLS pour les nouvelles tables ─────────────────────────
ALTER TABLE public.waf_honey_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_canary_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waf_idor_tracking   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'waf_honey_records','waf_canary_tokens','waf_idor_tracking'
    ] LOOP
        BEGIN
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO authenticated
                USING (EXISTS (SELECT 1 FROM public.user_profiles
                       WHERE id = auth.uid()
                       AND role IN ('admin','super_admin','superadmin','ceo')));
            $f$, 'admin_'||t, t);
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO service_role USING (true);
            $f$, 'service_'||t, t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;

-- ── 19. Vérification ──────────────────────────────────────────
SELECT 'waf_device_fingerprints' AS t, count(*) FROM public.waf_device_fingerprints
UNION ALL SELECT 'waf_tarpit_config',         count(*) FROM public.waf_tarpit_config
UNION ALL SELECT 'waf_deception_payloads',    count(*) FROM public.waf_deception_payloads
UNION ALL SELECT 'waf_honeypot_interactions', count(*) FROM public.waf_honeypot_interactions
UNION ALL SELECT 'waf_attack_campaigns',      count(*) FROM public.waf_attack_campaigns
UNION ALL SELECT 'waf_honey_records',         count(*) FROM public.waf_honey_records
UNION ALL SELECT 'waf_canary_tokens',         count(*) FROM public.waf_canary_tokens
UNION ALL SELECT 'waf_idor_tracking',         count(*) FROM public.waf_idor_tracking;

SELECT 'Migration 20260602_waf_ultimate_v2 + immune_system : OK' AS status;