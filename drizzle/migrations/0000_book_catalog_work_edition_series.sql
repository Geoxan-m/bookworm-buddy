ALTER TABLE public.book_catalog
  ADD COLUMN IF NOT EXISTS work_key text,
  ADD COLUMN IF NOT EXISTS edition_key text,
  ADD COLUMN IF NOT EXISTS series_title text,
  ADD COLUMN IF NOT EXISTS series_title_norm text,
  ADD COLUMN IF NOT EXISTS series_number numeric,
  ADD COLUMN IF NOT EXISTS publisher text,
  ADD COLUMN IF NOT EXISTS published_year integer,
  ADD COLUMN IF NOT EXISTS language_code text;

ALTER TABLE public.book_catalog
  ADD CONSTRAINT book_catalog_published_year_range
  CHECK (published_year IS NULL OR (published_year BETWEEN 1000 AND 2200));

ALTER TABLE public.book_catalog
  ADD CONSTRAINT book_catalog_series_number_positive
  CHECK (series_number IS NULL OR (series_number > 0 AND series_number < 10000));

CREATE INDEX IF NOT EXISTS book_catalog_work_key_idx
  ON public.book_catalog (work_key) WHERE work_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS book_catalog_series_norm_idx
  ON public.book_catalog (series_title_norm, series_number) WHERE series_title_norm IS NOT NULL;