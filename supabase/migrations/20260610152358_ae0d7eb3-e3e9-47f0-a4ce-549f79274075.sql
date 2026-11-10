ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dragon_xp integer NOT NULL DEFAULT 0;
ALTER TABLE public.book_notes ADD COLUMN IF NOT EXISTS rating smallint;