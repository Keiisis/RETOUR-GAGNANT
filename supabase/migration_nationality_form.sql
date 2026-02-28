-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Nationality Recognition Application System
-- Retour Gagnant Bénin — Soumission de Nationalité
-- ═══════════════════════════════════════════════════════════════

-- 1. nationality_page_content — CMS for the landing page (editable from admin)
CREATE TABLE IF NOT EXISTS nationality_page_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_key TEXT UNIQUE NOT NULL, -- hero_title, hero_subtitle, price, process_step_1, faq_1_q, faq_1_a, etc.
    content_fr TEXT NOT NULL DEFAULT '',
    content_en TEXT DEFAULT '',
    metadata JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. nationality_applications — Main application table
CREATE TABLE IF NOT EXISTS nationality_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_ref TEXT UNIQUE NOT NULL, -- RG-NAT-2026-XXXX
    status TEXT DEFAULT 'brouillon', -- brouillon, soumis, en_traitement, verification, approuve, rejete
    
    -- Step 1: Afro-descendance info
    knows_about_law BOOLEAN DEFAULT false,
    is_afro_descendant BOOLEAN,
    afro_descendant_description TEXT,
    
    -- Ancestor 1
    ancestor1_nom TEXT,
    ancestor1_prenom TEXT,
    ancestor1_date_naissance DATE,
    ancestor1_lien_parente TEXT,
    ancestor1_vivant BOOLEAN,
    ancestor1_nationalite TEXT,
    ancestor1_pays_residence TEXT,
    ancestor1_autres_infos TEXT,
    
    -- Ancestor 2
    ancestor2_nom TEXT,
    ancestor2_prenom TEXT,
    ancestor2_date_naissance DATE,
    ancestor2_lien_parente TEXT,
    ancestor2_vivant BOOLEAN,
    ancestor2_nationalite TEXT,
    ancestor2_pays_residence TEXT,
    ancestor2_autres_infos TEXT,
    
    -- Step 2: Personal info
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    genre TEXT, -- Masculin, Féminin, Autre
    date_naissance DATE,
    pays_naissance TEXT,
    ville_naissance TEXT,
    nationalite TEXT,
    pays_residence TEXT,
    adresse_residence TEXT,
    telephone TEXT,
    email TEXT NOT NULL,
    profession TEXT,
    demande_depuis_benin BOOLEAN DEFAULT false,
    
    -- Step 3: Identity documents
    type_document_identite TEXT, -- passport, cni, autre
    numero_document TEXT,
    date_expiration_document DATE,
    pays_delivrance TEXT,
    lieu_delivrance TEXT,
    autorite_delivrance TEXT,
    
    -- Parents info
    pere_nom TEXT,
    pere_prenom TEXT,
    pere_date_naissance DATE,
    mere_nom TEXT,
    mere_prenom TEXT,
    mere_date_naissance DATE,
    
    -- Step 4: Uploaded documents (stored as JSONB array)
    documents_uploaded JSONB DEFAULT '[]',
    
    -- Payment & processing
    amount NUMERIC DEFAULT 250,
    currency TEXT DEFAULT 'USD',
    payment_status TEXT DEFAULT 'non_paye', -- non_paye, en_attente, paye, rembourse
    payment_ref TEXT,
    payment_method TEXT,
    
    -- Admin / Agent tracking
    assigned_agent TEXT,
    agent_notes TEXT,
    admin_notes TEXT,
    decision_date TIMESTAMPTZ,
    decision_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    last_step_completed INT DEFAULT 0
);

