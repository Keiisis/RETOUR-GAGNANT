-- ══════════════════════════════════════════════════════════════
-- MIGRATION : Rôle CEO
-- Le rôle CEO a les mêmes permissions qu'Admin (et non SuperAdmin).
-- Il peut accéder à l'espace /admin/* et toutes les API admin.
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Mettre à jour les politiques RLS qui vérifient les rôles admin ──

-- waf_config : autoriser CEO
DROP POLICY IF EXISTS "admin_waf_config" ON public.waf_config;
CREATE POLICY "admin_waf_config" ON public.waf_config
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
        )
    );

-- waf_rules : autoriser CEO
DROP POLICY IF EXISTS "admin_waf_rules" ON public.waf_rules;
CREATE POLICY "admin_waf_rules" ON public.waf_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
        )
    );

-- waf_logs : si une politique existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'waf_logs' AND policyname = 'admin_waf_logs') THEN
        DROP POLICY "admin_waf_logs" ON public.waf_logs;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waf_logs') THEN
        EXECUTE $policy$
            CREATE POLICY "admin_waf_logs" ON public.waf_logs
                FOR ALL TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
                    )
                )
        $policy$;
    END IF;
END $$;

-- ip_blocks : si une politique existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ip_blocks' AND policyname = 'admin_ip_blocks') THEN
        DROP POLICY "admin_ip_blocks" ON public.ip_blocks;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ip_blocks') THEN
        EXECUTE $policy$
            CREATE POLICY "admin_ip_blocks" ON public.ip_blocks
                FOR ALL TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles
                        WHERE id = auth.uid()
                        AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
                    )
                )
        $policy$;
    END IF;
END $$;

-- ── 2. Vérification ────────────────────────────────────────────
-- Pour attribuer le rôle CEO à un utilisateur :
-- UPDATE public.user_profiles SET role = 'ceo' WHERE id = '<user-uuid>';

SELECT 'Migration CEO terminée — rôle ceo autorisé dans toutes les politiques admin' AS status;
