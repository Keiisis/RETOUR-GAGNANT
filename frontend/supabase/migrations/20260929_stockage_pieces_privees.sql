-- ════════════════════════════════════════════════════════════════════════════
--  Pièces d'identité : lecture réservée au propriétaire et à l'équipe (29/09/2026)
--
--  1. `dossier-documents` (dépôts de l'app mobile) : la règle `dossier_docs_read`
--     autorisait TOUT utilisateur connecté à lire TOUT le bucket → n'importe quel
--     client pouvait télécharger les pièces des autres. Le mobile dépose sous
--     `<uid>/<dossier>/<fichier>` : lecture/dépôt limités à son propre dossier
--     (1er segment = auth.uid()) ; équipe : tout.
--  2. `agent-documents` (dépôts des agents : passeports…) était PUBLIC → privé,
--     accès équipe seulement. La page agent génère désormais un lien signé
--     de 5 minutes à la demande (déployé avant cette migration).
--
--  Prérequis : fonction public.rgb_est_equipe() (migration 20260926).
--  Idempotent. SQL Editor Supabase.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. dossier-documents ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dossier_docs_read"   ON storage.objects;
DROP POLICY IF EXISTS "dossier_docs_upload" ON storage.objects;
DROP POLICY IF EXISTS "dossier_docs_proprietaire_lecture" ON storage.objects;
DROP POLICY IF EXISTS "dossier_docs_proprietaire_depot"   ON storage.objects;
DROP POLICY IF EXISTS "dossier_docs_proprietaire_retrait" ON storage.objects;
DROP POLICY IF EXISTS "dossier_docs_equipe" ON storage.objects;

CREATE POLICY "dossier_docs_proprietaire_lecture" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dossier_docs_proprietaire_depot" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Retrait de son propre fichier (l'app supprime le fichier si l'inscription en base échoue).
CREATE POLICY "dossier_docs_proprietaire_retrait" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'dossier-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dossier_docs_equipe" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'dossier-documents' AND public.rgb_est_equipe())
    WITH CHECK (bucket_id = 'dossier-documents' AND public.rgb_est_equipe());

-- ── 2. agent-documents ──────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'agent-documents';

DO $$
DECLARE r record;
BEGIN
    -- Toute règle existante qui mentionne ce bucket est remplacée.
    FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND (coalesce(qual, '') ILIKE '%agent-documents%' OR coalesce(with_check, '') ILIKE '%agent-documents%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "agent_docs_equipe" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'agent-documents' AND public.rgb_est_equipe())
    WITH CHECK (bucket_id = 'agent-documents' AND public.rgb_est_equipe());

-- ── Contrôle : doit renvoyer public = false pour agent-documents ────────────
SELECT id, public FROM storage.buckets WHERE id IN ('agent-documents', 'dossier-documents');
