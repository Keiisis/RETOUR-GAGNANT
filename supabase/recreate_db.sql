-- =======================================================
-- RECREATION COMPLETE DE LA BASE DE DONNEES
-- PROJET: RETOUR GAGNANT BENIN
-- VERSION: 2.0 — Données complètes restaurées
-- =======================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SUPPRESSION DES TABLES EXISTANTES (POUR REPARTIR DE ZERO)
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.gallery CASCADE;
DROP TABLE IF EXISTS public.patrimoine CASCADE;
DROP TABLE IF EXISTS public.testimonials CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- 3. CREATION DES TABLES

-- ** SETTINGS **
CREATE TABLE public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ** PRODUCTS **
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    long_description TEXT DEFAULT '',
    price DECIMAL(15,2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(15,2),
    currency TEXT DEFAULT 'XOF',
    images JSONB DEFAULT '[]'::jsonb,
    category TEXT DEFAULT 'Artisanat' CHECK (category IN ('Mode', 'Artisanat', 'Alimentaire', 'Culturel', 'Accessoires', 'Autre')),
    stock INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ** COUPONS **
CREATE TABLE public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    discount_type TEXT DEFAULT 'percentage', -- 'percentage' or 'fixed'
    discount_value DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(15,2) DEFAULT 0,
    max_uses INTEGER DEFAULT 100,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** ORDERS **
CREATE TABLE public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_title TEXT DEFAULT '',
    quantity INTEGER DEFAULT 1,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    cart_items JSONB DEFAULT '[]'::jsonb,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** NOTIFICATIONS **
CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** USER PROFILES (ADMIN/AGENT) **
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY, -- Normalement lié à auth.users.id
    full_name TEXT DEFAULT '',
    role TEXT DEFAULT 'agent', -- 'admin', 'agent'
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** SERVICES (avec icon_type et slug pour le frontend) **
CREATE TABLE public.services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT 'ShieldCheck',
    icon_type TEXT DEFAULT 'passport',
    slug TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    color TEXT DEFAULT '#008751',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** TESTIMONIALS **
CREATE TABLE public.testimonials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    text TEXT DEFAULT '',
    rating INTEGER DEFAULT 5,
    service TEXT DEFAULT '',
    photo TEXT DEFAULT '',
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** PATRIMOINE **
CREATE TABLE public.patrimoine (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    description TEXT DEFAULT '',
    imageName TEXT DEFAULT '',
    gallery JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** GALLERY **
CREATE TABLE public.gallery (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT DEFAULT '',
    category TEXT DEFAULT 'general',
    type TEXT DEFAULT 'gallery', -- 'gallery' (mosaic) or 'hero' (slides)
    location TEXT DEFAULT 'Bénin',
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ** MESSAGES **
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nom TEXT NOT NULL,
    prenom TEXT DEFAULT '',
    email TEXT NOT NULL,
    sujet TEXT DEFAULT '',
    message TEXT NOT NULL,
    lu BOOLEAN DEFAULT false,
    type TEXT DEFAULT 'contact', -- 'contact', 'rdv'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. POLITIQUES RLS (SIMPLIFIÉES - ACCÈS PUBLIC EN LECTURE POUR LA PLUPART)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin update settings" ON public.settings FOR ALL USING (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin all products" ON public.products FOR ALL USING (true);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admin all services" ON public.services FOR ALL USING (true);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read testimonials" ON public.testimonials FOR SELECT USING (approved = true);
CREATE POLICY "Admin all testimonials" ON public.testimonials FOR ALL USING (true);

ALTER TABLE public.patrimoine ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read patrimoine" ON public.patrimoine FOR SELECT USING (true);
CREATE POLICY "Admin all patrimoine" ON public.patrimoine FOR ALL USING (true);

ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read gallery" ON public.gallery FOR SELECT USING (true);
CREATE POLICY "Admin all gallery" ON public.gallery FOR ALL USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all messages" ON public.messages FOR ALL USING (true);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all orders" ON public.orders FOR ALL USING (true);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (is_active = true);
CREATE POLICY "Admin all coupons" ON public.coupons FOR ALL USING (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all notifications" ON public.notifications FOR ALL USING (true);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all user_profiles" ON public.user_profiles FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════
-- PREMIUM FEATURES TABLES
-- ═══════════════════════════════════════════════════════

-- Dossier Tracking (Nexus Tracker)
CREATE TABLE IF NOT EXISTS public.dossier_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    num_dossier TEXT NOT NULL UNIQUE,
    client_nom TEXT NOT NULL,
    client_prenom TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_whatsapp TEXT DEFAULT '',
    service_type TEXT DEFAULT 'general',
    statut TEXT DEFAULT 'reception' CHECK (statut IN (
        'reception', 'verification', 'traitement', 'validation', 'finalisation', 'termine', 'annule'
    )),
    etapes JSONB DEFAULT '[
        {"id": 1, "label": "Réception du dossier", "status": "completed", "date": null, "note": ""},
        {"id": 2, "label": "Vérification des documents", "status": "pending", "date": null, "note": ""},
        {"id": 3, "label": "Traitement administratif", "status": "pending", "date": null, "note": ""},
        {"id": 4, "label": "Validation finale", "status": "pending", "date": null, "note": ""},
        {"id": 5, "label": "Finalisation & Remise", "status": "pending", "date": null, "note": ""}
    ]'::jsonb,
    documents_manquants JSONB DEFAULT '[]'::jsonb,
    progression INTEGER DEFAULT 20,
    notes_internes TEXT DEFAULT '',
    agent_assigne TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dossier_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public search dossier" ON public.dossier_tracking FOR SELECT USING (true);
CREATE POLICY "Admin all dossier_tracking" ON public.dossier_tracking FOR ALL USING (true);

-- Voice Messages
CREATE TABLE IF NOT EXISTS public.voice_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_nom TEXT DEFAULT '',
    client_prenom TEXT DEFAULT '',
    client_email TEXT DEFAULT '',
    client_whatsapp TEXT DEFAULT '',
    transcript TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    source TEXT DEFAULT 'chat' CHECK (source IN ('chat', 'support_form')),
    is_read BOOLEAN DEFAULT false,
    agent_response TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert voice_messages" ON public.voice_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all voice_messages" ON public.voice_messages FOR ALL USING (true);

-- Eligibility Results (L'Oracle)
CREATE TABLE IF NOT EXISTS public.eligibility_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_nom TEXT DEFAULT '',
    client_prenom TEXT DEFAULT '',
    client_email TEXT DEFAULT '',
    client_whatsapp TEXT DEFAULT '',
    answers JSONB DEFAULT '{}'::jsonb,
    recommended_service TEXT DEFAULT '',
    recommended_slug TEXT DEFAULT '',
    eligibility_score INTEGER DEFAULT 0,
    has_origins BOOLEAN DEFAULT false,
    objective TEXT DEFAULT '',
    is_contacted BOOLEAN DEFAULT false,
    agent_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.eligibility_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert eligibility" ON public.eligibility_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all eligibility" ON public.eligibility_results FOR ALL USING (true);

-- =======================================================
-- 5. SEED DATA — CONTENU INITIAL COMPLET
-- =======================================================

-- ═══════════════════════════════════════════════════════
-- SETTINGS: Configuration Email (SMTP)
-- ═══════════════════════════════════════════════════════
INSERT INTO public.settings (key, value, category) VALUES
('email_smtp_host', 'smtp.gmail.com', 'email'),
('email_smtp_port', '587', 'email'),
('email_smtp_user', 'contact@retour-gagnant.bj', 'email'),
('email_smtp_pass', 'votre_mot_de_passe_app', 'email'),
('email_from_name', 'Retour Gagnant', 'email'),
('email_from_email', 'contact@retour-gagnant.bj', 'email'),
('email_admin_destination', 'admin@retour-gagnant.bj', 'email');

-- ═══════════════════════════════════════════════════════
-- SETTINGS: Personnalisation Frontend (avec /notre-histoire dans la navbar)
-- ═══════════════════════════════════════════════════════
INSERT INTO public.settings (key, value, category) VALUES
('frontend_hero_video', '/videos/hero.mp4', 'frontend'),
('frontend_hero_audio', '/audio/benin-ambiance.mp3', 'frontend'),
('frontend_hero_title', 'INVESTISSEZ DANS L''HÉRITAGE DU BÉNIN', 'frontend'),
('frontend_hero_subtitle', 'Découvrez des opportunités uniques entre tradition et modernité', 'frontend'),
('frontend_colors_primary', '#FCD116', 'frontend'),
('frontend_navbar_json', '[{"label":"Accueil","href":"/"},{"label":"Notre Histoire","href":"/notre-histoire"},{"label":"Patrimoine","href":"/patrimoine"},{"label":"Services","href":"/services"},{"label":"Boutique","href":"/boutique"},{"label":"Contact","href":"/contact"}]', 'frontend');

-- ═══════════════════════════════════════════════════════
-- SERVICES — Les 6 services culturels originaux (avec icon_type + slug)
-- ═══════════════════════════════════════════════════════
INSERT INTO public.services (title, description, icon, icon_type, slug, image_url, color, "order") VALUES
('Passeport & Documents', 'Obtention rapide de vos documents officiels. Le Sceptre (Récade) ouvre toutes les portes.', 'FileText', 'passport', 'passeport', '/assets/icones/icone_Passeport_Documents.png', '#008751', 1),
('Acheter ou Louer', 'Sécurisez vos transactions foncières. Votre forteresse (Tata) au Bénin.', 'Home', 'tata', 'logement', '/assets/icones/icone_Acheter_ou_louer.png', '#D2691E', 2),
('Création d''Entreprise', 'Lancez votre business. Etudes de marché, créations de sociétés et implantation, Recherche de Partenaires.', 'Briefcase', 'drum', 'business', '/assets/icones/icone_Creation_d_Entreprise.png', '#FCD116', 3),
('Guide Culturel', 'Reconnectez-vous avec vos racines. La richesse des Cauris. Cérémonie du Nom et validation à l''état civil.', 'Compass', 'cowrie', 'culture', '/assets/icones/icone_Guide_culturel.png', '#E8112D', 4),
('Construction', 'Bâtissez pour la postérité. Aide aux suivis de chantiers. L''ancrage de l''Assin.', 'Hammer', 'assin', 'construction', '/assets/icones/icone_Construction.png', '#008751', 5),
('Investissement', 'Opportunités d''affaires rentables. Faites fructifier votre héritage.', 'TrendingUp', 'tree', 'investissement', '/assets/icones/icone_Investissement.png', '#FCD116', 6);

-- ═══════════════════════════════════════════════════════
-- PATRIMOINE — Les 12 items complets avec les vrais noms d'images
-- Correspond aux fichiers dans /public/assets/patrimoine/
-- ═══════════════════════════════════════════════════════
INSERT INTO public.patrimoine (title, location, description, imageName) VALUES
('Porte du Non-Retour', 'Ouidah, Bénin', 'Mémorial émouvant symbolisant la traite transatlantique. Un lieu de recueillement et de mémoire.', 'Porte du Non-Retour.jpg'),
('Palais Royaux d''Abomey', 'Abomey, Bénin', 'Inscrit au patrimoine mondial de l''UNESCO. Vestiges de la puissance du Royaume de Dahomey.', 'Palais Royaux Abomey.jpg'),
('Cité Lacustre de Ganvié', 'Lac Nokoué, Bénin', 'La Venise de l''Afrique, entièrement bâtie sur l''eau. Cité lacustre unique aux habitations sur pilotis.', 'Cité Lacustre Ganvié.jpg'),
('Tata Somba', 'Atacora, Bénin', 'Architecture forteresse unique au monde. Habitat traditionnel du peuple Somba.', 'TATA SOMBA.jpg'),
('Zangbeto', 'Sud Bénin', 'Gardien de la nuit et police traditionnelle vaudou. Masque sacré de la culture Goun.', 'Zangpeto.jpg'),
('Chutes de Kota', 'Natitingou, Bénin', 'Un havre de fraîcheur et de nature préservée. Cascade spectaculaire dans l''Atacora.', 'Chutes de Kota.jpg'),
('Place de l''Amazone', 'Cotonou, Bénin', 'Hommage aux guerrières Agoodjié du Dahomey. Statue monumentale au cœur de Cotonou.', 'place-amazone.jpg'),
('Monument Bio Guerra', 'Parakou, Bénin', 'Héros de la résistance nationale contre la colonisation française.', 'bio-guera.jpg'),
('Temple des Pythons', 'Ouidah, Bénin', 'Site sacré et culturel emblématique. Temple vaudou abritant des dizaines de pythons royaux.', 'ouidah-temple-python-3.jpg'),
('Grand-Popo', 'Mono, Bénin', 'Cité balnéaire entre mer et fleuve. Station paradisiaque sur la côte atlantique.', 'Grand-Popo.jpg'),
('Mur de Fresques', 'Cotonou, Bénin', 'Art urbain retraçant l''histoire du Bénin. Fresques murales colorées au cœur de la ville.', 'Mur de Fresque de Cotonou.jpg'),
('Parc de la Pendjari', 'Tanguiéta, Bénin', 'Sanctuaire sauvage de la biodiversité. Réserve de biosphère abritant lions, éléphants et buffles.', 'Parc Pendjari.jpg');

-- ═══════════════════════════════════════════════════════
-- GALLERY — Photos pour le diaporama et la galerie
-- ═══════════════════════════════════════════════════════
INSERT INTO public.gallery (url, title, category, type, location, is_featured) VALUES
('https://images.unsplash.com/photo-1628102422315-77983656113b?q=80&w=2000&auto=format&fit=crop', 'Danse Traditionnelle', 'Culture', 'gallery', 'Porto-Novo', true),
('https://images.unsplash.com/photo-1547471080-7cc203206c88?q=80&w=2000&auto=format&fit=crop', 'Marché Dantokpa', 'Vie Locale', 'gallery', 'Cotonou', true);

-- ═══════════════════════════════════════════════════════
-- TESTIMONIALS — Témoignages clients
-- ═══════════════════════════════════════════════════════
INSERT INTO public.testimonials (name, location, text, rating, service, approved) VALUES
('Samuel Dossou', 'Paris, France', 'Grâce à Retour Gagnant, j''ai pu suivre la construction de ma villa à Cotonou sans stress. Une équipe formidable !', 5, 'Construction', true),
('Angélique Kidjo (Fan)', 'Bénou, Bénin', 'Une initiative qui nous reconnecte vraiment à nos racines.', 5, 'Culture', true);

-- ═══════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════
-- PRODUCTS — Produits boutique
-- ═══════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════
-- MESSAGES — Exemple de message
-- ═══════════════════════════════════════════════════════
INSERT INTO public.messages (nom, prenom, email, sujet, message, type) VALUES
('Dufour', 'Jean-Paul', 'jp.dufour@example.com', 'Infos Construction', 'Bonjour, j''aimerais avoir un devis pour une maison de 3 chambres.', 'contact');
