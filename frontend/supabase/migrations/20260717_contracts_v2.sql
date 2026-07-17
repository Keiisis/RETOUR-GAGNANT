-- ══════════════════════════════════════════════════════════════
--  CONTRATS v2 — traçabilité totale + signature en ligne
--  À exécuter dans Supabase Studio > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Nouvelles colonnes
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS serial            TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sign_token        TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_name       TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signed_ip         TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signature_method  TEXT;          -- 'en_ligne' | 'manuel'
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS audit_log         JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ;

-- 2. Backfill : numéro de série + token pour les contrats existants
UPDATE contracts
SET serial = 'CTR-' || to_char(created_at, 'YYYYMM') || '-' || upper(substr(md5(id::text), 1, 4))
WHERE serial IS NULL;

UPDATE contracts
SET sign_token = encode(gen_random_bytes(24), 'hex')
WHERE sign_token IS NULL;

-- 3. Unicité + index
CREATE UNIQUE INDEX IF NOT EXISTS contracts_serial_key     ON contracts (serial);
CREATE UNIQUE INDEX IF NOT EXISTS contracts_sign_token_key ON contracts (sign_token);
CREATE INDEX IF NOT EXISTS contracts_client_email_idx      ON contracts (client_email);

-- 4. IMMUTABILITÉ : numéro de série + données d'émission verrouillés en base
--    (même le service role ne peut pas les modifier après création)
CREATE OR REPLACE FUNCTION protect_contract_immutables()
RETURNS TRIGGER AS $$
BEGIN
    NEW.serial      := OLD.serial;
    NEW.created_at  := OLD.created_at;
    NEW.agent_name  := OLD.agent_name;
    NEW.sign_token  := OLD.sign_token;
    NEW.updated_at  := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_protect_immutables ON contracts;
CREATE TRIGGER contracts_protect_immutables
    BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION protect_contract_immutables();
