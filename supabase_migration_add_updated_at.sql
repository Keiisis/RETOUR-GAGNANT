-- ============================================================================
-- MIGRATION: Add updated_at column to tables missing it
-- Tables affected: testimonials, messages, eligibility_results, services,
--                  orders, gallery
-- ============================================================================

-- ─── 1. TESTIMONIALS ────────────────────────────────────────────────────────
ALTER TABLE public.testimonials
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows
UPDATE public.testimonials SET updated_at = created_at WHERE updated_at IS NULL;

-- ─── 2. MESSAGES ─────────────────────────────────────────────────────────────
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.messages SET updated_at = created_at WHERE updated_at IS NULL;

-- ─── 3. ELIGIBILITY_RESULTS (leads) ─────────────────────────────────────────
ALTER TABLE public.eligibility_results
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.eligibility_results SET updated_at = created_at WHERE updated_at IS NULL;

-- ─── 4. SERVICES ─────────────────────────────────────────────────────────────
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.services SET updated_at = created_at WHERE updated_at IS NULL;

-- ─── 5. ORDERS ───────────────────────────────────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.orders SET updated_at = created_at WHERE updated_at IS NULL;

-- ─── 6. GALLERY ──────────────────────────────────────────────────────────────
ALTER TABLE public.gallery
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.gallery SET updated_at = created_at WHERE updated_at IS NULL;


-- ─── 7. AUTO-UPDATE TRIGGER FUNCTION (shared) ───────────────────────────────
-- Réutilise ou crée une fonction générique pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─── 8. TRIGGERS ─────────────────────────────────────────────────────────────

-- testimonials
DROP TRIGGER IF EXISTS trg_testimonials_updated_at ON public.testimonials;
CREATE TRIGGER trg_testimonials_updated_at
    BEFORE UPDATE ON public.testimonials
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- messages
DROP TRIGGER IF EXISTS trg_messages_updated_at ON public.messages;
CREATE TRIGGER trg_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- eligibility_results
DROP TRIGGER IF EXISTS trg_eligibility_results_updated_at ON public.eligibility_results;
CREATE TRIGGER trg_eligibility_results_updated_at
    BEFORE UPDATE ON public.eligibility_results
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- services
DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
CREATE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- gallery
DROP TRIGGER IF EXISTS trg_gallery_updated_at ON public.gallery;
CREATE TRIGGER trg_gallery_updated_at
    BEFORE UPDATE ON public.gallery
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- DONE. Reload the Supabase schema cache after running this migration.
-- In Supabase Dashboard: Settings > API > Reload schema cache
-- ============================================================================
