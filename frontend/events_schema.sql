-- =====================================================
-- SCHEMA ÉVÉNEMENTS — RETOUR GAGNANT BÉNIN
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- 1. TABLE PRINCIPALE : events
CREATE TABLE IF NOT EXISTS public.events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    short_description TEXT,
    location        TEXT,
    location_map_url TEXT,
    start_date      TIMESTAMPTZ NOT NULL,
    end_date        TIMESTAMPTZ,
    price_standard  NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    price_vip       NUMERIC(12, 2) DEFAULT 0 NOT NULL,
    currency        TEXT DEFAULT 'XOF' NOT NULL,
    max_capacity    INTEGER DEFAULT 0,   -- 0 = illimité
    max_vip_seats   INTEGER DEFAULT 0,   -- 0 = illimité
    status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    cover_image_url TEXT,
    category        TEXT DEFAULT 'conference',
    is_featured     BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2. TABLE IMAGES : event_images (galerie illimitée)
CREATE TABLE IF NOT EXISTS public.event_images (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt_text    TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLE INSCRIPTIONS : event_registrations
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT NOT NULL,
    whatsapp        TEXT,
    ticket_type     TEXT DEFAULT 'standard' CHECK (ticket_type IN ('standard', 'vip')),
    amount_paid     NUMERIC(12, 2) DEFAULT 0,
    currency        TEXT DEFAULT 'XOF',
    payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method  TEXT,
    order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLE TICKETS : event_tickets (anti-fraude)
CREATE TABLE IF NOT EXISTS public.event_tickets (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_code     TEXT NOT NULL UNIQUE,   -- RGB-XXXX-YYYYYYYY
    qr_data         TEXT NOT NULL,          -- JSON signé HMAC-SHA256
    ticket_type     TEXT DEFAULT 'standard',
    is_used         BOOLEAN DEFAULT FALSE,
    used_at         TIMESTAMPTZ,
    used_by         TEXT,                   -- nom de l'agent/admin validateur
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEX PERFORMANCE ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_status       ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date   ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_featured     ON public.events(is_featured);
CREATE INDEX IF NOT EXISTS idx_event_images_event  ON public.event_images(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON public.event_registrations(email);
CREATE INDEX IF NOT EXISTS idx_tickets_code        ON public.event_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_reg         ON public.event_tickets(registration_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event       ON public.event_tickets(event_id);

-- ─── TRIGGER updated_at automatique ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER event_registrations_updated_at
    BEFORE UPDATE ON public.event_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tickets       ENABLE ROW LEVEL SECURITY;

-- Supprimer les politiques existantes avant de les recréer (idempotent)
DROP POLICY IF EXISTS "events_public_read"         ON public.events;
DROP POLICY IF EXISTS "events_service_all"         ON public.events;
DROP POLICY IF EXISTS "event_images_service_all"   ON public.event_images;
DROP POLICY IF EXISTS "event_images_public_read"   ON public.event_images;
DROP POLICY IF EXISTS "registrations_service_all"  ON public.event_registrations;
DROP POLICY IF EXISTS "tickets_service_all"        ON public.event_tickets;

-- Lecture publique des événements publiés
CREATE POLICY "events_public_read" ON public.events
    FOR SELECT USING (status = 'published');

-- Service role (API server) : accès complet
CREATE POLICY "events_service_all" ON public.events
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "event_images_service_all" ON public.event_images
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "registrations_service_all" ON public.event_registrations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "tickets_service_all" ON public.event_tickets
    FOR ALL USING (auth.role() = 'service_role');

-- Lecture publique des images (pour la galerie)
CREATE POLICY "event_images_public_read" ON public.event_images
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published')
    );

-- ─── DONNÉES DE TEST (commenter si production) ───────────────────────────────
/*
INSERT INTO public.events (title, slug, description, short_description, location, start_date, price_standard, price_vip, currency, max_capacity, max_vip_seats, status, category, is_featured)
VALUES
(
    'Gala de la Diaspora 2026',
    'gala-diaspora-2026',
    'Le grand rendez-vous annuel de la diaspora béninoise. Une soirée exceptionnelle de networking, de culture et d''opportunités d''affaires.',
    'Le grand rendez-vous annuel de la diaspora béninoise.',
    'Palais des Congrès, Cotonou',
    '2026-06-15 19:00:00+00',
    25000,
    75000,
    'XOF',
    200,
    50,
    'published',
    'gala',
    true
);
*/
