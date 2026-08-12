-- ══════════════════════════════════════════════════════════════
--  PERMIS DE CONDUIRE BÉNINOIS — auto-écoles partenaires
--
--  Service pour les afro-descendants qui viennent au Bénin et veulent un
--  permis de conduire béninois (éviter tout souci administratif). Le client
--  CHOISIT une auto-école partenaire (comme le choix du prêtre Fa). Chaque
--  auto-école porte SON prix et SA durée — 100 % éditables en admin, aucune
--  donnée codée en dur. Lecture publique des écoles actives ; écritures en
--  service_role (route admin) uniquement.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. Auto-écoles partenaires ────────────────────────────────
create table if not exists public.driving_schools (
    id              uuid primary key default gen_random_uuid(),
    nom             text not null,
    ville           text,                                 -- ex. « Cotonou »
    description     text,
    photo_url       text,
    -- Prix de la prestation, en EUR (converti en XOF au taux BCEAO au paiement,
    -- comme les autres services diaspora). L'admin le modifie librement.
    price_eur       numeric(10,2),
    -- Durée de la prestation (texte libre), ex. « 3 semaines », « 1 mois ».
    duration        text,
    -- Ce qui est inclus : ["Cours de code", "Heures de conduite", "Présentation à l'examen", …]
    features        jsonb   not null default '[]'::jsonb,
    -- Contact interne (jamais exposé publiquement)
    telephone       text,
    email           text,
    is_active       boolean not null default true,
    order_index     integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists driving_schools_active_idx  on public.driving_schools (is_active, order_index);
create index if not exists driving_schools_created_idx on public.driving_schools (created_at desc);

alter table public.driving_schools enable row level security;
drop policy if exists driving_schools_read on public.driving_schools;
create policy driving_schools_read on public.driving_schools for select using (is_active = true);
-- Écritures via route API en service_role (bypass RLS).

-- ── 2. Enregistrement du service (source de vérité : table services) ──
-- Éditable comme les autres depuis l'admin (titre, description, features…).
-- Idempotent SANS dépendre d'une contrainte unique sur services.slug :
-- on insère seulement si le service n'existe pas déjà. Le contenu reste ensuite
-- éditable depuis l'admin (titre, description, features…).
insert into public.services (slug, title, subtitle, description, features, pricing_options, price_display, color, icon_type, image_url, is_active, order_index)
select
    'permis-conduire',
    'Permis de Conduire Béninois',
    'Conduisez au Bénin en toute légalité — un permis officiel, sans tracas administratif',
    'Vous êtes afro-descendant et vous vous installez ou séjournez au Bénin ? Obtenez un permis de conduire béninois officiel, en règle, pour circuler l''esprit tranquille et éviter tout problème administratif. Nous vous mettons en relation avec une auto-école partenaire agréée, près de chez vous, et nous coordonnons l''ensemble de votre parcours : inscription, cours de code, heures de conduite et présentation à l''examen. Vous choisissez votre auto-école ; nous veillons à ce que tout se déroule proprement, de bout en bout.',
    '["Mise en relation avec une auto-école partenaire agréée", "Vous choisissez votre auto-école (ville, prix, durée)", "Inscription et constitution du dossier prises en charge", "Cours de code et heures de conduite avec des moniteurs qualifiés", "Présentation à l''examen officiel du permis béninois", "Accompagnement administratif complet jusqu''à l''obtention", "Un cadre clair et un suivi dédié tout au long du parcours"]'::jsonb,
    '[]'::jsonb,
    'Selon l''auto-école choisie',
    '#008751',
    'shield',
    '/assets/icones/permis-conduire.png',
    true,
    45
where not exists (select 1 from public.services where slug = 'permis-conduire');
