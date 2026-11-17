-- ══════════════════════════════════════════════════════════════
--  FICHES DE SUIVI CLIENT RGB : REMISE À ZÉRO (17/11/2026)
--
--  Le premier script a créé une fiche pour chaque client déjà inscrit.
--  Décision : seuls les clients inscrits à partir du 17/11/2026 ont une
--  fiche automatique. Ce script :
--    1. supprime toutes les fiches existantes ;
--    2. remet le compteur à zéro (prochaine fiche : RGB-2026-000001) ;
--    3. recrée, dans l'ordre d'inscription, la fiche des clients inscrits
--       le 17/11/2026 ou après (heure de Cotonou), s'il y en a.
--  Garde-fou : s'arrête sans rien supprimer si une fiche a déjà été
--  remplie par un agent ou créée à la main.
--  À exécuter dans l'éditeur SQL Supabase, APRÈS supabase_fiches_suivi_client.sql.
-- ══════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.fiches_suivi_client
               WHERE source = 'manuel' OR updated_at > created_at + INTERVAL '1 minute') THEN
        RAISE EXCEPTION 'Remise à zéro annulée : des fiches ont déjà été remplies ou créées à la main.';
    END IF;
END $$;

DELETE FROM public.fiches_suivi_client;

ALTER SEQUENCE public.fiches_suivi_client_seq RESTART WITH 1;

INSERT INTO public.fiches_suivi_client (client_id, source, nom_complet, email, telephone, pays, ville, date_fiche)
SELECT cp.id,
       'inscription',
       NULLIF(trim(coalesce(cp.prenom, '') || ' ' || coalesce(cp.nom, '')), ''),
       lower(cp.email),
       cp.phone,
       cp.pays,
       cp.ville,
       (cp.created_at AT TIME ZONE 'Africa/Porto-Novo')::date
FROM public.client_profiles cp
WHERE cp.created_at >= TIMESTAMPTZ '2026-11-17 00:00:00+01'
ORDER BY cp.created_at;

COMMIT;

-- Contrôle : 0 fiche = la prochaine inscription recevra RGB-2026-000001.
SELECT count(*) AS fiches, max(numero) AS dernier_numero FROM public.fiches_suivi_client;
