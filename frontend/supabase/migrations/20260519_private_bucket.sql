-- ══════════════════════════════════════════════════════════════
-- MIGRATION : Privatisation du bucket dossier-documents
-- ──────────────────────────────────────────────────────────────
-- Avant  : bucket public → les fichiers sont accessibles via URL directe
-- Après  : bucket privé  → SEULES les signed URLs (temporaires) fonctionnent
--
-- ⚠️ Impact : Toute URL publique existante cessera de fonctionner.
--    Les documents sont désormais UNIQUEMENT accessibles via :
--    - createSignedUrl() côté mobile/web (liens 1h)
--    - service_role download dans le CRON de purge
-- ══════════════════════════════════════════════════════════════

-- 1. Rendre le bucket privé
UPDATE storage.buckets
SET public = false
WHERE id = 'dossier-documents';

-- 2. Supprimer la politique de lecture publique (anon)
-- Elle n'est plus nécessaire puisque le bucket est privé
DROP POLICY IF EXISTS "dossier_docs_public_read" ON storage.objects;

-- 3. S'assurer que les utilisateurs authentifiés peuvent toujours lire
-- (nécessaire pour createSignedUrl côté client)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'dossier_docs_read'
    ) THEN
        CREATE POLICY "dossier_docs_read" ON storage.objects
            FOR SELECT TO authenticated
            USING (bucket_id = 'dossier-documents');
    END IF;
END $$;

-- 4. Politique service_role pour le CRON de purge (download + delete)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'dossier_docs_service_role'
    ) THEN
        CREATE POLICY "dossier_docs_service_role" ON storage.objects
            FOR ALL TO service_role
            USING (bucket_id = 'dossier-documents');
    END IF;
END $$;

-- 5. Politique de suppression pour service_role
-- (nécessaire car le CRON supprime les fichiers après archivage email)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'dossier_docs_delete_service'
    ) THEN
        CREATE POLICY "dossier_docs_delete_service" ON storage.objects
            FOR DELETE TO service_role
            USING (bucket_id = 'dossier-documents');
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ═══════════════════════════════════════════════════════════════
SELECT id, name, public AS "Est Public" FROM storage.buckets
WHERE id IN ('dossier-documents', 'avatars', 'client-documents');
