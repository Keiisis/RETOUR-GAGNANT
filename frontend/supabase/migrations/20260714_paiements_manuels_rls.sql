-- ══════════════════════════════════════════════════════════════
-- MIGRATION — Politiques RLS pour paiements_manuels
-- 
-- PROBLÈME : la table paiements_manuels a RLS activé mais aucune
-- politique n'autorise les agents authentifiés à insérer/lire
-- leurs propres paiements. Résultat : "new row violates row-level
-- security policy" quand un agent enregistre un paiement depuis
-- /agent/comptabilite.
--
-- SOLUTION : Ajouter des politiques RLS identiques au pattern
-- utilisé pour la table depenses (20260401_erp_missing_tables.sql).
--
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. S'assurer que RLS est activé ─────────────────────────
ALTER TABLE public.paiements_manuels ENABLE ROW LEVEL SECURITY;

-- ── 2. Supprimer les anciennes politiques si elles existent ──
DROP POLICY IF EXISTS "agents_own_paiements_manuels" ON public.paiements_manuels;
DROP POLICY IF EXISTS "admin_all_paiements_manuels"  ON public.paiements_manuels;
DROP POLICY IF EXISTS "service_role_paiements_manuels" ON public.paiements_manuels;

-- ── 3. Politique agents : CRUD sur ses propres paiements ─────
-- Un agent authentifié peut SELECT / INSERT / UPDATE / DELETE
-- les paiements dont il est l'agent_id.
-- Les admins/super_admins/ceo peuvent tout voir/modifier.
CREATE POLICY "agents_own_paiements_manuels" ON public.paiements_manuels
    FOR ALL TO authenticated
    USING (
        agent_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
        )
    )
    WITH CHECK (
        agent_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'super_admin', 'superadmin', 'ceo')
        )
    );

-- ── 4. Politique service_role : bypass total ─────────────────
-- Les routes API Next.js qui utilisent SUPABASE_SERVICE_ROLE_KEY
-- ne sont pas affectées, mais cette politique explicite est une
-- bonne pratique pour la documentation.
CREATE POLICY "service_role_paiements_manuels" ON public.paiements_manuels
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- ── 5. S'assurer que document_id est bien nullable ───────────
-- (déjà fait dans 20260415_paiements_externes.sql mais on sécurise)
DO $$
BEGIN
    -- Vérifie si la colonne est NOT NULL et la rend nullable si besoin
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'paiements_manuels'
        AND column_name = 'document_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE public.paiements_manuels ALTER COLUMN document_id DROP NOT NULL;
        RAISE NOTICE 'document_id rendu nullable';
    ELSE
        RAISE NOTICE 'document_id est déjà nullable — rien à faire';
    END IF;
END $$;

-- ── 6. Vérification ──────────────────────────────────────────
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'paiements_manuels';
