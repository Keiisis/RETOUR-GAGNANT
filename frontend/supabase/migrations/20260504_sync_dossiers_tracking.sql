-- ============================================================
-- SYNC : dossiers ↔ dossier_tracking  +  avatars + documents
-- Bidirectional sync so mobile (dossiers) and agents (dossier_tracking)
-- always stay in sync. Also adds avatar_type column and ensures
-- dossier_documents table exists with proper agent read access.
-- ============================================================

-- ─── 1. Ensure "dossiers" table has all needed columns ──────
ALTER TABLE public.dossiers
    ADD COLUMN IF NOT EXISTS service_id      UUID,
    ADD COLUMN IF NOT EXISTS payment_method   TEXT,
    ADD COLUMN IF NOT EXISTS transaction_id   TEXT;

-- ─── 2. Ensure "dossier_tracking" mirrors dossiers structure ─
-- If dossier_tracking doesn't have client_id or service_type...
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
    ) THEN
        ALTER TABLE public.dossier_tracking
            ADD COLUMN IF NOT EXISTS client_id      UUID,
            ADD COLUMN IF NOT EXISTS service_type    TEXT,
            ADD COLUMN IF NOT EXISTS service_id      UUID,
            ADD COLUMN IF NOT EXISTS dossier_ref_id  UUID,
            ADD COLUMN IF NOT EXISTS payment_method  TEXT,
            ADD COLUMN IF NOT EXISTS transaction_id  TEXT;

        CREATE INDEX IF NOT EXISTS idx_dt_dossier_ref ON public.dossier_tracking(dossier_ref_id);
    END IF;
END $$;

-- ─── 3. Trigger : dossiers INSERT → auto-create in dossier_tracking ──
CREATE OR REPLACE FUNCTION sync_dossier_to_tracking()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
    ) THEN
        INSERT INTO public.dossier_tracking (
            id, client_id, service_type, statut, progression,
            notes, created_at, updated_at, dossier_ref_id,
            client_email, client_nom, client_prenom, client_phone,
            num_dossier
        )
        SELECT
            gen_random_uuid(),
            NEW.client_id,
            NEW.service_type,
            CASE NEW.status
                WHEN 'soumis' THEN 'reception'
                WHEN 'en_attente' THEN 'reception'
                WHEN 'verifie' THEN 'verification'
                WHEN 'en_cours' THEN 'traitement'
                WHEN 'traitement' THEN 'traitement'
                WHEN 'validation' THEN 'validation'
                WHEN 'termine' THEN 'termine'
                ELSE 'reception'
            END,
            NEW.progress,
            NEW.notes,
            NEW.created_at,
            NOW(),
            NEW.id,
            cp.email,
            cp.nom,
            cp.prenom,
            cp.phone,
            'RG-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0')
        FROM public.client_profiles cp
        WHERE cp.id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_dossier_to_tracking ON public.dossiers;
CREATE TRIGGER trg_sync_dossier_to_tracking
    AFTER INSERT ON public.dossiers
    FOR EACH ROW EXECUTE FUNCTION sync_dossier_to_tracking();

-- ─── 4. Trigger : dossier_tracking UPDATE → sync back to dossiers ──
CREATE OR REPLACE FUNCTION sync_tracking_to_dossier()
RETURNS TRIGGER AS $$
DECLARE
    mapped_status TEXT;
BEGIN
    IF NEW.dossier_ref_id IS NOT NULL THEN
        mapped_status := CASE NEW.statut
            WHEN 'reception' THEN 'soumis'
            WHEN 'verification' THEN 'verifie'
            WHEN 'traitement' THEN 'traitement'
            WHEN 'validation' THEN 'validation'
            WHEN 'finalisation' THEN 'validation'
            WHEN 'termine' THEN 'termine'
            ELSE NEW.statut
        END;

        UPDATE public.dossiers
        SET status     = mapped_status,
            progress   = NEW.progression,
            notes      = COALESCE(NEW.notes, notes),
            updated_at = NOW()
        WHERE id = NEW.dossier_ref_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
    ) THEN
        DROP TRIGGER IF EXISTS trg_sync_tracking_to_dossier ON public.dossier_tracking;
        CREATE TRIGGER trg_sync_tracking_to_dossier
            AFTER UPDATE ON public.dossier_tracking
            FOR EACH ROW EXECUTE FUNCTION sync_tracking_to_dossier();
    END IF;
END $$;

