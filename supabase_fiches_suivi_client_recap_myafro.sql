-- ══════════════════════════════════════════════════════════════
--  Fiches de suivi client RGB : numéro RGB-AAAA-76NNNNN et
--  « N° fiche récap MyAfroOrigins » (19/11/2026).
--  À exécuter une fois dans Supabase → SQL Editor. Rejouable sans effet de bord.
-- ══════════════════════════════════════════════════════════════

-- ─── 1. N° fiche récap MyAfroOrigins (ex. « N°627920856 DU 2026-10-28 ») ──
-- Numéro et date saisis par l'équipe, modifiables à tout moment.
ALTER TABLE public.fiches_suivi_client
    ADD COLUMN IF NOT EXISTS myafro_recap_numero TEXT,
    ADD COLUMN IF NOT EXISTS myafro_recap_date   DATE;

-- ─── 2. Nouveau format des numéros : RGB-2026-7600001, RGB-2026-7600002… ──
CREATE OR REPLACE FUNCTION public.fiches_suivi_client_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.numero IS NULL OR NEW.numero = '' THEN
            NEW.numero := 'RGB-' || to_char(NOW() AT TIME ZONE 'Africa/Porto-Novo', 'YYYY')
                       || '-76' || lpad(nextval('public.fiches_suivi_client_seq')::text, 5, '0');
        END IF;
    ELSE
        NEW.numero := OLD.numero;  -- un numéro attribué ne change plus
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END $$;

-- ─── 3. Fiches déjà numérotées à l'ancien format (RGB-2026-000001) ──
-- Aperçu de la conversion :
SELECT numero AS ancien,
       regexp_replace(numero, '^(RGB-\d{4})-0*(\d{1,5})$', '\1') || '-76'
           || lpad(regexp_replace(numero, '^RGB-\d{4}-0*(\d{1,5})$', '\1'), 5, '0') AS nouveau
FROM public.fiches_suivi_client
WHERE numero ~ '^RGB-\d{4}-\d{6}$'
ORDER BY numero;

-- Conversion (le déclencheur fige le numéro : il est suspendu le temps de la mise à jour).
ALTER TABLE public.fiches_suivi_client DISABLE TRIGGER trg_fiches_suivi_client_numero;
UPDATE public.fiches_suivi_client
SET numero = regexp_replace(numero, '^(RGB-\d{4})-0*(\d{1,5})$', '\1') || '-76'
          || lpad(regexp_replace(numero, '^RGB-\d{4}-0*(\d{1,5})$', '\1'), 5, '0')
WHERE numero ~ '^RGB-\d{4}-\d{6}$';
ALTER TABLE public.fiches_suivi_client ENABLE TRIGGER trg_fiches_suivi_client_numero;

-- Contrôle :
SELECT count(*) AS fiches, max(numero) AS dernier_numero FROM public.fiches_suivi_client;
