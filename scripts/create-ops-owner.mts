// First ops account (owner). Ops logins are separate from website admin logins.
// Usage: npm run ops:owner -- you@example.com "Your Name" 'a-strong-password'
//
// Add --sql and it connects to nothing: it prints one INSERT to paste into Supabase's SQL editor.
// That is the way in when your network has no IPv6 route to the database (see docs/ops-go-live.md).
// The password is hashed here, on your machine, so only the hash is ever on screen.
import { hashPassword } from "../lib/auth-hash";

const args = process.argv.slice(2);
const asSql = args.includes("--sql");
const [email, name, password] = args.filter((a) => a !== "--sql");
if (!email || !name || !password || password.length < 10) {
  console.error('Usage: npm run ops:owner -- email "Name" password(min 10 chars) [--sql]');
  process.exit(1);
}
const hash = await hashPassword(password);
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

if (asSql) {
  console.log(`-- Paste into Supabase → SQL Editor → Run. Makes ${email} an owner, or resets that account.
insert into ops_users (email, name, role, password_hash)
values (${q(email.toLowerCase())}, ${q(name)}, 'owner', ${q(hash)})
on conflict (email) do update
  set password_hash = excluded.password_hash, role = 'owner', active = true, name = excluded.name;`);
  process.exit(0);
}

const postgres = (await import("postgres")).default;
const sql = postgres(process.env.DATABASE_URL!);
await sql`
  insert into ops_users (email, name, role, password_hash)
  values (${email.toLowerCase()}, ${name}, 'owner', ${hash})
  on conflict (email) do update set password_hash = excluded.password_hash, role = 'owner', active = true, name = excluded.name`;
console.log(`Ops owner ready (sign in at /ops/login): ${email}`);
await sql.end();
