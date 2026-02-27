-- Insert default frontend customization settings into the "settings" table

INSERT INTO public.settings (key, value)
VALUES 
    -- Médias
    ('frontend_hero_video', '/videos/hero-bg.mp4'),
    ('frontend_hero_audio', '/audio/ambient.mp3'),
    
    -- Textes
    ('frontend_hero_title', 'RETOUR GAGNANT'),
    ('frontend_hero_subtitle', 'Batissons l''avenir de l''Afrique a travers des projets immobiliers, culturels et touristiques d''exception.'),
    
    -- Couleurs (Optionnel pour plus tard)
    ('frontend_colors_primary', '#008751'),
    ('frontend_colors_accent', '#FCD116'),
    
    -- Navigation (Format JSON)
    ('frontend_navbar_json', '[
        {"label": "Accueil", "href": "/"},
        {"label": "Boutique", "href": "/boutique"},
        {"label": "Services", "href": "/services"},
        {"label": "Culture & Tourisme", "href": "/culture"},
        {"label": "Rendez-Vous", "href": "/rendez-vous"},
        {"label": "Contact", "href": "/contact"}
    ]')
ON CONFLICT (key) DO NOTHING;
