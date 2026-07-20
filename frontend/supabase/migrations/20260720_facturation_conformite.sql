-- ══════════════════════════════════════════════════════════════
--  CONFORMITÉ FACTURATION — OHADA / DGI Bénin
--  1) Numérotation séquentielle atomique (par type et par année)
--  2) Avoirs / notes de crédit
--  3) Certification fiscale e-MCF / MECeF (DGI Bénin) + IFU client
--  À exécuter dans Supabase Studio > SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ── 1. COMPTEUR SÉQUENTIEL ─────────────────────────────────────
-- Une ligne par (type de document, année). Incrément 100 % atomique
-- via INSERT … ON CONFLICT DO UPDATE RETURNING (verrou de ligne
-- Postgres) : aucune collision ni doublon possible, même sous
-- créations concurrentes (webhook + création manuelle simultanées).
CREATE TABLE IF NOT EXISTS document_counters (
    doc_type    TEXT    NOT NULL,           -- 'facture' | 'devis' | 'avoir'
    year        INT     NOT NULL,
    last_number INT     NOT NULL DEFAULT 0,
    PRIMARY KEY (doc_type, year)
);

ALTER TABLE document_counters ENABLE ROW LEVEL SECURITY;
-- Aucune policy : accès direct interdit. Seule la fonction
-- SECURITY DEFINER ci-dessous peut incrémenter le compteur.

CREATE OR REPLACE FUNCTION next_document_number(p_type TEXT, p_year INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_num INT;
BEGIN
    INSERT INTO document_counters (doc_type, year, last_number)
    VALUES (p_type, p_year, 1)
    ON CONFLICT (doc_type, year)
    DO UPDATE SET last_number = document_counters.last_number + 1
    RETURNING last_number INTO v_num;
    RETURN v_num;
END;
$$;

-- ── 2. AVOIRS / NOTES DE CRÉDIT ────────────────────────────────
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS avoir_de_facture_id UUID REFERENCES documents_financiers(id) ON DELETE SET NULL;
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS motif_avoir         TEXT;

-- ── 3. CERTIFICATION e-MCF / MECeF (DGI Bénin) + IFU client ────
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS client_ifu      TEXT;
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS mecef_nim       TEXT;          -- Numéro d'Identification de la Machine
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS mecef_code      TEXT;          -- Code de contrôle / signature MECeF
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS mecef_counters  TEXT;          -- Compteurs (ex : "125/340 FV")
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS mecef_datetime  TIMESTAMPTZ;   -- Horodatage de certification
ALTER TABLE documents_financiers ADD COLUMN IF NOT EXISTS mecef_qr        TEXT;          -- Contenu encodé dans le QR (URL de vérification DGI)

CREATE INDEX IF NOT EXISTS documents_financiers_avoir_idx ON documents_financiers(avoir_de_facture_id);
