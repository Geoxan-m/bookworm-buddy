CREATE TABLE public.book_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  isbn_norm text,
  title text NOT NULL,
  title_norm text NOT NULL,
  author text NOT NULL DEFAULT '',
  author_norm text NOT NULL DEFAULT '',
  genre text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  source text NOT NULL,
  source_id text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_validated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_catalog_isbn_idx ON public.book_catalog (isbn_norm);
CREATE INDEX book_catalog_title_idx ON public.book_catalog (title_norm text_pattern_ops);
CREATE INDEX book_catalog_author_idx ON public.book_catalog (author_norm text_pattern_ops);
GRANT SELECT ON public.book_catalog TO anon, authenticated;
GRANT ALL ON public.book_catalog TO service_role;
ALTER TABLE public.book_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read" ON public.book_catalog FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.search_cache (
  query_norm text PRIMARY KEY,
  result_keys text[] NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.search_cache TO service_role;
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER book_catalog_touch BEFORE UPDATE ON public.book_catalog FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();