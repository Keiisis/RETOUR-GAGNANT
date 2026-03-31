-- Migration : nouvelles colonnes pour le suivi des documents manquants (Nationalité)
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Colonnes de suivi des documents manquants
ALTER TABLE nationality_applications
    ADD COLUMN IF NOT EXISTS docs_deadline          timestamptz,
    ADD COLUMN IF NOT EXISTS missing_docs           jsonb,
    ADD COLUMN IF NOT EXISTS needs_recherche_ancestrale boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS recherche_ancestrale_paid  boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS recherche_ancestrale_ref   text,
    ADD COLUMN IF NOT EXISTS last_reminder_week         int DEFAULT 0;

-- 2. Index pour le cron (recherche par status + deadline)
CREATE INDEX IF NOT EXISTS idx_nat_missing_docs
    ON nationality_applications (status, docs_deadline)
    WHERE missing_docs IS NOT NULL;

-- 3. Vérification
SELECT
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'nationality_applications'
  AND column_name IN (
      'docs_deadline',
      'missing_docs',
      'needs_recherche_ancestrale',
      'recherche_ancestrale_paid',
      'recherche_ancestrale_ref',
      'last_reminder_week'
  )
ORDER BY column_name;
