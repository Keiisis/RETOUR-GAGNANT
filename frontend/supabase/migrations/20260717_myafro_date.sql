-- ══════════════════════════════════════════════════════════════
--  MYAFROORIGINS — date d'émission du dossier d'origine
--  Permet les alertes d'urgence + récap IA de l'onglet admin/documents.
--  À exécuter dans Supabase Studio > SQL Editor (avec 20260717_contracts_v2.sql)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE nationality_applications
    ADD COLUMN IF NOT EXISTS myafro_date DATE;

COMMENT ON COLUMN nationality_applications.myafro_date IS
    'Date à laquelle le client a émis son dossier sur MyAfroOrigins (déclarée dans le formulaire de reprise 50 €)';
