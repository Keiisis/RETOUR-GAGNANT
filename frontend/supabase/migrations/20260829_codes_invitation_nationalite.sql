-- ═══════════════════════════════════════════════════════════════
--  CODES D'INVITATION — DEMANDE DE NATIONALITÉ
--
--  Des clients ne peuvent pas payer en ligne : une carte émise hors zone
--  UEMOA est refusée par la banque émettrice avant même l'authentification.
--  Ils règlent alors autrement — virement, TapTap Send, espèces — ou l'agence
--  décide d'offrir le dossier. Jusqu'ici, la seule issue était de saisir le
--  dossier à leur place, donc de leur retirer le formulaire.
--
--  Un code d'invitation leur rend le formulaire : ils le remplissent
--  eux-mêmes, déposent leurs pièces eux-mêmes, et le code remplace le
--  paiement à l'étape du règlement.
--
--  CE QUE LA TABLE GARANTIT
--
--  · Un code est UNIQUE et à usage unique. La contrainte d'unicité est en
--    base : deux soumissions simultanées ne peuvent pas le consommer deux
--    fois, quoi que fasse le code applicatif.
--  · Sa PORTÉE est explicite : frais de dossier, et/ou frais de recherche
--    ancestrale. Un code qui ne couvre pas l'ancestrale ne la rend pas
--    gratuite.
--  · Tout est tracé : qui l'a créé, pour qui, quand, et quel dossier l'a
--    consommé. Un dossier offert doit pouvoir être expliqué six mois plus
--    tard.
--
--  ⚠️ Aucune écriture comptable n'est attachée à un code : rien n'est
--  encaissé. Facturer un dossier offert inventerait une recette que la
--  banque ne verra jamais.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.nationality_invitation_codes (
    id              uuid primary key default gen_random_uuid(),

    -- Le code tel qu'il est communiqué au client. Toujours en majuscules :
    -- la comparaison se fait sur cette forme, l'utilisateur ne doit pas
    -- échouer pour une minuscule.
    code            text not null unique,

    -- Portée. Au moins l'une des deux doit être vraie (contrainte plus bas).
    couvre_dossier      boolean not null default true,
    couvre_ancestrale   boolean not null default false,

    -- Montants couverts, pour mémoire : ce que l'agence aurait facturé.
    -- Sert au suivi de ce qui a été offert, jamais à une écriture comptable.
    montant_dossier     numeric(12,2),
    montant_ancestrale  numeric(12,2),
    devise              text not null default 'EUR',

    -- actif | utilise | revoque
    statut          text not null default 'actif',

    -- Destinataire prévu. Renseigné, il VERROUILLE le code sur cet email :
    -- un code destiné à quelqu'un ne doit pas servir à un autre.
    email_cible     text,

    note            text,

    expire_le       timestamptz,
    cree_le         timestamptz not null default now(),
    cree_par        uuid,
    cree_par_email  text,

    utilise_le      timestamptz,
    utilise_par_ref text,        -- RG-NAT-YYYY-XXXX du dossier créé
    utilise_par_email text,

    constraint portee_non_vide check (couvre_dossier or couvre_ancestrale),
    constraint statut_connu check (statut in ('actif', 'utilise', 'revoque'))
);

-- Recherche par code : c'est le seul accès en lecture chaude.
create index if not exists idx_invitation_code on public.nationality_invitation_codes (code);
create index if not exists idx_invitation_statut on public.nationality_invitation_codes (statut, cree_le desc);

-- ── Accès ────────────────────────────────────────────────────
-- Aucune lecture publique : un visiteur ne doit pas pouvoir énumérer les
-- codes, ni deviner lesquels sont encore actifs. Les routes serveur passent
-- par la clé de service ; le client ne voit jamais cette table.
alter table public.nationality_invitation_codes enable row level security;

drop policy if exists "codes invitation : personnel uniquement" on public.nationality_invitation_codes;
create policy "codes invitation : personnel uniquement"
    on public.nationality_invitation_codes
    for all
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles p
            where p.id = auth.uid()
              and p.role in ('admin', 'superadmin', 'agent')
        )
    );

comment on table public.nationality_invitation_codes is
    'Codes offrant les frais de dossier de nationalité (et éventuellement la recherche ancestrale) à un client qui ne peut pas payer en ligne. Usage unique, portée explicite, traçabilité complète.';
