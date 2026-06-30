-- ============================================================
-- GENEALOGIA — Schéma Supabase complet
-- Migration : 20260603_genealogia_schema.sql
-- Safe: handles pre-existing tables gracefully
-- ============================================================

-- Extension UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLEANUP: drop stale tables from prior failed migration attempts
-- (no production data yet — safe to recreate from scratch)
-- ============================================================
drop table if exists public.genealogy_documents cascade;
drop table if exists public.dossiers cascade;
drop table if exists public.persons cascade;
drop table if exists public.trees cascade;


-- ============================================================
-- TABLE: trees (un arbre par utilisateur, ou plusieurs)
-- ============================================================
create table if not exists public.trees (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade, -- Nullable to allow manual client creation
  name text not null default 'Mon arbre',
  client_first_name text,
  client_last_name text,
  client_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: persons (chaque personne / nœud de l'arbre)
-- ============================================================
create table if not exists public.persons (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- Nullable to allow manual client creation
  first_name text,
  last_name text,
  gender text check (gender in ('male','female','other')),
  birth_date date,
  birth_place text,
  death_date date,
  death_place text,
  is_self boolean not null default false,
  relation_role text,
  father_id uuid references public.persons(id) on delete set null,
  mother_id uuid references public.persons(id) on delete set null,
  notes text,
  avatar_url text, -- Photo of the person
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: genealogy_documents (coffre-fort documentaire)
-- Separate table to avoid conflicts with existing documents table
-- ============================================================
create table if not exists public.genealogy_documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade, -- Nullable
  tree_id uuid not null references public.trees(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  doc_type text not null,
  title text,
  file_path text,
  file_url text,
  issued_date date,
  expires_check boolean not null default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE: dossiers (suivi des 2 dossiers par arbre)
-- ============================================================
create table if not exists public.dossiers (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- Nullable
  dossier_type text not null check (dossier_type in ('afro_descendance','ancetre_esclavage')),
  status text not null default 'in_progress',
  progress numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tree_id, dossier_type)
);

-- ============================================================
-- INDEX
-- ============================================================
create index if not exists idx_persons_tree on public.persons(tree_id);
create index if not exists idx_gdocs_person on public.genealogy_documents(person_id);
create index if not exists idx_gdocs_tree on public.genealogy_documents(tree_id);

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_trees_updated on public.trees;
create trigger trg_trees_updated before update on public.trees
for each row execute function public.set_updated_at();

drop trigger if exists trg_persons_updated on public.persons;
create trigger trg_persons_updated before update on public.persons
for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.trees enable row level security;
alter table public.persons enable row level security;
alter table public.genealogy_documents enable row level security;
alter table public.dossiers enable row level security;

-- Policies: chaque utilisateur ne voit/édite que ses données + admins/agents ont accès complet
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

-- ============================================================
-- STORAGE BUCKET (à créer + policies)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('genealogia-docs', 'genealogia-docs', false)
on conflict (id) do nothing;

drop policy if exists "own_gdocs_select" on storage.objects;
create policy "own_gdocs_select" on storage.objects
  for select using (bucket_id = 'genealogia-docs' and (auth.uid()::text = (storage.foldername(name))[1] or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))));

drop policy if exists "own_gdocs_insert" on storage.objects;
create policy "own_gdocs_insert" on storage.objects
  for insert with check (bucket_id = 'genealogia-docs' and (auth.uid()::text = (storage.foldername(name))[1] or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))));

drop policy if exists "own_gdocs_delete" on storage.objects;
create policy "own_gdocs_delete" on storage.objects
  for delete using (bucket_id = 'genealogia-docs' and (auth.uid()::text = (storage.foldername(name))[1] or exists (select 1 from public.user_profiles where id = auth.uid() and role in ('admin', 'super_admin', 'superadmin', 'ceo', 'agent'))));
