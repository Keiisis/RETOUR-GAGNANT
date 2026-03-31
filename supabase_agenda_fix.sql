-- ============================================================
-- MIGRATION : Fix agenda agent + RDV system
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── 1. Table agent_events (manquante) ──────────────────────
CREATE TABLE IF NOT EXISTS public.agent_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    description TEXT,
    date        DATE        NOT NULL,
    time        TEXT        NOT NULL DEFAULT '09:00',
    type        TEXT        NOT NULL DEFAULT 'rdv_client',
    client      TEXT,
    location    TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_agent_id ON public.agent_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_date ON public.agent_events(date);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'agent_events' AND policyname = 'agent_manage_own_events'
    ) THEN
        CREATE POLICY "agent_manage_own_events" ON public.agent_events
            FOR ALL
            USING (agent_id = auth.uid())
            WITH CHECK (agent_id = auth.uid());
    END IF;
END $$;


-- ─── 2. Politiques RLS agents sur rdv_requests ─────────────
-- Les agents sont des utilisateurs authentifiés qui ne sont PAS
-- dans client_profiles (seuls les clients y sont enregistrés).

DO $$
BEGIN
    -- Lecture : agents voient tous les RDV
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rdv_requests' AND policyname = 'agent_read_all_rdv'
    ) THEN
        CREATE POLICY "agent_read_all_rdv" ON public.rdv_requests
            FOR SELECT USING (
                NOT EXISTS (
                    SELECT 1 FROM public.client_profiles WHERE id = auth.uid()
                )
            );
    END IF;

    -- Mise à jour : agents peuvent changer le statut
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'rdv_requests' AND policyname = 'agent_update_all_rdv'
    ) THEN
        CREATE POLICY "agent_update_all_rdv" ON public.rdv_requests
            FOR UPDATE
            USING (
                NOT EXISTS (
                    SELECT 1 FROM public.client_profiles WHERE id = auth.uid()
                )
            )
            WITH CHECK (
                NOT EXISTS (
                    SELECT 1 FROM public.client_profiles WHERE id = auth.uid()
                )
            );
    END IF;
END $$;


-- ─── 3. Rendre date nullable dans rdv_requests ──────────────
-- Le formulaire public peut ne pas avoir de date précise.
ALTER TABLE public.rdv_requests ALTER COLUMN date DROP NOT NULL;


-- ─── Vérification ───────────────────────────────────────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('rdv_requests', 'agent_events')
ORDER BY tablename, policyname;
