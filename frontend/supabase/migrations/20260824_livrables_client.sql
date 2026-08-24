-- ═══════════════════════════════════════════════════════════
-- LIVRABLES CLIENT — ce que l'agence REND au client
--
-- LE PROBLÈME QUE CETTE MIGRATION RÉSOUT.
--
-- Les fiches d'analyse produites par l'admin (dossier de nationalité,
-- récap MyAfroOrigins) étaient générées en PDF puis ENVOYÉES PAR E-MAIL,
-- et rien d'autre : aucune trace en base, aucun fichier conservé. Le
-- client qui perdait le courriel avait perdu le document, et l'application
-- mobile n'avait littéralement rien à afficher — on ne peut pas lister ce
-- qui n'existe nulle part.
--
-- `client_documents` contenait déjà les pièces que le client DÉPOSE. Elle
-- devient le registre unique des deux sens de circulation :
--
--     origine = 'client'  →  ce que le client a envoyé
--     origine = 'agence'  →  ce que l'agence lui a rendu
--
-- Un seul registre, donc un seul endroit à interroger côté mobile, et
-- aucun risque de voir deux listes diverger.
--
-- Migration ADDITIVE et idempotente : elle ne touche à aucune donnée
-- existante et peut être rejouée sans dommage.
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.client_documents
    -- Qui a produit le document. Par défaut 'client' : toutes les lignes
    -- déjà présentes sont des dépôts du client, l'historique reste juste.
    ADD COLUMN IF NOT EXISTS origine TEXT NOT NULL DEFAULT 'client',

    -- Nature du document, pour le filtre de l'écran « Mes documents » :
    -- 'fiche_analyse' | 'recap' | 'piece' | 'contrat' | 'autre'
    ADD COLUMN IF NOT EXISTS categorie TEXT,

    -- Titre lisible ; à défaut, l'application retombe sur nom_fichier.
    ADD COLUMN IF NOT EXISTS titre TEXT,

    -- Rattachement par e-mail : un livrable peut précéder la création du
    -- compte (dossier déposé depuis le site, compte mobile ouvert ensuite).
    -- Sans cette colonne, ces documents seraient orphelins à vie.
    ADD COLUMN IF NOT EXISTS client_email TEXT,

    -- Dossier de nationalité rattaché, quand il y en a un.
    ADD COLUMN IF NOT EXISTS nationality_id UUID;

-- Recherche par e-mail : c'est le chemin d'accès du mobile quand le
-- client_id n'est pas encore connu.
CREATE INDEX IF NOT EXISTS idx_client_documents_email
    ON public.client_documents (LOWER(client_email));

-- Filtrage par sens de circulation.
CREATE INDEX IF NOT EXISTS idx_client_documents_origine
    ON public.client_documents (origine, created_at DESC);

-- Contrainte de cohérence : les deux seules valeurs admises.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'client_documents_origine_check'
    ) THEN
        ALTER TABLE public.client_documents
            ADD CONSTRAINT client_documents_origine_check
            CHECK (origine IN ('client', 'agence'));
    END IF;
END $$;

COMMENT ON COLUMN public.client_documents.origine IS
    'client = piece deposee par le client ; agence = livrable rendu par Retour Gagnant';
