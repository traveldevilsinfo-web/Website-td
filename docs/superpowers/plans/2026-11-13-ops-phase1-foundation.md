# Ops Dashboard Phase 1 (Foundation + Expenses): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/ops` with a TD ⇄ Finzo switch, ops roles, vendors, expense categories, expenses (mobile add, receipt photo, approve/reject/paid), recurring fixed costs posted by a cron, an Overview page and a monthly P&L report with CSV export.

**Architecture:** A new `app/ops/*` route tree inside the existing Next.js 16 app, using the same Postgres (Drizzle), the same `sessions` login and the same `components/admin/ui.tsx` kit. Every ops row carries `business` (`td` | `finzo`). Pure business rules live in `lib/ops-rules.ts` (no DB, tested in `lib/checks.mts`). Server helpers live in `lib/ops.ts`. Receipts go to a **private** storage bucket, served only through an auth-checked route.

**Tech Stack:** Next.js 16.3 App Router (read `node_modules/next/dist/docs/` before using any Next API, per AGENTS.md), React 19 server actions + `useActionState` (`SaveForm`), Drizzle 0.45 + drizzle-kit migrations, node-postgres, Supabase Storage REST, Tailwind 4, lucide-react. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-11-13-ops-dashboard-design.md` (Phase 1 row of §9, plus §3, §4, §5 money tables, §6 "Daily expense" and "Fixed costs", §7, §8)

## Global Constraints

- Money is stored as integer ₹ (`integer`), the same as `bookings.total`. Display with `inr()` from `lib/format.ts`.
- `business` values are exactly `td` and `finzo`. UI labels: "Travel Devils" and "Finzo Stays".
- The `ops_biz` cookie is a UI preference only. **Every** ops query and action filters by a business that `requireOps()` verified against the user.
- Roles: `admin` = owner (all of /admin + all of /ops, both businesses). `ops_manager` and `staff` get **/ops only**; any /admin page or action redirects them to `/ops`. `editor` keeps website-only access, with no /ops.
- `users.ops_businesses text[]` limits ops_manager/staff to `{td}`, `{finzo}` or `{td,finzo}`. Admin ignores it and always gets both.
- Receipts are never in the public `media` bucket or `/uploads/*`. Bucket: `process.env.SUPABASE_OPS_BUCKET || "ops-private"` (create it as **private** in Supabase). Local dev dir: `./uploads-private` (gitignored).
- Dates are IST calendar dates stored as `date` (`YYYY-MM-DD` strings). "Month" = `YYYY-MM`.
- Phase 1 cost centres: `general` or a TD `trip_batch_id`. Property cost centres come in Phase 2. Don't add the column now.
- Tests: assertions appended to `lib/checks.mts`, run with `npm test`. Pure modules imported there must not import `server-only` or `lib/db`.

## Review Focus

1. **Staff opening another person's receipt or expense by ID/path.** They should get 404. Covered by the `canSeeExpense` tests (Task 2) and the file route check (Task 5).
2. **Switch cookie forged to a business the user doesn't have.** The server should fall back to an allowed one. Covered by the `pickBusiness` tests (Task 2).
3. **Cron running twice on the same day, or skipping days.** It must post each fixed cost exactly once per month and catch up after a missed day. Covered by the `dueRecurring` tests (Task 8) and the unique index (Task 1).
4. **A fixed cost with `day_of_month` 31 in a 30-day month or February.** It should post on the last day of the month. Covered by the `dueRecurring` tests (Task 8).
5. **ops_manager/staff hitting /admin URLs or admin server actions directly.** They should be redirected to /ops. Covered by the `isOpsOnly` test (Task 2) plus the `requireUser` guard (Task 2), verified in Task 10.

---

### Task 1: Schema + migration + seed categories

**Files:**
- Modify: `db/schema.ts` (roleEnum at :11, users at :20; append an "ops" section at the end)
- Create: `db/migrations/0009_ops_foundation.sql` (generated) + appended seed SQL
- Modify: `.gitignore` (add `/uploads-private`)

**Interfaces:**
- Produces (Drizzle exports): `businessEnum` (`"td"|"finzo"`), `expenseStatusEnum` (`"needs_amount"|"submitted"|"approved"|"rejected"|"paid"`), `paidViaEnum` (`"cash"|"upi"|"bank"|"card"`), tables `vendors`, `expenseCategories`, `expenses`, `recurringExpenses`; `users.opsBusinesses`; roleEnum gains `ops_manager`, `staff`.

- [ ] **Step 1: Edit schema**
  - `roleEnum`: `["admin", "editor", "ops_manager", "staff"]`
  - `users.opsBusinesses`: `text("ops_businesses").array().notNull().default(sql\`'{}'\`)`
  - `vendors`: id serial, business, name text notNull, kind text (free: hotel/driver/landlord/utility/shop/other), phone, gstin, payTo text (UPI or bank details), notes, active bool default true, timestamps. Index `(business)`.
  - `expenseCategories`: id, business, name notNull, kind text notNull default `'variable'` (`fixed|variable|salary|inventory`), sort int default 0, active bool default true. Unique `(business, name)`.
  - `expenses`: id, business, date `date` notNull, amount int notNull default 0, categoryId FK notNull, vendorId FK nullable, tripBatchId FK → `trip_batches.id` nullable `onDelete: "set null"`, paidVia paidViaEnum nullable, reimburse bool default false (staff paid out of pocket), receiptPath text nullable, note text, status expenseStatusEnum default `submitted`, createdBy FK users notNull, approvedBy FK users nullable, approvedAt timestamptz, paidAt timestamptz, paidRef text, recurringId FK nullable `onDelete: "set null"`, period text nullable (`YYYY-MM`, only for recurring), timestamps. Indexes: `(business, date)`, `(business, status)`, `(created_by)`; **unique `(recurring_id, period)`**.
  - `recurringExpenses`: id, business, name notNull, amount int nullable (null = variable bill, e.g. electricity), categoryId FK notNull, vendorId FK nullable, dayOfMonth int notNull (1–31), paidVia nullable, active bool default true, startMonth text notNull (`YYYY-MM`), endMonth text nullable, timestamps.
- [ ] **Step 2: Generate migration**: run `npm run db:generate -- --name ops_foundation`. Expect a new `db/migrations/0009_ops_foundation.sql`. Check it has `ALTER TYPE "role" ADD VALUE 'ops_manager'` and `'staff'`, plus 4 `CREATE TABLE`s.
- [ ] **Step 3: Append seed categories** to the end of the generated SQL, with `--> statement-breakpoint` between statements and `ON CONFLICT DO NOTHING`:
  - td: Transport, Hotels & stays, Food, Permits & entry, Captain / trip leader fee, Gear & equipment, Marketing & ads, Office rent (fixed), Software & subscriptions (fixed), Salaries (salary), Misc
  - finzo: Rent to landlord (fixed), Electricity, Water, Internet / Wi-Fi (fixed), Society maintenance (fixed), Housekeeping & laundry, Linen & toiletries (inventory), Repairs & maintenance, Furniture & appliances, Platform fees, Salaries (salary), Misc
  - Unmarked = `variable`.
- [ ] **Step 4: Apply locally**: `npm run db:migrate`. Expect "migrations applied" with no error. Then `npm run build`, which should pass type-check.
- [ ] **Step 5: Commit**: `git add db .gitignore && git commit -m "ops: schema for vendors, categories, expenses, fixed costs, ops roles"`

### Task 2: Access rules + guards

**Files:**
- Create: `lib/ops-rules.ts` (pure)
- Create: `lib/ops.ts` (server-only)
- Modify: `lib/auth.ts` (`CurrentUser` type, `getCurrentUser` select, `requireUser`)
- Modify: `app/admin/login/actions.ts` (post-login redirect)
- Modify: `proxy.ts` (matcher adds `/ops`, `/ops/:path*`)
- Test: `lib/checks.mts`

**Interfaces:**
- Produces in `lib/ops-rules.ts`:
  - `type Biz = "td" | "finzo"`; `const BIZ_LABEL: Record<Biz, string>`
  - `type OpsUser = { id: number; role: "admin"|"editor"|"ops_manager"|"staff"; opsBusinesses: string[] }`
  - `allowedBusinesses(u: OpsUser): Biz[]`: admin → `["td","finzo"]`; ops_manager/staff → their list filtered to valid values; editor → `[]`
  - `pickBusiness(cookie: string | undefined, allowed: Biz[]): Biz | null`: cookie if allowed, else `allowed[0]`, else null
  - `isManager(u: OpsUser): boolean`: admin or ops_manager
  - `isOpsOnly(role: string): boolean`: ops_manager or staff
  - `canSeeExpense(u: OpsUser, e: { business: Biz; createdBy: number }): boolean`: business allowed AND (manager OR own)
- Produces in `lib/ops.ts`:
  - `OPS_COOKIE = "ops_biz"`
  - `requireOps(opts?: { manager?: boolean }): Promise<{ user: CurrentUser; biz: Biz; businesses: Biz[] }>`: not logged in → `/admin/login`; no businesses → `/admin?denied=1`; `manager` and not manager → `/ops?denied=1`
  - `setBusiness(biz: string): Promise<void>` (server action, `"use server"` inline): validates against allowed, sets cookie (httpOnly, sameSite lax, path `/ops`, 1 year), `revalidatePath("/ops", "layout")`
- `CurrentUser` gains `opsBusinesses: string[]` and role union widens to the four roles.

- [ ] **Step 1: Write failing tests** appended to `lib/checks.mts`:
```ts
import { allowedBusinesses, pickBusiness, isManager, isOpsOnly, canSeeExpense } from "./ops-rules";
const owner = { id: 1, role: "admin" as const, opsBusinesses: [] };
const mgrF = { id: 2, role: "ops_manager" as const, opsBusinesses: ["finzo"] };
const staffT = { id: 3, role: "staff" as const, opsBusinesses: ["td", "bogus"] };
const editor = { id: 4, role: "editor" as const, opsBusinesses: ["td"] };
assert.deepEqual(allowedBusinesses(owner), ["td", "finzo"]);
assert.deepEqual(allowedBusinesses(staffT), ["td"]);
assert.deepEqual(allowedBusinesses(editor), []);
assert.equal(pickBusiness("td", ["finzo"]), "finzo");      // forged cookie ignored
assert.equal(pickBusiness("finzo", ["td", "finzo"]), "finzo");
assert.equal(pickBusiness(undefined, []), null);
assert.equal(isManager(mgrF), true); assert.equal(isManager(staffT), false);
assert.equal(isOpsOnly("staff"), true); assert.equal(isOpsOnly("admin"), false); assert.equal(isOpsOnly("editor"), false);
assert.equal(canSeeExpense(staffT, { business: "td", createdBy: 3 }), true);
assert.equal(canSeeExpense(staffT, { business: "td", createdBy: 9 }), false);   // someone else's
assert.equal(canSeeExpense(mgrF, { business: "td", createdBy: 2 }), false);     // wrong business
assert.equal(canSeeExpense(owner, { business: "finzo", createdBy: 9 }), true);
console.log("ops access checks passed");
```
- [ ] **Step 2: Run** `npm test`. Expect it to FAIL: cannot find module `./ops-rules`.
- [ ] **Step 3: Implement `lib/ops-rules.ts`** (exports as above).
- [ ] **Step 4: Run** `npm test`. Expect "ops access checks passed".
- [ ] **Step 5: Wire guards**
  - `lib/auth.ts`: select `opsBusinesses`; in `requireUser`, after the login check: `if (isOpsOnly(user.role)) redirect("/ops")`. Because every /admin page and action calls `requireUser`, this one line closes /admin for ops roles.
  - `lib/ops.ts`: implement `requireOps`, `setBusiness`, `OPS_COOKIE`.
  - `login/actions.ts`: `redirect(isOpsOnly(user.role) ? "/ops" : "/admin")`.
  - `proxy.ts` matcher: `["/admin", "/admin/((?!login).*)", "/ops", "/ops/:path*"]`.
- [ ] **Step 6: Verify** `npm run build` passes.
- [ ] **Step 7: Commit**: `git commit -am "ops: access rules, requireOps, business switch, ops roles kept out of /admin"`

### Task 3: Team page manages ops roles

**Files:**
- Modify: `app/admin/(panel)/users/page.tsx` (role select + business checkboxes; show businesses column)
- Modify: `app/admin/(panel)/admin-actions.ts` (`createUser` at :128; add `updateUserAccess`)

**Interfaces:**
- Consumes: `Biz`, `BIZ_LABEL` from `lib/ops-rules.ts`
- Produces: `updateUserAccess(id: number, f: FormData): Promise<void>` (admin only; fields `role`, `ops_td`, `ops_finzo` checkboxes)

- [ ] **Step 1:** Role select options: Editor (website), Admin (everything), Ops manager, Ops staff. Add checkboxes "Travel Devils" and "Finzo Stays" (`name="ops_td"`, `name="ops_finzo"`). Parse the role with an allow-list; anything else → `editor`.
- [ ] **Step 2:** In each existing user row, add an inline `<form action={updateUserAccess.bind(null, id)}>` with the same controls and a Save button. Block an admin from demoting themselves (return without change if `id === me.id` and role ≠ admin).
- [ ] **Step 3: Verify** `npm run build`. In the browser (Task 10), create a staff user with `{td}`.
- [ ] **Step 4: Commit**: `git commit -am "ops: team page assigns ops roles and businesses"`

### Task 4: Ops shell (layout, nav, switch)

**Files:**
- Create: `app/ops/layout.tsx` (server: `requireOps()`, renders `OpsNav` + `<main>`; metadata robots noindex)
- Create: `app/ops/OpsNav.tsx` (client: sidebar + mobile drawer, modelled on `app/admin/(panel)/AdminNav.tsx`)
- Create: `app/ops/BizSwitch.tsx` (client: segmented control, calls `setBusiness`, hidden when only one business)
- Modify: `app/admin/(panel)/AdminNav.tsx` (add "Ops" item, `adminOnly`, icon `Wallet`, href `/ops`)

**Interfaces:**
- Consumes: `requireOps`, `setBusiness` (Task 2)
- Produces: `OpsNav` props `{ biz: Biz; businesses: Biz[]; user: { name: string; role: string }; manager: boolean; counts: { approvals: number; needsAmount: number }; logout: () => Promise<void> }`

- [ ] **Step 1:** Nav groups (manager-only items hidden for staff):
  - Overview `/ops`
  - Money: Expenses `/ops/expenses` (badge = approvals), Fixed costs `/ops/fixed-costs` (badge = needsAmount, manager), Vendors `/ops/vendors` (manager), Categories `/ops/categories` (manager), Reports `/ops/reports` (manager)
  - Footer: "Website admin" link (admin only), Logout.
  - A big "+ Expense" button at the top of the nav and as a floating button on mobile → `/ops/expenses/new`.
- [ ] **Step 2:** Brand accent per business so it's obvious which one is active: TD = existing `brand` colour; Finzo = `emerald-600` (top bar strip + switch active state).
- [ ] **Step 3:** Counts are computed in the layout with one query on `expenses` filtered by `biz`: `submitted` count (only if manager) and `needs_amount` count.
- [ ] **Step 4: Verify** `npm run build`. Then a stub `app/ops/page.tsx` that renders `PageHeader` with the business label.
- [ ] **Step 5: Commit**: `git commit -m "ops: shell with TD/Finzo switch"`

### Task 5: Private receipt storage

**Files:**
- Modify: `lib/uploads.ts`: add a private-bucket variant without touching the public API
- Create: `app/api/ops/upload/route.ts` (POST plan+sign, PUT local-only body)
- Create: `app/api/ops/file/route.ts` (GET `?path=` → auth check → stream (local) or 302 to a 5-minute signed URL (Supabase))
- Create: `app/ops/ReceiptInput.tsx` (client: `<input type="file" accept="image/*,application/pdf" capture="environment">`, uploads, writes the path into a hidden `receiptPath` input, shows a thumbnail/"PDF attached")

**Interfaces:**
- Produces in `lib/uploads.ts`:
  - `OPS_BUCKET`, `OPS_DIR` (`./uploads-private`)
  - `signPrivateUpload(p: string): Promise<string>`: Supabase `object/upload/sign/${OPS_BUCKET}/${p}`; local → `/api/ops/upload?path=…`
  - `privateFileUrl(p: string): Promise<string>`: Supabase `POST object/sign/${OPS_BUCKET}/${p}` body `{ expiresIn: 300 }` → absolute signed URL; local → not used (the route streams)
  - `readPrivateLocal(p)`, `writePrivateLocal(p, body)`
- Reuses `planUpload` and `UPLOAD_PATH` unchanged. Only jpg/jpeg/png/webp/pdf are allowed for receipts. Reject other extensions in the ops POST route; max 10 MB.

- [ ] **Step 1:** Upload POST requires `requireOps`-equivalent (logged in + `allowedBusinesses(user).length > 0`). Returns `{ path, uploadUrl, mime }`.
- [ ] **Step 2:** File GET: validates `UPLOAD_PATH`, loads `expenses` where `receipt_path = path`, then `canSeeExpense(user, row)`. Otherwise 404 (not 403, so it doesn't reveal the file exists). Sets `Cache-Control: private, no-store`.
- [ ] **Step 3: Verify** manually in Task 10: the receipt opens for its creator and a manager; a different staff user gets 404; `/uploads/<path>` gets 404.
- [ ] **Step 4: Commit**: `git commit -m "ops: private receipt uploads with auth-checked download"`

### Task 6: Vendors + categories

**Files:**
- Create: `app/ops/vendors/page.tsx`, `app/ops/vendors/[id]/page.tsx` (`[id]` = `new` or number), `app/ops/vendors/actions.ts`
- Create: `app/ops/categories/page.tsx`, `app/ops/categories/actions.ts`

**Interfaces:**
- Consumes: `requireOps({ manager: true })`, `form()`, `errorMessage()` from `lib/admin.ts`, `SaveForm`, ui kit
- Produces: `saveVendor(id: number | null, prev, f): Promise<ActionState>`, `saveCategory(id: number | null, prev, f)`, `toggleCategory(id: number)`

- [ ] **Step 1:** Vendors: list (name, kind, phone, active), search `?q=`, and a form following the coupons pattern (`app/admin/(panel)/coupons/*`). Every query has `where business = biz`; updates use `and(eq(id), eq(business, biz))` so an ID from the other business can't be edited.
- [ ] **Step 2:** Categories: one page, table + inline add form (name, kind) + rename + activate/deactivate (no delete; expenses reference them). A unique violation shows "That category already exists."
- [ ] **Step 3: Verify** `npm run build`.
- [ ] **Step 4: Commit**: `git commit -m "ops: vendors and expense categories"`

### Task 7: Expenses

**Files:**
- Create: `app/ops/expenses/page.tsx` (list), `app/ops/expenses/new/page.tsx`, `app/ops/expenses/[id]/page.tsx`, `app/ops/expenses/actions.ts`, `app/ops/expenses/ExpenseForm.tsx` (shared fields)

**Interfaces:**
- Consumes: `requireOps`, `canSeeExpense`, `isManager`, `ReceiptInput`, Task 1 tables
- Produces: `saveExpense(id: number | null, prev, f): Promise<ActionState>`, `decideExpense(id: number, decision: "approved" | "rejected", f: FormData)`, `markPaid(id: number, f: FormData)` (fields `paidRef`, `paidVia`)

- [ ] **Step 1: List.** Filters via search params `month` (default current IST month), `status`, `category`, `mine=1`. Staff always see only `created_by = me`. Columns: date, category, vendor/note, trip batch (TD), amount, status badge, receipt icon. Footer: total of shown rows. Managers get a "Waiting for approval" tab (status `submitted`) at the top.
- [ ] **Step 2: New (mobile-first).** Field order: Amount (big, `inputMode="numeric"`), Category (active ones for biz), Date (default today IST), Receipt (`ReceiptInput`), Paid via, "I paid this myself" (`reimburse`), Vendor (optional select), Trip departure (TD only: select of `trip_batches` starting from today − 30 days to today + 60 days, labelled `tripTitle · 12 Dec`), Note. Validation: amount 1–10,000,000; category must belong to biz; vendor/batch must belong to biz (batches are TD only). Created by staff → `submitted`; created by a manager → `approved` with `approvedBy = me`.
- [ ] **Step 3: Detail.** Shows all fields + receipt preview (img via `/api/ops/file?path=`, PDF link) + history line (created by, approved by/at, paid at/ref). The creator can edit while status is `submitted`/`needs_amount`/`rejected` (an edit resets it to `submitted`). Managers can edit any non-`paid` expense. Manager actions: Approve, Reject (requires a note), Mark paid (from `approved`). `needs_amount` rows: entering an amount > 0 moves them to `approved` when saved by a manager.
- [ ] **Step 4:** Every read/update goes through `canSeeExpense`; a miss → `notFound()`.
- [ ] **Step 5: Verify** `npm run build`, then the flows in Task 10.
- [ ] **Step 6: Commit**: `git commit -m "ops: expenses with receipts, approval and payment"`

### Task 8: Fixed costs + monthly cron

**Files:**
- Modify: `lib/ops-rules.ts` (add `dueRecurring`, `istToday`)
- Create: `app/ops/fixed-costs/page.tsx`, `app/ops/fixed-costs/[id]/page.tsx`, `app/ops/fixed-costs/actions.ts`
- Create: `lib/ops-recurring.ts` (server: `postRecurring(today: string): Promise<number>`)
- Create: `app/api/cron/ops-recurring/route.ts` (same Bearer `CRON_SECRET` check as `app/api/cron/daily-digest/route.ts`)
- Modify: `vercel.json` (cron `{ "path": "/api/cron/ops-recurring", "schedule": "0 1 * * *" }`)
- Test: `lib/checks.mts`

**Interfaces:**
- Produces:
  - `type RecurringLike = { id: number; dayOfMonth: number; active: boolean; startMonth: string; endMonth: string | null }`
  - `dueRecurring(rows: RecurringLike[], today: string /* YYYY-MM-DD */): { id: number; period: string; date: string }[]`: for the **current month only**, returns active rows within `[startMonth, endMonth]` whose effective day (`min(dayOfMonth, lastDayOfMonth)`) ≤ today's day. The DB unique `(recurring_id, period)` + `ON CONFLICT DO NOTHING` makes repeated runs idempotent and catches up missed days within the month.
  - `istToday(now?: Date): string`
  - `postRecurring(today)`: inserts the due rows into `expenses` with `status = amount == null ? "needs_amount" : "approved"`, `amount ?? 0`, `createdBy`/`approvedBy` = the first admin user id, `note = name`. Returns the inserted count.
  - Fixed-costs page action `postNow()` (manager) calls `postRecurring(istToday())` for an immediate run.

- [ ] **Step 1: Failing tests:**
```ts
import { dueRecurring, istToday, type RecurringLike } from "./ops-rules";
const r = (o: Partial<RecurringLike>) => ({ id: 1, dayOfMonth: 1, active: true, startMonth: "2026-01", endMonth: null, ...o });
assert.deepEqual(dueRecurring([r({})], "2026-11-01"), [{ id: 1, period: "2026-11", date: "2026-11-01" }]);
assert.deepEqual(dueRecurring([r({ dayOfMonth: 5 })], "2026-11-04"), []);                       // not yet
assert.deepEqual(dueRecurring([r({ dayOfMonth: 31 })], "2026-02-28"), [{ id: 1, period: "2026-02", date: "2026-02-28" }]); // short month
assert.deepEqual(dueRecurring([r({ dayOfMonth: 31 })], "2026-11-30"), [{ id: 1, period: "2026-11", date: "2026-11-30" }]);
assert.deepEqual(dueRecurring([r({ active: false })], "2026-11-20"), []);
assert.deepEqual(dueRecurring([r({ startMonth: "2026-12" })], "2026-11-20"), []);
assert.deepEqual(dueRecurring([r({ endMonth: "2026-10" })], "2026-11-20"), []);
assert.equal(istToday(new Date("2026-11-12T19:00:00Z")), "2026-11-13");                        // IST is past midnight
console.log("ops recurring checks passed");
```
- [ ] **Step 2: Run** `npm test`. Expect FAIL (no export `dueRecurring`).
- [ ] **Step 3: Implement** `dueRecurring` and `istToday` in `lib/ops-rules.ts`.
- [ ] **Step 4: Run** `npm test`. Expect "ops recurring checks passed".
- [ ] **Step 5:** Fixed-costs pages: list (name, category, vendor, amount or "variable", day, active, last posted period) + form; "Post due now" button. Manager only.
- [ ] **Step 6:** Cron route + `vercel.json`. Verify locally: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/ops-recurring` → `{"posted":N}`. A second call → `{"posted":0}`.
- [ ] **Step 7: Commit**: `git commit -am "ops: recurring fixed costs posted monthly by cron"`

