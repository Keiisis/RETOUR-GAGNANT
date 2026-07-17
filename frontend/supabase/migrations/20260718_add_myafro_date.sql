-- Migration : ajout de la colonne myafro_date pour le suivi des dossiers MyAfroOrigins
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE public.nationality_applications
    ADD COLUMN IF NOT EXISTS myafro_date TEXT;
