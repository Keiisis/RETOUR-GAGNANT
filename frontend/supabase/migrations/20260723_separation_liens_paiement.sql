-- ══════════════════════════════════════════════════════════════
--  SÉPARATION LIENS DE PAIEMENT / PROPOSITIONS (SLIDES)
--
--  Les deux cohabitent dans ai_client_proposals. Déplacer les données
--  serait risqué (URL secrètes déjà diffusées aux clients, factures
--  liées, webhooks en vol). On sépare donc LOGIQUEMENT par des vues :
--  même stockage, deux domaines distincts et explicites.
--
--  Bénéfice : tout code futur interroge la bonne vue et ne peut plus
--  confondre un lien de paiement avec une présentation commerciale —
--  la cause des « faux slides impossibles à ouvrir ».
-- ══════════════════════════════════════════════════════════════

-- Marqueur unique : les liens de paiement commencent par LIEN-PAIEMENT
create or replace view public.payment_links as
select *
  from public.ai_client_proposals
 where notes like 'LIEN-PAIEMENT%';

comment on view public.payment_links is
    'Liens de paiement uniquement. Ne JAMAIS afficher dans admin/proposals ni dans le visualiseur de slides.';

create or replace view public.slide_proposals as
select *
  from public.ai_client_proposals
 where notes is null
    or notes not like 'LIEN-PAIEMENT%';

comment on view public.slide_proposals is
    'Propositions commerciales (slides) uniquement — exclut les liens de paiement.';

-- Contrôle : la somme des deux vues doit égaler la table
select
    (select count(*) from public.ai_client_proposals) as total,
    (select count(*) from public.payment_links)       as liens_paiement,
    (select count(*) from public.slide_proposals)     as propositions;