### Task 9: Overview + Reports + CSV

**Files:**
- Modify: `lib/ops-rules.ts` (add `summarize`, `monthBounds`)
- Create: `lib/ops-queries.ts` (server: `monthExpenses(biz, month)`, `tdRevenue(month)`)
- Replace: `app/ops/page.tsx` (Overview)
- Create: `app/ops/reports/page.tsx`, `app/ops/reports/export/route.ts`
- Test: `lib/checks.mts`

**Interfaces:**
- Produces:
  - `monthBounds(month: string): { from: string; to: string }`: first and last date of the month, inclusive
  - `summarize(rows: { amount: number; status: string; category: string; kind: string }[]): { spent: number; unpaid: number; pendingCount: number; pendingAmount: number; byCategory: { category: string; kind: string; amount: number }[] }`. `spent` = approved + paid; `unpaid` = approved only; pending = submitted; rejected and needs_amount are excluded from spent; byCategory is sorted by amount desc, spent only.
  - `tdRevenue(month)`: `sum(payments.amount)` where `status = 'paid'` and `provider <> 'test'` and `created_at` (IST) in the month. Finzo revenue = 0 until Phase 2, shown as "Airbnb income arrives in Phase 2".

- [ ] **Step 1: Failing tests:**
```ts
import { summarize, monthBounds } from "./ops-rules";
assert.deepEqual(monthBounds("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
assert.deepEqual(monthBounds("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
const s = summarize([
  { amount: 1000, status: "approved", category: "Food", kind: "variable" },
  { amount: 500, status: "paid", category: "Food", kind: "variable" },
  { amount: 3000, status: "paid", category: "Rent", kind: "fixed" },
  { amount: 200, status: "submitted", category: "Food", kind: "variable" },
  { amount: 999, status: "rejected", category: "Food", kind: "variable" },
  { amount: 0, status: "needs_amount", category: "Electricity", kind: "variable" },
]);
assert.equal(s.spent, 4500); assert.equal(s.unpaid, 1000);
assert.equal(s.pendingCount, 1); assert.equal(s.pendingAmount, 200);
assert.deepEqual(s.byCategory.map((c) => c.category), ["Rent", "Food"]);
console.log("ops summary checks passed");
```
- [ ] **Step 2: Run** `npm test`. Expect FAIL.
- [ ] **Step 3: Implement** both in `lib/ops-rules.ts`. Run `npm test` → PASS.
- [ ] **Step 4: Overview** (manager; staff see "My expenses this month" + a "+ Expense" button instead): `StatCard`s for Revenue, Expenses, Profit, Waiting for approval, Unpaid; a 6-month revenue vs. expense bar list (plain CSS bars, no chart lib); alerts for fixed costs needing an amount and expenses waiting more than 3 days. Month picker `?month=`.
- [ ] **Step 5: Reports** (manager): month picker; P&L table (Revenue; expenses grouped by kind → category; Profit); for TD, a "By departure" table (expenses grouped by `trip_batch_id`, showing trip title + date). "Download CSV" → `/ops/reports/export?month=` returns `text/csv` with columns `date,category,kind,vendor,trip,amount,status,paid_via,reimburse,note,created_by` for that business+month. The route calls `requireOps({ manager: true })`. Quote fields and prefix any cell starting with `= + - @` with `'` (CSV injection).
- [ ] **Step 6: Verify** `npm run build`.
- [ ] **Step 7: Commit**: `git commit -am "ops: overview, monthly P&L report and CSV export"`

