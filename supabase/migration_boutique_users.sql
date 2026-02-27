-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Boutique E-Commerce + Gestion Utilisateurs
-- Retour Gagnant Benin
-- ═══════════════════════════════════════════════════════════════

-- 1. Table 'products' — Articles de la boutique
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  long_description TEXT DEFAULT '',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10,2),
  currency TEXT DEFAULT 'XOF',
  images JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'general',
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);


-- 2. Table 'orders' — Commandes passees
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_title TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('kkiapay', 'fedapay', 'zeyow')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  cart_items JSONB DEFAULT '[]'::jsonb,
  coupon_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);


-- 3. Table 'user_profiles' — Profils utilisateurs (SuperAdmin + Agents)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT DEFAULT '',
  role TEXT DEFAULT 'agent' CHECK (role IN ('superadmin', 'agent')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);


-- 4. Payment settings seeds
-- ═══════════════════════════════════════════════════════════════
-- Insert default payment settings (only if they don't already exist)
INSERT INTO settings (key, value, category)
VALUES
  ('kkiapay_enabled', 'false', 'payment'),
  ('kkiapay_sandbox', 'true', 'payment'),
  ('kkiapay_public_key', '', 'payment'),
  ('kkiapay_private_key', '', 'payment'),
  ('kkiapay_secret_key', '', 'payment'),
  ('fedapay_enabled', 'false', 'payment'),
  ('fedapay_sandbox', 'true', 'payment'),
  ('fedapay_public_key', '', 'payment'),
  ('fedapay_secret_key', '', 'payment'),
  ('zeyow_enabled', 'false', 'payment'),
  ('zeyow_sandbox', 'false', 'payment'),
  ('zeyow_redirect_url', '', 'payment')
ON CONFLICT (key) DO NOTHING;

-- Frontend customization settings
INSERT INTO settings (key, value, category)
VALUES
  ('site_slogan', 'Votre Retour, Notre Mission', 'customization'),
  ('hero_title', 'RETOUR GAGNANT BENIN', 'customization'),
  ('hero_subtitle', 'L''agence qui transforme votre retour au Benin en succes', 'customization'),
  ('contact_email', 'contact@retourgagnant.com', 'customization'),
  ('contact_phone', '+229 XX XX XX XX', 'customization'),
  ('contact_address', 'Cotonou, Benin', 'customization'),
  ('social_facebook', '', 'customization'),
  ('social_instagram', '', 'customization'),
  ('social_twitter', '', 'customization'),
  ('social_linkedin', '', 'customization')
ON CONFLICT (key) DO NOTHING;


-- 5. Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════

-- Products: public read, authenticated write
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone"
  ON products FOR SELECT USING (true);

CREATE POLICY "Products are editable by authenticated users"
  ON products FOR ALL USING (auth.role() = 'authenticated');

-- Orders: authenticated only
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders are managed by authenticated users"
  ON orders FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Orders can be created by anyone"
  ON orders FOR INSERT WITH CHECK (true);

-- User profiles: authenticated read, superadmin write
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User profiles are viewable by authenticated users"
  ON user_profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "User profiles are editable by authenticated users"
  ON user_profiles FOR ALL USING (auth.role() = 'authenticated');

-- 6. Table 'coupons' — Promos et réductions
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour coupons
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons are viewable by everyone" ON coupons FOR SELECT USING (true);
CREATE POLICY "Coupons are editable by authenticated users" ON coupons FOR ALL USING (auth.role() = 'authenticated');


-- 7. Table 'notifications' — Alertes administrateurs
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notifications are viewable by authenticated users" ON notifications FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Notifications are editable by authenticated users" ON notifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Notifications can be inserted by anyone" ON notifications FOR INSERT WITH CHECK (true);


-- 8. Fonctions Stock (RPC) — Utilisé par les webhooks
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION decrement_stock(p_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(stock - qty, 0)
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_coupon_use(c_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupons
  SET current_uses = current_uses + 1
  WHERE id = c_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ═══════════════════════════════════════════════════════════════
