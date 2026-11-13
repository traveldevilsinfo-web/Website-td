import { requireOps } from "@/lib/ops";
import { BIZ_LABEL } from "@/lib/ops-rules";
import { PageHeader } from "@/components/admin/ui";

export default async function OpsHome() {
  const { biz } = await requireOps();
  return <PageHeader title={`${BIZ_LABEL[biz]} overview`} />;
}
