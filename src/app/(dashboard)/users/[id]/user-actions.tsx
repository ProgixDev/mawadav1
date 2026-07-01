"use client";

import { useState, useTransition } from "react";
import { updateUserStatus, setUserRole } from "../actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/matching/labels";
import type { UserRole, UserStatus } from "@/lib/types/database";

export function UserStatusActions({
  userId,
  status,
}: {
  userId: string;
  status: UserStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(next: UserStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserStatus(userId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Échec de la mise à jour");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {status !== "suspended" ? (
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => set("suspended")}
          >
            Suspendre
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={pending}
            onClick={() => set("active")}
          >
            Réactiver
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Role management. What's offered depends on the *viewer's* role: only a super
// admin may grant or revoke the super-admin role. The `mahram` role is assigned
// automatically when a guardian links their account, so it's shown (read-only)
// but not offered as a target here.
export function UserRoleActions({
  userId,
  role,
  viewerRole,
}: {
  userId: string;
  role: UserRole;
  viewerRole: UserRole;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = viewerRole === "super_admin";

  function set(next: UserRole) {
    setError(null);
    startTransition(async () => {
      try {
        await setUserRole(userId, next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Échec de la mise à jour");
      }
    });
  }

  if (role === "mahram") {
    return (
      <p className="text-xs text-neutral-500">
        Compte mahram (tuteur) — rôle géré automatiquement.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {role === "user" && (
          <Button variant="default" size="sm" disabled={pending} onClick={() => set("admin")}>
            Promouvoir administrateur
          </Button>
        )}
        {role === "admin" && (
          <Button variant="subtle" size="sm" disabled={pending} onClick={() => set("user")}>
            Retirer le rôle administrateur
          </Button>
        )}
        {isSuperAdmin && role !== "super_admin" && (
          <Button variant="default" size="sm" disabled={pending} onClick={() => set("super_admin")}>
            Promouvoir super administrateur
          </Button>
        )}
        {isSuperAdmin && role === "super_admin" && (
          <Button variant="destructive" size="sm" disabled={pending} onClick={() => set("admin")}>
            Retirer le rôle super administrateur
          </Button>
        )}
      </div>
      {!isSuperAdmin && role === "super_admin" && (
        <p className="text-xs text-neutral-500">
          Rôle {ROLE_LABELS[role]} — modifiable uniquement par un super administrateur.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
