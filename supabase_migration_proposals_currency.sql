-- Migration : Ajout de la colonne `currency` à la table `ai_client_proposals`
-- À exécuter dans Supabase > SQL Editor si la colonne n'existe pas encore

-- Ajout de la colonne currency (toutes les devises supportées : XOF, EUR, USD, GBP)
ALTER TABLE public.ai_client_proposals
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';

-- Vérification : affiche la structure de la table
-- SELECT column_name, data_type, column_default FROM information_schema.columns
-- WHERE table_name = 'ai_client_proposals' ORDER BY ordinal_position;
