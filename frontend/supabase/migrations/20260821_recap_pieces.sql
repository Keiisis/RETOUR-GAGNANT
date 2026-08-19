-- ══════════════════════════════════════════════════════════════
--  Pièces jointes d'un récap de dossier MyAfroOrigins
--
--  L'onglet « Dossiers MyAfroOrigins » listait TOUTES les pièces client, sans
--  distinction d'origine. Or à cet endroit, une pièce n'a de sens que
--  rattachée à une demande de récap : sinon on ne sait ni de quel dossier elle
--  parle, ni qui doit la traiter.
--
--  `recap_id` rattache la pièce à sa demande. Le panel n'affiche plus qu'elles,
--  et à l'intérieur de la fiche concernée — pas dans une liste à part.
--
--  Idempotent : exécutable plusieurs fois sans dommage.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE client_documents
    ADD COLUMN IF NOT EXISTS recap_id uuid REFERENCES myafro_recap_requests(id) ON DELETE CASCADE;

-- Le chemin dans le bucket privé. La colonne `file_url` portait autrefois une
-- adresse inventée (`/uploads/<nom>`) : on garde une colonne dédiée pour ne
-- plus confondre « adresse publique » et « objet de stockage ».
ALTER TABLE client_documents
    ADD COLUMN IF NOT EXISTS storage_path text;

CREATE INDEX IF NOT EXISTS idx_client_documents_recap ON client_documents (recap_id, created_at DESC);

-- Le client peut déposer ses pièces depuis le web comme depuis l'application :
-- on trace la provenance pour savoir où relancer en cas de pièce manquante.
ALTER TABLE client_documents
    ADD COLUMN IF NOT EXISTS source text;

-- ── Le récap devient un DOSSIER, comme les autres services ────
--  Une demande payée n'est pas qu'une ligne de service : c'est un dossier que
--  l'équipe suit. `dossier_id` pointe vers `dossier_tracking`, la table unique
--  d'où l'admin, l'agent et l'application lisent tous les dossiers. Sans ce
--  lien, le récap n'apparaissait dans aucun suivi.
ALTER TABLE myafro_recap_requests
    ADD COLUMN IF NOT EXISTS dossier_id uuid;

CREATE INDEX IF NOT EXISTS idx_myafro_recap_dossier ON myafro_recap_requests (dossier_id);
