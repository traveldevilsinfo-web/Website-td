import { asc, eq } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { requireStays } from "@/lib/ops";
import { PageHeader, Panel } from "../../../kit";
import { OpsForm } from "../../../OpsForm";
import { saveStay } from "../actions";
import { StayFields } from "../StayFields";

export default async function NewStay({ searchParams }: PageProps<"/ops/stays/new">) {
  await requireStays();
  const sp = await searchParams;
  const flats = await db.select({ id: t.properties.id, code: t.properties.code, name: t.properties.name }).from(t.properties).where(eq(t.properties.active, true)).orderBy(asc(t.properties.sort), asc(t.properties.code));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.date)) ? String(sp.date) : undefined;
  return (
    <>
      <PageHeader back="/ops/calendar" title="Add booking or block" sub="Airbnb and Booking.com stays arrive by themselves; add direct bookings and blocks here." />
      <Panel className="max-w-2xl">
        <OpsForm action={saveStay.bind(null, null)} submitLabel="Save">
          <StayFields flats={flats} kind={sp.kind === "block" ? "block" : "booking"} v={{ propertyId: Number(sp.property) || undefined, checkIn: date }} />
        </OpsForm>
      </Panel>
    </>
  );
}
