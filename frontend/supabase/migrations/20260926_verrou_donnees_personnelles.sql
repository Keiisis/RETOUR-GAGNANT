-- ════════════════════════════════════════════════════════════════════════════
--  Verrou des DONNÉES PERSONNELLES (phase 2 de l'audit du 25/09/2026)
--
--  Constat : la clé ANONYME (publique, présente dans le JavaScript du site)
--  lisait sans session : email_logs (contenu des emails), messages,
--  dossier_tracking, eligibility_results, nationality_applications,
--  documents_financiers, orders… Des règles permissives s'additionnaient aux
--  règles « admin only » (les policies Postgres se cumulent par OU).
--
--  Préalable (fait dans le code, commit du 26/09/2026) : les pages publiques
--  qui lisaient ces tables sans session passent par des routes serveur
--  (service role) — /mon-compte, /suivi-dossier, /portail/[id],
--  /nationalite/complement-ancestral, cloche client, widget de chat.
--
--  Modèle appliqué à chaque table :
--    1. table rase : toutes les policies existantes supprimées ;
--    2. ÉQUIPE (admin, super_admin, superadmin, ceo, agent) : tout ;
--    3. PROPRIÉTAIRE (client connecté) : ses lignes seulement, repérées par
--       son id (auth.uid()) ou l'email de SA session — jamais un email saisi ;
--    4. ANONYME : rien. Le service role (routes serveur) contourne RLS.
--
--  Exécution : SQL Editor Supabase, en une fois. Idempotent.
--  Contrôle final en bas de fichier : toutes les lignes doivent valoir 0.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Fonctions d'identité ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rgb_role_equipe()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.rgb_est_equipe()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(public.rgb_role_equipe() IN ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'), false)
$$;

CREATE OR REPLACE FUNCTION public.rgb_est_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT coalesce(public.rgb_role_equipe() IN ('admin', 'super_admin', 'superadmin', 'ceo'), false)
$$;

-- Email de la SESSION (jeton signé par Supabase), en minuscules. '' si anonyme.
CREATE OR REPLACE FUNCTION public.rgb_email_session()
RETURNS text
LANGUAGE sql STABLE
AS $$
    SELECT lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

REVOKE ALL ON FUNCTION public.rgb_role_equipe()   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rgb_est_equipe()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rgb_est_admin()     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rgb_email_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rgb_role_equipe()   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rgb_est_equipe()    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rgb_est_admin()     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rgb_email_session() TO anon, authenticated;

-- ── Table rase + RLS + accès équipe, pour chaque table ──────────────────────
--  `admin_seul` : accès réservé aux administrateurs (email_logs : contenu
--  intégral des emails envoyés ; décision du 19/05/2026 conservée).

CREATE OR REPLACE FUNCTION public.rgb_verrouiller(t text, admin_seul boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE r record;
BEGIN
    IF to_regclass('public.' || t) IS NULL THEN
        RAISE NOTICE 'Table absente, ignorée : %', t;
        RETURN;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        t || '_equipe', t,
        CASE WHEN admin_seul THEN 'public.rgb_est_admin()' ELSE 'public.rgb_est_equipe()' END,
        CASE WHEN admin_seul THEN 'public.rgb_est_admin()' ELSE 'public.rgb_est_equipe()' END
    );
END $$;

SELECT public.rgb_verrouiller('email_logs', true);
SELECT public.rgb_verrouiller('paiements_manuels');
SELECT public.rgb_verrouiller('nationality_applications');
SELECT public.rgb_verrouiller('documents_financiers');
SELECT public.rgb_verrouiller('orders');
SELECT public.rgb_verrouiller('dossier_tracking');
SELECT public.rgb_verrouiller('messages');
SELECT public.rgb_verrouiller('chat_messages');
SELECT public.rgb_verrouiller('eligibility_results');
SELECT public.rgb_verrouiller('client_documents');
SELECT public.rgb_verrouiller('contracts');
SELECT public.rgb_verrouiller('client_notifications');
SELECT public.rgb_verrouiller('rdv_requests');
SELECT public.rgb_verrouiller('notifications');
SELECT public.rgb_verrouiller('client_profiles');
SELECT public.rgb_verrouiller('calls');
SELECT public.rgb_verrouiller('appointments');
SELECT public.rgb_verrouiller('dossiers');

