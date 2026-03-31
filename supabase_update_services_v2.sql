-- ============================================================
-- MISE À JOUR : Contenu des services passeport, logement, business
-- + Insertion des paramètres frontend (calculateur, autres services)
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. PASSEPORT & DOCUMENTS
-- "Pièces à fournir" réelles pour les afro-descendants diaspora
UPDATE public.services SET
    title        = 'Passeport & Documents',
    subtitle     = 'Documents officiels et accompagnement pour la diaspora béninoise',
    description  = 'Nous prenons en charge l''ensemble des démarches liées à l''obtention ou au renouvellement de votre passeport biométrique béninois. Constitution du dossier, coordination avec les autorités compétentes et suivi jusqu''à la remise de votre titre — un accompagnement structuré, sans improvisation.',
    features     = '[
        "Copie intégrale du passeport en cours de validité",
        "Acte de naissance certifié conforme délivré par la mairie béninoise",
        "Certificat de nationalité béninoise (Tribunal de Première Instance)",
        "Carte d''Identité Personnelle (CIP A) en cours de validité",
        "Extrait de casier judiciaire béninois — Bulletin n°3 (moins de 3 mois)",
        "Justificatif de domicile de moins de 3 mois (quittance ou bail)",
        "4 photos d''identité biométriques (fond blanc, 3,5 × 4,5 cm, sans lunettes)",
        "Formulaire officiel de demande de passeport rempli et signé"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Pack Standard — Passeport ordinaire", "price": "75 000 FCFA"},
        {"label": "Pack VIP — Traitement express jour-J", "price": "350 000 FCFA"},
        {"label": "Renouvellement accompagné", "price": "50 000 FCFA"}
    ]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'passeport';

-- ============================================================
-- 2. ACHETER OU LOUER (logement)
-- Informations foncières réelles au Bénin
-- ============================================================
UPDATE public.services SET
    title        = 'Acheter ou Louer',
    subtitle     = 'Vérifiez, informez-vous et Sécurisez vos transactions foncières et immobilières',
    description  = 'L''immobilier au Bénin offre de réelles opportunités — à condition de savoir naviguer dans un marché foncier qui requiert vigilance et expertise juridique. Nous vous accompagnons de la sélection du bien à la signature de l''acte notarié, en veillant à chaque étape à la solidité juridique de votre acquisition.',
    features     = '[
        "Vérification du Titre Foncier (TF) et purge des oppositions cadastrales",
        "Bornage et identification parcellaire auprès de l''ANDF",
        "Due diligence juridique sur la chaîne de propriété",
        "Accompagnement notarial et rédaction des actes de vente ou de bail",
        "Gestion locative et suivi des relations bailleurs-locataires",
        "Conseil en fiscalité immobilière (droits de mutation, impôts fonciers)"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Accompagnement en Acquisition Foncière", "price": "3% du montant"},
        {"label": "Gestion locative mensuelle", "price": "8% des loyers"},
        {"label": "Consultation juridique", "price": "25 000 FCFA"}
    ]'::jsonb,
    price_display = 'À partir de 25 000 FCFA'
WHERE slug = 'logement';

-- ============================================================
-- 3. CRÉATION D'ENTREPRISE (business)
-- ============================================================
UPDATE public.services SET
    title        = 'Création d''Entreprise',
    subtitle     = 'Lancez votre business. Études de marché, créations de sociétés et implantation, Recherche de Partenaires.',
    description  = 'Pendant que le monde hésite, le Bénin avance à pas de géant. Ne soyez pas spectateur de l''émergence du Bénin : devenez-en un acteur. Créer une entreprise ici peut sembler complexe, mais avec le bon partenaire, c''est une démarche maîtrisée. De la formalisation de votre idée à votre premier client, nous balisons chaque étape du parcours. Le Bénin est une terre d''opportunités pour les afro-descendants qui souhaitent investir et s''impliquer. Le gouvernement accompagne les créateurs d''entreprises et favorise le développement d''activités à fort potentiel. Votre projet commence aujourd''hui — nous en posons les fondations juridiques et fiscales solides.',
    features     = '[
        "Création de Société Clé-en-main (72h chrono)",
        "Fiscalité Optimisée & Conseil Comptable Stratégique",
        "Ouverture de Compte Bancaire Professionnel",
        "Domiciliation Temporaire et Prestigieuse au Cœur de Cotonou",
        "Cabinet de recrutement — Sélection de talents locaux",
        "Mise en relation privilégiée avec des personnes influentes"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Création SARL", "price": "150 000 FCFA"},
        {"label": "Création SA", "price": "250 000 FCFA"},
        {"label": "Accompagnement complet", "price": "Sur devis"}
    ]'::jsonb,
    price_display = 'À partir de 150 000 FCFA'
WHERE slug = 'business';

-- ============================================================
-- 4. Paramètre : calculateur de prix passeport/nationalité
-- Valeur 'true' = visible | 'false' = masqué
-- Modifiable depuis Admin → Paramètres → Vitrine Publique
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'passeport_show_calculator') THEN
        INSERT INTO public.settings (key, value)
        VALUES ('passeport_show_calculator', 'true');
    END IF;
END $$;

-- ============================================================
-- 5. Paramètre : liste JSON des services complémentaires (page Autres)
-- Modifiable depuis Admin → Paramètres → Vitrine Publique
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'autres_services_json') THEN
        INSERT INTO public.settings (key, value)
        VALUES (
            'autres_services_json',
            '[
                {"icon": "Car",          "title": "Transport",                "description": "Transfert aéroport et location de véhicule avec chauffeur privé"},
                {"icon": "HeartPulse",   "title": "Santé",                    "description": "Mise en relation avec médecins et cliniques partenaires à Cotonou"},
                {"icon": "GraduationCap","title": "Scolarité",                "description": "Inscription scolaire dans les établissements francophones et suivi pédagogique"},
                {"icon": "FileCheck",    "title": "Démarches administratives","description": "Accompagnement pour visa, titre de séjour et démarches locales courantes"}
            ]'
        );
    END IF;
END $$;

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT slug, title, subtitle,
       jsonb_array_length(features) AS nb_pieces,
       jsonb_array_length(pricing_options) AS nb_tarifs,
       price_display
FROM public.services
WHERE slug IN ('passeport', 'logement', 'business')
ORDER BY slug;
