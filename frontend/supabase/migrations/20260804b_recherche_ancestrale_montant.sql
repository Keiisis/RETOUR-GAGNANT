-- ══════════════════════════════════════════════════════════════
--  Recherche ancestrale : montant + devise du forfait payé
--
--  Complète 20260804_recherche_ancestrale_payee.sql. Permet d'afficher le
--  paiement de la recherche généalogique SÉPARÉMENT du paiement de la
--  demande de nationalité, avec un total. Forfait par défaut : 250 €.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.nationality_applications
    ADD COLUMN IF NOT EXISTS recherche_ancestrale_montant numeric NOT NULL DEFAULT 250,
    ADD COLUMN IF NOT EXISTS recherche_ancestrale_devise  text    NOT NULL DEFAULT 'EUR';

COMMENT ON COLUMN public.nationality_applications.recherche_ancestrale_montant
    IS 'Montant du forfait recherche généalogique réglé par le client.';
COMMENT ON COLUMN public.nationality_applications.recherche_ancestrale_devise
    IS 'Devise du forfait recherche généalogique (EUR par défaut).';
