-- ==============================================================================
-- MIGRATION : À EXÉCUTER DANS LE SQL EDITOR DE SUPABASE
-- Ajoute les colonnes manquantes à la table orders (panier, coupons, livraison)
-- ==============================================================================

-- 1. Colonnes manquantes détectées (shopping cart + coupons + livraison)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cart_items    JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS coupon_id     UUID     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_zone TEXT     DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipping_fee  NUMERIC  DEFAULT 0;

-- 2. Fonctions RPC pour la réservation de stock (nécessaires au checkout)
--    Si elles existent déjà → DROP IF EXISTS puis recréation
DROP FUNCTION IF EXISTS public.reserve_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.release_stock(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.reserve_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  -- Lire le stock actuel (avec verrou)
  SELECT stock INTO v_stock
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produit introuvable');
  END IF;

  IF v_stock IS NULL OR v_stock < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stock insuffisant (' || COALESCE(v_stock::text, '0') || ' disponible(s))');
  END IF;

  UPDATE public.products
  SET stock = stock - p_quantity
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.products
  SET stock = COALESCE(stock, 0) + p_quantity
  WHERE id = p_product_id;
END;
$$;

-- 3. Vérification : afficher la structure actuelle de la table orders
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;
