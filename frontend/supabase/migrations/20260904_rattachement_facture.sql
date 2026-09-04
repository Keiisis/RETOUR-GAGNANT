-- ══════════════════════════════════════════════════════════════
--  RATTACHEMENT D'UN DOSSIER SAISI À LA MAIN À UNE FACTURE ÉMISE
--
--  LE PROBLÈME. Un récap MyAfroOrigins saisi au téléphone, un dossier de
--  nationalité ouvert par un agent ou par code d'invitation : dans les trois
--  cas, la ligne portait un montant et un statut de règlement DÉCLARÉS, sans
--  qu'aucune facture réelle ne leur corresponde. Marquer « payé » suffisait à
--  faire entrer la somme dans les recettes. Une comptabilité ne peut pas
--  reposer sur une case cochée : il lui faut la pièce.
--
--  LA RÈGLE POSÉE ICI. Un dossier saisi à la main n'est réputé payé QUE s'il
--  est rattaché à une facture réellement émise (`documents_financiers`). Le
--  rattachement est un acte : qui l'a fait, quand, et sur quelle pièce.
--
--  CONSÉQUENCE POUR L'EXPORT ET LA SAUVEGARDE. `facture_id` est une vraie clé
--  étrangère : l'export peut donc joindre le dossier à sa facture, et la
--  sauvegarde par client retrouve les deux bouts. C'est ce qui manquait pour
--  « tout classer par dossier ».
--
--  Idempotent : exécutable plusieurs fois sans dommage.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Récaps MyAfroOrigins ───────────────────────────────────
ALTER TABLE myafro_recap_requests
    ADD COLUMN IF NOT EXISTS facture_id           uuid,
    ADD COLUMN IF NOT EXISTS paiement_confirme_le timestamptz,
    ADD COLUMN IF NOT EXISTS paiement_confirme_par uuid;

DO $$
BEGIN
    ALTER TABLE myafro_recap_requests
        ADD CONSTRAINT myafro_recap_facture_fk
        FOREIGN KEY (facture_id) REFERENCES documents_financiers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_myafro_recap_facture
    ON myafro_recap_requests (facture_id);

COMMENT ON COLUMN myafro_recap_requests.facture_id IS
    'Facture émise correspondant à ce récap. NULL = aucun encaissement prouvé : la ligne ne doit PAS compter dans les recettes.';

-- ── 2. Dossiers (nationalité, service mobile, invitations) ────
ALTER TABLE dossier_tracking
    ADD COLUMN IF NOT EXISTS facture_id           uuid,
    ADD COLUMN IF NOT EXISTS paiement_confirme_le timestamptz,
    ADD COLUMN IF NOT EXISTS paiement_confirme_par uuid;

DO $$
BEGIN
    ALTER TABLE dossier_tracking
        ADD CONSTRAINT dossier_tracking_facture_fk
        FOREIGN KEY (facture_id) REFERENCES documents_financiers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_dossier_tracking_facture
    ON dossier_tracking (facture_id);

COMMENT ON COLUMN dossier_tracking.facture_id IS
    'Facture émise correspondant à ce dossier. NULL = aucun encaissement prouvé.';

-- ── 3. Vue de contrôle : ce qui se dit payé SANS pièce ────────
--  Sert au panel et au contrôle comptable : un dossier marqué payé mais sans
--  facture rattachée est une anomalie à traiter, pas une recette.
CREATE OR REPLACE VIEW v_dossiers_payes_sans_facture AS
    SELECT 'recap'::text AS nature, r.id, r.reference,
           (r.prenom || ' ' || r.nom) AS client,
           r.email, r.montant, r.devise, r.created_at
      FROM myafro_recap_requests r
     WHERE r.paiement_statut = 'paye' AND r.facture_id IS NULL
    UNION ALL
    SELECT 'dossier'::text, d.id, d.num_dossier,
           COALESCE(d.client_prenom || ' ' || d.client_nom, d.client_nom),
           d.client_email, NULL::numeric, NULL::text, d.created_at
      FROM dossier_tracking d
     WHERE d.facture_id IS NULL
       AND COALESCE(d.source, '') IN ('manuel', 'invitation');
