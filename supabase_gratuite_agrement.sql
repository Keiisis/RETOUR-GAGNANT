-- ══════════════════════════════════════════════════════════════
--  Gratuité après l'agrément (18/11/2026) : textes et réglages stockés EN BASE
--  À exécuter dans Supabase → SQL Editor, bloc par bloc :
--    1. lancer le SELECT, lire ce qui sort ;
--    2. lancer l'UPDATE seulement si le SELECT montre bien ce qu'il faut changer.
--  Les UPDATE marqués « À RELIRE » modifient du texte libre : vérifier le
--  résultat dans le site après exécution.
-- ══════════════════════════════════════════════════════════════


-- ── 1. Tarif du formulaire de nationalité ─────────────────────
SELECT id, content
FROM page_sections
WHERE page = 'nationalite' AND section_key = 'form_settings';

-- Montant 0 : plus rien n'est affiché ni demandé, et une ancienne version
-- de l'app ne peut plus proposer de payer. Les autres clés (doc_slots,
-- recherche_ancestrale_amount…) sont conservées.
UPDATE page_sections
SET content = content || '{"amount": 0, "currency": "EUR", "payment_description": "Demande de nationalité béninoise gratuite (agence agréée)"}'::jsonb,
    updated_at = now()
WHERE page = 'nationalite' AND section_key = 'form_settings';


-- ── 2. Contenu de la page /nationalite (sections éditables) ───
SELECT id, section_key, content_fr, content_en, metadata
FROM nationality_page_content
WHERE (coalesce(content_fr, '') || ' ' || coalesce(content_en, '') || ' ' || coalesce(metadata::text, ''))
      ~* '(260|250 ?(€|eur|usd)|€|fcfa|frais|tarif|prix|payer|paiement|co[uû]t|vip)';
-- Corriger depuis l'admin : Nationalité → Contenu (app/admin/nationalite/content).


-- ── 3. FAQ nationalité ────────────────────────────────────────
SELECT id, question_fr, answer_fr, answer_en, is_active
FROM nationality_faq
WHERE (question_fr || ' ' || answer_fr || ' ' || coalesce(answer_en, ''))
      ~* '(260|€|eur|fcfa|frais|tarif|prix|payer|paiement|co[uû]t|vip|passeport)';
-- Corriger depuis l'admin : Nationalité → FAQ (app/admin/nationalite/faq).
-- Question à ajouter (À RELIRE) :
INSERT INTO nationality_faq (question_fr, answer_fr, question_en, answer_en, sort_order, is_active)
SELECT 'La demande de nationalité est-elle payante ?',
       'Non. Retour Gagnant Bénin est désormais une agence agréée : la demande de nationalité est entièrement gratuite, et le passeport béninois vous est remis directement par l''État lors de la cérémonie officielle de remise. Aucun moyen de paiement ne vous est demandé.',
       'Is the nationality application free?',
       'Yes. Retour Gagnant Bénin is now an approved agency: the nationality application is entirely free, and your Beninese passport is handed to you directly by the State at the official ceremony. No payment is ever requested.',
       0, true
WHERE NOT EXISTS (SELECT 1 FROM nationality_faq WHERE question_fr = 'La demande de nationalité est-elle payante ?');


-- ── 4. Dossiers déjà reçus sans paiement ──────────────────────
-- Avant la gratuité, un dossier non réglé restait « en_attente » : dépôt de
-- pièces et transmission MyAfroOrigins bloqués. Les passer en « gratuit »
-- les débloque comme les nouveaux dossiers.
SELECT id, application_ref, created_at, email, payment_status, payment_method, amount, currency
FROM nationality_applications
WHERE payment_status IN ('en_attente', 'non_payé', 'non_paye')
ORDER BY created_at DESC;

UPDATE nationality_applications
SET payment_status = 'gratuit', payment_method = coalesce(payment_method, 'gratuit'), amount = 0
WHERE payment_status IN ('en_attente', 'non_payé', 'non_paye')
  AND coalesce(payment_ref, '') = '';


