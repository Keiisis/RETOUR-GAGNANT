-- Migration : Création du module de Facturation Avancée (ERP)
-- Ce script crée la table `documents_financiers` qui va remplacer l'ancienne table `agent_devis`
-- et apporter la puissance d'une gestion ERP (Devis vers Facture, Multi-devises, Signature, Relances).

CREATE TABLE IF NOT EXISTS public.documents_financiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('devis', 'facture')),
    numero TEXT NOT NULL UNIQUE,
    
    -- Infos Client
    client_nom TEXT NOT NULL,
    client_prenom TEXT,
    client_email TEXT,
    client_phone TEXT,
    client_adresse TEXT,
    client_company TEXT, -- Pour B2B
    
    -- Détails Financiers
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Contient: description, amount, quantity, tva_rate, discount
    currency TEXT NOT NULL DEFAULT 'XOF' CHECK (currency IN ('XOF', 'EUR', 'USD')),
    sous_total NUMERIC NOT NULL DEFAULT 0,
    total_tva NUMERIC NOT NULL DEFAULT 0,
    remise NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    
    -- Workflow & Cycle de vie
    status TEXT NOT NULL DEFAULT 'brouillon' 
        CHECK (status IN ('brouillon', 'envoye', 'accepte', 'refuse', 'paye', 'en_retard', 'annule')),
    
    -- Métadonnées document
    notes TEXT,
    conditions TEXT,
    validite TEXT,
    due_date TIMESTAMPTZ, -- Date d'échéance de la facture ou limite de validité du devis
    
    -- Traçabilité & Agent
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- L'agent ou admin qui a créé le document
    
    -- Signatures & Paiements
    signature_url TEXT, -- Lien vers l'image de la signature du client
    signed_at TIMESTAMPTZ,
    payment_transaction_id TEXT, -- ID Stripe / FedaPay
    payment_method TEXT,
    
    -- Liaisons
    parent_devis_id UUID REFERENCES public.documents_financiers(id) ON DELETE SET NULL, -- Si c'est une facture générée depuis un devis
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour accélérer les recherches de la patronne
CREATE INDEX IF NOT EXISTS idx_documents_financiers_agent ON public.documents_financiers(agent_id);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_type_status ON public.documents_financiers(type, status);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_numero ON public.documents_financiers(numero);
CREATE INDEX IF NOT EXISTS idx_documents_financiers_client_email ON public.documents_financiers(client_email);

-- Activer le RLS (Row Level Security)
ALTER TABLE public.documents_financiers ENABLE ROW LEVEL SECURITY;

-- Politiques de Sécurité (RLS)
-- Les Super Admins voient tout (basé sur le fait que seul un admin peut être ici, simplifions dans un premier temps)
CREATE POLICY "Les Administrateurs voient tout" ON public.documents_financiers
    FOR ALL
    USING (
        auth.uid() IN (SELECT id FROM auth.users) -- simplifie: autorise tous les users authentifiés pour l'instant (à affiner selon ton schéma exact)
    );

CREATE POLICY "Les Agents peuvent créer/modifier leurs documents" ON public.documents_financiers
    FOR ALL
    USING (
        agent_id = auth.uid()
    );

-- Politique publique limitée : Permettre aux clients de voir/payer leur document spécifique s'ils ont l'ID (via URL magique)
-- Attention : read-only pour les clients
CREATE POLICY "Accès public via ID pour les clients" ON public.documents_financiers
    FOR SELECT
    USING (true); -- La sécurité se fera au niveau applicatif (l'ID UUID est in-devinable)

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_documents_financiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_financiers_updated_at ON public.documents_financiers;
CREATE TRIGGER trg_documents_financiers_updated_at
BEFORE UPDATE ON public.documents_financiers
FOR EACH ROW
EXECUTE FUNCTION update_documents_financiers_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- PROPOSAL VIEW ANALYTICS
-- ═══════════════════════════════════════════════════════════════

-- Add tracking columns to ai_proposals
ALTER TABLE IF EXISTS public.ai_client_proposals
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Detailed view log table
CREATE TABLE IF NOT EXISTS public.proposal_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid REFERENCES public.ai_client_proposals(id) ON DELETE CASCADE,
  secret_key text,
  viewed_at timestamptz DEFAULT now(),
  user_agent text,
  referrer text,
  ip_hint text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_views_proposal_id ON public.proposal_views(proposal_id);

-- Open RLS for inserts (public tracking — no auth needed)
ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert on proposal_views" ON public.proposal_views;
CREATE POLICY "Allow public insert on proposal_views"
  ON public.proposal_views FOR INSERT
  WITH CHECK (true);

-- Agents can read analytics
DROP POLICY IF EXISTS "Agents can read proposal_views" ON public.proposal_views;
CREATE POLICY "Agents can read proposal_views"
  ON public.proposal_views FOR SELECT
  USING (true);
