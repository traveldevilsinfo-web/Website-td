# Back Office v2: Travel + BnB Management System

Status: **approved direction** (13 Nov 2026). Builds on `2026-11-13-ops-dashboard-design.md` (Phase 1 shipped on `ops-phase1`).

Owner decisions so far:
- one system with a **Travel Devils ⇄ Finzo Stays** switch
- logins and UI are **separate from the website**
- **dark finance look**
- **own build with iCal**: no paid channel manager

## 1. Who uses it (working assumptions, validate with the team)

| Person | Device, place | Job to be done | Pain today |
|---|---|---|---|
| **Owner** | Laptop at a desk, phone in the evening | "Am I making money, per flat and per trip? Who do I owe?" | Excel, WhatsApp screenshots of bills, month-end guesswork |
| **Ops manager** (one per business) | Phone all day, laptop in the morning | Approve spends, plan cleanings, fix what breaks, chase payouts | Calendars spread across Airbnb, Booking.com and notes, so double bookings happen |
| **Housekeeper / caretaker** | Phone only, low-end Android, Hindi/English, gloves on | "Which flat today, what to do, done" | Gets tasks by WhatsApp voice notes, and nobody knows if a job is finished |
| **Trip captain** (TD) | Phone on the road, patchy network | Log trip spends fast, get reimbursed | Bills get lost, and reimbursement takes weeks |
| **Accountant** (monthly) | Laptop | Clean CSV per month | Re-typing everything |

What follows for design:
- **The phone is primary** for three of the five people. Every frequent task must be doable one-handed in under 15 seconds.
- **The laptop is for decisions:** dense tables, month views and drill-down.
- **Staff see a small app**: Today, Tasks, Add expense, Me. Managers and the owner see everything.

To check with the team: language mix for staff, Android share, whether caretakers can read English task names, and how many flats each housekeeper covers.

## 2. Feature map: the requested list, made real with iCal

