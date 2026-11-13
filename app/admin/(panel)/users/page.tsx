import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { BIZ_LABEL, BUSINESSES, ROLE_LABEL, type OpsUser } from "@/lib/ops-rules";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { Field, PageHeader, Section, Table, btnGhost, input } from "@/components/admin/ui";
import { createUser, deleteUser, updateUserAccess } from "../admin-actions";

/** Role select + ops business checkboxes; shared by the add form and each row. */
function AccessFields({ role = "editor", businesses = [] }: { role?: OpsUser["role"]; businesses?: string[] }) {
  return (
    <>
      <select name="role" defaultValue={role} className={input} aria-label="Role">
        {(Object.keys(ROLE_LABEL) as OpsUser["role"][]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <span className="flex flex-wrap gap-3 text-xs text-gray-700">
        {BUSINESSES.map((b) => (
          <label key={b} className="inline-flex items-center gap-1">
            <input type="checkbox" name={`ops_${b}`} defaultChecked={businesses.includes(b)} /> {BIZ_LABEL[b]}
          </label>
        ))}
      </span>
    </>
  );
}

export default async function UsersPage() {
  const me = await requireUser("admin");
  const rows = await db.select({ id: t.users.id, name: t.users.name, email: t.users.email, role: t.users.role, opsBusinesses: t.users.opsBusinesses })
    .from(t.users).orderBy(asc(t.users.createdAt));
  return (
    <>
      <PageHeader title="Team" />
      <p className="mb-4 text-sm text-gray-500">
        <b>Editors</b> manage trips, blog, pages, media and leads. <b>Admins</b> can also change site settings and users, and see both ops dashboards.
        <b> Ops managers</b> and <b>ops staff</b> only get the ops dashboard (<code>/ops</code>) for the businesses ticked. Staff add expenses; managers approve them.
      </p>
      <Table head={["Name", "Email", "Access", ""]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-gray-500"> (you)</span>}</td>
            <td>{u.email}</td>
            <td>
              {u.id === me.id ? <span>{ROLE_LABEL[u.role]}</span> : (
                <form action={updateUserAccess.bind(null, u.id)} className="flex flex-wrap items-center gap-2">
                  <AccessFields role={u.role} businesses={u.opsBusinesses} />
                  <button className={btnGhost}>Save</button>
                </form>
              )}
            </td>
            <td className="text-right">{u.id !== me.id && <form action={deleteUser.bind(null, u.id)}><ConfirmButton message={`Remove ${u.email}?`}>Remove</ConfirmButton></form>}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-8">
        <SaveForm action={createUser} submitLabel="Add user" inline>
          <Section title="Add a user">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input name="name" required className={input} /></Field>
              <Field label="Email"><input name="email" type="email" required className={input} /></Field>
              <Field label="Temporary password" hint="Min 10 characters. Ask them to change it."><input name="password" type="text" minLength={10} required autoComplete="off" className={input} /></Field>
              <Field label="Role" hint="Ops roles: tick the business(es) they work for."><div className="space-y-2"><AccessFields /></div></Field>
            </div>
          </Section>
        </SaveForm>
      </div>
    </>
  );
}
