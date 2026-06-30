-- ═══════════════════════════════════════════════════════════════
-- WAF — Maintenance quotidienne COMPLÈTE (decay + cleanup IDOR + refresh vue)
-- ═══════════════════════════════════════════════════════════════
-- Problème corrigé : waf_daily_maintenance() faisait déjà le decay des
-- threat scores, le nettoyage des logs/alertes/campagnes/fingerprints, la
-- réhabilitation et l'auto-unblock — MAIS :
--   • n'appelait PAS waf_cleanup_idor() (fenêtres IDOR expirées jamais purgées)
--   • ne RAFRAÎCHISSAIT PAS la vue matérialisée waf_threat_dashboard
--     (le dashboard menaces affichait des données figées).
-- Et surtout : AUCUN cron ne l'invoquait (cf. /api/cron/waf-maintenance).
--
-- Dépend de : 20260601 (waf_threat_dashboard, waf_decay_threat_scores),
--             20260612 (waf_cleanup_idor).
-- Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.waf_daily_maintenance()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cleaned_logs      INTEGER := 0;
    v_cleaned_alerts    INTEGER := 0;
    v_cleaned_campaigns INTEGER := 0;
    v_cleaned_fps       INTEGER := 0;
    v_rehabilitated_ips INTEGER := 0;
    v_cleaned_hp        INTEGER := 0;
    v_decayed_scores    INTEGER := 0;
    v_unblocked_ips     INTEGER := 0;
    v_cleaned_idor      INTEGER := 0;
    v_dashboard_refreshed BOOLEAN := false;
BEGIN
    v_decayed_scores := public.waf_decay_threat_scores(24);

    DELETE FROM public.waf_logs WHERE created_at < now() - interval '30 days';
    GET DIAGNOSTICS v_cleaned_logs = ROW_COUNT;

    DELETE FROM public.waf_alerts WHERE resolved = true AND created_at < now() - interval '7 days';
    GET DIAGNOSTICS v_cleaned_alerts = ROW_COUNT;

    DELETE FROM public.waf_attack_campaigns WHERE is_active = false AND last_seen < now() - interval '14 days';
    GET DIAGNOSTICS v_cleaned_campaigns = ROW_COUNT;

    DELETE FROM public.waf_device_fingerprints
    WHERE last_seen < now() - interval '90 days' AND trust_score > 60 AND is_known_bad = false;
    GET DIAGNOSTICS v_cleaned_fps = ROW_COUNT;

    DELETE FROM public.waf_honeypot_interactions
    WHERE created_at < now() - interval '60 days';
    GET DIAGNOSTICS v_cleaned_hp = ROW_COUNT;

    -- NOUVEAU : purge des fenêtres de corrélation IDOR expirées (> 1h, non suspectes)
    BEGIN
        v_cleaned_idor := public.waf_cleanup_idor();
    EXCEPTION WHEN undefined_function THEN
        v_cleaned_idor := -1;  -- migration 20260612 pas encore appliquée
    END;

    -- Réhabilitation graduée : plus l'IP est inactive, plus elle remonte
    UPDATE public.waf_ip_memory
    SET trust_score = LEAST(100, trust_score +
        CASE
            WHEN last_seen < now() - interval '90 days' THEN 15
            WHEN last_seen < now() - interval '60 days' THEN 10
            ELSE 5
        END)
    WHERE last_seen < now() - interval '30 days'
      AND trust_score < 50
      AND trust_score > 10
      AND ip_hopper = false;       -- on ne réhabilite pas les IP-hoppers
    GET DIAGNOSTICS v_rehabilitated_ips = ROW_COUNT;

    UPDATE public.ip_blocks
    SET unblocked_at = now()
    WHERE unblocked_at IS NULL
      AND blocked_by IN ('auto', 'autonomous_waf')
      AND blocked_at < now() - interval '7 days'
      AND EXISTS (
        SELECT 1 FROM public.waf_ip_memory
        WHERE waf_ip_memory.ip = ip_blocks.ip
          AND waf_ip_memory.trust_score > 20
          AND waf_ip_memory.ip_hopper = false
      );
    GET DIAGNOSTICS v_unblocked_ips = ROW_COUNT;

    -- NOUVEAU : rafraîchit la vue matérialisée du dashboard menaces.
    -- Non-CONCURRENTLY (autorisé dans une fonction ; verrou bref sur une petite vue).
    BEGIN
        REFRESH MATERIALIZED VIEW public.waf_threat_dashboard;
        v_dashboard_refreshed := true;
    EXCEPTION WHEN OTHERS THEN
        v_dashboard_refreshed := false;  -- vue absente ou jamais peuplée
    END;

    RETURN json_build_object(
        'cleaned_logs',      v_cleaned_logs,
        'cleaned_alerts',    v_cleaned_alerts,
        'cleaned_campaigns', v_cleaned_campaigns,
        'cleaned_fingerprints', v_cleaned_fps,
        'cleaned_honeypot_interactions', v_cleaned_hp,
        'cleaned_idor_windows', v_cleaned_idor,
        'rehabilitated_ips', v_rehabilitated_ips,
        'auto_unblocked_ips', v_unblocked_ips,
        'decayed_threat_scores_ips', v_decayed_scores,
        'dashboard_refreshed', v_dashboard_refreshed,
        'executed_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_daily_maintenance TO service_role;
