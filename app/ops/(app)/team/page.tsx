import { asc } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireOps } from "@/lib/ops";
import { BIZ_LABEL, BUSINESSES, ROLE_HINT, ROLE_LABEL, type OpsRole } from "@/lib/ops-rules";
import { Badge, Field, PageHeader, Panel, input } from "../../kit";
import { OpsForm } from "../../OpsForm";
import { addMember, updateMember } from "./actions";

function Access({ role = "staff", businesses = [] }: { role?: OpsRole; businesses?: string[] }) {
  return (
    <>
      <Field label="Role">
        <select name="role" defaultValue={role} className={input}>
          {(Object.keys(ROLE_LABEL) as OpsRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}: {ROLE_HINT[r]}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Businesses</legend>
        <div className="flex flex-wrap gap-4 pt-1.5 text-sm">
          {BUSINESSES.map((b) => <label key={b} className="inline-flex items-center gap-2"><input type="checkbox" name={`biz_${b}`} defaultChecked={businesses.includes(b)} className="size-4 accent-[var(--acc)]" />{BIZ_LABEL[b]}</label>)}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Owners always see both.</p>
      </fieldset>
    </>
  );
}

export default async function TeamPage() {
  const { user: me } = await requireOps({ owner: true });
  const people = await db.select().from(t.opsUsers).orderBy(asc(t.opsUsers.active), asc(t.opsUsers.name));
  return (
    <>
      <PageHeader title="Team" sub="Who can sign in to the back office. These accounts are separate from the website admin." />
      <div className="space-y-3">
        {people.map((p) => (
          <details key={p.id} className="group rounded-lg border border-[var(--line)] bg-white open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-sm font-semibold text-white">{p.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}{p.id === me.id && <span className="font-normal text-[var(--muted)]"> (you)</span>}</span>
                <span className="block truncate text-xs text-[var(--muted)]">{p.email}{p.phone && ` · ${p.phone}`}</span>
              </span>
              <span className="hidden gap-1 sm:flex">{(p.role === "owner" ? BUSINESSES : p.businesses).map((b) => <Badge key={b}>{b === "td" ? "TD" : "Finzo"}</Badge>)}</span>
              <Badge tone={p.active ? (p.role === "owner" ? "blue" : "green") : "gray"}>{p.active ? ROLE_LABEL[p.role] : "Switched off"}</Badge>
            </summary>
            <div className="border-t border-[var(--line)] p-4">
              <OpsForm action={updateMember.bind(null, p.id)} className="grid gap-4 sm:grid-cols-2">
                <Access role={p.role} businesses={p.businesses} />
                <Field label="Phone"><input name="phone" type="tel" defaultValue={p.phone ?? ""} className={input} /></Field>
                <Field label="Reset password" hint="Leave empty to keep it. Resetting signs them out."><input name="password" type="text" minLength={10} autoComplete="off" className={input} /></Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" defaultChecked={p.active} className="size-4 accent-[var(--acc)]" /> Can sign in</label>
              </OpsForm>
            </div>
          </details>
        ))}
      </div>
      <Panel title="Add a person" className="mt-8">
        <OpsForm action={addMember} submitLabel="Add person" className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input name="name" required className={input} /></Field>
          <Field label="Email (their login)"><input name="email" type="email" required className={input} /></Field>
          <Field label="Phone"><input name="phone" type="tel" className={input} /></Field>
          <Field label="Temporary password" hint="Min 10 characters. They can change it."><input name="password" type="text" minLength={10} required autoComplete="off" className={input} /></Field>
          <Access />
        </OpsForm>
      </Panel>
    </>
  );
}
