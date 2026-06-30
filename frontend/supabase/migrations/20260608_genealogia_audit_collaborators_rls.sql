-- ============================================================
-- GENEALOGIA — Audit trail + Collaborateurs + RLS durcies
-- Migration : 20260608_genealogia_audit_collaborators_rls.sql
-- Couvre les 3 manques critiques :
--   P1.1 audit trail (table + triggers AFTER INSERT/UPDATE/DELETE)
--   P1.2 permissions multi-utilisateurs (tree_collaborators)
--   P1.3 RLS Supabase + contraintes d'intégrité métier
-- Idempotente : peut être ré-exécutée sans casser l'existant
-- ============================================================

-- ============================================================
-- P1.1 — AUDIT TRAIL
-- ============================================================

create table if not exists public.genealogy_audit_log (
    id uuid primary key default uuid_generate_v4(),
    table_name text not null,
    record_id uuid not null,
    tree_id uuid,                       -- pour filtrer rapidement par arbre
    action text not null check (action in ('INSERT','UPDATE','DELETE')),
    actor_id uuid,                      -- auth.uid() — qui a fait l'action
    actor_email text,                   -- snapshot email (cas où le user est supprimé plus tard)
    before_data jsonb,                  -- ligne avant (UPDATE/DELETE)
    after_data jsonb,                   -- ligne après (INSERT/UPDATE)
    diff jsonb,                         -- delta calculé (UPDATE uniquement)
    ip_address inet,                    -- IP optionnelle (depuis request.headers via API)
    user_agent text,                    -- UA optionnel
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_tree on public.genealogy_audit_log(tree_id);
create index if not exists idx_audit_record on public.genealogy_audit_log(table_name, record_id);
create index if not exists idx_audit_actor on public.genealogy_audit_log(actor_id);
create index if not exists idx_audit_created on public.genealogy_audit_log(created_at desc);

-- ---- Fonction trigger générique d'audit ----
-- SECURITY DEFINER pour pouvoir écrire dans audit_log même quand l'utilisateur
-- n'a pas de policy d'INSERT direct. Le trigger est attaché à des tables RLS-protégées.
create or replace function public.fn_audit_genealogy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid := auth.uid();
    v_email text;
    v_tree_id uuid;
    v_before jsonb;
    v_after jsonb;
    v_diff jsonb;
begin
    -- Récupère l'email actuel de l'acteur (snapshot)
    if v_actor is not null then
        select email into v_email from auth.users where id = v_actor;
    end if;

    if (tg_op = 'DELETE') then
        v_before := to_jsonb(old);
        v_after := null;
        v_tree_id := case
            when tg_table_name = 'trees' then old.id
            else (old.tree_id)
        end;
    elsif (tg_op = 'INSERT') then
        v_before := null;
        v_after := to_jsonb(new);
        v_tree_id := case
            when tg_table_name = 'trees' then new.id
            else (new.tree_id)
        end;
    else  -- UPDATE
        v_before := to_jsonb(old);
        v_after := to_jsonb(new);
        v_tree_id := case
            when tg_table_name = 'trees' then new.id
            else (new.tree_id)
        end;
        -- Diff = clés où la valeur a changé
        select coalesce(jsonb_object_agg(key, jsonb_build_object('old', v_before -> key, 'new', v_after -> key)), '{}'::jsonb)
        into v_diff
        from jsonb_object_keys(v_after) as key
        where (v_before -> key) is distinct from (v_after -> key);
    end if;

    insert into public.genealogy_audit_log
        (table_name, record_id, tree_id, action, actor_id, actor_email, before_data, after_data, diff)
    values
        (tg_table_name,
         coalesce(new.id, old.id),
         v_tree_id,
         tg_op,
         v_actor,
         v_email,
         v_before,
         v_after,
         v_diff);

    return coalesce(new, old);
end;
$$;

-- ---- Attachement des triggers sur les 4 tables sensibles ----
drop trigger if exists trg_audit_trees on public.trees;
create trigger trg_audit_trees
    after insert or update or delete on public.trees
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_persons on public.persons;
create trigger trg_audit_persons
    after insert or update or delete on public.persons
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_gdocs on public.genealogy_documents;
create trigger trg_audit_gdocs
    after insert or update or delete on public.genealogy_documents
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_dossiers on public.dossiers;
create trigger trg_audit_dossiers
    after insert or update or delete on public.dossiers
    for each row execute function public.fn_audit_genealogy();


-- ============================================================
-- P1.2 — COLLABORATEURS (tree sharing multi-utilisateurs)
-- ============================================================

create table if not exists public.tree_collaborators (
    id uuid primary key default uuid_generate_v4(),
    tree_id uuid not null references public.trees(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('viewer','editor')) default 'viewer',
    invited_by uuid references auth.users(id) on delete set null,
    accepted_at timestamptz,            -- null = invitation en attente
    created_at timestamptz not null default now(),
    unique (tree_id, user_id)
);

create index if not exists idx_collab_tree on public.tree_collaborators(tree_id);
create index if not exists idx_collab_user on public.tree_collaborators(user_id);

-- Audit aussi les changements de collaboration
drop trigger if exists trg_audit_collaborators on public.tree_collaborators;
create trigger trg_audit_collaborators
    after insert or update or delete on public.tree_collaborators
    for each row execute function public.fn_audit_genealogy();


-- ============================================================
-- HELPERS RLS — fonctions stables pour les policies
-- ============================================================

-- Renvoie true si auth.uid() est admin/agent/ceo
create or replace function public.is_genealogy_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.user_profiles
        where id = auth.uid()
          and role in ('admin','super_admin','superadmin','ceo','agent')
    );