-- ── Accès PROPRIÉTAIRE (espace client web /client/* et app mobile) ──────────
--  Chaque règle reproduit les filtres réellement utilisés par ces écrans
--  (relevé du 26/09/2026), pour qu'aucun écran client ne se vide.

-- documents_financiers : devis/factures du client (lecture seule).
CREATE POLICY documents_financiers_client_lecture ON public.documents_financiers
    FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());

-- orders : commandes du client ; suppression seulement d'une commande NON payée.
CREATE POLICY orders_client_lecture ON public.orders
    FOR SELECT TO authenticated
    USING (lower(customer_email) = public.rgb_email_session());
CREATE POLICY orders_client_suppression ON public.orders
    FOR DELETE TO authenticated
    USING (lower(customer_email) = public.rgb_email_session()
           AND coalesce(payment_status, '') <> 'completed');

-- dossier_tracking : suivi du client (lecture, mise à jour, retrait de sa demande).
CREATE POLICY dossier_tracking_client_lecture ON public.dossier_tracking
    FOR SELECT TO authenticated
    USING (client_id = auth.uid()
           OR lower(client_email) = public.rgb_email_session()
           OR lower(email) = public.rgb_email_session());
CREATE POLICY dossier_tracking_client_maj ON public.dossier_tracking
    FOR UPDATE TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session())
    WITH CHECK (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY dossier_tracking_client_suppression ON public.dossier_tracking
    FOR DELETE TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());

-- messages : conversations du client ; il n'écrit qu'en son nom.
CREATE POLICY messages_client_lecture ON public.messages
    FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR lower(email) = public.rgb_email_session());
CREATE POLICY messages_client_ecriture ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (client_id = auth.uid() OR lower(email) = public.rgb_email_session());

-- chat_messages : fils rattachés à UNE conversation du client ; rôle « client » imposé.
CREATE POLICY chat_messages_client_lecture ON public.chat_messages
    FOR SELECT TO authenticated
    USING (conversation_id::text IN (
        SELECT m.id::text FROM public.messages m
        WHERE m.client_id = auth.uid() OR lower(m.email) = public.rgb_email_session()));
CREATE POLICY chat_messages_client_ecriture ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (role = 'client' AND conversation_id::text IN (
        SELECT m.id::text FROM public.messages m
        WHERE m.client_id = auth.uid() OR lower(m.email) = public.rgb_email_session()));

-- nationality_applications / eligibility_results / contracts : lecture seule.
CREATE POLICY nationality_applications_client_lecture ON public.nationality_applications
    FOR SELECT TO authenticated
    USING (lower(email) = public.rgb_email_session());
CREATE POLICY eligibility_results_client_lecture ON public.eligibility_results
    FOR SELECT TO authenticated
    USING (lower(client_email) = public.rgb_email_session());
CREATE POLICY contracts_client_lecture ON public.contracts
    FOR SELECT TO authenticated
    USING (lower(client_email) = public.rgb_email_session());

-- client_documents : pièces du client (dépôt, lecture, retrait).
CREATE POLICY client_documents_client_lecture ON public.client_documents
    FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY client_documents_client_depot ON public.client_documents
    FOR INSERT TO authenticated
    WITH CHECK (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY client_documents_client_suppression ON public.client_documents
    FOR DELETE TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());

-- client_notifications : lecture + « marquer comme lu ».
CREATE POLICY client_notifications_client_lecture ON public.client_notifications
    FOR SELECT TO authenticated
    USING (lower(client_email) = public.rgb_email_session());
CREATE POLICY client_notifications_client_lu ON public.client_notifications
    FOR UPDATE TO authenticated
    USING (lower(client_email) = public.rgb_email_session())
    WITH CHECK (lower(client_email) = public.rgb_email_session());

-- rdv_requests : demandes de RDV du client (lecture, création, annulation).
CREATE POLICY rdv_requests_client_lecture ON public.rdv_requests
    FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY rdv_requests_client_creation ON public.rdv_requests
    FOR INSERT TO authenticated
    WITH CHECK (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY rdv_requests_client_maj ON public.rdv_requests
    FOR UPDATE TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session())
    WITH CHECK (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());

-- notifications (par user_id) : celles de l'utilisateur connecté, client ou agent.
CREATE POLICY notifications_proprietaire ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- client_profiles : son propre profil.
CREATE POLICY client_profiles_proprietaire ON public.client_profiles
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- calls : appels lancés par le client (création, raccrocher, lecture).
CREATE POLICY calls_client ON public.calls
    FOR ALL TO authenticated
    USING (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- appointments / dossiers : lecture des siens.
CREATE POLICY appointments_client_lecture ON public.appointments
    FOR SELECT TO authenticated
    USING (client_id = auth.uid() OR lower(client_email) = public.rgb_email_session());
CREATE POLICY dossiers_client_lecture ON public.dossiers
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ── Contrôle final : ce que voit la clé ANONYME (tout doit valoir 0) ────────
SET ROLE anon;
SELECT 'email_logs' AS table_, count(*) AS lignes_visibles_anon FROM public.email_logs
UNION ALL SELECT 'paiements_manuels',        count(*) FROM public.paiements_manuels
UNION ALL SELECT 'nationality_applications', count(*) FROM public.nationality_applications
UNION ALL SELECT 'documents_financiers',     count(*) FROM public.documents_financiers
UNION ALL SELECT 'orders',                   count(*) FROM public.orders
UNION ALL SELECT 'dossier_tracking',         count(*) FROM public.dossier_tracking
UNION ALL SELECT 'messages',                 count(*) FROM public.messages
UNION ALL SELECT 'chat_messages',            count(*) FROM public.chat_messages
UNION ALL SELECT 'eligibility_results',      count(*) FROM public.eligibility_results
UNION ALL SELECT 'client_documents',         count(*) FROM public.client_documents
UNION ALL SELECT 'contracts',                count(*) FROM public.contracts
UNION ALL SELECT 'client_notifications',     count(*) FROM public.client_notifications
UNION ALL SELECT 'rdv_requests',             count(*) FROM public.rdv_requests
UNION ALL SELECT 'notifications',            count(*) FROM public.notifications
UNION ALL SELECT 'client_profiles',          count(*) FROM public.client_profiles
UNION ALL SELECT 'calls',                    count(*) FROM public.calls
UNION ALL SELECT 'appointments',             count(*) FROM public.appointments
UNION ALL SELECT 'dossiers',                 count(*) FROM public.dossiers;
RESET ROLE;
