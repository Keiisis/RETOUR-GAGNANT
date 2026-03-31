-- Migration: ajout colonne galerie vitrine partenaires
-- Table: partners

ALTER TABLE partners
    ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Commentaire
COMMENT ON COLUMN partners.gallery IS 'Galerie vitrine du partenaire : [{name: string, image: string}] — max 6 articles';
