-- ══════════════════════════════════════════════════════════════
--  Fiches de suivi : numérotation CONTINUE, sans trou (19/11/2026).
--  Avant : une séquence Postgres ; une fiche supprimée laissait un trou
--  (BIBEYRON numérotée RGB-2026-7600002 au lieu de 7600001).
--  Désormais : numéro = plus grand numéro de l'année + 1, attribué au
--  premier enregistrement. À exécuter une fois dans Supabase → SQL Editor.
-- ══════════════════════════════════════════════════════════════

-- ─── 1. Attribution sans trou ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fiches_suivi_client_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    annee TEXT;
    n     INT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.numero IS NULL OR NEW.numero = '' THEN
            -- Verrou de transaction : deux créations simultanées n'obtiennent pas le même numéro.
            PERFORM pg_advisory_xact_lock(hashtext('fiches_suivi_client_numero'));
            annee := to_char(NOW() AT TIME ZONE 'Africa/Porto-Novo', 'YYYY');
            SELECT coalesce(max(substring(numero FROM '^RGB-' || annee || '-76(\d{5})$')::int), 0) + 1
              INTO n
              FROM public.fiches_suivi_client
             WHERE numero LIKE 'RGB-' || annee || '-76%';
            NEW.numero := 'RGB-' || annee || '-76' || lpad(n::text, 5, '0');
        END IF;
    ELSE
        NEW.numero := OLD.numero;  -- un numéro attribué ne change plus
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END $$;

-- ─── 2. Renumérotation des fiches existantes, dans l'ordre de création ──
-- Aperçu :
SELECT numero AS actuel,
       'RGB-' || to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'YYYY') || '-76'
         || lpad(row_number() OVER (PARTITION BY to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'YYYY')
                                    ORDER BY created_at, id)::text, 5, '0') AS nouveau,
       nom_complet
FROM public.fiches_suivi_client
ORDER BY created_at;

ALTER TABLE public.fiches_suivi_client DISABLE TRIGGER trg_fiches_suivi_client_numero;
-- Étape intermédiaire : évite les collisions sur la contrainte UNIQUE pendant l'échange.
UPDATE public.fiches_suivi_client SET numero = 'TMP-' || id;
WITH o AS (
    SELECT id,
           'RGB-' || to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'YYYY') || '-76'
             || lpad(row_number() OVER (PARTITION BY to_char(created_at AT TIME ZONE 'Africa/Porto-Novo', 'YYYY')
                                        ORDER BY created_at, id)::text, 5, '0') AS numero
    FROM public.fiches_suivi_client
)
UPDATE public.fiches_suivi_client f SET numero = o.numero FROM o WHERE o.id = f.id;
ALTER TABLE public.fiches_suivi_client ENABLE TRIGGER trg_fiches_suivi_client_numero;

-- Contrôle :
SELECT numero, nom_complet, created_at FROM public.fiches_suivi_client ORDER BY numero;
