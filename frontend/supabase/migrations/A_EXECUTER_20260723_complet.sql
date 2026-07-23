-- ══════════════════════════════════════════════════════════════
--   À EXÉCUTER DANS L'ÉDITEUR SQL SUPABASE — FICHIER UNIQUE
--   Regroupe les deux migrations en attente au 23/07/2026 :
--     A) Intégrité des paiements (idempotence + rejeu webhooks)
--     B) Prêtres Fa (annuaire, certifications, avis)
--   Idempotent : ré-exécutable sans risque.
--   La numérotation séquentielle (RPC next_document_number) est DÉJÀ
--   active — rien à faire de ce côté.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ══════════════════════════════════════════════════════════════
--  A) INTÉGRITÉ DES PAIEMENTS
-- ══════════════════════════════════════════════════════════════

-- A1. Clé d'origine unique (idempotence garantie par la BASE)
alter table public.documents_financiers add column if not exists source_ref text;
create unique index if not exists documents_financiers_source_ref_uidx
    on public.documents_financiers (source_ref) where source_ref is not null;

alter table public.paiements_manuels add column if not exists source_ref text;
create unique index if not exists paiements_manuels_source_ref_uidx
    on public.paiements_manuels (source_ref) where source_ref is not null;

-- A2. Unicité du numéro de document (anti-doublon de séquence)
create unique index if not exists documents_financiers_numero_uidx
    on public.documents_financiers (numero) where numero is not null;

-- A3. File de rejeu des webhooks (aucun encaissement sans trace)
create table if not exists public.webhook_failures (
    id            uuid primary key default gen_random_uuid(),
    provider      text not null,
    event_type    text,
    reference     text,
    payload       jsonb not null default '{}'::jsonb,
    error_message text,
    attempts      integer not null default 1,
    resolved      boolean not null default false,
    resolved_at   timestamptz,
    created_at    timestamptz not null default now(),
    last_try_at   timestamptz not null default now()
);
create index if not exists webhook_failures_open_idx on public.webhook_failures (resolved, created_at desc);
create index if not exists webhook_failures_ref_idx  on public.webhook_failures (provider, reference);
alter table public.webhook_failures enable row level security;

-- A4. Backfill des source_ref existants (best effort, sans écraser)
update public.documents_financiers
   set source_ref = 'proposal:' || lower(substring(notes from 'Proposal: ([A-Za-z0-9-]+)'))
 where source_ref is null and notes ~ 'Proposal: [A-Za-z0-9-]+';

update public.documents_financiers
   set source_ref = 'nationality:' || substring(notes from 'Dossier: (RG-NAT-[0-9-]+)')
 where source_ref is null and notes ~ 'Dossier: RG-NAT-[0-9-]+';

update public.paiements_manuels
   set source_ref = 'proposal:' || lower(substring(notes from '\[PROP:([A-Za-z0-9-]+)\]'))
 where source_ref is null and notes ~ '\[PROP:[A-Za-z0-9-]+\]';

-- ══════════════════════════════════════════════════════════════
--  B) PRÊTRES FA (Bokonon)
-- ══════════════════════════════════════════════════════════════

create table if not exists public.fa_priests (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null,
    prenom          text not null default '',
    titre           text,
    localisation    text,
    bio             text,
    photo_url       text,
    prestations     jsonb not null default '[]'::jsonb,
    gallery         jsonb not null default '[]'::jsonb,
    certifications  jsonb not null default '[]'::jsonb,
    telephone       text,
    email           text,
    langues         jsonb not null default '[]'::jsonb,
    experience_ans  integer,
    is_active       boolean not null default true,
    order_index     integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists fa_priests_active_idx  on public.fa_priests (is_active, order_index);
create index if not exists fa_priests_created_idx on public.fa_priests (created_at desc);

create table if not exists public.fa_priest_reviews (
    id            uuid primary key default gen_random_uuid(),
    priest_id     uuid not null references public.fa_priests(id) on delete cascade,
    author_name   text not null,
    author_email  text,
    rating        smallint not null check (rating between 1 and 5),
    comment       text,
    is_published  boolean not null default false,
    created_at    timestamptz not null default now()
);
create index if not exists fa_reviews_priest_idx  on public.fa_priest_reviews (priest_id, is_published);
create index if not exists fa_reviews_created_idx on public.fa_priest_reviews (created_at desc);

create or replace view public.fa_priest_ratings as
select p.id as priest_id,
       coalesce(round(avg(r.rating)::numeric, 2), 0) as rating_avg,
       count(r.id) as rating_count
  from public.fa_priests p
  left join public.fa_priest_reviews r on r.priest_id = p.id and r.is_published = true
 group by p.id;

create or replace function public.fa_priests_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists fa_priests_touch on public.fa_priests;
create trigger fa_priests_touch before update on public.fa_priests
    for each row execute function public.fa_priests_touch_updated_at();

alter table public.fa_priests        enable row level security;
alter table public.fa_priest_reviews enable row level security;

drop policy if exists fa_priests_public_read on public.fa_priests;
create policy fa_priests_public_read on public.fa_priests
    for select using (is_active = true);

drop policy if exists fa_reviews_public_read on public.fa_priest_reviews;
create policy fa_reviews_public_read on public.fa_priest_reviews
    for select using (is_published = true);

drop policy if exists fa_reviews_public_insert on public.fa_priest_reviews;
create policy fa_reviews_public_insert on public.fa_priest_reviews
    for insert with check (is_published = false);

-- ══════════════════════════════════════════════════════════════
--  CONTRÔLE FINAL
-- ══════════════════════════════════════════════════════════════
select 'source_ref documents' as objet,
       count(*) filter (where source_ref is not null) as renseignes,
       count(*) as total
  from public.documents_financiers
union all
select 'source_ref paiements',
       count(*) filter (where source_ref is not null), count(*)
  from public.paiements_manuels;
