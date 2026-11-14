# Room Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hold every physical thing in a Finzo flat — what should be there, what is, what it cost, and what went missing — and check it during the cleaning that already happens.

**Architecture:** The existing movement ledger keeps counting anything countable, gaining an `area` and a `kind`. A `property_kit` table says what each flat should hold (one standard row per item, optional per-flat override). Fixtures get their own small table, because condition and purchase cost do not belong in a quantity ledger. Losses become richer `stock_movements` rows. One Room page per flat composes all three.

**Tech Stack:** Next.js 16 App Router (server components, server actions), Drizzle ORM + Postgres, Tailwind 4, the `app/ops/kit.tsx` UI kit. Pure logic in `lib/*.ts`, asserted in `lib/checks.mts` via `npm test`.

**Spec:** `docs/superpowers/specs/2026-11-14-room-inventory-design.md`

## Global Constraints

- **Quantity is never stored.** Every figure is the sum of `stock_movements`. No task adds a cached total.
- **Finzo only.** Room page, kit and check are scoped to `biz === "finzo"`; `kind` stays null on Travel Devils' gear and the Stock page must behave exactly as it does today for TD.
- **A shortfall writes one movement, not two.** A shortfall with a reason → one `damaged` row. A surplus or unexplained difference → one `count` row. Never both.
- **Fixture costs never post to `expenses`.**
- **Linen is washed in the flat**, so the only places remain the store (`property_id` null) and each flat. Do not add a third place.
- **Phone first:** the kit check answers in one tap when nothing is wrong.
- `chargeable` is set by a manager (`requireStays()`), never by staff.
- Migrations: `npm run db:generate` then `npm run db:migrate`; against Supabase use the session pooler (port 5432), per `docs/ops-go-live.md`.

## Review Focus

Five things the spec implies that no task's happy path exercises. Each has a test in the task that owns the code.

1. **Double-decrement** — a shortfall must lower the total exactly once. Task 2.
2. **Unpriced items** — an item with no `cost_per_unit` must not silently value a loss at ₹0 in the report; the report states how many rows are unpriced. Tasks 2 and 8.
3. **Undone movements** — `stock_movements.undone_at` already exists; a reversed loss must leave the damage report. Task 8.
4. **An item with no expected row** — added to the catalogue after the kit was set; the Room page must show it as "not in the kit", not "0 of 0". Task 2.
5. **Opening count** — the first check for a flat must record what is there and create no losses, or day one invents ~240 of them. Task 7.

---

### Task 1: Schema and migration

**Files:**
- Modify: `db/schema.ts`
- Create: `db/migrations/00NN_room_inventory.sql` (generated)

**Interfaces:**
- Produces: `t.propertyKit`, `t.fixtures`; new columns `t.inventoryItems.area`, `t.inventoryItems.kind`, `t.stockMovements.reason|reservationId|chargeable|unitCost|claimSettledAt`, `t.tickets.fixtureId`.

- [ ] **Step 1: Add to `db/schema.ts`**

`inventoryItems`: `area: text("area")`, `kind: text("kind")` (null | `"consumable"` | `"replaceable"`).

`propertyKit` table `property_kit`: `id` serial, `itemId` → `inventoryItems` (cascade), `propertyId` → `properties` (cascade, **nullable** — null is the standard for every flat), `expected` integer not null, `createdAt`/`updatedAt`. Unique index on `(itemId, propertyId)`.

`fixtures` table: `id` serial, `propertyId` → `properties` (cascade, not null), `name` text not null, `area` text, `condition` text not null default `"working"` (`working|attention|broken|missing`), `conditionAt` timestamptz, `cost` integer, `boughtOn` date, `model` text, `notes` text, `active` boolean not null default true, `createdAt`/`updatedAt`.

`stockMovements` adds: `reason` text (`damaged|stolen|lost|worn out`), `reservationId` → `reservations` (set null), `chargeable` boolean not null default false, `unitCost` integer, `claimSettledAt` timestamptz.

`tickets` adds: `fixtureId` → `fixtures` (set null).

- [ ] **Step 2: Generate and apply**

