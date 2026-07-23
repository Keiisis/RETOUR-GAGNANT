-- ══════════════════════════════════════════════════════════════
--  INTÉGRITÉ DES PAIEMENTS
--  1) Idempotence RÉELLE (contrainte d'unicité) au lieu d'une
--     comparaison de chaînes dans `notes` — deux webhooks simultanés
--     ne peuvent plus créer deux factures pour un même encaissement.
--  2) File de rejeu des webhooks : plus aucun paiement encaissé ne
--     peut rester sans enregistrement à cause d'une panne passagère.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Clé d'origine unique sur les documents financiers ──────
-- Ex. « proposal:a976a4fc-0a2 », « nationality:RG-NAT-2026-2722 »,
--     « order:<uuid> ». NULL pour les documents saisis à la main.
alter table public.documents_financiers
    add column if not exists source_ref text;

-- Unicité partielle : n'affecte que les documents auto-générés.
create unique index if not exists documents_financiers_source_ref_uidx
    on public.documents_financiers (source_ref)
    where source_ref is not null;

-- Idem pour les encaissements directs (catégorie « paiements »)
alter table public.paiements_manuels
    add column if not exists source_ref text;

create unique index if not exists paiements_manuels_source_ref_uidx
    on public.paiements_manuels (source_ref)
    where source_ref is not null;

-- ── 2. Unicité du numéro de document (anti-doublon de séquence) ─
create unique index if not exists documents_financiers_numero_uidx
    on public.documents_financiers (numero)
    where numero is not null;

-- ── 3. File de rejeu des webhooks ─────────────────────────────
create table if not exists public.webhook_failures (
    id            uuid primary key default gen_random_uuid(),
    provider      text not null,               -- kkiapay | fedapay | stripe | paypal | zeyow
    event_type    text,                        -- nationality | order | proposal…
    reference     text,                        -- transaction_id / order_id / ref dossier
    payload       jsonb not null default '{}'::jsonb,
    error_message text,
    attempts      integer not null default 1,
    resolved      boolean not null default false,
    resolved_at   timestamptz,
    created_at    timestamptz not null default now(),
    last_try_at   timestamptz not null default now()
);

create index if not exists webhook_failures_open_idx
    on public.webhook_failures (resolved, created_at desc);
create index if not exists webhook_failures_ref_idx
    on public.webhook_failures (provider, reference);

alter table public.webhook_failures enable row level security;
-- Aucune policy : accès exclusivement via les routes service-role.

-- ── 4. Backfill des source_ref existants (best effort) ────────
-- Documents issus d'un lien de paiement / proposition
update public.documents_financiers
   set source_ref = 'proposal:' || lower(substring(notes from 'Proposal: ([A-Za-z0-9-]+)'))
 where source_ref is null
   and notes ~ 'Proposal: [A-Za-z0-9-]+';

-- Documents issus d'un dossier nationalité
update public.documents_financiers
   set source_ref = 'nationality:' || substring(notes from 'Dossier: (RG-NAT-[0-9-]+)')
 where source_ref is null
   and notes ~ 'Dossier: RG-NAT-[0-9-]+';

-- Encaissements directs issus d'un lien de paiement
update public.paiements_manuels
   set source_ref = 'proposal:' || lower(substring(notes from '\[PROP:([A-Za-z0-9-]+)\]'))
 where source_ref is null
   and notes ~ '\[PROP:[A-Za-z0-9-]+\]';
