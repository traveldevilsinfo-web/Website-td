# Ops Dashboard (Travel Devils + Finzo Stays): Design Plan

Status: **draft for review** · 13 Nov 2026

## 1. What this is and why

One internal back-office ("Ops") for two businesses run by the same owners:

- **Travel Devils (TD)**: group trips. Revenue already comes in through the website (bookings + Razorpay payments in this codebase). Missing today: what each trip *cost*, staff salaries, trip-captain payouts, sales incentives, and gear inventory.
- **Finzo Stays**: 13 Airbnb apartments. There's no system yet. They need per-property income vs. costs, staff (caretakers and housekeeping), salaries, fixed monthly costs (rent, electricity, Wi-Fi, maintenance) and stock (linen, toiletries).

A **switch in the top bar (TD ⇄ Finzo)** flips the whole dashboard. The modules are the same in both; each record belongs to one business; and each business gets a few modules of its own.

**Success = the owner can open it on the 5th of the month and see, per business, per trip or property: money in, money out, profit, and who is owed what, without opening Excel.**

### Goals
- Expenses (one-off and recurring fixed costs) with receipt photos and an approval step
- People: employees, attendance and leave, salary structures, monthly payroll, advances, incentives, payslips
- Inventory: items, stock per location, stock in and out, low-stock alerts
- P&L per business, per TD trip batch and per Finzo property
- Airbnb: reservations, occupancy and payouts per property, and automatic cleaning tasks
- Works on a phone (staff log expenses and attendance from the field)

### Non-goals (v1)
- Full accounting (ledger, balance sheet, GST filing): export to the accountant instead
- Statutory payroll (PF/ESI/PT/TDS auto-calculation): entered as manual deduction lines
- Biometric attendance devices, Airbnb pricing changes, guest messaging

### Anti-goals
- Salary and receipt data must never be publicly reachable (the current media bucket is public, see §6)
- Editors on the website CMS must not see payroll by default

## 2. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (recommended)** | **Build `/ops` inside this Next.js app, using the same Supabase Postgres, auth and UI kit** | Reuses login, `requireUser`, `components/admin/*`, upload pipeline, Drizzle. TD trip P&L can join directly to `bookings`/`payments`/`trip_batches`. One deploy. Downside: the website and ops share a deploy, so a bad ops deploy can affect the site. |
| B | Separate Next.js app on `ops.` subdomain, same DB | Clean isolation, but duplicates auth/UI, and the TD revenue joins are cross-app. More to maintain for a two-person team. |
| C | Off-the-shelf tools: Zoho People/Payroll + a PMS (Hospitable / Hostaway) + Zoho Books | Fastest for payroll compliance, but costs money per seat/property, gives three separate logins, and has no TD booking-cost link. |

**Pick A.** Revisit B only if ops gets its own team or deploy cadence.

**Airbnb sync, the hard constraint:** Airbnb has **no open API** for hosts. Realistic options, in order:
1. **iCal feed per listing** (free, works today): gives booked/blocked dates only, with **no guest name or price**. Enough for occupancy, a calendar and cleaning tasks.
2. **Airbnb earnings CSV export** (Hosting → Earnings → Transaction history): has payout, nights, guest, cleaning fee and service fee. Upload it monthly and match to iCal reservations. **v1 = 1 + 2.**
3. **A PMS with official Airbnb API access** (Hospitable, Hostaway, Guesty): real-time reservations with prices. Paid. Only worth it if the monthly CSV becomes painful, and then we pull from the PMS API instead of iCal.

## 3. Structure and navigation

```
/ops                         ← switch: [ Travel Devils | Finzo Stays ]  (cookie `ops_biz`)
├─ Overview                  KPIs + alerts for the selected business
├─ Money
│   ├─ Expenses              list / add (mobile) / approve
│   ├─ Fixed costs           recurring templates → auto-post monthly
│   ├─ Vendors               who we pay (hotels, drivers, landlords, laundry…)
│   └─ Reports               P&L, by category, by trip/property, CSV export
├─ People
│   ├─ Employees             profile, documents, bank, salary structure, assignment
│   ├─ Attendance & leave    daily mark (manager or self), leave requests
│   ├─ Payroll               monthly run → review → lock → payslips
│   ├─ Advances              salary advances, auto-deducted
│   └─ Incentives            rules + monthly computed list, manual override
├─ Inventory
│   ├─ Items & stock         per location (TD: warehouse; Finzo: each property)
│   └─ Movements             stock in / issue / return / damaged / transfer
├─ TD only
│   ├─ Trip P&L              per trip batch: booking revenue vs. costs
│   └─ Captains              trip leaders' per-batch fees
└─ Finzo only
    ├─ Properties            the 13 units, landlord, rent, utilities, iCal URL
    ├─ Calendar              all properties × dates (from iCal)
    ├─ Reservations          iCal + earnings CSV matched
    └─ Turnovers             auto cleaning tasks per checkout, assigned to housekeeping
```

