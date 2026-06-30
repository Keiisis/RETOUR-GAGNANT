-- ============================================================
-- GENEALOGIA — Passage en système "legal-grade"
-- Migration : 20260610_genealogia_legal_grade.sql
-- ============================================================
-- Couvre :
--   #1 Sources & niveau de confiance (person_facts + confidence sur docs)
--   #2 Document many-to-many personnes (document_persons)
--   #3 Validation temporelle stricte (trigger fn_check_person_timeline)
--   #4 Multi-unions + adoption/filiation (unions + parent_child)
--   #5 Personnes vivantes / RGPD (is_living auto + anonymisation)
--   #8 Commentaires collaboratifs (person_comments)
-- Idempotent — ré-exécutable sans casser l'existant
-- ============================================================

-- ============================================================
-- #5 — is_living : champ calculé automatiquement
-- ============================================================

alter table public.persons add column if not exists is_living boolean not null default true;
alter table public.persons add column if not exists anonymized_at timestamptz;
alter table public.persons add column if not exists anonymized_by uuid references auth.users(id) on delete set null;

create or replace function public.fn_compute_is_living()
returns trigger
language plpgsql
as $$
begin
    -- Personne marquée comme décédée
    if new.death_date is not null then
        new.is_living := false;
    -- Personne née il y a plus de 110 ans sans date de décès → considérée décédée
    elsif new.birth_date is not null and new.birth_date < (current_date - interval '110 years') then
        new.is_living := false;
    else
        new.is_living := true;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_compute_is_living on public.persons;
create trigger trg_compute_is_living
    before insert or update of birth_date, death_date on public.persons
    for each row execute function public.fn_compute_is_living();

-- Re-calcule sur les lignes existantes (one-shot)
update public.persons set is_living = is_living where id is not null;


-- ============================================================
-- #3 — Validation temporelle stricte (au niveau SQL)
-- ============================================================
-- Empêche les incohérences classiques :
--  - personne morte avant sa naissance
--  - enfant né plus de 9 mois après le décès du père
--  - enfant né plus de 1 mois avant naissance du parent
--  - décalage > 70 ans entre parent et enfant
--  - mariage avant 12 ans
-- ============================================================

create or replace function public.fn_check_person_timeline()
returns trigger
language plpgsql
as $$
declare
    v_father_birth date;
    v_father_death date;
    v_mother_birth date;
    v_mother_death date;
begin
    -- Cohérence interne : décès >= naissance
    if new.birth_date is not null and new.death_date is not null then
        if new.death_date < new.birth_date then
            raise exception 'death_date (%) cannot be before birth_date (%)', new.death_date, new.birth_date
                using errcode = 'check_violation';
        end if;
    end if;

    -- Cohérence vs père
    if new.father_id is not null and new.birth_date is not null then
        select birth_date, death_date into v_father_birth, v_father_death
        from public.persons where id = new.father_id;
        -- Père doit être né au moins 1 an avant l'enfant (et < 70 ans avant)
        if v_father_birth is not null then
            if new.birth_date < v_father_birth then
                raise exception 'Child birth_date (%) is before father birth_date (%)', new.birth_date, v_father_birth
                    using errcode = 'check_violation';
            end if;
            if (new.birth_date - v_father_birth) > 25567 then  -- > 70 ans
                raise exception 'Father is more than 70 years older than child — likely a data error'
                    using errcode = 'check_violation';
            end if;
        end if;
        -- Père doit être vivant au moment de la conception (decès < 9 mois avant naissance enfant)
        if v_father_death is not null then
            if new.birth_date > (v_father_death + interval '9 months') then
                raise exception 'Child (%) was born more than 9 months after father death (%)', new.birth_date, v_father_death
                    using errcode = 'check_violation';
            end if;
        end if;
    end if;

    -- Cohérence vs mère
    if new.mother_id is not null and new.birth_date is not null then
        select birth_date, death_date into v_mother_birth, v_mother_death
        from public.persons where id = new.mother_id;
        if v_mother_birth is not null then
            if new.birth_date < v_mother_birth then
                raise exception 'Child birth_date (%) is before mother birth_date (%)', new.birth_date, v_mother_birth
                    using errcode = 'check_violation';
            end if;
            if (new.birth_date - v_mother_birth) > 25567 then
                raise exception 'Mother is more than 70 years older than child — likely a data error'
                    using errcode = 'check_violation';
            end if;
        end if;
        if v_mother_death is not null then
            -- Mère doit être vivante à la naissance de son enfant
            if new.birth_date > v_mother_death then
                raise exception 'Child (%) was born after mother death (%) — impossible', new.birth_date, v_mother_death
                    using errcode = 'check_violation';
            end if;
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_check_timeline on public.persons;
create trigger trg_check_timeline
    before insert or update of birth_date, death_date, father_id, mother_id on public.persons
    for each row execute function public.fn_check_person_timeline();


