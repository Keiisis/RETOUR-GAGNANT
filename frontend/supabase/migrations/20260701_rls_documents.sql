-- ══════════════════════════════════════════════════════════════
-- RLS — isolation propriétaire sur documents_financiers & client_documents
--
-- Ces tables contiennent des données sensibles (factures, documents uploadés)
-- et sont lues/supprimées DIRECTEMENT depuis le navigateur (clé anon). Sans
-- policy RLS, un client pouvait lire/supprimer les données d'autres clients.
--
-- Le service role (API serveur admin/agent/mobile) contourne la RLS
-- automatiquement — ces policies n'affectent donc que l'accès navigateur.
-- Idempotent + guards to_regclass.
-- ══════════════════════════════════════════════════════════════

-- ── documents_financiers ──────────────────────────────────────
do $$
begin
    if to_regclass('public.documents_financiers') is not null then
        execute 'alter table public.documents_financiers enable row level security';

        execute 'drop policy if exists "df_owner_select" on public.documents_financiers';
        execute $p$
            create policy "df_owner_select" on public.documents_financiers
            for select to authenticated
            using (
                client_id = auth.uid()
                or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        $p$;

        execute 'drop policy if exists "df_owner_update" on public.documents_financiers';
        execute $p$
            create policy "df_owner_update" on public.documents_financiers
            for update to authenticated
            using (
                client_id = auth.uid()
                or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        $p$;
    end if;
end $$;

-- ── client_documents ──────────────────────────────────────────
do $$
begin
    if to_regclass('public.client_documents') is not null then
        execute 'alter table public.client_documents enable row level security';

        execute 'drop policy if exists "cd_owner_select" on public.client_documents';
        execute $p$
            create policy "cd_owner_select" on public.client_documents
            for select to authenticated
            using (
                client_id = auth.uid()
                or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        $p$;

        execute 'drop policy if exists "cd_owner_insert" on public.client_documents';
        execute $p$
            create policy "cd_owner_insert" on public.client_documents
            for insert to authenticated
            with check ( client_id = auth.uid() )
        $p$;

        execute 'drop policy if exists "cd_owner_delete" on public.client_documents';
        execute $p$
            create policy "cd_owner_delete" on public.client_documents
            for delete to authenticated
            using (
                client_id = auth.uid()
                or lower(coalesce(client_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
        $p$;
    end if;
end $$;