Entry: `/ops` (its own login). No link from the website admin.

## 4. Roles and access

**Separate from the website (owner's decision, 13 Nov).** Ops has its own accounts (`ops_users`), sessions (`ops_sessions`, cookie `ops_session`), login page (`/ops/login`), UI kit and look (dark finance app, IBM Plex Sans). Website admins don't get into ops, ops people don't get into the website admin, and nothing in the website admin links to ops.

| Role | Can |
|---|---|
| `owner` | Everything, both businesses, Team page, payroll lock, salary visibility |
| `manager` | Their business(es): approve expenses, fixed costs, vendors, reports; later attendance, payroll draft (not lock), inventory |
| `staff` | Log own expenses; later attend, leave, own payslips, issue/return stock |

`ops_users.businesses: text[]` (`{td}`, `{finzo}`, `{td,finzo}`); owners always get both. The switch only shows businesses the user has. **Every ops query filters by `business` on the server**: the cookie is a UI preference, not a permission. First owner: `npm run ops:owner -- email "Name" password`.

## 5. Data model (new tables, all with `business` = `td` | `finzo`)

```
vendors          id, business, name, type, phone, gstin, upi/bank, notes
expense_categories id, business, name, parent_id, kind(fixed|variable|salary|inventory)
expenses         id, business, date, amount, category_id, vendor_id,
                 cost_center_type(trip_batch|property|general), cost_center_id,
                 paid_via(cash|upi|bank|card), paid_by_employee_id (for reimbursement),
                 receipt_path, note, status(submitted|approved|rejected|paid),
                 approved_by, recurring_id, created_by
recurring_expenses id, business, name, amount, category_id, vendor_id, cost_center…,
                 day_of_month, active, start, end    → cron creates `expenses` each month

employees        id, business, user_id?, name, phone, role_title, join_date, exit_date,
                 assigned_property_id?, bank/upi, id docs (private), status
salary_structures id, employee_id, effective_from, basic, allowances jsonb,
                 deductions jsonb, pay_type(monthly|daily|per_trip)
attendance       employee_id, date, status(P|A|HD|L|WO|H), marked_by     (unique emp+date)
leaves           id, employee_id, from, to, type, status, approved_by
advances         id, employee_id, date, amount, recovered_amount, monthly_recovery
incentive_rules  id, business, name, basis(booking_value|pax|checkout|review|fixed),
                 rate, conditions jsonb, active
incentives       id, employee_id, month, rule_id?, source_ref, amount, note, status
payroll_runs     id, business, month, status(draft|locked|paid), locked_by
payslips         id, run_id, employee_id, days_payable, gross, incentives,
                 advance_recovery, deductions, net, lines jsonb, paid_on, paid_ref

inventory_items  id, business, name, unit, category, reorder_level, cost_per_unit
inventory_locations id, business, name, property_id?   (TD: "Delhi store"; Finzo: each unit)
stock_movements  id, item_id, location_id, qty(+/-), type(in|issue|return|damaged|transfer|count),
                 ref(trip_batch|turnover|expense), by, at       → stock = SUM(qty)

-- TD
trip_batches.captain_employee_id, bookings.sales_employee_id   (two new columns)

-- Finzo
properties       id, name, address, airbnb_listing_url, ical_url, landlord_vendor_id,
                 monthly_rent, active
reservations     id, property_id, source(ical|csv|manual), ical_uid, check_in, check_out,
                 nights, guest_name?, gross?, airbnb_fee?, cleaning_fee?, payout?, status
turnovers        id, property_id, reservation_id, date, assigned_employee_id,
                 status(todo|done|issue), checklist jsonb, photos, done_at
```

Money is stored as integer ₹, the same as `bookings`. Stock is never stored as a number; it's the sum of movements, so it's always auditable.

## 6. Key flows

**Daily expense (phone)**: Staff opens /ops → "+ Expense" → amount, category, which trip/property, photo of the bill → *submitted*. Manager sees a badge → approves/rejects → approved shows up in the P&L. If paid by staff out of pocket, it becomes a reimbursement and lands on their next payslip (or is marked paid now).

**Fixed costs**: Set up once per property/business (rent, electricity estimate, Wi-Fi, software, office rent). On the 1st a Vercel cron creates that month's expenses as *approved, unpaid*. Variable utilities (electricity) are posted as *needs amount*, and the manager fills in the real bill.

**Monthly payroll**:
1. Owner/manager opens Payroll → "Start Nov 2026" → system builds a draft per employee from the salary structure, attendance (LOP days), approved incentives, advance recovery, and reimbursements.
2. Review screen: one row per person, editable adjustments with a reason.
3. Owner **locks** → payslips are frozen (printable page/PDF, same approach as `lib/pdf-trip.ts`) → salary expenses auto-post to P&L split by the employee's trip/property.
4. Mark paid (bank ref) → staff see their payslip.

**Incentives** (rules are computed into editable monthly rows):
- TD sales: % of confirmed booking value where `bookings.sales_employee_id` = them, or ₹/pax
- TD captains: fixed fee per batch led (+ optional rating bonus)
- Finzo housekeeping: ₹ per completed turnover; bonus per 5★ cleanliness review (entered manually)
- Finzo property manager: % of property profit over a target

**Airbnb (Finzo)**:
1. Each property stores its iCal export URL. A cron every 3 h fetches it and upserts `reservations` by `ical_uid`, and cancels the ones that disappeared.
2. Each new checkout automatically creates a **turnover** task for that date, assigned to the property's housekeeper. The task has a checklist (linen change, toiletries restock, photos). Completing it issues consumables from that property's stock (e.g. 1 linen set, 2 toiletry kits).
3. Monthly: upload the Airbnb earnings CSV → matched to reservations by property + dates → fills in payout/fees. Unmatched rows are listed for manual linking.
4. Property P&L = payouts − (rent + utilities + cleaning wages share + consumables + repairs + platform fees).
   KPIs: occupancy %, ADR (avg daily rate), RevPAR, net profit per property, cost per turnover.

**TD trip P&L**: For each `trip_batch`, revenue = `payments` (paid) for its bookings. Costs = expenses tagged to that batch (transport, hotels, food, permits, captain fee) + gear issued. Shows profit per batch, per pax, and margin %. A batch can be "closed" once all its costs are in.

**Inventory**: TD gear (tents, sleeping bags, first-aid, merch) is *issued* to a trip batch and *returned* after; anything not returned → damaged/lost → expense. Finzo consumables are restocked from a purchase (an expense with line items → stock in). A low-stock badge shows when stock < reorder level.

## 7. Overview screen (per business)

```
[ Travel Devils ▾ | Finzo Stays ]                       Nov 2026 ▾
┌ Revenue ┐ ┌ Expenses ┐ ┌ Profit ┐ ┌ Payroll due ┐ ┌ Pending approvals ┐
Chart: revenue vs. expense, last 6 months
TD:    upcoming batches with costs-entered status · top 5 batches by margin
Finzo: property table (occupancy, payout, cost, profit) · today's check-ins/outs/turnovers
Alerts: low stock · unpaid fixed costs · expenses awaiting approval · iCal sync failed
```

## 8. Security and storage
- Receipts, ID documents and payslips go in a **private Supabase bucket** (`ops-private`) and are served via short-lived signed URLs after a role check. Never through the public `/uploads/*` rewrite.
- Payroll pages/actions: `requireOps("owner"|"ops_manager", business)`. Salary columns are hidden from `staff` except their own.
- Audit: `created_by`/`approved_by` on every money row. Locked payroll and closed months are read-only.

## 9. Build phases (each one shippable)

| Phase | Ships | Rough size |
|---|---|---|
| 1. Foundation | Roles + business scope, `/ops` shell with switch, vendors, categories, expenses (mobile add + approve + receipts), fixed costs + cron, Overview v1, CSV export | ~1 week |
| 2. Finzo core | Properties, iCal sync, calendar, reservations, earnings CSV import, property P&L, turnovers | ~1 week |
| 3. People | Employees, attendance, leave, salary structures, advances | ~1 week |
| 4. Payroll + incentives | Payroll run/lock/payslips, incentive rules, salary → P&L | ~1 week |
| 5. TD trip P&L | Captain/sales links, batch costing, captain fees | 3–4 days |
| 6. Inventory | Items, locations, movements, issue/return to trips, turnover consumables, low stock | ~1 week |

Order rationale: expenses + Finzo first, because Finzo has no system at all today and expenses feed every other report.

## 10. Open questions for the owner
1. Do Finzo staff and TD staff overlap (one person paid by both)? If yes, one employee would need a salary split across businesses.
2. Is the Finzo rent paid to landlords (leased units) or are the flats owned? This changes the fixed-cost setup and the property P&L.
3. Who will actually use it day to day: only the owners, or also captains/housekeepers on their phones? This decides how much the mobile staff view matters in phase 1.
4. Are any Finzo listings also on Booking.com/MakeMyTrip? iCal handles those too, but CSV import would need one format per channel.
5. Do you want Finzo under its own domain/branding later, or is it fine living at `traveldevils…/ops`?

## 11. Left to the builder
Exact UI layout (reuse `components/admin/ui.tsx`, `TableEditor`), chart library (prefer plain SVG/CSS bars; no new dependency unless needed), cron via `vercel.json` crons, Drizzle migrations, category seed lists per business.