Run: `npm run db:generate && npm run db:migrate`
Expected: a new `00NN_room_inventory.sql`, applied, and `npx drizzle-kit check` reports "Everything's fine".

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/schema.ts db/migrations
git commit -m "feat: tables for room kit, fixtures and valued losses"
```

---

### Task 2: Kit arithmetic

**Files:**
- Create: `lib/room.ts`
- Modify: `lib/checks.mts` (append)

**Interfaces:**
- Consumes: `StockKind` and `countDelta` from `lib/stock.ts`.
- Produces:
  - `type KitRow = { itemId: number; propertyId: number | null; expected: number }`
  - `expectedFor(kit: KitRow[], itemId: number, propertyId: number): number | null` — the flat's override, else the standard row, else `null` (not in the kit).
  - `type KitLine = { itemId: number; name: string; area: string | null; expected: number | null; actual: number; short: number }`
  - `kitLines(items, kit, totals, propertyId): KitLine[]` — sorted by area then name; `short` is `max(0, expected - actual)` and `0` when `expected` is null.
  - `type Shortfall = { itemId: number; propertyId: number; qty: number; reason: string | null; reservationId: number | null; unitCost: number | null }`
  - `planShortfall(s: Shortfall): { kind: StockKind; qty: number; reason: string | null; reservationId: number | null; unitCost: number | null } | null` — a reason gives `kind: "damaged"`; no reason gives `kind: "count"`; `qty` is always negative; `qty === 0` returns null.
  - `lossTotal(rows: { qty: number; unitCost: number | null }[]): { value: number; unpriced: number }`
  - `FIXTURE_CONDITION: Record<string, string>` and `fitOutValue(fixtures: { cost: number | null; active: boolean }[]): number`

- [ ] **Step 1: Write the failing tests** — append to `lib/checks.mts`

```ts
import { expectedFor, kitLines, planShortfall, lossTotal, fitOutValue } from "./room";
const kit = [{ itemId: 1, propertyId: null, expected: 4 }, { itemId: 1, propertyId: 7, expected: 6 }];
assert.equal(expectedFor(kit, 1, 7), 6);        // the flat's own number wins
assert.equal(expectedFor(kit, 1, 9), 4);        // otherwise the standard
assert.equal(expectedFor(kit, 2, 7), null);     // an item nobody put in the kit
// A shortfall lowers the ledger exactly once
assert.deepEqual(planShortfall({ itemId: 1, propertyId: 7, qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 }),
  { kind: "damaged", qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 });
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: -2, reason: "stolen", reservationId: 31, unitCost: 450 }).kind, "damaged");
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: -1, reason: null, reservationId: null, unitCost: null }).kind, "count");
assert.equal(planShortfall({ itemId: 1, propertyId: 7, qty: 0, reason: null, reservationId: null, unitCost: null }), null);
// An item with no cost must be reported, not counted as free
assert.deepEqual(lossTotal([{ qty: -2, unitCost: 450 }, { qty: -1, unitCost: null }]), { value: 900, unpriced: 1 });
// An item outside the kit is shown, never as "0 of 0"
const lines = kitLines([{ id: 2, name: "Ash tray", area: "Table" }], kit, new Map([["2@7", 3]]), 7);
assert.equal(lines[0].expected, null);
assert.equal(lines[0].short, 0);
assert.equal(fitOutValue([{ cost: 32000, active: true }, { cost: 8500, active: true }, { cost: 999, active: false }]), 40500);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `./room`.

- [ ] **Step 3: Write `lib/room.ts`** with the signatures above. No DB import and no `server-only`: it is pure and is asserted by `npm test`. `kitLines` takes the `totals` map in the shape `stockTotals().byPlace` already uses (`"<itemId>@<propertyId>"`).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS, "room kit checks passed".

- [ ] **Step 5: Relabel the movement kind**

In `lib/stock.ts`, `STOCK_LABEL.damaged` becomes `"Damaged, lost or stolen"`. The present
"Damaged or lost" reads wrongly in history beside a reason of "stolen". Nothing else changes: the
enum value stays `damaged`, so no migration and no query is affected.

- [ ] **Step 6: Run the suite**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/room.ts lib/stock.ts lib/checks.mts
git commit -m "feat: kit arithmetic, with one movement per shortfall"
```

---

### Task 3: Reading a flat's room

**Files:**
- Create: `lib/room-queries.ts`

**Interfaces:**
- Consumes: `kitLines`, `fitOutValue` (Task 2); `stockTotals` from `lib/stock.ts`; `db, t` from `lib/db`.
- Produces:
  - `roomForFlat(propertyId: number): Promise<{ lines: KitLine[]; fixtures: Fixture[]; fitOut: number }>` — counted lines by area plus that flat's active fixtures.
  - `effectiveKit(): Promise<KitRow[]>`

- [ ] **Step 1: Write `lib/room-queries.ts`**

Starts `import "server-only"`. One query for `inventoryItems` where `business = "finzo"` and `active`, one for `propertyKit`, one for that flat's `stockMovements` joined to its items, one for `fixtures` where `propertyId` and `active`. Compose with `stockTotals` and `kitLines`; never sum quantities in SQL.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/room-queries.ts
git commit -m "feat: read a flat's room — kit lines and fixtures"
```

---

### Task 4: The Room page

**Files:**
- Create: `app/ops/(app)/properties/[id]/room/page.tsx`
- Modify: `app/ops/(app)/properties/[id]/page.tsx` (add a link to the room)

