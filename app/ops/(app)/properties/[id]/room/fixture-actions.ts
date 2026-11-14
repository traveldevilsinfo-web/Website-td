"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { db, t } from "@/lib/db";
import { form } from "@/lib/admin";
import { requireStays } from "@/lib/ops";
import { FIXTURE_CONDITION } from "@/lib/room";

// Fixtures are bought once and never booked as expenses: nothing here may touch the expenses table.
// `condition` is plain text with no CHECK, so this file is the only thing keeping it to the four known values.
const isCondition = (c: unknown): c is string => typeof c === "string" && Object.hasOwn(FIXTURE_CONDITION, c);

/** A fixture, only if it sits in a flat. Every property is Finzo's, so this is what stops a forged id reaching other data. */
async function ownFixture(id: number) {
  const [fx] = await db.select({ id: t.fixtures.id, propertyId: t.fixtures.propertyId, name: t.fixtures.name, condition: t.fixtures.condition })
    .from(t.fixtures).innerJoin(t.properties, eq(t.fixtures.propertyId, t.properties.id)).where(eq(t.fixtures.id, id));
  if (!fx) throw new Error("Unknown fixture.");
  return fx;
}

/** Add a fixture to a flat, or (with a hidden `id`) edit one of that flat's. */
export async function saveFixture(propertyId: number, f: FormData) {
  await requireStays();
  const r = form(f);
  const name = r.str("name");
  const condition = r.str("condition") ?? "working";
  if (!name) throw new Error("A fixture needs a name.");
  if (!isCondition(condition)) throw new Error("Unknown condition.");
  const cost = r.int("cost");
  if (cost != null && (cost < 0 || cost > 100_000_000)) throw new Error("Cost looks wrong.");
  const boughtOn = r.str("boughtOn");
  if (boughtOn && !/^\d{4}-\d{2}-\d{2}$/.test(boughtOn)) throw new Error("Bought on is not a date.");
  const [p] = await db.select({ id: t.properties.id }).from(t.properties).where(eq(t.properties.id, propertyId));
  if (!p) throw new Error("Unknown flat.");

  const id = r.int("id");
  const base = { name, area: r.str("area"), cost, boughtOn, model: r.str("model"), notes: r.str("notes") };
  if (id) {
    const fx = await ownFixture(id);
    if (fx.propertyId !== propertyId) throw new Error("Unknown fixture.");
    await db.update(t.fixtures).set({
      ...base, condition, ...(condition !== fx.condition && { conditionAt: new Date() }), updatedAt: new Date(),
    }).where(eq(t.fixtures.id, id));
  } else {
    await db.insert(t.fixtures).values({ ...base, propertyId, condition, conditionAt: new Date() });
  }
  revalidatePath(`/ops/properties/${propertyId}/room`);
}

export async function setCondition(fixtureId: number, condition: string) {
  await requireStays();
  if (!isCondition(condition)) throw new Error("Unknown condition.");
  const fx = await ownFixture(fixtureId);
  await db.update(t.fixtures).set({ condition, conditionAt: new Date(), updatedAt: new Date() }).where(eq(t.fixtures.id, fixtureId));
  revalidatePath(`/ops/properties/${fx.propertyId}/room`);
}

/** Open a repair ticket for the fixture (or go to the one already open), then land on it. */
export async function reportFixtureProblem(fixtureId: number) {
  const { user } = await requireStays();
  const fx = await ownFixture(fixtureId);
  const [open] = await db.select({ id: t.tickets.id }).from(t.tickets)
    .where(and(eq(t.tickets.fixtureId, fixtureId), ne(t.tickets.status, "done")));
  let id = open?.id;
  if (!id) {
    [{ id }] = await db.insert(t.tickets).values({
      business: "finzo", propertyId: fx.propertyId, fixtureId, title: `${fx.name}: needs fixing`, createdBy: user.id,
    }).returning({ id: t.tickets.id });
  }
  revalidatePath("/ops", "layout");
  redirect(`/ops/tasks/repairs/${id}`);
}
