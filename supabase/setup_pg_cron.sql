-- 1. ACTIVER L'EXTENSION PG_CRON (Nécessite les droits Super Admin sur Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. DÉSACTIVER LES ANCIENNES TÂCHES (Si vous relancez le script)
SELECT cron.unschedule('nettoyage_donnees_nationalite_24h');

-- 3. PLANIFIER LE NETTOYAGE SÉCURISÉ (Ici : Tous les jours à minuit)
-- Cron syntax: '0 0 * * *' (Minuit chaque jour)
SELECT cron.schedule(
  'nettoyage_donnees_nationalite_24h', 
  '0 0 * * *', 
  $$ SELECT public.cleanup_old_client_data(); $$
);

-- Note : public.cleanup_old_client_data() a déjà été créée dans notre script précédent.
-- Elle supprime les données "traitées" ou "archivées" vieilles de plus de 24h
-- et écrit dans "security_logs".

-- 4. VÉRIFIER QUE LE CRON EST BIEN ENREGISTRÉ
SELECT * FROM cron.job;
