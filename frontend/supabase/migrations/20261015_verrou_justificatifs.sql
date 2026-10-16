-- ════════════════════════════════════════════════════════════════════════════
--  Audit sécurité du 12/10/2026 — M4 (suite du correctif code)
--
--  1. justificatifs.file_url contenait des liens signés valables 10 ans, et la
--     table était lisible par TOUT compte connecté (clients compris) :
--     `justificatifs_read_authenticated USING (true)`. La route
--     /api/admin/comptabilite/justificatifs stocke désormais le seul chemin et
--     régénère un lien de 600 s à chaque lecture.
--  2. Lecture réservée à l'équipe ; les écritures restent sur le service role.
--
--  Les jetons déjà diffusés restent valides jusqu'à la rotation du secret JWT
--  Supabase (prévue avec les secrets à régénérer).
--  Ordre : après 20260926_verrou_donnees_personnelles.sql (rgb_est_equipe).
--  Exécution : SQL Editor Supabase. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF to_regprocedure('public.rgb_est_equipe()') IS NULL THEN
        RAISE EXCEPTION 'Exécuter d''abord 20260926_verrou_donnees_personnelles.sql';
    END IF;
END $$;

-- URL signée → chemin dans le bucket (les lignes déjà au format chemin ne bougent pas)
UPDATE public.justificatifs
SET file_url = substring(file_url from '/justificatifs-compta/([^?]+)')
WHERE file_url ~ '^https?://'
  AND substring(file_url from '/justificatifs-compta/([^?]+)') IS NOT NULL;

DROP POLICY IF EXISTS "justificatifs_read_authenticated" ON public.justificatifs;
DROP POLICY IF EXISTS justificatifs_equipe_lecture ON public.justificatifs;
CREATE POLICY justificatifs_equipe_lecture ON public.justificatifs
    FOR SELECT TO authenticated USING (public.rgb_est_equipe());

-- ── Contrôle : doit renvoyer 0 ──────────────────────────────────────────────
SELECT count(*) AS urls_signees_restantes FROM public.justificatifs WHERE file_url ~ '^https?://';
