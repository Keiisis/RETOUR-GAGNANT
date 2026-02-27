-- ============================================
-- MIGRATION: Agent Dashboard v2 - Enhanced Tables
-- Date: 2026-02-27
-- Description: Updates agent_devis and agent_documents tables
--   to support new fields (type, conditions, subcategory, etc.)
-- ============================================
-- ========== AGENT_DEVIS UPDATES ==========
-- Add document type (devis vs facture)
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'devis';
-- Add numero field for unique document numbers
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS numero TEXT DEFAULT '';
-- Add client address
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS client_adresse TEXT DEFAULT '';
-- Add sous_total
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS sous_total NUMERIC DEFAULT 0;
-- Add total_tva
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS total_tva NUMERIC DEFAULT 0;
-- Add remise
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS remise NUMERIC DEFAULT 0;
-- Add conditions
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS conditions TEXT DEFAULT '';
-- Add validite
ALTER TABLE public.agent_devis
ADD COLUMN IF NOT EXISTS validite TEXT DEFAULT '30 jours';
-- ========== AGENT_DOCUMENTS UPDATES ==========
-- Add original file name
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS original_name TEXT DEFAULT '';
-- Add subcategory
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';
-- Add client name association
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';
-- Add notes
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
-- Add file type (MIME type)
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT '';
-- Add file_size if not exists  
ALTER TABLE public.agent_documents
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
-- ========== DOSSIER_TRACKING UPDATES ==========
-- Ensure service column exists
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS service TEXT DEFAULT '';
-- Ensure prenom column exists
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS prenom TEXT DEFAULT '';
-- Ensure telephone column exists
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS telephone TEXT DEFAULT '';
-- Ensure nom column exists
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS nom TEXT DEFAULT '';
-- Ensure email column exists
ALTER TABLE public.dossier_tracking
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';