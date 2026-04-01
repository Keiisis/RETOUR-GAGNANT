-- ══════════════════════════════════════════════════════════════
-- MIGRATION ERP — Tables manquantes
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Table depenses (gestion des charges par agent) ──────────
CREATE TABLE IF NOT EXISTS public.depenses (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    titre         TEXT        NOT NULL,
    categorie     TEXT        NOT NULL DEFAULT 'operationnel',
    montant       NUMERIC     NOT NULL DEFAULT 0,
    date_depense  TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour queries par agent et par date
CREATE INDEX IF NOT EXISTS depenses_agent_id_idx ON public.depenses(agent_id);
CREATE INDEX IF NOT EXISTS depenses_date_idx     ON public.depenses(date_depense DESC);

-- RLS : agent voit ses dépenses, admin/superadmin voient tout
ALTER TABLE public.depenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_own_depenses"    ON public.depenses;
DROP POLICY IF EXISTS "admin_all_depenses"     ON public.depenses;
DROP POLICY IF EXISTS "service_role_depenses"  ON public.depenses;

CREATE POLICY "agents_own_depenses" ON public.depenses
    FOR ALL TO authenticated
    USING (
        agent_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin')
        )
    );

-- Le service role key bypass toujours RLS
CREATE POLICY "service_role_depenses" ON public.depenses
    FOR ALL TO service_role
    USING (true);

-- ── 2. Clé commission_rate dans settings ──────────────────────
-- Insère la clé si elle n'existe pas encore
INSERT INTO public.settings (key, value, category)
VALUES ('commission_rate', '0.10', 'comptabilite')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Vérification finale ────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('depenses', 'documents_financiers', 'orders', 'settings');