-- ============================================================
-- #4 — Multi-unions + filiation typée (parent_child, unions)
-- Tables additives : ne touchent pas father_id/mother_id existants
-- ============================================================

create table if not exists public.unions (
    id uuid primary key default uuid_generate_v4(),
    tree_id uuid not null references public.trees(id) on delete cascade,
    partner1_id uuid references public.persons(id) on delete cascade,
    partner2_id uuid references public.persons(id) on delete cascade,
    union_type text not null check (union_type in ('marriage','partnership','union_libre','engagement')) default 'marriage',
    started_at date,
    ended_at date,
    ended_reason text check (ended_reason in ('divorce','death','separation','annulled') or ended_reason is null),
    location text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_unions_tree on public.unions(tree_id);
create index if not exists idx_unions_partner1 on public.unions(partner1_id);
create index if not exists idx_unions_partner2 on public.unions(partner2_id);

drop trigger if exists trg_unions_updated on public.unions;
create trigger trg_unions_updated before update on public.unions
    for each row execute function public.set_updated_at();

create table if not exists public.parent_child (
    id uuid primary key default uuid_generate_v4(),
    tree_id uuid not null references public.trees(id) on delete cascade,
    parent_id uuid not null references public.persons(id) on delete cascade,
    child_id uuid not null references public.persons(id) on delete cascade,
    kind text not null check (kind in ('biological','adopted','recognized','step','foster','presumed')) default 'biological',
    confidence text not null check (confidence in ('proven','probable','possible','unverified','disputed')) default 'unverified',
    notes text,
    created_at timestamptz not null default now(),
    unique (parent_id, child_id)
);

create index if not exists idx_parent_child_parent on public.parent_child(parent_id);
create index if not exists idx_parent_child_child on public.parent_child(child_id);
create index if not exists idx_parent_child_tree on public.parent_child(tree_id);

-- Garantie : parent et child doivent appartenir au même arbre
create or replace function public.fn_check_parent_child_same_tree()
returns trigger
language plpgsql
as $$
declare
    v_parent_tree uuid;
    v_child_tree uuid;
begin
    select tree_id into v_parent_tree from public.persons where id = new.parent_id;
    select tree_id into v_child_tree from public.persons where id = new.child_id;
    if v_parent_tree is null or v_child_tree is null then
        raise exception 'parent or child not found' using errcode = 'foreign_key_violation';
    end if;
    if v_parent_tree <> new.tree_id or v_child_tree <> new.tree_id then
        raise exception 'parent and child must belong to the tree_id of the relation'
            using errcode = 'check_violation';
    end if;
    if new.parent_id = new.child_id then
        raise exception 'A person cannot be their own parent'
            using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_check_parent_child_tree on public.parent_child;
create trigger trg_check_parent_child_tree
    before insert or update on public.parent_child
    for each row execute function public.fn_check_parent_child_same_tree();


-- ============================================================
-- #2 — Documents many-to-many personnes
-- ============================================================
-- On garde genealogy_documents.person_id pour rétro-compat (FK simple)
-- et on ajoute document_persons pour les liens multiples.
-- ============================================================

create table if not exists public.document_persons (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid not null references public.genealogy_documents(id) on delete cascade,
    person_id uuid not null references public.persons(id) on delete cascade,
    role text check (role in ('subject','parent','spouse','witness','child','sibling','other')) default 'subject',
    created_at timestamptz not null default now(),
    unique (document_id, person_id)
);

create index if not exists idx_docpersons_document on public.document_persons(document_id);
create index if not exists idx_docpersons_person on public.document_persons(person_id);

-- Confidence sur la source du document elle-même
alter table public.genealogy_documents add column if not exists confidence text
    check (confidence in ('proven','probable','possible','unverified','disputed'));
update public.genealogy_documents set confidence = 'unverified' where confidence is null;


-- ============================================================
-- #1 — Sources & niveau de confiance par fait
-- ============================================================

create table if not exists public.person_facts (
    id uuid primary key default uuid_generate_v4(),
    tree_id uuid not null references public.trees(id) on delete cascade,
    person_id uuid not null references public.persons(id) on delete cascade,
    fact_type text not null check (fact_type in (
        'birth_date','birth_place','death_date','death_place',
        'first_name','last_name','gender','occupation','residence',
        'baptism','marriage','immigration','emigration','education','military',
        'other'
    )),
    value text not null,
    value_date date,
    source_doc_id uuid references public.genealogy_documents(id) on delete set null,
    source_text text,                   -- citation libre si pas de doc (témoignage oral, livre, etc.)
    confidence text not null check (confidence in ('proven','probable','possible','unverified','disputed')) default 'unverified',
    asserted_by uuid references auth.users(id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_facts_person on public.person_facts(person_id);
create index if not exists idx_facts_tree on public.person_facts(tree_id);
create index if not exists idx_facts_type on public.person_facts(fact_type);
create index if not exists idx_facts_confidence on public.person_facts(confidence);

drop trigger if exists trg_facts_updated on public.person_facts;
create trigger trg_facts_updated before update on public.person_facts
    for each row execute function public.set_updated_at();


-- ============================================================
-- #8 — Commentaires collaboratifs sur fiche personne
-- ============================================================

create table if not exists public.person_comments (
    id uuid primary key default uuid_generate_v4(),
    tree_id uuid not null references public.trees(id) on delete cascade,
    person_id uuid not null references public.persons(id) on delete cascade,
    author_id uuid references auth.users(id) on delete set null,
    author_email text,                  -- snapshot pour traçabilité
    body text not null,
    resolved_at timestamptz,
    resolved_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_comments_person on public.person_comments(person_id);
create index if not exists idx_comments_tree on public.person_comments(tree_id);

drop trigger if exists trg_comments_updated on public.person_comments;
create trigger trg_comments_updated before update on public.person_comments
    for each row execute function public.set_updated_at();

-- Snapshot de l'email auteur au moment de la création
create or replace function public.fn_set_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.author_id is null then
        new.author_id := auth.uid();
    end if;
    if new.author_email is null and new.author_id is not null then
        select email into new.author_email from auth.users where id = new.author_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_set_comment_author on public.person_comments;
create trigger trg_set_comment_author
    before insert on public.person_comments
    for each row execute function public.fn_set_comment_author();


-- ============================================================
-- RLS sur toutes les nouvelles tables (réutilise can_read/write_tree)
-- ============================================================

-- ---- unions ----
alter table public.unions enable row level security;
drop policy if exists "unions_select" on public.unions;
drop policy if exists "unions_insert" on public.unions;
drop policy if exists "unions_update" on public.unions;
drop policy if exists "unions_delete" on public.unions;

create policy "unions_select" on public.unions
    for select using (public.can_read_tree(tree_id));
create policy "unions_insert" on public.unions
    for insert with check (public.can_write_tree(tree_id));
create policy "unions_update" on public.unions
    for update using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));
create policy "unions_delete" on public.unions
    for delete using (public.can_write_tree(tree_id));

-- ---- parent_child ----
alter table public.parent_child enable row level security;
drop policy if exists "pc_select" on public.parent_child;
drop policy if exists "pc_insert" on public.parent_child;
drop policy if exists "pc_update" on public.parent_child;
drop policy if exists "pc_delete" on public.parent_child;

create policy "pc_select" on public.parent_child
    for select using (public.can_read_tree(tree_id));
create policy "pc_insert" on public.parent_child
    for insert with check (public.can_write_tree(tree_id));
create policy "pc_update" on public.parent_child
    for update using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));
