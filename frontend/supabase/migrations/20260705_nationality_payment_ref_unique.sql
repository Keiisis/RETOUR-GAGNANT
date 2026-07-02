-- ══════════════════════════════════════════════════════════════
-- Blindage webhook Kkiapay nationalité : une transaction = UNE fiche.
-- Le webhook et le formulaire peuvent théoriquement insérer en même temps
-- (fenêtre de quelques millisecondes) ; cet index unique rend le doublon
-- impossible au niveau base (la 2e insertion échoue proprement et le flux
-- retombe sur le chemin idempotent).
-- À exécuter dans le SQL Editor Supabase.
-- ══════════════════════════════════════════════════════════════

create unique index if not exists uidx_nationality_applications_payment_ref
    on public.nationality_applications (payment_ref)
    where payment_ref is not null;
