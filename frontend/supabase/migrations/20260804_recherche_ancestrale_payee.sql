-- ══════════════════════════════════════════════════════════════
--  Dossiers de nationalité : indicateur « recherche ancestrale payée »
--
--  Sert à la Fiche d'analyse : quand le client a DÉJÀ réglé le forfait de
--  recherche généalogique (250 €), la fiche ne propose plus cette option
--  payante — RGB prend la recherche en charge. Par défaut : non payée.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.nationality_applications
    ADD COLUMN IF NOT EXISTS recherche_ancestrale_payee boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.nationality_applications.recherche_ancestrale_payee
    IS 'Le client a payé le forfait recherche généalogique (250 €). Utilisé par la fiche d''analyse.';
