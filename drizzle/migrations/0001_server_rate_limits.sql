CREATE TABLE public.rate_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.rate_limits IS 'Server-only fixed-window counters for external fetch / catalogue write guards. No browser access.';

CREATE OR REPLACE FUNCTION public.rate_limit_hit(_bucket text, _max integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _hits integer;
BEGIN
  INSERT INTO public.rate_limits AS r (bucket, window_start, hits)
  VALUES (_bucket, now(), 1)
  ON CONFLICT (bucket) DO UPDATE SET
    hits = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE r.window_start END
  RETURNING hits INTO _hits;
  RETURN _hits <= _max;
END; $$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;