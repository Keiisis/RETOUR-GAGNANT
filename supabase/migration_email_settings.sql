-- Insert default email settings into the "settings" table if they don't exist

INSERT INTO public.settings (key, value)
VALUES 
    ('smtp_host', 'smtp.gmail.com'),
    ('smtp_port', '465'),
    ('smtp_user', 'votre.adresse@gmail.com'),
    ('smtp_pass', ''),
    ('smtp_from_email', 'contact@retourgagnant.bj'),
    ('smtp_from_name', 'Retour Gagnant - Agence')
ON CONFLICT (key) DO NOTHING;
