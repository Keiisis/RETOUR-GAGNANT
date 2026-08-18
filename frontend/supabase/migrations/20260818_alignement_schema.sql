-- ══════════════════════════════════════════════════════════════════════════
--  ALIGNEMENT DU SCHÉMA SUR LE CODE — 2026-08-18
--
--  Origine : plusieurs fonctionnalités échouaient SANS message visible. En
--  cause, des colonnes et des tables que le code interroge mais qui n'existent
--  pas en base. PostgREST rejette la requête ENTIÈRE dès qu'un seul nom est
--  inconnu : l'écran ne reçoit alors rien du tout. C'est ce qui rendait les
--  événements invisibles et bloquait les compteurs du profil à « 00 ».
--
--  Établi par `node scripts/audit-schema.mjs` (comparaison du code avec le
--  schéma réel relu via l'API OpenAPI), puis vérifié cas par cas : ne sont
--  traités ici que les manques RÉELS. Les faux positifs de l'outil (clés
--  d'objets JSON, buckets de stockage) sont écartés, et les endroits où c'est
--  le CODE qui se trompe de nom sont corrigés dans le code, pas ici.
--
--  ⚠️ SANS RISQUE : uniquement des ajouts, tous conditionnels
--  (IF NOT EXISTS). Aucune colonne supprimée, aucune donnée modifiée.
--  Le script est REJOUABLE : l'exécuter deux fois ne change rien.
--
--  À exécuter dans l'éditeur SQL de Supabase.
-- ══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS PUSH : le jeton n'avait nulle part où être rangé
--    mobile/src/utils/pushToken.ts écrivait `push_token` sur client_profiles.
--    La colonne n'existant pas, l'enregistrement échouait à chaque ouverture
--    de l'application : AUCUNE notification push ne pouvait donc partir.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.client_profiles
    add column if not exists push_token              text,
    add column if not exists push_token_updated_at   timestamptz;

create index if not exists client_profiles_push_token_idx
    on public.client_profiles (push_token)
    where push_token is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. SUIVI DE LIVRAISON DES COMMANDES
--    Les écrans admin et mobile lisent et écrivent ces colonnes ; la table
--    n'avait que shipping_zone / shipping_fee / shipping_country /
--    shipping_address. Toute lecture partait donc en erreur, et la commande
--    n'affichait aucun suivi.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
    add column if not exists shipping_status    text default 'pending',
    add column if not exists shipping_city      text,
    add column if not exists shipping_postal    text,
    add column if not exists shipping_notes     text,
    add column if not exists tracking_code      text,
    add column if not exists tracking_url       text,
    add column if not exists tracking_carrier   text,
    add column if not exists shipped_at         timestamptz,
    add column if not exists delivered_at       timestamptz,
    -- Origine de la commande : 'web' | 'mobile'. Même rôle que
    -- dossier_tracking.source, pour distinguer les canaux.
    add column if not exists source             text default 'web';

create index if not exists orders_tracking_code_idx
    on public.orders (tracking_code)
    where tracking_code is not null;

create index if not exists orders_shipping_status_idx
    on public.orders (shipping_status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. HISTORIQUE DE LIVRAISON (frise du suivi client)
--    Écrit par /api/admin/orders/[id]/tracking, lu par /api/mobile/orders.
--    La table n'existait pas : chaque changement de statut était perdu.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.order_tracking_events (
    id          uuid primary key default gen_random_uuid(),
    order_id    uuid not null references public.orders (id) on delete cascade,
    status      text not null,
    label       text,
    description text,
    location    text,
    created_at  timestamptz not null default now()
);

create index if not exists order_tracking_events_order_idx
    on public.order_tracking_events (order_id, created_at desc);

alter table public.order_tracking_events enable row level security;
-- Lecture publique : la frise de suivi s'affiche pour le client, qui ne
-- connaît que l'identifiant de SA commande. Les écritures passent par les
-- routes API en service_role, jamais par le client.
drop policy if exists order_tracking_events_read on public.order_tracking_events;
create policy order_tracking_events_read
    on public.order_tracking_events for select using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. FACTURES
--    /api/mobile/invoices et lib/send-invoice-email s'appuient dessus. Sans
--    cette table, l'onglet « Mes factures » de l'application ne pouvait
--    RIEN afficher, et l'envoi de facture par email échouait.
--    Les colonnes reprennent exactement ce que le code lit.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.invoices (
    id             uuid primary key default gen_random_uuid(),
    invoice_ref    text unique,
    client_id      uuid,
    order_id       uuid references public.orders (id) on delete set null,
    dossier_id     uuid,
    customer_name  text,
    amount         numeric(12,2) not null default 0,
    currency       text not null default 'XOF',
    description    text,
    status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'cancelled', 'refunded')),
    issued_at      timestamptz not null default now(),
    paid_at        timestamptz,
    sent_to_email  text,
    pdf_url        text,
    items          jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists invoices_client_idx on public.invoices (client_id, issued_at desc);