### Task 10: End-to-end verification

- [ ] **Step 1:** `npm test` (all checks pass) and `npm run build`.
- [ ] **Step 2:** Start the dev server (preview tool, `.claude/launch.json`) and log in as admin:
  - The switch flips the label, accent and data between TD and Finzo
  - Add a vendor and a fixed cost (day 1, ₹25,000) for Finzo → "Post due now" → an expense appears as approved. Click again → no duplicate
  - Add a TD expense tagged to a departure, with a receipt photo → it appears in Reports "By departure" and in the CSV
- [ ] **Step 3:** On the Team page, create `staff` with `{td}` and log in as them in a phone-size viewport:
  - They land on `/ops`, there's no switch, and `/admin` redirects to `/ops`
  - Add an expense with a receipt → status submitted, and it shows in the list
  - `/ops/vendors` redirects (manager only); `/ops/expenses/<admin's id>` → 404; the receipt URL of an admin expense → 404; `/uploads/<receipt path>` → 404
- [ ] **Step 4:** Back as admin: approve → mark paid with a ref → the staff user sees "paid".
- [ ] **Step 5:** Screenshot the Overview for the user. Remind them to create the **private** `ops-private` bucket in the Travel Devils Supabase project and set `SUPABASE_OPS_BUCKET` in Vercel before deploying (the Supabase/Vercel accounts must be Travel Devils', not the local CLI login).
