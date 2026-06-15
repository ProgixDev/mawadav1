// One-off: create a test admin for the dashboard.
// Usage: node scripts/create-test-admin.mjs <email> <password>
// Uses raw fetch against the Supabase Auth + PostgREST APIs (no supabase-js,
// so it works on Node 20 which lacks the WebSocket the realtime client needs).
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
const password = process.argv[3];

if (!url || !key) throw new Error("Missing Supabase URL or service-role key in .env.local");
if (!email || !password) throw new Error("Usage: node scripts/create-test-admin.mjs <email> <password>");

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// 1) Create the auth user (email pre-confirmed). If it exists, find + reset password.
let authUserId;
let res = await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, password, email_confirm: true }),
});
let body = await res.json();

if (res.ok && body.id) {
  authUserId = body.id;
  console.log("Auth user created. id:", authUserId);
} else {
  // Already exists — locate via list, then update the password.
  const list = await (
    await fetch(`${url}/auth/v1/admin/users?per_page=1000`, { headers })
  ).json();
  const existing = (list.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`Could not create or find user: ${JSON.stringify(body)}`);
  authUserId = existing.id;
  await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  console.log("Auth user already existed — password reset. id:", authUserId);
}

// 2) Upsert the public.users row as an active admin.
res = await fetch(`${url}/rest/v1/users?on_conflict=id`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify({ id: authUserId, email, role: "admin", status: "active" }),
});
if (!res.ok) throw new Error(`Failed to upsert public.users row: ${res.status} ${await res.text()}`);

console.log("\n✅ Test admin ready");
console.log("   email:   ", email);
console.log("   password:", password);
