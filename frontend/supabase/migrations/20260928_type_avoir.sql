-- ═══════════════════════════════════════════════════════════
-- AVOIRS : autoriser documents_financiers.type = 'avoir'
--
-- LE PROBLÈME.
-- La table est née (supabase_migration_erp.sql, ligne 7) avec
--     type TEXT NOT NULL CHECK (type IN ('devis', 'facture'))
-- La migration 20260720_facturation_conformite.sql a ajouté les colonnes
-- des avoirs (avoir_de_facture_id, motif_avoir) mais n'a JAMAIS élargi
-- cette contrainte. /api/admin/avoirs insère type = 'avoir' : l'insertion
-- est rejetée (23514) et aucun avoir ne peut être émis. Constat en lecture
-- le 2026-09-28 : 0 avoir en base (23 documents : devis/facture).
--
-- Le code (lib/document-numbering, lib/fec-syscohada, lib/mecef, panels
-- facturation et comptabilité) traite déjà 'avoir' : seule la base bloquait.
--
-- Migration IDEMPOTENTE : retrouve la contrainte portant sur `type` quel que
-- soit son nom (générée automatiquement à la création), la remplace, et peut
-- être rejouée sans dommage. Elle ne touche à aucune donnée.
-- La contrainte `status` est inchangée : un avoir émis est 'envoye',
-- remboursé 'paye' (valeurs déjà admises).
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.documents_financiers'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type%'
          AND pg_get_constraintdef(oid) ILIKE '%devis%'
          AND pg_get_constraintdef(oid) NOT ILIKE '%avoir%'
    LOOP
        EXECUTE format('ALTER TABLE public.documents_financiers DROP CONSTRAINT %I', c.conname);
    END LOOP;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.documents_financiers'::regclass
          AND conname = 'documents_financiers_type_check'
    ) THEN
        ALTER TABLE public.documents_financiers
            ADD CONSTRAINT documents_financiers_type_check
            CHECK (type IN ('devis', 'facture', 'avoir'));
    END IF;
END $$;

-- Vérification (à lire après exécution) :
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.documents_financiers'::regclass AND contype = 'c';
