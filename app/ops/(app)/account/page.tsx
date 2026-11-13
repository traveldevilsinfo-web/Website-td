import { requireOps } from "@/lib/ops";
import { BIZ_LABEL, ROLE_LABEL } from "@/lib/ops-rules";
import { Field, PageHeader, Panel, input } from "../../kit";
import { OpsForm } from "../../OpsForm";
import { changePassword } from "./actions";

export default async function AccountPage() {
  const { user, businesses } = await requireOps();
  return (
    <>
      <PageHeader title="My account" sub={`${user.name} · ${ROLE_LABEL[user.role]} · ${businesses.map((b) => BIZ_LABEL[b]).join(", ")}`} />
      <Panel title="Change password" className="max-w-lg">
        <OpsForm action={changePassword} submitLabel="Change password">
          <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className={input} /></Field>
          <Field label="New password" hint="At least 10 characters."><input name="next" type="password" minLength={10} required autoComplete="new-password" className={input} /></Field>
        </OpsForm>
      </Panel>
    </>
  );
}
