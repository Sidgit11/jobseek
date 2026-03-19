-- Link Chrome extension device token to user profile
-- Allows logged-in users to access their signals without ?token= in URL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_token TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_device_token ON public.profiles(device_token);