-- ── 5. Fiches des services (page /services, app mobile, contexte de l'assistant) ──
SELECT id, slug, title, subtitle, price_display, pricing_options, features, is_active
FROM services
WHERE slug ~* '(nationalit|passeport|passport|recap|myafro|vip)'
   OR title ~* '(nationalit|passeport|passport|recap|myafro|vip)';

-- Prix affiché « Gratuit » sur les trois services devenus gratuits.
-- La Recherche Ancestrale (payante) n'est pas concernée.
UPDATE services
SET price_display = 'Gratuit',
    pricing_options = '[]'::jsonb,
    updated_at = now()
WHERE slug ~* '(nationalit|passeport|passport|recap-?myafro)'
  AND slug !~* 'ancestral';

-- Mot « VIP » retiré des titres (À RELIRE : vérifier le résultat du SELECT ci-dessus d'abord).
UPDATE services
SET title = btrim(regexp_replace(title, '\s*[-–·]?\s*\mVIP\M', '', 'gi')),
    subtitle = btrim(regexp_replace(coalesce(subtitle, ''), '\s*[-–·]?\s*\mVIP\M', '', 'gi')),
    updated_at = now()
WHERE (title ~* '\mVIP\M' OR coalesce(subtitle, '') ~* '\mVIP\M')
  AND slug ~* '(nationalit|passeport|passport)';


-- ── 6. Sections éditables des pages de service ────────────────
SELECT id, page, section_key, title, content
FROM page_sections
WHERE page IN ('nationalite', 'nationalite-vip', 'passeport', 'recap-myafroorigins')
  AND (coalesce(title, '') || ' ' || content::text)
      ~* '(260|€|eur|usd|fcfa|xof|frais|tarif|prix|payer|paiement|co[uû]t|vip|150 ?000|350 ?000)';
-- Corriger depuis l'admin : Services → Passeport / Récap MyAfroOrigins → Contenu,
-- Nationalité → Contenu. (Bloc 1 déjà traité : form_settings.)


-- ── 7. Grille tarifaire imprimable ────────────────────────────
SELECT key, value
FROM settings
WHERE key = 'grilles_tarifaires'
   OR (value::text ~* '(nationalit|passeport|myafro|recap)' AND value::text ~* '(€|eur|fcfa|frais|tarif|vip)');
-- Corriger depuis l'admin : Grille tarifaire (lignes nationalité, accompagnement,
-- passeport, récap MyAfroOrigins → « Gratuit » ou ligne supprimée).


-- ── 8. Consignes de l'assistant IA ────────────────────────────
SELECT id, is_active, left(system_prompt, 400) AS debut, length(system_prompt) AS longueur
FROM ai_config
WHERE system_prompt ~* '(nationalit|passeport|myafro|recap|vip)';
-- Lire la consigne complète :
--   SELECT system_prompt FROM ai_config WHERE is_active;
-- Puis y ajouter (À RELIRE) un paragraphe du type :
--   « Depuis l'agrément de Retour Gagnant Bénin, la demande de nationalité,
--     l'accompagnement complet et le récap de dossier MyAfroOrigins sont
--     gratuits. Le passeport est inclus : l'État le remet lors de la
--     cérémonie officielle. Seule la Recherche Ancestrale reste payante. »
-- et retirer toute mention de frais pour ces services et du mot « VIP ».


-- ── 9. Traductions déjà en cache des anciens libellés ─────────
-- Sans effet sur l'affichage (les nouveaux libellés ont d'autres clés) ;
-- utile seulement pour faire le ménage.
SELECT lang, source_text, translated_text
FROM translations
WHERE source_text ~* '(frais de traitement|paiement des frais|payez d.abord|montant à régler|procéder au paiement|Paiement & Soumission|\mVIP\M)';
