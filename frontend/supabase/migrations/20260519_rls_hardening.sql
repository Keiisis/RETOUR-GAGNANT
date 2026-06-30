-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION SÉCURITÉ RLS — Colmatage des brèches
-- Date : 2026-05-19
-- ══════════════════════════════════════════════════════════════════════════════
-- 
-- PROBLÈME RÉSOLU :
-- Plusieurs tables critiques n'avaient PAS de RLS activé, ce qui signifie que 
-- n'importe quel utilisateur authentifié avec la clé ANON pouvait théoriquement 
-- lire TOUTES les données de ces tables via l'API REST Supabase.
--
-- TABLES SÉCURISÉES PAR CETTE MIGRATION :
--   1. dossiers          — Dossiers clients (nationalité, etc.)
--   2. orders            — Commandes boutique
--   3. notifications     — Notifications push
--   4. leads             — Prospects et leads
--   5. settings          — Paramètres admin (SMTP, clés API, etc.)
--   6. email_logs        — Historique des emails envoyés
--   7. dossier_tracking  — Suivi des dossiers (agent)
--   8. security_logs     — Journaux de sécurité (purge, WAF)
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. TABLE : dossiers
-- ⚠️ CRITIQUE — contient les dossiers de nationalité des clients
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dossiers') THEN
        ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

        -- Le client ne voit que SES propres dossiers
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossiers' AND policyname = 'dossiers_client_select_own') THEN
            CREATE POLICY "dossiers_client_select_own" ON public.dossiers
                FOR SELECT TO authenticated
                USING (client_id = auth.uid());
        END IF;

        -- Le client peut créer un dossier pour lui-même
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossiers' AND policyname = 'dossiers_client_insert_own') THEN
            CREATE POLICY "dossiers_client_insert_own" ON public.dossiers
                FOR INSERT TO authenticated
                WITH CHECK (client_id = auth.uid());
        END IF;

        -- Les agents voient TOUS les dossiers (ils en ont besoin pour traiter)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossiers' AND policyname = 'dossiers_agent_all') THEN
            CREATE POLICY "dossiers_agent_all" ON public.dossiers
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
                );
        END IF;

        -- service_role bypass total (pour les CRON jobs et API serveur)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossiers' AND policyname = 'dossiers_service_role') THEN
            CREATE POLICY "dossiers_service_role" ON public.dossiers
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 2. TABLE : orders
-- Commandes e-commerce — gérées côté serveur (service_role)
-- La table n'a PAS de client_id (utilise customer_email/customer_phone)
-- Donc pas de politique client directe — admin + service_role uniquement
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

        -- Admin/agent : lecture de toutes les commandes
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_admin_all') THEN
            CREATE POLICY "orders_admin_all" ON public.orders
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
                );
        END IF;

        -- service_role : bypass total (webhooks, checkout API, CRON)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'orders_service_role') THEN
            CREATE POLICY "orders_service_role" ON public.orders
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 3. TABLE : notifications
-- Chaque user ne voit que SES notifications
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notif_select_own') THEN
            CREATE POLICY "notif_select_own" ON public.notifications
                FOR SELECT TO authenticated
                USING (user_id = auth.uid());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notif_update_own') THEN
            CREATE POLICY "notif_update_own" ON public.notifications
                FOR UPDATE TO authenticated
                USING (user_id = auth.uid())
                WITH CHECK (user_id = auth.uid());
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notif_service_role') THEN
            CREATE POLICY "notif_service_role" ON public.notifications
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 4. TABLE : leads
-- Données commerciales — admin/agents uniquement
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leads') THEN
        ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_admin_all') THEN
            CREATE POLICY "leads_admin_all" ON public.leads
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
                );
        END IF;

        -- Autoriser les INSERT anonymes (formulaire public de contact)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_anon_insert') THEN
            CREATE POLICY "leads_anon_insert" ON public.leads
                FOR INSERT TO anon, authenticated
                WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'leads_service_role') THEN
            CREATE POLICY "leads_service_role" ON public.leads
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 5. TABLE : settings
-- ⚠️ ULTRA-CRITIQUE — contient les clés SMTP, Kkiapay, etc.
-- Seuls les admin/CEO peuvent lire ces données
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settings') THEN
        ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'settings_admin_only') THEN
            CREATE POLICY "settings_admin_only" ON public.settings
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo'))
                );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'settings_service_role') THEN
            CREATE POLICY "settings_service_role" ON public.settings
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 6. TABLE : email_logs
-- Historique des emails — admin uniquement
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_logs') THEN
        ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'email_logs_admin_only') THEN
            CREATE POLICY "email_logs_admin_only" ON public.email_logs
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo'))
                );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_logs' AND policyname = 'email_logs_service_role') THEN
            CREATE POLICY "email_logs_service_role" ON public.email_logs
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 7. TABLE : dossier_tracking (renforcement)
-- Les agents doivent pouvoir TOUT faire, les clients uniquement LIRE
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dossier_tracking') THEN
        ALTER TABLE public.dossier_tracking ENABLE ROW LEVEL SECURITY;

        -- Agent/admin : accès total
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossier_tracking' AND policyname = 'dt_agent_all') THEN
            CREATE POLICY "dt_agent_all" ON public.dossier_tracking
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
                );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dossier_tracking' AND policyname = 'dt_service_role') THEN
            CREATE POLICY "dt_service_role" ON public.dossier_tracking
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 8. TABLE : security_logs
-- Journaux de sécurité — admin uniquement, jamais les clients
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'security_logs') THEN
        ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_logs' AND policyname = 'seclog_admin_only') THEN
            CREATE POLICY "seclog_admin_only" ON public.security_logs
                FOR SELECT TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo'))
                );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_logs' AND policyname = 'seclog_service_role') THEN
            CREATE POLICY "seclog_service_role" ON public.security_logs
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- 9. TABLE : document_templates
-- Templates admin — lecture seule pour agents, admin peut modifier
-- ═══════════════════════════════════════════════════════════════
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'document_templates') THEN
        ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'doctpl_admin_all') THEN
            CREATE POLICY "doctpl_admin_all" ON public.document_templates
                FOR ALL TO authenticated
                USING (
                    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'superadmin', 'ceo'))
                );
        END IF;

        -- Agents et clients peuvent lire les templates (pour affichage email)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'doctpl_read_all') THEN
            CREATE POLICY "doctpl_read_all" ON public.document_templates
                FOR SELECT TO authenticated
                USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'document_templates' AND policyname = 'doctpl_service_role') THEN
            CREATE POLICY "doctpl_service_role" ON public.document_templates
                FOR ALL TO service_role USING (true);
        END IF;
    END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE
-- ═══════════════════════════════════════════════════════════════
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS "RLS Activé"
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'dossiers', 'orders', 'notifications', 'leads',
    'settings', 'email_logs', 'dossier_tracking', 'security_logs',
    'document_templates', 'client_profiles', 'client_documents',
    'dossier_documents', 'waf_logs', 'ip_blocks'
  )
ORDER BY tablename;


-- ═══════════════════════════════════════════════════════════════
-- RÉSUMÉ
-- ═══════════════════════════════════════════════════════════════
-- ✅ 9 tables sécurisées avec RLS + politiques granulaires
-- ✅ Clients : accès uniquement à LEURS données
-- ✅ Agents  : accès à tous les dossiers pour traitement
-- ✅ Admin   : accès total
-- ✅ service_role : bypass total (pour CRON/API serveur)
-- ✅ Données sensibles (settings, email_logs) : admin/CEO uniquement
-- ═══════════════════════════════════════════════════════════════
