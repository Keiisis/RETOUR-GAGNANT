-- ============================================================
-- RETOUR GAGNANT BÉNIN — Migration Client Space V2
-- Nouvelles fonctionnalités : upload documents, paiement factures
-- Idempotente : peut être ré-exécutée sans erreur
-- ============================================================


-- ─── 0. GUARDS V1 ────────────────────────────────────────────
-- Sécurité : s'assurer que les colonnes V1 existent sur messages et rdv_requests.
-- On utilise des DO blocks pour éviter l'erreur "relation does not exist"
-- si ces tables n'ont pas encore été créées par la migration V1.

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'messages'
    ) THEN
        ALTER TABLE public.messages
            ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL;
        ALTER TABLE public.messages
            ADD COLUMN IF NOT EXISTS lu BOOLEAN DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'rdv_requests'
    ) THEN
        ALTER TABLE public.rdv_requests
            ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;


-- ─── 1. TABLE client_documents ──────────────────────────────
-- Créer la table SANS les colonnes FK pour éviter l'erreur
-- "relation does not exist" si client_profiles/dossier_tracking sont absentes.
-- Les colonnes FK sont ajoutées séparément avec ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.client_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom_fichier     TEXT NOT NULL DEFAULT '',
    type_fichier    TEXT,
    taille          INTEGER,
    url             TEXT NOT NULL DEFAULT '',
    storage_path    TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter client_id (idempotent — silencieux si la colonne existe déjà).
-- C'est ici qu'était le bug : si la table existait sans cette colonne,
-- CREATE TABLE IF NOT EXISTS la sautait et l'index échouait.
ALTER TABLE public.client_documents
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE;

-- Ajouter dossier_id avec FK si dossier_tracking existe, sinon simple UUID
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = 'client_documents'
          AND column_name = 'dossier_id'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'dossier_tracking'
        ) THEN
            ALTER TABLE public.client_documents
                ADD COLUMN dossier_id UUID REFERENCES public.dossier_tracking(id) ON DELETE SET NULL;
        ELSE
            ALTER TABLE public.client_documents
                ADD COLUMN dossier_id UUID;
        END IF;
    END IF;
END $$;

-- Index (client_id et dossier_id existent maintenant dans tous les cas)
CREATE INDEX IF NOT EXISTS idx_client_documents_client_id  ON public.client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_dossier_id ON public.client_documents(dossier_id);

-- RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'client_documents' AND policyname = 'client_select_own_docs'
    ) THEN
        CREATE POLICY "client_select_own_docs" ON public.client_documents
            FOR SELECT USING (auth.uid() = client_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'client_documents' AND policyname = 'client_insert_own_docs'
    ) THEN
        CREATE POLICY "client_insert_own_docs" ON public.client_documents
            FOR INSERT WITH CHECK (auth.uid() = client_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'client_documents' AND policyname = 'client_delete_own_docs'
    ) THEN
        CREATE POLICY "client_delete_own_docs" ON public.client_documents
            FOR DELETE USING (auth.uid() = client_id);
    END IF;
END $$;

-- Agents et admins peuvent voir les fichiers clients
-- (uniquement si la table agent_profiles existe)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'agent_profiles'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'client_documents' AND policyname = 'agent_select_client_docs'
    ) THEN
        CREATE POLICY "agent_select_client_docs" ON public.client_documents
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.agent_profiles
                    WHERE id = auth.uid()
                )
            );
    END IF;
END $$;


-- ─── 2. COLONNES PAIEMENT sur documents_financiers ──────────
-- Traçabilité des paiements réalisés via l'espace client
ALTER TABLE public.documents_financiers
    ADD COLUMN IF NOT EXISTS payment_provider       TEXT,
    ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS paid_at                TIMESTAMPTZ;

-- Index sur paid_at pour les rapports
CREATE INDEX IF NOT EXISTS idx_documents_paid_at ON public.documents_financiers(paid_at)
    WHERE paid_at IS NOT NULL;


-- ─── 3. BUCKET STORAGE client-documents ─────────────────────
-- Bucket privé pour les fichiers uploadés par les clients
-- (max 50 MB par fichier, types acceptés : PDF, images, Word)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'client-documents',
    'client-documents',
    false,
    52428800,  -- 50 MB
    ARRAY[
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO NOTHING;


-- ─── 4. POLICIES STORAGE client-documents ───────────────────
-- Les fichiers sont organisés par chemin : {user_id}/{dossier_id}/{filename}
-- Un client ne peut accéder qu'à ses propres fichiers (préfixe = son user_id)

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'client_upload_own_documents'
    ) THEN
        CREATE POLICY "client_upload_own_documents" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'client-documents'
                AND starts_with(name, auth.uid()::text || '/')
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'client_read_own_documents'
    ) THEN
        CREATE POLICY "client_read_own_documents" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'client-documents'
                AND starts_with(name, auth.uid()::text || '/')
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND policyname = 'client_delete_own_documents'
    ) THEN
        CREATE POLICY "client_delete_own_documents" ON storage.objects
            FOR DELETE TO authenticated
            USING (
                bucket_id = 'client-documents'
                AND starts_with(name, auth.uid()::text || '/')
            );
    END IF;
END $$;


-- ─── 5. REALTIME pour table messages ────────────────────────
-- Activer la réplication realtime sur la table messages
-- (nécessaire pour les notifications en temps réel dans layout.tsx)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'messages'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
END $$;


-- ─── RÉSUMÉ DES MODIFICATIONS ───────────────────────────────
-- Nouvelles tables    : client_documents
-- Nouvelles colonnes  : documents_financiers.(payment_provider, payment_transaction_id, paid_at)
-- Nouveau bucket      : storage.client-documents (privé, 50 MB max)
-- Nouvelles policies  : 4 sur client_documents, 3 sur storage.objects
-- Realtime activé     : table messages
-- ============================================================
