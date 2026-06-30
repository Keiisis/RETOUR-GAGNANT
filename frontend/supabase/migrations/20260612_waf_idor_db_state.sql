-- ══════════════════════════════════════════════════════════════
-- MIGRATION : WAF — état IDOR persistant cross-instance
-- ══════════════════════════════════════════════════════════════
-- Problème corrigé : le tracking IDOR vivait uniquement en mémoire
-- (Map JS). En serverless (Vercel), chaque cold start / instance a sa
-- propre mémoire → l'état se réinitialise, un attaquant réparti sur
-- plusieurs instances échappe à la détection.
--
-- Solution : une RPC qui UPSERT l'état dans waf_idor_tracking (déjà
-- créée en 20260601) avec fenêtre glissante, agrège les IDs distincts
-- TOUS instances confondues, et renvoie le verdict.
-- Idempotente.
-- ══════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────
-- 0. Filet de sécurité : table créée si la migration 20260601 n'a pas
--    encore été appliquée. Rend ce script autonome (ordre indépendant).
--    Définition identique à 20260601_waf_ultimate_defense.sql.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waf_idor_tracking (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip               TEXT NOT NULL,
    fingerprint_hash TEXT DEFAULT '',
    endpoint_pattern TEXT NOT NULL,
    distinct_ids     INTEGER DEFAULT 1,
    accessed_ids     TEXT[] DEFAULT '{}',
    time_window_start TIMESTAMPTZ DEFAULT now(),
    time_window_end  TIMESTAMPTZ DEFAULT now(),
    is_suspicious    BOOLEAN DEFAULT false,
    escalated        BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_waf_idor_ip
    ON public.waf_idor_tracking(ip, endpoint_pattern, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waf_idor_suspicious
    ON public.waf_idor_tracking(is_suspicious) WHERE is_suspicious = true;

-- Fenêtre de corrélation (minutes) et seuils — alignés avec lib/waf/idor.ts
-- IDOR_WINDOW_MS = 5 min · IDOR_MAX_IDS = 8 · IDOR_RAPID_THRESHOLD = 15

CREATE OR REPLACE FUNCTION public.waf_track_idor(
    p_ip               TEXT,
    p_fingerprint      TEXT,
    p_endpoint_pattern TEXT,
    p_ids              TEXT[]
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_min   INT := 5;
    v_max_ids      INT := 8;
    v_rapid        INT := 15;
    v_track_key    TEXT := COALESCE(NULLIF(p_fingerprint, ''), p_ip);
    v_row          public.waf_idor_tracking%ROWTYPE;
    v_merged_ids   TEXT[];
    v_distinct     INT;
    v_suspicious   BOOLEAN := FALSE;
    v_now          TIMESTAMPTZ := now();
BEGIN
    -- Chercher une fenêtre active pour cette clé + endpoint
    SELECT * INTO v_row
    FROM public.waf_idor_tracking
    WHERE ip = v_track_key
      AND endpoint_pattern = p_endpoint_pattern
      AND time_window_start > (v_now - make_interval(mins => v_window_min))
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_row.id IS NULL THEN
        -- Nouvelle fenêtre
        v_merged_ids := (SELECT ARRAY(SELECT DISTINCT unnest(p_ids) LIMIT 50));
        v_distinct := COALESCE(array_length(v_merged_ids, 1), 0);
        v_suspicious := v_distinct >= v_max_ids;

        INSERT INTO public.waf_idor_tracking
            (ip, fingerprint_hash, endpoint_pattern, distinct_ids, accessed_ids,
             time_window_start, time_window_end, is_suspicious)
        VALUES
            (v_track_key, p_fingerprint, p_endpoint_pattern, v_distinct, v_merged_ids,
             v_now, v_now, v_suspicious);
    ELSE
        -- Fusionner les IDs (cap 50) — agrégation cross-instance
        v_merged_ids := (
            SELECT ARRAY(SELECT DISTINCT unnest(v_row.accessed_ids || p_ids) LIMIT 50)
        );
        v_distinct := COALESCE(array_length(v_merged_ids, 1), 0);
        v_suspicious := v_distinct >= v_max_ids;

        UPDATE public.waf_idor_tracking
        SET accessed_ids   = v_merged_ids,
            distinct_ids   = v_distinct,
            time_window_end = v_now,
            is_suspicious  = v_suspicious
        WHERE id = v_row.id;
    END IF;

    RETURN jsonb_build_object(
        'distinct_ids', v_distinct,
        'is_suspicious', v_suspicious,
        'rapid', v_distinct >= v_rapid
    );
END;
$$;

-- Nettoyage des fenêtres expirées (> 1h) — à appeler depuis waf_daily_maintenance
CREATE OR REPLACE FUNCTION public.waf_cleanup_idor() RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted INT;
BEGIN
    DELETE FROM public.waf_idor_tracking
    WHERE time_window_end < (now() - interval '1 hour')
      AND is_suspicious = FALSE;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;
