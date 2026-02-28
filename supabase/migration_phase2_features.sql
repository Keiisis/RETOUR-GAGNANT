-- ═══════════════════════════════════════════════════════
-- MIGRATION PHASE 2: Client Portal, Docs, Blog, Calendar, Analytics, Contracts
-- RETOUR GAGNANT BENIN — v3.0
-- ═══════════════════════════════════════════════════════

-- 1. DOCUMENTS (Upload sécurisé)
CREATE TABLE IF NOT EXISTS public.client_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_email TEXT NOT NULL,
    client_nom TEXT DEFAULT '',
    dossier_id UUID REFERENCES public.dossier_tracking(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'document',  -- 'identite', 'naissance', 'residence', 'photo', 'autre'
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'en_attente',   -- 'en_attente', 'valide', 'rejete'
    agent_note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert client_documents" ON public.client_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all client_documents" ON public.client_documents FOR ALL USING (true);

-- 2. BLOG / ARTICLES
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT DEFAULT '',
    content TEXT DEFAULT '',
    cover_image TEXT DEFAULT '',
    category TEXT DEFAULT 'general',  -- 'citoyennete', 'investissement', 'culture', 'immobilier', 'business', 'general'
    tags JSONB DEFAULT '[]'::jsonb,
    author TEXT DEFAULT 'Retour Gagnant',
    is_published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published blog" ON public.blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "Admin all blog_posts" ON public.blog_posts FOR ALL USING (true);

-- 3. CALENDRIER / DISPONIBILITÉS AGENT
CREATE TABLE IF NOT EXISTS public.agent_availability (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_name TEXT DEFAULT 'Agent',
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Dimanche
    start_time TIME NOT NULL DEFAULT '09:00',
    end_time TIME NOT NULL DEFAULT '17:00',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read availability" ON public.agent_availability FOR SELECT USING (is_active = true);
CREATE POLICY "Admin all availability" ON public.agent_availability FOR ALL USING (true);

-- 4. RENDEZ-VOUS CONFIRMÉS (Calendrier)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_nom TEXT NOT NULL,
    client_email TEXT NOT NULL,
    client_phone TEXT DEFAULT '',
    service TEXT DEFAULT 'Consultation',
    date DATE NOT NULL,
    time_slot TEXT NOT NULL,  -- '09:00-10:00'
    status TEXT DEFAULT 'confirme',  -- 'confirme', 'annule', 'termine', 'no_show'
    notes TEXT DEFAULT '',
    agent_name TEXT DEFAULT '',
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all appointments" ON public.appointments FOR ALL USING (true);

-- 5. CONTRATS / DEVIS (Signature Électronique)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_nom TEXT NOT NULL,
    client_email TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    amount DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'XOF',
    status TEXT DEFAULT 'brouillon',  -- 'brouillon', 'envoye', 'signe', 'refuse', 'expire'
    signed_at TIMESTAMPTZ,
    signature_hash TEXT DEFAULT '',
    agent_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin all contracts" ON public.contracts FOR ALL USING (true);

-- 6. ANALYTICS EVENTS (Tracking interne)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,  -- 'page_view', 'oracle_complete', 'contact_submit', 'rdv_submit', 'boutique_purchase'
    page TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin read analytics" ON public.analytics_events FOR SELECT USING (true);

-- 7. SEED DATA: Default availability (Lun-Ven 9h-17h)
INSERT INTO public.agent_availability (agent_name, day_of_week, start_time, end_time) VALUES
('Équipe', 1, '09:00', '17:00'),
('Équipe', 2, '09:00', '17:00'),
('Équipe', 3, '09:00', '17:00'),
('Équipe', 4, '09:00', '17:00'),
('Équipe', 5, '09:00', '17:00');

-- 8. SEED DATA: Initial blog posts
INSERT INTO public.blog_posts (title, slug, excerpt, content, category, cover_image, is_published) VALUES
(
    'Comment obtenir la nationalité béninoise en 2026',
    'obtenir-nationalite-beninoise-2026',
    'Guide complet pour les démarches d''obtention de la nationalité béninoise, que vous soyez afrodescendant ou d''origine béninoise.',
    '## Les étapes clés pour obtenir la nationalité béninoise

Le Bénin offre plusieurs voies d''accès à la nationalité pour les personnes d''origine béninoise et les afrodescendants. Voici un guide détaillé des démarches à suivre.

### 1. Vérifier votre éligibilité

La première étape consiste à déterminer votre lien avec le Bénin. Vous pouvez être éligible si :
- Vous avez un parent ou grand-parent béninois
- Vous êtes afrodescendant avec des liens historiques avec le Bénin
- Vous résidez au Bénin depuis plus de 10 ans

### 2. Rassembler les documents nécessaires

Les documents suivants sont généralement requis :
- Acte de naissance (traduit et légalisé)
- Acte de naissance d''un parent béninois (si applicable)
- Casier judiciaire
- Certificat de résidence
- Photos d''identité

### 3. Déposer votre dossier

Le dossier doit être déposé auprès du Ministère de la Justice du Bénin. Notre équipe Retour Gagnant peut vous accompagner dans toutes ces démarches.

### 4. Le délai de traitement

Le traitement prend généralement entre 6 et 18 mois selon la complexité du dossier.

---

*Besoin d''aide ? Passez le test de l''Oracle sur notre site pour évaluer votre éligibilité gratuitement.*',
    'citoyennete',
    'https://images.unsplash.com/photo-1628102422315-77983656113b?w=800',
    true
),
(
    'Top 10 des villes où investir au Bénin en 2026',
    'top-10-villes-investir-benin-2026',
    'Découvrez les meilleures opportunités d''investissement immobilier et commercial dans les villes les plus dynamiques du Bénin.',
    '## Les meilleures villes pour investir au Bénin

Le Bénin connaît une croissance économique remarquable. Voici les 10 villes offrant les meilleures opportunités.

### 1. Cotonou — Le poumon économique
Capital économique, Cotonou concentre 80% des activités commerciales du pays.

### 2. Calavi — La ville universitaire en plein boom
Avec l''Université d''Abomey-Calavi, cette ville connaît une urbanisation rapide.

### 3. Ouidah — Le tourisme culturel
Site historique majeur, Ouidah attire de plus en plus de touristes internationaux.

### 4. Parakou — Le carrefour du Nord
Hub commercial stratégique pour le commerce avec le Niger et le Nigeria.

### 5. Porto-Novo — La capitale administrative
En pleine modernisation avec de nouveaux projets gouvernementaux.

### 6. Bohicon — Le centre du pays
Point de passage obligé entre le nord et le sud.

### 7. Natitingou — L''écotourisme
Porte d''entrée de l''Atacora et du Parc de la Pendjari.

### 8. Lokossa — L''agriculture
Zone fertile propice aux investissements agricoles.

### 9. Sèmè-Podji — La zone franche
Zone économique spéciale avec avantages fiscaux.

### 10. Grand-Popo — Le tourisme balnéaire
Station balnéaire en développement avec un potentiel immobilier élevé.

---

*Contactez Retour Gagnant pour un accompagnement personnalisé dans votre projet d''investissement.*',
    'investissement',
    'https://images.unsplash.com/photo-1547471080-7cc203206c88?w=800',
    true
),
(
    'Guide de la Cérémonie du Nom béninoise',
    'ceremonie-du-nom-beninoise-guide',
    'Tout savoir sur cette tradition ancestrale qui reconnecte les afrodescendants à leurs racines béninoises.',
    '## La Cérémonie du Nom : une tradition vivante

La cérémonie du nom est l''un des rituels les plus importants de la culture béninoise. Elle représente bien plus qu''un simple baptême — c''est une reconnaissance identitaire profonde.

### Qu''est-ce que la Cérémonie du Nom ?

C''est un rituel traditionnel où un nom béninois est attribué à une personne, créant un lien spirituel et culturel avec la terre des ancêtres.

### Pourquoi est-elle importante pour les afrodescendants ?

Pour beaucoup d''afrodescendants de la diaspora, recevoir un nom béninois est un acte de reconnexion identitaire puissant.

### Comment se déroule-t-elle ?

1. **Consultation du Fâ** — Le système divinatoire guide le choix du nom
2. **Cérémonie communautaire** — Présence des chefs traditionnels
3. **Attribution du nom** — Le nom est révélé et célébré
4. **Validation à l''état civil** — Le nom peut être officiellement enregistré

---

*Retour Gagnant organise des cérémonies du nom authentiques. Contactez-nous pour en savoir plus.*',
    'culture',
    'https://images.unsplash.com/photo-1590845947376-2638caa89309?w=800',
    true
);

-- Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
