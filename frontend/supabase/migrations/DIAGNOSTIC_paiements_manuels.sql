-- ══════════════════════════════════════════════════════════════
-- DIAGNOSTIC — Vérifier l'état complet de paiements_manuels
-- À exécuter dans Supabase Dashboard > SQL Editor
-- NE PAS COMMIT — fichier temporaire de diagnostic
-- ══════════════════════════════════════════════════════════════

-- 1. Toutes les politiques RLS actives
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'paiements_manuels'
ORDER BY policyname;

-- 2. RLS est-il activé ?
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'paiements_manuels';

-- 3. Toutes les contraintes
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.paiements_manuels'::regclass;

-- 4. Structure de la table (colonnes)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'paiements_manuels'
ORDER BY ordinal_position;

-- 5. Derniers 5 paiements insérés (pour vérifier qu'ils existent)
SELECT id, agent_id, document_id, type, montant, date_paiement, notes, created_at
FROM paiements_manuels
ORDER BY created_at DESC
LIMIT 5;

-- 6. Triggers actifs
SELECT tgname, tgtype, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.paiements_manuels'::regclass
AND NOT tgisinternal;
