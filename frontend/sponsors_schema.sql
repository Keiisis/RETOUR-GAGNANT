-- =====================================================
-- SCHEMA SPONSORS / PARTENAIRES INSTITUTIONNELS
-- Section "Ils nous font confiance" — page d'accueil
-- À exécuter dans Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sponsors (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL,
    logo_url    TEXT,
    website_url TEXT,
    sort_order  INTEGER DEFAULT 0,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Index pour tri et filtrage
CREATE INDEX IF NOT EXISTS idx_sponsors_sort    ON public.sponsors(sort_order);
CREATE INDEX IF NOT EXISTS idx_sponsors_active  ON public.sponsors(is_active);

-- Trigger updated_at (réutilise la fonction existante si disponible)
CREATE OR REPLACE FUNCTION update_sponsors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER sponsors_updated_at
    BEFORE UPDATE ON public.sponsors
    FOR EACH ROW EXECUTE FUNCTION update_sponsors_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors_public_read"  ON public.sponsors;
DROP POLICY IF EXISTS "sponsors_service_all"  ON public.sponsors;

-- Lecture publique des sponsors actifs
CREATE POLICY "sponsors_public_read" ON public.sponsors
    FOR SELECT USING (is_active = TRUE);

-- Service role : accès complet (API server-side)
CREATE POLICY "sponsors_service_all" ON public.sponsors
    FOR ALL USING (auth.role() = 'service_role');

-- ─── DONNÉES INITIALES ───────────────────────────────────────────────────────
INSERT INTO public.sponsors (name, sort_order, is_active) VALUES
    ('Gouvernement du Bénin', 0, TRUE),
    ('APIEX',                 1, TRUE),
    ('Chambre de Commerce',   2, TRUE),
    ('Ambassade de France',   3, TRUE),
    ('Diaspora Connect',      4, TRUE)
ON CONFLICT DO NOTHING;
