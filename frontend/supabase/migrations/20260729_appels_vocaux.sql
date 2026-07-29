-- ══════════════════════════════════════════════════════════════
--  APPELS VOCAUX EN DIRECT — client ↔ agent
--
--  Le client lance un appel depuis l'application mobile ou son espace
--  web. Les agents connectés le voient sonner dans leur panel et
--  décrochent. La voix passe en pair-à-pair (WebRTC) : elle ne
--  transite JAMAIS par cette table.
--
--  Cette table sert uniquement à :
--    • signaler qu'un appel est demandé, accepté, refusé ou terminé ;
--    • transporter les messages de négociation WebRTC (SDP, ICE) ;
--    • garder une trace pour l'historique et la facturation du temps.
--
--  Le temps réel Supabase diffuse les changements : aucun sondage.
-- ══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1. Appels ─────────────────────────────────────────────────
create table if not exists public.calls (
    id              uuid primary key default gen_random_uuid(),

    client_id       uuid not null references auth.users(id) on delete cascade,
    client_nom      text not null default '',
    client_email    text not null default '',

    -- Renseigné au décroché : l'agent qui a pris l'appel.
    agent_id        uuid references auth.users(id) on delete set null,
    agent_nom       text,

    -- ringing  : le client appelle, personne n'a encore décroché
    -- active   : un agent a décroché, la conversation est en cours
    -- ended    : raccroché normalement
    -- declined : un agent a refusé explicitement
    -- missed   : personne n'a décroché dans le délai imparti
    statut          text not null default 'ringing'
                    check (statut in ('ringing', 'active', 'ended', 'declined', 'missed')),

    -- Qui a mis fin à l'appel : 'client' ou 'agent'. Null si expiré.
    termine_par     text check (termine_par in ('client', 'agent')),

    -- Contexte facultatif : dossier ou prestation concernée.
    sujet           text,

    created_at      timestamptz not null default now(),
    answered_at     timestamptz,
    ended_at        timestamptz,
    -- Durée en secondes, calculée au raccroché.
    duree_secondes  integer
);

create index if not exists calls_statut_idx      on public.calls (statut, created_at desc);
create index if not exists calls_client_idx      on public.calls (client_id, created_at desc);
create index if not exists calls_agent_idx       on public.calls (agent_id, created_at desc);

-- ── 2. Messages de négociation WebRTC ─────────────────────────
--  Une offre, une réponse, puis des candidats ICE de chaque côté.
--  Ces lignes sont éphémères : purgées avec l'appel.
create table if not exists public.call_signals (
    id          bigserial primary key,
    call_id     uuid not null references public.calls(id) on delete cascade,
    -- 'client' ou 'agent' : qui a émis ce message.
    emetteur    text not null check (emetteur in ('client', 'agent')),
    -- 'offer' | 'answer' | 'ice'
    type        text not null check (type in ('offer', 'answer', 'ice')),
    payload     jsonb not null,
    created_at  timestamptz not null default now()
);

create index if not exists call_signals_call_idx on public.call_signals (call_id, id);

-- ── 3. Sécurité ───────────────────────────────────────────────
alter table public.calls        enable row level security;
alter table public.call_signals enable row level security;

do $$
begin
    -- Le client voit et crée ses propres appels.
    if not exists (select 1 from pg_policies where tablename = 'calls' and policyname = 'client_lit_ses_appels') then
        create policy "client_lit_ses_appels" on public.calls
            for select using (auth.uid() = client_id);
    end if;

    if not exists (select 1 from pg_policies where tablename = 'calls' and policyname = 'client_cree_son_appel') then
        create policy "client_cree_son_appel" on public.calls
            for insert with check (auth.uid() = client_id);
    end if;

    -- Le client peut raccrocher son propre appel.
    if not exists (select 1 from pg_policies where tablename = 'calls' and policyname = 'client_maj_son_appel') then
        create policy "client_maj_son_appel" on public.calls
            for update using (auth.uid() = client_id);
    end if;

    -- Le personnel voit TOUS les appels : c'est le principe d'un standard.
    if not exists (select 1 from pg_policies where tablename = 'calls' and policyname = 'staff_lit_les_appels') then
        create policy "staff_lit_les_appels" on public.calls
            for select using (
                exists (
                    select 1 from public.user_profiles p
                    where p.id = auth.uid() and p.role in ('agent', 'admin')
                )
            );
    end if;

    if not exists (select 1 from pg_policies where tablename = 'calls' and policyname = 'staff_maj_les_appels') then
        create policy "staff_maj_les_appels" on public.calls
            for update using (
                exists (
                    select 1 from public.user_profiles p
                    where p.id = auth.uid() and p.role in ('agent', 'admin')
                )
            );
    end if;

    -- Signalisation : accessible aux deux parties de l'appel.
    if not exists (select 1 from pg_policies where tablename = 'call_signals' and policyname = 'parties_lisent_signaux') then
        create policy "parties_lisent_signaux" on public.call_signals
            for select using (
                exists (
                    select 1 from public.calls c
                    where c.id = call_id
                      and (
                        c.client_id = auth.uid()
                        or exists (
                            select 1 from public.user_profiles p
                            where p.id = auth.uid() and p.role in ('agent', 'admin')
                        )
                      )
                )
            );
    end if;

    if not exists (select 1 from pg_policies where tablename = 'call_signals' and policyname = 'parties_ecrivent_signaux') then
        create policy "parties_ecrivent_signaux" on public.call_signals
            for insert with check (
                exists (
                    select 1 from public.calls c
                    where c.id = call_id
                      and (
                        c.client_id = auth.uid()
                        or exists (
                            select 1 from public.user_profiles p
                            where p.id = auth.uid() and p.role in ('agent', 'admin')
                        )
                      )
                )
            );
    end if;
end $$;

-- ── 4. Diffusion temps réel ───────────────────────────────────
--  Sans cela, l'agent ne verrait pas l'appel sonner.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'calls'
    ) then
        alter publication supabase_realtime add table public.calls;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'call_signals'
    ) then
        alter publication supabase_realtime add table public.call_signals;
    end if;
end $$;

-- ── 5. Durée calculée au raccroché ────────────────────────────
create or replace function public.calc_duree_appel()
returns trigger
language plpgsql
as $$
begin
    if new.statut in ('ended', 'declined', 'missed') and old.statut not in ('ended', 'declined', 'missed') then
        new.ended_at := coalesce(new.ended_at, now());
        if new.answered_at is not null then
            new.duree_secondes := greatest(0, extract(epoch from (new.ended_at - new.answered_at))::int);
        else
            new.duree_secondes := 0;
        end if;
    end if;
    return new;
end $$;

drop trigger if exists trg_calc_duree_appel on public.calls;
create trigger trg_calc_duree_appel
    before update on public.calls
    for each row execute function public.calc_duree_appel();

-- ── 6. Purge des appels fantômes ──────────────────────────────
--  Un appel qui sonne depuis plus de 2 minutes sans réponse est manqué.
--  Appelée par le cron existant ; sans effet si aucun appel n'est en cours.
create or replace function public.purge_appels_sans_reponse()
returns integer
language plpgsql
security definer
as $$
declare
    n integer;
begin
    update public.calls
       set statut = 'missed'
     where statut = 'ringing'
       and created_at < now() - interval '2 minutes';
    get diagnostics n = row_count;

    -- La signalisation d'un appel clos n'a plus d'utilite.
    delete from public.call_signals s
     using public.calls c
     where s.call_id = c.id
       and c.statut in ('ended', 'declined', 'missed')
       and c.created_at < now() - interval '1 hour';

    return n;
end $$;
