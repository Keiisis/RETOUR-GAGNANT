-- ══════════════════════════════════════════════════════════════
--  IDENTITÉ IP : RALLIER L'HISTORIQUE À LA CLEF /64 (IPv6)
--
--  CONTEXTE
--  Le code identifiait un visiteur par son adresse ENTIÈRE. En IPv6, les 64
--  derniers bits sont tirés au hasard et changent chaque jour (RFC 4941/7217).
--  Conséquences observées en base :
--    · `waf_ip_memory` : une ligne par rotation → le score de confiance d'un
--      foyer ne s'accumulait jamais, et la table gonfle sans fin ;
--    · `ip_blocks` : un bannissement posé sur une adresse morte le lendemain.
--
--  Le code écrit désormais la CLEF (`lib/net/ip-identity.ts`) :
--    IPv4 → l'adresse ; IPv6 → son /64, au format `2001:0861:2409:afe0::/64`.
--  Cette migration met l'historique au même format, sinon les deux mondes
--  cohabitent et les anciens verdicts sont ignorés en silence.
--
--  ⚠️ À EXÉCUTER dans l'éditeur SQL Supabase. Idempotent : relançable.
--  ⚠️ N'ÉLARGIT JAMAIS au-delà du /64. `2001:861::/32` = tout Orange France.
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. La fonction de clef, côté SQL (miroir de lib/net/ip-identity.ts) ──
-- Utilisée par cette migration ET disponible pour toute requête d'analyse.
CREATE OR REPLACE FUNCTION public.rgb_clef_ip(p_ip TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ip   TEXT;
    v_inet INET;
BEGIN
    v_ip := lower(btrim(coalesce(p_ip, '')));
    IF v_ip = '' OR v_ip = 'unknown' THEN
        RETURN coalesce(p_ip, 'unknown');
    END IF;

    -- Déjà une clef /64 : on ne la retouche pas (relance sans effet).
    IF v_ip LIKE '%::/64' THEN
        RETURN v_ip;
    END IF;

    -- IPv4 mappée en IPv6 → IPv4.
    IF v_ip LIKE '::ffff:%.%' THEN
        v_ip := split_part(v_ip, ':', array_length(string_to_array(v_ip, ':'), 1));
    END IF;

    BEGIN
        v_inet := v_ip::INET;
    EXCEPTION WHEN OTHERS THEN
        RETURN p_ip;   -- inanalysable : on laisse tel quel plutôt que d'inventer
    END;

    -- IPv4 : l'adresse identifie déjà l'abonné.
    IF family(v_inet) = 4 THEN
        RETURN host(v_inet);
    END IF;

    /* IPv6 : le /64, écrit par PostgreSQL lui-même. C'est CETTE forme que
       `lib/net/ip-identity.ts` reproduit (zéros de tête retirés, groupes de
       queue absorbés par le « :: ») — les deux doivent rendre la même chaîne,
       sinon l'historique rallié ici ne correspond à aucune clef calculée à
       l'exécution. Exemple : 2001:861:2409:afe0::/64 */
    RETURN network(set_masklen(v_inet, 64))::TEXT;
END;
$$;

COMMENT ON FUNCTION public.rgb_clef_ip(TEXT) IS
  'Clef d''identification d''un visiteur : IPv4 telle quelle, IPv6 ramenée à son /64. Miroir SQL de lib/net/ip-identity.ts.';

-- ── 2. waf_ip_memory : fusionner les rotations d'un même abonné ──────────
-- Le pire verdict l'emporte (trust_score minimal) : une adresse rotative ne
-- doit pas servir à effacer un mauvais comportement du même foyer.
-- Compteurs et dates : une ligne par clef.
CREATE TEMP TABLE _memoire_fusion ON COMMIT DROP AS
SELECT
    public.rgb_clef_ip(ip)        AS clef,
    min(first_seen)               AS first_seen,
    max(last_seen)                AS last_seen,
    sum(total_requests)::INTEGER  AS total_requests,
    sum(blocked_count)::INTEGER   AS blocked_count,
    min(trust_score)::INTEGER     AS trust_score,
    bool_or(is_trusted)           AS is_trusted
FROM public.waf_ip_memory
GROUP BY 1;

-- Types d'attaque : dépliés puis re-agrégés sans doublon (un tableau de
-- tableaux ne se fusionne pas dans la même passe d'agrégation).
CREATE TEMP TABLE _types_fusion ON COMMIT DROP AS
SELECT public.rgb_clef_ip(m.ip)   AS clef,
       array_agg(DISTINCT t)      AS attack_types
FROM public.waf_ip_memory m, unnest(m.attack_types) AS t
GROUP BY 1;

DELETE FROM public.waf_ip_memory;

INSERT INTO public.waf_ip_memory
    (ip, first_seen, last_seen, total_requests, blocked_count, trust_score,
     attack_types, payload_hashes, is_trusted, evolution_log)
SELECT
    f.clef, f.first_seen, f.last_seen, f.total_requests, f.blocked_count,
    greatest(0, least(100, f.trust_score)),
    coalesce(t.attack_types, '{}'),
    '{}',                       -- les condensats de charge utile ne se fusionnent pas
    f.is_trusted,
    ARRAY['fusion /64 le ' || now()::DATE]
FROM _memoire_fusion f
LEFT JOIN _types_fusion t ON t.clef = f.clef
ON CONFLICT (ip) DO NOTHING;

-- ── 3. ip_blocks : re-poser les bannissements IPv6 sur le /64 ───────────
-- Un ban sur une adresse rotative ne protégeait de rien : il visait une
-- adresse que le client n'a déjà plus.
/* `ip` porte une contrainte UNIQUE : on NETTOIE d'abord, on renomme ensuite.
   Sinon deux adresses rotatives du même foyer, ralliées au même /64, se
   heurteraient et la migration entière échouerait. */
WITH classement AS (
    SELECT id,
           public.rgb_clef_ip(ip) AS clef,
           row_number() OVER (
               PARTITION BY public.rgb_clef_ip(ip)
               ORDER BY blocked_at DESC NULLS LAST
           ) AS rang
    FROM public.ip_blocks
    WHERE ip LIKE '%:%' AND ip NOT LIKE '%::/64'
)
DELETE FROM public.ip_blocks b
USING classement c
WHERE b.id = c.id
  AND (
        c.rang > 1                                   -- doublon de la même clef
        OR EXISTS (SELECT 1 FROM public.ip_blocks x  -- le /64 est déjà banni
                   WHERE x.ip = c.clef AND x.id <> b.id)
  );

-- Les survivantes : une seule par clef, aucune collision possible.
UPDATE public.ip_blocks b
SET    ip     = public.rgb_clef_ip(b.ip),
       reason = left(coalesce(b.reason, '') || ' [rallié au /64 : ' || b.ip || ']', 500)
WHERE  b.ip LIKE '%:%'
  AND  b.ip NOT LIKE '%::/64';

COMMIT;

-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION (à lire après exécution)
--   · aucune ligne IPv6 « pleine » ne doit subsister dans les deux tables ;
--   · waf_logs n'est PAS touchée : elle garde la trace exacte des requêtes,
--     et le code y joint désormais `ip_vue=<adresse>` dans threat_detail.
-- ══════════════════════════════════════════════════════════════
-- SELECT 'waf_ip_memory' AS table, count(*) FILTER (WHERE ip LIKE '%:%' AND ip NOT LIKE '%::/64') AS a_rallier FROM public.waf_ip_memory
-- UNION ALL
-- SELECT 'ip_blocks', count(*) FILTER (WHERE ip LIKE '%:%' AND ip NOT LIKE '%::/64') FROM public.ip_blocks;
