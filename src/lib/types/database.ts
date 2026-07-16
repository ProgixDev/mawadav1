// TypeScript mirror of the Supabase schema shared with the Flutter mobile app.
// Column names match the Dart models exactly (snake_case).

export type UserRole = "user" | "admin" | "super_admin" | "mahram";
export type UserStatus = "onboarding" | "active" | "suspended" | "deleted";
export type MahramStatus = "pending" | "approved" | "rejected";
export type AdminStatus = "new" | "in_contact" | "paused";
export type MessageModerationStatus = "ok" | "flagged" | "removed";
export type SubscriptionStatus = "active" | "expired" | "trial" | "canceled";
export type ContentType = "article" | "checklist" | "guide" | "istikhara";
export type ReportContext = "message" | "profile";
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";
export type MatchStatus =
  | "pending"
  | "matched"
  | "declined"
  | "expired"
  | "cancelled"
  | "ended"
  | "rejected";
export type MatchResponse = "pending" | "accepted" | "declined";

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  birthdate: string | null;
  city: string | null;
  country: string | null;
  nationality: string | null;
  practice_level: string | null;
  madhhab: string | null;
  prayer_frequency: string | null;
  wears_hijab: boolean | null;
  marital_status: string | null;
  has_children: boolean | null;
  num_children: number | null;
  education_level: string | null;
  profession: string | null;
  languages: string[] | null;
  visibility: string | null;
  height_cm: number | null;
  quran_level: string | null;
  islamic_education_level: string | null;
  smoking_status: string | null;
  wants_children: boolean | null;
  income_range: string | null;
  willing_to_relocate: boolean | null;
  about_me: string | null;
  marriage_goals: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MahramRow {
  id: string;
  female_user_id: string;
  full_name: string;
  relationship: string;
  phone_number: string;
  country: string | null;
  city: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PartnerPreferencesRow {
  id: string;
  user_id: string;
  min_age: number | null;
  max_age: number | null;
  wants_children: boolean | null;
  min_practice_level: string | null;
  willing_to_relocate: boolean | null;
  marriage_timeline: string | null;
  preference_importance?: Record<string, string> | null;
  lifestyle_answers?: Record<string, string> | null;
  lifestyle_importance?: Record<string, string> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  admin_id: string | null;
  admin_status: AdminStatus;
  match_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  moderation_status: MessageModerationStatus;
  created_at: string;
  read_at: string | null;
}

export interface ContentItemRow {
  id: string;
  type: ContentType;
  title: string;
  body_md: string;
  tags: string[] | null;
  published: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireResponseRow {
  id: string;
  user_id: string;
  answers: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  rc_app_user_id: string;
  entitlement: string | null;
  status: SubscriptionStatus;
  renews_at: string | null;
  expires_at: string | null;
  store: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  context: ReportContext;
  reason: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface MatchRow {
  id: string;
  male_user_id: string;
  female_user_id: string;
  created_by: string | null;
  mutual_score: number | null;
  mutual_pass: boolean | null;
  status: MatchStatus;
  male_response: MatchResponse;
  female_response: MatchResponse;
  male_responded_at: string | null;
  female_responded_at: string | null;
  expires_at: string | null;
  mahram_delivered: boolean | null;
  mahram_status: MahramStatus;
  ended_by: "mahram" | "admin" | null;
  end_reason: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface MahramLinkRow {
  id: string;
  mahram_user_id: string;
  female_user_id: string;
  created_at: string | null;
}

// Convenience composite used by the Users detail view.
export interface UserWithProfile extends UserRow {
  profile: ProfileRow | null;
  mahram: MahramRow | null;
  partner_preferences: PartnerPreferencesRow | null;
}
