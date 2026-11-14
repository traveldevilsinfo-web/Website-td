// First ops account (owner). Ops logins are separate from website admin logins.
// Usage: npm run ops:owner -- you@example.com "Your Name" 'a-strong-password'
import { hashPassword } from "../lib/auth-hash";
import postgres from "postgres";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 10) {
  console.error('Usage: npm run ops:owner -- email "Name" password(min 10 chars)');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!);
await sql`
  insert into ops_users (email, name, role, password_hash)
  values (${email.toLowerCase()}, ${name}, 'owner', ${await hashPassword(password)})
  on conflict (email) do update set password_hash = excluded.password_hash, role = 'owner', active = true, name = excluded.name`;
console.log(`Ops owner ready (sign in at /ops/login): ${email}`);
await sql.end();
