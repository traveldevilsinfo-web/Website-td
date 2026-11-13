import { Badge } from "@/components/admin/ui";
import { STATUS_LABEL, type ExpenseStatus } from "@/lib/ops-rules";

const TONE: Record<ExpenseStatus, "amber" | "blue" | "green" | "red" | "gray"> = {
  needs_amount: "amber", submitted: "blue", approved: "green", rejected: "red", paid: "gray",
};
export const ExpenseBadge = ({ status }: { status: ExpenseStatus }) => <Badge tone={TONE[status]}>{STATUS_LABEL[status]}</Badge>;

export const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
