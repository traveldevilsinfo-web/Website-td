import { requireOps } from "@/lib/ops";
import { expenseFormOptions } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday } from "@/lib/ops-rules";
import { SaveForm } from "@/components/admin/SaveForm";
import { PageHeader, Section } from "@/components/admin/ui";
import { saveExpense } from "../actions";
import { ExpenseFields } from "../ExpenseForm";

export default async function NewExpense() {
  const { biz, manager } = await requireOps();
  return (
    <>
      <PageHeader back="/ops/expenses" title="Add expense" description={`${BIZ_LABEL[biz]}${manager ? "" : " · a manager will approve it"}`} />
      <SaveForm action={saveExpense.bind(null, null)} submitLabel="Save expense">
        <Section title="Expense"><ExpenseFields biz={biz} options={await expenseFormOptions(biz)} today={istToday()} /></Section>
      </SaveForm>
    </>
  );
}
