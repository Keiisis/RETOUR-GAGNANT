-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION : Espace Client Authentifié — Retour Gagnant Bénin
-- Date: 2026-03-17
-- Exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Table profils clients ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT        NOT NULL,
    nom        TEXT,
    prenom     TEXT,
    phone      TEXT,
    adresse    TEXT,
    ville      TEXT,
    pays       TEXT        DEFAULT 'France',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_email ON public.client_profiles(email);

-- ─── 2. Colonnes client_id sur documents_financiers ─────────────────
ALTER TABLE public.documents_financiers
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_profiles(id);

CREATE INDEX IF NOT EXISTS idx_docs_client_id ON public.documents_financiers(client_id);
CREATE INDEX IF NOT EXISTS idx_docs_client_email ON public.documents_financiers(client_email);

-- ─── 3. Colonnes client_id sur dossier_tracking ─────────────────────
ALTER TABLE public.dossier_tracking
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_profiles(id);

CREATE INDEX IF NOT EXISTS idx_dossier_client_id ON public.dossier_tracking(client_id);

-- ─── 4. RLS client_profiles ─────────────────────────────────────────
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_profiles' AND policyname = 'client_select_own_profile') THEN
        CREATE POLICY "client_select_own_profile" ON public.client_profiles
            FOR SELECT USING (id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_profiles' AND policyname = 'client_insert_own_profile') THEN
        CREATE POLICY "client_insert_own_profile" ON public.client_profiles
            FOR INSERT WITH CHECK (id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_profiles' AND policyname = 'client_update_own_profile') THEN
        CREATE POLICY "client_update_own_profile" ON public.client_profiles
            FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
    END IF;
END $$;

-- ─── 5. Trigger updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_client_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_client_profiles_updated_at ON public.client_profiles;
CREATE TRIGGER trg_client_profiles_updated_at
    BEFORE UPDATE ON public.client_profiles
    FOR EACH ROW EXECUTE FUNCTION update_client_profiles_updated_at();

-- ─── 6. Politique lecture documents pour clients ─────────────────────
-- IMPORTANT: Vérifier que la table a déjà une politique SELECT existante.
-- Si RLS est activé sur documents_financiers, ajouter la politique client.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'documents_financiers'
    ) THEN
        -- Politique : le client voit ses docs via client_id OU via client_email
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'documents_financiers'
            AND policyname = 'client_read_own_documents'
        ) THEN
            EXECUTE '
                CREATE POLICY "client_read_own_documents" ON public.documents_financiers
                FOR SELECT USING (
                    client_id = auth.uid()
                    OR client_email IN (
                        SELECT email FROM public.client_profiles WHERE id = auth.uid()
                    )
                )
            ';
        END IF;
    END IF;
END $$;

-- ─── 7. Politique lecture dossier pour clients ───────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'dossier_tracking'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'dossier_tracking'
            AND policyname = 'client_read_own_dossier'
        ) THEN
            EXECUTE '
                CREATE POLICY "client_read_own_dossier" ON public.dossier_tracking
                FOR SELECT USING (
                    client_id = auth.uid()
                    OR client_email IN (
                        SELECT email FROM public.client_profiles WHERE id = auth.uid()
                    )
                )
            ';
        END IF;
    END IF;
END $$;

-- ─── 8. Colonne client_id sur messages ──────────────────────────────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages'
    ) THEN
        -- Ajouter client_id si absent
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'client_id'
        ) THEN
            EXECUTE 'ALTER TABLE public.messages ADD COLUMN client_id UUID REFERENCES public.client_profiles(id)';
            EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_client_id ON public.messages(client_id)';
        END IF;

        -- Politique lecture : client voit ses messages via client_id OU email
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'messages' AND policyname = 'client_read_own_messages'
        ) THEN
            EXECUTE '
                CREATE POLICY "client_read_own_messages" ON public.messages
                FOR SELECT USING (
                    client_id = auth.uid()
                    OR email IN (
                        SELECT email FROM public.client_profiles WHERE id = auth.uid()
                    )
                )
            ';
        END IF;

        -- Politique insertion : client peut insérer ses messages
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'messages' AND policyname = 'client_insert_own_messages'
        ) THEN
            EXECUTE '
                CREATE POLICY "client_insert_own_messages" ON public.messages
                FOR INSERT WITH CHECK (
                    client_id = auth.uid()
                    OR email IN (
                        SELECT email FROM public.client_profiles WHERE id = auth.uid()
                    )
                )
            ';
        END IF;
    END IF;
END $$;

-- ─── 9. Table rdv_requests (créer si absente) + RLS ─────────────────
CREATE TABLE IF NOT EXISTS public.rdv_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id    UUID        REFERENCES public.client_profiles(id),
    client_email TEXT        NOT NULL,
    date         DATE        NOT NULL,
    heure        TIME        NOT NULL,
    type         TEXT        NOT NULL DEFAULT 'visio',
    motif        TEXT        NOT NULL,
    notes        TEXT,
    statut       TEXT        NOT NULL DEFAULT 'en_attente',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rdv_client_id    ON public.rdv_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_rdv_client_email ON public.rdv_requests(client_email);

ALTER TABLE public.rdv_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rdv_requests' AND policyname = 'client_read_own_rdv') THEN
        CREATE POLICY "client_read_own_rdv" ON public.rdv_requests
            FOR SELECT USING (
                client_id = auth.uid()
                OR client_email IN (SELECT email FROM public.client_profiles WHERE id = auth.uid())
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rdv_requests' AND policyname = 'client_insert_own_rdv') THEN
        CREATE POLICY "client_insert_own_rdv" ON public.rdv_requests
            FOR INSERT WITH CHECK (
                client_id = auth.uid()
                OR client_email IN (SELECT email FROM public.client_profiles WHERE id = auth.uid())
            );
    END IF;
END $$;

-- ─── 10. Backfill client_id sur messages et rdv_requests existants ──
DO $$
BEGIN
    -- Backfill messages
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        UPDATE public.messages m
        SET client_id = cp.id
        FROM public.client_profiles cp
        WHERE m.email = cp.email
          AND m.client_id IS NULL;
    END IF;

    -- Backfill rdv_requests
    UPDATE public.rdv_requests r
    SET client_id = cp.id
    FROM public.client_profiles cp
    WHERE r.client_email = cp.email
      AND r.client_id IS NULL;
END $$;

SELECT 'Migration Espace Client OK ✅' AS status;
