-- ══════════════════════════════════════════════════════════════
--  PURGE DU RÔLE CEO
--
--  Le panel CEO et son rôle ont été retirés du code applicatif. Cette
--  migration purge la base :
--
--   1. Réaffecte tout compte encore en 'ceo' vers 'admin' (aucun
--      attendu — contrôle fait avant — mais idempotent et défensif).
--   2. Interdit DÉFINITIVEMENT la valeur 'ceo' via une contrainte CHECK.
--      C'est le cœur de la purge : plus aucune ligne user_profiles ne
--      peut valoir 'ceo', donc TOUTE clause « role IN (…, 'ceo') »
--      encore présente dans une politique RLS devient une branche morte,
--      inatteignable. Le rôle est éliminé, pas seulement caché.
--   3. Restaure les 4 politiques que la migration 20260404_ceo_role
--      avait modifiées pour y glisser 'ceo' (waf_config, waf_rules,
--      waf_logs, ip_blocks) — retour exact à leur état d'avant-CEO.
--   4. Nettoie la politique paiements_manuels (source unique, récente).
--
--  NON TOUCHÉ VOLONTAIREMENT : les politiques de généalogie (itérées en
--  3 versions) et rls_hardening listent aussi 'ceo'. Les recréer à
--  l'aveugle risquerait d'annuler des correctifs ultérieurs. La
--  contrainte de l'étape 2 les neutralise déjà : leur mention de 'ceo'
--  est du texte inerte.
--
--  Idempotente : ré-exécutable sans effet de bord.
--  À exécuter dans Supabase Dashboard > SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Réaffectation des comptes CEO -> admin ─────────────────
UPDATE public.user_profiles SET role = 'admin' WHERE role = 'ceo';

-- ── 2. Garde-fou : 'ceo' interdit pour toujours ───────────────
-- IS DISTINCT FROM gère proprement le cas role NULL (autorisé).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_profiles_role_no_ceo'
        AND conrelid = 'public.user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles
            ADD CONSTRAINT user_profiles_role_no_ceo
            CHECK (role IS DISTINCT FROM 'ceo');
    END IF;
END $$;

-- ── 3. Restauration des 4 politiques modifiées par le CEO ─────
-- Définitions identiques à 20260402/20260403, sans 'ceo'.

DROP POLICY IF EXISTS "admin_waf_config" ON public.waf_config;
CREATE POLICY "admin_waf_config" ON public.waf_config
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

DROP POLICY IF EXISTS "admin_waf_rules" ON public.waf_rules;
CREATE POLICY "admin_waf_rules" ON public.waf_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- waf_logs et ip_blocks : recréées seulement si la table existe.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'waf_logs') THEN
        DROP POLICY IF EXISTS "admin_waf_logs" ON public.waf_logs;
        EXECUTE $policy$
            CREATE POLICY "admin_waf_logs" ON public.waf_logs
                FOR ALL TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin')
                    )
                )
        $policy$;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'ip_blocks') THEN
        DROP POLICY IF EXISTS "admin_ip_blocks" ON public.ip_blocks;
        EXECUTE $policy$
            CREATE POLICY "admin_ip_blocks" ON public.ip_blocks
                FOR ALL TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin')
                    )
                )
        $policy$;
    END IF;
END $$;

-- ── 4. paiements_manuels : source unique (20260714) ───────────
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'paiements_manuels') THEN
        DROP POLICY IF EXISTS "agents_own_paiements_manuels" ON public.paiements_manuels;
        EXECUTE $policy$
            CREATE POLICY "agents_own_paiements_manuels" ON public.paiements_manuels
                FOR ALL TO authenticated
                USING (
                    agent_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin')
                    )
                )
                WITH CHECK (
                    agent_id = auth.uid()
                    OR EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin')
                    )
                )
        $policy$;
    END IF;
END $$;

-- ── 5. Vérification ───────────────────────────────────────────
-- Doit renvoyer 0 compte CEO, la contrainte présente, et la liste des
-- politiques où 'ceo' reste en texte inerte (neutralisé par la contrainte).
SELECT
    (SELECT count(*) FROM public.user_profiles WHERE role = 'ceo')            AS comptes_ceo_restants,
    (SELECT count(*) FROM pg_constraint
        WHERE conname = 'user_profiles_role_no_ceo')                          AS garde_fou_present,
    (SELECT count(*) FROM pg_policies WHERE qual LIKE '%''ceo''%')            AS politiques_texte_ceo_inerte;
