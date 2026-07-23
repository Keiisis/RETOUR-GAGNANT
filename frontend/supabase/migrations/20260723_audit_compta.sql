-- ══════════════════════════════════════════════════════════════
--  JOURNAL D'AUDIT COMPTABLE
--  Les dépenses, paiements et avoirs sont modifiables par plusieurs
--  personnes. Sans trace, impossible de savoir QUI a changé QUOI —
--  et impossible de justifier une correction en cas de contrôle.
--
--  Chaque écriture conserve la valeur AVANT et APRÈS.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.audit_compta (
    id           uuid primary key default gen_random_uuid(),
    -- Quoi
    table_cible  text not null,          -- depenses | paiements_manuels | documents_financiers
    record_id    uuid not null,
    action       text not null check (action in ('create', 'update', 'delete')),
    -- Qui
    acteur_id    uuid,
    acteur_email text,
    acteur_role  text,
    -- Valeurs (uniquement les champs touchés)
    avant        jsonb not null default '{}'::jsonb,
    apres        jsonb not null default '{}'::jsonb,
    -- Contexte
    motif        text,
    created_at   timestamptz not null default now()
);

create index if not exists audit_compta_cible_idx  on public.audit_compta (table_cible, record_id, created_at desc);
create index if not exists audit_compta_acteur_idx on public.audit_compta (acteur_id, created_at desc);
create index if not exists audit_compta_date_idx   on public.audit_compta (created_at desc);

-- Journal INALTÉRABLE : aucune policy d'écriture ni de lecture côté
-- client. Tout passe par les routes service-role.
alter table public.audit_compta enable row level security;

-- Interdire explicitement la modification et la suppression des traces,
-- y compris par le rôle service (protection contre une erreur de code).
create or replace function public.audit_compta_immuable()
returns trigger language plpgsql as $$
begin
    raise exception 'Le journal d''audit est inaltérable (ni modification ni suppression).';
end $$;

drop trigger if exists audit_compta_no_update on public.audit_compta;
create trigger audit_compta_no_update
    before update or delete on public.audit_compta
    for each row execute function public.audit_compta_immuable();
