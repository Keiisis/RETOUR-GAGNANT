-- ══════════════════════════════════════════════════════════════
-- MIGRATION : WAF Offense Active v3 — Fonctions RPC & Maintenance
-- Intelligence défensive adaptative, scoring multi-facteurs,
-- corrélation comportementale & déception contextuelle
-- Dépendances : 20260601_waf_ultimate_defense (WAF ULTIMATE v2)
-- ══════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════
-- 0. FONCTION UTILITAIRE : Scoring de risque multi-facteurs
-- Centralise le calcul du risque pour cohérence entre toutes les RPC
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_compute_risk_score(
    p_ip_trust       INTEGER,
    p_fp_trust       INTEGER,
    p_threat_score   NUMERIC,
    p_is_tor         BOOLEAN,
    p_is_vpn         BOOLEAN,
    p_is_datacenter  BOOLEAN,
    p_ip_hopper      BOOLEAN,
    p_fp_known_bad   BOOLEAN,
    p_path_risk      NUMERIC DEFAULT 0,
    p_velocity       NUMERIC DEFAULT 0   -- requêtes/min récentes
) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v_risk NUMERIC := 0;
BEGIN
    -- Base : inverse du trust effectif (0-100)
    v_risk := (100 - LEAST(p_ip_trust, p_fp_trust)) * 0.45;

    -- Threat intel accumulée (pondération forte)
    v_risk := v_risk + p_threat_score * 0.35;

    -- Signaux réseau (additifs, plafonnés)
    v_risk := v_risk + CASE WHEN p_is_tor        THEN 12 ELSE 0 END;
    v_risk := v_risk + CASE WHEN p_is_vpn        THEN 6  ELSE 0 END;
    v_risk := v_risk + CASE WHEN p_is_datacenter THEN 8  ELSE 0 END;

    -- Signaux comportementaux (poids majeur)
    v_risk := v_risk + CASE WHEN p_ip_hopper     THEN 18 ELSE 0 END;
    v_risk := v_risk + CASE WHEN p_fp_known_bad  THEN 40 ELSE 0 END;

    -- Risque lié au chemin & à la vélocité (rafale = brute force)
    v_risk := v_risk + p_path_risk;
    v_risk := v_risk + LEAST(p_velocity * 1.5, 25);

    RETURN GREATEST(0, LEAST(v_risk, 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_compute_risk_score TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 1. Fonction : Évaluation de requête (cerveau décisionnel v3)
-- allow | tarpit | deceive | block | honeypot
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_evaluate_request(
    p_ip               TEXT,
    p_path             TEXT DEFAULT '/',
    p_fingerprint_hash TEXT DEFAULT '',
    p_user_agent       TEXT DEFAULT '',
    p_method           TEXT DEFAULT 'GET'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ip_trust        INTEGER := 50;
    v_fp_trust        INTEGER := 50;
    v_effective_trust INTEGER;
    v_threat_score    NUMERIC := 0;
    v_risk_score      NUMERIC := 0;
    v_path_risk       NUMERIC := 0;
    v_velocity        NUMERIC := 0;
    v_is_tor          BOOLEAN := false;
    v_is_vpn          BOOLEAN := false;
    v_is_datacenter   BOOLEAN := false;
    v_campaign_id     UUID := null;
    v_fp_campaign_id  UUID := null;

    v_decide_action   public.waf_action;
    v_action          TEXT := 'allow';
    v_delay_ms        INTEGER := 0;
    v_jitter          INTEGER := 0;
    v_payload         JSON := null;
    v_is_whitelisted  BOOLEAN := false;
    v_fp_known_bad    BOOLEAN := false;
    v_ip_hopper       BOOLEAN := false;
    v_active_campaign_id UUID := null;
    v_attack_class    public.waf_attack_class := 'scanner_detection';
    v_recent_reqs     INTEGER := 0;
BEGIN
    -- ── 0. Validation d'entrée ────────────────────────────────
    IF p_ip IS NULL OR p_ip = '' THEN
        RETURN json_build_object('action','allow','delay_ms',0,'reason','IP manquante');
    END IF;

    -- ── 1. Whitelist (court-circuit prioritaire) ──────────────
    SELECT EXISTS (
        SELECT 1 FROM public.waf_config
        WHERE key = 'whitelisted_ips' AND value::jsonb ? p_ip
    ) INTO v_is_whitelisted;

    IF v_is_whitelisted THEN
        RETURN json_build_object(
            'action','allow','delay_ms',0,
            'reason','IP whitelistée','trust_score',100
        );
    END IF;

    -- ── 2. Threat intel IP ────────────────────────────────────
    SELECT trust_score, ip_hopper, threat_score, is_tor, is_vpn, is_datacenter, campaign_id
    INTO v_ip_trust, v_ip_hopper, v_threat_score, v_is_tor, v_is_vpn, v_is_datacenter, v_campaign_id
    FROM public.waf_ip_memory
    WHERE ip = p_ip;

    IF NOT FOUND THEN
        v_ip_trust := 50; v_ip_hopper := false; v_threat_score := 0;
        v_is_tor := false; v_is_vpn := false; v_is_datacenter := false;
        v_campaign_id := null;
    END IF;

    -- ── 3. Vélocité : détection de rafale (brute force / scan) ─
    -- Compte les requêtes des 60 dernières secondes pour cette IP
    SELECT COUNT(*) INTO v_recent_reqs
    FROM public.waf_logs
    WHERE ip = p_ip AND created_at >= now() - interval '60 seconds';
    v_velocity := v_recent_reqs;  -- req/min

    -- ── 4. Threat intel fingerprint ───────────────────────────
    IF p_fingerprint_hash IS NOT NULL AND p_fingerprint_hash <> '' THEN
        SELECT trust_score, is_known_bad, campaign_id
        INTO v_fp_trust, v_fp_known_bad, v_fp_campaign_id
        FROM public.waf_device_fingerprints
        WHERE hash = p_fingerprint_hash;

        IF NOT FOUND THEN
            v_fp_trust := 50; v_fp_known_bad := false; v_fp_campaign_id := null;
        END IF;

        -- Fingerprint malveillant connu → blocage immédiat (anti IP-hopper)
        IF v_fp_known_bad THEN
            UPDATE public.waf_ip_memory
            SET ip_hopper    = true,
                trust_score  = LEAST(trust_score, 5),
                threat_score = GREATEST(threat_score, 90),
                last_action  = 'block',
                last_seen    = now()
            WHERE ip = p_ip;

            RETURN json_build_object(
                'action','block','delay_ms',0,
                'reason','Device fingerprint connu comme dangereux (IP-hopper détecté)',
                'trust_score', v_fp_trust,
                'fingerprint_known_bad', true,
                'risk_score', 100
            );
        END IF;
    END IF;

    v_effective_trust := LEAST(v_ip_trust, v_fp_trust);

    -- ── 5. Corrélation campagne d'attaque active ──────────────
    IF p_fingerprint_hash <> '' THEN
        SELECT c.id INTO v_active_campaign_id
        FROM public.waf_attack_campaigns c
        WHERE c.is_active = true
          AND (
            c.id = v_campaign_id OR c.id = v_fp_campaign_id OR
            EXISTS (
                SELECT 1 FROM public.waf_device_fingerprints fp
                WHERE fp.hash = p_fingerprint_hash
                  AND EXISTS (
                    SELECT 1 FROM public.waf_ip_memory m
                    WHERE m.campaign_id = c.id AND m.ip = ANY(fp.associated_ips)
                  )
            )
          )
        LIMIT 1;

        IF v_active_campaign_id IS NOT NULL THEN
            v_threat_score := GREATEST(v_threat_score, 75);
            v_ip_hopper := true;
            UPDATE public.waf_ip_memory
            SET trust_score  = LEAST(trust_score, 12),
                threat_score = GREATEST(threat_score, 75),
                campaign_id  = v_active_campaign_id,
                ip_hopper    = true
            WHERE ip = p_ip;
        END IF;
    END IF;

    -- ── 6. Analyse de chemin : classification & scoring ───────
    -- Catégorisation fine pour adapter le payload de déception
    IF p_path ~* '\.(env|git|aws|ssh|pem|key|sql|bak|backup\.zip)($|/)'
       OR p_path ~* '/(config\.php|wp-config|database\.yml|secrets)' THEN
        v_path_risk := 35; v_attack_class := 'sensitive_file_access';
    ELSIF p_path ~* '^/(wp-admin|wp-login\.php|phpmyadmin|adminer|xmlrpc|admin\.php)' THEN
        v_path_risk := 30; v_attack_class := 'admin_probe';
    ELSIF p_path ~* '(shell|c99|r57|webshell|cmd|eval)\.php' THEN
        v_path_risk := 45; v_attack_class := 'webshell_upload';
    ELSIF p_path ~* '/(actuator|server-status|debug|\.well-known/security)' THEN
        v_path_risk := 20; v_attack_class := 'recon';
    ELSIF p_path ~* '(union.*select|<script|\.\./|%2e%2e|0x[0-9a-f]+)' THEN
        v_path_risk := 40; v_attack_class := 'injection_attempt';
    END IF;

    -- ── 7. Honeypot : chemin piège connu ──────────────────────
    IF v_path_risk >= 30 AND p_path ~ '^\/(wp-admin|wp-login\.php|phpmyadmin|\.env|\.git|adminer|xmlrpc|actuator|server-status|admin\.php|shell\.php|c99\.php|r57\.php|backup\.zip|config\.php|debug)' THEN
        v_action := 'honeypot';

        -- Payload contextualisé selon la classe d'attaque détectée
        SELECT json_build_object(
            'status_code', dp.status_code,
            'content_type', dp.content_type,
            'response_body', dp.response_body,
            'response_headers', dp.response_headers
        ) INTO v_payload
        FROM public.waf_deception_payloads dp
        WHERE dp.enabled = true
          AND dp.attack_type IN (v_attack_class, 'honeypot')
        ORDER BY (dp.attack_type = v_attack_class) DESC, random() * dp.rotation_weight DESC
        LIMIT 1;

        UPDATE public.waf_ip_memory
        SET trust_score  = GREATEST(0, trust_score - 25),
            threat_score = GREATEST(threat_score, 80),
            last_action  = 'honeypot',
            last_seen    = now()
        WHERE ip = p_ip;

        INSERT INTO public.waf_honeypot_interactions (
            ip, path, method, user_agent, fingerprint_hash,
            attack_class, payload_used, campaign_id
        ) VALUES (
            p_ip, p_path, p_method, p_user_agent, p_fingerprint_hash,
            v_attack_class, COALESCE(v_payload::text, '{}'), v_campaign_id
        );

        RETURN json_build_object(
            'action','honeypot','delay_ms',0,
            'trust_score', v_effective_trust,
            'ip_trust', v_ip_trust, 'fp_trust', v_fp_trust,
            'reason', format('Honeypot path [%s]: %s', v_attack_class, p_path),
            'payload', v_payload,
            'ip_hopper', v_ip_hopper,
            'attack_class', v_attack_class,
            'risk_score', 90
        );
    END IF;

    -- ── 8. Score de risque agrégé multi-facteurs ──────────────
    v_risk_score := public.waf_compute_risk_score(
        v_ip_trust, v_fp_trust, v_threat_score,
        v_is_tor, v_is_vpn, v_is_datacenter,
        v_ip_hopper, v_fp_known_bad, v_path_risk, v_velocity
    );

    -- ── 9. Escalade vélocité : rafale extrême → tarpit forcé ──
    -- Si l'IP martèle (>40 req/min) sans être déjà bloquée
    IF v_velocity > 40 AND v_effective_trust > 25 THEN
        v_threat_score := GREATEST(v_threat_score, 60);
        UPDATE public.waf_ip_memory
        SET threat_score = GREATEST(threat_score, 60),
            trust_score  = GREATEST(0, trust_score - 5)
        WHERE ip = p_ip;
    END IF;

    -- ── 10. Décision adaptative ───────────────────────────────
    v_decide_action := public.waf_decide_action(
        v_effective_trust, v_threat_score, v_ip_hopper, v_is_tor, v_fp_known_bad
    );
    v_action := v_decide_action::TEXT;

    -- Override par score de risque agrégé : si risque critique, durcir
    IF v_risk_score >= 85 AND v_action NOT IN ('ban','block') THEN
        v_action := 'deceive';  -- déception plutôt qu'allow sur risque élevé
    END IF;

    -- ── 11. Exécution de l'action décidée ─────────────────────
    IF v_action = 'ban' OR v_action = 'block' THEN
        v_action := 'block';

    ELSIF v_action = 'deceive' OR v_action = 'shadowban' THEN
        v_action := 'deceive';
        SELECT json_build_object(
            'status_code', dp.status_code,
            'content_type', dp.content_type,
            'response_body', dp.response_body,
            'response_headers', dp.response_headers
        ) INTO v_payload
        FROM public.waf_deception_payloads dp
        WHERE dp.enabled = true
          AND dp.attack_type IN (v_attack_class, 'scanner_detection')
        ORDER BY (dp.attack_type = v_attack_class) DESC, random() * dp.rotation_weight DESC
        LIMIT 1;

        UPDATE public.waf_ip_memory
        SET deception_count = deception_count + 1
        WHERE ip = p_ip;

    ELSIF v_action = 'tarpit' OR v_action = 'challenge' THEN
        v_action := 'tarpit';
        SELECT tc.delay_ms, tc.jitter_ms
        INTO v_delay_ms, v_jitter
        FROM public.waf_tarpit_config tc
        WHERE tc.enabled = true
          AND v_effective_trust >= tc.trust_min
          AND v_effective_trust <  tc.trust_max
        LIMIT 1;

        IF NOT FOUND THEN
            v_delay_ms := (30 - v_effective_trust) * 200;
            v_jitter := 500;
        END IF;

        -- Délai progressif amplifié par le risque agrégé
        v_delay_ms := v_delay_ms + ((v_risk_score / 100.0) * 1500)::integer;
        v_delay_ms := v_delay_ms + floor(random() * v_jitter * 2 - v_jitter)::integer;
        v_delay_ms := GREATEST(0, LEAST(v_delay_ms, 8000));

        UPDATE public.waf_ip_memory
        SET tarpit_level = GREATEST(tarpit_level, (30 - v_effective_trust) / 5),
            trust_score  = GREATEST(0, trust_score - 3)
        WHERE ip = p_ip;

    ELSE
        v_action := 'allow';
    END IF;

    -- ── 12. Persistance de la dernière action ─────────────────
    UPDATE public.waf_ip_memory
    SET last_action = v_action, last_seen = now()
    WHERE ip = p_ip;

    -- ── 13. Décision finale enrichie ──────────────────────────
    RETURN json_build_object(
        'action',      v_action,
        'delay_ms',    v_delay_ms,
        'trust_score', v_effective_trust,
        'ip_trust',    v_ip_trust,
        'fp_trust',    v_fp_trust,
        'risk_score',  round(v_risk_score, 1),
        'velocity_rpm',v_velocity,
        'attack_class',v_attack_class,
        'reason', CASE v_action
            WHEN 'block'   THEN format('Action: %s | risque=%s (menace élevée)', v_decide_action::text, round(v_risk_score,1))
            WHEN 'deceive' THEN format('Action: %s | risque=%s (cyber-déception)', v_decide_action::text, round(v_risk_score,1))
            WHEN 'tarpit'  THEN format('Action: %s | risque=%s (%sms delay)', v_decide_action::text, round(v_risk_score,1), v_delay_ms)
            ELSE 'Requête autorisée'
        END,
        'payload',   v_payload,
        'ip_hopper', v_ip_hopper
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_evaluate_request TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 2. Fonction : Enregistrer un fingerprint (escalade graduée)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_register_fingerprint(
    p_ip          TEXT,
    p_hash        TEXT,
    p_components  JSONB DEFAULT '{}'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_ips  TEXT[];
    v_ip_count      INTEGER;
    v_is_hopper     BOOLEAN := false;
    v_threat_bump   INTEGER := 0;
    v_alert_level   TEXT := 'warning';
BEGIN
    INSERT INTO public.waf_device_fingerprints (
        hash, components, associated_ips, first_seen, last_seen,
        total_requests, trust_score
    ) VALUES (
        p_hash, p_components, ARRAY[p_ip], now(), now(), 1, 50
    )
    ON CONFLICT (hash) DO UPDATE SET
        last_seen      = now(),
        total_requests = waf_device_fingerprints.total_requests + 1,
        associated_ips = CASE
            WHEN NOT (p_ip = ANY(waf_device_fingerprints.associated_ips))
            THEN array_append(waf_device_fingerprints.associated_ips, p_ip)
            ELSE waf_device_fingerprints.associated_ips END,
        components = CASE
            WHEN p_components <> '{}'::jsonb THEN p_components
            ELSE waf_device_fingerprints.components END
    RETURNING associated_ips INTO v_existing_ips;

    v_ip_count := COALESCE(array_length(v_existing_ips, 1), 1);

    -- Escalade graduée de la menace selon le nombre d'IPs (rotation)
    IF v_ip_count >= 3 THEN
        v_is_hopper := true;
        v_threat_bump := CASE
            WHEN v_ip_count >= 10 THEN 80   -- rotation massive (botnet)
            WHEN v_ip_count >= 6  THEN 65
            ELSE 45 END;
        v_alert_level := CASE WHEN v_ip_count >= 10 THEN 'critical' ELSE 'warning' END;

        UPDATE public.waf_ip_memory
        SET ip_hopper    = true,
            threat_score = GREATEST(threat_score, v_threat_bump),
            trust_score  = LEAST(trust_score, GREATEST(5, 30 - v_ip_count))
        WHERE ip = ANY(v_existing_ips);

        -- Au-delà de 8 IPs, on considère le fingerprint définitivement hostile
        IF v_ip_count >= 8 THEN
            UPDATE public.waf_device_fingerprints
            SET is_known_bad = true
            WHERE hash = p_hash;
        END IF;

        -- Alerte aux paliers significatifs (3, 6, 10) pour éviter le spam
        IF v_ip_count IN (3, 6, 10) THEN
            INSERT INTO public.waf_alerts (level, message, context)
            VALUES (
                v_alert_level,
                format('IP-Hopper [%s] : fingerprint %s vu depuis %s IPs distinctes',
                       v_alert_level, p_hash, v_ip_count),
                jsonb_build_object(
                    'fingerprint', p_hash,
                    'ips', to_jsonb(v_existing_ips),
                    'ip_count', v_ip_count,
                    'threat_bump', v_threat_bump
                )
            );
        END IF;
    END IF;

    -- Association fingerprint ↔ IP
    UPDATE public.waf_ip_memory
    SET fingerprint_hashes = CASE
        WHEN NOT (p_hash = ANY(fingerprint_hashes))
             AND array_length(fingerprint_hashes, 1) IS DISTINCT FROM NULL
             AND array_length(fingerprint_hashes, 1) < 10
        THEN array_append(fingerprint_hashes, p_hash)
        WHEN NOT (p_hash = ANY(fingerprint_hashes))
             AND array_length(fingerprint_hashes, 1) IS NULL
        THEN ARRAY[p_hash]
        ELSE fingerprint_hashes END
    WHERE ip = p_ip;

    RETURN json_build_object(
        'hash', p_hash,
        'ip_count', v_ip_count,
        'is_hopper', v_is_hopper,
        'threat_bump', v_threat_bump,
        'ips', to_jsonb(v_existing_ips)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_register_fingerprint TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 3. Fonction : Récupérer un payload de déception (rotation pondérée)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_get_deception_payload(
    p_attack_type TEXT DEFAULT 'scanner_detection'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payload JSON;
    v_attack_class public.waf_attack_class;
BEGIN
    BEGIN
        v_attack_class := p_attack_type::public.waf_attack_class;
    EXCEPTION WHEN OTHERS THEN
        v_attack_class := 'scanner_detection'::public.waf_attack_class;
    END;

    SELECT json_build_object(
        'id', id, 'status_code', status_code, 'content_type', content_type,
        'response_body', response_body, 'response_headers', response_headers,
        'payload_name', payload_name
    ) INTO v_payload
    FROM public.waf_deception_payloads
    WHERE attack_type = v_attack_class AND enabled = true
    ORDER BY random() * rotation_weight DESC
    LIMIT 1;

    IF v_payload IS NULL THEN
        SELECT json_build_object(
            'id', id, 'status_code', status_code, 'content_type', content_type,
            'response_body', response_body, 'response_headers', response_headers,
            'payload_name', payload_name
        ) INTO v_payload
        FROM public.waf_deception_payloads
        WHERE enabled = true
        ORDER BY random()
        LIMIT 1;
    END IF;

    RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_get_deception_payload TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 4. Fonction : Calculer le délai tarpit
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_tarpit_delay(
    p_trust_score INTEGER
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delay INTEGER := 0;
    v_jitter INTEGER := 0;
BEGIN
    SELECT delay_ms, jitter_ms INTO v_delay, v_jitter
    FROM public.waf_tarpit_config
    WHERE enabled = true
      AND p_trust_score >= trust_min
      AND p_trust_score <  trust_max
    LIMIT 1;

    IF NOT FOUND THEN
        IF p_trust_score < 30 THEN
            v_delay := (30 - p_trust_score) * 200;
            v_jitter := 500;
        ELSE
            v_delay := 0; v_jitter := 0;
        END IF;
    END IF;

    v_delay := v_delay + floor(random() * v_jitter * 2 - v_jitter)::integer;
    v_delay := GREATEST(0, LEAST(v_delay, 8000));

    RETURN json_build_object('delay_ms', v_delay, 'trust_score', p_trust_score);
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_tarpit_delay TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 5. Fonction : Maintenance quotidienne (réhabilitation graduée)
-- ══════════════════════════════════════════════════════════════
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

    RETURN json_build_object(
        'cleaned_logs',      v_cleaned_logs,
        'cleaned_alerts',    v_cleaned_alerts,
        'cleaned_campaigns', v_cleaned_campaigns,
        'cleaned_fingerprints', v_cleaned_fps,
        'cleaned_honeypot_interactions', v_cleaned_hp,
        'rehabilitated_ips', v_rehabilitated_ips,
        'auto_unblocked_ips', v_unblocked_ips,
        'decayed_threat_scores_ips', v_decayed_scores,
        'executed_at', now()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_daily_maintenance TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 6. Fonction : Mode urgence (lockdown auto-déclenchable)
-- p_auto = true permet un déclenchement par seuil sans intervention
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_emergency_lockdown(
    p_trust_block_threshold INTEGER DEFAULT 25,
    p_reason TEXT DEFAULT 'manual'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_blocked_count INTEGER := 0;
    v_fp_marked     INTEGER := 0;
BEGIN
    UPDATE public.waf_tarpit_config SET enabled = false;
    INSERT INTO public.waf_tarpit_config (trust_min, trust_max, delay_ms, jitter_ms, description, enabled)
    VALUES (30, 50, 3000, 1000, 'LOCKDOWN: tarpit toute IP suspecte', true);

    INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
    SELECT ip, format('Emergency lockdown [%s] — trust=%s', p_reason, trust_score),
           'emergency_lockdown', blocked_count
    FROM public.waf_ip_memory
    WHERE trust_score < p_trust_block_threshold
      AND NOT EXISTS (
        SELECT 1 FROM public.ip_blocks
        WHERE ip_blocks.ip = waf_ip_memory.ip AND ip_blocks.unblocked_at IS NULL
      );
    GET DIAGNOSTICS v_blocked_count = ROW_COUNT;

    UPDATE public.waf_device_fingerprints SET is_known_bad = true WHERE trust_score < 20;
    GET DIAGNOSTICS v_fp_marked = ROW_COUNT;

    INSERT INTO public.waf_alerts (level, message, context)
    VALUES (
        'nuclear',
        format('🚨 MODE URGENCE [%s] — %s IPs bloquées, %s fingerprints marqués', p_reason, v_blocked_count, v_fp_marked),
        jsonb_build_object('blocked_count', v_blocked_count, 'fp_marked', v_fp_marked,
                           'reason', p_reason, 'threshold', p_trust_block_threshold, 'triggered_at', now())
    );

    RETURN json_build_object(
        'status', 'lockdown_active',
        'blocked_ips', v_blocked_count,
        'fingerprints_marked', v_fp_marked,
        'reason', p_reason,
        'message', format('Mode urgence activé [%s] — %s IPs bloquées', p_reason, v_blocked_count)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_emergency_lockdown TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 6b. Auto-déclenchement du lockdown par seuil (cron/edge)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_check_auto_lockdown(
    p_attack_threshold INTEGER DEFAULT 100   -- blocages/5min
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recent_blocks INTEGER;
    v_active_campaigns INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_recent_blocks
    FROM public.waf_logs
    WHERE is_blocked = true AND created_at >= now() - interval '5 minutes';

    SELECT COUNT(*) INTO v_active_campaigns
    FROM public.waf_attack_campaigns WHERE is_active = true;

    -- Conditions d'auto-déclenchement
    IF v_recent_blocks >= p_attack_threshold OR v_active_campaigns >= 3 THEN
        RETURN public.waf_emergency_lockdown(
            25,
            format('auto-trigger: %s blocages/5min, %s campagnes actives',
                   v_recent_blocks, v_active_campaigns)
        );
    END IF;

    RETURN json_build_object(
        'status', 'normal',
        'recent_blocks_5min', v_recent_blocks,
        'active_campaigns', v_active_campaigns,
        'threshold', p_attack_threshold
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_check_auto_lockdown TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 7. Fonction améliorée : Stats WAF (bug END_TIME corrigé + KPI)
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_waf_stats(p_hours INTEGER DEFAULT 24)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_since  TIMESTAMPTZ := now() - (p_hours || ' hours')::interval;
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'window_hours',   p_hours,
        'total_events',   COUNT(*),
        'blocked_count',  COUNT(*) FILTER (WHERE is_blocked = true),
        'unique_ips',     COUNT(DISTINCT ip),
        'tarpit_count',   COUNT(*) FILTER (WHERE action = 'tarpit'),
        'deceive_count',  COUNT(*) FILTER (WHERE action = 'deceive'),
        'honeypot_count', COUNT(*) FILTER (WHERE action = 'honeypot' OR threat_type = 'honeypot'),
        'allow_count',    COUNT(*) FILTER (WHERE action = 'allow'),
        'block_rate_pct', ROUND(
            100.0 * COUNT(*) FILTER (WHERE is_blocked = true) / NULLIF(COUNT(*), 0), 2),
        'avg_delay_ms',   COALESCE(AVG(response_delay_ms) FILTER (WHERE response_delay_ms > 0), 0)::integer,
        'max_delay_ms',   COALESCE(MAX(response_delay_ms), 0),
        'top_threats', (
            SELECT json_agg(t) FROM (
                SELECT threat_type, COUNT(*) AS count
                FROM public.waf_logs WHERE created_at >= v_since
                GROUP BY threat_type ORDER BY count DESC LIMIT 5
            ) t),
        'top_attackers', (
            SELECT json_agg(a) FROM (
                SELECT ip, COUNT(*) AS count
                FROM public.waf_logs
                WHERE created_at >= v_since AND is_blocked = true
                GROUP BY ip ORDER BY count DESC LIMIT 10
            ) a),
        'top_targeted_paths', (
            SELECT json_agg(p) FROM (
                SELECT path, COUNT(*) AS count
                FROM public.waf_logs
                WHERE created_at >= v_since AND is_blocked = true
                GROUP BY path ORDER BY count DESC LIMIT 10
            ) p),
        'dangerous_ips',    (SELECT COUNT(*) FROM public.waf_ip_memory WHERE trust_score < 15),
        'ip_hoppers',       (SELECT COUNT(*) FROM public.waf_ip_memory WHERE ip_hopper = true),
        'active_campaigns', (SELECT COUNT(*) FROM public.waf_attack_campaigns WHERE is_active = true),
        'learned_rules',    (SELECT COUNT(*) FROM public.waf_learned_rules WHERE auto_active = true),
        'ip_blocks_active', (SELECT COUNT(*) FROM public.ip_blocks WHERE unblocked_at IS NULL),
        'known_bad_fps',    (SELECT COUNT(*) FROM public.waf_device_fingerprints WHERE is_known_bad = true),
        'total_fingerprints', (SELECT COUNT(*) FROM public.waf_device_fingerprints),
        'honeypot_interactions_window', (
            SELECT COUNT(*) FROM public.waf_honeypot_interactions WHERE created_at >= v_since),
        'generated_at', now()
    ) INTO v_result
    FROM public.waf_logs
    WHERE created_at >= v_since;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_waf_stats TO service_role, authenticated;

-- ══════════════════════════════════════════════════════════════
-- 9. Fonction : Vérifier un canary token (traque les fuites)
-- Si un attaquant réutilise une info d'un faux payload, il se trahit
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_check_canary_token(
    p_token   TEXT,
    p_ip      TEXT DEFAULT '',
    p_path    TEXT DEFAULT '',
    p_context JSONB DEFAULT '{}'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists  BOOLEAN := false;
    v_type    TEXT := '';
    v_source  TEXT := '';
BEGIN
    -- Vérifier si le token existe
    SELECT true, token_type, embedded_in
    INTO v_exists, v_type, v_source
    FROM public.waf_canary_tokens
    WHERE token = p_token AND is_active = true;

    IF NOT v_exists THEN
        RETURN json_build_object('triggered', false, 'reason', 'Token inconnu');
    END IF;

    -- Mettre à jour le token
    UPDATE public.waf_canary_tokens
    SET triggered_count = triggered_count + 1,
        first_triggered = COALESCE(first_triggered, now()),
        last_triggered  = now(),
        source_ip       = p_ip,
        source_context  = source_context || p_context
    WHERE token = p_token;

    -- Alerte NUCLEAR : un canary token qui trigger = fuite de données confirmée
    INSERT INTO public.waf_alerts (level, message, context)
    VALUES (
        'nuclear',
        format('🐦 CANARY TOKEN DÉCLENCHÉ — Type [%s] depuis %s : token "%s" (source: %s)',
               v_type, p_ip, left(p_token, 20) || '...', v_source),
        jsonb_build_object(
            'token', p_token, 'token_type', v_type,
            'source_payload', v_source, 'ip', p_ip,
            'path', p_path, 'triggered_at', now()
        )
    );

    -- Bannir l'IP immédiatement
    IF p_ip <> '' THEN
        INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
        VALUES (p_ip, format('Canary token [%s] triggered: %s', v_type, left(p_token, 30)),
                'canary_system', 10)
        ON CONFLICT (ip) DO UPDATE SET
            violation_count = ip_blocks.violation_count + 5,
            reason = format('REPEAT: Canary [%s] + %s violations', v_type, ip_blocks.violation_count + 5);

        UPDATE public.waf_ip_memory
        SET trust_score  = 0,
            threat_score = 100,
            last_action  = 'ban'
        WHERE ip = p_ip;
    END IF;

    RETURN json_build_object(
        'triggered', true,
        'token_type', v_type,
        'source_payload', v_source,
        'ip_banned', p_ip <> '',
        'message', format('Canary [%s] déclenché — IP %s bannie', v_type, p_ip)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_check_canary_token TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 10. Fonction : Enregistrer un accès à un honey-record
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_register_honey_access(
    p_table     TEXT,
    p_record_id UUID,
    p_ip        TEXT DEFAULT '',
    p_fp_hash   TEXT DEFAULT ''
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_honey    RECORD;
    v_destroy  BOOLEAN := false;
BEGIN
    SELECT * INTO v_honey
    FROM public.waf_honey_records
    WHERE table_name = p_table AND record_id = p_record_id;

    IF NOT FOUND THEN
        RETURN json_build_object('is_honey', false);
    END IF;

    -- C'est un honey-record ! Mettre à jour
    UPDATE public.waf_honey_records
    SET access_count     = access_count + 1,
        last_accessed_by = p_ip,
        last_accessed_at = now(),
        alerted          = true
    WHERE id = v_honey.id;

    v_destroy := v_honey.auto_destroy;

    -- Alerte critique
    INSERT INTO public.waf_alerts (level, message, context)
    VALUES (
        'nuclear',
        format('🍯 HONEY-RECORD TOUCHÉ — Table: %s, IP: %s (accès #%s)',
               p_table, p_ip, v_honey.access_count + 1),
        jsonb_build_object(
            'table_name', p_table, 'record_id', p_record_id,
            'trap_type', v_honey.trap_type, 'ip', p_ip,
            'fingerprint', p_fp_hash,
            'access_count', v_honey.access_count + 1,
            'auto_destroy', v_destroy
        )
    );

    -- Bannir l'IP
    IF p_ip <> '' THEN
        INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
        VALUES (p_ip, format('Honey-record [%s] %s/%s touché', v_honey.trap_type, p_table, p_record_id),
                'honey_record', 10)
        ON CONFLICT (ip) DO UPDATE SET violation_count = ip_blocks.violation_count + 5;

        UPDATE public.waf_ip_memory
        SET trust_score = 0, threat_score = 100, last_action = 'ban'
        WHERE ip = p_ip;
    END IF;

    -- Log interaction honeypot
    INSERT INTO public.waf_honeypot_interactions (
        ip, fingerprint_hash, path, method, attack_class, payload_used
    ) VALUES (
        p_ip, p_fp_hash,
        format('honey-record:%s/%s', p_table, p_record_id),
        'SELECT', 'honeypot',
        format('honey_%s', v_honey.trap_type)
    );

    RETURN json_build_object(
        'is_honey', true,
        'trap_type', v_honey.trap_type,
        'destroy_session', v_destroy,
        'access_count', v_honey.access_count + 1,
        'message', format('Honey-record [%s] déclenché — session à détruire: %s', v_honey.trap_type, v_destroy)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_register_honey_access TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 11. Fonction : Mode Miroir / Nuclear Challenge
-- Active le "mode miroir" : toutes les réponses deviennent de fausses données
-- + rotation de clés + bannissement massif
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.waf_trigger_nuclear_challenge(
    p_ip     TEXT DEFAULT '',
    p_reason TEXT DEFAULT 'manual'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_banned_count   INTEGER := 0;
    v_fp_marked      INTEGER := 0;
    v_canaries_count INTEGER := 0;
BEGIN
    -- 1. Bannir l'IP source + toutes ses IPs associées via fingerprint
    IF p_ip <> '' THEN
        -- Bannir l'IP
        INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
        VALUES (p_ip, format('NUCLEAR CHALLENGE: %s', p_reason), 'nuclear_challenge', 20)
        ON CONFLICT (ip) DO UPDATE SET violation_count = 99, reason = format('NUCLEAR: %s', p_reason);

        -- Bannir toutes les IPs associées au même fingerprint
        INSERT INTO public.ip_blocks (ip, reason, blocked_by, violation_count)
        SELECT unnest(fp.associated_ips), format('NUCLEAR (associated via fingerprint %s)', fp.hash),
               'nuclear_challenge', 15
        FROM public.waf_device_fingerprints fp
        WHERE p_ip = ANY(fp.associated_ips)
        ON CONFLICT (ip) DO UPDATE SET violation_count = GREATEST(ip_blocks.violation_count, 15);

        GET DIAGNOSTICS v_banned_count = ROW_COUNT;

        -- Marquer tous les fingerprints associés comme known_bad
        UPDATE public.waf_device_fingerprints
        SET is_known_bad = true, trust_score = 0
        WHERE p_ip = ANY(associated_ips);
        GET DIAGNOSTICS v_fp_marked = ROW_COUNT;
    END IF;

    -- 2. Vérifier les canary tokens actifs (pour monitoring)
    SELECT COUNT(*) INTO v_canaries_count
    FROM public.waf_canary_tokens WHERE is_active = true;

    -- 3. Alerte NUCLEAR
    INSERT INTO public.waf_alerts (level, message, context)
    VALUES (
        'nuclear',
        format('☢️ NUCLEAR CHALLENGE ACTIVÉ — Raison: %s | IP source: %s | %s IPs bannies | %s fingerprints marqués',
               p_reason, p_ip, v_banned_count, v_fp_marked),
        jsonb_build_object(
            'reason', p_reason, 'source_ip', p_ip,
            'banned_ips', v_banned_count, 'marked_fps', v_fp_marked,
            'active_canaries', v_canaries_count,
            'triggered_at', now()
        )
    );

    RETURN json_build_object(
        'status', 'nuclear_active',
        'banned_ips', v_banned_count,
        'fingerprints_marked', v_fp_marked,
        'active_canaries', v_canaries_count,
        'reason', p_reason,
        'message', format('☢️ Mode Miroir activé: %s IPs bannies, %s fingerprints marqués', v_banned_count, v_fp_marked)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.waf_trigger_nuclear_challenge TO service_role;

-- ══════════════════════════════════════════════════════════════
-- 12. Vérification
-- ══════════════════════════════════════════════════════════════
SELECT proname AS function_name, 'OK' AS status
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'waf_compute_risk_score', 'waf_evaluate_request', 'waf_register_fingerprint',
    'waf_get_deception_payload', 'waf_tarpit_delay', 'waf_daily_maintenance',
    'waf_emergency_lockdown', 'waf_check_auto_lockdown', 'get_waf_stats',
    'waf_check_canary_token', 'waf_register_honey_access', 'waf_trigger_nuclear_challenge'
  )
ORDER BY proname;

SELECT 'Migration 20260602_waf_active_offense v3 + immune_system : OK' AS status;