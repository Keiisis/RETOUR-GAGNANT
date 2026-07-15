-- ══════════════════════════════════════════════════════════════
-- MIGRATION — Mise à jour CHECK constraint sur paiements_manuels.type
--
-- PROBLÈME : le frontend envoie 6 valeurs possibles pour le mode
-- de paiement (virement, especes, cheque, mobile_money, carte, autre)
-- mais la contrainte CHECK en base n'accepte pas toutes ces valeurs.
-- Résultat : "violates check constraint paiements_manuels_type_check"
--
-- À EXÉCUTER dans Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ── 1. Supprimer l'ancienne contrainte CHECK ─────────────────
ALTER TABLE public.paiements_manuels
    DROP CONSTRAINT IF EXISTS paiements_manuels_type_check;

-- ── 2. Recréer avec toutes les valeurs du frontend ───────────
ALTER TABLE public.paiements_manuels
    ADD CONSTRAINT paiements_manuels_type_check
    CHECK (type IN ('virement', 'especes', 'cheque', 'mobile_money', 'carte', 'autre'));

-- ── 3. Vérification ──────────────────────────────────────────
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.paiements_manuels'::regclass
AND contype = 'c';
