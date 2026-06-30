-- ══════════════════════════════════════════════════════════════
-- Classement Client — table de suivi CRM des clients par catégorie de service
-- Relances planifiées (15/20/30/45/60/75/90 jours) + notes + statut.
-- Accès serveur uniquement (service role). RLS activée sans policy publique.
-- ══════════════════════════════════════════════════════════════

create table if not exists public.client_classement (
    id                uuid primary key default gen_random_uuid(),
    email             text not null,                          -- toujours stocké en minuscules
    full_name         text,
    phone             text,
    service_category  text not null default 'autres',         -- slug de catégorie (cf. lib/classement)
    service_label     text,                                   -- libellé d'origine (texte libre)
    source            text,                                   -- rdv | nationalite | contact | manuel | backfill
    status            text not null default 'nouveau',        -- nouveau|en_cours|en_attente_client|bloque|converti|perdu|termine
    notes             text,                                   -- où on en est, problèmes, possibilités…
    first_contact_at  timestamptz not null default now(),
    last_review_at    timestamptz,
    relances_sent     jsonb not null default '[]'::jsonb,     -- jalons déjà notifiés, ex. [15,20,30]
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- Un client unique par email
create unique index if not exists client_classement_email_uniq
    on public.client_classement (email);

create index if not exists client_classement_category_idx
    on public.client_classement (service_category);

create index if not exists client_classement_first_contact_idx
    on public.client_classement (first_contact_at);

create index if not exists client_classement_status_idx
    on public.client_classement (status);

-- Maj automatique de updated_at
create or replace function public.touch_client_classement()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_touch_client_classement on public.client_classement;
create trigger trg_touch_client_classement
    before update on public.client_classement
    for each row execute function public.touch_client_classement();

-- Sécurité : RLS activée, aucune policy → seul le service role (API serveur) accède.
alter table public.client_classement enable row level security;
