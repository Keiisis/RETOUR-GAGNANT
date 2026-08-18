-- ══════════════════════════════════════════════════════════════════════════
--  SÉJOUR CULTUREL + SMART SLIDES DANS L'APPLICATION — 2026-08-18
--
--  Trois besoins :
--   1. capter le PARCOURS TOURISTIQUE souhaité (villes, activités, récit) au
--      moment de la demande de rendez-vous — c'est la matière première dont
--      l'agent a besoin pour bâtir sa proposition ;
--   2. rattacher un Smart Slide à un COMPTE CLIENT, pour qu'il apparaisse dans
--      son application. Jusqu'ici une proposition ne se partageait que par lien
--      secret : rien ne permettait de dire « ce slide appartient à ce client » ;
--   3. permettre la SIGNATURE du devis depuis l'application.
--
--  ⚠️ La vue `slide_proposals` n'est PAS touchée : elle fige la liste des
--  colonnes retenues à sa création et exclut les liens de paiement. La recréer
--  sans connaître sa clause exacte risquerait de faire disparaître des
--  propositions du panel. Le code lit donc les nouvelles colonnes directement
--  sur la table, puis fusionne — aucun risque pour l'existant.
--
--  SANS RISQUE : uniquement des ajouts conditionnels. Rejouable.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- 1. RATTACHEMENT D'UNE PROPOSITION À UN COMPTE CLIENT
--    `client_id` NULL  → proposition partagée par lien secret uniquement
--                        (fonctionnement historique, inchangé)
--    `client_id` REMPLI → visible dans l'application du client
-- ─────────────────────────────────────────────────────────────────────────
alter table public.ai_client_proposals
    add column if not exists client_id       uuid,
    add column if not exists sent_to_mobile  boolean not null default false,
    add column if not exists sent_at         timestamptz,
    -- Signature du devis depuis l'application
    add column if not exists signed_at       timestamptz,
    add column if not exists signature_data  text,
    add column if not exists signed_name     text;

create index if not exists ai_client_proposals_client_idx
    on public.ai_client_proposals (client_id, created_at desc)
    where client_id is not null;

create index if not exists ai_client_proposals_mobile_idx
    on public.ai_client_proposals (sent_to_mobile, created_at desc)
    where sent_to_mobile = true;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. PARCOURS TOURISTIQUE SOUHAITÉ
--    Rempli depuis l'application (« Préparer mon séjour »), lu par l'agent
--    avant de construire les slides. Rattaché au rendez-vous quand il existe.
--
--    Les villes et activités sont des TABLEAUX de texte : le client compose
--    librement son itinéraire, l'ordre du tableau EST l'ordre du parcours.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.tourism_itineraries (
    id             uuid primary key default gen_random_uuid(),
    client_id      uuid,
    rdv_id         uuid references public.rdv_requests (id) on delete set null,
    proposal_id    uuid references public.ai_client_proposals (id) on delete set null,

    -- Identité (le client peut ne pas avoir de compte : formulaire web)
    nom            text,
    prenom         text,
    email          text,
    telephone      text,

    -- Le voyage
    date_debut     date,
    date_fin       date,
    duree_jours    integer,
    voyageurs      integer default 1,
    budget         numeric(12,2),
    devise         text default 'EUR',

    -- Le parcours : l'ordre du tableau est l'ordre de visite
    villes         text[] not null default '{}',
    activites      text[] not null default '{}',
    recit          text,

    statut         text not null default 'nouveau'
                   check (statut in ('nouveau', 'en_preparation', 'propose', 'clos')),
    notes_agent    text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists tourism_itineraries_client_idx
    on public.tourism_itineraries (client_id, created_at desc);
create index if not exists tourism_itineraries_statut_idx
    on public.tourism_itineraries (statut, created_at desc);
create index if not exists tourism_itineraries_email_idx
    on public.tourism_itineraries (email);

alter table public.tourism_itineraries enable row level security;
-- Le client lit SON parcours ; les panels passent par les routes API en
-- service_role, qui ne sont pas soumises à cette règle.
drop policy if exists tourism_itineraries_read_own on public.tourism_itineraries;
create policy tourism_itineraries_read_own
    on public.tourism_itineraries for select using (client_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE APRÈS EXÉCUTION — doit renvoyer 3 lignes à 1
-- ══════════════════════════════════════════════════════════════════════════
select 'ai_client_proposals.client_id' as objet, count(*) as present
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ai_client_proposals' and column_name = 'client_id'
union all
select 'ai_client_proposals.signed_at', count(*)
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ai_client_proposals' and column_name = 'signed_at'
union all
select 'table tourism_itineraries', count(*)
  from information_schema.tables
 where table_schema = 'public' and table_name = 'tourism_itineraries';
