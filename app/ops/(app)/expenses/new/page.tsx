import { requireOps } from "@/lib/ops";
import { expenseFormOptions } from "@/lib/ops-queries";
import { BIZ_LABEL, istToday } from "@/lib/ops-rules";
import { OpsForm } from "@/app/ops/OpsForm";
import { PageHeader, Panel } from "@/app/ops/kit";
import { saveExpense } from "../actions";
import { ExpenseFields } from "../ExpenseForm";

export default async function NewExpense() {
  const { biz, manager } = await requireOps();
  return (
    <>
      <PageHeader back="/ops/expenses" title="Add expense" sub={`${BIZ_LABEL[biz]}${manager ? "" : " · a manager will approve it"}`} />
      <OpsForm action={saveExpense.bind(null, null)} submitLabel="Save expense">
        <Panel title="Expense"><ExpenseFields biz={biz} options={await expenseFormOptions(biz)} today={istToday()} /></Panel>
      </OpsForm>
    </>
  );
}
