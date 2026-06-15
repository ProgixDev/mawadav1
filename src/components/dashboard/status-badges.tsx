import { Badge } from "@/components/ui/badge";
import type {
  UserStatus,
  SubscriptionStatus,
  AdminStatus,
  ReportStatus,
  MessageModerationStatus,
  MatchStatus,
  MatchResponse,
} from "@/lib/types/database";

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const map = {
    active: { variant: "green", label: "Active" },
    onboarding: { variant: "blue", label: "Onboarding" },
    suspended: { variant: "amber", label: "Suspended" },
    deleted: { variant: "red", label: "Deleted" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const map = {
    active: { variant: "green", label: "Active" },
    trial: { variant: "blue", label: "Trial" },
    expired: { variant: "default", label: "Expired" },
    canceled: { variant: "red", label: "Canceled" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function AdminStatusBadge({ status }: { status: AdminStatus }) {
  const map = {
    new: { variant: "blue", label: "New" },
    in_contact: { variant: "green", label: "In contact" },
    paused: { variant: "amber", label: "Paused" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const map = {
    open: { variant: "red", label: "Open" },
    reviewing: { variant: "amber", label: "Reviewing" },
    actioned: { variant: "green", label: "Actioned" },
    dismissed: { variant: "default", label: "Dismissed" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map = {
    pending: { variant: "amber", label: "Pending" },
    matched: { variant: "green", label: "Matched" },
    declined: { variant: "red", label: "Declined" },
    expired: { variant: "default", label: "Expired" },
    cancelled: { variant: "default", label: "Cancelled" },
    ended: { variant: "amber", label: "Ended" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function MatchResponseBadge({ response }: { response: MatchResponse }) {
  const map = {
    pending: { variant: "default", label: "Pending" },
    accepted: { variant: "green", label: "Accepted" },
    declined: { variant: "red", label: "Declined" },
  } as const;
  const s = map[response];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function ModerationBadge({ status }: { status: MessageModerationStatus }) {
  const map = {
    ok: { variant: "green", label: "OK" },
    flagged: { variant: "amber", label: "Flagged" },
    removed: { variant: "red", label: "Removed" },
  } as const;
  const s = map[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
