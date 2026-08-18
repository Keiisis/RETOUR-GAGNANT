-- ══════════════════════════════════════════════════════════════
--  Proposition de séjour : conseiller IA, voyageurs, échéancier
--
--  L'application affiche la proposition comme une vraie offre de voyage, mais
--  trois informations lui manquaient et ne pouvaient donc qu'être inventées :
--   · QUI parle au client (le mot d'accueil n'avait aucun auteur) ;
--   · POUR COMBIEN de voyageurs le séjour est composé ;
--   · COMMENT le règlement s'échelonne (acompte / solde).
--
--  Le conseiller n'est pas un agent humain de plus à gérer : c'est
--  l'assistant IA déjà configuré dans `ai_config` (persona, ton, prompt).
--  On lui donne une identité affichable, et la proposition le désigne.
--
--  Idempotent : exécutable plusieurs fois sans dommage.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Identité affichable de l'assistant ─────────────────────
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS role_label   text;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS avatar_url   text;
-- Marque les configurations utilisables comme conseiller de séjour : toutes
-- les personas de l'IA ne s'adressent pas au client d'un devis.
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS is_conseiller boolean NOT NULL DEFAULT false;

UPDATE ai_config
   SET display_name  = COALESCE(NULLIF(display_name, ''), 'Assistant Retour Gagnant'),
       role_label    = COALESCE(NULLIF(role_label, ''), 'Conseiller séjour diaspora'),
       is_conseiller = true
 WHERE is_active = true;

-- Le modèle `llama-3.3-70b-versatile` a été retiré par Groq : toute requête
-- partant avec ce nom échoue en 404 model_not_found. On aligne la base sur le
-- modèle courant, sinon la configuration reste piégée.
UPDATE ai_config
   SET model = 'openai/gpt-oss-120b'
 WHERE model IS NULL OR model = '' OR model LIKE 'llama-3.%';

-- Aucune configuration active : on en crée une, sans quoi le conseiller
-- n'existerait nulle part et l'écran retomberait sur du texte anonyme.
INSERT INTO ai_config (provider, model, system_prompt, personality, tone, is_active, display_name, role_label, is_conseiller)
SELECT 'groq', 'openai/gpt-oss-120b',
       'Tu es le conseiller séjour de Retour Gagnant Bénin. Tu accompagnes un client de la diaspora qui consulte sa proposition de voyage.',
       'Chaleureux, précis, fier de ses racines béninoises', 'Vouvoiement, phrases courtes',
       true, 'Assistant Retour Gagnant', 'Conseiller séjour diaspora', true
WHERE NOT EXISTS (SELECT 1 FROM ai_config WHERE is_active = true);

-- ── 2. La proposition désigne son conseiller et ses voyageurs ──
ALTER TABLE ai_client_proposals
    ADD COLUMN IF NOT EXISTS conseiller_id integer REFERENCES ai_config(id) ON DELETE SET NULL;

ALTER TABLE ai_client_proposals
    ADD COLUMN IF NOT EXISTS nb_voyageurs integer NOT NULL DEFAULT 1;

DO $$
BEGIN
    ALTER TABLE ai_client_proposals
        ADD CONSTRAINT ai_client_proposals_nb_voyageurs_check CHECK (nb_voyageurs BETWEEN 1 AND 60);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rattache les propositions existantes au conseiller actif : sans cela, tout
-- l'historique afficherait un mot d'accueil sans auteur.
UPDATE ai_client_proposals p
   SET conseiller_id = (SELECT id FROM ai_config WHERE is_active = true ORDER BY id DESC LIMIT 1)
 WHERE p.conseiller_id IS NULL;

-- ── 3. Échéancier de règlement ────────────────────────────────
--  Des POURCENTAGES, jamais des montants figés : le client peut retirer une
--  prestation avant de signer. Un montant écrit en base deviendrait faux au
--  premier décochage — l'application calcule sur le total réellement retenu.
--  Forme : [{"label": "...", "pourcentage": 30, "moment": "signature"}]
ALTER TABLE ai_client_proposals
    ADD COLUMN IF NOT EXISTS echeancier jsonb NOT NULL DEFAULT
        '[{"label":"Acompte de confirmation","pourcentage":30,"moment":"signature"},
          {"label":"Solde à l''arrivée au Bénin","pourcentage":70,"moment":"arrivee"}]'::jsonb;

-- ── 4. Conversation client ↔ conseiller IA ────────────────────
--  Le client doit pouvoir demander « le petit-déjeuner est-il compris ? » et
--  obtenir une réponse fondée sur SA proposition. On garde le fil : sans
--  historique, l'assistant repart de zéro à chaque question et se répète.
CREATE TABLE IF NOT EXISTS proposal_assistant_messages (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id  uuid NOT NULL REFERENCES ai_client_proposals(id) ON DELETE CASCADE,
    client_id    uuid,
    role         text NOT NULL CHECK (role IN ('user', 'assistant')),
    content      text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pam_proposal ON proposal_assistant_messages (proposal_id, created_at);

ALTER TABLE proposal_assistant_messages ENABLE ROW LEVEL SECURITY;

-- L'accès passe exclusivement par les routes serveur (clé de service), qui
-- vérifient déjà l'appartenance de la proposition au client authentifié.
DO $$
BEGIN
    CREATE POLICY pam_service_role ON proposal_assistant_messages
        FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
