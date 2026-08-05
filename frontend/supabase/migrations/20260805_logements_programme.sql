-- ══════════════════════════════════════════════════════════════
--  CATALOGUE LOGEMENTS (partenariat SIMAU × Retour Gagnant)
--
--  RGB ne vend rien : la page présente le catalogue (Programme 20 000
--  logements + Résidences), capture des leads et les transmet à SIMAU.
--  Notre revenu vient du SERVICE DE COMPOSITION DE DOSSIER.
--
--  Catalogue 100 % éditable en admin (table `logements`). Lecture publique
--  des logements actifs uniquement. Les leads sont privés (staff).
-- ══════════════════════════════════════════════════════════════

-- ── Catalogue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logements (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    programme     text NOT NULL DEFAULT '20000',          -- '20000' | 'residences'
    nom           text NOT NULL DEFAULT '',
    type          text NOT NULL DEFAULT 'F4',             -- F3, F4, Villa sociale, Villa, Appartement…
    ville         text NOT NULL DEFAULT '',
    site          text NOT NULL DEFAULT '',               -- quartier / site (Ouèdo…)
    surface_m2    numeric NOT NULL DEFAULT 0,
    chambres      int NOT NULL DEFAULT 0,
    prix_comptant numeric NOT NULL DEFAULT 0,
    devise        text NOT NULL DEFAULT 'XOF',
    mensualite    numeric NOT NULL DEFAULT 0,             -- location-accession / mois
    duree_annees  int NOT NULL DEFAULT 25,
    formules      text[] NOT NULL DEFAULT ARRAY['location-accession','comptant'],
    description   text NOT NULL DEFAULT '',
    atouts        text[] NOT NULL DEFAULT '{}',
    images        text[] NOT NULL DEFAULT '{}',
    plan_url      text,
    visite_url    text,                                   -- visite virtuelle / vidéo
    lat           numeric,
    lng           numeric,
    disponibilite text NOT NULL DEFAULT 'disponible',     -- disponible | bientot | epuise
    ordre         int NOT NULL DEFAULT 0,
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logements_actif_ordre_idx ON public.logements (is_active, ordre);
CREATE INDEX IF NOT EXISTS logements_programme_idx   ON public.logements (programme);
CREATE INDEX IF NOT EXISTS logements_ville_idx       ON public.logements (ville);

ALTER TABLE public.logements ENABLE ROW LEVEL SECURITY;

-- Lecture publique : uniquement les logements actifs.
DROP POLICY IF EXISTS logements_public_read ON public.logements;
CREATE POLICY logements_public_read ON public.logements
    FOR SELECT USING (is_active = true);

-- (Les écritures passent par les routes API en service_role, qui bypassent RLS.)

-- ── Leads (privés) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logement_leads (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    logement_id       uuid REFERENCES public.logements (id) ON DELETE SET NULL,
    logement_nom      text,
    programme         text,
    nom               text,
    prenom            text,
    email             text,
    telephone         text,
    pays_residence    text,
    diaspora          boolean DEFAULT false,
    formule_souhaitee text,
    eligibilite       jsonb,          -- réponses + verdict du simulateur
    message           text,
    statut            text NOT NULL DEFAULT 'nouveau',    -- nouveau | transmis | traite
    transmis_simau    boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS logement_leads_statut_idx ON public.logement_leads (statut, created_at DESC);

ALTER TABLE public.logement_leads ENABLE ROW LEVEL SECURITY;
-- Aucune policy publique : seules les routes API (service_role) y accèdent.
