-- ════════════════════════════════════════════════════════════════════════════
-- 1. MESSAGES — Messagerie client ↔ Équipe RGB
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content         TEXT NOT NULL,
    sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes du mobile
CREATE INDEX IF NOT EXISTS messages_sender_idx   ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages (recipient_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.messages_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_updated_at ON public.messages;
CREATE TRIGGER messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.messages_set_updated_at();

-- RLS : un utilisateur voit uniquement ses messages (envoyés ou reçus)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id OR auth.uid() = recipient_id
    );

DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id
    );

DROP POLICY IF EXISTS "Users can update read status" ON public.messages;
CREATE POLICY "Users can update read status" ON public.messages
    FOR UPDATE USING (
        auth.uid() = recipient_id
    );

-- Realtime : activer pour la table messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. EVENTS — Événements publiés par l'équipe RGB
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    slug              TEXT UNIQUE,
    description       TEXT,
    short_description TEXT,
    start_date        TIMESTAMPTZ NOT NULL,
    end_date          TIMESTAMPTZ,
    location          TEXT NOT NULL DEFAULT '',
    address           TEXT,
    price_standard    INTEGER NOT NULL DEFAULT 0,
    price_vip         INTEGER,
    currency          TEXT NOT NULL DEFAULT 'XOF',
    max_capacity      INTEGER,
    max_vip_seats     INTEGER,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
    is_featured       BOOLEAN NOT NULL DEFAULT false,
    cover_image       TEXT,
    category          TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_status_date_idx ON public.events (status, start_date);

-- Images liées à un événement
CREATE TABLE IF NOT EXISTS public.event_images (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    is_cover    BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inscriptions aux événements
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_type     TEXT NOT NULL DEFAULT 'standard' CHECK (ticket_type IN ('standard', 'vip')),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      INTEGER NOT NULL DEFAULT 0,
    total_amount    INTEGER NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'XOF',
    status          TEXT NOT NULL DEFAULT 'pending_payment'
                    CHECK (status IN ('pending_payment', 'confirmed', 'cancelled', 'refunded')),
    payment_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending', 'paid', 'free', 'refunded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT event_registrations_unique UNIQUE (event_id, client_id)
);

-- RLS pour events : lecture publique, écriture admin
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published events" ON public.events;
CREATE POLICY "Anyone can read published events" ON public.events
    FOR SELECT USING (status = 'published');

-- RLS pour event_registrations : un client lit/crée ses propres inscriptions
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own registrations" ON public.event_registrations;
CREATE POLICY "Users can read own registrations" ON public.event_registrations
    FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Users can insert own registrations" ON public.event_registrations;
CREATE POLICY "Users can insert own registrations" ON public.event_registrations
    FOR INSERT WITH CHECK (auth.uid() = client_id);

-- event_images : lecture publique
ALTER TABLE public.event_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read event images" ON public.event_images;
CREATE POLICY "Anyone can read event images" ON public.event_images
    FOR SELECT USING (true);