$$;

-- Renvoie true si auth.uid() est owner OU collaborateur (accepté) de tree
create or replace function public.can_read_tree(p_tree_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        exists (select 1 from public.trees where id = p_tree_id and user_id = auth.uid())
        or exists (
            select 1 from public.tree_collaborators
            where tree_id = p_tree_id
              and user_id = auth.uid()
              and accepted_at is not null
        )
        or public.is_genealogy_staff();
$$;

-- Renvoie true si auth.uid() peut écrire dans tree (owner OU editor accepté OU staff)
create or replace function public.can_write_tree(p_tree_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select
        exists (select 1 from public.trees where id = p_tree_id and user_id = auth.uid())
        or exists (
            select 1 from public.tree_collaborators
            where tree_id = p_tree_id
              and user_id = auth.uid()
              and role = 'editor'
              and accepted_at is not null
        )
        or public.is_genealogy_staff();
$$;


-- ============================================================
-- P1.3 — RLS durcies : SELECT / INSERT / UPDATE / DELETE séparés
-- (Remplacement des anciennes policies "own_xxx" en bloc)
-- ============================================================

-- ---- TREES ----
drop policy if exists "own_trees" on public.trees;
drop policy if exists "trees_select" on public.trees;
drop policy if exists "trees_insert" on public.trees;
drop policy if exists "trees_update" on public.trees;
drop policy if exists "trees_delete" on public.trees;

create policy "trees_select" on public.trees
    for select using (public.can_read_tree(id));

create policy "trees_insert" on public.trees
    for insert with check (auth.uid() = user_id or public.is_genealogy_staff());

create policy "trees_update" on public.trees
    for update using (public.can_write_tree(id))
    with check (public.can_write_tree(id));

-- DELETE réservé au owner ou staff (un editor ne peut PAS supprimer l'arbre entier)
create policy "trees_delete" on public.trees
    for delete using (
        exists (select 1 from public.trees t2 where t2.id = trees.id and t2.user_id = auth.uid())
        or public.is_genealogy_staff()
    );

-- ---- PERSONS ----
drop policy if exists "own_persons" on public.persons;
drop policy if exists "persons_select" on public.persons;
drop policy if exists "persons_insert" on public.persons;
drop policy if exists "persons_update" on public.persons;
drop policy if exists "persons_delete" on public.persons;

create policy "persons_select" on public.persons
    for select using (public.can_read_tree(tree_id));

create policy "persons_insert" on public.persons
    for insert with check (public.can_write_tree(tree_id));

create policy "persons_update" on public.persons
    for update using (public.can_write_tree(tree_id))
    with check (public.can_write_tree(tree_id));

create policy "persons_delete" on public.persons
    for delete using (public.can_write_tree(tree_id));

-- ---- GENEALOGY_DOCUMENTS ----
drop policy if exists "own_genealogy_documents" on public.genealogy_documents;
drop policy if exists "gdocs_select" on public.genealogy_documents;
drop policy if exists "gdocs_insert" on public.genealogy_documents;
drop policy if exists "gdocs_update" on public.genealogy_documents;
drop policy if exists "gdocs_delete" on public.genealogy_documents;

create policy "gdocs_select" on public.genealogy_documents
    for select using (public.can_read_tree(tree_id));

create policy "gdocs_insert" on public.genealogy_documents
    for insert with check (public.can_write_tree(tree_id));

create policy "gdocs_update" on public.genealogy_documents
    for update using (public.can_write_tree(tree_id))
    with check (public.can_write_tree(tree_id));

create policy "gdocs_delete" on public.genealogy_documents
    for delete using (public.can_write_tree(tree_id));

-- ---- DOSSIERS (genealogy) ----
drop policy if exists "own_dossiers" on public.dossiers;
drop policy if exists "dossiers_select" on public.dossiers;
drop policy if exists "dossiers_insert" on public.dossiers;
drop policy if exists "dossiers_update" on public.dossiers;
drop policy if exists "dossiers_delete" on public.dossiers;

create policy "dossiers_select" on public.dossiers
    for select using (
        -- Cas 1 : nouveau schéma genealogy (tree_id non null)
        (tree_id is not null and public.can_read_tree(tree_id))
        -- Cas 2 : ancien schéma services (tree_id null = dossiers clients/services)
        or (tree_id is null and (auth.uid() = user_id or public.is_genealogy_staff()))
    );

create policy "dossiers_insert" on public.dossiers
    for insert with check (
        (tree_id is not null and public.can_write_tree(tree_id))
        or (tree_id is null and (auth.uid() = user_id or public.is_genealogy_staff()))
    );

create policy "dossiers_update" on public.dossiers
    for update using (
        (tree_id is not null and public.can_write_tree(tree_id))
        or (tree_id is null and (auth.uid() = user_id or public.is_genealogy_staff()))
    )
    with check (
        (tree_id is not null and public.can_write_tree(tree_id))
        or (tree_id is null and (auth.uid() = user_id or public.is_genealogy_staff()))
    );

create policy "dossiers_delete" on public.dossiers
    for delete using (
        (tree_id is not null and public.can_write_tree(tree_id))
        or (tree_id is null and (auth.uid() = user_id or public.is_genealogy_staff()))
    );


-- ---- TREE_COLLABORATORS : seul l'owner ou un staff peut gérer ----
alter table public.tree_collaborators enable row level security;

drop policy if exists "collab_select" on public.tree_collaborators;
create policy "collab_select" on public.tree_collaborators
    for select using (
        -- Le collaborateur voit sa propre invitation
        user_id = auth.uid()
        -- L'owner du tree voit toutes les invitations qu'il a émises
        or exists (select 1 from public.trees t where t.id = tree_collaborators.tree_id and t.user_id = auth.uid())
        or public.is_genealogy_staff()
    );

drop policy if exists "collab_insert" on public.tree_collaborators;
create policy "collab_insert" on public.tree_collaborators
    for insert with check (
        -- Seul l'owner du tree peut inviter
        exists (select 1 from public.trees t where t.id = tree_collaborators.tree_id and t.user_id = auth.uid())
        or public.is_genealogy_staff()
    );

drop policy if exists "collab_update" on public.tree_collaborators;
create policy "collab_update" on public.tree_collaborators
    for update using (
        -- Le collaborateur peut accepter son invitation
        user_id = auth.uid()
        -- L'owner peut changer le rôle
        or exists (select 1 from public.trees t where t.id = tree_collaborators.tree_id and t.user_id = auth.uid())
        or public.is_genealogy_staff()
    );

drop policy if exists "collab_delete" on public.tree_collaborators;
create policy "collab_delete" on public.tree_collaborators
    for delete using (
        -- Le collaborateur peut quitter de lui-même
        user_id = auth.uid()
        -- L'owner peut révoquer
        or exists (select 1 from public.trees t where t.id = tree_collaborators.tree_id and t.user_id = auth.uid())
        or public.is_genealogy_staff()
    );


-- ---- AUDIT LOG : lecture seule pour staff et owner ----
alter table public.genealogy_audit_log enable row level security;

drop policy if exists "audit_select" on public.genealogy_audit_log;
create policy "audit_select" on public.genealogy_audit_log
    for select using (
        public.is_genealogy_staff()
        or (tree_id is not null and exists (
            select 1 from public.trees t where t.id = genealogy_audit_log.tree_id and t.user_id = auth.uid()
        ))
    );

-- Aucune policy INSERT/UPDATE/DELETE : seul le trigger SECURITY DEFINER peut écrire


-- ============================================================
-- CONTRAINTES D'INTÉGRITÉ MÉTIER (validation côté serveur)
-- ============================================================

-- Garantit que father_id et mother_id appartiennent au même arbre que la personne.
-- Empêche un client malveillant (ou un bug) de mélanger des nœuds inter-arbres.
create or replace function public.fn_check_person_parents_same_tree()
returns trigger
language plpgsql
as $$
declare
    v_father_tree uuid;
    v_mother_tree uuid;
begin
    if new.father_id is not null then
        select tree_id into v_father_tree from public.persons where id = new.father_id;
        if v_father_tree is null or v_father_tree <> new.tree_id then
            raise exception 'father_id % is not in the same tree as person', new.father_id
                using errcode = 'check_violation';
        end if;
    end if;
    if new.mother_id is not null then
        select tree_id into v_mother_tree from public.persons where id = new.mother_id;
        if v_mother_tree is null or v_mother_tree <> new.tree_id then
            raise exception 'mother_id % is not in the same tree as person', new.mother_id
                using errcode = 'check_violation';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_check_parents_tree on public.persons;
create trigger trg_check_parents_tree
    before insert or update of father_id, mother_id, tree_id on public.persons
    for each row execute function public.fn_check_person_parents_same_tree();
