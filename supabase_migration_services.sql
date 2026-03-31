-- ============================================================
-- MIGRATION : Table services — ajout colonnes manquantes
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Renommer "order" → order_index (compatible avec le code frontend + admin)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'services' AND column_name = 'order'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'services' AND column_name = 'order_index'
    ) THEN
        ALTER TABLE public.services RENAME COLUMN "order" TO order_index;
    END IF;
END $$;

-- 2. Ajouter order_index si elle n'existe pas encore
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 3. Ajouter is_active (pour activer/désactiver un service sans le supprimer)
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mettre tous les services existants comme actifs
UPDATE public.services SET is_active = true WHERE is_active IS NULL;

-- 4. Ajouter subtitle (accroche courte affichée sur la page détail)
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT '';

-- 5. Ajouter features (liste de points forts, JSON array de strings)
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

-- 6. Ajouter pricing_options (tarifs par formule)
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS pricing_options JSONB DEFAULT '[]'::jsonb;

-- 7. Ajouter price_display (prix affiché résumé ex: "À partir de 75 000 FCFA")
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS price_display TEXT DEFAULT '';

-- ============================================================
-- 8. Insérer les 2 nouveaux services s'ils n'existent pas
-- ============================================================

INSERT INTO public.services (title, slug, subtitle, description, features, pricing_options, price_display, icon_type, image_url, color, order_index, is_active)
SELECT
    'Nationalité VIP',
    'nationalite-vip',
    'Obtenir la nationalité béninoise pour la diaspora afro-descendante',
    'Accompagnement personnalisé pour les membres de la diaspora souhaitant obtenir la nationalité béninoise. Suivi de dossier, coordination avec les autorités compétentes et prise en charge prioritaire de vos démarches.',
    '["Constitution et vérification du dossier complet", "Liaison avec le Ministère de la Justice", "Suivi administratif pas à pas", "Accompagnement pour l''apostille et traductions certifiées", "Pack VIP : suivi prioritaire avec référent dédié"]'::jsonb,
    '[{"label": "Accompagnement dossier standard", "price": "150 000 FCFA"}, {"label": "Pack VIP — suivi prioritaire", "price": "350 000 FCFA"}, {"label": "Consultation initiale", "price": "Gratuit"}]'::jsonb,
    'À partir de 150 000 FCFA',
    'recade',
    '',
    '#FCD116',
    7,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'nationalite-vip');

INSERT INTO public.services (title, slug, subtitle, description, features, pricing_options, price_display, icon_type, image_url, color, order_index, is_active)
SELECT
    'Autres Services',
    'autres',
    'Transport, santé, scolarité et démarches du quotidien',
    'Des solutions complémentaires pour faciliter chaque aspect de votre installation au Bénin — de l''aéroport à l''école de vos enfants, en passant par l''accès aux soins et les démarches administratives courantes.',
    '["Transfert aéroport et location de véhicule avec chauffeur", "Mise en relation avec médecins et cliniques partenaires", "Inscription scolaire et suivi pédagogique", "Accompagnement démarches administratives locales"]'::jsonb,
    '[{"label": "Consultation", "price": "Nous contacter"}]'::jsonb,
    'Nous contacter',
    'standard',
    '',
    '#008751',
    8,
    true
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'autres');

