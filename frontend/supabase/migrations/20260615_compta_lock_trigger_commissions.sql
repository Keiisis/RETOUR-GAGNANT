-- ═══════════════════════════════════════════════════════════════
-- COMPTA — Verrou de période INVIOLABLE + audit de réouverture + commissions
-- ═══════════════════════════════════════════════════════════════
-- Problème corrigé :
--   1. Le verrou de clôture n'était qu'applicatif (helper isPeriodLocked
--      branché sur UNE seule route). Or dépenses & paiements sont insérés
--      DIRECTEMENT depuis le client agent (clé anon) → verrou contournable.
--      => On déplace le verrou au niveau DB via triggers : inviolable, qu'on
--         passe par une route serveur OU par le client.
--   2. La réouverture (DELETE) détruisait le snapshot + hash sans trace
--      → réouvrir / altérer / reclôturer produisait un hash "propre".
--      => Soft-reopen audité : on conserve la ligne, on lève le verrou.
--   3. benefice_net ignorait les commissions agents.
--      => Colonnes total_commissions + benefice_net_final.

-- ───────────────────────────────────────────────────────────────
-- 1. Colonnes d'audit & financières sur clotures_mensuelles
-- ───────────────────────────────────────────────────────────────
ALTER TABLE clotures_mensuelles
    ADD COLUMN IF NOT EXISTS status            TEXT DEFAULT 'closed',  -- 'closed' | 'reopened'
    ADD COLUMN IF NOT EXISTS reopened_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reopened_by        UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS reopened_par_nom   TEXT,
    ADD COLUMN IF NOT EXISTS reopen_count       INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_commissions  NUMERIC(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS benefice_net_final NUMERIC(15, 2) DEFAULT 0;

-- Journal d'audit des réouvertures (trace permanente, jamais supprimée)
CREATE TABLE IF NOT EXISTS clotures_audit (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periode       TEXT NOT NULL,
    action        TEXT NOT NULL,                 -- 'cloture' | 'reopen' | 're-cloture'
    acteur_id     UUID REFERENCES auth.users(id),
    acteur_nom    TEXT,
    hash_avant    TEXT,                          -- hash d'intégrité avant l'action
    hash_apres    TEXT,
    details       JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clotures_audit_periode ON clotures_audit(periode);

-- ───────────────────────────────────────────────────────────────
-- 2. Fonction trigger : refuse toute mutation dans une période close
-- ───────────────────────────────────────────────────────────────
-- TG_ARGV[0] = nom de la colonne portant la date de rattachement comptable.
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

    -- Pas de date → pas de rattachement possible : on laisse passer
    IF d_val IS NULL OR d_val = '' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- UTC forcé pour matcher le calcul de période de la route (Date.UTC)
    v_periode := to_char((d_val::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM');

    SELECT count(*) INTO locked
    FROM clotures_mensuelles
    WHERE periode = v_periode
      AND COALESCE(status, 'closed') = 'closed';

    IF locked > 0 THEN
        RAISE EXCEPTION
            'Période comptable % clôturée : modification interdite. Rouvrez la clôture avant de modifier.', v_periode
            USING ERRCODE = 'check_violation';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

-- ───────────────────────────────────────────────────────────────
-- 3. Branchement des triggers
-- ───────────────────────────────────────────────────────────────
-- paiements_manuels & depenses = vérité de trésorerie (entrées du bénéfice)
--   → verrou TOTAL (INSERT / UPDATE / DELETE).
-- documents_financiers = facture/devis : on verrouille INSERT/DELETE mais on
--   laisse UPDATE (une facture de mois clos peut passer 'payé' le mois suivant ;
--   l'encaissement réel est tracé séparément dans paiements_manuels daté du
--   mois ouvert, lui bien verrouillé).

DROP TRIGGER IF EXISTS trg_lock_paiements ON paiements_manuels;
CREATE TRIGGER trg_lock_paiements
    BEFORE INSERT OR UPDATE OR DELETE ON paiements_manuels
    FOR EACH ROW EXECUTE FUNCTION fn_period_not_locked('date_paiement');

DROP TRIGGER IF EXISTS trg_lock_depenses ON depenses;
CREATE TRIGGER trg_lock_depenses
    BEFORE INSERT OR UPDATE OR DELETE ON depenses
    FOR EACH ROW EXECUTE FUNCTION fn_period_not_locked('date_depense');

DROP TRIGGER IF EXISTS trg_lock_documents_ins ON documents_financiers;
CREATE TRIGGER trg_lock_documents_ins
    BEFORE INSERT OR DELETE ON documents_financiers
    FOR EACH ROW EXECUTE FUNCTION fn_period_not_locked('created_at');

-- NB : le service role (routes serveur) est soumis AUX MÊMES triggers.
-- C'est voulu : aucune voie (client ou serveur) ne peut altérer un mois clos
-- tant qu'il n'a pas été explicitement rouvert (status='reopened') et tracé.