| Area | What we build | How (no channel manager) |
|---|---|---|
| **Channel & calendar** | One calendar for 13 flats × all channels, plus double-booking alerts | Import each listing's iCal (Airbnb, Booking.com, Vrbo, MMT) every 30 min, with manual "Sync now". **Export** one iCal feed per flat (direct bookings + owner blocks) and paste it into each OTA, so they block those dates. Clash detection flags overlapping stays. |
| | Unified listing info | Title, photos, house rules, Wi-Fi and lock code stored once here. These are *not* pushed to OTAs (no API). |
| **Guest comms** | Message templates and a "to send today" queue | Templates for confirmation, check-in instructions, mid-stay, checkout and review request, filled from the reservation. **One tap opens WhatsApp** (`wa.me` link) with the text ready. |
| | AI reply drafts (later) | Claude drafts an answer from the flat's guidebook + house rules; a person sends it. |
| **Pricing & revenue** | Rate calendar per flat (base, weekend, season, min nights), suggested prices, direct-booking coupons | Our rates are the source of truth; the manager copies changes to Airbnb by hand (no push). |
| **Operations** | Turnovers (cleaning) auto-created at every checkout, with a checklist, photos and an assignee | From iCal checkout dates. |
| | Maintenance tickets: priority, assignee or vendor, cost becomes an expense | Ours. |
| **Access & smart home** | Lock code per flat and per stay, with rotate reminders | Manual now. Brand APIs (Nuki, Yale, igloohome, Minut noise) once the brands are known. |
| **Direct & guest experience** | Public **guidebook** page per flat (Wi-Fi, rules, appliances, local tips) | `/stay/<flat>`, no login |
| | **Guest check-in form**: rental agreement e-signature | Typed name + checkbox + timestamp + IP (Indian IT Act click-wrap). **No ID documents** (owner's call, 13 Nov): collecting them brings DPDP Act duties the business doesn't want. |
| | Direct booking page with Razorpay (later) | Ours |
| **Finance** | Occupancy, average nightly rate (ADR), revenue per available night (RevPAR) per flat; owner statements; accountant CSV | Airbnb earnings CSV import gives payouts and fees. |
| **HRMS** (both businesses) | Employees, attendance, leave, salary, payroll run, payslips, advances, incentives | As in the v1 spec, §5–6 |
| **Inventory** (both businesses) | Items, stock per location (TD store, each flat), movements, low-stock alerts, auto-issue on turnover | As in the v1 spec |

Honest limits:
- iCal only carries dates, not prices or guest names, so payouts come from the CSV import.
- A sync gap of up to roughly 1–2 hours means a double booking is still *possible* in that window. Clash alerts catch it.

## 3. Design system v2

Sources: ui-ux-pro-max (the "Data-Dense + Drill-Down" pattern for operational dashboards), Apple's fluid-interface and typography guidance, and the personas above.

- **Type:** Plus Jakarta Sans, self-hosted by `next/font` (no network request, no layout shift). A
  geometric grotesque with open shapes and a tall x-height — the family hospitality brands reach for,
  and clearly not the website's Nunito.
  - Tabular numbers everywhere, so money columns line up.
  - Display sizes use −0.03em tracking and 1.05 leading; body text sits near 0 tracking and 1.5 leading.
  - Hierarchy comes from weight as much as size: bold labels, extrabold figures.
- **Colour: a whole palette per business, not one accent** (`app/ops/(app)/accent.ts`), so a glance
  tells you whose books are open:

  | | Travel Devils | Finzo Stays |
  |---|---|---|
  | Accent (`--acc`) | #2f54eb alpine blue | #ff385c coral |
  | On-white accent (`--acc-ink`) | #2546c8 | #d61f4e (raw coral is only 3.9:1 under white text) |
  | Page (`--bg`) | #f2f4f8 cool grey | #f7f5f2 warm paper |
  | Ink / muted | #0d1220 / #5a6478 | #1b1613 / #6b6054 |
  | Chrome (`--chrome`) | #0b1020 navy | #17110e warm charcoal |

  Finzo wears the look of the listings it manages. Travel Devils had to move off red for it: coral and
  red side by side would have destroyed the one thing the switch exists to make obvious.
  - Semantic (both): ok #15803d, warn #b45309, bad #b91c1c, info #0369a1
  - Channels: Airbnb #ff385c, Booking #1d4ed8, Vrbo #0e7490, MakeMyTrip #7c3aed, Direct #0f766e,
    Block #52525b. Direct is teal rather than the accent, because the Finzo accent *is* Airbnb's coral.
- **Structure:**
  - Dark structural sidebar on desktop, carrying a breath of the business's colour at its head
  - **Translucent chrome** (`backdrop-filter`) with content running underneath: the phone top bar, the
    phone tab bar, and every sticky table header
  - On phones, a **bottom tab bar**: Today · Calendar/Expenses · ＋ · Tasks · More, 44px+ targets
- **Data:**
  - Dense tables with sticky glass headers and right-aligned numbers; the sides fade rather than clip
  - Every KPI drills down to the rows behind it, and says so with a chevron on hover
  - Filters as chips in the URL, so they can be shared and the back button works
- **Motion** (`app/ops/ops.css`, after Apple's *Designing Fluid Interfaces*):
  - One curve does most of the work: `--ease-ios` `cubic-bezier(.32,.72,0,1)`
  - Page content rises 10px into place, each block 40ms behind the last
  - Press feedback is instant and on the press, not the release (`.ops-press`); cards lift under the pointer
  - The business switch is a segmented control whose thumb slides and recolours, so the switch shows
    you what changed
  - The phone "More" sheet (`Sheet.tsx`) is **grabbable**: it tracks the finger 1:1 from where it was
    held, rubber-bands past the top, and on release goes where the flick was *heading* (momentum
    projection), picking up from its live position if grabbed mid-flight
  - `prefers-reduced-motion` turns all of it into a 200ms cross-fade; `prefers-reduced-transparency`
    makes the glass solid; `prefers-contrast: more` darkens the hairlines
- **States:** every list has empty, loading (skeleton) and error states. Success feedback sits inline,
  next to what changed.

## 4. Phases (each shippable)

| # | Ships | Notes |
|---|---|---|
| 2 | **Design system v2**, then Properties, iCal import + export, multi-flat Calendar, Reservations, clash alerts, **Turnovers** (auto from checkouts), **Maintenance** tickets, plus WhatsApp message templates (pulled forward from Phase 3) | **Built** 13 Nov on `ops-phase1` |
| 3 | Guests: WhatsApp send queue, guest link per stay (check-in, signed house rules, then door code from the day before arrival), guidebook + in-flat QR link | **Built** 13 Nov on `ops-phase1` |
| 4 | Revenue: Airbnb earnings CSV import, occupancy/ADR/RevPAR per flat, owner statements, CSV export. **Rate calendar deferred**: we can't push prices anywhere, so our own copy of them would just be a note — revisit if a channel manager is added. | **Built** 13 Nov on `ops-phase1` |
| 5 | HRMS: people, attendance, advances, monthly payroll run (draft → lock → paid), incentives as manual lines. **Incentive rules engine deferred** until the owner settles a scheme; the per-month line does the same job today. Statutory PF/ESI/TDS stay manual deduction lines, as agreed. | **Built** 13 Nov on `ops-phase1` |
| 6 | Stock: items, movements (the only source of truth for quantity), stocktake, undo, consumables issued automatically when a cleaning is finished, low-stock alert on Today. **No locations table**: stock sits in the business's store or at one flat. | **Built** 14 Nov on `ops-phase1` |
| 7 | **TD trip profit + captains built** 14 Nov on `ops-phase1`: money in from paid website payments, costs from expenses tagged to the departure, profit/margin/per traveller, captain, gear out-and-back, and a "costs are in" flag. Still open: direct booking page, AI reply drafts, smart-lock and noise integrations. | |

## 5. Data (Phase 2)

```
properties     id, code (FZ-01), name, address, area, bedrooms, max_guests, checkin_time, checkout_time,
               lock_code, wifi_name, wifi_pass, notes, ical_token (export), active, sort
property_feeds id, property_id, channel(airbnb|booking|vrbo|mmt|other), url, last_sync_at, last_error, last_count
reservations   id, property_id, channel, source(ical|manual), external_uid, check_in, check_out (date, exclusive),
               guest_name, guests, phone, amount, status(confirmed|cancelled|blocked), notes, created_by
               unique(property_id, channel, external_uid)
turnovers      id, property_id, reservation_id, date, due_by, assignee_id → ops_users, status(todo|doing|done|issue),
               checklist jsonb [{label, done}], note, done_at; unique(reservation_id)
tickets        id, business, property_id?, title, detail, priority(low|normal|high|urgent), status(open|doing|waiting|done),
               assignee_id?, vendor_id?, cost, expense_id?, created_by, done_at
```

Sync rules (as built: calendars refresh lazily when the Calendar is opened and >30 min old, on "Sync now", and by a daily cron; Vercel Hobby allows only daily crons):
- An iCal event that disappears from its feed means **cancelled**, but only for future stays.
- "Not available"/blocked events become `blocked`.
- Manual or direct bookings appear in the export feed.