-- 3. nationality_faq — Editable FAQ
CREATE TABLE IF NOT EXISTS nationality_faq (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_fr TEXT NOT NULL,
    answer_fr TEXT NOT NULL,
    question_en TEXT DEFAULT '',
    answer_en TEXT DEFAULT '',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. nationality_required_docs — Define which documents are required (editable)
CREATE TABLE IF NOT EXISTS nationality_required_docs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label_fr TEXT NOT NULL,
    label_en TEXT DEFAULT '',
    description_fr TEXT DEFAULT '',
    doc_type TEXT NOT NULL, -- identite, domicile, profession, afro_descendance, casier
    is_required BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Seed default page content
INSERT INTO nationality_page_content (section_key, content_fr, sort_order) VALUES
('hero_title', 'Reconnaissance de Nationalité Béninoise', 1),
('hero_subtitle', 'Pour les Afro-Descendants', 2),
('hero_description', 'La reconnaissance de nationalité béninoise pour les Afro-descendants est un mode d''acquisition de la nationalité Béninoise par les Afro-descendants en République du Bénin, conformément à la Loi N° 2024-31.', 3),
('price', '250', 4),
('price_currency', 'USD', 5),
('processing_time', '3 mois à compter de la notification de réception de votre dossier complet', 6),
('step_1_title', 'Inscription et dépôt de la demande', 7),
('step_1_desc', 'Remplissez le formulaire de demande et soumettez les documents nécessaires prouvant votre ascendance afro-descendante.', 8),
('step_2_title', 'Examen du dossier', 9),
('step_2_desc', 'L''autorité compétente examine votre demande, vérifie l''authenticité de vos documents et procède aux vérifications nécessaires.', 10),
('step_3_title', 'Décision', 11),
('step_3_desc', 'Si la demande est approuvée, vous recevez votre attestation d''éligibilité à la nationalité béninoise par reconnaissance.', 12),
('eligibility_title', 'Critères d''Éligibilité', 13),
('eligibility_desc', 'Toute personne âgée de dix-huit (18) ans révolus qui, au vu de sa généalogie, a un ascendant d''Afrique subsaharienne ayant été déporté du continent africain dans le cadre de la traite négrière et du commerce triangulaire.', 14),
('cta_title', 'Prêt à retrouver vos racines ?', 15),
('cta_desc', 'Notre équipe vous accompagne à chaque étape de votre demande de reconnaissance de nationalité béninoise. Un processus encadré, sécurisé et officiellement reconnu.', 16)
ON CONFLICT (section_key) DO NOTHING;

-- Seed default FAQ
INSERT INTO nationality_faq (question_fr, answer_fr, sort_order) VALUES
('Qu''est-ce que la reconnaissance de nationalité béninoise pour les Afro-descendants ?', 'La reconnaissance de nationalité béninoise pour les Afro-descendants est un mode d''acquisition de la nationalité Béninoise par les Afro-descendants en République du Bénin, conformément à la Loi N° 2024-31.', 1),
('Qui est éligible ?', 'Toute personne âgée de 18 ans révolus qui, au vu de sa généalogie, a un ascendant d''Afrique subsaharienne déporté du continent africain dans le cadre de la traite négrière. Également, toute personne pouvant établir une filiation directe avec un individu reconnu comme Afro-descendant au sens de la loi.', 2),
('Quels documents sont nécessaires pour soumettre une demande ?', 'Vous aurez besoin de : une pièce d''identité en cours de validité, un justificatif de domicile, une preuve de profession, une preuve d''afro-descendance (actes d''état civil, tests génétiques, certificats officiels, etc.), et un casier judiciaire de moins de 3 mois.', 3),
('Combien coûte la procédure ?', 'Les frais de traitement de la demande sont de 250 $ USD, payables en ligne lors de la soumission de votre dossier complet.', 4),
('Quel est le délai de traitement ?', 'L''attestation d''éligibilité à la nationalité béninoise par reconnaissance est délivrée dans un délai de trois (03) mois à compter de la date de réception d''un dossier complet et conforme.', 5),
('Quelles sont les exigences relatives aux documents ?', 'Les documents fournis doivent être vérifiables et en cours de validité. Les certificats et attestations doivent être datés de moins de trois mois. Les documents rédigés en langue étrangère doivent être accompagnés de leur traduction en français par un traducteur accrédité.', 6),
('Comment se passe la demande depuis l''étranger ?', 'Vous recevez, en cas d''avis favorable, une Attestation d''Éligibilité à la nationalité béninoise par reconnaissance, d''une validité de trois (03) ans. Vous devrez ensuite vous déplacer au Bénin pour les formalités d''identification.', 7),
('Quelle autorité accorde la nationalité ?', 'La nationalité béninoise par reconnaissance est accordée par décret pris en Conseil des ministres, sur proposition du Ministre de la Justice.', 8)
ON CONFLICT DO NOTHING;

-- Seed required documents
INSERT INTO nationality_required_docs (label_fr, description_fr, doc_type, sort_order) VALUES
('Pièce d''identité en cours de validité', 'Passeport, carte nationale d''identité, ou tout document délivré par une autorité publique contenant photo et informations biométriques.', 'identite', 1),
('Justificatif de domicile', 'Certificat de résidence, facture de service public, titre de propriété ou attestation d''hébergement.', 'domicile', 2),
('Preuve de profession', 'Certificat de travail, bulletins de salaire récents, inscription au registre du commerce ou certificat de scolarité.', 'profession', 3),
('Preuve d''afro-descendance', 'Actes d''état civil des ancêtres, certificats officiels, tests génétiques, actes notariés, arbres généalogiques, extraits d''archives historiques.', 'afro_descendance', 4),
('Casier judiciaire', 'Extrait de casier judiciaire de moins de 3 mois, délivré par l''autorité compétente du pays de résidence.', 'casier', 5)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE nationality_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nationality_page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE nationality_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE nationality_required_docs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read on page content" ON nationality_page_content FOR SELECT USING (true);
CREATE POLICY "Allow public read on faq" ON nationality_faq FOR SELECT USING (true);
CREATE POLICY "Allow public read on required docs" ON nationality_required_docs FOR SELECT USING (true);
CREATE POLICY "Allow public insert applications" ON nationality_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role all on applications" ON nationality_applications FOR ALL USING (true);
CREATE POLICY "Allow service role all on page content" ON nationality_page_content FOR ALL USING (true);
CREATE POLICY "Allow service role all on faq" ON nationality_faq FOR ALL USING (true);
CREATE POLICY "Allow service role all on required docs" ON nationality_required_docs FOR ALL USING (true);
