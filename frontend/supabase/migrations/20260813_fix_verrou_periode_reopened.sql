-- ═══════════════════════════════════════════════════════════════
-- FIX COMPTA — Le verrou de période ignorait la RÉOUVERTURE (status='reopened')
-- ═══════════════════════════════════════════════════════════════
-- Bug constaté (agent Ornel, dépense de Juillet 2026) :
--   • Juillet 2026 a été rouvert par l'admin (clotures_mensuelles.status =
--     'reopened'), MAIS l'insertion d'une dépense de Juillet échouait toujours
--     avec « Période comptable 2026-07 clôturée — écriture refusée » (code 23514).
--
-- Cause racine :
--   • La fonction trigger d'origine `check_period_not_locked()` (migration
--     20260416) bloque dès qu'une ligne existe dans clotures_mensuelles pour la
--     période, SANS regarder `status`. Elle ignore donc la réouverture.
--   • La migration 20260615 a bien introduit une version sensible au statut,
--     mais sous des noms DIFFÉRENTS (fn_period_not_locked / trg_lock_*), sans
--     remplacer l'ancienne fonction ni ses triggers `check_lock_*`. L'ancien
--     trigger reste actif et refire l'ancienne logique → réouverture sans effet.
--
-- Correctif définitif (idempotent, sans risque) :
--   On redéfinit `check_period_not_locked()` pour ne bloquer QUE si une clôture
--   de statut 'closed' existe. Une période 'reopened' redevient donc écrivable,
--   tout en gardant le verrou total sur les mois réellement clôturés.
--   Peu importe le trigger qui la porte (check_lock_* et/ou trg_lock_*), tous
--   respectent désormais la réouverture — une seule source de vérité.
-- ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_period_not_locked() RETURNS trigger AS $$
DECLARE
    target_date   DATE;
    target_period TEXT;
    locked        INT;
BEGIN
    -- Colonne de rattachement comptable selon la table
    IF TG_TABLE_NAME = 'paiements_manuels' THEN
        target_date := COALESCE(NEW.date_paiement, OLD.date_paiement);
    ELSIF TG_TABLE_NAME = 'depenses' THEN
        target_date := COALESCE(NEW.date_depense, OLD.date_depense);
    ELSIF TG_TABLE_NAME = 'documents_financiers' THEN
        target_date := COALESCE(NEW.created_at::DATE, OLD.created_at::DATE);
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Pas de date → pas de rattachement possible : on laisse passer
    IF target_date IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    target_period := TO_CHAR(target_date, 'YYYY-MM');

    -- ⇩ Le point du correctif : on ne verrouille QUE les clôtures 'closed'.
    SELECT count(*) INTO locked
    FROM clotures_mensuelles
    WHERE periode = target_period
      AND COALESCE(status, 'closed') = 'closed';

    IF locked > 0 THEN
        RAISE EXCEPTION
            'Periode comptable % cloturee : ecriture refusee. Rouvrez la cloture avant de modifier.', target_period
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Idem pour la version 20260615 si elle est présente en base : on s'assure
-- qu'elle respecte aussi le statut (elle le fait déjà, mais on la réaligne pour
-- garantir un comportement identique quel que soit le trigger déclenché).
CREATE OR REPLACE FUNCTION fn_period_not_locked() RETURNS trigger AS $$
DECLARE
    d_col     TEXT := TG_ARGV[0];
    rec       JSONB;
    d_val     TEXT;
    v_periode TEXT;
    locked    INT;
BEGIN
    rec := COALESCE(to_jsonb(NEW), to_jsonb(OLD));
    d_val := rec ->> d_col;

    IF d_val IS NULL OR d_val = '' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    v_periode := to_char((d_val::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM');

    SELECT count(*) INTO locked
    FROM clotures_mensuelles
    WHERE periode = v_periode
      AND COALESCE(status, 'closed') = 'closed';

    IF locked > 0 THEN
        RAISE EXCEPTION
            'Periode comptable % cloturee : ecriture refusee. Rouvrez la cloture avant de modifier.', v_periode
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- Vérification : liste les triggers de verrou encore présents sur depenses.
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.depenses'::regclass AND NOT tgisinternal;
