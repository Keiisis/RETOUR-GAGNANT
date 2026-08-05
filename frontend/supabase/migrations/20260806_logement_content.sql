-- ══════════════════════════════════════════════════════════════
--  Contenu marketing de la page Logements (éditable en admin)
--
--  Preuve sociale, témoignages, FAQ, bandeau de rareté — tout est piloté
--  depuis l'admin (aucun texte marketing codé en dur, aucune donnée inventée).
--  Une seule ligne (id = 'main'). Lecture publique.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.logement_content (
    id            text PRIMARY KEY DEFAULT 'main',
    stats         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{value, suffix, label}]
    temoignages   jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{nom, ville, texte}]
    faq           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{q, r}]
    rarete_active boolean NOT NULL DEFAULT false,
    rarete_texte  text NOT NULL DEFAULT '',
    updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.logement_content (id) VALUES ('main') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.logement_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS logement_content_read ON public.logement_content;
CREATE POLICY logement_content_read ON public.logement_content FOR SELECT USING (true);
-- Écriture via route API en service_role (bypass RLS).
