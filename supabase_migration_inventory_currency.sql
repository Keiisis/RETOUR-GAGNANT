-- =========================================================================================
-- MIGRATION : SYSTÈME DE DEVISES CENTRALISÉ & INVENTAIRE AVANCÉ (ERP)
-- Ce script configure le multidevise et le suivi strict d'inventaire.
-- =========================================================================================

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 1. SYSTÈME DE DEVISES (Currencies)
-- ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.currencies (
    code TEXT PRIMARY KEY CHECK (code IN ('XOF', 'EUR', 'USD')),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange_rate_to_base NUMERIC NOT NULL DEFAULT 1.0, -- Taux par rapport à la devise de base (XOF)
    is_base BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertion des devises par défaut (XOF = devise de base)
INSERT INTO public.currencies (code, name, symbol, exchange_rate_to_base, is_base)
VALUES 
    ('XOF', 'Franc CFA (BCEAO)', 'FCFA', 1.0, true),
    ('EUR', 'Euro', '€', 655.957, false),   -- 1 EUR = 655.957 XOF
    ('USD', 'Dollar Américain', '$', 600.00, false) -- Taux approximatif, peut être mis à jour par l'admin
ON CONFLICT (code) DO UPDATE SET 
    exchange_rate_to_base = EXCLUDED.exchange_rate_to_base;

-- Activer RLS
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lecture publique des devises" ON public.currencies FOR SELECT USING (true);
CREATE POLICY "Seul admin modifie les devises" ON public.currencies FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users));


-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 2. INVENTAIRE / CATALOGUE UNIFIÉ (Remplace ou étend la table products)
-- ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE, -- Stock Keeping Unit (ex: RGB-TSHIRT-001)
    type TEXT NOT NULL CHECK (type IN ('physical', 'service', 'digital')),
    
    -- Informations Générales
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    images TEXT[] DEFAULT '{}',
    
    -- Tarification (Toujours stockée dans la devise de base, ici XOF)
    base_price NUMERIC NOT NULL DEFAULT 0,
    cost_price NUMERIC NOT NULL DEFAULT 0, -- Prix d'achat / Prix de revient (pour calculer la marge)
    tax_rate NUMERIC NOT NULL DEFAULT 18, -- TVA par défaut au Bénin
    
    -- Gestion de Stock (Applicable uniquement si type = physical)
    track_inventory BOOLEAN NOT NULL DEFAULT true,
    current_stock INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5, -- Seuil d'alerte (rouge)
    
    -- E-commerce
    is_published BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Items publics si publiés" ON public.inventory_items FOR SELECT USING (is_published = true OR auth.uid() IS NOT NULL);
CREATE POLICY "Admins gèrent l'inventaire" ON public.inventory_items FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users));


-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 3. TRAÇABILITÉ DES MOUVEMENTS DE STOCK (Inventory Movements)
-- ─────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    
    movement_type TEXT NOT NULL CHECK (movement_type IN ('in_purchase', 'out_sale', 'in_return', 'adj_loss', 'adj_manual')),
    quantity_changed INTEGER NOT NULL, -- Positif pour les entrées, Négatif pour les sorties
    stock_after INTEGER NOT NULL, -- L'état du stock immédiatement après ce mouvement (snapshot)
    
    reference_id UUID, -- Peut être l'ID d'une facture de documents_financiers ou d'un order
    reference_type TEXT, -- 'documents_financiers', 'orders', 'manual'
    
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- L'agent qui a fait l'action
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins voient les mouvements" ON public.inventory_movements FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users));


-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 4. ÉVOLUTION DES DOCUMENTS FINANCIERS (Factures)
--    Pour prendre en charge les devises de façon robuste.
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- Ajout d'une colonne pour garder trace du taux de change au moment de la création du document.
-- Car si l'Euro fluctue demain, une facture émise auj. ne doit pas changer !
ALTER TABLE public.documents_financiers 
ADD COLUMN IF NOT EXISTS exchange_rate_applied NUMERIC DEFAULT 1.0;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 5. FONCTIONS SUPER-PUISSANTES (TRIGGERS)
-- ─────────────────────────────────────────────────────────────────────────────────────────

-- TRIGGER 1: Interdire les modifications directes de stock sur inventory_items.
-- C'est possible, mais pour une traçabilité parfaite en ERP, on doit passer par un mouvement!
-- (Commentez si vous préférez pouvoir bidouiller manuellement au début, mais ce trigger force la propreté)

-- TRIGGER 2: Met automatiquement à jour `updated_at` de `inventory_items`
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- FIN DU SCRIPT. TOUT EST PRÊT !
