-- ══════════════════════════════════════════════════════════════
--  LISTE BLANCHE DYNAMIQUE DU PERSONNEL
--
--  Le problème résolu : l'adresse IP de l'agence est attribuée
--  dynamiquement par l'opérateur. Elle change sans prévenir, et une
--  adresse recyclée arrive avec la réputation de son précédent
--  occupant. Le 30 juillet 2026, l'administrateur s'est ainsi retrouvé
--  bloqué par son propre WAF dans son back-office : 370 refus en 24 h
--  sur la nouvelle adresse.
--
--  Une liste blanche saisie à la main ne tient pas face à une IP
--  dynamique : elle est périmée dès le lendemain. Cette table la
--  remplace par un enregistrement automatique, à durée de vie glissante.
--
--  ── Ce que cette table N'accorde PAS ──────────────────────────
--  Une IP de confiance est exemptée des contrôles de BLOCAGE
--  (blocage d'IP, score de confiance, limitation de débit, géo-blocage)
--  mais RESTE soumise à la DÉTECTION : pot de miel et moteur d'analyse
--  des requêtes. Une attaque lancée depuis une IP du personnel est
--  toujours vue, journalisée et arrêtée.
--
--  ── Pourquoi c'est sûr ────────────────────────────────────────
--  Seule une session valide, vérifiée cryptographiquement par Supabase,
--  et portant un rôle interne peut inscrire une adresse. Quelqu'un
--  capable de cela possède déjà les droits du panel : l'exemption de
--  blocage par IP ne lui apporte rien de plus.
--
--  L'adresse n'est JAMAIS lue dans le corps de la requête : elle est
--  extraite des en-têtes de proxy de confiance, par la même fonction
--  que le WAF lui-même (`extractIp`).
-- ══════════════════════════════════════════════════════════════

create table if not exists public.waf_trusted_ips (
    ip            text        not null,
    user_id       uuid        not null references auth.users(id) on delete cascade,
    role          text        not null default '',
    user_agent    text        not null default '',

    first_seen_at timestamptz not null default now(),
    last_seen_at  timestamptz not null default now(),
    -- Fenêtre glissante : repoussée à chaque passage du membre du
    -- personnel. Une adresse qu'il n'utilise plus s'efface d'elle-même,
    -- ce qui règle le cas de l'IP dynamique sans intervention.
    expires_at    timestamptz not null default now() + interval '7 days',

    primary key (ip, user_id)
);

create index if not exists waf_trusted_ips_actives_idx
    on public.waf_trusted_ips (expires_at desc);
create index if not exists waf_trusted_ips_user_idx
    on public.waf_trusted_ips (user_id, last_seen_at desc);

-- ── Sécurité ──────────────────────────────────────────────────
-- Aucune politique : RLS active sans policy signifie « personne, sauf
-- le rôle de service ». Cette table ne doit jamais être lisible ni
-- modifiable depuis un navigateur.
alter table public.waf_trusted_ips enable row level security;

-- ── Enregistrement ────────────────────────────────────────────
--  Tout est fait ici, en une seule transaction : validation de
--  l'adresse, inscription ou prolongation, plafond par utilisateur,
--  purge des expirées.
--
--  Renvoie le nombre d'adresses actives pour cet utilisateur, ou -1 si
--  l'adresse a été refusée.
create or replace function public.enregistrer_ip_de_confiance(
    p_ip         text,
    p_user_id    uuid,
    p_role       text,
    p_user_agent text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actives integer;
    -- Au-delà, les adresses les plus anciennes sont retirées. Trois
    -- couvrent le bureau, le domicile et le partage de connexion
    -- mobile ; garder davantage élargirait la surface sans utilité.
    c_max_par_utilisateur constant integer := 3;
begin
    -- Adresse inutilisable ou non publique : on refuse. Une adresse
    -- privée ne peut pas être celle d'un visiteur, et l'inscrire
    -- exempterait tout le réseau interne d'un hébergeur.
    if p_ip is null or length(trim(p_ip)) = 0 or p_ip = 'unknown' then
        return -1;
    end if;
    if p_ip ~ '^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1|fe80:|fc00:|fd)'
       or p_ip ~ '^172\.(1[6-9]|2[0-9]|3[01])\.' then
        return -1;
    end if;

    insert into public.waf_trusted_ips (ip, user_id, role, user_agent)
    values (trim(p_ip), p_user_id, coalesce(p_role, ''), coalesce(left(p_user_agent, 400), ''))
    on conflict (ip, user_id) do update
        set last_seen_at = now(),
            expires_at   = now() + interval '7 days',
            role         = excluded.role,
            user_agent   = excluded.user_agent;

    -- Plafond : on ne garde que les plus récemment vues.
    delete from public.waf_trusted_ips w
     where w.user_id = p_user_id
       and w.ip not in (
            select ip from public.waf_trusted_ips
             where user_id = p_user_id
             order by last_seen_at desc
             limit c_max_par_utilisateur
       );

    -- Purge opportuniste : évite de dépendre d'une tâche planifiée.
    delete from public.waf_trusted_ips where expires_at < now();

    select count(*) into v_actives
      from public.waf_trusted_ips
     where user_id = p_user_id and expires_at > now();

    return v_actives;
end $$;

revoke all on function public.enregistrer_ip_de_confiance(text, uuid, text, text) from public, anon, authenticated;

-- ── Purge planifiable ─────────────────────────────────────────
--  Sans effet si la purge opportuniste a déjà fait le travail. À
--  brancher sur le cron waf-maintenance existant.
create or replace function public.purger_ips_de_confiance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
    delete from public.waf_trusted_ips where expires_at < now();
    get diagnostics n = row_count;
    return n;
end $$;
