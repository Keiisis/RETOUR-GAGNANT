-- ==============================================================================
-- SCRIPT DE RÉPARATION : À EXÉCUTER DANS LE SQL EDITOR DE SUPABASE
-- CORRIGE LA TABLE SERVICES SUPPRIMÉE PAR ERREUR
-- ==============================================================================

-- 1. On s'assure que la table a la bonne structure avec toutes les colonnes requises
DROP TABLE IF EXISTS public.services;

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

-- 2. On insère les 6 vrais services avec leurs données complètes
INSERT INTO public.services (title, description, icon, icon_type, slug, image_url, color, "order") VALUES
('Passeport & Documents', 'Obtention rapide de vos documents officiels. Le Sceptre (Récade) ouvre toutes les portes.', 'FileText', 'passport', 'passeport', '/assets/icones/icone_Passeport_Documents.png', '#008751', 1),
('Acheter ou Louer', 'Sécurisez vos transactions foncières. Votre forteresse (Tata) au Bénin.', 'Home', 'tata', 'logement', '/assets/icones/icone_Acheter_ou_louer.png', '#FCD116', 2),
('Création d''Entreprise', 'Lancez votre business. Etudes de marché, créations de sociétés et implantation, Recherche de Partenaires.', 'Briefcase', 'drum', 'business', '/assets/icones/icone_Creation_d_Entreprise.png', '#E8112D', 3),
('Guide Culturel', 'Reconnectez-vous avec vos racines. La richesse des Cauris. Cérémonie du Nom et validation à l''état civil.', 'Map', 'cowrie', 'culture', '/assets/icones/icone_Guide_culturel.png', '#008751', 4),
('Construction', 'Bâtissez pour la postérité. Aide aux suivis de chantiers. L''ancrage de l''Assin.', 'HardHat', 'assin', 'construction', '/assets/icones/icone_Construction.png', '#FCD116', 5),
('Investissement', 'Opportunités d''affaires rentables. Faites fructifier votre héritage.', 'TrendingUp', 'tree', 'investissement', '/assets/icones/icone_Investissement.png', '#E8112D', 6);
