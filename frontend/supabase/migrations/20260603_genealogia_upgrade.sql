-- ============================================================
-- GENEALOGIA — Upgrade schema
-- Migration : 20260603_genealogia_upgrade.sql
-- Upgrades tables and policies to support manual clients and photos
-- ============================================================

-- 1. Modify public.trees to make user_id nullable and add client fields
alter table public.trees alter column user_id drop not null;

alter table public.trees add column if not exists client_first_name text;
alter table public.trees add column if not exists client_last_name text;
alter table public.trees add column if not exists client_email text;

-- 2. Modify public.persons to add avatar_url
alter table public.persons add column if not exists avatar_url text;

-- 3. Update RLS policies to allow admins, superadmins, CEOs and agents access to all records
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
