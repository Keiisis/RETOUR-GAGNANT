-- Migration: ajout colonnes suivi de relance paniers abandonnés
-- Table: orders

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS recovery_emails_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_recovery_at timestamptz DEFAULT NULL;

-- Index pour les requêtes du cron cart-recovery
CREATE INDEX IF NOT EXISTS idx_orders_recovery
    ON orders (payment_status, customer_email, created_at, recovery_emails_count)
    WHERE payment_status = 'pending' AND customer_email IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN orders.recovery_emails_count IS 'Nombre d''emails de relance panier abandonné envoyés (max 3)';
COMMENT ON COLUMN orders.last_recovery_at IS 'Date du dernier email de relance envoyé';