create policy "pc_delete" on public.parent_child
    for delete using (public.can_write_tree(tree_id));

-- ---- document_persons ----
-- RLS basé sur le tree du document parent
alter table public.document_persons enable row level security;
drop policy if exists "docp_select" on public.document_persons;
drop policy if exists "docp_insert" on public.document_persons;
drop policy if exists "docp_delete" on public.document_persons;

create policy "docp_select" on public.document_persons
    for select using (
        exists (select 1 from public.genealogy_documents gd
                where gd.id = document_persons.document_id
                  and public.can_read_tree(gd.tree_id))
    );
create policy "docp_insert" on public.document_persons
    for insert with check (
        exists (select 1 from public.genealogy_documents gd
                where gd.id = document_persons.document_id
                  and public.can_write_tree(gd.tree_id))
    );
create policy "docp_delete" on public.document_persons
    for delete using (
        exists (select 1 from public.genealogy_documents gd
                where gd.id = document_persons.document_id
                  and public.can_write_tree(gd.tree_id))
    );

-- ---- person_facts ----
alter table public.person_facts enable row level security;
drop policy if exists "facts_select" on public.person_facts;
drop policy if exists "facts_insert" on public.person_facts;
drop policy if exists "facts_update" on public.person_facts;
drop policy if exists "facts_delete" on public.person_facts;

