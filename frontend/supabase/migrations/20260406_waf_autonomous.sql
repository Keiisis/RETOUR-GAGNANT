-- ══════════════════════════════════════════════════════════════
-- MIGRATION : WAF Autonome — Fonctions RPC + Contre-attaque
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Colonne is_blocked dans waf_logs (si manquante) ───────
ALTER TABLE public.waf_logs
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT true;

-- ── 2. Fonction atomique : mise à jour mémoire IP ────────────
-- Upsert atomique avec incréments concurrents sécurisés.
-- Appelé par le middleware après chaque attaque détectée.
CREATE OR REPLACE FUNCTION public.update_ip_memory(
    p_ip           TEXT,
    p_is_attack    BOOLEAN,
    p_trust_delta  INTEGER,
    p_attack_type  TEXT    DEFAULT NULL,
    p_payload_hash TEXT    DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.waf_ip_memory (
        ip, first_seen, last_seen, total_requests, blocked_count,
        trust_score, attack_types, payload_hashes
    ) VALUES (
        p_ip, now(), now(), 1,
        CASE WHEN p_is_attack THEN 1 ELSE 0 END,
        GREATEST(0, LEAST(100, 50 + p_trust_delta)),
        CASE WHEN p_attack_type IS NOT NULL THEN ARRAY[p_attack_type] ELSE '{}' END,
        CASE WHEN p_payload_hash IS NOT NULL THEN ARRAY[p_payload_hash] ELSE '{}' END
    )
    ON CONFLICT (ip) DO UPDATE SET
        last_seen      = now(),
        total_requests = waf_ip_memory.total_requests + 1,
        blocked_count  = waf_ip_memory.blocked_count
                         + CASE WHEN p_is_attack THEN 1 ELSE 0 END,
        trust_score    = GREATEST(0, LEAST(100,
                             waf_ip_memory.trust_score + p_trust_delta)),
        attack_types   = CASE
            WHEN p_attack_type IS NOT NULL
             AND NOT (p_attack_type = ANY(waf_ip_memory.attack_types))
            THEN array_append(waf_ip_memory.attack_types, p_attack_type)
            ELSE waf_ip_memory.attack_types
        END,
        payload_hashes = CASE
            WHEN p_payload_hash IS NOT NULL
             AND NOT (p_payload_hash = ANY(waf_ip_memory.payload_hashes))
             AND array_length(waf_ip_memory.payload_hashes, 1) < 100
            THEN array_append(waf_ip_memory.payload_hashes, p_payload_hash)
            ELSE waf_ip_memory.payload_hashes
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ip_memory TO service_role;

-- ── 3. Fonction : IPs dangereuses (trust < seuil) ────────────
-- Retourne les IPs à bloquer automatiquement.
CREATE OR REPLACE FUNCTION public.get_dangerous_ips(
    p_trust_threshold INTEGER DEFAULT 15,
    p_min_attacks     INTEGER DEFAULT 3
) RETURNS TABLE(ip TEXT, trust_score INTEGER, blocked_count INTEGER, attack_types TEXT[])
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT ip, trust_score, blocked_count, attack_types
    FROM public.waf_ip_memory
    WHERE trust_score < p_trust_threshold
      AND blocked_count >= p_min_attacks
    ORDER BY trust_score ASC, blocked_count DESC
    LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_dangerous_ips TO service_role, authenticated;

-- ── 4. Fonction : Statistiques WAF temps réel ────────────────
CREATE OR REPLACE FUNCTION public.get_waf_stats(p_hours INTEGER DEFAULT 24)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_since TIMESTAMPTZ := now() - (p_hours || ' hours')::interval;
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_events',     COUNT(*),
        'blocked_count',    COUNT(*) FILTER (WHERE is_blocked = true),
        'unique_ips',       COUNT(DISTINCT ip),
        'top_threats',      (
            SELECT json_agg(t) FROM (
                SELECT threat_type, COUNT(*) as count
                FROM public.waf_logs
                WHERE created_at >= v_since
                GROUP BY threat_type
                ORDER BY count DESC
                LIMIT 5
            ) t
        ),
        'top_attackers',    (
            SELECT json_agg(a) FROM (
                SELECT ip, COUNT(*) as count
                FROM public.waf_logs
                WHERE created_at >= v_since AND is_blocked = true
                GROUP BY ip
                ORDER BY count DESC
                LIMIT 10
            ) a
        ),
        'dangerous_ips',    (SELECT COUNT(*) FROM public.waf_ip_memory WHERE trust_score < 15),
        'active_campaigns', (SELECT COUNT(*) FROM public.waf_campaigns WHERE status = 'active'),
        'learned_rules',    (SELECT COUNT(*) FROM public.waf_learned_rules WHERE auto_active = true),
        'ip_blocks_active', (SELECT COUNT(*) FROM public.ip_blocks WHERE unblocked_at IS NULL)
    ) INTO v_result
    FROM public.waf_logs
    WHERE created_at >= v_since;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_waf_stats TO service_role, authenticated;