-- ============================================================
-- 9. Mettre à jour les features et pricing_options des 6 services existants
--    (si les colonnes viennent d'être ajoutées, elles sont vides)
-- ============================================================

UPDATE public.services SET
    subtitle = 'Obtention et renouvellement de vos documents officiels',
    features = '["Passeport biométrique ordinaire et diplomatique", "Acte de naissance et livret de famille", "Légalisation et apostille de documents", "Procuration et documents notariés", "Suivi de dossier en temps réel"]'::jsonb,
    pricing_options = '[{"label": "Passeport ordinaire", "price": "75 000 FCFA"}, {"label": "Renouvellement", "price": "50 000 FCFA"}, {"label": "Apostille / Légalisation", "price": "Nous consulter"}]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'passeport' AND (features = '[]'::jsonb OR features IS NULL);

UPDATE public.services SET
    subtitle = 'Sécurisez vos transactions foncières et immobilières',
    features = '["Recherche et sélection de biens selon vos critères", "Vérification des titres fonciers et purge des oppositions", "Accompagnement notarial et rédaction des actes", "Gestion locative et état des lieux", "Conseil en fiscalité immobilière"]'::jsonb,
    pricing_options = '[{"label": "Accompagnement achat", "price": "3% du montant"}, {"label": "Gestion locative", "price": "8% des loyers"}, {"label": "Consultation", "price": "25 000 FCFA"}]'::jsonb,
    price_display = 'À partir de 25 000 FCFA'
WHERE slug = 'logement' AND (features = '[]'::jsonb OR features IS NULL);

UPDATE public.services SET
    subtitle = 'De l''idée à l''entreprise opérationnelle au Bénin',
    features = '["Immatriculation au RCCM et obtention du RCCM", "Ouverture de compte bancaire professionnel", "Conseils fiscaux et optimisation de la structure juridique", "Accompagnement pour les autorisations sectorielles", "Mise en relation avec experts-comptables locaux"]'::jsonb,
    pricing_options = '[{"label": "Création SARL", "price": "150 000 FCFA"}, {"label": "Création SA", "price": "250 000 FCFA"}, {"label": "Accompagnement complet", "price": "Sur devis"}]'::jsonb,
    price_display = 'À partir de 150 000 FCFA'
WHERE slug = 'business' AND (features = '[]'::jsonb OR features IS NULL);

UPDATE public.services SET
    subtitle = 'Découvrez le Bénin authentique et son patrimoine vivant',
    features = '["Circuits touristiques personnalisés (Ouidah, Abomey, Ganvié...)", "Guides culturels certifiés et bilingues", "Organisation de séjours clé en main", "Visites de sites classés UNESCO", "Immersion dans les traditions vodoun et royales"]'::jsonb,
    pricing_options = '[{"label": "Circuit court (3 jours)", "price": "120 000 FCFA/pers"}, {"label": "Circuit complet (7 jours)", "price": "280 000 FCFA/pers"}, {"label": "Sur mesure", "price": "Nous consulter"}]'::jsonb,
    price_display = 'À partir de 120 000 FCFA/pers'
WHERE slug = 'culture' AND (features = '[]'::jsonb OR features IS NULL);

UPDATE public.services SET
    subtitle = 'Votre chantier suivi et livré dans les règles de l''art',
    features = '["Maîtrise d''ouvrage déléguée et coordination des corps de métier", "Contrôle qualité et conformité des travaux", "Reporting photographique hebdomadaire", "Sélection et négociation avec les entreprises locales", "Réception des travaux et gestion des réserves"]'::jsonb,
    pricing_options = '[{"label": "Suivi mensuel", "price": "75 000 FCFA/mois"}, {"label": "Mission complète", "price": "5% du montant travaux"}, {"label": "Audit ponctuel", "price": "50 000 FCFA"}]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'construction' AND (features = '[]'::jsonb OR features IS NULL);

UPDATE public.services SET
    subtitle = 'Des opportunités d''affaires concrètes et sécurisées',
    features = '["Identification et analyse d''opportunités d''investissement", "Mise en relation avec partenaires locaux fiables", "Accompagnement pour les formalités d''installation", "Veille économique et sectorielle au Bénin", "Suivi post-investissement et gestion des risques"]'::jsonb,
    pricing_options = '[{"label": "Étude de marché", "price": "200 000 FCFA"}, {"label": "Accompagnement complet", "price": "Sur devis"}, {"label": "Consultation stratégique", "price": "50 000 FCFA"}]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'investissement' AND (features = '[]'::jsonb OR features IS NULL);

-- ============================================================
-- 10. Politique RLS — lecture publique des services actifs
-- ============================================================

-- Activer RLS sur la table services (si pas encore activé)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Public can read active services" ON public.services;
DROP POLICY IF EXISTS "Authenticated users can manage services" ON public.services;

-- Politique : visiteurs anonymes peuvent lire les services actifs
CREATE POLICY "Public can read active services"
    ON public.services FOR SELECT
    USING (is_active = true OR is_active IS NULL);

-- Politique : utilisateurs authentifiés peuvent tout faire (admin)
CREATE POLICY "Authenticated users can manage services"
    ON public.services FOR ALL
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- ============================================================
-- 11. Vérification finale
-- ============================================================
SELECT id, title, slug, is_active, order_index, price_display,
       jsonb_array_length(features) AS nb_features,
       jsonb_array_length(pricing_options) AS nb_pricing
FROM public.services
ORDER BY order_index;