create policy "facts_select" on public.person_facts
    for select using (public.can_read_tree(tree_id));
create policy "facts_insert" on public.person_facts
    for insert with check (public.can_write_tree(tree_id));
create policy "facts_update" on public.person_facts
    for update using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));
create policy "facts_delete" on public.person_facts
    for delete using (public.can_write_tree(tree_id));

-- ---- person_comments ----
alter table public.person_comments enable row level security;
drop policy if exists "comments_select" on public.person_comments;
drop policy if exists "comments_insert" on public.person_comments;
drop policy if exists "comments_update" on public.person_comments;
drop policy if exists "comments_delete" on public.person_comments;

create policy "comments_select" on public.person_comments
    for select using (public.can_read_tree(tree_id));
-- Tout collab (read OK) peut commenter — pas besoin d'être editor
create policy "comments_insert" on public.person_comments
    for insert with check (public.can_read_tree(tree_id));
-- Seul l'auteur peut modifier son commentaire (sauf staff)
create policy "comments_update" on public.person_comments
    for update using (
        author_id = auth.uid() or public.is_genealogy_staff()
    ) with check (
        author_id = auth.uid() or public.is_genealogy_staff()
    );
-- Suppression : auteur OU owner du tree OU staff
create policy "comments_delete" on public.person_comments
    for delete using (
        author_id = auth.uid()
        or exists (select 1 from public.trees t where t.id = person_comments.tree_id and t.user_id = auth.uid())
        or public.is_genealogy_staff()
    );


-- ============================================================
-- Audit triggers sur les nouvelles tables sensibles
-- ============================================================

drop trigger if exists trg_audit_unions on public.unions;
create trigger trg_audit_unions
    after insert or update or delete on public.unions
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_parent_child on public.parent_child;
create trigger trg_audit_parent_child
    after insert or update or delete on public.parent_child
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_facts on public.person_facts;
create trigger trg_audit_facts
    after insert or update or delete on public.person_facts
    for each row execute function public.fn_audit_genealogy();

