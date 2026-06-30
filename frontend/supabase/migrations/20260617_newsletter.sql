-- ═══════════════════════════════════════════════════════════════
-- NEWSLETTER — Abonnés + Campagnes (système fonctionnel complet)
-- ═══════════════════════════════════════════════════════════════
-- Avant : la route /api/newsletter écrivait dans une table INEXISTANTE
-- (newsletter_subscribers jamais créée) → l'inscription échouait (500).
-- Et aucun mécanisme d'envoi n'existait. On crée ici les tables + RLS.

-- ── Abonnés ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL UNIQUE,
    status            TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'unsubscribed'
    unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
    source            TEXT DEFAULT 'site',
    subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribed_at   TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Auto-réparation si une version partielle existait
ALTER TABLE public.newsletter_subscribers
    ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS source            TEXT DEFAULT 'site',
    ADD COLUMN IF NOT EXISTS subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS unsubscribed_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at        TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_newsletter_status ON public.newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_token  ON public.newsletter_subscribers(unsubscribe_token);

-- ── Campagnes (historique des envois) ────────────────────────
CREATE TABLE IF NOT EXISTS public.newsletter_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject         TEXT NOT NULL,
    html            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'sent',     -- 'sent' | 'partial' | 'failed'
    recipient_count INTEGER DEFAULT 0,
    sent_count      INTEGER DEFAULT 0,
    failed_count    INTEGER DEFAULT 0,
    sent_by         UUID REFERENCES auth.users(id),
    sent_by_nom     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_date ON public.newsletter_campaigns(created_at DESC);

-- ── RLS : staff lecture/gestion ; écriture publique via service role ──
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_campaigns   ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['newsletter_subscribers', 'newsletter_campaigns'] LOOP
        BEGIN
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO authenticated
                USING (EXISTS (SELECT 1 FROM public.user_profiles
                       WHERE id = auth.uid()
                       AND role IN ('admin','super_admin','superadmin','ceo')));
            $f$, 'staff_' || t, t);
            EXECUTE format($f$
                CREATE POLICY %1$I ON public.%2$I FOR ALL TO service_role USING (true);
            $f$, 'service_' || t, t);
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;
