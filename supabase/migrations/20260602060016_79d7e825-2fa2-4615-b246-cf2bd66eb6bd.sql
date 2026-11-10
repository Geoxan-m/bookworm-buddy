ALTER TABLE public.user_books ADD COLUMN IF NOT EXISTS book_data jsonb;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_user_book_status_unique UNIQUE (user_id, book_id, status);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_book_data jsonb;