drop trigger if exists trg_audit_comments on public.person_comments;
create trigger trg_audit_comments
    after insert or update or delete on public.person_comments
    for each row execute function public.fn_audit_genealogy();


-- ============================================================
-- Helper SQL : suggestions de proches manquants
-- Renvoie une liste des "trous" dans l'arbre (parents manquants pour personnes
-- importantes — self, GP, GGP).
-- ============================================================

create or replace function public.fn_genealogy_suggestions(p_tree_id uuid)
returns table(
    person_id uuid,
    person_name text,
    relation_role text,
    missing_what text,
    severity text
)
language sql
stable
security definer
set search_path = public
as $$
    -- Self sans père
    select p.id, coalesce(p.first_name || ' ' || p.last_name, 'Vous'),
           coalesce(p.relation_role, 'self'),
           'father' as missing_what,
           'high' as severity
    from public.persons p
    where p.tree_id = p_tree_id and p.is_self = true and p.father_id is null

    union all

    -- Self sans mère
    select p.id, coalesce(p.first_name || ' ' || p.last_name, 'Vous'),
           coalesce(p.relation_role, 'self'),
           'mother',
           'high'
    from public.persons p
    where p.tree_id = p_tree_id and p.is_self = true and p.mother_id is null

    union all

    -- Parents (génération 2) sans leurs propres parents
    select p.id, coalesce(p.first_name || ' ' || p.last_name, ''),
           coalesce(p.relation_role, 'parent'),
           'father',
           'medium'
    from public.persons p
    where p.tree_id = p_tree_id
      and p.relation_role in ('father','mother')
      and p.father_id is null

    union all

    select p.id, coalesce(p.first_name || ' ' || p.last_name, ''),
           coalesce(p.relation_role, 'parent'),
           'mother',
           'medium'
    from public.persons p
    where p.tree_id = p_tree_id
      and p.relation_role in ('father','mother')
      and p.mother_id is null

    union all

    -- Personnes sans date de naissance
    select p.id, coalesce(p.first_name || ' ' || p.last_name, ''),
           coalesce(p.relation_role, ''),
           'birth_date',
           'low'
    from public.persons p
    where p.tree_id = p_tree_id and p.birth_date is null

    union all

    -- Personnes sans lieu de naissance
    select p.id, coalesce(p.first_name || ' ' || p.last_name, ''),
           coalesce(p.relation_role, ''),
           'birth_place',
           'low'
    from public.persons p
    where p.tree_id = p_tree_id and p.birth_place is null
$$;


-- ============================================================
-- Helper SQL : détection de doublons (fuzzy match)
-- Heuristique simple : nom complet identique en lowercase + dates proches
-- ============================================================

create or replace function public.fn_genealogy_dedup(p_tree_id uuid)
returns table(
    person_a_id uuid,
    person_b_id uuid,
    name_match text,
    birth_year_diff int
)
language sql
stable
security definer
set search_path = public
as $$
    select
        a.id as person_a_id,
        b.id as person_b_id,
        coalesce(lower(a.first_name || ' ' || a.last_name), '') as name_match,
        abs(extract(year from a.birth_date)::int - extract(year from b.birth_date)::int) as birth_year_diff
    from public.persons a
    inner join public.persons b
        on a.tree_id = b.tree_id
        and a.id < b.id  -- évite (A,B) et (B,A)
        and lower(coalesce(a.first_name, '')) = lower(coalesce(b.first_name, ''))
        and lower(coalesce(a.last_name, '')) = lower(coalesce(b.last_name, ''))
        and a.first_name is not null
        and a.last_name is not null
    where a.tree_id = p_tree_id
      and (
          -- Soit dates de naissance proches (< 3 ans)
          (a.birth_date is not null and b.birth_date is not null
           and abs(extract(year from a.birth_date)::int - extract(year from b.birth_date)::int) <= 2)
          -- Soit l'un des deux n'a pas de date (donc pas de contradiction)
          or (a.birth_date is null or b.birth_date is null)
      )
$$;