-- ─── 5. Backfill existing dossiers → dossier_tracking ──────
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
    ) THEN
        INSERT INTO public.dossier_tracking (
            id, client_id, service_type, statut, progression,
            notes, created_at, updated_at, dossier_ref_id,
            client_email, client_nom, client_prenom, client_phone,
            num_dossier
        )
        SELECT
            gen_random_uuid(),
            d.client_id,
            d.service_type,
            CASE d.status
                WHEN 'soumis' THEN 'reception'
                WHEN 'en_attente' THEN 'reception'
                WHEN 'verifie' THEN 'verification'
                WHEN 'en_cours' THEN 'traitement'
                WHEN 'traitement' THEN 'traitement'
                WHEN 'validation' THEN 'validation'
                WHEN 'termine' THEN 'termine'
                ELSE 'reception'
            END,
            d.progress,
            d.notes,
            d.created_at,
            NOW(),
            d.id,
            cp.email,
            cp.nom,
            cp.prenom,
            cp.phone,
            'RG-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0')
        FROM public.dossiers d
        LEFT JOIN public.client_profiles cp ON cp.id = d.client_id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.dossier_tracking dt
            WHERE dt.dossier_ref_id = d.id
        );
    END IF;
END $$;

-- ─── 6. Ensure dossier_documents table exists ──────────────
CREATE TABLE IF NOT EXISTS public.dossier_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id  UUID NOT NULL,
    client_id   UUID,
    file_name   TEXT NOT NULL,
    file_url    TEXT,
    file_type   TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dossier_docs_dossier ON public.dossier_documents(dossier_id);
CREATE INDEX IF NOT EXISTS idx_dossier_docs_client  ON public.dossier_documents(client_id);

ALTER TABLE public.dossier_documents ENABLE ROW LEVEL SECURITY;

-- Client can see/insert their own docs
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dossier_documents' AND policyname = 'client_select_own_dossier_docs'
    ) THEN
        CREATE POLICY "client_select_own_dossier_docs" ON public.dossier_documents
            FOR SELECT USING (client_id = auth.uid());
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'dossier_documents' AND policyname = 'client_insert_own_dossier_docs'
    ) THEN
        CREATE POLICY "client_insert_own_dossier_docs" ON public.dossier_documents
            FOR INSERT WITH CHECK (client_id = auth.uid());
    END IF;
END $$;

-- Agents can see and update all docs
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_profiles'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'dossier_documents' AND policyname = 'agent_select_all_dossier_docs'
        ) THEN
            CREATE POLICY "agent_select_all_dossier_docs" ON public.dossier_documents
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles 
                        WHERE id = auth.uid() AND role IN ('agent', 'admin', 'superadmin')
                    )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'dossier_documents' AND policyname = 'agent_update_all_dossier_docs'
        ) THEN
            CREATE POLICY "agent_update_all_dossier_docs" ON public.dossier_documents
                FOR UPDATE USING (
                    EXISTS (
                        SELECT 1 FROM public.user_profiles 
                        WHERE id = auth.uid() AND role IN ('agent', 'admin', 'superadmin')
                    )
                );
        END IF;
    END IF;
END $$;

-- ─── 7. Storage bucket for dossier documents ───────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dossier-documents',
    'dossier-documents',
    true,
    52428800,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for dossier-documents
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'dossier_docs_upload'
    ) THEN
        CREATE POLICY "dossier_docs_upload" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'dossier-documents');
    END IF;
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

-- ─── 8. Avatar type column on client_profiles ──────────────
ALTER TABLE public.client_profiles
    ADD COLUMN IF NOT EXISTS avatar_type     TEXT DEFAULT 'initials',
    ADD COLUMN IF NOT EXISTS avatar_preset   TEXT,
    ADD COLUMN IF NOT EXISTS genre           TEXT;

-- ─── 9. Avatars storage bucket ────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    10485760,
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'avatars_upload'
    ) THEN
        CREATE POLICY "avatars_upload" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'avatars');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'avatars_read_public'
    ) THEN
        CREATE POLICY "avatars_read_public" ON storage.objects
            FOR SELECT USING (bucket_id = 'avatars');
    END IF;
END $$;

-- ─── 10. Enable realtime on dossiers + dossier_documents + dossier_tracking ──
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'dossiers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dossiers;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'dossier_documents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dossier_documents;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'dossier_tracking'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dossier_tracking;
    END IF;
END $$;

-- ─── RÉSUMÉ ──────────────────────────────────────────────
-- Triggers : dossiers INSERT → dossier_tracking, dossier_tracking UPDATE → dossiers
-- Tables   : dossier_documents (with RLS), client_profiles (avatar columns)
-- Buckets  : dossier-documents, avatars
-- Realtime : dossiers, dossier_documents, dossier_tracking
-- ============================================================
