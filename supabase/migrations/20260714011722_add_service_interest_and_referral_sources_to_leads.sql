ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS service_interest text,
  ADD COLUMN IF NOT EXISTS referral_sources text[];
