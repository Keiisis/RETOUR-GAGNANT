-- ═══════════════════════════════════════════════════════════════
-- MIGRATIONS RPC SUPABASE — Retour Gagnant
-- À exécuter dans Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- DROP préalables pour permettre le changement de type de retour
DROP FUNCTION IF EXISTS reserve_stock(UUID, INT);
DROP FUNCTION IF EXISTS release_stock(UUID, INT);
DROP FUNCTION IF EXISTS decrement_stock(UUID, INT);
DROP FUNCTION IF EXISTS increment_coupon_use(UUID);
DROP FUNCTION IF EXISTS decrement_coupon_use(UUID);

-- ─────────────────────────────────────────────────────────────────
-- 1. reserve_stock
--    Appelée lors de la création de commande (checkout/route.ts).
--    Décrémente le stock atomiquement. Fail-safe si stock insuffisant.
-- ─────────────────────────────────────────────────────────────────
CREATE FUNCTION reserve_stock(p_product_id UUID, p_quantity INT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stock INT;
BEGIN
  -- Verrou exclusif sur la ligne pour éviter les race conditions
  SELECT COALESCE(stock, 0)
  INTO v_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Produit introuvable');
  END IF;

  IF v_stock < p_quantity THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Stock insuffisant (' || v_stock || ' disponible, ' || p_quantity || ' demandé)'
    );
  END IF;

  UPDATE products
  SET stock = stock - p_quantity
  WHERE id = p_product_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 2. release_stock
--    Restaure le stock si le paiement échoue ou si la commande est annulée.
-- ─────────────────────────────────────────────────────────────────
CREATE FUNCTION release_stock(p_product_id UUID, p_quantity INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET stock = COALESCE(stock, 0) + p_quantity
  WHERE id = p_product_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 3. decrement_stock
--    Appelée après vérification du paiement (verify/route.ts).
--    No-op : le stock est déjà réduit par reserve_stock à la création.
--    Conservée pour compatibilité avec le code de vérification.
-- ─────────────────────────────────────────────────────────────────
CREATE FUNCTION decrement_stock(p_id UUID, qty INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Stock already decremented by reserve_stock at order creation.
  -- This function exists for backward compatibility with verify/route.ts.
  NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 4. increment_coupon_use
--    Incrémente le compteur d'utilisation d'un coupon de manière atomique.
-- ─────────────────────────────────────────────────────────────────
CREATE FUNCTION increment_coupon_use(c_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE coupons
  SET current_uses = COALESCE(current_uses, 0) + 1
  WHERE id = c_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 5. decrement_coupon_use
--    Décrémente le compteur (compensation en cas de race condition).
--    GREATEST(0, ...) empêche un compteur négatif.
-- ─────────────────────────────────────────────────────────────────
CREATE FUNCTION decrement_coupon_use(c_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE coupons
  SET current_uses = GREATEST(0, COALESCE(current_uses, 0) - 1)
  WHERE id = c_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────
-- VÉRIFICATION — décommentez et exécutez pour confirmer
-- ─────────────────────────────────────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_type = 'FUNCTION'
--   AND routine_name IN ('reserve_stock','release_stock','decrement_stock','increment_coupon_use','decrement_coupon_use');
