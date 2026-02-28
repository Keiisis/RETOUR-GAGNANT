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

-- Seed default FAQ (13 questions officielles)
DELETE FROM nationality_faq;
INSERT INTO nationality_faq (question_fr, answer_fr, sort_order) VALUES
('Qu''est-ce que la reconnaissance de la nationalité béninoise pour les Afro-descendants ?', 'La reconnaissance de la nationalité béninoise pour les Afro-descendants est un mode d''acquisition de la nationalité Béninoise par les Afro-descendants en République du Bénin.', 1),
('Éligibilité', E'Peut bénéficier de la loi 2024-31 relative à la reconnaissance de la nationalité béninoise aux afro descendants :\n\n• Toute personne âgée de dix-huit (18) ans révolus qui, d''après sa généalogie, a un ascendant africain subsaharien déporté hors du continent africain dans le cadre de la traite des Noirs et du commerce triangulaire ;\n• Toute personne qui peut justifier un lien de filiation avec une personne afro-descendante au sens de la loi.\n\nNe peuvent pas bénéficier de la loi :\n\n• Les ressortissants des états africains subsahariens ;\n• Les personnes qui ne remplissent pas les conditions de filiation fixées par la loi 2024-31. Il s''agit notamment des personnes qui ne sont pas afro-descendants au sens de la loi ; des personnes afro-descendantes dont les ascendants ont migré après 1944 dans les États ou territoires de déportation du commerce triangulaire.', 2),
('Quels documents sont nécessaires pour soumettre une demande ?', E'Les documents requis pour soumettre une demande d''acquisition de nationalité par reconnaissance sont :\n\n1. Tout document établissant la preuve de l''afro-descendance : actes d''état civil, fiche de naissance des ascendants, attestations ou certificats officiels, documents de propriété, extraits de registres historiques, actes notariés ou arbre généalogique, tests génétiques auprès des laboratoires agréés, document établissant un lien de filiation direct, lien de filiation avec une personne reconnue afro-descendant.\n\n2. Un casier judiciaire délivré par l''autorité compétente du pays de résidence (moins de 3 mois).\n\n3. Une copie d''une pièce d''identité en cours de validité : CNI, Passeport, Carte d''électeur, Carte de résident, Carte consulaire, Carte militaire.\n\n4. Un justificatif de la profession : attestation de travail, bulletins de salaire, certificat RCCM, attestation d''ordre professionnel, certificat de scolarité.\n\n5. Un justificatif de domicile : certificat de résidence, quittance d''impôts, facture de services publics, titre de propriété, attestation d''hébergement.', 3),
('Quelles sont les exigences par rapport aux documents à fournir ?', E'1. Les documents fournis doivent être vérifiables et valides.\n2. Les certificats et attestations doivent dater de moins de trois mois.\n3. Les documents sont fournis avec une traduction française le cas échéant (traducteur agréé via https://www.tradux.gouv.bj).\n4. Tous les renseignements portés sur le formulaire de demande sont exacts et complets.\n5. Le demandeur certifie qu''il est informé que : la production de l''original ou d''une copie certifiée conforme peut être exigée ; les actes de l''état civil sont produits en copie intégrale ; les actes publics étrangers sont légalisés sauf apostille.', 4),
('Qui est destinataire de la demande ?', 'La demande de la nationalité béninoise par reconnaissance est soumise en ligne au ministre chargé de la justice par le demandeur. Elle est traitée par l''Autorité de délivrance des actes relatifs à la nationalité.', 5),
('Comment faire la demande ?', E'La demande est faite exclusivement en ligne par dépôt de dossier via la plateforme.\n\nProcessus :\n• Cliquez sur l''onglet "Reconnaissance de la nationalité béninoise"\n• Cliquez sur "Faire une demande" ou "Commencer maintenant"\n• Renseignez les informations demandées\n• Vous recevrez un message de confirmation par email\n• Remplissez le formulaire en suivant les différentes étapes\n• Soumettez votre demande\n\nNous vous invitons à vous munir des documents établissant votre afrodescendance au-delà du seul test génétique avant de remplir votre demande.', 6),
('En combien de temps puis-je obtenir mon attestation d''éligibilité ?', 'L''attestation d''éligibilité à la nationalité béninoise par reconnaissance est émise dans un délai de trois (03) mois à compter de la réception d''un dossier complet et conforme.', 7),
('Comment est faite la demande d''attestation de nationalité béninoise ?', E'Demande formulée depuis l''étranger :\nLe demandeur reçoit, au terme de l''examen favorable, une attestation d''éligibilité d''une durée de validité de trois (03) ans. Le bénéficiaire se rend au Bénin pour les formalités d''identification au registre national des personnes physiques.\n\nDemande formulée à partir du territoire du Bénin :\nLe demandeur est invité à prendre rendez-vous pour les formalités d''identification. Il reçoit un accusé de réception précisant la date de présentation. Après examen favorable, notification du décret lui accordant la nationalité béninoise par reconnaissance.', 8),
('Quelle est l''Autorité compétente pour accorder la nationalité ?', 'La nationalité béninoise par reconnaissance est accordée par décret pris en Conseil des ministres sur proposition du ministre chargé de la justice.', 9),
('Quels sont les droits attachés à l''attestation d''éligibilité ?', 'L''attestation d''éligibilité confère au bénéficiaire la liberté d''entrée, de séjour et de sortie du territoire de la République du Bénin.', 10),
('Quels sont les effets de la nationalité béninoise par reconnaissance ?', E'La nationalité béninoise par reconnaissance confère au bénéficiaire :\n\n• La liberté d''entrée, de séjour et de sortie du territoire de la République du Bénin.\n• Le droit à l''établissement d''une attestation de nationalité béninoise par reconnaissance et d''un passeport béninois.\n• Le droit de transmission de la nationalité béninoise aux descendants mineurs.\n\nLes bénéficiaires peuvent acquérir, à tout moment, la pleine citoyenneté et tous les droits qui y sont rattachés.', 11),
('La nationalité béninoise de reconnaissance peut-elle être retirée ?', E'Sur proposition du ministre chargé de la justice, la nationalité béninoise par reconnaissance est retirée par décret pris en Conseil des ministres aux bénéficiaires n''ayant pas satisfait aux exigences :\n\na) Si elle a été obtenue par mensonge ou fraude.\nb) Si la personne est condamnée pour un acte qualifié de crime ou acte portant atteinte à la sûreté de l''État.\nc) Si la personne s''est livrée au profit d''un État étranger à des actes incompatibles avec la nationalité béninoise.', 12),
('Peut-on soumettre une demande uniquement avec un test génétique ?', E'Les tests génétiques effectués auprès des laboratoires agréés par la République du Bénin sont admis à l''appui des documents suivants :\n\na) Actes d''état civil du demandeur et de ses ascendants.\nb) Fiche de naissance des ascendants dans la lignée.\nc) Attestation, certificat ou documents officiels d''un État de déportation.\nd) Documents de propriété, registres historiques, registres d''affranchissement.\ne) Actes notariés ou authentiques, arbre généalogique.\n\nLe test génétique seul ne suffit pas.', 13);

