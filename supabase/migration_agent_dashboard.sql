-- ============================================
-- MIGRATION: Agent Dashboard - Colonnes additionnelles
-- Date: 2026-02-27
-- Description: Ajoute les colonnes nécessaires pour
--              le dashboard agent (notes, contacted, etc.)
-- ============================================
-- Notes internes sur les dossiers (visibles uniquement par les agents)
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
-- Prénom du client dans le suivi de dossier
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS client_prenom TEXT DEFAULT '';
-- Téléphone du client dans le suivi de dossier
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT '';
-- Flag "contacté" sur les résultats Oracle
ALTER TABLE public.eligibility_results
ADD COLUMN IF NOT EXISTS contacted BOOLEAN DEFAULT false;
-- WhatsApp du client dans les résultats Oracle
ALTER TABLE public.eligibility_results
ADD COLUMN IF NOT EXISTS client_whatsapp TEXT DEFAULT '';
-- Prénom du client dans les résultats Oracle
ALTER TABLE public.eligibility_results
ADD COLUMN IF NOT EXISTS client_prenom TEXT DEFAULT '';
-- Origines béninoises confirmées
ALTER TABLE public.eligibility_results
ADD COLUMN IF NOT EXISTS has_origins BOOLEAN DEFAULT false;