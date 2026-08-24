-- ═══════════════════════════════════════════════════════════
-- CODES DE SUPPRESSION DE COMPTE
--
-- Supprimer un compte est irréversible : deux tapotements sur un écran ne
-- suffisent pas à prouver que c'est bien le titulaire qui décide. Un
-- téléphone déverrouillé et laissé sur une table suffirait.
--
-- Le parcours devient donc celui de l'inscription, à l'envers : un code à
-- six chiffres part par e-mail, et c'est sa saisie qui déclenche
-- l'effacement. Preuve que la personne contrôle bien la boîte du compte.
--
-- Le code n'est JAMAIS stocké en clair : seul son empreinte SHA-256 est
-- conservée. Une fuite de cette table ne permettrait donc de supprimer
-- aucun compte.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.account_deletion_codes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    email        TEXT NOT NULL,
    -- SHA-256 du code à six chiffres. Jamais le code lui-même.
    code_hash    TEXT NOT NULL,
    -- Dix minutes : assez pour relever ses mails, trop court pour qu'un
    -- code oublié dans une boîte reste dangereux.
    expires_at   TIMESTAMPTZ NOT NULL,
    -- Trois essais, puis le code meurt : sans ce compteur, six chiffres se
    -- devinent par force brute en quelques minutes.
    attempts     INT NOT NULL DEFAULT 0,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_codes_user
    ON public.account_deletion_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_codes_expiry
    ON public.account_deletion_codes (expires_at);

-- Table de service : aucune lecture par le client, tout passe par l'API
-- avec la clé de service. RLS activée sans politique = personne n'y accède
-- avec la clé anonyme.
ALTER TABLE public.account_deletion_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.account_deletion_codes IS
    'Codes a usage unique pour confirmer la suppression d un compte (mobile). Empreinte seule, jamais le code.';
