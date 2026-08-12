-- ══════════════════════════════════════════════════════════════
--  TYPES DE PERMIS DE CONDUIRE BÉNINOIS (catégories officielles ANATT)
--
--  Au Bénin, le prix du permis dépend de la CATÉGORIE choisie par le client
--  (moto, voiture, poids lourd, transport en commun...). Cette table porte les
--  catégories officielles ; le PRIX (EUR) et la DURÉE sont renseignés et
--  modifiés depuis le panel admin (aucun prix codé en dur). Lecture publique
--  des catégories actives ; écritures en service_role (route admin).
--
--  Catégories issues de l'ANATT (Agence Nationale des Transports Terrestres) :
--  https://www.test.anatt.bj/page/permis-de-conduire
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.permis_types (
    id            uuid primary key default gen_random_uuid(),
    category      text not null,        -- ex. « A1 », « B », « C »
    label         text not null,        -- intitulé clair pour le client
    description   text,                 -- ce que la catégorie autorise à conduire
    age_min       integer,              -- âge minimum requis
    -- Prix EUR (converti en XOF au taux BCEAO au paiement). NULL = à renseigner
    -- en admin ; tant que NULL, la catégorie s'affiche « Tarif à confirmer ».
    price_eur     numeric(10,2),
    duration      text,                 -- ex. « 1 mois », « 6 semaines »
    is_active     boolean not null default true,
    order_index   integer not null default 0,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists permis_types_active_idx on public.permis_types (is_active, order_index);

alter table public.permis_types enable row level security;
drop policy if exists permis_types_read on public.permis_types;
create policy permis_types_read on public.permis_types for select using (is_active = true);

-- ── Seed des catégories officielles (prix à renseigner en admin) ──
-- Idempotent : n'insère une catégorie que si elle n'existe pas déjà.
insert into public.permis_types (category, label, description, age_min, order_index)
select v.category, v.label, v.description, v.age_min, v.order_index
from (values
    ('A1', 'Cyclomoteur (A1)',        'Cyclomoteurs et motos légères jusqu''à 125 cm³.',                                   16, 1),
    ('A2', 'Moto (A2)',               'Motocyclettes.',                                                                    18, 2),
    ('A3', 'Moto lourde / tricycle (A3)', 'Motos de forte cylindrée et tricycles à moteur.',                              21, 3),
    ('B',  'Voiture (B)',             'Véhicules légers et voitures particulières jusqu''à 3,5 tonnes (9 places au plus).', 18, 4),
    ('F',  'Véhicule aménagé (F)',    'Véhicules spécialement aménagés pour les personnes à mobilité réduite.',            18, 5),
    ('C1', 'Camion moyen (C1)',       'Véhicules de transport de marchandises de tonnage moyen.',                          21, 6),
    ('C',  'Poids lourd (C)',         'Véhicules de transport de marchandises de plus de 3,5 tonnes.',                     21, 7),
    ('D',  'Transport en commun (D)', 'Véhicules de transport en commun de personnes (bus, cars).',                        21, 8),
    ('Dr', 'Transport de personnes (Dr)', 'Transport rémunéré de personnes (taxi, VTC).',                                  21, 9),
    ('E',  'Remorque / articulé (E)', 'Ensembles de véhicules avec remorque et véhicules articulés.',                     21, 10)
) as v(category, label, description, age_min, order_index)
where not exists (select 1 from public.permis_types p where p.category = v.category);