create index if not exists invoices_order_idx  on public.invoices (order_id);

alter table public.invoices enable row level security;
-- Un client ne lit que SES factures. Les routes API (service_role) ne sont
-- pas soumises à cette règle.
drop policy if exists invoices_read_own on public.invoices;
create policy invoices_read_own
    on public.invoices for select using (client_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 5. NOTIFICATIONS DE L'ESPACE CLIENT WEB
--    components/layout/ClientBell interroge cette table par EMAIL (l'espace
--    client web identifie par email, pas par identifiant). La cloche restait
--    donc muette. Volontairement distincte de `notifications`, qui est
--    rattachée à un user_id : les deux publics ne sont pas les mêmes.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.client_notifications (
    id           uuid primary key default gen_random_uuid(),
    client_email text not null,
    title        text not null,
    message      text,
    type         text default 'info',
    link         text,
    is_read      boolean not null default false,
    created_at   timestamptz not null default now()
);

create index if not exists client_notifications_email_idx
    on public.client_notifications (client_email, created_at desc);

alter table public.client_notifications enable row level security;
-- Lecture ouverte, à l'image des autres tables de l'espace client web :
-- l'écriture reste réservée aux routes API en service_role.
drop policy if exists client_notifications_read on public.client_notifications;
create policy client_notifications_read
    on public.client_notifications for select using (true);

-- ─────────────────────────────────────────────────────────────────────────
-- 5 bis. CHEMIN DE STOCKAGE DES PIÈCES CLIENT
--    L'espace client supprime les fichiers du stockage à partir de leur
--    chemin. La table ne conservait que l'URL publique, dont on ne peut pas
--    déduire le chemin de façon fiable : les fichiers restaient donc en place
--    après suppression d'un dossier.
--    (Les autres colonnes de client_documents existent déjà sous les noms
--    file_name / file_url / file_type / file_size — c'est le CODE qui les
--    nommait en français ; il a été aligné sur la base, pas l'inverse.)
-- ─────────────────────────────────────────────────────────────────────────
alter table public.client_documents
    add column if not exists storage_path text;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. CLÔTURE COMPTABLE : compteur de réouvertures
--    /api/admin/comptabilite/cloture incrémente `reopen_count`.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.clotures_audit
    add column if not exists reopen_count integer not null default 0;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. MODÈLES DE DOCUMENTS : en-tête, pied et signature éditables
--    /admin/settings/erp enregistre ces quatre champs.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.document_templates
    add column if not exists header          text,
    add column if not exists footer          text,
    add column if not exists signature_name  text,
    add column if not exists signature_title text;

-- ══════════════════════════════════════════════════════════════════════════
--  CONTRÔLE APRÈS EXÉCUTION
--  Doit renvoyer 5 lignes : les colonnes et tables ajoutées existent bien.
-- ══════════════════════════════════════════════════════════════════════════
select 'client_profiles.push_token' as objet,
       count(*) as present
  from information_schema.columns
 where table_schema = 'public' and table_name = 'client_profiles' and column_name = 'push_token'
union all
select 'orders.tracking_code', count(*)
  from information_schema.columns
 where table_schema = 'public' and table_name = 'orders' and column_name = 'tracking_code'
union all
select 'table order_tracking_events', count(*)
  from information_schema.tables
 where table_schema = 'public' and table_name = 'order_tracking_events'
union all
select 'table invoices', count(*)
  from information_schema.tables
 where table_schema = 'public' and table_name = 'invoices'
union all
select 'table client_notifications', count(*)
  from information_schema.tables
 where table_schema = 'public' and table_name = 'client_notifications';