-- Seed required documents
INSERT INTO nationality_required_docs (label_fr, description_fr, doc_type, sort_order) VALUES
('Pièce d''identité en cours de validité', 'Passeport, carte nationale d''identité, ou tout document délivré par une autorité publique contenant photo et informations biométriques.', 'identite', 1),
('Justificatif de domicile', 'Certificat de résidence, facture de service public, titre de propriété ou attestation d''hébergement.', 'domicile', 2),
('Preuve de profession', 'Certificat de travail, bulletins de salaire récents, inscription au registre du commerce ou certificat de scolarité.', 'profession', 3),
('Preuve d''afro-descendance', 'Actes d''état civil des ancêtres, certificats officiels, tests génétiques, actes notariés, arbres généalogiques, extraits d''archives historiques.', 'afro_descendance', 4),
('Casier judiciaire', 'Extrait de casier judiciaire de moins de 3 mois, délivré par l''autorité compétente du pays de résidence.', 'casier', 5)
ON CONFLICT DO NOTHING;

-- NOTE: Payment is managed via the existing 'settings' table
-- with keys: kkiapay_enabled, kkiapay_public_key, kkiapay_private_key, etc.
-- See migration_boutique_users.sql for the payment settings schema.

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

-- Create Storage Bucket for Nationality Documents
INSERT INTO storage.buckets (id, name, public) VALUES ('nationality_documents', 'nationality_documents', false) ON CONFLICT (id) DO NOTHING;

-- RLS for bucket policies (needs to operate on storage.objects)
CREATE POLICY "Allow public insert to nationality_documents" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'nationality_documents');
CREATE POLICY "Allow service role full access to nationality_documents" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'nationality_documents');
