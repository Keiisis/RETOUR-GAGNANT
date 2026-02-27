-- =======================================================
-- MIGRATION: PREMIUM FEATURES
-- Nexus Tracker + Voice-to-Support + L'Oracle Simulator
-- =======================================================

-- ═══════════════════════════════════════════════════════
-- TABLE 1: DOSSIER_TRACKING (Suivi de dossier client)
-- ═══════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════
-- TABLE 2: VOICE_MESSAGES (Messages vocaux transcrits)
-- ═══════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════
-- TABLE 3: ELIGIBILITY_RESULTS (Résultats du simulateur Oracle)
-- ═══════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════

-- Dossier Tracking
ALTER TABLE public.dossier_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public search dossier" ON public.dossier_tracking FOR SELECT USING (true);
CREATE POLICY "Admin all dossier_tracking" ON public.dossier_tracking FOR ALL USING (true);

-- Voice Messages
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert voice_messages" ON public.voice_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all voice_messages" ON public.voice_messages FOR ALL USING (true);

-- Eligibility Results
ALTER TABLE public.eligibility_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert eligibility" ON public.eligibility_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin all eligibility" ON public.eligibility_results FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════
-- SEED DATA: Un dossier exemple pour tester le tracking
-- ═══════════════════════════════════════════════════════
INSERT INTO public.dossier_tracking (num_dossier, client_nom, client_prenom, client_email, client_whatsapp, service_type, statut, progression, etapes) VALUES
('RG-2026-00001', 'Dossou', 'Samuel', 'samuel.dossou@example.com', '+33612345678', 'Passeport & Documents', 'traitement', 60, '[
    {"id": 1, "label": "Réception du dossier", "status": "completed", "date": "2026-02-10", "note": "Dossier complet reçu"},
    {"id": 2, "label": "Vérification des documents", "status": "completed", "date": "2026-02-15", "note": "Documents conformes"},
    {"id": 3, "label": "Traitement administratif", "status": "in_progress", "date": "2026-02-20", "note": "En cours de traitement"},
    {"id": 4, "label": "Validation finale", "status": "pending", "date": null, "note": ""},
    {"id": 5, "label": "Finalisation & Remise", "status": "pending", "date": null, "note": ""}
]'::jsonb);
