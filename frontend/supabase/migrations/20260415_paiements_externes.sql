-- Autorise les paiements externes (hors factures du site) dans la comptabilité.
-- Le bouton "Paiement" de /agent/comptabilite peut désormais enregistrer
-- un paiement avec un libellé libre (prestation externe, vente directe, etc.).

ALTER TABLE paiements_manuels
    ALTER COLUMN document_id DROP NOT NULL;

-- Les paiements externes ont document_id = NULL et un champ notes préfixé "[EXTERNE] ..."
