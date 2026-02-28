-- Notifications pour le client
CREATE TABLE IF NOT EXISTS public.client_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_email TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    -- 'info', 'success', 'warning'
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Active RLS mais le rend passif pour faciliter l'UX client par email
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for specific email" ON public.client_notifications FOR
SELECT USING (true);
CREATE POLICY "Enable insert for all" ON public.client_notifications FOR
INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON public.client_notifications FOR
UPDATE USING (true);
-- Base de Connaissance / Wiki pour l'Oracle
CREATE TABLE IF NOT EXISTS public.wiki_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    tags TEXT [] DEFAULT '{}',
    is_published BOOLEAN DEFAULT true,
    author_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for authenticated agents" ON public.wiki_articles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for public api (Oracle)" ON public.wiki_articles FOR
SELECT USING (true);