**Interfaces:**
- Consumes: `roomForFlat` (Task 3); `requireStays` from `lib/ops`; `Panel`, `DataTable`, `Badge`, `btnPrimary` from `app/ops/kit`.

- [ ] **Step 1: Build the page**

`export const dynamic = "force-dynamic"`. `await requireStays()` first. Group counted lines by `area`, each row reading `actual of expected`, with a `Badge tone="amber"` where `short > 0` and the muted words "not in the kit" where `expected` is null. Below, the fixtures with `FIXTURE_CONDITION[condition]` as a Badge (`working` green, `attention` amber, `broken` red, `missing` red), cost and `boughtOn`, and the flat's fit-out total from `fitOut`. Use `DataTable` so the phone card layout comes for free.

- [ ] **Step 2: Check it on a phone and a laptop**

Run the dev server; open `/ops/properties/1/room` at 390px and at 1280px.
Expected: no sideways page scroll at 390px; counted rows render as labelled cards; the table returns above 640px.

- [ ] **Step 3: Commit**

```bash
git add "app/ops/(app)/properties/[id]/room/page.tsx" "app/ops/(app)/properties/[id]/page.tsx"
git commit -m "feat: a Room page per flat"
```

---

### Task 5: The standard kit editor

**Files:**
- Create: `app/ops/(app)/kit/page.tsx`, `app/ops/(app)/kit/actions.ts`
- Modify: `app/ops/(app)/OpsNav.tsx` (a "Room kit" item under Setup, `show: stays && manager`)

**Interfaces:**
- Produces: `saveKit(itemId: number, propertyId: number | null, expected: number)`, `removeKit(id: number)` — both `requireStays()`.

- [ ] **Step 1: Build the page and actions**

Rows grouped by area: item, the standard number, and the flats that override it. Saving with `propertyId` null writes the standard; with a flat id, that flat's override. `expected` of 0 is valid (the flat deliberately has none); removing the row means "not in the kit". Upsert on the `(itemId, propertyId)` unique index.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. In the browser: set a standard, override one flat, confirm the Room page for that flat shows the override and another flat shows the standard.

- [ ] **Step 3: Commit**

```bash
git add "app/ops/(app)/kit" "app/ops/(app)/OpsNav.tsx"
git commit -m "feat: one standard kit, with per-flat overrides"
```

---

### Task 6: Fixtures

**Files:**
- Create: `app/ops/(app)/properties/[id]/room/fixture-actions.ts`
- Modify: `app/ops/(app)/properties/[id]/room/page.tsx`, `app/ops/(app)/tasks/actions.ts`

**Interfaces:**
- Produces: `saveFixture(propertyId: number, f: FormData)`, `setCondition(fixtureId: number, condition: string)`, `reportFixtureProblem(fixtureId: number)` — the last creates a `tickets` row with `fixtureId` set, `propertyId`, `business: "finzo"`, and a title naming the fixture, then redirects to that ticket.

- [ ] **Step 1: Build the actions and the form**

Add/edit a fixture inline on the Room page: name, area, condition, cost, bought on, model, notes. `setCondition` also sets `conditionAt`. **`saveFixture` must not touch `expenses`** (Global Constraints).

- [ ] **Step 2: Verify the ticket link**

In the browser: mark a fixture broken, report a problem, confirm a ticket exists carrying `fixture_id` and that the Room page shows the fixture as broken with a link to it.

- [ ] **Step 3: Commit**

```bash
git add "app/ops/(app)/properties/[id]/room" "app/ops/(app)/tasks/actions.ts"
git commit -m "feat: a fixtures register, with repairs linked to tickets"
```

---

### Task 7: The kit check inside the cleaning

**Files:**
- Modify: `lib/stays-sync.ts:9` (`DEFAULT_CHECKLIST`), `app/ops/(app)/tasks/clean/[id]/page.tsx`, `app/ops/(app)/tasks/actions.ts`
- Create: `app/ops/(app)/tasks/clean/[id]/KitCheck.tsx`
- Modify: `lib/checks.mts` (append)

**Interfaces:**
- Consumes: `planShortfall`, `kitLines` (Task 2); `roomForFlat` (Task 3).
- Produces: `recordKitCheck(turnoverId: number, f: FormData)` — writes one movement per changed item via `planShortfall`, and nothing at all for an unchanged item.

- [ ] **Step 1: Write the failing test** — append to `lib/checks.mts`

