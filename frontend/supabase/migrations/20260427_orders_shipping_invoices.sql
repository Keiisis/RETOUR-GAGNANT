-- ════════════════════════════════════════════════════════════════════════════
-- Mobile e-commerce extensions — shipping address, tracking, invoices index
-- Used by /api/mobile/orders + /api/mobile/invoices + OrderTracking screen.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Orders : shipping address & tracking ─────────────────────────────────
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS shipping_address    TEXT,
    ADD COLUMN IF NOT EXISTS shipping_city       TEXT,
    ADD COLUMN IF NOT EXISTS shipping_postal     TEXT,
    ADD COLUMN IF NOT EXISTS shipping_country    TEXT,
    ADD COLUMN IF NOT EXISTS shipping_notes      TEXT,
    ADD COLUMN IF NOT EXISTS tracking_code       TEXT,
    ADD COLUMN IF NOT EXISTS tracking_carrier    TEXT,
    ADD COLUMN IF NOT EXISTS tracking_url        TEXT,
    ADD COLUMN IF NOT EXISTS shipping_status     TEXT DEFAULT 'pending',
    -- pending | preparing | shipped | in_transit | delivered | failed | returned
    ADD COLUMN IF NOT EXISTS shipped_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS source              TEXT DEFAULT 'web';
    -- 'web' | 'mobile' | 'admin'

-- Index for client-orders listing (most common query)
CREATE INDEX IF NOT EXISTS orders_client_id_idx
    ON public.orders (client_id, created_at DESC);

-- Index for tracking_code search (entered by customer)
CREATE INDEX IF NOT EXISTS orders_tracking_code_idx
    ON public.orders (tracking_code)
    WHERE tracking_code IS NOT NULL;

COMMENT ON COLUMN public.orders.tracking_code IS 'Code de suivi colis (UPS, DHL, Bénin Post, etc.)';
COMMENT ON COLUMN public.orders.shipping_status IS 'pending|preparing|shipped|in_transit|delivered|failed|returned';
COMMENT ON COLUMN public.orders.source IS 'web|mobile|admin — utilisé pour stats & filtrage admin';

-- ── 2. Order tracking events (timeline) ─────────────────────────────────────
-- Each event = one update to the shipping status (préparation, expédition, etc.)
CREATE TABLE IF NOT EXISTS public.order_tracking_events (
    id          BIGSERIAL PRIMARY KEY,
    order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    label       TEXT NOT NULL,
    description TEXT,
    location    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID
);

CREATE INDEX IF NOT EXISTS order_tracking_order_idx
    ON public.order_tracking_events (order_id, created_at DESC);

-- ── 3. Invoices table ───────────────────────────────────────────────────────
-- Used to list a client's invoices (linked to orders + dossiers).
-- The HTML view is generated on-the-fly by /api/invoices/[id], the row here
-- just stores the metadata + reference number.
CREATE TABLE IF NOT EXISTS public.invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_ref     TEXT NOT NULL UNIQUE,
    client_id       UUID,
    order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    dossier_id      UUID,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT,
    customer_phone  TEXT,
    amount          NUMERIC(12, 2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'XOF',
    description     TEXT,
    items           JSONB,                  -- array of line items
    status          TEXT DEFAULT 'paid',    -- paid | pending | cancelled | refunded
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at         TIMESTAMPTZ,
    pdf_url         TEXT,                   -- if stored in Supabase Storage
    sent_to_email   BOOLEAN DEFAULT FALSE,  -- email envoyé au client ?
    signature_id    UUID,                   -- référence à client_signatures.id si appliquée
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_client_idx
    ON public.invoices (client_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS invoices_order_idx
    ON public.invoices (order_id);

-- ── 4. Triggers updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invoices_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.invoices_set_updated_at();

-- ── 5. Auto-créer une invoice quand une order est marquée 'completed' ───────
-- Le déclencheur génère un invoice_ref unique et insère la ligne en facture.
-- Idempotent : si une invoice existe déjà pour cet order, ne fait rien.
CREATE OR REPLACE FUNCTION public.create_invoice_for_completed_order()
RETURNS trigger AS $$
DECLARE
    new_ref TEXT;
    yyyymm  TEXT;
BEGIN
    -- Trigger uniquement quand le statut PASSE à 'completed'
    IF NEW.payment_status = 'completed'
       AND (OLD.payment_status IS DISTINCT FROM 'completed') THEN

        -- Idempotence : pas de doublon si une invoice existe déjà
        IF EXISTS (SELECT 1 FROM public.invoices WHERE order_id = NEW.id) THEN
            RETURN NEW;
        END IF;

        yyyymm := to_char(now(), 'YYYYMM');
        new_ref := 'RGB-' || yyyymm || '-' || lpad(
            ((extract(epoch from now())::bigint) % 100000)::text,
            5, '0'
        );

        INSERT INTO public.invoices (
            invoice_ref, client_id, order_id,
            customer_name, customer_email, customer_phone,
            amount, currency,
            description, items,
            status, paid_at
        ) VALUES (
            new_ref, NEW.client_id, NEW.id,
            NEW.customer_name, NEW.customer_email, NEW.customer_phone,
            NEW.amount, COALESCE(NEW.currency, 'XOF'),
            COALESCE(NEW.product_title, 'Commande boutique #' || left(NEW.id::text, 8)),
            NEW.cart_items,
            'paid', now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_create_invoice_on_order_completion ON public.orders;
CREATE TRIGGER auto_create_invoice_on_order_completion
    AFTER UPDATE OR INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.create_invoice_for_completed_order();

-- ── 6. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

-- Clients see their own invoices
DROP POLICY IF EXISTS "invoices_client_read" ON public.invoices;
CREATE POLICY "invoices_client_read"
    ON public.invoices
    FOR SELECT
    USING (client_id = auth.uid());

-- Clients see tracking events for their own orders
DROP POLICY IF EXISTS "order_tracking_client_read" ON public.order_tracking_events;
CREATE POLICY "order_tracking_client_read"
    ON public.order_tracking_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_tracking_events.order_id
              AND o.client_id = auth.uid()
        )
    );

-- service_role bypasses RLS — used by mobile API routes
