-- ══════════════════════════════════════════════════════════════
--  PRÊTRES FA (Bokonon) — annuaire, certifications, avis clients
--  Alimente l'onglet Admin « Prêtres Fa » et la vitrine publique
--  du service « Consultation Fa & Racines ».
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. Prêtres ────────────────────────────────────────────────
create table if not exists public.fa_priests (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null,
    prenom          text not null default '',
    titre           text,                       -- ex. « Bokonon », « Maître du Fa »
    localisation    text,                       -- ex. « Ouidah, Bénin »
    bio             text,
    photo_url       text,                       -- portrait principal
    -- Prestations & services : [{ "label": "...", "description": "...", "price": "350 €" }]
    prestations     jsonb not null default '[]'::jsonb,
    -- Galerie : ["https://…", …]
    gallery         jsonb not null default '[]'::jsonb,
    -- Certifications : [{ "label": "Diplômé en …", "issuer": "…", "year": "2018" }]
    certifications  jsonb not null default '[]'::jsonb,
    -- Contact interne (jamais exposé publiquement)
    telephone       text,
    email           text,
    langues         jsonb not null default '[]'::jsonb,   -- ["Fon","Yoruba"]
    experience_ans  integer,
    is_active       boolean not null default true,
    order_index     integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists fa_priests_active_idx  on public.fa_priests (is_active, order_index);
create index if not exists fa_priests_created_idx on public.fa_priests (created_at desc);

-- ── 2. Avis clients ───────────────────────────────────────────
create table if not exists public.fa_priest_reviews (
    id            uuid primary key default gen_random_uuid(),
    priest_id     uuid not null references public.fa_priests(id) on delete cascade,
    author_name   text not null,
    author_email  text,
    rating        smallint not null check (rating between 1 and 5),
    comment       text,
    -- Modération : un avis n'apparaît publiquement qu'une fois publié
    is_published  boolean not null default false,
    created_at    timestamptz not null default now()
);

create index if not exists fa_reviews_priest_idx    on public.fa_priest_reviews (priest_id, is_published);
create index if not exists fa_reviews_created_idx   on public.fa_priest_reviews (created_at desc);

-- ── 3. Vue d'agrégation des notes (moyenne + volume) ──────────
create or replace view public.fa_priest_ratings as
select
    p.id                                   as priest_id,
    coalesce(round(avg(r.rating)::numeric, 2), 0) as rating_avg,
    count(r.id)                            as rating_count
from public.fa_priests p
left join public.fa_priest_reviews r
       on r.priest_id = p.id and r.is_published = true
group by p.id;

-- ── 4. updated_at automatique ─────────────────────────────────
create or replace function public.fa_priests_touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end $$;

drop trigger if exists fa_priests_touch on public.fa_priests;
create trigger fa_priests_touch
    before update on public.fa_priests
    for each row execute function public.fa_priests_touch_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────
-- Lecture publique : uniquement les prêtres actifs et les avis publiés.
-- Toute écriture passe par les routes API (service role) → aucune policy
-- d'écriture côté client.
alter table public.fa_priests        enable row level security;
alter table public.fa_priest_reviews enable row level security;

drop policy if exists fa_priests_public_read on public.fa_priests;
create policy fa_priests_public_read on public.fa_priests
    for select using (is_active = true);

drop policy if exists fa_reviews_public_read on public.fa_priest_reviews;
create policy fa_reviews_public_read on public.fa_priest_reviews
    for select using (is_published = true);

-- Dépôt d'un avis par un visiteur : autorisé, mais NON publié par défaut
-- (modération obligatoire côté admin).
drop policy if exists fa_reviews_public_insert on public.fa_priest_reviews;
create policy fa_reviews_public_insert on public.fa_priest_reviews
    for insert with check (is_published = false);