```ts
import { isOpeningCount } from "./room";
assert.equal(isOpeningCount([]), true);                        // nothing counted here yet
assert.equal(isOpeningCount([{ itemId: 1, qty: 4 }]), false);  // this flat has history
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, `isOpeningCount` is not exported.

- [ ] **Step 3: Add `isOpeningCount(moves: { itemId: number; qty: number }[]): boolean` to `lib/room.ts`** — true when the flat has no movements at all for its counted items.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Replace the checklist line**

In `DEFAULT_CHECKLIST`, replace `"Check for damage / missing items"` with `"Room kit checked"`. Leave existing turnovers alone — they keep the checklist they were created with.

- [ ] **Step 6: Build `KitCheck.tsx`**

A client component. Default state: one button, **Yes, all good**, which submits nothing to change and marks the step done. Below it, the counted items as tappable chips; tapping one reveals a number field and, if the new number is lower, the four reasons (damaged, stolen, lost, worn out). When the turnover has a `reservationId` and a reason is given, pass it so the loss ties to that stay. **No `chargeable` control appears here** — that is a manager's decision (Global Constraints).

When `isOpeningCount` is true for the flat, the heading reads "First count for this flat", the reason prompt is suppressed entirely, and every entry is written as a `count` movement.

- [ ] **Step 7: Wire `recordKitCheck`**

For each item whose number changed, call `planShortfall` and insert the single movement it returns, with `unitCost` snapshotted from `inventoryItems.costPerUnit`. Unchanged items write nothing. Do not block `finishTurnover` when the step was skipped.

- [ ] **Step 8: Verify the arithmetic end to end**

In the browser: a flat with 4 of 4 towels, record 2 with reason "stolen".
Expected: the flat's towel total falls to 2, **not** 0; exactly one new `stock_movements` row, `kind = 'damaged'`, `reason = 'stolen'`, `unit_cost` set, `reservation_id` the stay.

- [ ] **Step 9: Commit**

```bash
git add lib/stays-sync.ts lib/room.ts lib/checks.mts "app/ops/(app)/tasks"
git commit -m "feat: a one-tap kit check in the cleaning"
```

---

### Task 8: Claims and the losses report

**Files:**
- Create: `app/ops/(app)/reports/losses/page.tsx`
- Modify: `app/ops/(app)/reports/page.tsx` (link), `lib/checks.mts` (append)

**Interfaces:**
- Consumes: `lossTotal` (Task 2).
- Produces: `setChargeable(movementId: number, on: boolean)`, `settleClaim(movementId: number)` — both `requireStays()`, both set by a manager.

- [ ] **Step 1: Write the failing test** — append to `lib/checks.mts`

```ts
// A reversed loss is not a loss
assert.deepEqual(lossTotal([{ qty: -2, unitCost: 450 }, { qty: -1, unitCost: 450, undoneAt: new Date() }]),
  { value: 900, unpriced: 0 });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, undone rows are still counted.

- [ ] **Step 3: Make `lossTotal` ignore rows with `undoneAt`** set, widening its parameter type.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Build the report**

Damage and theft by month and flat: reason, item, quantity, value, the stay, and whether it is chargeable. A manager can tick chargeable and mark a claim settled; settled rows drop out of "worth charging" but stay in the month's total. Where `lossTotal` returns `unpriced > 0`, say so plainly under the total — "3 items have no cost recorded" — rather than under-reporting in silence.

- [ ] **Step 6: Commit**

```bash
git add "app/ops/(app)/reports" lib/checks.mts
git commit -m "feat: a valued losses report, with claims that can be closed"
```

---

### Task 9: Seed the catalogue

**Files:**
- Create: `scripts/room-kit.json`, `scripts/seed-room-kit.mts`
- Modify: `package.json` (`"ops:kit": "tsx --env-file=.env.local scripts/seed-room-kit.mts"`)

**Interfaces:**
- Produces: a `--sql` mode printing statements to paste, matching `scripts/import-airbnb-listings.mts`.

- [ ] **Step 1: Write `scripts/room-kit.json`**

Harshit's seven areas verbatim — Bed, Table, Work desk, Kitchen, Wardrobe, Fixtures & other, Bathroom. Each entry: `area`, `name`, `kind` (`consumable` | `replaceable` | `fixture`), `expected` (counted kinds only), `unit`, `costPerUnit`. **Every replaceable carries a cost**, or the losses report reads ₹0 for it (Review Focus 2). Fixtures carry no `expected`.

- [ ] **Step 2: Write the seeder**

Consumables and replaceables upsert into `inventoryItems` (matched on `business` + `name`) and write their standard `propertyKit` row with `propertyId` null. Fixtures insert one row per active Finzo flat. Safe to run twice: match on name, update rather than duplicate. It writes **no** stock movements — opening counts come from the first kit check (Review Focus 5).

- [ ] **Step 3: Verify**

Run: `npm run ops:kit` against the local database, twice.
Expected: the second run reports 0 added; `/ops/kit` lists every area; a flat's Room page shows each counted item as "0 of N" and its fixtures; `npm test` and `npx tsc --noEmit` pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/room-kit.json scripts/seed-room-kit.mts package.json
git commit -m "feat: seed the room catalogue and the standard kit"
```
