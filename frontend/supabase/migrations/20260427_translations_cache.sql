-- ════════════════════════════════════════════════════════════════════════════
-- Translations cache table — server-side persistent translation cache
-- Avoids hitting Groq API for already-translated texts.
-- Used by /api/translate (mobile + web).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.translations (
    id              BIGSERIAL PRIMARY KEY,
    source_text     TEXT NOT NULL,
    source_hash     TEXT NOT NULL,
    lang            TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    context         TEXT DEFAULT 'auto',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One translation per (source, target language)
    CONSTRAINT translations_source_lang_unique UNIQUE (source_hash, lang)
);

-- Lookup index: the hot query is `WHERE lang = $1 AND source_hash IN (...)`
CREATE INDEX IF NOT EXISTS translations_lang_hash_idx
    ON public.translations (lang, source_hash);

-- Auto-update updated_at on UPSERT/UPDATE
CREATE OR REPLACE FUNCTION public.translations_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS translations_updated_at ON public.translations;
CREATE TRIGGER translations_updated_at
    BEFORE UPDATE ON public.translations
    FOR EACH ROW EXECUTE FUNCTION public.translations_set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Translations are public content (UI strings) — readable by everyone.
-- Only the service role (server) can write, never the anon client.
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "translations_public_read" ON public.translations;
CREATE POLICY "translations_public_read"
    ON public.translations
    FOR SELECT
    USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated
-- → only service_role can write (which bypasses RLS by design).

-- ── Optional: clean up old auto-translations after 1 year ─────────────────
-- (uncomment if you want a TTL; safe to leave commented — table stays small)
-- CREATE INDEX IF NOT EXISTS translations_created_at_idx ON public.translations (created_at);
