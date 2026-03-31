-- ============================================================
-- MISE À JOUR : Guide Culturel, Suivi de Chantier, Investissement
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. GUIDE CULTUREL (slug: culture)
UPDATE public.services SET
    title        = 'Guide Culturel',
    subtitle     = 'Reconnectez-vous avec vos racines. La richesse des Cauris.',
    description  = 'Le Bénin est l''un des berceaux les plus vivants de la culture africaine. Loin des circuits touristiques standardisés, nous vous proposons une immersion sincère dans les traditions, les savoirs et les rencontres qui font l''identité profonde de ce pays. Ici, la culture se vit, elle ne se contemple pas de loin.',
    features     = '[
        "Consultation du Fa — oracle traditionnel yoruba-fon",
        "Cérémonie du Nom et validation à l''état civil",
        "Soins par les plantes et approche de la médecine ancestrale",
        "Audience privée avec dignitaires et rois traditionnels",
        "Initiation et sensibilisation à la culture vodoun",
        "Programmes de visite : Ganvié, Ouidah, Abomey, Porto-Novo",
        "Guide historien expert et passionné par l''histoire du Bénin",
        "Ateliers culinaires — recettes et saveurs béninoises",
        "Découverte de l''artisanat local et des savoir-faire traditionnels"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Circuit culturel (3 jours)", "price": "120 000 FCFA/pers"},
        {"label": "Immersion complète (7 jours)", "price": "280 000 FCFA/pers"},
        {"label": "Programme sur mesure", "price": "Nous consulter"}
    ]'::jsonb,
    price_display = 'À partir de 80 000 FCFA/pers'
WHERE slug = 'culture';

-- ============================================================
-- 2. SUIVI DE CHANTIER (slug: construction)
-- ============================================================
UPDATE public.services SET
    title        = 'Suivi de Chantier',
    subtitle     = 'Bâtissez pour la postérité. Votre chantier, géré avec rigueur.',
    description  = 'Construire au Bénin depuis l''étranger, c''est possible — à condition d''être bien entouré. Entre les devis approximatifs, les délais non respectés et les matériaux de qualité variable, les risques sont réels. Nous agissons comme votre représentant sur place : présents à chaque étape, exigeants sur la qualité, transparents dans nos rapports. Votre investissement mérite un suivi professionnel.',
    features     = '[
        "Aide à l''achat et à la location de terrain ou de bien immobilier",
        "Bureau d''architecte — conception et plans techniques",
        "Surveillance et contrôle de chantier (visites régulières, tous moyens)",
        "Vérification et validation des factures fournisseurs",
        "Achats de matériaux — sélection et négociation",
        "Rapports WhatsApp hebdomadaires (photos et vidéos)",
        "Mise en relation et coordination des intervenants du chantier",
        "Livraison et nettoyage du chantier clé en main"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Suivi mensuel", "price": "75 000 FCFA/mois"},
        {"label": "Mission complète", "price": "5% du montant travaux"},
        {"label": "Audit ponctuel", "price": "50 000 FCFA"}
    ]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'construction';

-- ============================================================
-- 3. INVESTISSEMENT (slug: investissement)
-- ============================================================
UPDATE public.services SET
    title        = 'Investissement',
    subtitle     = 'Opportunités d''affaires rentables. Faites fructifier votre héritage.',
    description  = 'Le Bénin connaît une dynamique économique réelle, portée par des réformes structurelles et des investissements publics soutenus. Les opportunités existent — dans l''immobilier, l''agriculture, le commerce et les services — mais elles demandent une lecture fine du terrain. Nous vous aidons à identifier des projets sérieux, à évaluer les risques réels et à structurer vos investissements dans le respect du cadre juridique local.',
    features     = '[
        "Vente exclusive de particuliers à particuliers (terrain, immeuble, maison)",
        "Projets agricoles rentables et autres secteurs porteurs",
        "Évaluation approfondie des risques financiers, juridiques et opérationnels",
        "Veilles d''opportunités — marchés, appels d''offres, partenariats",
        "Suivi et optimisation de vos investissements au Bénin",
        "Stratégies fiscales adaptées au contexte local"
    ]'::jsonb,
    pricing_options = '[
        {"label": "Étude de marché", "price": "200 000 FCFA"},
        {"label": "Accompagnement complet", "price": "Sur devis"},
        {"label": "Consultation stratégique", "price": "50 000 FCFA"}
    ]'::jsonb,
    price_display = 'À partir de 50 000 FCFA'
WHERE slug = 'investissement';

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT slug, title, subtitle,
       jsonb_array_length(features)        AS nb_prestations,
       jsonb_array_length(pricing_options) AS nb_tarifs,
       price_display
FROM public.services
WHERE slug IN ('culture', 'construction', 'investissement')
ORDER BY slug;
