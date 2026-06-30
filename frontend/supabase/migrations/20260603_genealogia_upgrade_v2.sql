-- ============================================================
-- GENEALOGIA — Upgrade schema v2
-- Migration : 20260603_genealogia_upgrade_v2.sql
-- Upgrades tables and policies to support manual clients, avatars and collaterals
-- ============================================================

-- 1. Create public storage bucket for avatars
insert into storage.buckets (id, name, public)
values ('genealogia-avatars', 'genealogia-avatars', true)
on conflict (id) do nothing;

drop policy if exists "public_avatars_select" on storage.objects;
create policy "public_avatars_select" on storage.objects
  for select using (bucket_id = 'genealogia-avatars');

drop policy if exists "own_avatars_insert" on storage.objects;
create policy "own_avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'genealogia-avatars' 
    and (
      auth.uid()::text = (storage.foldername(name))[1] 
      or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
    )
  );

drop policy if exists "own_avatars_delete" on storage.objects;
create policy "own_avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'genealogia-avatars' 
    and (
      auth.uid()::text = (storage.foldername(name))[1] 
      or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
    )
  );

-- 2. Modify public.trees to make user_id nullable and add client fields
alter table public.trees alter column user_id drop not null;
alter table public.trees add column if not exists client_first_name text;
alter table public.trees add column if not exists client_last_name text;
alter table public.trees add column if not exists client_email text;

-- 3. Modify public.persons to make user_id nullable and add avatar_url
alter table public.persons alter column user_id drop not null;
alter table public.persons add column if not exists avatar_url text;

-- 4. Update RLS policies to allow admins, superadmins, CEOs and agents access to all records
-- public.trees
drop policy if exists "own_trees" on public.trees;
create policy "own_trees" on public.trees
  for all using (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  )
  with check (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  );

-- public.persons
drop policy if exists "own_persons" on public.persons;
create policy "own_persons" on public.persons
  for all using (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  )
  with check (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  );

-- public.genealogy_documents
drop policy if exists "own_genealogy_documents" on public.genealogy_documents;
create policy "own_genealogy_documents" on public.genealogy_documents
  for all using (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  )
  with check (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  );

-- public.dossiers
drop policy if exists "own_dossiers" on public.dossiers;
create policy "own_dossiers" on public.dossiers
  for all using (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  )
  with check (
    auth.uid() = user_id 
    or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))
  );