-- ── 5. Auto-blocage des IPs dangereuses ──────────────────────
-- À appeler périodiquement (cron ou edge function)
CREATE OR REPLACE FUNCTION public.auto_block_dangerous_ips()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
    v_ip    RECORD;
BEGIN
    FOR v_ip IN
        SELECT ip, trust_score, blocked_count
        FROM public.waf_ip_memory
        WHERE trust_score < 10
          AND blocked_count >= 5
    LOOP
        INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
        VALUES (
            v_ip.ip,
            format('Auto-blocage : trust_score=%s, attaques=%s', v_ip.trust_score, v_ip.blocked_count),
            'autonomous_waf',
            v_ip.blocked_count
        )
        ON CONFLICT (ip) DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_block_dangerous_ips TO service_role;

-- ── 6. Nettoyage automatique (données âgées de +30 jours) ────
CREATE OR REPLACE FUNCTION public.waf_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Supprimer les logs WAF de plus de 30 jours
    DELETE FROM public.waf_logs WHERE created_at < now() - interval '30 days';
    -- Alertes résolues de plus de 7 jours
    DELETE FROM public.waf_alerts WHERE resolved = true AND created_at < now() - interval '7 days';
    -- Campagnes résolues de plus de 14 jours
    DELETE FROM public.waf_campaigns WHERE status = 'resolved' AND last_seen < now() - interval '14 days';
    -- IPs sans activité depuis 90 jours et trust > 60 (légitimes)
    DELETE FROM public.waf_ip_memory WHERE last_seen < now() - interval '90 days' AND trust_score > 60;
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_cleanup TO service_role;

-- ── 7. Index performance waf_ip_memory ───────────────────────
CREATE INDEX IF NOT EXISTS idx_waf_ip_memory_score_attacks
    ON public.waf_ip_memory(trust_score, blocked_count)
    WHERE trust_score < 30;

CREATE INDEX IF NOT EXISTS idx_waf_logs_blocked_date
    ON public.waf_logs(is_blocked, created_at DESC)
    WHERE is_blocked = true;

-- ── 8. RLS : accès service_role uniquement aux fonctions RPC ─
-- Les fonctions sont SECURITY DEFINER donc exécutées avec les droits owner.
-- Seul service_role peut appeler update_ip_memory, auto_block_dangerous_ips.

-- ── 9. Vérification ──────────────────────────────────────────
SELECT
    'update_ip_memory' AS function_name,
    'OK' AS status
WHERE EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_ip_memory'
)
UNION ALL SELECT
    'get_waf_stats', 'OK'
WHERE EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_waf_stats'
);

SELECT
    'waf_ip_memory'   AS table_name, count(*) AS rows FROM public.waf_ip_memory
UNION ALL SELECT
    'waf_learned_rules', count(*) FROM public.waf_learned_rules
UNION ALL SELECT
    'waf_campaigns', count(*) FROM public.waf_campaigns
UNION ALL SELECT
    'waf_alerts', count(*) FROM public.waf_alerts;
