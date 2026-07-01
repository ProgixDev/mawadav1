export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleString("fr-CA", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "à l’instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `il y a ${day} j`;
  return formatDate(value);
}

export function age(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

export function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const n = [first, last].filter(Boolean).join(" ").trim();
  return n || "Sans nom";
}

export function initials(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback: string,
): string {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  const combined = (a + b).toUpperCase();
  return combined || fallback[0]?.toUpperCase() || "?";
}
