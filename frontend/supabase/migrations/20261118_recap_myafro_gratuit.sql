-- ══════════════════════════════════════════════════════════════
--  Récap de dossier MyAfroOrigins GRATUIT (agence agréée, novembre 2026).
--
--  Le dépôt n'exige plus aucun règlement : la demande est enregistrée
--  paiement_statut = 'gratuit', montant 0, paiement_moyen = 'gratuit',
--  sans facture. La contrainte d'origine (20260820) n'acceptait que
--  'paye', 'en_attente', 'rembourse'.
--
--  Idempotente : rejouable sans effet de bord.
-- ══════════════════════════════════════════════════════════════

-- 1. Retirer la contrainte CHECK portant sur paiement_statut, quel que soit
--    son nom (contrainte de colonne nommée automatiquement par Postgres).
DO $$
DECLARE c record;
BEGIN
    FOR c IN
        SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
         WHERE rel.relname = 'myafro_recap_requests'
           AND con.contype = 'c'
           AND pg_get_constraintdef(con.oid) ILIKE '%paiement_statut%'
    LOOP
        EXECUTE format('ALTER TABLE myafro_recap_requests DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE myafro_recap_requests
    ADD CONSTRAINT myafro_recap_requests_paiement_statut_check
    CHECK (paiement_statut IN ('paye', 'en_attente', 'rembourse', 'gratuit'));

-- 2. Valeurs par défaut : une demande sans règlement est gratuite.
ALTER TABLE myafro_recap_requests ALTER COLUMN montant SET DEFAULT 0;
ALTER TABLE myafro_recap_requests ALTER COLUMN paiement_statut SET DEFAULT 'gratuit';

-- 3. Demandes gratuites enregistrées AVANT cette migration : l'API les a
--    écrites 'paye' (repli) avec paiement_moyen 'gratuit'. Elles ne doivent
--    pas apparaître dans v_dossiers_payes_sans_facture comme des recettes
--    sans pièce.
UPDATE myafro_recap_requests
   SET paiement_statut = 'gratuit', montant = 0
 WHERE paiement_moyen = 'gratuit'
   AND paiement_statut = 'paye'
   AND facture_id IS NULL;
