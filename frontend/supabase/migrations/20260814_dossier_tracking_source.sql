-- ════════════════════════════════════════════════════════════════════════
--  Dossiers Service Mobile : tag d'origine sur dossier_tracking
--
--  But : distinguer, dans le Nexus Tracker (admin/dossiers + agent/dossiers),
--  les dossiers OUVERTS DEPUIS L'APPLICATION MOBILE (prise de service / RDV lié
--  à un service) des dossiers créés autrement (contact, web, création manuelle).
--
--  Un dossier mobile est déjà synchronisé vers dossier_tracking par
--  /api/mobile/dossiers (statut 'reception', dossier_ref_id -> dossiers.id).
--  On ajoute une colonne `source` pour un filtre propre « Service Mobile »
--  côté panels, sans changer les statuts globaux existants.
--
--  Idempotent : réexécutable sans effet de bord.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Colonne source (défaut 'web' pour tout l'historique non-mobile)
ALTER TABLE public.dossier_tracking
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';

-- 2. Backfill : tout dossier_tracking lié à un dossier réel (dossier_ref_id
--    renseigné) provient du flux service/mobile -> on le marque 'mobile'.
UPDATE public.dossier_tracking
SET source = 'mobile'
WHERE dossier_ref_id IS NOT NULL
  AND (source IS NULL OR source = 'web');

-- 3. Index pour le filtre onglet « Service Mobile » (liste triée par date).
CREATE INDEX IF NOT EXISTS idx_dossier_tracking_source
    ON public.dossier_tracking (source, created_at DESC);

-- 4. Commentaire de documentation.
COMMENT ON COLUMN public.dossier_tracking.source IS
    'Origine du dossier : ''mobile'' (ouvert depuis l''app, flux service/RDV, pièces uploadées par le client) ou ''web'' (contact/manuel/panel). Sert au filtre « Service Mobile » des panels admin/agent.';
