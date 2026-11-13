import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, t } from "@/lib/db";
import { ConfirmButton, SaveForm } from "@/components/admin/SaveForm";
import { Field, PageHeader, Section, Table, input } from "@/components/admin/ui";
import { createUser, deleteUser } from "../admin-actions";

export default async function UsersPage() {
  const me = await requireUser("admin");
  const rows = await db.select({ id: t.users.id, name: t.users.name, email: t.users.email, role: t.users.role, createdAt: t.users.createdAt }).from(t.users).orderBy(asc(t.users.createdAt));
  return (
    <>
      <PageHeader title="Team" />
      <p className="mb-4 text-sm text-gray-500"><b>Editors</b> manage trips, blog, pages, media and leads. <b>Admins</b> can also change site settings and users.</p>
      <Table head={["Name", "Email", "Role", ""]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="font-medium">{u.name}{u.id === me.id && <span className="text-xs text-gray-500"> (you)</span>}</td>
            <td>{u.email}</td>
            <td className="capitalize">{u.role}</td>
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
              <Field label="Role">
                <select name="role" className={input}><option value="editor">Editor</option><option value="admin">Admin</option></select>
              </Field>
            </div>
          </Section>
        </SaveForm>
      </div>
    </>
  );
}
