-- ══════════════════════════════════════════════════════════════
-- Badge « non lus » sur les RÉPONSES de conversation.
--
-- Les nouveaux messages arrivent dans `messages` (lu=false) → le badge
-- agent/admin (qui compte messages.lu=false) s'incrémente. Mais les RÉPONSES
-- d'un fil vont dans `chat_messages` : sans ce trigger, une relance du client
-- dans un fil existant restait invisible (aucun badge, aucune alerte).
--
-- Ce trigger remet le fil parent en « non lu » dès qu'un client répond, ce qui
-- ré-incrémente le badge. Quand l'agent ouvre le fil, le code existant repasse
-- lu=true. SECURITY DEFINER pour contourner la RLS de `messages`.
-- ══════════════════════════════════════════════════════════════

create or replace function public.mark_thread_unread_on_client_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.role = 'client' and NEW.conversation_id is not null then
        update public.messages set lu = false where id = NEW.conversation_id;
    end if;
    return NEW;
end;
$$;

do $$
begin
    if to_regclass('public.chat_messages') is not null then
        drop trigger if exists trg_chat_client_reply on public.chat_messages;
        create trigger trg_chat_client_reply
            after insert on public.chat_messages
            for each row execute function public.mark_thread_unread_on_client_reply();
    end if;
end $$;
