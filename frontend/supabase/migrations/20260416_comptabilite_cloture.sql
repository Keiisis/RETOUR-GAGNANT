-- LOT 3 — Contrôle & conformité comptable
-- Verrou de période (clôture mensuelle) + justificatifs par transaction

-- ═══════════════════════════════════════════════════════════════
-- 1. CLÔTURES MENSUELLES
-- ═══════════════════════════════════════════════════════════════
-- Chaque mois (YYYY-MM) peut être clôturé par un admin/CEO après export.
-- Une fois clôturé, les documents/paiements/dépenses de la période
-- sont verrouillés (read-only) côté UI et côté API.

CREATE TABLE IF NOT EXISTS clotures_mensuelles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periode TEXT NOT NULL UNIQUE,              -- format 'YYYY-MM'
    date_cloture TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cloture_par UUID REFERENCES auth.users(id),
    cloture_par_nom TEXT,
    -- Snapshot comptable au moment de la clôture (figé)
    total_encaisse NUMERIC(15, 2) DEFAULT 0,
    total_depenses NUMERIC(15, 2) DEFAULT 0,
    total_tva NUMERIC(15, 2) DEFAULT 0,
    benefice_net NUMERIC(15, 2) DEFAULT 0,
    nb_documents INT DEFAULT 0,
    nb_paiements INT DEFAULT 0,
    nb_depenses INT DEFAULT 0,
    fichier_export_url TEXT,                   -- URL de l'export Excel archivé
    hash_integrite TEXT,                       -- SHA256 du snapshot (détection altération)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clotures_periode ON clotures_mensuelles(periode);
CREATE INDEX IF NOT EXISTS idx_clotures_date ON clotures_mensuelles(date_cloture DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2. JUSTIFICATIFS (pièces comptables attachées)
-- ═══════════════════════════════════════════════════════════════
-- Un justificatif est lié à UNE et une seule transaction parmi :
-- documents_financiers, paiements_manuels, depenses.
-- Les fichiers sont stockés dans le bucket Supabase "justificatifs-compta".

CREATE TABLE IF NOT EXISTS justificatifs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents_financiers(id) ON DELETE CASCADE,
    paiement_id UUID REFERENCES paiements_manuels(id) ON DELETE CASCADE,
    depense_id UUID REFERENCES depenses(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INT,
    categorie TEXT DEFAULT 'autre',           -- facture_fournisseur | recu | contrat | ticket | releve_bancaire | autre
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_by_nom TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT justificatif_one_entity CHECK (
        (document_id IS NOT NULL)::int +
        (paiement_id IS NOT NULL)::int +
        (depense_id IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_justificatifs_document ON justificatifs(document_id);
CREATE INDEX IF NOT EXISTS idx_justificatifs_paiement ON justificatifs(paiement_id);
CREATE INDEX IF NOT EXISTS idx_justificatifs_depense ON justificatifs(depense_id);
CREATE INDEX IF NOT EXISTS idx_justificatifs_created ON justificatifs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 3. ENABLE RLS + POLICIES (service role bypass, authenticated read)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE clotures_mensuelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE justificatifs ENABLE ROW LEVEL SECURITY;

-- Les clôtures sont lisibles par les utilisateurs authentifiés (staff compta)
DROP POLICY IF EXISTS "clotures_read_authenticated" ON clotures_mensuelles;
CREATE POLICY "clotures_read_authenticated" ON clotures_mensuelles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "justificatifs_read_authenticated" ON justificatifs;
CREATE POLICY "justificatifs_read_authenticated" ON justificatifs
    FOR SELECT TO authenticated USING (true);

-- Les écritures passent TOUJOURS par les API route (service role key),
-- donc pas de policy INSERT/UPDATE/DELETE côté authenticated.

-- ═══════════════════════════════════════════════════════════════
-- 4. TRIGGER — blocage des écritures sur période clôturée
-- ═══════════════════════════════════════════════════════════════
-- Garantit que même une écriture client-side (anon key via RLS) ou
-- manuelle ne peut pas modifier des transactions d'un mois clôturé.

CREATE OR REPLACE FUNCTION check_period_not_locked()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    target_period TEXT;
    is_locked BOOLEAN;
BEGIN
    -- Déterminer la date à vérifier selon la table
    IF TG_TABLE_NAME = 'paiements_manuels' THEN
        target_date := COALESCE(NEW.date_paiement, OLD.date_paiement);
    ELSIF TG_TABLE_NAME = 'depenses' THEN
        target_date := COALESCE(NEW.date_depense, OLD.date_depense);
    ELSIF TG_TABLE_NAME = 'documents_financiers' THEN
        target_date := COALESCE(NEW.created_at::DATE, OLD.created_at::DATE);
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF target_date IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    target_period := TO_CHAR(target_date, 'YYYY-MM');
    SELECT EXISTS(
        SELECT 1 FROM clotures_mensuelles WHERE periode = target_period
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Période comptable % clôturée — écriture refusée', target_period
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_lock_paiements_manuels ON paiements_manuels;
CREATE TRIGGER check_lock_paiements_manuels
    BEFORE INSERT OR UPDATE OR DELETE ON paiements_manuels
    FOR EACH ROW EXECUTE FUNCTION check_period_not_locked();

DROP TRIGGER IF EXISTS check_lock_depenses ON depenses;
CREATE TRIGGER check_lock_depenses
    BEFORE INSERT OR UPDATE OR DELETE ON depenses
    FOR EACH ROW EXECUTE FUNCTION check_period_not_locked();

DROP TRIGGER IF EXISTS check_lock_documents_financiers ON documents_financiers;
CREATE TRIGGER check_lock_documents_financiers
    BEFORE UPDATE OR DELETE ON documents_financiers
    FOR EACH ROW EXECUTE FUNCTION check_period_not_locked();
-- Note: pas de blocage INSERT sur documents_financiers (on veut pouvoir
-- créer un nouveau devis/facture aujourd'hui même si le mois passé est clôturé)
