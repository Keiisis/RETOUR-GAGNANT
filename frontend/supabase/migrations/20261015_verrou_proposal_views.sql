-- ════════════════════════════════════════════════════════════════════════════
--  Audit sécurité du 12/10/2026 — C5 (suite)
--
--  supabase_migration_erp.sql créait sur proposal_views une lecture
--  `USING (true)` : avec la clé publique du site, n'importe qui lisait chaque
--  consultation de devis, dont `secret_key` (le secret des pages /p/[secret])
--  et `ip_hint`. Les écritures passent par /api/proposals/track-view (service
--  role) : aucune page n'a besoin d'un accès anonyme.
--
--  documents_financiers : déjà verrouillée par 20260926_verrou_donnees_personnelles.sql
--  (supprime « Accès public via ID pour les clients » USING (true) et
--  « Les Administrateurs voient tout », ouverte à tout compte connecté).
--
--  Ordre : exécuter 20260926 AVANT ce fichier (il fournit rgb_verrouiller).
--  Exécution : SQL Editor Supabase. Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF to_regprocedure('public.rgb_verrouiller(text, boolean)') IS NULL THEN
        RAISE EXCEPTION 'Exécuter d''abord 20260926_verrou_donnees_personnelles.sql';
    END IF;
END $$;

SELECT public.rgb_verrouiller('proposal_views');

-- ── Contrôle : doit renvoyer 0 ligne ────────────────────────────────────────
-- Policies encore ouvertes à tous (USING true / sans condition) sur les tables sensibles.
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('documents_financiers', 'proposal_views')
  AND (qual IS NULL OR qual = 'true')
  AND cmd IN ('SELECT', 'ALL');
