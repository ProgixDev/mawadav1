"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserStatusBadge } from "@/components/dashboard/status-badges";
import { fullName, formatDate, age, initials } from "@/lib/format";
import { ROLE_LABELS, PRAYER_LABELS } from "@/lib/matching/labels";
import { cn } from "@/lib/utils";
import type { UserWithProfile } from "@/lib/types/database";

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

/**
 * Clickable member name in the conversation header. Clicking it slides out a
 * read-only profile drawer over the chat so the admin can reference the
 * member's details without leaving the conversation. A "Voir la fiche complète"
 * link still deep-links to the full /users/[id] page.
 */
export function ProfilePanel({ user }: { user: UserWithProfile }) {
  const [open, setOpen] = useState(false);
  const p = user.profile;
  const prefs = user.partner_preferences;
  const mahram = user.mahram;
  const name = fullName(p?.first_name, p?.last_name) || user.email;

  // Close on Escape and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left font-semibold text-neutral-900 hover:text-brand hover:underline"
        title="Voir le profil"
      >
        {name}
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-neutral-900/30 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-label={`Profil de ${name}`}
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {initials(p?.first_name, p?.last_name, user.email)}
            </span>
            <div>
              <p className="font-semibold text-neutral-900">{name}</p>
              <div className="mt-0.5">
                <UserStatusBadge status={user.status} />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {/* Identity */}
          <dl className="divide-y divide-neutral-100">
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

          {/* Profile */}
          {p && (
            <>
              <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Profil
              </h3>
              <dl className="grid grid-cols-2 gap-x-6 divide-neutral-100">
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
                <Field label="Prêt à déménager" value={yesNo(p.willing_to_relocate)} />
                <Field label="Tranche de revenus" value={p.income_range} />
              </dl>
              {p.about_me && <Field label="À propos" value={p.about_me} />}
              {p.marriage_goals && (
                <Field label="Objectifs de mariage" value={p.marriage_goals} />
              )}

              {/* Religious profile */}
              <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Profil religieux
              </h3>
              <dl className="grid grid-cols-2 gap-x-6">
                <Field label="Niveau de pratique" value={p.practice_level} />
                <Field
                  label="Prière"
                  value={
                    p.prayer_frequency
                      ? PRAYER_LABELS[p.prayer_frequency] ?? p.prayer_frequency
                      : "—"
                  }
                />
                {p.gender === "female" && (
                  <Field label="Porte le hijab" value={yesNo(p.wears_hijab)} />
                )}
                <Field label="Madhhab" value={p.madhhab} />
                <Field label="Niveau de Coran" value={p.quran_level} />
                <Field label="Éducation islamique" value={p.islamic_education_level} />
              </dl>
            </>
          )}

          {/* Partner preferences */}
          {prefs && (
            <>
              <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Préférences de partenaire
              </h3>
              <dl className="grid grid-cols-2 gap-x-6">
                <Field
                  label="Tranche d'âge"
                  value={`${prefs.min_age ?? "?"} – ${prefs.max_age ?? "?"}`}
                />
                <Field label="Souhaite des enfants" value={yesNo(prefs.wants_children)} />
                <Field label="Pratique minimale" value={prefs.min_practice_level} />
                <Field label="Prêt à déménager" value={yesNo(prefs.willing_to_relocate)} />
                <Field label="Échéance de mariage" value={prefs.marriage_timeline} />
              </dl>
            </>
          )}

          {/* Mahram */}
          {mahram && (
            <>
              <h3 className="mt-4 mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Mahram (tuteur)
                <Badge variant="default">tuteur</Badge>
              </h3>
              <dl className="grid grid-cols-2 gap-x-6">
                <Field label="Nom complet" value={mahram.full_name} />
                <Field label="Lien de parenté" value={mahram.relationship} />
                <Field label="Téléphone" value={mahram.phone_number} />
                <Field
                  label="Localisation"
                  value={[mahram.city, mahram.country].filter(Boolean).join(", ")}
                />
              </dl>
            </>
          )}
        </div>

        <div className="border-t border-neutral-200 p-4">
          <Link
            href={`/users/${user.id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <ExternalLink className="h-4 w-4" /> Voir la fiche complète
          </Link>
        </div>
      </aside>
    </>
  );
}
