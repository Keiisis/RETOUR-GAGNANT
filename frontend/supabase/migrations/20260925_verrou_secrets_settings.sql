-- ══════════════════════════════════════════════════════════════════════════════
--  VERROU DES SECRETS — table `settings`
--  Date : 2026-09-25
--
--  CONSTAT (vérifié le 25/09/2026 avec la clé ANONYME, celle que tout visiteur
--  trouve dans le code JavaScript du site) : la table `settings` renvoyait en
--  clair le mot de passe SMTP, les clés privée et secrète Kkiapay, la clé
--  secrète FedaPay, la clé secrète Stripe et le secret du webhook Stripe.
--  La migration 20260519 prévoyait « admin uniquement » ; une règle plus
--  permissive coexistait (les règles Postgres s'ADDITIONNENT : une seule règle
--  ouverte suffit à tout ouvrir).
--
--  CE QUE FAIT CETTE MIGRATION
--    1. supprime TOUTES les règles existantes de `settings` (quel que soit leur
--       nom) : on repart d'une situation connue ;
--    2. visiteurs et clients : lecture des seuls réglages PUBLICS non secrets
--       (textes du site, couleurs, liens, clés publiques de paiement) ;
--    3. équipe (agents + admins) : lecture de tous les réglages NON secrets ;
--    4. administrateurs : lecture et écriture de tout ;
--    5. le serveur (service role) contourne les règles, comme toujours.
--
--  PRÉREQUIS : le code déployé le 25/09/2026 lit les secrets côté serveur
--  avec la clé service (lib/supabase-serveur.ts). Exécuter cette migration
--  APRÈS ce déploiement.
--
--  APRÈS EXÉCUTION : régénérer les 6 secrets qui ont été exposés (mot de passe
--  SMTP, clés Kkiapay privée et secrète, clé secrète FedaPay, clé secrète et
--  secret de webhook Stripe) puis les ressaisir dans l'admin.
--
--  Idempotent : exécutable plusieurs fois.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Fonctions d'aide ──────────────────────────────────────────────────────────

-- Une clé est SECRÈTE si son nom le dit. Liste volontairement large : mieux
-- vaut masquer une clé inoffensive qu'exposer une clé sensible.
CREATE OR REPLACE FUNCTION public.rgb_cle_secrete(k text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
    SELECT k ~* '(secret|private|password|passwd|_pass$|token|api_key|apikey|webhook_id|hash)'
$$;

-- Rôle d'équipe de la personne connectée (NULL pour un visiteur ou un client).
-- SECURITY DEFINER : lit `user_profiles` sans dépendre de ses propres règles.
CREATE OR REPLACE FUNCTION public.rgb_role_equipe()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.rgb_role_equipe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rgb_role_equipe() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rgb_cle_secrete(text) TO anon, authenticated;

-- ── Règles de `settings` ─────────────────────────────────────────────────────

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 1. Table rase : toutes les règles existantes, quel que soit leur nom.
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'settings' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.settings', r.policyname);
    END LOOP;
END $$;

-- 2. Public : réglages d'affichage et clés publiques de paiement, jamais un secret.
CREATE POLICY settings_lecture_publique ON public.settings
    FOR SELECT TO anon, authenticated
    USING (
        NOT public.rgb_cle_secrete(key)
        AND COALESCE(category, '') IN ('frontend', 'general', 'contact', 'payment')
    );

-- 3. Équipe : tout réglage non secret (taux de commission, MECeF, e-mail…).
CREATE POLICY settings_lecture_equipe ON public.settings
    FOR SELECT TO authenticated
    USING (
        NOT public.rgb_cle_secrete(key)
        AND public.rgb_role_equipe() IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent')
    );

-- 4. Administrateurs : tout, en lecture comme en écriture.
CREATE POLICY settings_admin_tout ON public.settings
    FOR ALL TO authenticated
    USING (public.rgb_role_equipe() IN ('admin', 'super_admin', 'superadmin', 'ceo'))
    WITH CHECK (public.rgb_role_equipe() IN ('admin', 'super_admin', 'superadmin', 'ceo'));

-- ── Contrôle immédiat ────────────────────────────────────────────────────────
-- Doit renvoyer 0 ligne : les clés secrètes visibles par un visiteur anonyme.
SET ROLE anon;
SELECT key AS secret_encore_visible FROM public.settings WHERE public.rgb_cle_secrete(key);
RESET ROLE;
