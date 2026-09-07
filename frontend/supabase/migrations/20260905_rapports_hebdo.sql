-- ══════════════════════════════════════════════════════════════
--  RAPPORT HEBDOMADAIRE — chaque membre de l'équipe rédige le sien.
--
--  Le modèle existait déjà, mais sous forme de SCRIPT :
--  `scripts/generate-rapport-kevin.mjs` produisait un PDF dont tout le contenu
--  était écrit en dur dans le fichier. Faire un rapport supposait donc de
--  modifier du code — autant dire que personne d'autre que le développeur ne
--  pouvait en produire un.
--
--  Ici, le CONTENU vit en base et la MISE EN PAGE reste dans le code. Chacun
--  édite son rapport dans le panel ; le PDF sort avec la même charte.
--
--  Le contenu est en JSONB, volontairement : le nombre de réalisations, de
--  fiches clients ou de points de synthèse varie d'une semaine à l'autre.
--  Une colonne par champ aurait figé la forme et imposé une migration à
--  chaque évolution du modèle.
--
--  Idempotent : exécutable plusieurs fois sans dommage.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rapports_hebdo (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ── L'auteur ──
    auteur_id     uuid NOT NULL,
    auteur_nom    text NOT NULL,
    auteur_role   text,              -- « Dev Assistant », « Agent terrain »…

    -- ── La période couverte ──
    --  `semaine_du` porte le LUNDI de la semaine : deux rapports du même
    --  auteur pour la même semaine n'ont pas de sens.
    semaine_du    date NOT NULL,
    semaine_au    date,

    titre         text,
    destinataire  text NOT NULL DEFAULT 'Madame la Directrice Générale',

    -- ── Le contenu, dans la forme du modèle ──
    --  { note_cadrage, statut, sections: { realisations[], encadre, dossiers[],
    --    synthese, mention } }
    contenu       jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- ── Cycle de vie ──
    --  Un brouillon n'est visible que de son auteur ; un rapport transmis
    --  entre dans la file de la direction.
    statut        text NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'transmis', 'lu', 'archive')),
    transmis_le   timestamptz,
    lu_le         timestamptz,

    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Un seul rapport par auteur et par semaine : sinon la direction reçoit deux
-- versions du même bilan sans savoir laquelle fait foi.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rapports_hebdo_auteur_semaine
    ON rapports_hebdo (auteur_id, semaine_du);

CREATE INDEX IF NOT EXISTS idx_rapports_hebdo_semaine
    ON rapports_hebdo (semaine_du DESC);
CREATE INDEX IF NOT EXISTS idx_rapports_hebdo_statut
    ON rapports_hebdo (statut, semaine_du DESC);

ALTER TABLE rapports_hebdo ENABLE ROW LEVEL SECURITY;

-- Aucune lecture publique : un rapport hebdomadaire nomme des clients et des
-- montants. Tout passe par les routes serveur (clé de service), qui vérifient
-- la session ET cloisonnent : un agent ne voit que les siens.
DO $$
BEGIN
    CREATE POLICY rapports_hebdo_service_role ON rapports_hebdo
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE rapports_hebdo IS
    'Rapports hebdomadaires d''activité. Contenu en JSONB (le modèle évolue), mise en page dans lib/rapport-hebdo-pdf.ts.';