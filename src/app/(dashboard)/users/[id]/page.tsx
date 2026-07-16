import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { getUserDetail } from "@/lib/data/users";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserStatusBadge } from "@/components/dashboard/status-badges";
import { UserStatusActions, UserRoleActions } from "./user-actions";
import { fullName, formatDate, age, initials } from "@/lib/format";
import {
  DIMENSION_LABELS,
  IMPORTANCE_LABELS,
  LIFESTYLE_LABELS,
  LIFESTYLE_ANSWER_LABELS,
  ROLE_LABELS,
  PRAYER_LABELS,
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
  return v ? "Oui" : "Non";
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
  const viewer = await requireAdmin();
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
        <ArrowLeft className="h-4 w-4" /> Retour aux membres
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
              <Field label="Courriel" value={user.email} />
              <Field label="Téléphone" value={user.phone} />
              <Field label="Rôle" value={ROLE_LABELS[user.role] ?? user.role} />
              <Field
                label="Âge"
                value={age(p?.birthdate) ? `${age(p?.birthdate)} ans` : "—"}
              />
              <Field label="Genre" value={<span className="capitalize">{p?.gender}</span>} />
              <Field
                label="Localisation"
                value={[p?.city, p?.country].filter(Boolean).join(", ")}
              />
              <Field label="Inscription" value={formatDate(user.created_at)} />
            </dl>
            {conv && (
              <Link
                href={`/conversations/${conv.id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
              >
                <MessagesSquare className="h-4 w-4" /> Ouvrir la conversation
              </Link>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Role management */}
          <Card>
            <CardHeader>
              <CardTitle>Rôle &amp; permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-neutral-600">
                  Rôle actuel : <span className="font-medium text-neutral-900">{ROLE_LABELS[user.role] ?? user.role}</span>
                </p>
                <UserRoleActions userId={user.id} role={user.role} viewerRole={viewer.role} />
              </div>
            </CardContent>
          </Card>

          {/* Profile details */}
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent>
              {p ? (
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Nationalité" value={p.nationality} />
                  <Field label="Situation matrimoniale" value={p.marital_status} />
                  <Field label="A des enfants" value={yesNo(p.has_children)} />
                  <Field label="Nombre d'enfants" value={p.num_children ?? "—"} />
                  <Field label="Niveau d'études" value={p.education_level} />
                  <Field label="Profession" value={p.profession} />
                  <Field label="Taille" value={p.height_cm ? `${p.height_cm} cm` : "—"} />
                  <Field label="Langues" value={p.languages?.join(", ")} />
                  <Field label="Tabagisme" value={p.smoking_status} />
                  <Field label="Souhaite des enfants" value={yesNo(p.wants_children)} />
                  <Field label="Tranche de revenus" value={p.income_range} />
                  <Field label="Prêt à déménager" value={yesNo(p.willing_to_relocate)} />
                  <Field label="Visibilité" value={p.visibility} />
                  <div className="sm:col-span-2">
                    <Field label="À propos" value={p.about_me} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Objectifs de mariage" value={p.marriage_goals} />
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-neutral-400">Aucun profil pour le moment (intégration en cours).</p>
              )}
            </CardContent>
          </Card>

          {/* Islamic profile */}
          {p && (
            <Card>
              <CardHeader>
                <CardTitle>Profil religieux</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Niveau de pratique" value={p.practice_level} />
                  <Field
                    label="Prière"
                    value={p.prayer_frequency ? PRAYER_LABELS[p.prayer_frequency] ?? p.prayer_frequency : "—"}
                  />
                  {p.gender === "female" && (
                    <Field label="Porte le hijab" value={yesNo(p.wears_hijab)} />
                  )}
                  <Field label="Madhhab" value={p.madhhab} />
                  <Field label="Niveau de Coran" value={p.quran_level} />
                  <Field label="Éducation islamique" value={p.islamic_education_level} />
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Partner preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Préférences de partenaire</CardTitle>
            </CardHeader>
            <CardContent>
              {prefs ? (
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field
                    label="Tranche d'âge"
                    value={`${prefs.min_age ?? "?"} – ${prefs.max_age ?? "?"}`}
                  />
                  <Field label="Souhaite des enfants" value={yesNo(prefs.wants_children)} />
                  <Field label="Niveau de pratique minimal" value={prefs.min_practice_level} />
                  <Field label="Prêt à déménager" value={yesNo(prefs.willing_to_relocate)} />
                  <Field label="Échéance de mariage" value={prefs.marriage_timeline} />
                </dl>
              ) : (
                <p className="text-sm text-neutral-400">Aucune préférence définie.</p>
              )}
            </CardContent>
          </Card>

          {/* Preference importance */}
          {importanceEntries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Importance des préférences</CardTitle>
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
                <CardTitle>Mode de vie &amp; personnalité</CardTitle>
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
                <CardTitle>Mahram (tuteur)</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <Field label="Nom complet" value={mahram.full_name} />
                  <Field label="Lien de parenté" value={mahram.relationship} />
                  <Field label="Téléphone" value={mahram.phone_number} />
                  <Field label="Email" value={mahram.email} />
                  <Field
                    label="Localisation"
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
