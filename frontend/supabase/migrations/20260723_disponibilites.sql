-- ══════════════════════════════════════════════════════════════
--  DISPONIBILITÉS & CRÉNEAUX DE RENDEZ-VOUS
--  Les rendez-vous (rdv_requests) existaient déjà mais le client
--  saisissait une date/heure LIBRE : aucune vérification d'ouverture,
--  aucun contrôle de conflit, aucune limite de charge.
--
--  Modèle :
--   • availability_rules      : plages RÉCURRENTES par jour de semaine
--   • availability_exceptions : fermetures ou ouvertures ponctuelles
--   Les créneaux libres sont CALCULÉS (règles − exceptions − réservés).
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. Plages récurrentes ─────────────────────────────────────
create table if not exists public.availability_rules (
    id            uuid primary key default gen_random_uuid(),
    -- 0 = dimanche … 6 = samedi (compatible JS getDay())
    weekday       smallint not null check (weekday between 0 and 6),
    start_time    time not null,
    end_time      time not null,
    slot_minutes  smallint not null default 30 check (slot_minutes between 5 and 480),
    -- Portée : null = tous services ; sinon 'nationalite' | 'fa' | 'general'…
    service       text,
    -- Rendez-vous simultanés autorisés sur un même créneau
    capacity      smallint not null default 1 check (capacity between 1 and 20),
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    constraint availability_rules_coherent check (end_time > start_time)
);
create index if not exists availability_rules_lookup_idx
    on public.availability_rules (is_active, weekday, service);

-- ── 2. Exceptions ponctuelles ─────────────────────────────────
-- kind = 'closed'  : ferme (journée entière ou plage)
-- kind = 'open'    : ouvre exceptionnellement (jour férié travaillé…)
create table if not exists public.availability_exceptions (
    id            uuid primary key default gen_random_uuid(),
    date          date not null,
    kind          text not null default 'closed' check (kind in ('closed', 'open')),
    start_time    time,          -- null = journée entière
    end_time      time,
    slot_minutes  smallint default 30,
    service       text,
    capacity      smallint default 1,
    reason        text,
    created_at    timestamptz not null default now()
);
create index if not exists availability_exceptions_date_idx
    on public.availability_exceptions (date, service);

-- ── 3. Recherche rapide des créneaux déjà réservés ────────────
create index if not exists rdv_requests_slot_idx
    on public.rdv_requests (date, heure);

-- ── 4. RLS ────────────────────────────────────────────────────
-- Lecture publique (le visiteur doit voir les créneaux ouverts) ;
-- écriture réservée aux routes service-role.
alter table public.availability_rules      enable row level security;
alter table public.availability_exceptions enable row level security;

drop policy if exists availability_rules_public_read on public.availability_rules;
create policy availability_rules_public_read on public.availability_rules
    for select using (is_active = true);

drop policy if exists availability_exceptions_public_read on public.availability_exceptions;
create policy availability_exceptions_public_read on public.availability_exceptions
    for select using (true);

-- ── 5. Horaires par défaut (lun–ven 9h–17h, samedi 9h–13h) ────
-- Insérés uniquement si aucune règle n'existe encore.
insert into public.availability_rules (weekday, start_time, end_time, slot_minutes, capacity)
select w, '09:00'::time, '17:00'::time, 30, 1
  from generate_series(1, 5) as w
 where not exists (select 1 from public.availability_rules);

insert into public.availability_rules (weekday, start_time, end_time, slot_minutes, capacity)
select 6, '09:00'::time, '13:00'::time, 30, 1
 where not exists (select 1 from public.availability_rules where weekday = 6);
