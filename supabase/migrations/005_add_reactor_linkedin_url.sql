-- Add reactor LinkedIn URL column to linkedin_signals
-- For reacted posts, we track both the author and reactor profiles separately
ALTER TABLE public.linkedin_signals
  ADD COLUMN IF NOT EXISTS reactor_linkedin_url TEXT;
