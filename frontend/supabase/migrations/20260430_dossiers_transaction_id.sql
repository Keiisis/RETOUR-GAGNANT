-- ════════════════════════════════════════════════════════════════════════════
-- dossiers : ajout transaction_id pour tracer le paiement Kkiapay
-- Utilisé par /api/mobile/dossiers POST pour anti-fraude
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.dossiers
    ADD COLUMN IF NOT EXISTS transaction_id  TEXT,
    ADD COLUMN IF NOT EXISTS payment_method  TEXT DEFAULT 'kkiapay',
    ADD COLUMN IF NOT EXISTS payment_amount  NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'XOF';

CREATE INDEX IF NOT EXISTS dossiers_transaction_id_idx
    ON public.dossiers (transaction_id)
    WHERE transaction_id IS NOT NULL;

COMMENT ON COLUMN public.dossiers.transaction_id IS 'Référence paiement Kkiapay (vérifiée côté serveur)';
