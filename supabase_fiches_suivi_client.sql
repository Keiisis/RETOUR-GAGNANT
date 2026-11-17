-- ══════════════════════════════════════════════════════════════
--  FICHE DE SUIVI CLIENT RGB (nationalité béninoise)
--
--  Une fiche par NOUVEAU client, créée par la base elle-même dès que
--  `client_profiles` reçoit une ligne (inscription), plus les fiches
--  ajoutées à la main par un agent ou un admin. Les clients inscrits
--  avant le 17/11/2026 n'ont pas de fiche automatique (pas de rattrapage).
--  Numéro automatique : RGB-AAAA-NNNNNN (séquence unique, jamais réutilisée).
--  Lecture et écriture UNIQUEMENT par l'API (clé service) : RLS activée
--  sans aucune policy, donc fermée aux clés anon et authenticated.
--  À exécuter une fois dans l'éditeur SQL Supabase. Rejouable sans risque.
-- ══════════════════════════════════════════════════════════════

-- ─── 1. Table ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.fiches_suivi_client_seq;

CREATE TABLE IF NOT EXISTS public.fiches_suivi_client (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                    TEXT        NOT NULL UNIQUE,
    client_id                 UUID        UNIQUE REFERENCES public.client_profiles(id) ON DELETE SET NULL,
    source                    TEXT        NOT NULL DEFAULT 'manuel' CHECK (source IN ('inscription', 'manuel')),
    cree_par                  UUID,

    -- En-tête
    date_fiche                DATE        NOT NULL DEFAULT CURRENT_DATE,
    statut_dossier            TEXT        NOT NULL DEFAULT 'nouveau' CHECK (statut_dossier IN ('nouveau', 'myafro')),
    date_depot                DATE,

    -- 1. Identité et localisation
    nom_complet               TEXT,
    telephone                 TEXT,
    email                     TEXT,
    pays                      TEXT,
    ville                     TEXT,
    canaux                    TEXT[]      NOT NULL DEFAULT '{}',

    -- 2. Réclamation MyAfroOrigins
    reclamation_statut        TEXT        CHECK (reclamation_statut IN ('aucune', 'aucune_3m', 'aucune_6m', 'attestation')),
    date_etat_lieux           DATE,
    observation               TEXT,

    -- 3. Demande de nationalité & paiements
    accueil_statut            TEXT        CHECK (accueil_statut IN ('complet', 'partiel', 'attente')),
    accueil_date_reclamation  DATE,
    accueil_date_reception    DATE,
    frais_statut              TEXT        CHECK (frais_statut IN ('attente', 'recu', 'verifie')),
    frais_date                DATE,
    frais_justificatif        BOOLEAN     NOT NULL DEFAULT FALSE,

    -- 4. Pièces réclamées : [{ "date": "AAAA-MM-JJ", "piece": "...", "statut": "attente|recue|conforme" }]
    pieces                    JSONB       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pieces) = 'array'),

    -- 5. Analyse et observations
    analyse_suivi             TEXT,  -- « analyse » est un mot réservé de PostgreSQL

    -- 6. Accompagnement final & cérémonie
    guichet_statut            TEXT        CHECK (guichet_statut IN ('attente', 'programme', 'effectue')),
    guichet_date              DATE,
    ceremonie_statut          TEXT        CHECK (ceremonie_statut IN ('attente', 'inscrit', 'remise')),
    ceremonie_date            DATE,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiches_suivi_client_created ON public.fiches_suivi_client(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fiches_suivi_client_email   ON public.fiches_suivi_client(lower(email));

ALTER TABLE public.fiches_suivi_client ENABLE ROW LEVEL SECURITY;

-- ─── 2. Numéro automatique + date de mise à jour ─────────────
CREATE OR REPLACE FUNCTION public.fiches_suivi_client_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.numero IS NULL OR NEW.numero = '' THEN
            NEW.numero := 'RGB-' || to_char(NOW() AT TIME ZONE 'Africa/Porto-Novo', 'YYYY')
                       || '-' || lpad(nextval('public.fiches_suivi_client_seq')::text, 6, '0');
        END IF;
    ELSE
        NEW.numero := OLD.numero;  -- un numéro attribué ne change plus
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fiches_suivi_client_numero ON public.fiches_suivi_client;
CREATE TRIGGER trg_fiches_suivi_client_numero
    BEFORE INSERT OR UPDATE ON public.fiches_suivi_client
    FOR EACH ROW EXECUTE FUNCTION public.fiches_suivi_client_numero();

-- ─── 3. Création automatique à l'inscription ─────────────────
CREATE OR REPLACE FUNCTION public.fiche_suivi_depuis_inscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.fiches_suivi_client (client_id, source, nom_complet, email, telephone, pays, ville, date_fiche)
    VALUES (
        NEW.id,
        'inscription',
        NULLIF(trim(coalesce(NEW.prenom, '') || ' ' || coalesce(NEW.nom, '')), ''),
        lower(NEW.email),
        NEW.phone,
        NEW.pays,
        NEW.ville,
        (NOW() AT TIME ZONE 'Africa/Porto-Novo')::date
    )
    ON CONFLICT (client_id) DO NOTHING;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Une fiche ratée ne doit jamais bloquer une inscription.
    RAISE WARNING 'fiche_suivi_depuis_inscription: %', SQLERRM;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fiche_suivi_inscription ON public.client_profiles;
CREATE TRIGGER trg_fiche_suivi_inscription
    AFTER INSERT ON public.client_profiles
    FOR EACH ROW EXECUTE FUNCTION public.fiche_suivi_depuis_inscription();
