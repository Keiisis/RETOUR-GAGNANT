-- ══════════════════════════════════════════════════════════════
--  Service « Récap de dossier MyAfroOrigins »
--
--  Un afro-descendant a déposé sa demande directement sur MyAfroOrigins et son
--  dossier n'avance plus. Il n'avait, jusqu'ici, aucun moyen de nous saisir
--  sans qu'un agent lui envoie un lien : la reprise de dossier partait toujours
--  du cabinet. Ce service inverse le sens — le client vient à nous, décrit sa
--  situation, règle 50 € et reçoit une fiche d'analyse.
--
--  PROTECTION DES DONNÉES (loi n° 2017-20 portant Code du numérique en
--  République du Bénin, autorité : APDP) :
--   · minimisation — on ne collecte que l'identité de contact et le récit du
--     problème, rien d'autre ; aucune pièce d'identité à ce stade ;
--   · consentement libre et EXPLICITE, horodaté et versionné, jamais
--     pré-coché côté formulaire ;
--   · limitation de conservation — `purge_apres` porte l'échéance, une demande
--     close est effaçable sans toucher au reste ;
--   · droits d'accès, de rectification, d'effacement et d'opposition exercés
--     par email ; `droit_exerce_le` trace la demande du client.
--
--  Idempotent : exécutable plusieurs fois sans dommage.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS myafro_recap_requests (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reference         text UNIQUE NOT NULL,

    -- ── Identité de contact (strict minimum) ──
    nom               text NOT NULL,
    prenom            text NOT NULL,
    email             text NOT NULL,
    telephone         text NOT NULL,
    pays_residence    text,

    -- ── Le dossier MyAfroOrigins tel que le client le décrit ──
    myafro_reference  text,            -- référence chez MyAfroOrigins, si connue
    depuis_quand      text,            -- « 8 mois », « mars 2025 »… champ libre assumé
    situation         text NOT NULL,   -- le récit du problème, cœur du service
    attentes          text,            -- ce que le client espère de nous

    -- ── Règlement ──
    montant           numeric(12,2) NOT NULL DEFAULT 50,
    devise            text NOT NULL DEFAULT 'EUR',
    paiement_statut   text NOT NULL DEFAULT 'paye' CHECK (paiement_statut IN ('paye', 'en_attente', 'rembourse')),
    paiement_ref      text,
    paiement_moyen    text,

    -- ── Traitement ──
    statut            text NOT NULL DEFAULT 'nouveau'
                      CHECK (statut IN ('nouveau', 'en_analyse', 'recap_livre', 'clos')),
    recap_ia          text,            -- la fiche d'analyse générée
    recap_genere_le   timestamptz,
    notes_agent       text,
    agent_id          uuid,

    -- ── Conformité (Code du numérique, art. 383 et suivants) ──
    consentement      boolean NOT NULL DEFAULT false,
    consentement_le   timestamptz,
    consentement_version text NOT NULL DEFAULT '2026-08-20',
    purge_apres       date,            -- échéance de conservation
    droit_exerce_le   timestamptz,     -- accès / rectification / effacement demandé

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Le consentement n'est pas décoratif : sans lui, la ligne n'a pas le droit
-- d'exister. La contrainte l'impose au niveau de la base, pas seulement du
-- formulaire — une insertion par une autre voie ne peut pas y échapper.
DO $$
BEGIN
    ALTER TABLE myafro_recap_requests
        ADD CONSTRAINT myafro_recap_consentement_obligatoire
        CHECK (consentement = true AND consentement_le IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_myafro_recap_statut  ON myafro_recap_requests (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_myafro_recap_email   ON myafro_recap_requests (lower(email));
CREATE INDEX IF NOT EXISTS idx_myafro_recap_purge   ON myafro_recap_requests (purge_apres);

ALTER TABLE myafro_recap_requests ENABLE ROW LEVEL SECURITY;

-- Aucune lecture publique : ces lignes contiennent le récit personnel d'une
-- situation administrative. Tout passe par les routes serveur (clé de service),
-- qui vérifient l'authentification du personnel.
DO $$
BEGIN
    CREATE POLICY myafro_recap_service_role ON myafro_recap_requests
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tarif : lu en base, jamais codé en dur ────────────────────
--  Même règle que la nationalité : le serveur relit ce tarif pour valider le
--  montant réellement encaissé. Un prix qui ne vit que dans le navigateur est
--  un prix modifiable.
INSERT INTO page_sections (page, section_key, content, is_active)
SELECT 'recap-myafroorigins', 'form_settings',
       '{"amount": 50, "currency": "EUR", "delai": "48 heures ouvrées"}'::jsonb, true
WHERE NOT EXISTS (
    SELECT 1 FROM page_sections
     WHERE page = 'recap-myafroorigins' AND section_key = 'form_settings'
);

-- ── Le service apparaît dans le catalogue ─────────────────────
INSERT INTO services (slug, title, subtitle, description, price_display, icon, color, is_active, features, pricing_options)
SELECT 'recap-myafroorigins',
       'Récap de dossier MyAfroOrigins',
       'Votre dossier n''avance plus ? Faites-le analyser.',
       'Vous avez déposé une demande sur MyAfroOrigins et rien ne bouge. Nous reprenons votre situation, nous l''analysons pièce par pièce et nous vous remettons une fiche claire : ce qui bloque, ce qui manque, et l''ordre exact des démarches à engager.',
       '50 €',
       'FileMagnifyingGlass',
       '#008751',
       true,
       '["Analyse complète de votre situation","Fiche de récapitulatif écrite, à conserver","Points de blocage identifiés","Marche à suivre, étape par étape","Réponse sous 48 heures ouvrées"]'::jsonb,
       '[{"label": "Récap de dossier", "price": "50 €"}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM services WHERE slug = 'recap-myafroorigins');
