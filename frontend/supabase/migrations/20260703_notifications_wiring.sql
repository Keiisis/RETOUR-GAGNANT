-- ══════════════════════════════════════════════════════════════
-- Notifications client ALIMENTÉES par les actions du staff (temps réel).
--
-- Jusqu'ici, quand un agent faisait avancer un dossier, répondait à un
-- message ou confirmait un RDV, le client ne recevait AUCUNE notification.
-- Ces triggers créent une notification `notifications` à chaque événement,
-- quelle que soit l'origine (panel agent, admin, API). Le mobile (realtime)
-- l'affiche instantanément ; un dernier trigger déclenche le push Expo.
--
-- Idempotent. SECURITY DEFINER pour résoudre l'utilisateur et écrire.
-- ══════════════════════════════════════════════════════════════

-- ── Résout l'id utilisateur depuis un client_id (uuid) ou un email ──
create or replace function public.resolve_client_user_id(p_client_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
    if p_client_id is not null then return p_client_id; end if;
    if p_email is null or p_email = '' then return null; end if;
    select id into v_id from auth.users where lower(email) = lower(p_email) limit 1;
    return v_id;
end; $$;

-- ── Crée une notification (in-app) pour un utilisateur ──
create or replace function public.create_client_notification(p_user_id uuid, p_title text, p_body text, p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if p_user_id is null then return; end if;
    insert into public.notifications (user_id, title, body, type, is_read, created_at)
    values (p_user_id, p_title, p_body, coalesce(p_type, 'general'), false, now());
end; $$;

-- ── 1. Changement de statut de dossier ───────────────────────
create or replace function public.tf_notify_dossier_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_label text;
begin
    if NEW.statut is distinct from OLD.statut then
        v_uid := public.resolve_client_user_id(NEW.client_id, NEW.client_email);
        v_label := case NEW.statut
            when 'reception' then 'Reçu'
            when 'verifie' then 'Vérifié'
            when 'traitement' then 'En traitement'
            when 'en_cours' then 'En cours'
            when 'validation' then 'En validation'
            when 'termine' then 'Terminé'
            when 'annule' then 'Annulé'
            else NEW.statut
        end;
        perform public.create_client_notification(
            v_uid,
            'Mise à jour de votre dossier',
            'Votre dossier est maintenant : ' || v_label || '.',
            'dossier'
        );
    end if;
    return NEW;
end; $$;

-- ── 2. Réponse d'un conseiller dans une conversation ─────────
create or replace function public.tf_notify_agent_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_client_id uuid; v_email text;
begin
    if NEW.role = 'agent' and NEW.conversation_id is not null then
        select client_id, email into v_client_id, v_email
        from public.messages where id = NEW.conversation_id;
        v_uid := public.resolve_client_user_id(v_client_id, v_email);
        perform public.create_client_notification(
            v_uid,
            'Nouvelle réponse de votre conseiller',
            'Vous avez reçu une réponse à votre message. Ouvrez la messagerie pour la consulter.',
            'message'
        );
    end if;
    return NEW;
end; $$;

-- ── 3. Rendez-vous confirmé ──────────────────────────────────
create or replace function public.tf_notify_rdv_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid uuid;
begin
    if NEW.statut is distinct from OLD.statut and NEW.statut in ('confirme', 'confirmed') then
        v_uid := public.resolve_client_user_id(NEW.client_id, NEW.client_email);
        perform public.create_client_notification(
            v_uid,
            'Rendez-vous confirmé',
            'Votre rendez-vous a été confirmé par notre équipe.'
                || case when NEW.date is not null then ' Date : ' || NEW.date::text || '.' else '' end,
            'appointment'
        );
    end if;
    return NEW;
end; $$;

-- ── Attache les triggers (guards to_regclass) ────────────────
do $$
begin
    if to_regclass('public.dossier_tracking') is not null then
        drop trigger if exists trg_notify_dossier_status on public.dossier_tracking;
        create trigger trg_notify_dossier_status after update on public.dossier_tracking
            for each row execute function public.tf_notify_dossier_status();
    end if;
    if to_regclass('public.chat_messages') is not null then
        drop trigger if exists trg_notify_agent_reply on public.chat_messages;
        create trigger trg_notify_agent_reply after insert on public.chat_messages
            for each row execute function public.tf_notify_agent_reply();
    end if;
    if to_regclass('public.rdv_requests') is not null then
        drop trigger if exists trg_notify_rdv_confirmed on public.rdv_requests;
        create trigger trg_notify_rdv_confirmed after update on public.rdv_requests
            for each row execute function public.tf_notify_rdv_confirmed();
    end if;
end $$;

-- ── 4. Dispatch PUSH quand une notification est créée ────────
-- Best-effort via pg_net (extension `net`). Appelle l'endpoint qui envoie
-- le push Expo. Nécessite : extension pg_net + le secret `app.push_secret`
-- (à définir : ALTER DATABASE ... SET app.push_secret = '<PUSH_SECRET>').
create or replace function public.tf_dispatch_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_secret text;
begin
    begin
        v_secret := current_setting('app.push_secret', true);
        perform net.http_post(
            url := 'https://www.retourgagnantbenin.bj/api/notifications/push',
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', coalesce(v_secret, '')),
            body := jsonb_build_object('user_id', NEW.user_id, 'title', NEW.title, 'body', NEW.body, 'type', NEW.type)
        );
    exception when others then
        -- pg_net absent ou erreur : la notification in-app reste créée
        null;
    end;
    return NEW;
end; $$;

do $$
begin
    if to_regnamespace('net') is not null and to_regclass('public.notifications') is not null then
        drop trigger if exists trg_dispatch_push on public.notifications;
        create trigger trg_dispatch_push after insert on public.notifications
            for each row execute function public.tf_dispatch_push();
    end if;
end $$;
