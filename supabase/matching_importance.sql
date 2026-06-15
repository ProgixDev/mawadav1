-- =============================================================================
-- MAWADA — Preference importance levels + lifestyle/personality questions.
-- Run ONCE in the Supabase SQL editor (after matching_requests.sql). Idempotent.
--
-- Adds three JSONB maps to partner_preferences:
--   preference_importance : criterionKey -> 'must_have'|'important'|'preferred'|'doesnt_matter'
--                           weights / hard-gates each profile preference.
--   lifestyle_answers     : questionKey  -> the user's own answer (a string code)
--   lifestyle_importance  : questionKey  -> importance level (same 4 values)
--
-- The matching engine reads these to weight each dimension. Empty / missing keys
-- fall back to the engine's default behaviour, so existing rows keep working.
-- =============================================================================

alter table public.partner_preferences
  add column if not exists preference_importance jsonb not null default '{}'::jsonb,
  add column if not exists lifestyle_answers     jsonb not null default '{}'::jsonb,
  add column if not exists lifestyle_importance  jsonb not null default '{}'::jsonb;

comment on column public.partner_preferences.preference_importance is
  'Map of criterion key -> importance (must_have|important|preferred|doesnt_matter). '
  'must_have = hard reject if unmet; important = full score weight; '
  'preferred = bonus only; doesnt_matter = ignored. Missing keys = engine default.';
comment on column public.partner_preferences.lifestyle_answers is
  'Map of lifestyle question key -> the user''s own answer code.';
comment on column public.partner_preferences.lifestyle_importance is
  'Map of lifestyle question key -> importance level (same 4 values as preference_importance).';
