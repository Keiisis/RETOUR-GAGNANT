-- ══════════════════════════════════════════════════════════════
--  JOURNAL D'EXECUTION DES TACHES PLANIFIEES
--
--  Repond a « est-ce que tous les crons fonctionnent ? » sans ouvrir
--  les journaux Vercel : une ligne par execution, avec l'issue reelle.
--
--  Sans cette table, le code fonctionne quand meme (lib/cron-journal.ts
--  ignore l'erreur 42P01) : la journalisation est un confort, jamais un
--  prerequis a l'execution d'une relance client.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.cron_runs (
    id          uuid primary key default gen_random_uuid(),
    -- Nom court de la tache : 'cleanup', 'exchange-rates'...
    tache       text not null,
    -- succes  : la tache a repondu 2xx
    -- echec   : elle a repondu une erreur maitrisee (4xx/5xx)
    -- erreur  : une exception a ete levee
    etat        text not null check (etat in ('succes', 'echec', 'erreur')),
    duree_ms    integer not null default 0,
    statut_http integer,
    detail      text,
    created_at  timestamptz not null default now()
);

-- « Derniere execution de chaque tache » et « echecs recents » sont les
-- deux seules questions posees : un index sur (tache, date) les couvre.
create index if not exists cron_runs_tache_idx on public.cron_runs (tache, created_at desc);
create index if not exists cron_runs_etat_idx  on public.cron_runs (etat, created_at desc)
    where etat <> 'succes';

alter table public.cron_runs enable row level security;

-- Ecriture par le service role uniquement (les routes cron) ; lecture
-- reservee au personnel via les routes admin, jamais directement.
drop policy if exists "cron_runs_service" on public.cron_runs;
create policy "cron_runs_service" on public.cron_runs
    for all to service_role using (true) with check (true);

-- ── Vue de synthese : l'etat des taches d'un coup d'oeil ──────
create or replace view public.cron_sante as
select
    tache,
    max(created_at)                                   as derniere_execution,
    (array_agg(etat order by created_at desc))[1]     as dernier_etat,
    count(*) filter (where created_at > now() - interval '7 days')                        as executions_7j,
    count(*) filter (where created_at > now() - interval '7 days' and etat <> 'succes')   as echecs_7j,
    round(avg(duree_ms) filter (where created_at > now() - interval '7 days'))            as duree_moyenne_ms
from public.cron_runs
group by tache
order by derniere_execution desc nulls last;

comment on view public.cron_sante is
    'Etat des taches planifiees : derniere execution, dernier resultat, echecs sur 7 jours.';

-- Purge : 90 jours d'historique suffisent a diagnostiquer une panne.
-- Appelee par le cron cleanup.
create or replace function public.purge_cron_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    supprimees integer;
begin
    delete from public.cron_runs where created_at < now() - interval '90 days';
    get diagnostics supprimees = row_count;
    return supprimees;
end;
$$;

grant execute on function public.purge_cron_runs() to service_role;
