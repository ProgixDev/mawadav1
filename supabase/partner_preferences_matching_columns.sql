-- Matching engine — unlock the dormant compatibility criteria.
--
-- The compatibility scorer (web: src/lib/matching, mobile:
-- lib/domain/services/matching) implements all 17 documented criteria, but
-- partner_preferences currently stores only 6 fields. Until the columns below
-- exist the adapters fall back to permissive defaults ("no preference"), so
-- these criteria sit dormant:
--   #3 marital-status whitelist, #4 accepts partner children, #6 education min,
--   #7 smoking whitelist, #8 madhab whitelist, #9 language preferences,
--   and the same-country hard gate of #10.
--
-- Adding the columns activates those criteria with no application code change.
-- Idempotent: safe to run more than once.

alter table public.partner_preferences
  add column if not exists accepted_marital_statuses text[]   not null default '{}',
  add column if not exists accepts_partner_children  boolean  not null default true,
  add column if not exists min_education_level        text,
  add column if not exists accepted_smoking_statuses  text[]   not null default '{}',
  add column if not exists accepted_madhabs           text[]   not null default '{}',
  add column if not exists preferred_languages        text[]   not null default '{}',
  add column if not exists same_country_only          boolean  not null default false;

-- Documentation for future maintainers (and to mirror the enum values used by
-- the scoring engine; values are validated in the app layer, not the DB).
comment on column public.partner_preferences.accepted_marital_statuses is
  'Whitelist of accepted marital statuses (never_married|divorced|widowed). Empty = accept all.';
comment on column public.partner_preferences.accepts_partner_children is
  'False hard-rejects candidates who already have children.';
comment on column public.partner_preferences.min_education_level is
  'Minimum education (no_formal|secondary|vocational|bachelors|masters|phd). Null = no minimum.';
comment on column public.partner_preferences.accepted_smoking_statuses is
  'Whitelist of accepted smoking statuses (never|occasionally|regularly|quit). Empty = accept all.';
comment on column public.partner_preferences.accepted_madhabs is
  'Preferred madhabs (hanafi|maliki|shafii|hanbali|none). Empty = no preference.';
comment on column public.partner_preferences.preferred_languages is
  'Preferred spoken languages. Empty = no preference.';
comment on column public.partner_preferences.same_country_only is
  'True hard-rejects candidates in a different country.';

-- Note: profile.wants_children and partner_preferences.{wants_children,
-- willing_to_relocate} are stored as text enums by the mobile app even though an
-- older generated TypeScript type labelled them boolean. The matching adapters
-- coerce both shapes; no column change is required here.
