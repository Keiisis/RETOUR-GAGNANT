-- ══════════════════════════════════════════════════════════════
-- Correctif : le secret du push ne peut PAS être stocké via
-- `ALTER DATABASE ... SET app.push_secret` sur Supabase (permission denied,
-- rôle non-superuser). On le stocke dans une table protégée, lue uniquement
-- par le trigger (SECURITY DEFINER).
--
-- APRÈS cette migration, définir le secret ainsi (autorisé dans le SQL Editor) :
--   insert into public.app_secrets (key, value)
--   values ('push_secret', 'LA_MEME_VALEUR_QUE_PUSH_SECRET_SUR_VERCEL')
--   on conflict (key) do update set value = excluded.value;
-- ══════════════════════════════════════════════════════════════

create table if not exists public.app_secrets (
    key   text primary key,
    value text not null
);

-- RLS activée, aucune policy → inaccessible via anon/authenticated.
-- Le service role et les fonctions SECURITY DEFINER contournent la RLS.
alter table public.app_secrets enable row level security;

-- Redéfinit le dispatch push pour lire le secret depuis la table
create or replace function public.tf_dispatch_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text;
begin
    begin
        select value into v_secret from public.app_secrets where key = 'push_secret';
        if v_secret is null or v_secret = '' then
            return NEW; -- secret non configuré : push ignoré, notification in-app conservée
        end if;
        perform net.http_post(
            url := 'https://www.retourgagnantbenin.bj/api/notifications/push',
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
            body := jsonb_build_object('user_id', NEW.user_id, 'title', NEW.title, 'body', NEW.body, 'type', NEW.type)
        );
    exception when others then
        null; -- pg_net absent ou erreur : la notification in-app reste créée
    end;
    return NEW;
end; $$;

-- (Le trigger trg_dispatch_push existe déjà et pointe sur cette fonction.)
do $$
begin
    if to_regnamespace('net') is not null and to_regclass('public.notifications') is not null then
        drop trigger if exists trg_dispatch_push on public.notifications;
        create trigger trg_dispatch_push after insert on public.notifications
            for each row execute function public.tf_dispatch_push();
    end if;
end $$;
