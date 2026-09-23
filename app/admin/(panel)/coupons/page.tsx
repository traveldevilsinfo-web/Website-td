import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { inr } from "@/lib/format";
import { PageHeader, StatusBadge, Table, btnPrimary } from "@/components/admin/ui";

export default async function CouponsPage() {
  const rows = await db.select().from(t.coupons).orderBy(desc(t.coupons.createdAt));
  const now = new Date();
  return (
    <>
      <PageHeader title="Coupons" action={<Link href="/admin/coupons/new" className={btnPrimary}>+ New coupon</Link>} />
      <Table head={["Code", "Discount", "Used", "Valid", "Status"]} empty={!rows.length}>
        {rows.map((c) => {
          const live = c.active && (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt > now) && (c.usageLimit == null || c.used < c.usageLimit);
          return (
            <tr key={c.id} className="group relative hover:bg-gray-50">
              <td><Link href={`/admin/coupons/${c.id}`} className="font-mono font-semibold after:absolute after:inset-0 group-hover:text-brand">{c.code}</Link><p className="text-xs text-gray-500">{c.description}</p></td>
              <td>{c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ""}` : inr(c.value)}{c.minAmount ? <span className="text-xs text-gray-500"> · min {inr(c.minAmount)}</span> : null}</td>
              <td>{c.used}{c.usageLimit != null && ` / ${c.usageLimit}`}</td>
              <td className="text-xs text-gray-600">{c.startsAt ? c.startsAt.toLocaleDateString("en-IN") : "now"} → {c.endsAt ? c.endsAt.toLocaleDateString("en-IN") : "no end"}</td>
              <td><StatusBadge status={live ? "available" : "closed"} /></td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
