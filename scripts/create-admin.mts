// Usage: npm run admin:create -- you@example.com "Your Name" 'a-strong-password'
import { hashPassword } from "../lib/auth-hash";
import postgres from "postgres";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 10) {
  console.error('Usage: npm run admin:create -- email "Name" password(min 10 chars)');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!);
await sql`
  insert into users (email, name, role, password_hash)
  values (${email.toLowerCase()}, ${name}, 'admin', ${await hashPassword(password)})
  on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin', name = excluded.name`;
console.log(`Admin ready: ${email}`);
await sql.end();
