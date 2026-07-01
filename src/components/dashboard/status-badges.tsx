import { Badge } from "@/components/ui/badge";
import type {
  UserStatus,
  SubscriptionStatus,
  AdminStatus,
  ReportStatus,
  MessageModerationStatus,
  MatchStatus,
  MatchResponse,
  MahramStatus,
} from "@/lib/types/database";

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const map = {
    active: { variant: "green", label: "Actif" },
    onboarding: { variant: "blue", label: "Intégration" },
    suspended: { variant: "amber", label: "Suspendu" },
    deleted: { variant: "red", label: "Supprimé" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const map = {
    active: { variant: "green", label: "Actif" },
    trial: { variant: "blue", label: "Essai" },
    expired: { variant: "default", label: "Expiré" },
    canceled: { variant: "red", label: "Annulé" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function AdminStatusBadge({ status }: { status: AdminStatus }) {
  const map = {
    new: { variant: "blue", label: "Nouveau" },
    in_contact: { variant: "green", label: "En contact" },
    paused: { variant: "amber", label: "En pause" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const map = {
    open: { variant: "red", label: "Ouvert" },
    reviewing: { variant: "amber", label: "En examen" },
    actioned: { variant: "green", label: "Traité" },
    dismissed: { variant: "default", label: "Rejeté" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map = {
    pending: { variant: "amber", label: "En attente" },
    matched: { variant: "green", label: "Mis en relation" },
    declined: { variant: "red", label: "Refusé" },
    expired: { variant: "default", label: "Expiré" },
    cancelled: { variant: "default", label: "Annulé" },
    ended: { variant: "amber", label: "Terminé" },
    rejected: { variant: "red", label: "Rejeté (mahram)" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function MahramStatusBadge({ status }: { status: MahramStatus }) {
  const map = {
    pending: { variant: "amber", label: "En attente du mahram" },
    approved: { variant: "green", label: "Approuvé par le mahram" },
    rejected: { variant: "red", label: "Rejeté par le mahram" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function MatchResponseBadge({ response }: { response: MatchResponse }) {
  const map = {
    pending: { variant: "default", label: "En attente" },
    accepted: { variant: "green", label: "Accepté" },
    declined: { variant: "red", label: "Refusé" },
  } as const;
  const s = map[response];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ModerationBadge({ status }: { status: MessageModerationStatus }) {
  const map = {
    ok: { variant: "green", label: "OK" },
    flagged: { variant: "amber", label: "Signalé" },
    removed: { variant: "red", label: "Supprimé" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
