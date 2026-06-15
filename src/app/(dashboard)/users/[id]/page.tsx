import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { getUserDetail } from "@/lib/data/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserStatusBadge } from "@/components/dashboard/status-badges";
import { UserStatusActions } from "./user-actions";
import { fullName, formatDate, age, initials } from "@/lib/format";
import {
  DIMENSION_LABELS,
  IMPORTANCE_LABELS,
  LIFESTYLE_LABELS,
  LIFESTYLE_ANSWER_LABELS,
} from "@/lib/matching/labels";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <dt className="text-xs uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-800">{value || "—"}</dd>
    </div>
  );
}

function yesNo(v: boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v ? "Yes" : "No";
}

function importanceVariant(v: string): "red" | "amber" | "default" {
  if (v === "must_have") return "red";
  if (v === "important") return "amber";
  return "default";
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  const p = user.profile;
  const prefs = user.partner_preferences;
  const mahram = user.mahram;

  const preferenceImportance = prefs?.preference_importance ?? {};
  const lifestyleAnswers = prefs?.lifestyle_answers ?? {};
  const lifestyleImportance = prefs?.lifestyle_importance ?? {};
  const importanceEntries = Object.entries(preferenceImportance);
  const lifestyleEntries = Object.entries(lifestyleAnswers);

  // Find this user's conversation (if any) to deep-link the admin chat.
  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", id)
    .maybeSingle<{ id: string }>();

  return (
    <div>
      <Link
        href="/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader title={fullName(p?.first_name, p?.last_name)}>
        <UserStatusActions userId={user.id} status={user.status} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Identity card */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand">
                {initials(p?.first_name, p?.last_name, user.email)}
              </span>
              <div>
                <p className="font-semibold text-neutral-900">
                  {fullName(p?.first_name, p?.last_name)}
                </p>
                <div className="mt-1">
                  <UserStatusBadge status={user.status} />
                </div>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-neutral-100">
              <Field label="Email" value={user.email} />
              <Field label="Phone" value={user.phone} />
              <Field label="Role" value={<span className="capitalize">{user.role}</span>} />
              <Field
                label="Age"
                value={age(p?.birthdate) ? `${age(p?.birthdate)} yrs` : "—"}
              />
              <Field label="Gender" value={<span className="capitalize">{p?.gender}</span>} />
              <Field
                label="Location"
                value={[p?.city, p?.country].filter(Boolean).join(", ")}
              />
              <Field label="Joined" value={formatDate(user.created_at)} />
            </dl>
            {conv && (
              <Link
                href={`/conversations/${conv.id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                <MessagesSquare className="h-4 w-4" /> Open conversation
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Profile details */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {p ? (
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Nationality" value={p.nationality} />
                  <Field label="Marital status" value={p.marital_status} />
                  <Field label="Has children" value={yesNo(p.has_children)} />
                  <Field label="Number of children" value={p.num_children ?? "—"} />
                  <Field label="Education" value={p.education_level} />
                  <Field label="Profession" value={p.profession} />
                  <Field label="Height" value={p.height_cm ? `${p.height_cm} cm` : "—"} />
                  <Field label="Languages" value={p.languages?.join(", ")} />
                  <Field label="Smoking" value={p.smoking_status} />
                  <Field label="Wants children" value={yesNo(p.wants_children)} />
                  <Field label="Income range" value={p.income_range} />
                  <Field label="Willing to relocate" value={yesNo(p.willing_to_relocate)} />
                  <Field label="Visibility" value={p.visibility} />
                  <div className="sm:col-span-2">
                    <Field label="About" value={p.about_me} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Marriage goals" value={p.marriage_goals} />
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-neutral-400">No profile yet (still onboarding).</p>
              )}
            </CardContent>
          </Card>

          {/* Islamic profile */}
          {p && (
            <Card>
              <CardHeader>
                <CardTitle>Religious profile</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Practice level" value={p.practice_level} />
                  <Field label="Madhhab" value={p.madhhab} />
                  <Field label="Qur'an level" value={p.quran_level} />
                  <Field label="Islamic education" value={p.islamic_education_level} />
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Partner preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Partner preferences</CardTitle>
            </CardHeader>
            <CardContent>
              {prefs ? (
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field
                    label="Age range"
                    value={`${prefs.min_age ?? "?"} – ${prefs.max_age ?? "?"}`}
                  />
                  <Field label="Wants children" value={yesNo(prefs.wants_children)} />
                  <Field label="Min practice level" value={prefs.min_practice_level} />
                  <Field label="Willing to relocate" value={yesNo(prefs.willing_to_relocate)} />
                  <Field label="Marriage timeline" value={prefs.marriage_timeline} />
                </dl>
              ) : (
                <p className="text-sm text-neutral-400">No preferences set.</p>
              )}
            </CardContent>
          </Card>

          {/* Preference importance */}
          {importanceEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Preference importance</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-neutral-100">
                  {importanceEntries.map(([k, v]) => (
                    <li
                      key={k}
                      className="flex items-center justify-between gap-4 py-2"
                    >
                      <span className="text-sm text-neutral-800">
                        {DIMENSION_LABELS[k] ?? k}
                      </span>
                      <Badge variant={importanceVariant(v)}>
                        {IMPORTANCE_LABELS[v] ?? v}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Lifestyle & personality */}
          {lifestyleEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lifestyle &amp; personality</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-neutral-100">
                  {lifestyleEntries.map(([k, answer]) => {
                    const imp = lifestyleImportance[k];
                    return (
                      <li
                        key={k}
                        className="flex items-center justify-between gap-4 py-2"
                      >
                        <span className="text-sm text-neutral-800">
                          <span className="text-neutral-500">
                            {LIFESTYLE_LABELS[k] ?? k}:
                          </span>{" "}
                          {LIFESTYLE_ANSWER_LABELS[k]?.[answer] ?? answer}
                        </span>
                        {imp && (
                          <Badge variant={importanceVariant(imp)}>
                            {IMPORTANCE_LABELS[imp] ?? imp}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Mahram (guardian) */}
          {mahram && (
            <Card>
              <CardHeader>
                <CardTitle>Mahram (guardian)</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Full name" value={mahram.full_name} />
                  <Field label="Relationship" value={mahram.relationship} />
                  <Field label="Phone" value={mahram.phone_number} />
                  <Field
                    label="Location"
                    value={[mahram.city, mahram.country].filter(Boolean).join(", ")}
                  />
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
